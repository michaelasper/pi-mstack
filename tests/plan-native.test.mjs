import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createAgentSessionFromServices, createAgentSessionServices, ModelRuntime, SessionManager, SettingsManager } from '@earendil-works/pi-coding-agent';
import { packed, isolated, captures, rpc } from './helpers.mjs';

const keep = !!process.env.MSTACK_KEEP_TEST_ARTIFACTS;
const planTool = 'pstack_plan';
const steps = [{ id: 'a', text: 'Design', status: 'completed' }, { id: 'b', text: 'Build', status: 'in_progress' }];
const plan = { title: 'Ship <it>', steps };

function start(t, { flags = [], settings = {}, args = [], extension, usage } = {}) {
  const artifact = packed();
  const dir = join(artifact.dir, 'case'); mkdirSync(dir);
  const iso = isolated(dir, artifact.packageRoot, settings);
  iso.env.MSTACK_PLAN = join(dir, 'planned-calls.json');
  iso.env.MSTACK_FINISH = join(dir, 'finishes.jsonl');
  if (usage) { iso.env.MSTACK_USAGE = join(dir, 'usage.json'); writeFileSync(iso.env.MSTACK_USAGE, JSON.stringify(usage)); }
  if (extension) {
    const path = join(dir, 'plan-controls.ts');
    writeFileSync(path, extension);
    args = [...args, '-e', path];
  }
  iso.args.push(...flags, ...args);
  const client = rpc({ dir, ...iso });
  t.after(async () => {
    try {
      writeFileSync(join(dir, 'evidence.json'), JSON.stringify({ records: client.records, requests: captures(iso.env), entries: (await client.send('get_entries')).entries }, null, 2));
    } finally {
      try { await client.stop(); }
      finally {
        if (keep) process.stdout.write(`Plan RPC evidence ${artifact.dir}\n`);
        else rmSync(artifact.dir, { recursive: true, force: true });
      }
    }
  });
  return { client, iso, dir };
}

async function call(client, iso, arguments_) {
  writeFileSync(iso.env.MSTACK_PLAN, JSON.stringify([{ name: planTool, arguments: arguments_ }]));
  await client.turn('EXECUTE_TEST_PLAN');
  const entries = (await client.send('get_entries')).entries;
  const results = entries.filter(entry => entry.message?.role === 'toolResult' && entry.message.toolName === planTool);
  return { entries, result: results.at(-1)?.message, text: results.at(-1)?.message.content.map(block => block.text).join('') };
}

const planContext = env => {
  const request = captures(env).at(-1);
  const message = request.messages.filter(entry => entry.role === 'user' && JSON.stringify(entry).includes('Saved pstack plan')).at(-1);
  return message ? message.content.map(block => block.text).join('') : undefined;
};

test('packed plan tool stays absent, inert, and unselected while the flag is off', { timeout: 30000 }, async t => {
  const { client, iso } = start(t);
  const beforeDoctor = (await client.send('get_entries')).entries;
  await client.send('prompt', { message: '/pstack doctor' });
  assert.equal(captures(iso.env).length, 0);
  assert.deepEqual((await client.send('get_entries')).entries, beforeDoctor);
  assert.equal(client.records.some(event => event.method === 'notify' && event.message.includes('Feature flags: pstack-plan off, pstack-idle-compact off.')), true);
  const { entries, result } = await call(client, iso, { action: 'read' });
  const request = captures(iso.env)[0];
  assert.equal(request.providerTools.some(tool => tool.name === planTool), false);
  assert.doesNotMatch(request.system, /pstack_plan|<pi-mstack-plan>/);
  assert.equal(JSON.stringify(request.messages).includes('Saved pstack plan'), false);
  assert.equal(entries.filter(entry => entry.customType === 'pi-mstack/plan').length, 0);
  assert.equal(result?.isError, true);
});

test('packed plan flag exposes compare-and-append state to the provider without persisted restorations', { timeout: 30000 }, async t => {
  const { client, iso } = start(t, { flags: ['--pstack-plan'] });
  const read = await call(client, iso, { action: 'read' });
  const absent = JSON.parse(read.text);
  assert.equal(absent.state, 'absent');
  assert.ok(Buffer.byteLength(absent.revision) <= 1024);
  assert.equal(captures(iso.env).length, 2, 'tool continuation requests the current state');
  assert.match(captures(iso.env).at(-1).providerTools.map(tool => tool.name).join(','), new RegExp(planTool));
  assert.doesNotMatch(captures(iso.env)[0].system, /Saved pstack plan/);
  assert.match(captures(iso.env)[0].system, /<pi-mstack-plan>/);
  assert.match(planContext(iso.env), /"state":"absent"/);

  const written = await call(client, iso, { action: 'write', expectedRevision: absent.revision, plan });
  const saved = JSON.parse(written.text);
  assert.equal(saved.state, 'present');
  assert.deepEqual(saved.plan, plan);
  assert.equal(saved.conflict, undefined);
  assert.match(planContext(iso.env), /"state":"present"/);
  assert.match(planContext(iso.env), /Ship/);

  const stale = await call(client, iso, { action: 'write', expectedRevision: absent.revision, plan: { title: 'Stale', steps: [steps[0]] } });
  assert.equal(stale.result.isError, true);
  const conflicted = JSON.parse(stale.text);
  assert.equal(conflicted.conflict, true);
  assert.equal(conflicted.revision, saved.revision);
  assert.deepEqual(conflicted.plan, plan);
  assert.equal(stale.entries.filter(entry => entry.customType === 'pi-mstack/plan').length, 1);

  const repeated = await call(client, iso, { action: 'write', expectedRevision: saved.revision, plan });
  assert.deepEqual(JSON.parse(repeated.text), saved);
  assert.equal(repeated.entries.filter(entry => entry.customType === 'pi-mstack/plan').length, 1);

  const cleared = await call(client, iso, { action: 'clear', expectedRevision: saved.revision });
  assert.equal(JSON.parse(cleared.text).state, 'cleared');
  assert.match(planContext(iso.env), /"state":"cleared"/);
  const repeatedClear = await call(client, iso, { action: 'clear', expectedRevision: JSON.parse(cleared.text).revision });
  assert.deepEqual(JSON.parse(repeatedClear.text), JSON.parse(cleared.text));
  assert.equal(repeatedClear.entries.filter(entry => entry.customType === 'pi-mstack/plan').length, 2);
  assert.equal(repeatedClear.entries.filter(entry => entry.customType === 'pi-mstack/plan-context').length, 0);
  assert.equal(repeatedClear.entries.filter(entry => entry.type === 'custom_message').length, 0);
  assert.match(planContext(iso.env), /"state":"cleared"/);
});

test('packed plan and idle compaction flags are independent and additive', { timeout: 30000 }, async t => {
  const { client, iso } = start(t, { flags: ['--pstack-plan', '--pstack-idle-compact'] });
  const read = await call(client, iso, { action: 'read' });
  assert.equal(JSON.parse(read.text).state, 'absent');
  assert.match(captures(iso.env)[0].system, /<pi-mstack-plan>/);
  const entries = (await client.send('get_entries')).entries;
  assert.equal(entries.filter(entry => entry.type === 'compaction').length, 0, 'low usage does not compact');
  assert.equal(entries.filter(entry => entry.customType === 'pi-mstack/plan').length, 0);
});

test('packed plan honors restrictive native tool selection', { timeout: 30000 }, async t => {
  const { client, iso } = start(t, { flags: ['--pstack-plan'], args: ['--tools', 'read,bash'] });
  const { entries, result } = await call(client, iso, { action: 'read' });
  assert.equal(captures(iso.env)[0].providerTools.some(tool => tool.name === planTool), false);
  assert.doesNotMatch(captures(iso.env)[0].system, /pstack_plan|<pi-mstack-plan>/);
  assert.equal(JSON.stringify(captures(iso.env)[0].messages).includes('Saved pstack plan'), false);
  assert.equal(entries.filter(entry => entry.customType === 'pi-mstack/plan').length, 0);
  assert.equal(result?.isError, true);
});

test('packed plan refuses foreign ownership of the tool name without injecting or writing', { timeout: 30000 }, async t => {
  const artifact = packed();
  const dir = join(artifact.dir, 'case'); mkdirSync(dir);
  const foreign = join(dir, 'foreign-plan.ts');
  writeFileSync(foreign, `import { Type } from 'typebox';
export default pi => {
  pi.registerTool({
    name: 'pstack_plan',
    label: 'Foreign plan',
    description: 'Foreign owner of the plan tool name',
    parameters: Type.Object({ action: Type.String() }, { additionalProperties: true }),
    async execute() { return { content: [{ type: 'text', text: 'foreign-plan-result' }], details: {} }; },
  });
};`);
  const iso = isolated(dir, artifact.packageRoot);
  iso.env.MSTACK_PLAN = join(dir, 'planned-calls.json');
  iso.args.push('--pstack-plan', '-e', foreign);
  const client = rpc({ dir, ...iso });
  t.after(async () => {
    try { writeFileSync(join(dir, 'evidence.json'), JSON.stringify({ records: client.records, requests: captures(iso.env), entries: (await client.send('get_entries')).entries }, null, 2)); }
    finally {
      try { await client.stop(); }
      finally {
        if (keep) process.stdout.write(`Plan collision evidence ${artifact.dir}\n`);
        else rmSync(artifact.dir, { recursive: true, force: true });
      }
    }
  });
  const { entries, result } = await call(client, iso, { action: 'read' });
  assert.equal(result.isError, false);
  assert.equal(result.content.map(block => block.text).join(''), 'foreign-plan-result');
  assert.equal(entries.filter(entry => entry.customType === 'pi-mstack/plan').length, 0);
  assert.equal(JSON.stringify(captures(iso.env)[0].messages).includes('Saved pstack plan'), false);
  assert.doesNotMatch(captures(iso.env)[0].system, /<pi-mstack-plan>/);
});

test('packed plan follows native fork cuts and clone copies with fresh revisions', { timeout: 40000 }, async t => {
  const { client, iso } = start(t, { flags: ['--pstack-plan'] });
  await client.turn('FIRST_TASK');
  await client.turn('SECOND_TASK');
  const read = JSON.parse((await call(client, iso, { action: 'read' })).text);
  const written = JSON.parse((await call(client, iso, { action: 'write', expectedRevision: read.revision, plan })).text);
  assert.equal((await client.send('clone')).cancelled, false);
  const cloned = JSON.parse((await call(client, iso, { action: 'read' })).text);
  assert.deepEqual(cloned.plan, plan);
  assert.notEqual(cloned.revision, written.revision);
  const staleInClone = JSON.parse((await call(client, iso, { action: 'write', expectedRevision: written.revision, plan: { title: 'Other', steps } })).text);
  assert.equal(staleInClone.conflict, true);
  assert.deepEqual(staleInClone.plan, plan);
  const forked = (await client.send('get_fork_messages')).messages;
  const second = forked.find(message => message.text === 'SECOND_TASK');
  assert.ok(second);
  assert.equal((await client.send('fork', { entryId: second.entryId })).cancelled, false);
  const afterFork = JSON.parse((await call(client, iso, { action: 'read' })).text);
  assert.equal(afterFork.state, 'absent');
});

test('packed plan ancestry survives native compaction and is re-sent after it', { timeout: 30000 }, async t => {
  const { client, iso } = start(t, { flags: ['--pstack-plan'], settings: { compaction: { enabled: false, reserveTokens: 0, keepRecentTokens: 0 } } });
  await client.turn('FIRST_TASK');
  await client.turn('SECOND_TASK');
  const read = JSON.parse((await call(client, iso, { action: 'read' })).text);
  const written = JSON.parse((await call(client, iso, { action: 'write', expectedRevision: read.revision, plan })).text);
  assert.equal(written.state, 'present');
  const compaction = await client.send('compact');
  assert.equal(typeof compaction.summary, 'string');
  const entries = (await client.send('get_entries')).entries;
  assert.equal(entries.filter(entry => entry.type === 'compaction').length, 1);
  await client.turn('AFTER_COMPACTION');
  const context = planContext(iso.env);
  assert.match(context, /"state":"present"/);
  assert.match(context, /Ship/);
  const reread = JSON.parse((await call(client, iso, { action: 'read' })).text);
  assert.deepEqual(reread.plan, plan);
  assert.equal(reread.revision, written.revision, 'compaction leaves the latest plan revision valid');
});

test('packed SDK plan persists to disk, rejects reload and navigation revisions, and masks older data', { timeout: 40000 }, async t => {
  const artifact = packed();
  const dir = join(artifact.dir, 'sdk'); mkdirSync(dir);
  const iso = isolated(dir, artifact.packageRoot);
  const prior = { ...process.env };
  for (const key of Object.keys(process.env)) delete process.env[key];
  Object.assign(process.env, iso.env);
  process.env.MSTACK_PLAN = join(dir, 'planned-calls.json');
  t.after(() => { for (const key of Object.keys(process.env)) delete process.env[key]; Object.assign(process.env, prior); });
  const settingsManager = SettingsManager.create(dir, iso.agentDir);
  const modelRuntime = await ModelRuntime.create({ authPath: join(iso.agentDir, 'auth.json'), modelsPath: join(iso.agentDir, 'models.json'), refreshOnCreate: false, allowModelNetwork: false });
  const services = await createAgentSessionServices({
    cwd: dir,
    agentDir: iso.agentDir,
    settingsManager,
    modelRuntime,
    extensionFlagValues: new Map([['pstack-plan', true]]),
    resourceLoaderOptions: { noContextFiles: true, noThemes: true, noPromptTemplates: true, additionalExtensionPaths: [join(artifact.packageRoot, 'tests/fixtures/provider.ts')] },
  });
  const manager = SessionManager.create(dir, join(iso.agentDir, 'sessions'));
  const { session } = await createAgentSessionFromServices({ services, sessionManager: manager });
  const errors = [];
  await session.bindExtensions({ onError: error => errors.push(error) });
  await session.setModel(modelRuntime.getModel('mstack-test', 'script/model'));
  session.setThinkingLevel('off');
  t.after(() => {
    writeFileSync(join(dir, 'evidence.json'), JSON.stringify({ entries: manager.getEntries(), requests: captures(iso.env), errors }, null, 2));
    session.dispose();
    if (keep) process.stdout.write(`Plan SDK evidence ${dir}\n`);
    else rmSync(artifact.dir, { recursive: true, force: true });
  });
  const toolResults = () => manager.getEntries().filter(entry => entry.message?.role === 'toolResult' && entry.message.toolName === planTool).map(entry => entry.message);
  const ask = async arguments_ => {
    writeFileSync(process.env.MSTACK_PLAN, JSON.stringify([{ name: planTool, arguments: arguments_ }]));
    await session.prompt('EXECUTE_TEST_PLAN');
    const message = toolResults().at(-1);
    return { message, state: JSON.parse(message.content.map(block => block.text).join('')) };
  };
  const absent = (await ask({ action: 'read' })).state;
  const written = (await ask({ action: 'write', expectedRevision: absent.revision, plan })).state;
  assert.equal(written.state, 'present');
  assert.match(readFileSync(manager.getSessionFile(), 'utf8'), /"customType":"pi-mstack\/plan"/);
  const reopened = SessionManager.open(manager.getSessionFile());
  assert.equal(reopened.getBranch().filter(entry => entry.customType === 'pi-mstack/plan').length, 1);
  const reopenedPlan = await import('../extensions/pstack/plan.ts');
  assert.deepEqual(reopenedPlan.branchPlan(reopened.getBranch()).plan, plan);
  session.setActiveToolsByName(['read', 'bash']);
  assert.equal(session.getAllTools().some(tool => tool.name === planTool), true);
  assert.equal(session.getActiveToolNames().includes(planTool), false);
  const fresh = { title: 'FRESH_AFTER_DEACTIVATION', steps };
  manager.appendCustomEntry('pi-mstack/plan', { version: 1, plan: fresh });
  await session.prompt('CAPTURE_DEACTIVATED');
  const inactive = captures(iso.env).at(-1);
  assert.equal(inactive.providerTools.some(tool => tool.name === planTool), false);
  assert.doesNotMatch(inactive.system, /<pi-mstack-plan>/);
  assert.equal(JSON.stringify(inactive.messages).includes('Saved pstack plan for this branch'), false);
  assert.equal(JSON.stringify(inactive.messages).includes(fresh.title), false);
  session.setActiveToolsByName(['read', 'bash', planTool]);
  await session.prompt('CAPTURE_REACTIVATED');
  assert.equal(captures(iso.env).at(-1).providerTools.some(tool => tool.name === planTool), true);
  assert.match(captures(iso.env).at(-1).system, /<pi-mstack-plan>/);
  assert.match(planContext(iso.env), /FRESH_AFTER_DEACTIVATION/);
  manager.appendCustomEntry('pi-mstack/plan', { version: 1, plan });
  const beforeReload = (await ask({ action: 'read' })).state;
  await session.reload();
  const afterReload = (await ask({ action: 'write', expectedRevision: beforeReload.revision, plan })).state;
  assert.equal(afterReload.conflict, true);
  assert.deepEqual(afterReload.plan, plan);
  const reread = (await ask({ action: 'read' })).state;
  const planEntry = manager.getBranch().findLast(entry => entry.customType === 'pi-mstack/plan');
  assert.ok(planEntry);
  const beforePlan = manager.getBranch().find(entry => entry.type === 'message' && entry.message.role === 'user');
  const navigated = await session.navigateTree(beforePlan.id, { summarize: false });
  assert.equal(navigated.cancelled, false);
  assert.equal((await ask({ action: 'read' })).state.state, 'absent');
  await session.navigateTree(planEntry.id, { summarize: false });
  const restored = (await ask({ action: 'read' })).state;
  assert.deepEqual(restored.plan, plan);
  assert.notEqual(restored.revision, reread.revision);
  const stale = (await ask({ action: 'write', expectedRevision: reread.revision, plan: { title: 'Stale', steps } })).state;
  assert.equal(stale.conflict, true);
  for (const data of [
    { version: 1, plan: null, ['UNTRUSTED_KEY'.repeat(5000)]: true },
    { version: 1, plan: { title: 'bad', steps, ['UNTRUSTED_KEY'.repeat(5000)]: true } },
    { version: 1, plan: { title: 't', steps: Array.from({ length: 15 }, (_, i) => ({ id: `s${i}`, text: '<'.repeat(1024), status: 'pending' })) } },
  ]) {
    manager.appendCustomEntry('pi-mstack/plan', data);
    await session.prompt('CAPTURE_UNSUPPORTED_BOUND');
    const context = planContext(iso.env);
    assert.match(context, /"state":"unsupported"/);
    assert.ok(Buffer.byteLength(context) <= 20 * 1024);
    assert.equal(context.includes('UNTRUSTED_KEY'), false);
    const state = (await ask({ action: 'read' })).state;
    assert.equal(state.state, 'unsupported');
    assert.ok(Buffer.byteLength(state.diagnostic) <= 128);
  }
  assert.deepEqual(errors, []);
});

test('forced native plan selection cannot enable a flag-off tool', { timeout: 30000 }, async t => {
  const { client, iso } = start(t, { args: ['--tools', planTool] });
  const { entries, result } = await call(client, iso, { action: 'read' });
  assert.equal(result.isError, true);
  assert.equal(captures(iso.env)[0].providerTools.some(tool => tool.name === planTool), false);
  assert.doesNotMatch(captures(iso.env)[0].system, /<pi-mstack-plan>/);
  assert.equal(entries.some(entry => entry.customType === 'pi-mstack/plan'), false);
});

test('explicit mode off permits both independent flags and doctor reports passively', { timeout: 30000 }, async t => {
  const { client, iso } = start(t, { flags: ['--pstack-plan', '--pstack-idle-compact'], usage: { input: 170000 }, settings: { compaction: { enabled: false, reserveTokens: 0, keepRecentTokens: 0 } } });
  await client.send('prompt', { message: '/poteto-mode off' });
  const before = (await client.send('get_entries')).entries;
  assert.equal(before.findLast(entry => entry.customType === 'pi-mstack/mode').data.enabled, false);
  await client.send('prompt', { message: '/pstack doctor' });
  assert.equal(captures(iso.env).length, 0);
  assert.deepEqual((await client.send('get_entries')).entries, before);
  assert.equal(client.records.some(event => event.method === 'notify' && event.message.includes('Feature flags: pstack-plan on, pstack-idle-compact on.')), true);
  const read = await call(client, iso, { action: 'read' });
  assert.equal(JSON.parse(read.text).state, 'absent');
  assert.doesNotMatch(captures(iso.env)[0].system, /<pi-mstack-mode>/);
  assert.match(captures(iso.env)[0].system, /<pi-mstack-plan>/);
  assert.equal((await client.send('get_entries')).entries.filter(entry => entry.type === 'compaction').length, 1);
});

test('child runtime refuses both requested feature flags and exposes neither feature', { timeout: 30000 }, async t => {
  const artifact = packed();
  const dir = join(artifact.dir, 'child'); mkdirSync(dir);
  const iso = isolated(dir, artifact.packageRoot);
  iso.env.PI_SUBAGENT_CHILD = '1';
  iso.env.MSTACK_USAGE = join(dir, 'usage.json');
  writeFileSync(iso.env.MSTACK_USAGE, JSON.stringify({ input: 170000 }));
  const prior = { ...process.env };
  for (const key of Object.keys(process.env)) delete process.env[key];
  Object.assign(process.env, iso.env);
  t.after(() => { for (const key of Object.keys(process.env)) delete process.env[key]; Object.assign(process.env, prior); });
  const settingsManager = SettingsManager.create(dir, iso.agentDir);
  const modelRuntime = await ModelRuntime.create({ authPath: join(iso.agentDir, 'auth.json'), modelsPath: join(iso.agentDir, 'models.json'), refreshOnCreate: false, allowModelNetwork: false });
  const services = await createAgentSessionServices({
    cwd: dir, agentDir: iso.agentDir, settingsManager, modelRuntime,
    extensionFlagValues: new Map([['pstack-plan', true], ['pstack-idle-compact', true]]),
    resourceLoaderOptions: { noContextFiles: true, noThemes: true, noPromptTemplates: true, additionalExtensionPaths: [join(artifact.packageRoot, 'tests/fixtures/provider.ts')] },
  });
  assert.ok(services.diagnostics.some(diagnostic => diagnostic.message.includes('Unknown options: --pstack-plan, --pstack-idle-compact')));
  const manager = SessionManager.inMemory(dir);
  const { session } = await createAgentSessionFromServices({ services, sessionManager: manager });
  const errors = [];
  await session.bindExtensions({ onError: error => errors.push(error) });
  await session.setModel(modelRuntime.getModel('mstack-test', 'script/model'));
  session.setThinkingLevel('off');
  t.after(() => {
    writeFileSync(join(dir, 'evidence.json'), JSON.stringify({ entries: manager.getEntries(), requests: captures(iso.env), diagnostics: services.diagnostics, errors }, null, 2));
    session.dispose();
    if (keep) process.stdout.write(`Plan child SDK evidence ${dir}\n`);
    else rmSync(artifact.dir, { recursive: true, force: true });
  });
  await session.prompt('CHILD_HIGH_USAGE');
  assert.equal(session.getAllTools().some(tool => tool.name === planTool), false);
  assert.equal(captures(iso.env).length, 1);
  assert.equal(captures(iso.env)[0].providerTools.some(tool => tool.name === planTool), false);
  assert.doesNotMatch(captures(iso.env)[0].system, /<pi-mstack-plan>/);
  assert.equal(JSON.stringify(captures(iso.env)[0].messages).includes('Saved pstack plan'), false);
  assert.equal(manager.getEntries().some(entry => entry.customType === 'pi-mstack/plan' || entry.type === 'compaction'), false);
  assert.deepEqual(errors, []);
});

test('native plan batch ordering and nested same-token dispatch each commit at most once', { timeout: 30000 }, async t => {
  const { client, iso } = start(t, { flags: ['--pstack-plan'], extension: `import { Type } from 'typebox';
export default pi => {
  pi.registerTool({ name: 'nested_plan', label: 'Nested plan', description: 'Test nested plan dispatch', parameters: Type.Object({ revision: Type.String() }),
    async execute(_id, args, signal, _update, ctx) {
      const results = await Promise.all(['Nested left', 'Nested right'].map(title => ctx.executeTool('pstack_plan', { action: 'write', expectedRevision: args.revision, plan: { title, steps: [{ id: 'a', text: 'work', status: 'pending' }] } }, { signal })));
      return { content: [{ type: 'text', text: JSON.stringify(results.map(result => ({ isError: result.isError, state: JSON.parse(result.result.content[0].text) }))) }], details: {} };
    }
  });
};` });
  const initial = JSON.parse((await call(client, iso, { action: 'read' })).text);
  const offset = client.records.length;
  writeFileSync(iso.env.MSTACK_PLAN, JSON.stringify([
    { name: planTool, arguments: { action: 'write', expectedRevision: initial.revision, plan } },
    { name: planTool, arguments: { action: 'clear', expectedRevision: initial.revision } },
    { name: planTool, arguments: { action: 'read' } },
  ]));
  await client.turn('EXECUTE_TEST_PLAN');
  const events = client.records.slice(offset).filter(event => event.toolName === planTool && ['tool_execution_start', 'tool_execution_end'].includes(event.type));
  assert.deepEqual(events.map(event => event.type), ['tool_execution_start', 'tool_execution_end', 'tool_execution_start', 'tool_execution_end', 'tool_execution_start', 'tool_execution_end']);
  const batch = events.filter(event => event.type === 'tool_execution_end').map(event => JSON.parse(event.result.content[0].text));
  assert.deepEqual(batch.map(state => Boolean(state.conflict)), [false, true, false]);
  const token = batch.at(-1).revision;
  writeFileSync(iso.env.MSTACK_PLAN, JSON.stringify([{ name: 'nested_plan', arguments: { revision: token } }]));
  await client.turn('EXECUTE_TEST_PLAN');
  const entries = (await client.send('get_entries')).entries;
  const outer = entries.findLast(entry => entry.message?.toolName === 'nested_plan').message;
  assert.equal(outer.isError, false);
  const nested = JSON.parse(outer.content[0].text);
  assert.equal(nested.filter(result => result.state.conflict).length, 1);
  assert.equal(nested.filter(result => result.isError).length, 1);
  assert.equal(entries.filter(entry => entry.customType === 'pi-mstack/plan').length, 2);
  assert.equal(outer.nestedCalls.calls.length, 2);
  assert.equal(client.records.filter(event => event.toolName === planTool && event.parentToolCallId && event.type === 'tool_execution_end').length, 2);
});
