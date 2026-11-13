import { test } from 'node:test';
import { createServer } from 'node:http';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync, existsSync, watch, unlinkSync, rmSync, realpathSync, renameSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { packed, isolated, rpc, captures, cli } from './helpers.mjs';

const lines = path => existsSync(path) ? readFileSync(path, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse) : [];
const result = client => client.records.filter(e => e.type === 'tool_execution_end' && e.toolName === 'pstack_context').at(-1);
const operation = effect => ({ effect, target: { tool: 'mcp__tracker__' + (effect === 'write' ? 'update' : 'search') }, inputs: effect === 'write' ? { key: { type: 'string' }, state: { type: 'string' } } : { query: { type: 'string' } }, template: effect === 'write' ? { key: { $arg: 'key' }, state: { $arg: 'state' } } : { query: { $arg: 'query' } } });
function waitFile(path, predicate) {
  return new Promise((resolve, reject) => {
    const check = () => { if (predicate(lines(path))) { clearTimeout(timer); watcher.close(); resolve(); } };
    const watcher = watch(dirname(path), check);
    const timer = setTimeout(() => { watcher.close(); reject(Error('File event watchdog ' + path)); }, 10000);
    check();
  });
}
async function setup(t, alternate = false, exposure = 'direct', project = false, url, delayed = false) {
  const artifact = packed(), dir = join(artifact.dir, 'roles'); mkdirSync(dir);
  const iso = isolated(dir, artifact.packageRoot, { defaultTools: ['+pstack_context'] }, { mcp: true });
  const log = join(dir, 'server.jsonl'), effects = join(dir, 'effects.jsonl'), gate = join(dir, 'release');
  iso.env.MSTACK_PLAN = join(dir, 'plan.json');
  iso.args.push('-e', join(artifact.packageRoot, 'tests/fixtures/role-permission.ts'), '-e', join(artifact.packageRoot, 'tests/fixtures/role-control.ts'));
  if (alternate) iso.args.push('-e', join(artifact.packageRoot, 'tests/fixtures/role-alternate.ts'));
  mkdirSync(join(iso.agentDir, 'pstack'));
  writeFileSync(join(iso.agentDir, 'pstack/environment.json'), JSON.stringify({ version: 'pi-mstack/environment/1', roles: { tracker: { update: operation('write'), search: operation('read') } } }));
  writeFileSync(join(iso.agentDir, 'mcp.json'), JSON.stringify({ mcpServers: { tracker: url ? { url, exposure } : { command: process.execPath, args: [join(artifact.packageRoot, 'tests/fixtures/role-mcp-server.mjs'), log, effects, gate, ...(delayed ? [join(dir, 'release-list')] : [])], exposure } } }));
  if (project) {
    mkdirSync(join(dir, '.pi/pstack'), { recursive: true });
    renameSync(join(iso.agentDir, 'pstack/environment.json'), join(dir, '.pi/pstack/environment.json'));
    writeFileSync(join(iso.agentDir, 'pstack/environment-grants.json'), JSON.stringify({ version: 'pi-mstack/environment-grants/1', projects: [realpathSync(dir)] }));
    const outside = dir + '-agent'; renameSync(iso.agentDir, outside); iso.agentDir = outside; iso.env.PI_CODING_AGENT_DIR = outside;
  }
  const client = rpc({ dir, ...iso });
  t.after(async () => {
    await client.stop();
    writeFileSync(join(dir, 'evidence.json'), JSON.stringify({ cli, records: client.records, requests: captures(iso.env), stderr: client.stderr(), server: lines(log), effects: lines(effects) }, null, 2));
    console.log('Role native evidence ' + dir);
    if (!process.env.MSTACK_KEEP_TEST_ARTIFACTS) rmSync(artifact.dir, { recursive: true, force: true });
  });
  const plan = async (args, operation = 'update') => {
    writeFileSync(iso.env.MSTACK_PLAN, JSON.stringify([{ name: 'pstack_context', arguments: { role: 'tracker', operation, args } }]));
    const settled = client.wait(e => e.type === 'agent_settled', 45000);
    await client.send('prompt', { message: 'EXECUTE_TEST_PLAN' }); await settled;
    return result(client);
  };
  return { ...iso, ...artifact, dir, log, effects, gate, client, plan };
}

test('packed role receipts preserve native denial, withheld commit, success and read deadlines', { timeout: 65000 }, async t => {
  const s = await setup(t);
  let r = await s.plan({ key: 'denied:fixture', state: 'done' });
  assert.equal(lines(s.effects).length, 0);
  assert.equal(r.result.details.outcome, 'unknown-outcome');
  const nested = s.client.records.filter(e => e.type === 'tool_execution_end' && e.toolName === 'mcp__tracker__update').at(-1);
  assert.equal(nested.parentToolCallId, r.toolCallId);
  r = await s.plan({ key: 'slow:fixture', state: 'done' });
  assert.equal(r.result.details.outcome, 'unknown-outcome');
  assert.deepEqual(lines(s.effects), [{ key: 'slow:fixture', state: 'done' }]);
  const receiptId = r.toolCallId;
  writeFileSync(s.gate, 'release after receipt'); await waitFile(s.log, rows => rows.some(x => x.event === 'replied'));
  await s.client.turn('barrier after reply');
  assert.equal(lines(s.effects).length, 1);
  assert.equal(s.client.records.filter(e => e.type === 'tool_execution_end' && e.toolCallId === receiptId).length, 1);
  const aborted = s.client.records.filter(e => e.type === 'tool_execution_end' && e.parentToolCallId === receiptId);
  assert.equal(aborted.length, 1); assert.equal(aborted[0].isError, true);
  unlinkSync(s.gate);
  r = await s.plan({ key: 'ok:fixture', state: 'done' });
  assert.equal(lines(s.effects).length, 2);
  assert.equal(r.result.details.outcome, 'reported-success');
  assert.equal(r.result.details.callId, r.toolCallId);
  assert.equal(r.result.details.target.tool, 'mcp__tracker__update');
  assert.equal(r.result.details.kind, 'mutation');
  assert.ok(Buffer.byteLength(r.result.content[0].text) <= 16384);
  r = await s.plan({ query: 'slow:read' }, 'search');
  assert.equal(r.result.details.kind, 'unavailable');
  writeFileSync(s.gate, 'release after read deadline');
  await waitFile(s.log, rows => rows.filter(x => x.event === 'replied').length === 3);
  await s.client.turn('read barrier');
  assert.equal(lines(s.effects).length, 2);
});

test('packed role writes reject alternate adapter provenance before nested dispatch', { timeout: 20000 }, async t => {
  const s = await setup(t, true);
  const r = await s.plan({ key: 'alternate', state: 'done' });
  assert.equal(r.result.details.outcome, 'not-dispatched');
  assert.ok(!s.client.records.some(e => e.type === 'tool_execution_start' && e.toolName === 'mcp__tracker__update'));
  assert.equal(lines(s.effects).length, 0);
});

test('native role matrix preserves rendering, rejects invalid calls, and doctor never dispatches', { timeout: 45000 }, async t => {
  const s = await setup(t);
  await s.client.turn('startup with no operation');
  await s.client.send('prompt', { message: '/pstack doctor' });
  assert.equal(lines(s.log).length, 0);
  assert.match(s.client.records.filter(e => e.method === 'notify').at(-1).message, /tracker\/update: write;.*callable-snapshot/);
  let r = await s.plan({ query: 'read-nonce' }, 'search');
  assert.equal(r.result.details.kind, 'evidence');
  assert.match(r.result.content[0].text, /read-nonce/);
  for (const args of [{ key: 'missing' }, { key: 'x', state: 'done', extra: 'x' }, { key: 5, state: 'done' }, { key: 'é'.repeat(4096), state: 'done' }, { key: { nested: true }, state: 'done' }]) {
    r = await s.plan(args); assert.equal(r.isError, true); assert.equal(lines(s.effects).length, 0);
  }
  const configFile = join(s.agentDir, 'pstack/environment.json');
  const config = JSON.parse(readFileSync(configFile, 'utf8'));
  config.roles.tracker.update.template = { key: { $arg: 'key' }, state: { $arg: 'key' }, unused: { $arg: 'state' } };
  writeFileSync(configFile, JSON.stringify(config));
  r = await s.plan({ key: 'x'.repeat(4100), state: 'done' });
  assert.equal(r.isError, true); assert.equal(lines(s.effects).length, 0);
  config.roles.tracker.update = operation('write'); writeFileSync(configFile, JSON.stringify(config));
  r = await s.plan({ key: 'error:committed', state: 'done' });
  assert.equal(r.result.details.outcome, 'unknown-outcome'); assert.equal(lines(s.effects).length, 1);
  r = await s.plan({ key: 'oversized:committed', state: 'done' });
  assert.equal(r.result.details.outcome, 'reported-success');
  const text = r.result.content[0].text;
  assert.ok(Buffer.byteLength(text) <= 16384); assert.equal(JSON.parse(text).callId, r.toolCallId);
  assert.equal(lines(s.effects).length, 2);
  const replacement = structuredClone(config); replacement.roles.tracker.update.template.state = 'changed';
  delete replacement.roles.tracker.update.inputs.state;
  writeFileSync(join(s.dir, 'control.json'), JSON.stringify({ file: configFile, config: replacement }));
  r = await s.plan({ key: 'snapshot', state: 'done' });
  assert.equal(r.result.details.reason, 'configuration-changed'); assert.equal(lines(s.effects).length, 2);
  unlinkSync(join(s.dir, 'control.json'));
  writeFileSync(configFile, JSON.stringify(config));
  writeFileSync(join(s.dir, 'control.json'), JSON.stringify({ withdraw: 'mcp__tracker__update' }));
  r = await s.plan({ key: 'withdrawn', state: 'done' });
  assert.equal(r.result.details.outcome, 'not-dispatched'); assert.equal(lines(s.effects).length, 2);
});

test('native role exposure matrix and exact punctuation identities', { timeout: 45000 }, async t => {
  for (const exposure of ['hidden', 'deferred', 'codemode']) {
    const s = await setup(t, false, exposure);
    const r = await s.plan({ key: exposure, state: 'done' });
    assert.equal(r.result.details.outcome, exposure === 'hidden' ? 'not-dispatched' : 'reported-success');
    assert.equal(lines(s.effects).length, exposure === 'hidden' ? 0 : 1);
    await s.client.send('prompt', { message: '/pstack doctor' });
    assert.match(s.client.records.filter(e => e.method === 'notify').at(-1).message, new RegExp(exposure === 'hidden' ? '; hidden;' : '; callable-snapshot;'));
    await s.client.stop();
  }
  const s = await setup(t);
  await s.client.turn('connect');
  await s.client.send('prompt', { message: '/role-metadata' });
  const tools = JSON.parse(s.client.records.filter(e => e.method === 'notify').at(-1).message);
  const collisions = tools.filter(tool => tool.name.startsWith('mcp__tracker__update_name'));
  assert.equal(collisions.length, 2); assert.notEqual(collisions[0].name, collisions[1].name);
  const configFile = join(s.agentDir, 'pstack/environment.json'), config = JSON.parse(readFileSync(configFile, 'utf8'));
  for (const [index, tool] of collisions.entries()) {
    config.roles.tracker.update.target = { tool: tool.name, selector: 'tracker/unverified' };
    writeFileSync(configFile, JSON.stringify(config));
    const r = await s.plan({ key: 'collision-' + index, state: 'done' });
    assert.equal(r.result.details.outcome, 'reported-success'); assert.equal(r.result.details.target.tool, tool.name);
    const nested = s.client.records.filter(e => e.type === 'tool_execution_start' && e.parentToolCallId === r.toolCallId);
    assert.deepEqual(nested.map(e => e.toolName), [tool.name]);
  }
  assert.notEqual(lines(s.log)[0].request.params.name, lines(s.log)[2].request.params.name);
  for (const [tool, status] of [['mcp__fixture__model', 'model-only'], ['mcp__missing__update', 'unregistered']]) {
    config.roles.tracker.update.target = { tool }; writeFileSync(configFile, JSON.stringify(config));
    const r = await s.plan({ key: 'unavailable', state: 'done' }); assert.equal(r.result.details.outcome, 'not-dispatched');
    await s.client.send('prompt', { message: '/pstack doctor' });
    assert.match(s.client.records.filter(e => e.method === 'notify').at(-1).message, new RegExp('; ' + status + ';'));
  }
  assert.equal(lines(s.effects).length, 2);
});

test('native explicit abort after commit never reports success or retries', { timeout: 20000 }, async t => {
  const s = await setup(t);
  const pending = s.plan({ key: 'slow:abort', state: 'done' });
  await waitFile(s.effects, rows => rows.length === 1);
  await s.client.send('abort');
  await pending;
  writeFileSync(s.gate, 'release after abort'); await waitFile(s.log, rows => rows.some(row => row.event === 'replied'));
  await s.client.turn('abort barrier');
  const receipts = s.client.records.filter(e => e.type === 'tool_execution_end' && e.toolName === 'pstack_context');
  assert.ok(receipts.every(e => e.result.details?.outcome !== 'reported-success'));
  assert.equal(lines(s.effects).length, 1);
  assert.equal(lines(s.log).filter(row => row.event === 'call').length, 1);
});

test('native permission prompt and exact project grant revocation never dispatch denied writes', { timeout: 25000 }, async t => {
  const s = await setup(t, false, 'direct', true);
  const prompt = s.client.wait(e => e.type === 'extension_ui_request' && e.method === 'confirm');
  const pending = s.plan({ key: 'prompt:decline', state: 'done' });
  const question = await prompt; s.client.respond(question.id, { confirmed: false });
  let r = await pending;
  assert.equal(r.result.details.outcome, 'unknown-outcome'); assert.equal(lines(s.effects).length, 0);
  r = await s.plan({ key: 'authorized', state: 'done' }); assert.equal(r.result.details.outcome, 'reported-success');
  writeFileSync(join(s.dir, 'control.json'), JSON.stringify({ revoke: join(s.agentDir, 'pstack/environment-grants.json') }));
  r = await s.plan({ key: 'revoked', state: 'done' });
  assert.equal(r.result.details.reason, 'configuration-changed'); assert.equal(lines(s.effects).length, 1);
});

test('native orderly shutdown after commit suppresses successful delivery and retries', { timeout: 20000 }, async t => {
  const s = await setup(t);
  writeFileSync(s.env.MSTACK_PLAN, JSON.stringify([{ name: 'pstack_context', arguments: { role: 'tracker', operation: 'update', args: { key: 'slow:shutdown', state: 'done' } } }]));
  await s.client.send('prompt', { message: 'EXECUTE_TEST_PLAN' });
  await waitFile(s.effects, rows => rows.length === 1);
  await s.client.stop();
  assert.equal(s.client.child.exitCode, 0, s.client.stderr());
  assert.equal(lines(s.effects).length, 1);
  assert.ok(s.client.records.filter(e => e.type === 'tool_execution_end' && e.toolName === 'pstack_context').every(e => e.result.details?.outcome !== 'reported-success'));
});

test('native HTTP disconnect after mutation yields unknown outcome without retry', { timeout: 20000 }, async t => {
  const requests = [], effects = [];
  const server = createServer(async (req, res) => {
    if (req.method !== 'POST') { res.writeHead(405); res.end(); return; }
    let body = ''; for await (const chunk of req) body += chunk;
    const request = JSON.parse(body); requests.push(request);
    if (request.id === undefined) { res.writeHead(202); res.end(); return; }
    let result = {};
    if (request.method === 'initialize') result = { protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'http-fixture', version: '1' } };
    if (request.method === 'tools/list') result = { tools: [{ name: 'update', description: 'Commit then disconnect', inputSchema: { type: 'object', properties: { key: { type: 'string' }, state: { type: 'string' } }, required: ['key', 'state'], additionalProperties: false } }] };
    if (request.method === 'tools/call') { effects.push(request.params.arguments); res.destroy(); return; }
    res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ jsonrpc: '2.0', id: request.id, result }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const s = await setup(t, false, 'direct', false, `http://127.0.0.1:${server.address().port}/mcp`);
  const r = await s.plan({ key: 'http:committed', state: 'done' });
  assert.equal(r.result.details.outcome, 'unknown-outcome');
  await s.client.turn('HTTP barrier');
  writeFileSync(join(s.dir, 'http-evidence.json'), JSON.stringify({ requests, effects }, null, 2));
  assert.deepEqual(effects, [{ key: 'http:committed', state: 'done' }]);
  assert.equal(requests.filter(r => r.method === 'tools/call').length, 1);
});

test('native tree navigation refuses active mutation and resets safely after abort', { timeout: 20000 }, async t => {
  const s = await setup(t);
  await s.client.turn('tree anchor');
  await s.client.send('prompt', { message: '/role-anchor' });
  const pending = s.plan({ key: 'slow:tree', state: 'done' });
  await waitFile(s.effects, rows => rows.length === 1);
  await s.client.send('prompt', { message: '/role-tree' });
  assert.equal(s.client.records.filter(e => e.method === 'notify').at(-1).message, 'Fixture tree rejected');
  await s.client.send('abort'); await pending;
  await s.client.send('prompt', { message: '/role-tree' });
  assert.equal(s.client.records.filter(e => e.method === 'notify').at(-1).message, 'Fixture tree navigated');
  writeFileSync(s.gate, 'release after navigation'); await waitFile(s.log, rows => rows.some(row => row.event === 'replied'));
  await s.client.turn('tree barrier');
  assert.equal(lines(s.effects).length, 1);
  assert.ok(s.client.records.filter(e => e.type === 'tool_execution_end' && e.toolName === 'pstack_context').every(e => e.result.details?.outcome !== 'reported-success'));
});

test('native closed request and configuration boundaries prevent server calls', { timeout: 25000 }, async t => {
  const s = await setup(t);
  for (const input of [
    { source: 'legacy', query: '', role: 'tracker', operation: 'update', args: { key: 'x', state: 'done' } },
    { role: 'invalid', operation: 'update', args: { key: 'x', state: 'done' } },
    { role: 'tracker', operation: 'update', args: { key: 'x', state: 'done' }, tool: 'mcp__tracker__update' },
    { role: 'tracker', operation: 'update', args: JSON.parse('{"__proto__":"x","key":"x","state":"done"}') },
  ]) {
    writeFileSync(s.env.MSTACK_PLAN, JSON.stringify([{ name: 'pstack_context', arguments: input }]));
    await s.client.turn('EXECUTE_TEST_PLAN'); assert.equal(result(s.client).isError, true);
  }
  const file = join(s.agentDir, 'pstack/environment.json'), config = JSON.parse(readFileSync(file, 'utf8'));
  for (const template of [{ key: { $arg: 'undeclared' } }, JSON.parse('{"__proto__":1}'), { key: { $arg: 'key', extra: 1 }, state: { $arg: 'state' } }]) {
    const bad = structuredClone(config); bad.roles.tracker.update.template = template; writeFileSync(file, JSON.stringify(bad));
    assert.equal((await s.plan({ key: 'x', state: 'done' })).isError, true);
  }
  assert.equal(lines(s.log).length, 0);
  config.roles.tracker.update.inputs = { key: { type: 'string' } };
  config.roles.tracker.update.template = { key: { $arg: 'key' }, state: 'literal-state' };
  writeFileSync(file, JSON.stringify(config));
  assert.equal((await s.plan({ key: 'rendered-nonce' })).result.details.outcome, 'reported-success');
  assert.deepEqual(lines(s.effects), [{ key: 'rendered-nonce', state: 'literal-state' }]);
  config.roles.tracker.update.template.extra = true; writeFileSync(file, JSON.stringify(config));
  assert.equal((await s.plan({ key: 'native-schema-rejects' })).result.details.outcome, 'unknown-outcome');
  assert.equal(lines(s.effects).length, 1);
});

test('native reachability waits for a selected codemode server still listing tools', { timeout: 20000 }, async t => {
  const s = await setup(t, false, 'codemode', false, undefined, true);
  const pending = s.plan({ key: 'late-registration', state: 'done' });
  await waitFile(s.log, rows => rows.some(row => row.event === 'listing'));
  assert.equal(lines(s.effects).length, 0);
  writeFileSync(join(s.dir, 'release-list'), 'release selected server');
  assert.equal((await pending).result.details.outcome, 'reported-success');
  assert.deepEqual(lines(s.effects), [{ key: 'late-registration', state: 'done' }]);
});
