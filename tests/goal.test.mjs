import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SessionManager } from '@earendil-works/pi-coding-agent';
import { parseGoal, branchGoal } from '../extensions/pstack/goal.ts';
import { taskName, nameSession } from '../extensions/pstack/naming.ts';

test('goal grammar and ancestry retain clear and unsupported states', () => {
  assert.deepEqual(parseGoal(''), { action: 'show' });
  assert.deepEqual(parseGoal('--clear'), { action: 'set', text: null });
  assert.deepEqual(parseGoal('-- --clear'), { action: 'set', text: '--clear' });
  assert.throws(() => parseGoal('--wat'));
  assert.throws(() => parseGoal('x\x00'));
  assert.throws(() => parseGoal('é'.repeat(2049)));
  assert.equal(parseGoal('-- ' + 'é'.repeat(2048)).text.length, 2048);
  const sm = SessionManager.inMemory();
  assert.equal(branchGoal(sm.getBranch()), undefined);
  sm.appendCustomEntry('pi-mstack/goal', { version: 1, text: 'original' }); const root = sm.getLeafId();
  sm.appendCustomEntry('pi-mstack/goal', { version: 2, text: 'unknown' });
  assert.equal(branchGoal(sm.getBranch()), 'unsupported');
  sm.appendCustomEntry('pi-mstack/goal', { version: 1, text: null });
  assert.deepEqual(branchGoal(sm.getBranch()), { version: 1, text: null });
  sm.branch(root); assert.deepEqual(branchGoal(sm.getBranch()), { version: 1, text: 'original' });
});

test('local task naming prefers one distinct Jira ID, caps code points, and seals session-wide', t => {
  const child = process.env.PI_SUBAGENT_CHILD;
  delete process.env.PI_SUBAGENT_CHILD;
  t.after(() => { if (child === undefined) delete process.env.PI_SUBAGENT_CHILD; else process.env.PI_SUBAGENT_CHILD = child; });
  assert.equal(taskName('Please fix ABC-123 now, ABC-123'), 'ABC-123');
  assert.equal(taskName('Compare ABC-123 and XYZ-2'), 'Compare ABC-123 and XYZ-2');
  assert.equal(taskName('  Fix\n the parser\t today '), 'Fix the parser today');
  assert.equal([...taskName('🙂'.repeat(100))].length, 80);
  const sm = SessionManager.inMemory();
  const ctx = { sessionManager: sm }; const events = [];
  const pi = { appendEntry: (type, data) => { events.push(type); sm.appendCustomEntry(type, data); }, setSessionName: name => { events.push('name'); sm.appendSessionInfo(name); } };
  const env = { kind: 'valid', naming: 'task' };
  nameSession(pi, ctx, 'ABC-123', env);
  assert.deepEqual(events, ['pi-mstack/naming-attempt', 'name']);
  sm.resetLeaf(); nameSession(pi, ctx, 'XYZ-1', env); assert.equal(events.length, 2);
  const clear = SessionManager.inMemory(); clear.appendSessionInfo('');
  nameSession(pi, { sessionManager: clear }, 'no rename', env); assert.equal(events.length, 2);
  const empty = { sessionManager: SessionManager.inMemory() };
  nameSession(pi, empty, 'off', { kind: 'valid', naming: 'off' });
  nameSession(pi, empty, 'invalid', { kind: 'invalid' }); assert.equal(events.length, 2);
  process.env.PI_SUBAGENT_CHILD = '1'; nameSession(pi, empty, 'CHILD-12', env); assert.equal(events.length, 2);
});
