import { parseLegacyRoles, parseImportPath } from '../extensions/pstack/import.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { inspectRoles, roles, parseConfig, splitSelector, loadConfig, saveConfig, roleData, modelChoices, policyStatus } from '../extensions/pstack/config.ts';
import { enabledOnBranch } from '../extensions/pstack/index.ts';
import { SessionManager } from '@earendil-works/pi-coding-agent';

test('versioned role boundary preserves full IDs, ordered repeated panels and invalid choices', () => {
  assert.deepEqual(splitSelector('provider/owner/model:high'), { kind: 'exact', combinedId: 'provider/owner/model', thinking: 'high' });
  assert.throws(() => parseConfig({ version: 1, roles: {} }), /Invalid/);
  assert.throws(() => parseConfig({ version: 'pi-mstack/1', roles: { unknown: 'auto' } }), /Unknown/);
  assert.throws(() => parseConfig({ version: 'pi-mstack/1', roles: { 'arena runners': [] } }), /Invalid/);
  const input = { version: 'pi-mstack/1', roles: { 'arena runners': ['auto', 'auto'], 'how explorer': 'provider/owner/model:high' } };
  assert.deepEqual(parseConfig(input), input);
  for (const potetoModeDefault of [true, false]) assert.deepEqual(parseConfig({ ...input, potetoModeDefault }), { ...input, potetoModeDefault });
  for (const potetoModeDefault of ['on', 'false', 1, null, {}]) assert.throws(() => parseConfig({ ...input, potetoModeDefault }), /Invalid/);
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
    assert.deepEqual(splitSelector(selector), { kind: 'exact', combinedId: `openrouter/${id}`, thinking });
    const state = { kind: 'valid', config: parseConfig({ version: 'pi-mstack/1', roles: { 'how explorer': selector } }) };
    const ctx = { model, thinkingLevel: 'off', scopedModels: [], modelRegistry: { getAvailable: () => [model] } };
    assert.ok(roleData(state, ctx).includes(`how explorer: ${selector} [registry-valid;`));
    ctx.modelRegistry.getAvailable = () => [{ ...model, id: id.toUpperCase() }];
    assert.ok(roleData(state, ctx).includes(`how explorer: ${selector} [BLOCKED, unavailable or unauthenticated]`));
  }
  assert.deepEqual(splitSelector('provider/model:high:off'), { kind: 'exact', combinedId: 'provider/model:high', thinking: 'off' });
  for (const value of ['provider/', 'provider/:high', 'provider/model name']) assert.throws(() => splitSelector(value), /Invalid/);
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
  assert.equal(enabledOnBranch(manager.getBranch(), true), true);
  manager.appendCustomEntry('pi-mstack/mode', { version: 1, enabled: false });
  assert.equal(enabledOnBranch(manager.getBranch(), true), false);
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

test('custom provider combined IDs resolve exactly and ambiguous IDs block', () => {
  for (const provider of ['team/custom', 'https://example.test/v1', 'provider:region']) {
    const model = { provider, id: 'owner/model:batch', reasoning: false };
    const selector = `${provider}/${model.id}:off`;
    const ctx = { model, thinkingLevel: 'off', scopedModels: [], modelRegistry: { getAvailable: () => [model] } };
    const config = parseConfig({ version: 'pi-mstack/1', roles: { 'how explorer': selector, 'how explainer': 'https://missing.test/v1/model:off' } });
    const table = roleData({ kind: 'valid', config }, ctx);
    assert.ok(table.includes(`how explorer: ${selector} [registry-valid;`));
    assert.ok(table.includes(`bug-fix: ${selector} [registry-valid;`));
    assert.match(table, /https:\/\/missing.test\/v1\/model:off \[BLOCKED, unavailable/);
    assert.deepEqual(modelChoices(ctx).map(m => parseConfig({ version: 'pi-mstack/1', roles: { 'how explorer': `${m.provider}/${m.id}:off` } })), [parseConfig({ version: 'pi-mstack/1', roles: { 'how explorer': selector } })]);
  }
  const models = [{ provider: 'team/custom', id: 'model', reasoning: false }, { provider: 'team', id: 'custom/model', reasoning: false }];
  const ctx = { model: models[0], thinkingLevel: 'off', scopedModels: [], modelRegistry: { getAvailable: () => models } };
  assert.match(roleData({ kind: 'valid', config: { version: 'pi-mstack/1', roles: {} } }, ctx), /BLOCKED, ambiguous combined model ID/);
});

test('legacy layout imports exact scalars and ordered panels without translating models', () => {
  const expected = Object.fromEntries(roles.map(r => [r.name, r.panel ? ['auto', 'provider/model:high:off', 'auto'] : 'provider/model:batch']));
  const text = '\uFEFF---\r\ndescription: legacy\r\nalwaysApply: true\r\n---\r\n# budget: large (xhigh)\r\n' + roles.map(r => `${r.name}: ${Array.isArray(expected[r.name]) ? expected[r.name].join(', ') : expected[r.name]}`).join('\r\n');
  assert.deepEqual(parseLegacyRoles(text), expected);
  assert.deepEqual(parseLegacyRoles('arena runners: auto\nfeature, refactoring: https://example.test/v1/model:off\nreflect judgment, divergent, synthesizer: inherit-parent'), {
    'arena runners': ['auto'], 'feature, refactoring': 'https://example.test/v1/model:off', 'reflect judgment, divergent, synthesizer': 'inherit-parent',
  });
  assert.deepEqual(parseLegacyRoles('bug-fix: provider/id,comma#literal'), { 'bug-fix': 'provider/id,comma#literal' });
  for (const [text, line, detail] of [
    ['', 1, /No role/], ['# budget: high', 1, /No role/], ['---\nx', 1, /Unclosed/],
    ['\n---\n---', 2, /Expected/], ['```\nbug-fix: auto\n```', 1, /Expected/],
    ['bug-fix: auto\nhow critics: auto', 2, /retired/], ['bug-fix: auto\nbug-fix: auto', 2, /Duplicate/],
    ['Bug-fix: auto', 1, /Unknown/], ['- bug-fix: auto', 1, /Unknown/],
    ['bug-fix: claude-opus-5-5-xhigh', 1, /No model translation/], ['bug-fix: opus xhigh', 1, /No model translation/],
    ['arena runners: auto,', 1, /arena runners/], ['bug-fix: ', 1, /bug-fix/],
    ['bug-fix: auto\r', 1, /Standalone/], ['\uFEFF\uFEFFbug-fix: auto', 1, /Unknown/],
    ['\u00a0bug-fix: auto', 1, /Unknown/], ['bug-fix: auto\n---', 2, /Expected/],
  ]) assert.throws(() => parseLegacyRoles(text), error => error.message.includes(`source:${line}:`) && detail.test(error.message), text);
});

test('import path is one literal path with strict optional quotes', () => {
  for (const [args, expected] of [['import a b', 'a b'], ['import "~/a b"', '~/a b'], ["import 'a b'", 'a b'], [' import\ta ', 'a'], ['import "$HOME/*"', '$HOME/*'], ['import " a "', ' a ']]) assert.equal(parseImportPath(args), expected);
  for (const args of ['import', 'other a', 'import ""', 'import "a', 'import "a" junk', 'import "a" junk"', 'import a"', 'import ~someone/a', 'import a\nb', 'import a\0b']) assert.throws(() => parseImportPath(args), /Usage/);
});

test('inspector pins rendered role contract and validates every effective seat', () => {
  const model = { provider: 'provider', id: 'model', reasoning: true };
  const ctx = { model, thinkingLevel: 'high', scopedModels: [], modelRegistry: { getAvailable: () => [model] } };
  const config = { version: 'pi-mstack/1', roles: {} };
  const seat = 'provider/model:high [registry-valid; native preflight required]';
  const golden = 'Pass exact effective selectors to native subagent. Native preflight required. Do not retry rejected selections by omission or substitution.\n' + roles.map(r => `${r.name}: ${r.panel ? `${seat} | ${seat} [repeated samples, not multi-model diversity]` : seat}`).join('\n');
  assert.deepEqual(inspectRoles(config, ctx), { valid: true, table: golden });
  assert.equal(roleData({ kind: 'valid', config }, ctx), golden);
  assert.match(policyStatus({ subagents: { maxThinking: 'off' } }, false, golden), /Potential thinking-ceiling conflict/);
  for (const changed of [
    { ...ctx, model: undefined },
    { ...ctx, modelRegistry: { getAvailable: () => [] } },
    { ...ctx, modelRegistry: { getAvailable: () => [model, model] } },
    { ...ctx, modelRegistry: { getAvailable: () => [{ ...model, reasoning: false }] } },
  ]) assert.equal(inspectRoles(config, changed).valid, false);
  const explicit = { ...config, roles: Object.fromEntries(roles.map(r => [r.name, r.panel ? ['provider/model:off'] : 'provider/model:off'])) };
  assert.equal(inspectRoles(explicit, { ...ctx, model: undefined }).valid, true);
  assert.equal(inspectRoles({ ...config, roles: { 'bug-fix': 'provider/missing' } }, ctx).valid, false);
  const outside = inspectRoles(config, { ...ctx, scopedModels: [{ model: { ...model, id: 'other' } }] });
  assert.equal(outside.valid, true);
  assert.match(outside.table, /outside session picker scope/);
});
