import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, rmSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { packed, isolated, captures, rpc } from './helpers.mjs';

const tool = 'mstack_set_session_title';
const version = 'pi-mstack/environment/1';
const call = title => ({ name: tool, arguments: { title } });
const declared = request => request.providerTools.some(t => t.name === tool);

async function fixture(t, { child = false, early = false, retry = false, trusted = false, overflow = false } = {}) {
  const artifact = packed();
  const dir = join(artifact.dir, 'model-title'); mkdirSync(dir);
  const iso = isolated(dir, artifact.packageRoot, { defaultProjectTrust: trusted ? 'always' : 'never', compaction: { enabled: overflow, keepRecentTokens: 1 }, retry: { enabled: retry, maxRetries: 1, baseDelayMs: 1 } });
  mkdirSync(join(iso.agentDir, 'pstack'));
  const policy = naming => writeFileSync(join(iso.agentDir, 'pstack/environment.json'), JSON.stringify({ version, naming }));
  policy('model');
  iso.env.MSTACK_PLAN = join(dir, 'plan.json');
  if (trusted) iso.args.push('--approve');
  if (child) iso.env.PI_SUBAGENT_CHILD = '1';
  if (retry || overflow) iso.env.MSTACK_FAIL_ONCE = join(dir, 'failed-once');
  if (overflow) {
    iso.env.MSTACK_FAIL_ONCE_ERROR = 'prompt is too long: 300000 tokens > 200000 maximum';
    writeFileSync(iso.env.MSTACK_FAIL_ONCE, 'seed conversation first');
  }
  if (early) {
    const path = join(dir, 'early.ts');
    writeFileSync(path, `export default pi => { pi.on('input', event => event.text.startsWith('RAW-11') ? { action: 'transform', text: 'TRANSFORMED-22 EXECUTE_TEST_PLAN repair parser now' } : undefined); }`);
    iso.args.push('-e', path);
  }
  iso.args.push('-e', join(artifact.packageRoot, 'tests/fixtures/model-naming-controls.ts'));
  const workspace = join(dir, 'workspace'); mkdirSync(workspace);
  const client = rpc({ dir: workspace, ...iso });
  const plan = calls => writeFileSync(iso.env.MSTACK_PLAN, JSON.stringify(calls));
  plan([call('Repair parser error recovery')]);
  const entries = async () => (await client.send('get_entries')).entries;
  const name = async () => (await client.send('get_state')).sessionName;
  const seals = async () => (await entries()).filter(e => e.customType === 'pi-mstack/naming-attempt');
  t.after(async () => {
    try { writeFileSync(join(dir, 'evidence.json'), JSON.stringify({ records: client.records, requests: captures(iso.env), stderr: client.stderr() }, null, 2)); }
    finally {
      await client.stop();
      if (process.env.MSTACK_KEEP_TEST_ARTIFACTS) process.stdout.write(`Model naming evidence ${artifact.dir}\n`);
      else rmSync(artifact.dir, { recursive: true, force: true });
    }
  });
  return { ...iso, dir: workspace, client, policy, plan, entries, name, seals, requests: () => captures(iso.env) };
}

test('packed model title declares actual provider tool, preserves ticket, seals once and continues ordinary work', { timeout: 60000 }, async t => {
  const f = await fixture(t);
  await f.client.send('prompt', { message: '/goal GOAL-7 no naming inference' });
  assert.equal(f.requests().length, 0); assert.equal(await f.name(), undefined);
  f.plan([call('Repair parser error recovery'), call('Overwrite the previous title')]);
  await f.client.turn('ABC-123 EXECUTE_TEST_PLAN repair parser');
  assert.equal(await f.name(), 'ABC-123 Repair parser error recovery');
  assert.equal((await f.seals()).length, 1);
  assert.equal(f.requests().length, 2, 'one task request and one ordinary tool continuation');
  assert.equal(declared(f.requests()[0]), true);
  assert.equal(declared(f.requests()[1]), false);
  assert.match(f.requests()[0].system, /Call mstack_set_session_title once after the task is clear/);
  const results = (await f.entries()).filter(e => e.message?.role === 'toolResult');
  assert.equal(results.length, 2); assert.equal(results[1].message.isError, true);
  assert.ok(results.every(e => e.message.toolName === tool), 'no tracker calls');
  const originalFile = (await f.client.send('get_state')).sessionFile;
  const user = (await f.entries()).find(e => e.message?.role === 'user');
  await f.client.send('prompt', { message: '/test-title-tree ' + user.id });
  await f.client.turn('EXECUTE_TEST_PLAN do not rename');
  assert.equal(declared(f.requests().at(-1)), false); assert.equal((await f.seals()).length, 1);
  await f.client.send('prompt', { message: '/test-title-reload' });
  await f.client.turn('EXECUTE_TEST_PLAN after reload');
  assert.equal((await f.seals()).length, 1);
  await f.client.send('compact');
  await f.client.turn('EXECUTE_TEST_PLAN after compaction');
  assert.equal((await f.seals()).length, 1);
  await f.client.send('new_session');
  await f.client.send('switch_session', { sessionPath: originalFile });
  await f.client.turn('EXECUTE_TEST_PLAN after resume');
  assert.equal(await f.name(), 'ABC-123 Repair parser error recovery');
  assert.equal(declared(f.requests().at(-1)), false);
});

test('packed model title repairs invalid calls without consuming the attempt', { timeout: 60000 }, async t => {
  const f = await fixture(t);
  for (const title of ['', 'Two words', 'one two three four five six seven eight nine', 'Fix\nparser error', 'Fix\u200b parser error', 'Invent XYZ-999 issue title', 'a'.repeat(78) + ' b c']) {
    await f.client.send('new_session');
    f.plan([call(title)]); await f.client.turn('ABC-123 EXECUTE_TEST_PLAN repair task');
    assert.equal(await f.name(), undefined, JSON.stringify(title)); assert.equal((await f.seals()).length, 0);
    f.plan([call(title), { name: tool, arguments: {} }, call('Repair parser error recovery')]);
    await f.client.turn('ABC-123 EXECUTE_TEST_PLAN repair task');
    assert.equal(await f.name(), 'ABC-123 Repair parser error recovery'); assert.equal((await f.seals()).length, 1);
  }
  await f.client.send('new_session');
  f.plan([call('Compare parser error handling')]);
  await f.client.turn('ABC-123 XYZ-9 EXECUTE_TEST_PLAN compare tasks');
  assert.equal(await f.name(), 'Compare parser error handling');
  await f.client.send('new_session');
  f.plan([call('🙂'.repeat(76) + ' a b')]);
  await f.client.turn('EXECUTE_TEST_PLAN unicode title');
  assert.equal([...(await f.name())].length, 80);
});

test('packed model title refuses forced activation, history and execution races', { timeout: 60000 }, async t => {
  const f = await fixture(t);
  await f.client.send('prompt', { message: '/test-title-force' });
  await f.client.turn('/unknown EXECUTE_TEST_PLAN no accepted task');
  assert.equal(await f.name(), undefined); assert.equal((await f.seals()).length, 0);
  for (const command of ['/test-title-clear', '/test-title-seal']) {
    await f.client.send('new_session'); await f.client.send('prompt', { message: command });
    await f.client.turn('EXECUTE_TEST_PLAN never rename history');
    assert.equal(await f.name(), undefined); assert.equal(declared(f.requests().at(-1)), false);
  }
  for (const race of ['rename', 'policy', 'cancel']) {
    await f.client.send('new_session'); f.policy('model');
    await f.client.send('prompt', { message: '/test-title-race ' + race });
    await f.client.turn('EXECUTE_TEST_PLAN race title write');
    assert.equal(await f.name(), race === 'rename' ? 'Manual title' : undefined);
    assert.equal((await f.seals()).length, 0);
  }
  f.policy('model'); await f.client.send('new_session');
  f.plan([]); await f.client.turn('EXECUTE_TEST_PLAN clarification only');
  await f.client.send('prompt', { message: '/test-title-force' });
  await f.client.send('prompt', { message: '/test-title-reload' });
  f.plan([call('Repair parser error recovery')]);
  await f.client.turn('/unknown EXECUTE_TEST_PLAN stale invitation');
  assert.equal(await f.name(), undefined); assert.equal(declared(f.requests().at(-1)), false);
});

test('packed model policy stays user-only and accepted-input-only', { timeout: 60000 }, async t => {
  const f = await fixture(t, { trusted: true });
  for (const policy of [undefined, 'off', 'invalid']) {
    await f.client.send('new_session'); f.policy(policy);
    await f.client.turn('EXECUTE_TEST_PLAN rejected model policy');
    assert.equal(declared(f.requests().at(-1)), false);
    assert.equal(await f.name(), policy === undefined ? 'EXECUTE_TEST_PLAN rejected model policy' : undefined);
  }
  await f.client.send('new_session'); f.policy('model');
  await f.client.send('prompt', { message: 'CONSUME_TITLE EXECUTE_TEST_PLAN' });
  assert.equal(await f.name(), undefined);
  await f.client.turn('REPLACE_TITLE EXECUTE_TEST_PLAN');
  assert.equal(await f.name(), 'Repair parser error recovery', 'CLI extension transforms before package input capture');
  await f.client.send('new_session');
  mkdirSync(join(f.dir, '.pi/pstack'), { recursive: true });
  writeFileSync(join(f.dir, '.pi/pstack/environment.json'), JSON.stringify({ version, naming: 'model' }));
  writeFileSync(join(f.agentDir, 'pstack/environment-grants.json'), JSON.stringify({ version: 'pi-mstack/environment-grants/1', projects: [realpathSync(f.dir)] }));
  writeFileSync(join(f.agentDir, 'settings.json'), JSON.stringify({ ...f.settings, defaultProjectTrust: 'always' }));
  await f.client.send('prompt', { message: '/test-title-reload' });
  await f.client.turn('EXECUTE_TEST_PLAN project naming forbidden');
  assert.equal(await f.name(), undefined); assert.equal(declared(f.requests().at(-1)), false);
});

test('packed child suppresses naming and earlier transforms define ticket provenance', { timeout: 60000 }, async t => {
  for (const options of [{ child: true }, { early: true }]) {
    const f = await fixture(t, options);
    await f.client.turn('RAW-11 EXECUTE_TEST_PLAN repair parser');
    assert.equal(await f.name(), options.child ? undefined : 'TRANSFORMED-22 Repair parser error recovery');
    assert.equal(declared(f.requests()[0]), !options.child);
  }
});

test('packed retry keeps invitation until settled and forks follow copied history', { timeout: 60000 }, async t => {
  const f = await fixture(t, { retry: true });
  await f.client.turn('ABC-123 EXECUTE_TEST_PLAN recover rate limit');
  assert.equal(await f.name(), 'ABC-123 Repair parser error recovery');
  assert.equal((await f.seals()).length, 1);
  assert.equal(f.requests().length, 3, 'failed request, retry and ordinary continuation');
  assert.equal(declared(f.requests()[0]), true); assert.equal(declared(f.requests()[1]), true);
  assert.ok(f.client.records.some(e => e.type === 'auto_retry_start'));
  const entries = await f.entries();
  const user = entries.find(e => e.message?.role === 'user');
  const last = entries.at(-1);
  await f.client.send('clone', { entryId: last.id });
  await f.client.turn('EXECUTE_TEST_PLAN clone after seal');
  assert.equal((await f.seals()).length, 1); assert.equal(declared(f.requests().at(-1)), false);
  await f.client.send('fork', { entryId: user.id });
  await f.client.turn('FORK-9 EXECUTE_TEST_PLAN fork before seal');
  assert.equal(await f.name(), 'FORK-9 Repair parser error recovery');
  assert.equal((await f.seals()).length, 1);
});

test('packed overflow compaction retry preserves an eligible model offer', { timeout: 60000 }, async t => {
  const f = await fixture(t, { overflow: true });
  f.plan([]); await f.client.turn('Establish parser task context');
  rmSync(f.env.MSTACK_FAIL_ONCE);
  f.plan([call('Repair parser error recovery')]);
  await f.client.turn('ABC-123 EXECUTE_TEST_PLAN recover context overflow');
  assert.equal(await f.name(), 'ABC-123 Repair parser error recovery');
  assert.equal((await f.seals()).length, 1);
  assert.equal(f.requests().length, 4, 'seed, overflow, retry and ordinary continuation without summary inference');
  assert.equal(declared(f.requests()[1]), true); assert.equal(declared(f.requests()[2]), true);
  assert.ok((await f.entries()).some(e => e.type === 'compaction'));
  assert.ok(f.client.records.some(e => e.type === 'compaction_end' && e.willRetry));
});
