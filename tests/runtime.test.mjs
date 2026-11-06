import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parseConfig, splitSelector, loadConfig, saveConfig, roleData, modelChoices, policyStatus } from '../extensions/pstack/config.ts';
import { enabledOnBranch } from '../extensions/pstack/index.ts';
import { SessionManager } from '@earendil-works/pi-coding-agent';

test('versioned role boundary preserves full IDs, ordered repeated panels and invalid choices', () => {
  assert.deepEqual(splitSelector('provider/owner/model:high'), { kind: 'exact', provider: 'provider', id: 'owner/model', thinking: 'high' });
  assert.throws(() => parseConfig({ version: 1, roles: {} }), /Invalid/);
  assert.throws(() => parseConfig({ version: 'pi-mstack/1', roles: { unknown: 'auto' } }), /Unknown/);
  assert.throws(() => parseConfig({ version: 'pi-mstack/1', roles: { 'arena runners': [] } }), /Invalid/);
  const input = { version: 'pi-mstack/1', roles: { 'arena runners': ['auto', 'auto'], 'how explorer': 'provider/owner/model:high' } };
  assert.deepEqual(parseConfig(input), input);
});

test('setup writes atomically with restrictive mode and refuses stale writes', t => {
  const dir = mkdtempSync(join(tmpdir(), 'mstack-config-')); t.after(() => rmSync(dir, { recursive: true, force: true }));
  const path = join(dir, 'models.json');
  const config = parseConfig({ version: 'pi-mstack/1', roles: {} });
  saveConfig(path, config, undefined);
  assert.equal(statSync(path).mode & 0o777, 0o600);
  assert.throws(() => saveConfig(path, config, undefined), /changed/);
  writeFileSync(path, '{}');
  assert.equal(loadConfig(path).kind, 'invalid');
});

test('missing config defaults but existing empty or whitespace config is invalid', t => {
  const dir = mkdtempSync(join(tmpdir(), 'mstack-empty-')); t.after(() => rmSync(dir, { recursive: true, force: true }));
  const path = join(dir, 'models.json');
  assert.deepEqual(loadConfig(path), { kind: 'valid', original: undefined, config: { version: 'pi-mstack/1', roles: {} } });
  for (const bytes of ['', ' \n']) {
    writeFileSync(path, bytes);
    assert.equal(loadConfig(path).kind, 'invalid');
    assert.match(roleData(loadConfig(path), {}), /Configuration blocked/);
    assert.equal(readFileSync(path, 'utf8'), bytes);
  }
});

test('colon model IDs preserve all but a recognized final thinking suffix and require exact authentication', () => {
  const id = 'anthropic/claude-opus-5.5:batch';
  const model = { provider: 'openrouter', id, reasoning: true };
  for (const thinking of [undefined, 'high']) {
    const selector = `openrouter/${id}${thinking ? ':' + thinking : ''}`;
    assert.deepEqual(splitSelector(selector), { kind: 'exact', provider: 'openrouter', id, thinking });
    const state = { kind: 'valid', config: parseConfig({ version: 'pi-mstack/1', roles: { 'how explorer': selector } }) };
    const ctx = { model, thinkingLevel: 'off', scopedModels: [], modelRegistry: { getAvailable: () => [model] } };
    assert.ok(roleData(state, ctx).includes(`how explorer: ${selector} [registry-valid;`));
    ctx.modelRegistry.getAvailable = () => [{ ...model, id: id.toUpperCase() }];
    assert.ok(roleData(state, ctx).includes(`how explorer: ${selector} [BLOCKED, unavailable or unauthenticated]`));
  }
  assert.deepEqual(splitSelector('provider/model:high:off'), { kind: 'exact', provider: 'provider', id: 'model:high', thinking: 'off' });
  for (const value of ['provider/', 'provider/:high', 'provider/model name', 'provider:model/id']) assert.throws(() => splitSelector(value), /Invalid/);
});

test('existing configuration lock refuses writes and explains safe manual recovery', t => {
  const dir = mkdtempSync(join(tmpdir(), 'mstack-lock-')); t.after(() => rmSync(dir, { recursive: true, force: true }));
  const path = join(dir, 'models.json');
  writeFileSync(path, 'original');
  mkdirSync(path + '.lock');
  const config = parseConfig({ version: 'pi-mstack/1', roles: {} });
  assert.throws(() => saveConfig(path, config, 'original'), error => {
    assert.ok(error.message.includes(path + '.lock'));
    assert.match(error.message, /stale|ambiguous/i);
    assert.match(error.message, /no setup writer is running/i);
    return true;
  });
  assert.equal(readFileSync(path, 'utf8'), 'original');
  assert.ok(statSync(path + '.lock').isDirectory());
  rmSync(path + '.lock', { recursive: true });
  saveConfig(path, config, 'original');
  assert.equal(loadConfig(path).kind, 'valid');
});

test('mode reduction follows only ancestors, including explicit off', () => {
  const manager = SessionManager.inMemory();
  manager.appendCustomEntry('pi-mstack/mode', { version: 1, enabled: true });
  const on = manager.getLeafId();
  manager.appendCustomEntry('pi-mstack/mode', { version: 1, enabled: false });
  assert.equal(enabledOnBranch(manager.getBranch()), false);
  manager.branch(on);
  assert.equal(enabledOnBranch(manager.getBranch()), true);
  manager.resetLeaf();
  assert.equal(enabledOnBranch(manager.getBranch()), false);
});

test('picker scope and role status are distinct, explicit parent defeats omission', () => {
  const model = { provider: 'provider', id: 'owner/model', reasoning: false };
  const other = { ...model, id: 'other' };
  const ctx = { model, thinkingLevel: 'off', scopedModels: [{ model: other }], modelRegistry: { getAvailable: () => [model, other] } };
  assert.deepEqual(modelChoices(ctx), [other]);
  assert.deepEqual(modelChoices({ ...ctx, scopedModels: [] }), [model, other]);
  const state = { kind: 'valid', config: parseConfig({ version: 'pi-mstack/1', roles: { 'how explorer': 'missing/model:off' } }) };
  const table = roleData(state, ctx);
  assert.match(table, /provider\/owner\/model:off/);
  assert.match(table, /outside session picker scope/);
  assert.match(table, /missing\/model:off \[BLOCKED/);
  assert.match(table, /native preflight required/i);
  assert.match(policyStatus({ subagents: { maxThinking: 'off', modelScope: { enforce: true, strict: true, allow: ['provider/other'], agents: { worker: { allow: [] } } } } }, false, 'how explorer: provider/owner/model:high [registry-valid]'), /Potential thinking-ceiling conflict/);
  assert.match(policyStatus({ subagents: { modelScope: { enforce: true, strict: true } } }, false), /Scope matching is unverified/);
});
