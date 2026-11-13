import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createAgentSessionFromServices, createAgentSessionServices, ModelRuntime, SessionManager, SettingsManager } from '@earendil-works/pi-coding-agent';
import { packed, isolated, captures, rpc } from './helpers.mjs';

const keep = !!process.env.MSTACK_KEEP_TEST_ARTIFACTS;
const high = JSON.stringify({ input: 170000 });
const low = JSON.stringify({ input: 1000 });

function start(t, { flags = ['--pstack-idle-compact'], args = [], cancel = false, settings = {}, retry = false } = {}) {
  const artifact = packed();
  const dir = join(artifact.dir, 'case'); mkdirSync(dir);
  const iso = isolated(dir, artifact.packageRoot, { compaction: { enabled: false, reserveTokens: 0, keepRecentTokens: 0 }, ...settings });
  iso.env.MSTACK_USAGE = join(dir, 'usage.json');
  iso.env.MSTACK_FINISH = join(dir, 'finishes.jsonl');
  writeFileSync(iso.env.MSTACK_USAGE, low);
  if (retry) iso.env.MSTACK_FAIL_ONCE = join(dir, 'failed-once');
  if (cancel) {
    const path = join(dir, 'cancel-compaction.ts');
    writeFileSync(path, `export default pi => { pi.on('session_before_compact', () => ({ cancel: true })); }`);
    args = [...args, '-e', path];
  }
  iso.args.push(...flags, ...args);
  const client = rpc({ dir, ...iso });
  const usage = value => writeFileSync(iso.env.MSTACK_USAGE, value);
  const entries = async () => (await client.send('get_entries')).entries;
  const compactions = async () => (await entries()).filter(entry => entry.type === 'compaction');
  const finishes = () => existsSync(iso.env.MSTACK_FINISH) ? readFileSync(iso.env.MSTACK_FINISH, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse) : [];
  t.after(async () => {
    try {
      writeFileSync(join(dir, 'evidence.json'), JSON.stringify({ records: client.records, requests: captures(iso.env), entries: (await client.send('get_entries')).entries, finishes: finishes() }, null, 2));
    } finally {
      try { await client.stop(); }
      finally {
        if (keep) process.stdout.write(`Idle compaction RPC evidence ${artifact.dir}\n`);
        else rmSync(artifact.dir, { recursive: true, force: true });
      }
    }
  });
  return { client, iso, dir, usage, entries, compactions, finishes };
}

test('idle compaction stays off by default and never compacts at high usage', { timeout: 30000 }, async t => {
  const { client, iso, usage, compactions } = start(t, { flags: [] });
  await usage(high);
  await client.turn('HIGH_USAGE');
  assert.equal(captures(iso.env).length, 1);
  assert.equal((await compactions()).length, 0);
  assert.equal(client.records.some(record => record.type === 'compaction_start'), false);
});

test('idle compaction compacts once at the threshold, disarms, and rearms below the rearm threshold', { timeout: 40000 }, async t => {
  const { client, iso, usage, compactions, finishes } = start(t);
  await usage(high);
  await client.turn('HIGH_ONE');
  const first = await compactions();
  assert.equal(first.length, 1);
  assert.match(first[0].summary, /scripted-complete/);
  assert.deepEqual(client.records.filter(record => record.type.startsWith('compaction_')).map(record => record.type), ['compaction_start', 'compaction_end']);
  await usage(high);
  await client.turn('HIGH_TWO');
  assert.equal((await compactions()).length, 1, 'disarmed until usage rearms');
  await usage(low);
  await client.turn('LOW_ONE');
  assert.equal((await compactions()).length, 1);
  await usage(high);
  await client.turn('HIGH_THREE');
  assert.equal((await compactions()).length, 2, 'rearmed helper compacts again');
  assert.equal(finishes().filter(finish => finish.stopReason === 'aborted').length, 0);
  assert.equal(finishes().filter(finish => finish.summary).length >= 2, true);
  const users = (await client.send('get_entries')).entries.filter(entry => entry.message?.role === 'user').map(entry => entry.message.content.map(block => block.text).join(''));
  assert.deepEqual(users, ['HIGH_ONE', 'HIGH_TWO', 'LOW_ONE', 'HIGH_THREE']);
});

test('idle compaction honors native cancellation and does not retry while usage stays high', { timeout: 40000 }, async t => {
  const { client, iso, usage, compactions, finishes } = start(t, { cancel: true });
  await usage(high);
  await client.turn('HIGH_ONE');
  assert.equal((await compactions()).length, 0);
  assert.equal(client.records.filter(record => record.type === 'compaction_start').length, 1);
  const end = client.records.find(record => record.type === 'compaction_end');
  assert.equal(end.aborted, true);
  await usage(high);
  await client.turn('HIGH_TWO');
  assert.equal(client.records.filter(record => record.type === 'compaction_start').length, 1, 'cancelled attempt disarms');
  assert.equal((await compactions()).length, 0);
  assert.equal(finishes().filter(finish => finish.stopReason === 'aborted').length, 0);
  assert.equal(finishes().filter(finish => finish.summary).length, 0, 'cancelled compaction never summarizes');
  assert.equal(captures(iso.env).length, 2, 'turns only, no summary request after cancellation');
});

test('held idle compaction defers queued prompts, then the deferred turn runs without aborted provider work', { timeout: 40000 }, async t => {
  const artifact = packed();
  const dir = join(artifact.dir, 'sdk'); mkdirSync(dir);
  const iso = isolated(dir, artifact.packageRoot, { compaction: { enabled: false, reserveTokens: 0, keepRecentTokens: 0 } });
  const barrier = join(dir, 'release-summary');
  iso.env.MSTACK_USAGE = join(dir, 'usage.json');
  iso.env.MSTACK_FINISH = join(dir, 'finishes.jsonl');
  iso.env.MSTACK_HOLD_SUMMARY = barrier;
  writeFileSync(iso.env.MSTACK_USAGE, high);
  const prior = { ...process.env };
  for (const key of Object.keys(process.env)) delete process.env[key];
  Object.assign(process.env, iso.env);
  t.after(() => { for (const key of Object.keys(process.env)) delete process.env[key]; Object.assign(process.env, prior); });
  const settingsManager = SettingsManager.create(dir, iso.agentDir);
  const modelRuntime = await ModelRuntime.create({ authPath: join(iso.agentDir, 'auth.json'), modelsPath: join(iso.agentDir, 'models.json'), refreshOnCreate: false, allowModelNetwork: false });
  const services = await createAgentSessionServices({
    cwd: dir,
    agentDir: iso.agentDir,
    settingsManager,
    modelRuntime,
    extensionFlagValues: new Map([['pstack-idle-compact', true]]),
    resourceLoaderOptions: { noContextFiles: true, noThemes: true, noPromptTemplates: true, additionalExtensionPaths: [join(artifact.packageRoot, 'tests/fixtures/provider.ts')] },
  });
  const manager = SessionManager.create(dir, join(iso.agentDir, 'sessions'));
  const { session } = await createAgentSessionFromServices({ services, sessionManager: manager });
  const errors = [];
  await session.bindExtensions({ onError: error => errors.push(error) });
  await session.setModel(modelRuntime.getModel('mstack-test', 'script/model'));
  session.setThinkingLevel('off');
  const finishes = () => existsSync(iso.env.MSTACK_FINISH) ? readFileSync(iso.env.MSTACK_FINISH, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse) : [];
  t.after(() => {
    writeFileSync(join(dir, 'evidence.json'), JSON.stringify({ entries: manager.getEntries(), requests: captures(iso.env), finishes: finishes(), errors }, null, 2));
    session.dispose();
    if (keep) process.stdout.write(`Idle compaction SDK evidence ${dir}\n`);
    else rmSync(artifact.dir, { recursive: true, force: true });
  });
  let settled = 0;
  const secondSettlement = new Promise(resolve => {
    const unsubscribe = session.subscribe(event => {
      if (event.type !== 'agent_settled') return;
      settled += 1;
      if (settled === 2) { unsubscribe(); resolve(); }
    });
  });
  const firstTurn = session.prompt('HIGH_HELD');
  const started = barrier + '.started';
  for (let attempt = 0; attempt < 400 && !existsSync(started); attempt += 1) await new Promise(resolve => setTimeout(resolve, 25));
  assert.equal(existsSync(started), true, 'summary request started while settled dispatch was held');
  await session.prompt('DEFERRED_TASK');
  assert.equal(manager.getEntries().filter(entry => entry.message?.role === 'user').length, 1, 'deferred prompt waits for the held compaction');
  writeFileSync(barrier, 'release');
  await firstTurn;
  await secondSettlement;
  const compactions = manager.getEntries().filter(entry => entry.type === 'compaction');
  assert.equal(compactions.length, 1);
  const users = manager.getEntries().filter(entry => entry.message?.role === 'user').map(entry => entry.message.content.map(block => block.text).join(''));
  assert.deepEqual(users, ['HIGH_HELD', 'DEFERRED_TASK']);
  const recorded = finishes();
  assert.equal(recorded.filter(finish => finish.stopReason === 'aborted').length, 0);
  assert.equal(recorded.length, 3, 'turn, summary, and deferred turn each finish once');
  assert.equal(recorded.filter(finish => finish.summary).length, 1);
  assert.match(JSON.stringify(captures(iso.env).at(-1).messages), /DEFERRED_TASK/);
  assert.equal(manager.getEntries().filter(entry => entry.type === 'custom_message').length, 0);
  assert.deepEqual(errors, []);
});

test('pre-dispatch and provider-started aborted settlements never start idle compaction', { timeout: 40000 }, async t => {
  const artifact = packed();
  const dir = join(artifact.dir, 'sdk'); mkdirSync(dir);
  const iso = isolated(dir, artifact.packageRoot, { compaction: { enabled: false, reserveTokens: 0, keepRecentTokens: 0 } });
  iso.env.MSTACK_USAGE = join(dir, 'usage.json');
  iso.env.MSTACK_FINISH = join(dir, 'finishes.jsonl');
  writeFileSync(iso.env.MSTACK_USAGE, high);
  const prior = { ...process.env };
  for (const key of Object.keys(process.env)) delete process.env[key];
  Object.assign(process.env, iso.env);
  t.after(() => { for (const key of Object.keys(process.env)) delete process.env[key]; Object.assign(process.env, prior); });
  const settingsManager = SettingsManager.create(dir, iso.agentDir);
  const modelRuntime = await ModelRuntime.create({ authPath: join(iso.agentDir, 'auth.json'), modelsPath: join(iso.agentDir, 'models.json'), refreshOnCreate: false, allowModelNetwork: false });
  const services = await createAgentSessionServices({
    cwd: dir,
    agentDir: iso.agentDir,
    settingsManager,
    modelRuntime,
    extensionFlagValues: new Map([['pstack-idle-compact', true]]),
    resourceLoaderOptions: { noContextFiles: true, noThemes: true, noPromptTemplates: true, additionalExtensionPaths: [join(artifact.packageRoot, 'tests/fixtures/provider.ts')] },
  });
  const manager = SessionManager.create(dir, join(iso.agentDir, 'sessions'));
  const { session } = await createAgentSessionFromServices({ services, sessionManager: manager });
  const errors = [];
  await session.bindExtensions({ onError: error => errors.push(error) });
  await session.setModel(modelRuntime.getModel('mstack-test', 'script/model'));
  session.setThinkingLevel('off');
  t.after(() => {
    writeFileSync(join(dir, 'evidence.json'), JSON.stringify({ entries: manager.getEntries(), requests: captures(iso.env), settled, finishes: existsSync(iso.env.MSTACK_FINISH) ? readFileSync(iso.env.MSTACK_FINISH, 'utf8').trim().split('\n').map(JSON.parse) : [], errors }, null, 2));
    session.dispose();
    if (keep) process.stdout.write(`Idle compaction abort evidence ${dir}\n`);
    else rmSync(artifact.dir, { recursive: true, force: true });
  });
  const settled = [];
  session.subscribe(event => { if (event.type === 'agent_settled') settled.push(event.aborted); });
  const started = new Promise(resolve => { const off = session.subscribe(event => { if (event.type === 'agent_start') { off(); resolve(); } }); });
  const turn = session.prompt('ABORTED_WORK');
  await started;
  await session.abort();
  await turn;
  assert.deepEqual(settled, [true]);
  assert.equal(captures(iso.env).length, 0, 'pre-dispatch abort makes no provider request');
  await session.prompt('/test-provider-hold');
  const active = session.prompt('ABORT_PROVIDER_STARTED_WORK');
  for (let attempt = 0; attempt < 400 && captures(iso.env).length === 0; attempt += 1) await new Promise(resolve => setTimeout(resolve, 25));
  assert.equal(captures(iso.env).length, 1, 'provider has started and is held');
  await session.abort();
  await active;
  assert.deepEqual(settled, [true, true]);
  const finishes = readFileSync(iso.env.MSTACK_FINISH, 'utf8').trim().split('\n').map(JSON.parse);
  assert.deepEqual(finishes.map(finish => finish.stopReason), ['aborted']);
  assert.equal(captures(iso.env).length, 1, 'abort causes no summary or resumed request');
  assert.equal(manager.getEntries().filter(entry => entry.type === 'compaction').length, 0);
  assert.equal(captures(iso.env).filter(capture => JSON.stringify(capture.system).includes('context summarization assistant')).length, 0);
  assert.deepEqual(errors, []);
});

test('native retry backoff admits no idle helper compaction before the successful final settlement', { timeout: 30000 }, async t => {
  const { client, iso, usage, compactions, finishes } = start(t, { retry: true, settings: { retry: { enabled: true, maxRetries: 1, baseDelayMs: 1000 } } });
  await usage(high);
  const retryStarted = client.wait(event => event.type === 'auto_retry_start');
  const settled = client.wait(event => event.type === 'agent_settled');
  await client.send('prompt', { message: 'RETRY_HIGH_USAGE' });
  await retryStarted;
  assert.equal((await compactions()).length, 0);
  assert.equal(captures(iso.env).length, 1);
  assert.equal(client.records.some(event => event.type === 'agent_settled' || event.type === 'compaction_start'), false);
  await usage(low);
  await settled;
  assert.equal((await compactions()).length, 0);
  assert.equal(captures(iso.env).length, 2);
  assert.deepEqual(finishes().map(finish => finish.stopReason), ['error', 'stop']);
  assert.equal(finishes().some(finish => finish.summary), false);
  assert.equal(client.records.filter(event => event.type === 'agent_settled').length, 1);
  assert.ok(client.records.some(event => event.type === 'auto_retry_end' && event.success));
});
