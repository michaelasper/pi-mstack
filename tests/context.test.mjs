import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import context, { retrieve, boundedText } from '../extensions/pstack/context.ts';

const source = { id: 'docs', kind: 'mcp', tool: 'mcp__docs__search', queryArgument: 'query' };
test('retrieval enforces callable native dispatch, output budget and uncooperative deadline', { timeout: 5000 }, async () => {
  let args;
  const ctx = { tools: [{ name: source.tool }], executeTool: async (...input) => { args = input; return { isError: false, result: { content: [{ type: 'text', text: '🙂'.repeat(20000) }] } }; } };
  const output = await retrieve(source, 'nonce', ctx, []);
  assert.ok(Buffer.byteLength(output) <= 16384); assert.match(output, /Context source docs/); assert.match(output, /truncated/); assert.doesNotMatch(output, /�/);
  assert.equal(args[0], source.tool); assert.deepEqual(args[1], { query: 'nonce' });
  assert.equal(Buffer.byteLength(boundedText('x'.repeat(20000))), 16384);
  await assert.rejects(retrieve(source, '', { ...ctx, tools: [] }, []));
  await assert.rejects(retrieve(source, '', { ...ctx, executeTool: async () => ({ isError: true, result: { content: [{ type: 'text', text: 'SECRET_TOKEN_SENTINEL' }] } }) }, []), error => !error.message.includes('SECRET_TOKEN_SENTINEL'));
  const start = Date.now();
  await assert.rejects(retrieve(source, '', { ...ctx, executeTool: () => new Promise(() => {}) }, []));
  assert.ok(Date.now() - start < 3000, 'caller is not held by an uncooperative provider');
  const abort = new AbortController(); abort.abort();
  await assert.rejects(retrieve(source, '', ctx, [abort.signal]));
});

test('automatic evidence is transient, once per run, refreshed and invalidated on tree change', async t => {
  const dir = mkdtempSync(join(tmpdir(), 'mstack-context-')); t.after(() => rmSync(dir, { recursive: true, force: true }));
  const old = process.env.PI_CODING_AGENT_DIR; process.env.PI_CODING_AGENT_DIR = dir;
  t.after(() => { if (old === undefined) delete process.env.PI_CODING_AGENT_DIR; else process.env.PI_CODING_AGENT_DIR = old; });
  mkdirSync(join(dir, 'pstack')); const memory = join(dir, 'memory'); writeFileSync(memory, 'FIRST_NONCE');
  writeFileSync(join(dir, 'pstack/environment.json'), JSON.stringify({ version: 'pi-mstack/environment/1', sources: [{ id: 'local', kind: 'memory', path: memory, delivery: 'automatic' }] }));
  const handlers = {}; let tool;
  context({ on: (name, handler) => { handlers[name] = handler; }, registerTool: value => { tool = value; } });
  const ctx = { cwd: dir, isProjectTrusted: () => false, sessionManager: { getSessionId: () => 'session' } };
  handlers.before_agent_start({ systemPromptOptions: { sections: {} } }, ctx);
  const first = await handlers.context({ messages: [] }, ctx);
  assert.match(JSON.stringify(first), /FIRST_NONCE/); assert.equal(first.messages.length, 1);
  writeFileSync(memory, 'SECOND_NONCE');
  const follow = await handlers.context(first, ctx); assert.equal(follow.messages.length, 1); assert.match(JSON.stringify(follow), /FIRST_NONCE/); assert.doesNotMatch(JSON.stringify(follow), /SECOND_NONCE/);
  handlers.before_agent_start({ systemPromptOptions: { sections: {} } }, ctx);
  assert.match(JSON.stringify(await handlers.context({ messages: [] }, ctx)), /SECOND_NONCE/);
  handlers.session_tree(); assert.equal(await handlers.context({ messages: [] }, ctx), undefined);
  const failed = await tool.execute('id', { source: 'nope', query: 'secret' }, undefined, undefined, ctx);
  assert.equal(failed.isError, true); assert.doesNotMatch(JSON.stringify(failed), /secret/);
});
