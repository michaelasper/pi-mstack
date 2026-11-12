import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { packed, isolated, captures, rpc } from './helpers.mjs';

const artifact = packed();
if (process.env.MSTACK_KEEP_TEST_ARTIFACTS) process.stdout.write(`Runtime regression evidence ${artifact.dir}\n`);
after(() => { if (!process.env.MSTACK_KEEP_TEST_ARTIFACTS) rmSync(artifact.dir, { recursive: true, force: true }); });

async function start(t, name, settings = {}) {
  const dir = join(artifact.dir, name); mkdirSync(dir);
  const iso = isolated(dir, artifact.packageRoot, settings);
  return { dir, iso, connect() {
    const client = rpc({ dir, ...iso });
    t.after(async () => {
      await client.stop();
      writeFileSync(join(dir, 'runtime-evidence.json'), JSON.stringify({ records: client.records, requests: captures(iso.env), stderr: client.stderr() }, null, 2));
    });
    return client;
  } };
}
const modeEntries = async client => (await client.send('get_entries')).entries.filter(e => e.customType === 'pi-mstack/mode');

test('literal extension user messages reach the provider without changing mode', { timeout: 30000 }, async t => {
  const run = await start(t, 'literal');
  run.iso.args.push('-e', join(artifact.packageRoot, 'tests/fixtures/runtime-literal-message.ts'));
  const client = run.connect();
  await client.send('prompt', { message: '/poteto-mode' });
  const before = await modeEntries(client);
  const settled = client.wait(e => e.type === 'agent_settled');
  await client.send('prompt', { message: '/runtime-literal-message' });
  await settled;
  const request = captures(run.iso.env).at(-1);
  assert.match(request.system, /<pi-mstack-mode>/);
  assert.deepEqual(request.messages.at(-1).content, [{ type: 'text', text: '/skill:poteto-mode off' }]);
  assert.deepEqual(await modeEntries(client), before);
});

test('near-match commands stay literal and do not activate mode', { timeout: 30000 }, async t => {
  const run = await start(t, 'grammar');
  const client = run.connect();
  for (const text of ['/skill:poteto-mode-other TASK', '/poteto-mode-other TASK', '/potete-mode-extra\nTASK']) {
    await client.turn(text);
    const request = captures(run.iso.env).at(-1);
    assert.doesNotMatch(request.system, /<pi-mstack-mode>/);
    assert.deepEqual(request.messages.at(-1).content, [{ type: 'text', text }]);
    assert.deepEqual(await modeEntries(client), []);
  }
  await client.turn('/skill:poteto-mode ASCII_TASK');
  assert.match(captures(run.iso.env).at(-1).system, /<pi-mstack-mode>/);
  assert.match(JSON.stringify(captures(run.iso.env).at(-1).messages), /<skill name=\\"poteto-mode/);
});

test('busy mode requests refuse without persisting or queuing their tasks', { timeout: 30000 }, async t => {
  const run = await start(t, 'busy');
  const client = run.connect();
  await client.send('prompt', { message: '/poteto-mode' });
  const before = await modeEntries(client);
  const settled = client.wait(e => e.type === 'agent_settled');
  await client.send('prompt', { message: 'BUSY_ON' });
  const startIndex = client.records.length;
  for (const message of ['/skill:poteto-mode off', '/poteto-mode off', '/skill:poteto-mode REFUSED_TASK', '/poteto-mode \nREFUSED_TASK', '/potete-mode\nREFUSED_TASK', '/pstack default on']) {
    const response = await client.send('prompt', { message, streamingBehavior: 'followUp' });
    assert.equal(response.disposition, 'handled');
  }
  await client.send('prompt', { message: 'AFTER_REFUSAL', streamingBehavior: 'followUp' });
  await settled;
  assert.deepEqual(await modeEntries(client), before);
  assert.equal(existsSync(join(run.iso.agentDir, 'pstack/models.json')), false);
  const notices = client.records.slice(startIndex).filter(e => e.method === 'notify').map(e => e.message);
  assert.equal(notices.filter(text => /request refused while the agent is busy/.test(text)).length, 6);
  assert.ok(!notices.some(text => /Mode disabled/.test(text)));
  const requests = captures(run.iso.env);
  assert.equal(requests.length, 2);
  for (const request of requests) {
    assert.match(request.system, /<pi-mstack-mode>/);
    assert.doesNotMatch(JSON.stringify(request.messages), /REFUSED_TASK/);
  }
  assert.match(JSON.stringify(requests.at(-1).messages), /AFTER_REFUSAL/);
  await client.send('prompt', { message: '/skill:poteto-mode off' });
  await client.turn('AFTER_IDLE_OFF');
  assert.doesNotMatch(captures(run.iso.env).at(-1).system, /<pi-mstack-mode>/);
  assert.equal((await modeEntries(client)).at(-1).data.enabled, false);
  const offEntries = await modeEntries(client);
  const offSettled = client.wait(e => e.type === 'agent_settled');
  await client.send('prompt', { message: 'BUSY_OFF' });
  await client.send('prompt', { message: '/poteto-mode', streamingBehavior: 'followUp' });
  await client.send('prompt', { message: '/skill:poteto-mode REFUSED_ENABLE_TASK', streamingBehavior: 'followUp' });
  await client.send('prompt', { message: 'STILL_OFF', streamingBehavior: 'followUp' });
  await offSettled;
  assert.deepEqual(await modeEntries(client), offEntries);
  const stillOff = captures(run.iso.env).at(-1);
  assert.doesNotMatch(stillOff.system, /<pi-mstack-mode>/);
  assert.doesNotMatch(JSON.stringify(stillOff.messages), /REFUSED_ENABLE_TASK/);
  assert.match(JSON.stringify(stillOff.messages), /STILL_OFF/);
});

test('merged settings are observations when trusted project scope replaces user policy', { timeout: 60000 }, async t => {
  const run = await start(t, 'policy', {
    packages: [artifact.packageRoot, resolve('node_modules/pi-subagents')],
    defaultProjectTrust: 'always',
    subagents: {
      defaultExtensions: [join(artifact.packageRoot, 'tests/fixtures/provider.ts')],
      modelScope: { enforce: true, strict: true, allow: ['mstack-test/other'], agents: { 'comment-sicko': { allow: ['mstack-test/other'] } } },
      orcaProgressTabs: { enabled: false },
    },
  });
  run.iso.env.HOME = join(artifact.dir, 'policy-home'); mkdirSync(run.iso.env.HOME);
  run.iso.env.PI_SUBAGENTS_TEMP_ROOT = join(run.dir, 'native-state');
  run.iso.env.MSTACK_PLAN = join(run.dir, 'plan.json');
  mkdirSync(join(run.dir, '.pi'));
  writeFileSync(join(run.dir, '.pi/settings.json'), JSON.stringify({ subagents: { modelScope: { enforce: true, allow: ['mstack-test/script/model'] } } }));
  const client = run.connect();
  await client.send('prompt', { message: '/pstack doctor' });
  const doctor = client.records.filter(e => e.method === 'notify').at(-1).message;
  assert.match(doctor, /Project trusted: true/);
  assert.match(doctor, /Public merged settings observations only; native precedence unverified/);
  assert.match(doctor, /"strict":true/);
  assert.match(doctor, /comment-sicko/);
  assert.doesNotMatch(doctor, /Strict inheritance enabled|Native model scope enforcement|Per-agent policy restrictions/);
  assert.match(doctor, /subagent: present/);
  writeFileSync(run.iso.env.MSTACK_PLAN, JSON.stringify([{ name: 'subagent', arguments: {
    agent: 'comment-sicko', task: 'NATIVE_CHILD project-replaces-user', async: false, model: 'mstack-test/script/model:off',
    options: { timeoutMs: 10000, acceptance: { level: 'none', reason: 'scripted native precedence regression' } },
  } }]));
  await client.turn('EXECUTE_TEST_PLAN launch');
  const result = client.records.filter(e => e.type === 'tool_execution_end' && e.toolName === 'subagent').at(-1);
  assert.equal(result?.isError, false, JSON.stringify(result));
  assert.match(JSON.stringify(result), /native-child-retained/);
  const request = captures(run.iso.env).find(c => c.messages.at(-1)?.role === 'user' && JSON.stringify(c.messages.at(-1)).includes('NATIVE_CHILD project-replaces-user'));
  assert.equal(request?.model, 'script/model');
});
