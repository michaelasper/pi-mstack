import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { SessionManager } from '@earendil-works/pi-coding-agent';
import { branchPlan, parsePlan, planType, registerPlan } from '../extensions/pstack/plan.ts';

const ownPath = fileURLToPath(import.meta.url);

function feature(ownPathOverride = ownPath, started = true, sessionId) {
  const sessionManager = SessionManager.inMemory(undefined, { id: sessionId });
  const tools = new Map();
  const handlers = new Map();
  const pi = {
    on(event, handler) { handlers.set(event, [...(handlers.get(event) ?? []), handler]); return () => {}; },
    registerTool(tool) { tools.set(tool.name, { ...tool, sourceInfo: { path: ownPathOverride, source: 'extension', scope: 'temporary', origin: 'top-level' } }); },
    getActiveTools() { return [...tools.keys()]; },
    getAllTools() { return [...tools.values()].map(tool => ({ name: tool.name, description: tool.description, parameters: tool.parameters, sourceInfo: tool.sourceInfo })); },
    appendEntry(type, data) { sessionManager.appendCustomEntry(type, data); },
  };
  const plan = registerPlan(pi, ownPath);
  if (started) plan.start();
  const ctx = { sessionManager, hasUI: false, cwd: '/tmp' };
  const run = (params, signal) => tools.get('pstack_plan').execute('call-1', params, signal, undefined, ctx);
  return { sessionManager, plan, tools, ctx, run, handlers, append: (data) => sessionManager.appendCustomEntry(planType, data) };
}

const steps = (count, textLength = 4) => Array.from({ length: count }, (_, index) => ({ id: `s${index}`, text: 'x'.repeat(textLength), status: 'pending' }));

test('plan tool is absent until the flag registers it and refuses foreign ownership', async () => {
  const off = feature(ownPath, false);
  assert.equal(off.tools.has('pstack_plan'), false);
  assert.equal(off.plan.available(), false);
  assert.equal(off.plan.section(), undefined);
  off.plan.start();
  assert.equal(off.plan.available(), true);
  assert.match(off.plan.section(), /not operator authority/);
  const foreign = feature('/tmp/foreign-extension.ts');
  assert.equal(foreign.plan.available(), false);
  assert.equal(foreign.plan.section(), undefined);
  await assert.rejects(foreign.run({ action: 'read' }), /owned by another extension/);
});

test('plan validation enforces exact bounds, closed shapes, and one active step', () => {
  const plan = { title: 'Ship', steps: steps(2) };
  assert.deepEqual(parsePlan(plan), plan);
  assert.throws(() => parsePlan({ ...plan, extra: 1 }), /unknown properties/);
  assert.throws(() => parsePlan({ title: 'Ship', steps: [] }), /1 to 64/);
  assert.throws(() => parsePlan({ title: 'Ship', steps: steps(65) }), /1 to 64/);
  assert.deepEqual(parsePlan({ title: 'Ship', steps: steps(64, 1) }).steps.length, 64);
  assert.throws(() => parsePlan({ title: '   ', steps: steps(1) }), /visible text/);
  assert.throws(() => parsePlan({ title: 't', steps: [{ id: '1bad', text: 'x', status: 'pending' }] }), /id must match/);
  assert.throws(() => parsePlan({ title: 't', steps: [{ id: 'ok', text: 'x', status: 'pending' }, { id: 'ok', text: 'y', status: 'pending' }] }), /duplicated/);
  assert.throws(() => parsePlan({ title: 't', steps: [{ id: 'ok', text: 'x', status: 'done' }] }), /status must be one of/);
  assert.throws(() => parsePlan({ title: 't', steps: [{ id: 'ok', text: 'x', status: 'pending', note: 'extra' }] }), /unknown properties/);
  assert.throws(() => parsePlan({ title: 't', steps: [{ id: 'a', text: 'x', status: 'in_progress' }, { id: 'b', text: 'y', status: 'in_progress' }] }), /At most one step can be in_progress/);
  assert.throws(() => parsePlan({ title: 't', steps: [{ id: 'a', text: 'x\u0007', status: 'pending' }] }), /control characters/);
  assert.throws(() => parsePlan({ title: 't', steps: [{ id: 'a', text: 'x\r', status: 'pending' }] }), /control characters/);
  assert.equal(parsePlan({ title: 'a\nb\tc', steps: [{ id: 'a', text: 'line\nnext', status: 'pending' }] }).title, 'a\nb\tc');
  assert.throws(() => parsePlan({ title: 't'.repeat(257), steps: steps(1) }), /256 UTF-8 bytes/);
  assert.equal(parsePlan({ title: 'é'.repeat(128), steps: steps(1) }).title.length, 128);
  assert.throws(() => parsePlan({ title: 'é'.repeat(129), steps: steps(1) }), /256 UTF-8 bytes/);
  assert.throws(() => parsePlan({ title: 't', steps: [{ id: 'a', text: 'x'.repeat(1025), status: 'pending' }] }), /1024 UTF-8 bytes/);
  assert.equal(parsePlan({ title: 't', steps: [{ id: 'a', text: 'x'.repeat(1024), status: 'pending' }] }).steps[0].text.length, 1024);
  assert.throws(() => parsePlan({ title: 't', steps: steps(64, 300) }), /16384 UTF-8 bytes/);
  assert.throws(() => parsePlan({ title: 't', steps: 'nope' }), /1 to 64/);
  assert.throws(() => parsePlan(null), /must be an object/);
});

test('plan ancestry masks unsupported data, keeps order, and follows branch changes', () => {
  const { sessionManager, append } = feature();
  assert.deepEqual(branchPlan(sessionManager.getBranch()), { kind: 'absent' });
  append({ version: 1, plan: { title: 'First', steps: steps(2) } });
  const root = sessionManager.getLeafId();
  assert.equal(branchPlan(sessionManager.getBranch()).plan.title, 'First');
  append({ version: 3, plan: null });
  const unsupported = branchPlan(sessionManager.getBranch());
  assert.equal(unsupported.kind, 'unsupported');
  assert.match(unsupported.diagnostic, /unsupported version/);
  append({ version: 1, plan: { title: 'Broken', steps: [] } });
  assert.match(branchPlan(sessionManager.getBranch()).diagnostic, /invalid/);
  append({ version: 1, plan: { title: 'Replaced', steps: steps(1) }, extra: true });
  assert.match(branchPlan(sessionManager.getBranch()).diagnostic, /invalid/);
  append({ version: 1, plan: { title: 'Ordered', steps: [{ id: 'b', text: 'second', status: 'pending' }, { id: 'a', text: 'first', status: 'pending' }] } });
  assert.deepEqual(branchPlan(sessionManager.getBranch()).plan.steps.map(step => step.id), ['b', 'a']);
  sessionManager.branch(root);
  assert.equal(branchPlan(sessionManager.getBranch()).plan.title, 'First');
  sessionManager.resetLeaf();
  assert.deepEqual(branchPlan(sessionManager.getBranch()), { kind: 'absent' });
});

test('plan writes use opaque compare-and-append with no-op and clear semantics', async () => {
  const { run, sessionManager } = feature();
  const off = await run({ action: 'read' });
  assert.match(off.content[0].text, /^\{/);
  const absent = JSON.parse(off.content[0].text);
  assert.deepEqual(absent.state, 'absent');
  assert.ok(Buffer.byteLength(absent.revision) <= 1024);
  await assert.rejects(run({ action: 'write', plan: { title: 't', steps: steps(1) } }), /requires expectedRevision/);
  await assert.rejects(run({ action: 'clear' }), /requires expectedRevision/);
  await assert.rejects(run({ action: 'read', plan: { title: 't', steps: steps(1) } }), /only action/);
  await assert.rejects(run({ action: 'clear', expectedRevision: absent.revision, plan: { title: 't', steps: steps(1) } }), /only action and expectedRevision/);
  await assert.rejects(run({ action: 'write', expectedRevision: absent.revision }), /complete plan/);
  await assert.rejects(run({ action: 'bogus' }), /read, write, or clear/);
  const plan = { title: 'Ordered work', steps: steps(2) };
  const written = JSON.parse((await run({ action: 'write', expectedRevision: absent.revision, plan })).content[0].text);
  assert.deepEqual(written.plan, plan);
  assert.notEqual(written.revision, absent.revision);
  assert.equal(sessionManager.getBranch().filter(entry => entry.customType === planType).length, 1);
  const noop = JSON.parse((await run({ action: 'write', expectedRevision: written.revision, plan })).content[0].text);
  assert.deepEqual(noop, written);
  assert.equal(sessionManager.getBranch().filter(entry => entry.customType === planType).length, 1);
  const conflict = await run({ action: 'write', expectedRevision: absent.revision, plan: { title: 'Stale', steps: steps(1) } });
  assert.equal(conflict.isError, true);
  const conflicted = JSON.parse(conflict.content[0].text);
  assert.equal(conflicted.conflict, true);
  assert.equal(conflicted.revision, written.revision);
  assert.deepEqual(conflicted.plan, plan);
  assert.equal(sessionManager.getBranch().filter(entry => entry.customType === planType).length, 1);
  const cleared = JSON.parse((await run({ action: 'clear', expectedRevision: written.revision })).content[0].text);
  assert.equal(cleared.state, 'cleared');
  const repeated = JSON.parse((await run({ action: 'clear', expectedRevision: cleared.revision })).content[0].text);
  assert.deepEqual(repeated, cleared);
  assert.equal(sessionManager.getBranch().filter(entry => entry.customType === planType).length, 2);
});

test('plan writes replace unsupported state only with the current token', async () => {
  const { run, append, sessionManager } = feature();
  append({ version: 2, plan: null });
  const read = JSON.parse((await run({ action: 'read' })).content[0].text);
  assert.equal(read.state, 'unsupported');
  assert.match(read.diagnostic, /unsupported version/);
  assert.equal(JSON.stringify(read).includes('"plan"'), false);
  const replaced = JSON.parse((await run({ action: 'write', expectedRevision: read.revision, plan: { title: 'Fresh', steps: steps(1) } })).content[0].text);
  assert.equal(replaced.state, 'present');
  assert.equal(sessionManager.getBranch().filter(entry => entry.customType === planType).length, 2);
});

test('plan token binds runtime, navigation, session, and latest entry', async () => {
  const { run, handlers, sessionManager } = feature();
  const absent = JSON.parse((await run({ action: 'read' })).content[0].text);
  const written = JSON.parse((await run({ action: 'write', expectedRevision: absent.revision, plan: { title: 't', steps: steps(1) } })).content[0].text);
  assert.notEqual(written.revision, absent.revision);
  const ordinary = sessionManager.appendCustomEntry('ordinary', {});
  assert.equal(JSON.parse((await run({ action: 'read' })).content[0].text).revision, written.revision);
  assert.ok(ordinary);
  for (const handler of handlers.get('session_tree')) handler({}, { sessionManager });
  const afterNavigation = JSON.parse((await run({ action: 'read' })).content[0].text);
  assert.notEqual(afterNavigation.revision, written.revision);
  assert.deepEqual(afterNavigation.plan, written.plan);
  const stale = await run({ action: 'write', expectedRevision: written.revision, plan: { title: 'x', steps: steps(1) } });
  assert.equal(stale.isError, true);
  assert.equal(JSON.parse((await run({ action: 'read' })).content[0].text).plan.title, 't');
});

test('plan cancellation and append failure leave history unchanged', async () => {
  const cancelledFeature = feature();
  const read = JSON.parse((await cancelledFeature.run({ action: 'read' })).content[0].text);
  const controller = new AbortController();
  controller.abort();
  const cancelled = await cancelledFeature.run({ action: 'write', expectedRevision: read.revision, plan: { title: 't', steps: steps(1) } }, controller.signal);
  assert.match(cancelled.content[0].text, /Cancelled before commit/);
  assert.equal(cancelledFeature.sessionManager.getBranch().filter(entry => entry.customType === planType).length, 0);
  const failing = feature();
  const failingRead = JSON.parse((await failing.run({ action: 'read' })).content[0].text);
  failing.sessionManager.appendCustomEntry = () => { throw Error('disk full'); };
  await assert.rejects(failing.run({ action: 'write', expectedRevision: failingRead.revision, plan: { title: 't', steps: steps(1) } }), /Plan storage failed/);
  assert.equal(failing.sessionManager.getBranch().filter(entry => entry.customType === planType).length, 0);
});

test('plan compare-and-append admits one of two same-token writes and separates sibling histories', async () => {
  const { run, sessionManager, append } = feature();
  const read = JSON.parse((await run({ action: 'read' })).content[0].text);
  const [left, right] = await Promise.all([
    run({ action: 'write', expectedRevision: read.revision, plan: { title: 'Left', steps: steps(1) } }),
    run({ action: 'write', expectedRevision: read.revision, plan: { title: 'Right', steps: steps(1) } }),
  ]);
  const outcomes = [left, right].map(result => JSON.parse(result.content[0].text));
  assert.equal(outcomes.filter(state => state.conflict === true).length, 1);
  assert.equal(sessionManager.getBranch().filter(entry => entry.customType === planType).length, 1);
  const winner = outcomes.find(state => state.conflict !== true);
  assert.equal(['Left', 'Right'].includes(winner.plan.title), true);
  const firstBranch = sessionManager.getLeafId();
  sessionManager.resetLeaf();
  append({ version: 1, plan: { title: 'Sibling', steps: steps(1) } });
  const sibling = JSON.parse((await run({ action: 'read' })).content[0].text);
  sessionManager.branch(firstBranch);
  const original = JSON.parse((await run({ action: 'read' })).content[0].text);
  assert.notEqual(sibling.revision, original.revision);
  assert.equal(sibling.plan.title, 'Sibling');
  assert.equal(original.plan.title, winner.plan.title);
});

test('plan context replaces duplicates and states absent, cleared, and unsupported explicitly', async () => {
  const { plan, ctx, run, append } = feature();
  const message = content => ({ role: 'custom', customType: 'pi-mstack/plan-context', content, display: false, timestamp: 1 });
  const injected = plan.inject(ctx, [{ role: 'user', content: 'task', timestamp: 1 }, message('stale')]);
  assert.equal(injected.length, 2);
  assert.match(injected[1].content, /"state":"absent"/);
  const absent = JSON.parse((await run({ action: 'read' })).content[0].text);
  append({ version: 9, plan: null });
  assert.match(plan.inject(ctx, [])[0].content, /"state":"unsupported"/);
  const unsupported = JSON.parse((await run({ action: 'read' })).content[0].text);
  const written = JSON.parse((await run({ action: 'write', expectedRevision: unsupported.revision, plan: { title: 'Keep <draft>', steps: steps(1) } })).content[0].text);
  const present = plan.inject(ctx, [])[0].content;
  assert.match(present, /"title":"Keep \\u003cdraft\\u003e"/);
  assert.equal(present.includes('<'), false);
  const cleared = JSON.parse((await run({ action: 'clear', expectedRevision: written.revision })).content[0].text);
  assert.equal(cleared.state, 'cleared');
  assert.match(plan.inject(ctx, [])[0].content, /"state":"cleared"/);
  assert.notEqual(absent.revision, unsupported.revision);
});

const serialized = value => JSON.stringify(value).replaceAll('<', '\\u003c').replaceAll('>', '\\u003e');
const outputBoundaryPlan = () => {
  const plan = { title: 't', steps: [1024, 1024, 900, 1].map((count, i) => ({ id: `s${i}`, text: i === 3 ? 'x' : '<'.repeat(count), status: 'pending' })) };
  plan.steps[3].text += 'x'.repeat(18 * 1024 - Buffer.byteLength(serialized(plan)));
  return plan;
};

test('escaped plan output admission accepts the exact budget and rejects one byte over before append', async () => {
  const f = feature();
  const absent = JSON.parse((await f.run({ action: 'read' })).content[0].text);
  const plan = outputBoundaryPlan();
  assert.equal(Buffer.byteLength(serialized(plan)), 18 * 1024);
  assert.ok(Buffer.byteLength(JSON.stringify({ version: 1, plan })) < 16 * 1024);
  const saved = await f.run({ action: 'write', expectedRevision: absent.revision, plan });
  assert.deepEqual(JSON.parse(saved.content[0].text).plan, plan);
  const token = JSON.parse(saved.content[0].text).revision;
  for (const params of [{ action: 'read' }, { action: 'write', expectedRevision: token, plan }, { action: 'clear', expectedRevision: absent.revision }]) {
    const reply = await f.run(params);
    assert.ok(Buffer.byteLength(reply.content[0].text) <= 20 * 1024);
  }
  assert.ok(Buffer.byteLength(f.plan.inject(f.ctx, [])[0].content) <= 20 * 1024);
  const oversized = structuredClone(plan);
  oversized.steps[3].text += 'x';
  assert.equal(Buffer.byteLength(serialized(oversized)), 18 * 1024 + 1);
  await assert.rejects(f.run({ action: 'write', expectedRevision: token, plan: oversized }), /serialized plan/i);
  assert.equal(f.sessionManager.getBranch().filter(e => e.customType === planType).length, 1);
  f.append({ version: 1, plan: oversized });
  assert.equal(JSON.parse((await f.run({ action: 'read' })).content[0].text).state, 'unsupported');
  assert.ok(Buffer.byteLength(f.plan.inject(f.ctx, [])[0].content) <= 20 * 1024);
  const state = JSON.parse((await f.run({ action: 'read' })).content[0].text);
  assert.ok(Buffer.byteLength((await f.run({ action: 'clear', expectedRevision: state.revision })).content[0].text) <= 20 * 1024);
});

test('angle-heavy stored snapshots cannot bypass output admission', async () => {
  const f = feature();
  const plan = { title: 't', steps: steps(15, 1024).map(step => ({ ...step, text: '<'.repeat(1024) })) };
  assert.ok(Buffer.byteLength(JSON.stringify({ version: 1, plan })) < 16 * 1024);
  const token = JSON.parse((await f.run({ action: 'read' })).content[0].text).revision;
  await assert.rejects(f.run({ action: 'write', expectedRevision: token, plan }), /serialized plan/i);
  assert.equal(f.sessionManager.getBranch().filter(e => e.customType === planType).length, 0);
  f.append({ version: 1, plan });
  const read = await f.run({ action: 'read' });
  assert.equal(JSON.parse(read.content[0].text).state, 'unsupported');
  assert.ok(Buffer.byteLength(read.content[0].text) <= 20 * 1024);
  assert.ok(Buffer.byteLength(f.plan.inject(f.ctx, [])[0].content) <= 20 * 1024);
});

test('huge unknown keys never enter diagnostics and malformed latest entries mask older plans', async () => {
  const f = feature();
  f.append({ version: 1, plan: { title: 'Older valid plan', steps: steps(1) } });
  const key = 'UNTRUSTED_KEY'.repeat(5000);
  const malformed = [
    { version: 1, plan: null, [key]: true },
    { version: 1, plan: { title: 'bad', steps: steps(1), [key]: true } },
    { version: 1, plan: { title: 'bad', steps: [{ ...steps(1)[0], [key]: true }] } },
  ];
  for (const data of malformed) {
    f.append(data);
    const reply = await f.run({ action: 'read' });
    const state = JSON.parse(reply.content[0].text);
    assert.equal(state.state, 'unsupported');
    assert.ok(Buffer.byteLength(state.diagnostic) <= 128);
    assert.equal(reply.content[0].text.includes('UNTRUSTED_KEY'), false);
    assert.equal(reply.content[0].text.includes('Older valid plan'), false);
    const context = f.plan.inject(f.ctx, [])[0].content;
    assert.ok(Buffer.byteLength(context) <= 20 * 1024);
    assert.equal(context.includes('UNTRUSTED_KEY'), false);
    const conflict = await f.run({ action: 'clear', expectedRevision: 'stale' });
    assert.equal(JSON.parse(conflict.content[0].text).state, 'unsupported');
    assert.ok(Buffer.byteLength(conflict.content[0].text) <= 20 * 1024);
  }
});

test('revision stays bounded with long native session and entry IDs and still separates identities', async () => {
  const id = 'native-session-'.repeat(5000) + 'x';
  const f = feature(ownPath, true, id);
  assert.equal(f.sessionManager.getSessionId(), id);
  const first = JSON.parse((await f.run({ action: 'read' })).content[0].text);
  assert.ok(Buffer.byteLength(first.revision) <= 1024);
  const written = JSON.parse((await f.run({ action: 'write', expectedRevision: first.revision, plan: { title: 'Long ID', steps: steps(1) } })).content[0].text);
  f.sessionManager.newSession({ id: id + 'sibling' });
  const stale = JSON.parse((await f.run({ action: 'clear', expectedRevision: written.revision })).content[0].text);
  assert.equal(stale.conflict, true);
  f.sessionManager.getBranch = () => [{ type: 'custom', customType: planType, id: 'entry'.repeat(10000), data: { version: 1, plan: null } }];
  const longEntry = JSON.parse((await f.run({ action: 'read' })).content[0].text);
  assert.ok(Buffer.byteLength(longEntry.revision) <= 1024);
  assert.notEqual(longEntry.revision, stale.revision);
  assert.notEqual(first.revision, stale.revision);
});

test('a lost successful result is recovered by reread and an old-token retry never appends twice', async () => {
  const f = feature();
  const before = JSON.parse((await f.run({ action: 'read' })).content[0].text);
  const plan = { title: 'Committed despite lost response', steps: steps(1) };
  await f.run({ action: 'write', expectedRevision: before.revision, plan });
  const reread = JSON.parse((await f.run({ action: 'read' })).content[0].text);
  assert.deepEqual(reread.plan, plan);
  assert.notEqual(reread.revision, before.revision);
  const retry = await f.run({ action: 'write', expectedRevision: before.revision, plan });
  assert.equal(retry.isError, true);
  assert.equal(JSON.parse(retry.content[0].text).revision, reread.revision);
  assert.equal(f.sessionManager.getBranch().filter(e => e.customType === planType).length, 1);
});

test('stored snapshot admission accepts exactly 16 KiB and rejects one byte more independently of escaped output', async () => {
  const f = feature();
  const plan = { title: 't', steps: steps(16, 1024) };
  plan.steps.at(-1).text = 'x';
  plan.steps.at(-1).text += 'x'.repeat(16 * 1024 - Buffer.byteLength(JSON.stringify({ version: 1, plan })));
  assert.equal(Buffer.byteLength(JSON.stringify({ version: 1, plan })), 16 * 1024);
  assert.ok(Buffer.byteLength(serialized(plan)) < 18 * 1024);
  const absent = JSON.parse((await f.run({ action: 'read' })).content[0].text);
  const saved = JSON.parse((await f.run({ action: 'write', expectedRevision: absent.revision, plan })).content[0].text);
  assert.deepEqual(saved.plan, plan);
  plan.steps.at(-1).text += 'x';
  await assert.rejects(f.run({ action: 'write', expectedRevision: saved.revision, plan }), /snapshot exceeds 16384/);
  assert.equal(f.sessionManager.getBranch().filter(entry => entry.customType === planType).length, 1);
});
