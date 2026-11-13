import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { SessionManager } from '@earendil-works/pi-coding-agent';
import { registerNaming, nameSession, taskName } from '../extensions/pstack/naming.ts';

const environment = { kind: 'valid', naming: 'model', glossary: [], sources: [] };
function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'mstack-title-unit-'));
  mkdirSync(join(dir, 'pstack'));
  writeFileSync(join(dir, 'pstack/environment.json'), JSON.stringify({ version: 'pi-mstack/environment/1', naming: 'model' }));
  const old = process.env.PI_CODING_AGENT_DIR, child = process.env.PI_SUBAGENT_CHILD;
  process.env.PI_CODING_AGENT_DIR = dir; delete process.env.PI_SUBAGENT_CHILD;
  t.after(() => {
    if (old === undefined) delete process.env.PI_CODING_AGENT_DIR; else process.env.PI_CODING_AGENT_DIR = old;
    if (child === undefined) delete process.env.PI_SUBAGENT_CHILD; else process.env.PI_SUBAGENT_CHILD = child;
    rmSync(dir, { recursive: true, force: true });
  });
  const manager = SessionManager.inMemory();
  let tool, active = ['read'];
  const pi = {
    registerTool: value => { tool = value; }, getActiveTools: () => active, setActiveTools: names => { active = names; },
    appendEntry: (kind, value) => manager.appendCustomEntry(kind, value), setSessionName: name => manager.appendSessionInfo(name),
  };
  const ctx = { sessionManager: manager, cwd: dir, isProjectTrusted: () => false, hasUI: false };
  const naming = registerNaming(pi);
  return { pi, ctx, naming, manager, tool, active: () => active, execute: (title = 'Repair parser error recovery', signal) => tool.execute('test', { title }, signal, undefined, ctx) };
}

test('title mutation failure stays sealed and model policy never uses deterministic goal naming', async t => {
  const f = fixture(t);
  nameSession(f.pi, f.ctx, 'ABC-123', environment);
  assert.equal(f.manager.getEntries().length, 0);
  f.naming.accept(f.ctx, 'ABC-123 repair parser', environment);
  f.pi.setSessionName = () => { throw Error('native failure'); };
  await assert.rejects(f.execute(), /native failure/);
  assert.equal(f.manager.getEntries().filter(e => e.customType === 'pi-mstack/naming-attempt').length, 1);
  assert.deepEqual(f.active(), ['read']);
  f.naming.accept(f.ctx, 'retry repair parser', environment);
  await assert.rejects(f.execute(), /no longer eligible/);
});

test('title offers only change their own tool membership and recheck identity and cancellation', async t => {
  const f = fixture(t);
  assert.equal(f.tool.defaultActive, false); assert.equal(f.tool.exposure, 'model-only'); assert.equal(f.tool.executionMode, 'sequential');
  f.naming.accept(f.ctx, 'ABC-123 repair parser', environment);
  f.pi.setActiveTools([...f.active(), 'write']); f.naming.clear();
  assert.deepEqual(f.active(), ['read', 'write']);
  await assert.rejects(f.execute(), /no longer eligible/);
  f.naming.accept(f.ctx, 'ABC-123 repair parser', environment);
  await assert.rejects(f.execute(undefined, AbortSignal.abort()), /no longer eligible/);
  f.naming.accept(f.ctx, 'ABC-123 repair parser', environment);
  f.ctx.sessionManager = SessionManager.inMemory();
  await assert.rejects(f.execute(), /no longer eligible/);
  assert.equal(f.manager.getEntries().length, 0);
});

for (const ticket of ['A-1', 'abc-123', 'AB-0']) {
  test(`generated titles reject ${ticket} without broadening accepted-input extraction`, async t => {
    const f = fixture(t);
    const raw = `${ticket} repair parser`;
    assert.equal(taskName(raw), raw);
    f.naming.accept(f.ctx, raw, environment);
    await assert.rejects(f.execute(`Fix ${ticket} parser bug today`), /without ticket identifiers/);
    assert.equal(f.manager.getEntries().length, 0);
    await f.execute();
    assert.equal(f.manager.getSessionName(), 'Repair parser error recovery');
  });
}
