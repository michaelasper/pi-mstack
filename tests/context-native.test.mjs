import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { packed, isolated, captures, rpc } from './helpers.mjs';

const sub = resolve('node_modules/pi-subagents');
const config = (sources, glossary = []) => ({ version: 'pi-mstack/environment/1', sources, glossary });
const readLines = path => existsSync(path) ? readFileSync(path, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse) : [];
const toolResult = (client, name) => client.records.filter(e => e.type === 'tool_execution_end' && e.toolName === name).at(-1);

async function setup(t, name, settings = {}, options = { mcp: true }, beforeStart = () => {}) {
  const artifact = packed(); const dir = join(artifact.dir, name); mkdirSync(dir);
  const iso = isolated(dir, artifact.packageRoot, typeof settings === 'function' ? settings(artifact.packageRoot) : settings, options);
  iso.env.MSTACK_PLAN = join(dir, 'plan.json'); iso.env.MSTACK_CHILD_PLAN = join(dir, 'child-plan.json'); iso.env.MSTACK_CHILD_LOG = join(dir, 'child-tool.jsonl');
  iso.env.PI_SUBAGENTS_TEMP_ROOT = join(dir, 'native-state');
  mkdirSync(join(iso.agentDir, 'pstack'));
  const serverLog = join(dir, 'server.jsonl');
  writeFileSync(join(iso.agentDir, 'mcp.json'), JSON.stringify({ mcpServers: { docs: { command: process.execPath, args: [join(artifact.packageRoot, 'tests/fixtures/mcp-server.mjs'), serverLog], exposure: 'direct' } } }));
  beforeStart({ ...iso, ...artifact, dir, serverLog });
  const client = rpc({ dir, ...iso });
  t.after(async () => {
    writeFileSync(join(dir, 'evidence.json'), JSON.stringify({ records: client.records, requests: captures(iso.env), server: readLines(serverLog) }, null, 2));
    await client.stop();
    process.stdout.write(`Context native evidence ${dir}\n`);
    if (!process.env.MSTACK_KEEP_TEST_ARTIFACTS) rmSync(artifact.dir, { recursive: true, force: true });
  });
  const plan = async (calls, text = '') => { writeFileSync(iso.env.MSTACK_PLAN, JSON.stringify(calls)); await client.turn('EXECUTE_TEST_PLAN ' + text); };
  return { ...iso, ...artifact, dir, serverLog, client, plan };
}

test('packed native MCP wrapper dispatches nonce and bounds its own output, not native records', { timeout: 30000 }, async t => {
  const s = await setup(t, 'wrapper', { defaultTools: ['+pstack_context'] });
  writeFileSync(join(s.agentDir, 'pstack/environment.json'), JSON.stringify(config([{ id: 'docs', kind: 'mcp', tool: 'mcp__docs__search', queryArgument: 'query' }])));
  const nonce = randomUUID();
  for (const query of [nonce, 'oversized:' + nonce, 'error:' + nonce]) {
    await s.plan([{ name: 'pstack_context', arguments: { source: 'docs', query } }], query);
    const wrapper = toolResult(s.client, 'pstack_context'); assert.ok(wrapper);
    const native = toolResult(s.client, 'mcp__docs__search'); assert.ok(native.parentToolCallId);
    assert.ok(Buffer.byteLength(wrapper.result.content[0].text) <= 16384);
    if (query.startsWith('error:')) {
      assert.equal(wrapper.isError, true); assert.doesNotMatch(JSON.stringify(wrapper.result), /SECRET_TOKEN_SENTINEL/);
      assert.match(JSON.stringify(native), /SECRET_TOKEN_SENTINEL/);
      const entries = (await s.client.send('get_entries')).entries;
      const message = entries.filter(e => e.message?.toolName === 'pstack_context').at(-1).message;
      assert.match(JSON.stringify(message.nestedCalls), /SECRET_TOKEN_SENTINEL/);
      assert.match(JSON.stringify(message.nestedCalls), new RegExp(nonce));
    } else {
      assert.equal(wrapper.isError, false, JSON.stringify(wrapper));
      assert.match(wrapper.result.content[0].text, new RegExp('MCP_NONCE:' + query));
      assert.match(JSON.stringify(captures(s.env).at(-1).messages), new RegExp(nonce));
      if (query.startsWith('oversized:')) { assert.match(wrapper.result.content[0].text, /truncated/); assert.ok(JSON.stringify(native.result).length > JSON.stringify(wrapper.result).length); }
    }
  }
  const calls = readLines(s.serverLog); assert.equal(calls.length, 3);
  for (const call of calls) { assert.match(call.request.params.arguments.query, new RegExp(nonce)); assert.match(JSON.stringify(call.result), new RegExp(nonce)); }
  await s.plan([{ name: 'pstack_context', arguments: { source: 'docs', query: 'é'.repeat(1025) } }]);
  assert.equal(toolResult(s.client, 'pstack_context').isError, true);
  assert.equal(readLines(s.serverLog).length, 3, 'oversized query never reaches MCP');
  const memory = join(s.dir, 'on-demand'); writeFileSync(memory, 'MEMORY_NONCE:' + nonce);
  writeFileSync(join(s.agentDir, 'pstack/environment.json'), JSON.stringify(config([{ id: 'notes', kind: 'memory', path: memory, delivery: 'on-demand' }])));
  await s.plan([{ name: 'pstack_context', arguments: { source: 'notes', query: '' } }]);
  assert.equal(toolResult(s.client, 'pstack_context').isError, false);
  assert.match(JSON.stringify(toolResult(s.client, 'pstack_context')), new RegExp('MEMORY_NONCE:' + nonce));
  const entries = (await s.client.send('get_entries')).entries;
  assert.match(JSON.stringify(entries.filter(e => e.message?.toolName === 'pstack_context').at(-1)), new RegExp('MEMORY_NONCE:' + nonce));
});

test('native bundled children load relative context once and invoke custom tool and selected stdio MCP', { timeout: 60000 }, async t => {
  const s = await setup(t, 'children', packageRoot => ({ packages: [packageRoot, sub], subagents: { orcaProgressTabs: { enabled: false }, agentOverrides: { 'comment-sicko': { tools: ['read', 'grep', 'find', 'ls', 'pstack_context', 'fixture_child_tool', 'mcp:docs/search'], extensions: [join(packageRoot, 'tests/fixtures/provider.ts'), join(packageRoot, 'tests/fixtures/child-tool.ts'), join(packageRoot, 'extensions/pstack/context.ts')] } } } }));
  const nonce = randomUUID(); const memory = join(s.dir, 'memory'); writeFileSync(memory, 'AUTO_NONCE:' + nonce);
  writeFileSync(join(s.agentDir, 'pstack/environment.json'), JSON.stringify(config([{ id: 'local', kind: 'memory', path: memory, delivery: 'automatic' }, { id: 'docs', kind: 'mcp', tool: 'mcp__docs__search', queryArgument: 'query' }], [{ term: 'Jira', meaning: 'LOCAL_GLOSSARY_' + nonce, availability: 'conditional' }])));
  await s.client.turn('Inspect tools');
  if (captures(s.env).at(-1).tools.includes('subagents_enable')) await s.plan([{ name: 'subagents_enable', arguments: {} }]);
  writeFileSync(s.env.MSTACK_CHILD_PLAN, JSON.stringify([{ name: 'fixture_child_tool', arguments: { nonce } }, { name: 'pstack_context', arguments: { source: 'docs', query: nonce } }]));
  await s.plan([{ name: 'subagent', arguments: { agent: 'comment-sicko', task: 'EXECUTE_CHILD_PLAN ' + nonce, async: false, model: 'mstack-test/script/model:off', options: { timeoutMs: 15000, acceptance: { level: 'none', reason: 'scripted native execution evidence' } } } }]);
  const result = toolResult(s.client, 'subagent'); assert.equal(result?.isError, false, JSON.stringify(result));
  assert.match(JSON.stringify(result), new RegExp('CHILD_TOOL_NONCE:' + nonce)); assert.match(JSON.stringify(result), new RegExp('MCP_NONCE:' + nonce));
  assert.deepEqual(readLines(s.env.MSTACK_CHILD_LOG), [{ nonce }]);
  assert.equal(readLines(s.serverLog).filter(r => r.request.params.arguments.query === nonce).length, 1);
  const requests = captures(s.env).filter(c => c.messages.some(m => m.role === 'user' && JSON.stringify(m).includes('EXECUTE_CHILD_PLAN')) && c.tools.includes('fixture_child_tool'));
  assert.equal(requests.length, 2, JSON.stringify(requests));
  for (const request of requests) {
    assert.equal(request.system.split('LOCAL_GLOSSARY_' + nonce).length - 1, 1);
    assert.equal(JSON.stringify(request.messages).split('AUTO_NONCE:' + nonce).length - 1, 1);
    assert.doesNotMatch(request.system, /<pi-mstack-role-data>/);
  }
});

test('default child allowlists remain narrow while relative context loads in foreground and background', { timeout: 60000 }, async t => {
  const s = await setup(t, 'default-children', packageRoot => ({ packages: [packageRoot, sub], subagents: { defaultExtensions: [join(packageRoot, 'tests/fixtures/provider.ts')], orcaProgressTabs: { enabled: false } } }));
  const nonce = randomUUID(); const memory = join(s.dir, 'memory'); writeFileSync(memory, nonce);
  writeFileSync(join(s.agentDir, 'pstack/environment.json'), JSON.stringify(config([{ id: 'local', kind: 'memory', path: memory, delivery: 'automatic' }])));
  await s.client.turn('Inspect tools');
  if (captures(s.env).at(-1).tools.includes('subagents_enable')) await s.plan([{ name: 'subagents_enable', arguments: {} }]);
  for (const async of [false, true]) {
    const output = join(s.dir, `child-${async}.md`);
    const done = async ? s.client.wait(e => e.type === 'agent_settled' && existsSync(output), 25000) : undefined;
    await s.plan([{ name: 'subagent', arguments: { agent: 'comment-sicko', task: `NATIVE_CHILD_${async}`, async, model: 'mstack-test/script/model:off', output, options: { timeoutMs: 15000, acceptance: { level: 'none', reason: 'scripted context load proof' } } } }]);
    if (done) await done;
    assert.equal(readFileSync(output, 'utf8').trim(), 'native-child-retained');
    const request = captures(s.env).find(c => c.messages.some(m => m.role === 'user' && JSON.stringify(m).includes(`NATIVE_CHILD_${async}`)) && !c.tools.includes('subagent'));
    assert.ok(request); assert.ok(!request.tools.includes('pstack_context')); assert.ok(!request.tools.some(n => n.startsWith('mcp__')));
    assert.equal(JSON.stringify(request.messages).split(nonce).length - 1, 1);
    assert.doesNotMatch(request.system, /<pi-mstack-role-data>|<pi-mstack-mode>/);
  }
});

test('native child missing providers, missing MCP tools, hidden tools and declined project trust fail before child inference', { timeout: 60000 }, async t => {
  for (const kind of ['provider', 'missing-tool', 'hidden', 'trust']) {
    const s = await setup(t, kind, packageRoot => ({ packages: [packageRoot, sub], subagents: { orcaProgressTabs: { enabled: false }, agentOverrides: { 'comment-sicko': { tools: kind === 'provider' ? ['fixture_child_tool'] : [kind === 'missing-tool' ? 'mcp:docs/absent' : 'mcp:docs/search'] } } } }), { mcp: true }, iso => {
      const file = join(iso.agentDir, 'mcp.json'); const mcp = JSON.parse(readFileSync(file, 'utf8'));
      if (kind === 'hidden') { mcp.mcpServers.docs.exposure = 'hidden'; writeFileSync(file, JSON.stringify(mcp)); }
      if (kind === 'trust') {
        mkdirSync(join(iso.dir, '.pi'), { recursive: true }); writeFileSync(join(iso.dir, '.pi/mcp.json'), JSON.stringify(mcp)); writeFileSync(file, '{"mcpServers":{}}');
      }
    });
    await s.client.turn('Inspect tools');
    if (captures(s.env).at(-1).tools.includes('subagents_enable')) await s.plan([{ name: 'subagents_enable', arguments: {} }]);
    await s.plan([{ name: 'subagent', arguments: { agent: 'comment-sicko', task: 'MUST_NOT_REACH_CHILD_' + kind, async: false, model: 'mstack-test/script/model:off', options: { timeoutMs: 10000, acceptance: { level: 'none', reason: 'negative native preflight' } } } }]);
    const result = toolResult(s.client, 'subagent'); assert.equal(result?.isError, true, JSON.stringify(result));
    assert.match(JSON.stringify(result), /unavailable|missing|hidden|not found|no matching|could not|unknown/i);
    assert.equal(readLines(s.serverLog).length, 0);
    assert.ok(!captures(s.env).some(c => c.messages.some(m => m.role === 'user' && JSON.stringify(m).includes('MUST_NOT_REACH_CHILD_'))));
    await s.client.stop();
  }
});

test('native automatic memory refreshes next run, never persists, and untrusted project environment is ignored', { timeout: 30000 }, async t => {
  const s = await setup(t, 'automatic', {}, { mcp: false }, iso => {
    mkdirSync(join(iso.dir, '.pi/pstack'), { recursive: true });
    writeFileSync(join(iso.dir, '.pi/settings.json'), '{}');
    writeFileSync(join(iso.dir, '.pi/pstack/environment.json'), JSON.stringify(config([], [{ term: 'ProjectSecret', meaning: 'UNTRUSTED_SENTINEL', availability: 'available' }])));
  });
  const memory = join(s.dir, 'memory'); writeFileSync(memory, 'AUTO_FIRST');
  writeFileSync(join(s.agentDir, 'pstack/environment.json'), JSON.stringify(config([{ id: 'local', kind: 'memory', path: memory, delivery: 'automatic' }])));
  await s.client.turn('first');
  assert.match(JSON.stringify(captures(s.env).at(-1).messages), /AUTO_FIRST/);
  assert.doesNotMatch(captures(s.env).at(-1).system, /UNTRUSTED_SENTINEL/);
  writeFileSync(memory, 'AUTO_SECOND'); await s.client.turn('second');
  const request = JSON.stringify(captures(s.env).at(-1).messages);
  assert.doesNotMatch(request, /AUTO_FIRST/); assert.equal(request.split('AUTO_SECOND').length - 1, 1);
  assert.doesNotMatch(JSON.stringify((await s.client.send('get_entries')).entries), /AUTO_FIRST|AUTO_SECOND/);
});

test('native trust distinguishes implicit bare-config trust from explicit denial without a second permission manager', { timeout: 30000 }, async t => {
  for (const mode of ['bare', 'denied', 'protected']) {
    const s = await setup(t, 'trust-' + mode, {}, { mcp: false }, iso => {
      mkdirSync(join(iso.dir, '.pi/pstack'), { recursive: true });
      if (mode === 'protected') writeFileSync(join(iso.dir, '.pi/settings.json'), '{}');
      if (mode === 'denied') iso.args.push('--no-approve');
      writeFileSync(join(iso.dir, 'project-memory'), 'PROJECT_MEMORY_SENTINEL');
      writeFileSync(join(iso.dir, '.pi/pstack/environment.json'), JSON.stringify(config([{ id: 'project', kind: 'memory', path: 'project-memory', delivery: 'automatic' }], [{ term: 'ProjectTerm', meaning: 'PROJECT_GLOSSARY_SENTINEL', availability: 'available' }])));
      const userMemory = join(iso.dir, 'user-memory'); writeFileSync(userMemory, 'USER_MEMORY_SENTINEL');
      writeFileSync(join(iso.agentDir, 'pstack/environment.json'), JSON.stringify(config([{ id: 'user', kind: 'memory', path: userMemory, delivery: 'automatic' }])));
    });
    await s.client.send('prompt', { message: '/pstack doctor' });
    const doctor = s.client.records.filter(e => e.method === 'notify').at(-1).message;
    assert.match(doctor, mode === 'bare' ? /Project trusted: true/ : /Project trusted: false/);
    await s.client.turn('TRUST_OBSERVATION');
    const request = captures(s.env).at(-1);
    assert.match(JSON.stringify(request.messages), /USER_MEMORY_SENTINEL/);
    if (mode === 'bare') {
      assert.match(JSON.stringify(request.messages), /PROJECT_MEMORY_SENTINEL/);
      assert.match(request.system, /PROJECT_GLOSSARY_SENTINEL/);
    } else {
      assert.doesNotMatch(JSON.stringify(request), /PROJECT_MEMORY_SENTINEL|PROJECT_GLOSSARY_SENTINEL/);
      writeFileSync(join(s.dir, '.pi/pstack/environment.json'), '{INVALID_PROJECT');
      await s.client.turn('DENIED_CONFIG_NOT_READ');
      assert.match(JSON.stringify(captures(s.env).at(-1).messages), /USER_MEMORY_SENTINEL/);
      assert.ok(!s.client.records.some(e => e.method === 'notify' && /Environment configuration invalid/.test(e.message)));
    }
    await s.client.stop();
  }
});
