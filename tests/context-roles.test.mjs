import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parseRoles, mergeRoles, parseRoleRequest, prepareOperation, operationStatus } from '../extensions/pstack/context-roles.ts';
import { loadEnvironment } from '../extensions/pstack/environment-config.ts';

const operation = () => ({ effect: 'write', target: { tool: 'mcp__tracker__update', selector: 'tracker/update' }, inputs: { key: { type: 'string' }, count: { type: 'number' }, done: { type: 'boolean' } }, template: { key: { $arg: 'key' }, repeated: [{ $arg: 'key' }, { count: { $arg: 'count' }, done: { $arg: 'done' }, literal: null }] } });
const request = args => parseRoleRequest({ role: 'tracker', operation: 'update', args });
const parse = op => parseRoles({ tracker: { update: op } });
test('role compiler substitutes whole scalar values, repeats references, and preserves literals', () => {
  const registry = parse(operation());
  const call = prepareOperation(registry, request({ key: '${not code}', count: 2, done: false }));
  assert.equal(call.effect, 'write');
  assert.deepEqual(call.arguments, { key: '${not code}', repeated: ['${not code}', { count: 2, done: false, literal: null }] });
  const read = operation(); read.effect = 'read'; delete read.target.selector;
  assert.equal(prepareOperation(parse(read), request({ key: 'x', count: 0, done: true })).effect, 'read');
});

test('role schemas reject unknown fields, dangerous keys, unbounded templates and dynamic inputs', () => {
  const mutations = [
    op => { op.extra = true; }, op => { op.effect = 'execute'; }, op => { op.target.extra = true; },
    op => { op.target.tool = 'bash'; }, op => { op.target.tool = 'mcp__x__' + 'x'.repeat(256); },
    ...['tracker', 'tracker/*', '../update', 'mcp:tracker/update', '+tracker/update', 'tracker/update/path', 'tracker/../update'].map(selector => op => { op.target.selector = selector; }),
    op => { op.inputs.key.maxBytes = 2; }, op => { op.inputs.key.type = 'object'; },
    op => { op.inputs.unused = { type: 'string' }; }, op => { op.template.key = { $arg: 'absent' }; },
    op => { op.template.key.extra = true; }, op => { op.template = { $arg: 'key' }; },
    op => { op.template.key = { a: { b: { c: { d: { e: 0 } } } } }; },
    op => { op.template.key = Array(17).fill(null); },
    op => { op.template.key = Object.fromEntries(Array.from({ length: 17 }, (_, i) => ['x' + i, null])); },
    op => { op.template.key = 'é'.repeat(4097); }, op => { op.template.key = Infinity; },
    op => { op.template.key = JSON.parse('{"__proto__":1}'); },
    op => { op.template.key = { constructor: 1 }; }, op => { op.template.key = { prototype: 1 }; },
    op => { op.template.key = Array.from({ length: 16 }, () => Array(16).fill(1)); },
  ];
  for (const change of mutations) { const op = operation(); change(op); assert.throws(() => parse(op), String(change)); }
  assert.throws(() => parseRoles({ arbitrary: {} }));
  assert.throws(() => parseRoles({ tracker: { constructor: operation() } }));
  assert.throws(() => parseRoles({ tracker: Object.fromEntries(Array.from({ length: 9 }, (_, i) => ['op' + i, operation()])) }));
});

test('requests are closed, UTF-8 bounded and strictly typed; expansion is bounded separately', () => {
  const args = { key: 'x', count: 1, done: true }, registry = parse(operation());
  for (const input of [
    { role: 'tracker', operation: 'update', args, source: 'legacy', query: '' },
    { role: 'other', operation: 'update', args }, { role: 'tracker', operation: 'constructor', args },
    { role: 'tracker', operation: 'update', args: { key: { nested: true } } },
    { role: 'tracker', operation: 'update', args: { key: 'é'.repeat(4096) } },
    { role: 'tracker', operation: 'update', args: JSON.parse('{"__proto__":"x"}') },
    { role: 'tracker', operation: 'update', args: { count: NaN } },
  ]) assert.throws(() => parseRoleRequest(input));
  for (const invalid of [{ ...args, extra: true }, { key: 'x' }, { ...args, done: 'true' }, { ...args, key: null }]) assert.throws(() => prepareOperation(registry, request(invalid)));
  assert.throws(() => prepareOperation(registry, request({ ...args, key: 'x'.repeat(4100) })), /Rendered/);
  assert.throws(() => prepareOperation({}, request(args)));
});

test('role aggregation rejects collisions and applies exact project authority without changing legacy defaults', t => {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'mstack-role-config-')));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const agentDir = join(dir, 'agent'), cwd = join(dir, 'project');
  mkdirSync(join(agentDir, 'pstack'), { recursive: true }); mkdirSync(join(cwd, '.pi/pstack'), { recursive: true });
  const file = join(cwd, '.pi/pstack/environment.json'), grant = join(agentDir, 'pstack/environment-grants.json');
  const config = roles => JSON.stringify({ version: 'pi-mstack/environment/1', roles });
  const load = nativeTrusted => loadEnvironment({ agentDir, cwd, nativeTrusted, sessionId: dir, notify() {} });
  writeFileSync(join(agentDir, 'pstack/environment.json'), config({ tracker: { update: operation() } }));
  writeFileSync(file, '{MALFORMED'); assert.equal(load(true).kind, 'valid');
  writeFileSync(grant, JSON.stringify({ version: 'pi-mstack/environment-grants/1', projects: [cwd] }));
  assert.equal(load(true).kind, 'invalid'); assert.equal(load(false).kind, 'valid');
  writeFileSync(file, config({ tracker: { update: operation() } })); assert.equal(load(true).kind, 'invalid');
  writeFileSync(file, config({ docs: { search: { ...operation(), effect: 'read' } } }));
  assert.deepEqual(Object.keys(load(true).roles), ['docs', 'tracker']);
  rmSync(grant); assert.deepEqual(Object.keys(load(true).roles), ['tracker']);
  const first = parseRoles({ docs: Object.fromEntries(Array.from({ length: 8 }, (_, i) => ['op' + i, operation()])) });
  assert.throws(() => mergeRoles(first, parseRoles({ docs: { ninth: operation() } })));
});

test('doctor classification is passive and distinguishes exposure from active declarations', () => {
  for (const [exposure, active, expected] of [['direct', false, 'inactive-direct'], ['direct', true, 'callable-snapshot'], ['hidden', true, 'hidden'], ['model-only', true, 'model-only'], ['deferred', false, 'callable-snapshot'], ['codemode', false, 'callable-snapshot']]) {
    assert.equal(operationStatus('target', [{ name: 'target', exposure }], new Set(active ? ['target'] : [])), expected);
  }
  assert.equal(operationStatus('absent', [], new Set()), 'unregistered');
});

test('role dispatch rejects oversized correlation IDs and aborts stale lifetimes without success', async t => {
  const { default: context } = await import('../extensions/pstack/context.ts');
  const dir = mkdtempSync(join(tmpdir(), 'mstack-role-lifetime-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const previous = process.env.PI_CODING_AGENT_DIR; process.env.PI_CODING_AGENT_DIR = dir;
  t.after(() => { if (previous === undefined) delete process.env.PI_CODING_AGENT_DIR; else process.env.PI_CODING_AGENT_DIR = previous; });
  mkdirSync(join(dir, 'pstack'));
  writeFileSync(join(dir, 'pstack/environment.json'), JSON.stringify({ version: 'pi-mstack/environment/1', roles: { tracker: { update: operation() } } }));
  const handlers = {}; let tool, calls = 0, release;
  context({ on: (name, handler) => { handlers[name] = handler; }, registerTool: value => { tool = value; }, getAllTools: () => [{ name: 'mcp__tracker__update', sourceInfo: { path: 'builtin:mcp' } }] });
  const ctx = { cwd: dir, isProjectTrusted: () => false, sessionManager: { getSessionId: () => 'session' }, tools: [{ name: 'mcp__tracker__update' }], executeTool: () => { calls++; return new Promise(resolve => { release = resolve; }); } };
  const params = { role: 'tracker', operation: 'update', args: { key: 'x', count: 1, done: true } };
  const refresh = () => handlers.before_agent_start({ systemPromptOptions: { sections: {} } }, ctx);
  refresh();
  assert.equal((await tool.execute('x'.repeat(1025), params, undefined, undefined, ctx)).details.reason, 'call-id-limit');
  assert.equal(calls, 0);
  for (const event of ['session_tree', 'session_shutdown', 'before_agent_start']) {
    refresh();
    const pending = tool.execute('correlation', params, undefined, undefined, ctx);
    if (event === 'before_agent_start') refresh(); else handlers[event]();
    const result = await pending; assert.equal(result.details.outcome, 'unknown-outcome');
    release({ isError: false, result: { content: [{ type: 'text', text: 'late success' }] } });
    assert.equal(result.details.outcome, 'unknown-outcome');
  }
  assert.equal(calls, 3);
});
