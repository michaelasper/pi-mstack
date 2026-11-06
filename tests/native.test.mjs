import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { packed, isolated, captures, rpc } from './helpers.mjs';

const sub = resolve('node_modules/pi-subagents');
const loop = resolve('node_modules/@trevonistrevon/pi-loop');

async function enableIfNeeded(client, env) {
  await client.turn('Inspect available native tools');
  if (captures(env).at(-1).tools.includes('subagents_enable')) {
    writeFileSync(env.MSTACK_PLAN, JSON.stringify([{ name: 'subagents_enable', arguments: {} }]));
    await client.turn('EXECUTE_TEST_PLAN enable');
    const result = client.records.filter(e => e.type === 'tool_execution_end' && e.toolName === 'subagents_enable').at(-1);
    assert.equal(result?.isError, false, JSON.stringify(result));
  }
  assert.ok(captures(env).at(-1).tools.includes('subagent'));
}

function assertExited(pid) {
  assert.throws(() => process.kill(pid, 0), { code: 'ESRCH' }, `process ${pid} must exit`);
}

test('native dependencies discover packed agents, retain async child output, and deliver monitor wake', { timeout: 60000 }, async t => {
  const artifact = packed();
  const dir = join(artifact.dir, 'native'); mkdirSync(dir);
  const provider = join(artifact.packageRoot, 'tests/fixtures/provider.ts');
  const iso = isolated(dir, artifact.packageRoot, { packages: [artifact.packageRoot, sub, loop], subagents: { defaultExtensions: [provider], agentOverrides: { 'comment-sicko': { model: 'mstack-test/other:off' } }, orcaProgressTabs: { enabled: false } } });
  iso.env.PI_SUBAGENTS_TEMP_ROOT = join(dir, 'native-state');
  iso.env.PI_LOOP_SCOPE = 'memory';
  iso.env.MSTACK_PLAN = join(dir, 'plan.json');
  const output = join(dir, 'child.md');
  const client = rpc({ dir, ...iso });
  t.after(async () => {
    writeFileSync(join(dir, 'native-evidence.json'), JSON.stringify({ records: client.records, requests: captures(iso.env) }, null, 2));
    await client.stop();
    assertExited(client.child.pid);
    for (const pid of new Set(captures(iso.env).map(c => c.pid))) assertExited(pid);
    if (!process.env.MSTACK_KEEP_TEST_ARTIFACTS) rmSync(artifact.dir, { recursive: true, force: true }); });
  await client.send('get_commands');
  await enableIfNeeded(client, iso.env);
  writeFileSync(iso.env.MSTACK_PLAN, JSON.stringify([{ name: 'subagent', arguments: { action: 'list', options: { capabilities: true } } }]));
  await client.turn('EXECUTE_TEST_PLAN discover');
  const discovery = client.records.filter(e => e.type === 'tool_execution_end').at(-1);
  assert.equal(discovery.isError, false, JSON.stringify(discovery));
  assert.match(JSON.stringify(discovery), /poteto-agent/);
  assert.match(JSON.stringify(discovery), /comment-sicko/);
  assert.match(JSON.stringify(discovery), /pi-mstack@0\.1\.0/);
  writeFileSync(iso.env.MSTACK_PLAN, JSON.stringify([
    { name: 'subagent', arguments: { agent: 'comment-sicko', task: `NATIVE_CHILD. Skill path ${join(artifact.packageRoot, 'generated/skills/no-comments/SKILL.md')}`, async: true, model: 'mstack-test/script/model:off', output, options: { timeoutMs: 15000, acceptance: { level: 'none', reason: 'scripted API contract test, not prose compliance' } } } },
    { name: 'MonitorCreate', arguments: { command: 'sleep 0.3; printf monitor-retained-output', onDone: 'MONITOR_PROVIDER_WAKE' } },
  ]));
  const isMonitor = e => e.type === 'message_end' && e.message?.role === 'custom' && e.message.customType === 'pi-loop' && e.message.details?.trigger?.source === 'monitor:done';
  const isCompletion = e => e.type === 'message_end' && e.message?.role === 'custom' && e.message.customType === 'subagent-notify';
  const finalSettlement = client.wait(e => e.type === 'agent_settled' && client.records.some(isMonitor) && client.records.some(isCompletion), 30000);
  await client.turn('EXECUTE_TEST_PLAN launch');
  await finalSettlement;
  const launch = client.records.filter(e => e.type === 'tool_execution_end' && e.toolName === 'subagent').at(-1);
  assert.equal(launch?.isError, false, JSON.stringify(launch));
  const runId = launch.result?.details?.runId;
  assert.ok(runId, JSON.stringify(launch));
  const completion = client.records.find(isCompletion);
  assert.equal(completion.message.details.runs.find(run => run.runId === runId)?.status, 'completed');
  assert.ok(completion.message.content.includes(output));
  assert.match(JSON.stringify(completion.message), /native-child-retained/);
  const wake = client.records.find(isMonitor);
  assert.match(JSON.stringify(wake.message), /MONITOR_PROVIDER_WAKE/);
  assert.equal(readFileSync(output, 'utf8').trim(), 'native-child-retained');
  const childRequest = captures(iso.env).find(c => c.messages.at(-1)?.role === 'user' && JSON.stringify(c.messages.at(-1)).includes('NATIVE_CHILD'));
  assert.equal(childRequest?.model, 'script/model', 'explicit resolved parent defeats the conflicting agent model override');
  assert.notEqual(childRequest?.pid, client.child.pid);
  for (const token of ['MONITOR_PROVIDER_WAKE', runId]) {
    const request = captures(iso.env).find(c => c.pid === client.child.pid && c.messages.at(-1)?.role === 'user' && JSON.stringify(c.messages.at(-1)).includes(token));
    assert.ok(request, `parent provider received final wake ${token}`);
    assert.match(request.system, /<pi-mstack-role-data>/, `role data on native wake ${token}`);
    assert.doesNotMatch(request.system, /<pi-mstack-mode>/, `mode stays off on native wake ${token}`);
  }
  assert.ok(client.records.some(e => e.type === 'tool_execution_end' && e.toolName === 'MonitorCreate' && !e.isError));
  process.stdout.write(`Native evidence ${dir}\n`);
});

test('native preflight rejects global scope, strict inheritance, per-agent restriction and thinking ceiling', { timeout: 60000 }, async t => {
  const artifact = packed(); t.after(() => rmSync(artifact.dir, { recursive: true, force: true }));
  const cases = [
    { name: 'scope', config: { modelScope: { enforce: true, allow: ['mstack-test/other'] } }, model: 'mstack-test/script/model:off', pattern: /scope|allowed/i },
    { name: 'strict', config: { modelScope: { enforce: true, strict: true, allow: ['mstack-test/other'] } }, pattern: /scope|allowed/i },
    { name: 'per-agent', config: { modelScope: { enforce: true, allow: ['mstack-test/*'], agents: { 'comment-sicko': { allow: ['mstack-test/other'] } } } }, model: 'mstack-test/script/model:off', pattern: /scope|allowed/i },
    { name: 'thinking', config: { maxThinking: 'off' }, model: 'mstack-test/script/model:high', pattern: /thinking|ceiling/i },
  ];
  for (const item of cases) {
    const dir = join(artifact.dir, item.name); mkdirSync(dir);
    const iso = isolated(dir, artifact.packageRoot, { packages: [artifact.packageRoot, sub], subagents: item.config });
    iso.env.PI_SUBAGENTS_TEMP_ROOT = join(dir, 'native-state');
    iso.env.MSTACK_PLAN = join(dir, 'plan.json');
    const client = rpc({ dir, ...iso });
    try {
      await client.send('get_commands');
      await enableIfNeeded(client, iso.env);
      writeFileSync(iso.env.MSTACK_PLAN, JSON.stringify([{ name: 'subagent', arguments: { agent: 'comment-sicko', task: 'NATIVE_CHILD rejected', async: false, ...(item.model ? { model: item.model } : {}) } }]));
      await client.turn('EXECUTE_TEST_PLAN reject');
      const result = client.records.filter(e => e.type === 'tool_execution_end' && e.toolName === 'subagent').at(-1);
      assert.equal(result?.isError, true, JSON.stringify(result));
      assert.match(JSON.stringify(result), item.pattern);
      assert.ok(!captures(iso.env).some(c => JSON.stringify(c.messages.at(-1)).includes('NATIVE_CHILD rejected') && c.messages.at(-1)?.role === 'user'));
    } finally { await client.stop(); assertExited(client.child.pid); }
  }
});
