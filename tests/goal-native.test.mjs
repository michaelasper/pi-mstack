import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { createAgentSession, DefaultResourceLoader, ModelRuntime, SettingsManager, SessionManager } from '@earendil-works/pi-coding-agent';
import { packed, isolated, captures, rpc } from './helpers.mjs';

const keep = !!process.env.MSTACK_KEEP_TEST_ARTIFACTS;
async function sdk(t, factories = []) {
  const artifact = packed(); const dir = join(artifact.dir, 'sdk-goal'); mkdirSync(dir);
  const iso = isolated(dir, artifact.packageRoot);
  const prior = { ...process.env }; for (const key of Object.keys(process.env)) delete process.env[key]; Object.assign(process.env, iso.env);
  t.after(() => { for (const key of Object.keys(process.env)) delete process.env[key]; Object.assign(process.env, prior); });
  const settingsManager = SettingsManager.create(dir, iso.agentDir);
  const modelRuntime = await ModelRuntime.create({ authPath: join(iso.agentDir, 'auth.json'), modelsPath: join(iso.agentDir, 'models.json'), refreshOnCreate: false, allowModelNetwork: false });
  const loader = new DefaultResourceLoader({ cwd: dir, agentDir: iso.agentDir, settingsManager, noContextFiles: true, noThemes: true, noPromptTemplates: true, additionalExtensionPaths: [join(artifact.packageRoot, 'tests/fixtures/provider.ts')], extensionFactories: factories });
  await loader.reload(); assert.deepEqual(loader.getExtensions().errors, []);
  const manager = SessionManager.create(dir, join(iso.agentDir, 'sessions'));
  const { session } = await createAgentSession({ cwd: dir, agentDir: iso.agentDir, resourceLoader: loader, modelRuntime, settingsManager, sessionManager: manager });
  const errors = []; await session.bindExtensions({ onError: error => errors.push(error) });
  await session.setModel(modelRuntime.getModel('mstack-test', 'script/model')); session.setThinkingLevel('off');
  t.after(() => {
    writeFileSync(join(dir, 'evidence.json'), JSON.stringify({ entries: manager.getEntries(), requests: captures(iso.env), errors }, null, 2));
    session.dispose(); assert.deepEqual(errors, []);
    if (keep) process.stdout.write(`Goal SDK evidence ${dir}\n`);
    else rmSync(artifact.dir, { recursive: true, force: true });
  });
  return { ...iso, dir, session, manager, modelRuntime };
}

test('packed SDK goals remain branch intent through navigation, compaction and reload without command inference', async t => {
  const { session, manager, env } = await sdk(t);
  await session.prompt('/goal ABC-123 fix the parser');
  assert.equal(captures(env).length, 0); assert.equal(manager.getSessionName(), 'ABC-123');
  assert.equal(existsSync(manager.getSessionFile()), false, 'native metadata-only session is not flushed');
  const first = manager.getLeafId();
  await session.prompt('/goal ABC-123 fix the parser');
  assert.equal(manager.getEntries().filter(e => e.customType === 'pi-mstack/goal').length, 1);
  await session.prompt('RUN_GOAL'); assert.match(captures(env).at(-1).system, /ABC-123 fix the parser/);
  await session.prompt('/goal --clear'); await session.prompt('RUN_CLEAR'); assert.doesNotMatch(captures(env).at(-1).system, /<pi-mstack-goal>/);
  await session.navigateTree(first, { summarize: false }); await session.prompt('RUN_RESTORE');
  assert.match(captures(env).at(-1).system, /ABC-123 fix the parser/);
  const user = manager.getEntries().find(e => e.type === 'message' && e.message.role === 'user');
  manager.appendCompaction('summary', user.id, 10);
  await session.reload(); await session.prompt('AFTER_COMPACTION');
  assert.match(captures(env).at(-1).system, /ABC-123 fix the parser/);
  assert.equal(manager.getEntries().filter(e => e.customType === 'pi-mstack/naming-attempt').length, 1);
  assert.equal(manager.getSessionName(), 'ABC-123');
  const count = captures(env).length;
  for (const arg of ['--bad', 'x\x00', 'é'.repeat(2049)]) await session.prompt('/goal ' + arg);
  assert.equal(captures(env).length, count);
  const started = new Promise(resolve => { const off = session.subscribe(e => { if (e.type === 'agent_start') { off(); resolve(); } }); });
  const running = session.prompt('BUSY_TASK'); await started; await session.prompt('/goal should refuse'); await running;
  assert.equal(manager.getEntries().filter(e => e.customType === 'pi-mstack/goal').length, 2);
});

for (const policy of ['task', 'model']) test(`packed SDK ${policy} naming waits for accepted raw task, not consumed, transformed, extension or auth-rejected input`, async t => {
  let pi;
  const { session, manager, env, modelRuntime, agentDir, dir } = await sdk(t, [api => {
    pi = api;
    api.on('input', event => {
      if (event.text === 'CONSUME-1') return { action: 'handled' };
      if (event.text === 'REPLACE-1') return { action: 'transform', text: 'REPLACED_TASK' };
    });
  }]);
  mkdirSync(join(agentDir, 'pstack'));
  writeFileSync(join(agentDir, 'pstack/environment.json'), JSON.stringify({ version: 'pi-mstack/environment/1', naming: policy }));
  process.env.MSTACK_PLAN = join(dir, 'plan.json');
  writeFileSync(process.env.MSTACK_PLAN, JSON.stringify([{ name: 'mstack_set_session_title', arguments: { title: 'Implement local parser changes' } }]));
  const wake = new Promise(resolve => { const off = session.subscribe(e => { if (e.type === 'agent_settled') { off(); resolve(); } }); });
  pi.sendMessage({ customType: 'test-name-wake', content: 'WAKE-22', display: false }, { triggerTurn: true });
  await wake; assert.equal(manager.getSessionName(), undefined);
  await session.prompt('CONSUME-1'); assert.equal(manager.getSessionName(), undefined);
  await session.prompt('REPLACE-1'); assert.equal(manager.getSessionName(), undefined);
  await session.prompt('EXTENSION-1', { source: 'extension' }); assert.equal(manager.getSessionName(), undefined);
  const unauthenticated = { api: 'openai-completions', baseUrl: 'http://127.0.0.1:1', models: [{ id: 'none', name: 'none', reasoning: false, input: ['text'], cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 1000, maxTokens: 100 }] };
  pi.registerProvider('unauthenticated-test', unauthenticated);
  await modelRuntime.setRuntimeApiKey('unauthenticated-test', 'temporary-test-auth');
  await session.setModel(modelRuntime.getModel('unauthenticated-test', 'none'));
  await modelRuntime.removeRuntimeApiKey('unauthenticated-test');
  const requests = captures(env).length;
  await assert.rejects(session.prompt('REJECTED-1'), /API key|auth/i);
  assert.equal(manager.getSessionName(), undefined); assert.equal(captures(env).length, requests);
  await session.setModel(modelRuntime.getModel('mstack-test', 'script/model'));
  await session.prompt('/poteto-mode\nImplement TASK-42 locally EXECUTE_TEST_PLAN');
  assert.equal(manager.getSessionName(), policy === 'model' ? 'TASK-42 Implement local parser changes' : 'TASK-42');
  pi.setSessionName(''); await session.prompt('OTHER-55'); assert.equal(manager.getSessionName(), undefined);
  assert.equal(manager.getEntries().filter(e => e.customType === 'pi-mstack/naming-attempt').length, 1);
});

test('packed RPC naming uses earlier transformed input as delivered by the native pipeline', { timeout: 30000 }, async t => {
  const artifact = packed();
  const dir = join(artifact.dir, 'early-transform'); mkdirSync(dir);
  const iso = isolated(dir, artifact.packageRoot);
  const transform = join(dir, 'early-transform.ts');
  writeFileSync(transform, `export default pi => { pi.on('input', event => { if (event.text === 'RAW-11 original task') return { action: 'transform', text: 'TRANSFORMED-22 replacement task' }; }); }`);
  iso.args.push('-e', transform);
  const client = rpc({ dir, ...iso });
  t.after(async () => {
    try { writeFileSync(join(dir, 'evidence.json'), JSON.stringify({ records: client.records, requests: captures(iso.env) }, null, 2)); }
    finally {
      try { await client.stop(); }
      finally {
        if (keep) process.stdout.write(`Goal RPC evidence ${artifact.dir}\n`);
        else rmSync(artifact.dir, { recursive: true, force: true });
      }
    }
  });
  await client.turn('RAW-11 original task');
  assert.equal((await client.send('get_state')).sessionName, 'TRANSFORMED-22');
  assert.match(JSON.stringify(captures(iso.env).at(-1).messages), /TRANSFORMED-22 replacement task/);
  assert.equal((await client.send('get_entries')).entries.filter(e => e.customType === 'pi-mstack/naming-attempt').length, 1);
});

test('packed RPC separate goal collisions refuse bare and owned suffix without inference or state writes', { timeout: 30000 }, async t => {
  const artifact = packed(); t.after(() => { if (keep) process.stdout.write(`Goal RPC evidence ${artifact.dir}\n`); else rmSync(artifact.dir, { recursive: true, force: true }); });
  for (const kind of ['extension', 'prompt', 'skill']) {
    const dir = join(artifact.dir, kind); mkdirSync(dir); const iso = isolated(dir, artifact.packageRoot);
    iso.args = iso.args.filter(v => v !== '--no-prompt-templates');
    if (kind === 'extension') {
      const path = join(dir, 'foreign.ts'); writeFileSync(path, `export default pi => { pi.registerCommand('goal', { handler: async () => {} }); }`); iso.args.push('-e', path);
    } else if (kind === 'prompt') { mkdirSync(join(iso.agentDir, 'prompts')); writeFileSync(join(iso.agentDir, 'prompts/goal.md'), 'FOREIGN_GOAL'); }
    else { mkdirSync(join(iso.agentDir, 'skills/goal'), { recursive: true }); writeFileSync(join(iso.agentDir, 'skills/goal/SKILL.md'), '---\nname: goal\ndescription: foreign skill\n---\nFOREIGN_SKILL'); }
    const client = rpc({ dir, ...iso });
    try {
      const commands = (await client.send('get_commands')).commands;
      const owned = commands.find(c => c.source === 'extension' && c.name.startsWith('goal') && c.sourceInfo.path.includes(artifact.packageRoot)); assert.ok(owned);
      await client.send('prompt', { message: '/goal COLLIDE-1' });
      if (kind !== 'skill') await client.send('prompt', { message: '/' + owned.name + ' COLLIDE-2' });
      assert.equal(captures(iso.env).length, 0);
      const entries = (await client.send('get_entries')).entries;
      assert.equal(entries.filter(e => e.customType === 'pi-mstack/goal').length, kind === 'skill' ? 1 : 0);
      assert.equal(entries.filter(e => e.customType === 'pi-mstack/naming-attempt').length, kind === 'skill' ? 1 : 0);
      await client.send('prompt', { message: '/poteto-mode' });
      assert.equal((await client.send('get_entries')).entries.filter(e => e.customType === 'pi-mstack/mode').length, 1, 'goal collision does not own mode policy');
    } finally {
      try { writeFileSync(join(dir, 'evidence.json'), JSON.stringify({ records: client.records, requests: captures(iso.env) }, null, 2)); }
      finally { await client.stop(); }
    }
  }
});

test('packed RPC naming preserves native clears, interrupted attempts and disabled configuration', { timeout: 30000 }, async t => {
  const artifact = packed();
  const dir = join(artifact.dir, 'rpc-name'); mkdirSync(dir); const iso = isolated(dir, artifact.packageRoot);
  iso.args.push('-e', join(artifact.packageRoot, 'tests/fixtures/naming-controls.ts'));
  const client = rpc({ dir, ...iso });
  t.after(async () => {
    try { writeFileSync(join(dir, 'evidence.json'), JSON.stringify({ records: client.records, requests: captures(iso.env) }, null, 2)); }
    finally {
      try { await client.stop(); }
      finally {
        if (keep) process.stdout.write(`Goal RPC evidence ${artifact.dir}\n`);
        else rmSync(artifact.dir, { recursive: true, force: true });
      }
    }
  });
  await client.send('prompt', { message: '/poteto-mode' });
  assert.equal((await client.send('get_state')).sessionName, undefined);
  await client.turn('/unknown IGNORE-1');
  assert.equal((await client.send('get_state')).sessionName, undefined);
  await client.turn('/poteto-mode Fix NAME-77 without Jira');
  assert.equal((await client.send('get_state')).sessionName, 'NAME-77');
  await client.send('prompt', { message: '/test-clear-name' }); await client.turn('OTHER-88');
  assert.equal((await client.send('get_state')).sessionName, undefined);
  assert.equal((await client.send('get_entries')).entries.filter(e => e.customType === 'pi-mstack/naming-attempt').length, 1);
  await client.send('new_session'); await client.send('set_session_name', { name: 'Manual name' }); await client.turn('IGNORE-22');
  assert.equal((await client.send('get_state')).sessionName, 'Manual name');
  await client.send('new_session');
  await client.send('prompt', { message: '/test-interrupted-name' }); await client.turn('INTERRUPTED-99');
  assert.equal((await client.send('get_state')).sessionName, undefined);
  assert.equal((await client.send('get_entries')).entries.filter(e => e.customType === 'pi-mstack/naming-attempt').length, 1);
  await client.send('new_session');
  mkdirSync(join(iso.agentDir, 'pstack'));
  for (const raw of ['{"version":"pi-mstack/environment/1","naming":"off"}', '{}']) {
    writeFileSync(join(iso.agentDir, 'pstack/environment.json'), raw);
    await client.turn('DISABLED-11');
    await client.send('prompt', { message: '/goal DISABLED-12' });
    assert.equal((await client.send('get_state')).sessionName, undefined);
    assert.equal((await client.send('get_entries')).entries.filter(e => e.customType === 'pi-mstack/naming-attempt').length, 0);
  }
});

test('packed SDK unconsumed model offers expire at settled and restored active sets are pruned', async t => {
  const { session, manager, agentDir } = await sdk(t);
  mkdirSync(join(agentDir, 'pstack'));
  writeFileSync(join(agentDir, 'pstack/environment.json'), JSON.stringify({ version: 'pi-mstack/environment/1', naming: 'model' }));
  const tool = 'mstack_set_session_title';
  await session.prompt('Clarify parser requirements');
  assert.equal(manager.getSessionName(), undefined);
  assert.equal(session.getActiveToolNames().includes(tool), false);
  const user = manager.getEntries().find(e => e.message?.role === 'user');
  session.setActiveToolsByName([...session.getActiveToolNames(), tool]);
  await session.navigateTree(user.id, { summarize: false });
  assert.equal(session.getActiveToolNames().includes(tool), false);
  session.setActiveToolsByName([...session.getActiveToolNames(), tool]);
  await session.reload();
  assert.equal(session.getActiveToolNames().includes(tool), false);
  assert.equal(manager.getEntries().filter(e => e.customType === 'pi-mstack/naming-attempt').length, 0);
});
