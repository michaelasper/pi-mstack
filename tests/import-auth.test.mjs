import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { ModelRuntime, ModelRegistry } from '@earendil-works/pi-coding-agent';
import pstack from '../extensions/pstack/index.ts';
import { freshImportAvailability, inspectRoles } from '../extensions/pstack/config.ts';

const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const gate = () => ({ ...deferred(), entered: deferred() });

for (const boundary of ['preview', 'save']) for (const inherited of [false, true]) test(`import rejects revoked native auth with superseded ${boundary} refresh, inherited ${inherited}`, { timeout: 15000 }, async t => {
  const dir = mkdtempSync(join(tmpdir(), 'mstack-live-auth-'));
  const previous = process.env.PI_CODING_AGENT_DIR;
  process.env.PI_CODING_AGENT_DIR = dir;
  t.after(() => { if (previous === undefined) delete process.env.PI_CODING_AGENT_DIR; else process.env.PI_CODING_AGENT_DIR = previous; rmSync(dir, { recursive: true, force: true }); });
  let revoked = false, currentGate;
  const model = { id: 'other', name: 'other', api: 'openai-completions', provider: 'team/custom', baseUrl: 'http://127.0.0.1:1', reasoning: false, input: ['text'], cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 1000, maxTokens: 100 };
  const provider = {
    id: model.provider, name: 'Gated test provider',
    auth: { apiKey: { name: 'Test key', check: async () => {
      const g = currentGate;
      if (g) { g.entered.resolve(); await g.promise; }
      return revoked ? undefined : { type: 'api_key', source: 'test' };
    }, resolve: async () => { throw Error('Import must not resolve credentials'); } } },
    getModels: () => [model], stream: () => { throw Error('unused'); }, streamSimple: () => { throw Error('unused'); },
  };
  const runtime = await ModelRuntime.create({ authPath: join(dir, 'auth.json'), modelsPath: join(dir, 'models.json'), refreshOnCreate: false, allowModelNetwork: false, providers: [] });
  const registry = new ModelRegistry(runtime);
  registry.registerProvider(provider);
  await registry.refresh({ allowNetwork: false, signal: AbortSignal.timeout(5000) });
  assert.ok(registry.getAvailable().some(m => m.provider === model.provider));
  const first = gate(), second = gate();
  t.after(() => { first.resolve(); second.resolve(); });
  const revoke = () => { revoked = true; currentGate = first; };
  let confirmations = 0;
  const notices = [], commands = new Map();
  const ownPath = resolve('extensions/pstack/index.ts');
  const pi = { on() {}, registerCommand(name, command) { commands.set(name, command); }, getCommands() { return [
    ...[...commands.keys()].map(name => ({ name, source: 'extension', sourceInfo: { path: ownPath } })),
    ...['poteto-mode', 'setup-pstack'].map(name => ({ name: `skill:${name}`, source: 'skill', sourceInfo: { path: resolve(`generated/skills/${name}/SKILL.md`) } })),
  ]; } };
  const child = process.env.PI_SUBAGENT_CHILD;
  delete process.env.PI_SUBAGENT_CHILD;
  try { pstack(pi); } finally { if (child !== undefined) process.env.PI_SUBAGENT_CHILD = child; }
  mkdirSync(join(dir, 'pstack'));
  const path = join(dir, 'pstack/models.json'), original = '{"version":"pi-mstack/1","roles":{}}\n';
  writeFileSync(path, original);
  const source = join(dir, 'roles'); writeFileSync(source, `bug-fix: ${inherited ? 'auto' : 'team/custom/other:off'}`);
  const ctx = { cwd: dir, hasUI: true, model: model, thinkingLevel: 'off', scopedModels: [], modelRegistry: registry, ui: {
    notify(message) { notices.push(message); }, async confirm() { confirmations++; revoke(); return true; },
  } };
  if (boundary === 'preview') revoke();
  const importing = commands.get('setup-pstack').handler(`import ${source}`, ctx);
  await first.entered.promise;
  currentGate = second;
  registry.registerProvider(provider);
  await second.entered.promise;
  currentGate = undefined;
  first.resolve();
  await importing;
  assert.equal(readFileSync(path, 'utf8'), original, 'revoked credentials must not authorize a write');
  assert.equal(confirmations, boundary === 'preview' ? 0 : 1, 'revoked credentials must not authorize preview');
  assert.ok(notices.some(text => /Import blocked|preview changed or became invalid/.test(text)), notices.join('\n'));
  if (boundary === 'save' && inherited) {
    currentGate = gate();
    try { await assert.rejects(freshImportAvailability({ version: 'pi-mstack/1', roles: {} }, ctx), /Fresh authentication check failed.*Configuration unchanged.*Retry/); }
    finally { currentGate.resolve(); }
  }
});

test('fresh import restriction preserves rendering, ambiguity and thinking validation', async () => {
  const model = { provider: 'team/custom', id: 'other', reasoning: false };
  const config = { version: 'pi-mstack/1', roles: {} };
  const calls = [];
  const ctx = { model, thinkingLevel: 'off', scopedModels: [], modelRegistry: {
    getAvailable: () => [model],
    async getAvailableOfType(type, provider, { signal }) { calls.push({ type, provider }); assert.ok(signal instanceof AbortSignal); return [model]; },
  } };
  const available = await freshImportAvailability(config, ctx);
  assert.deepEqual(calls, [{ type: 'chat', provider: 'team/custom' }]);
  assert.deepEqual(inspectRoles(config, ctx, available), inspectRoles(config, ctx));
  assert.equal(inspectRoles(config, ctx, new Set()).valid, false);
  assert.equal(inspectRoles(config, { ...ctx, thinkingLevel: 'high' }, available).valid, false);
  ctx.modelRegistry.getAvailable = () => [model, { ...model, provider: 'team', id: 'custom/other' }];
  assert.match(inspectRoles(config, ctx, available).table, /ambiguous combined model ID/);
  ctx.modelRegistry.getAvailableOfType = async () => { throw Error('test failure'); };
  await assert.rejects(freshImportAvailability(config, ctx), /Fresh authentication check failed.*Configuration unchanged.*Retry/);
});
