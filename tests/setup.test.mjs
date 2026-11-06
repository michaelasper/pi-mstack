import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { packed, isolated, rpc } from './helpers.mjs';
const artifact = packed();
after(() => rmSync(artifact.dir, { recursive: true, force: true }));

test('RPC setup cancels without writing, confirms ordered panels, and rejects invalid config', { timeout: 30000 }, async t => {
  const dir = join(artifact.dir, 'setup'); mkdirSync(dir);
  const iso = isolated(dir, artifact.packageRoot);
  const path = join(iso.agentDir, 'pstack/models.json');
  const client = rpc({ dir, ...iso }); t.after(() => client.stop());
  await client.send('get_state');
  async function answer(dialog, fields) {
    const next = client.wait(e => e.type === 'extension_ui_request' && ['select', 'confirm', 'input'].includes(e.method));
    client.respond(dialog.id, fields);
    return next;
  }
  let dialog = client.wait(e => e.type === 'extension_ui_request' && e.method === 'select');
  let prompt = client.send('prompt', { message: '/setup-pstack' });
  client.respond((await dialog).id, { cancelled: true }); await prompt;
  assert.equal(existsSync(path), false);

  dialog = client.wait(e => e.type === 'extension_ui_request' && e.method === 'select');
  prompt = client.send('prompt', { message: '/setup-pstack' });
  let current = await answer(await dialog, { value: 'arena runners' });
  assert.equal(current.method, 'input');
  current = await answer(current, { value: '["mstack-test/other:off","inherit-parent","mstack-test/other:off"]' });
  current = await answer(current, { value: 'Save' });
  assert.equal(current.method, 'confirm');
  assert.match(current.message, /arena runners: mstack-test\/other:off.*mstack-test\/script\/model:off.*mstack-test\/other:off/);
  assert.match(current.message, /how explorer/);
  client.respond(current.id, { confirmed: true }); await prompt;
  assert.deepEqual(JSON.parse(readFileSync(path)).roles['arena runners'], ['mstack-test/other:off', 'inherit-parent', 'mstack-test/other:off']);
  assert.equal(statSync(path).mode & 0o777, 0o600);

  const original = readFileSync(path, 'utf8');
  dialog = client.wait(e => e.type === 'extension_ui_request' && e.method === 'select');
  prompt = client.send('prompt', { message: '/setup-pstack' });
  current = await answer(await dialog, { value: 'how explorer' });
  assert.ok(current.options.includes('mstack-test/other:off'));
  assert.ok(current.options.includes('mstack-test/no-reasoning:off'));
  assert.ok(!current.options.includes('mstack-test/no-reasoning:high'));
  current = await answer(current, { value: 'mstack-test/other:off' });
  current = await answer(current, { value: 'Save' });
  client.respond(current.id, { confirmed: false }); await prompt;
  assert.equal(readFileSync(path, 'utf8'), original);

  writeFileSync(path, '');
  const beforeEmpty = client.records.length;
  await client.send('prompt', { message: '/setup-pstack' });
  assert.equal(readFileSync(path, 'utf8'), '');
  const emptyRecords = client.records.slice(beforeEmpty);
  assert.ok(emptyRecords.some(e => e.method === 'notify' && /Refusing to overwrite/.test(e.message)));
  assert.ok(!emptyRecords.some(e => ['select', 'input', 'confirm'].includes(e.method)));

  writeFileSync(path, '{"version":"future","roles":{}}');
  await client.send('prompt', { message: '/setup-pstack' });
  assert.equal(readFileSync(path, 'utf8'), '{"version":"future","roles":{}}');
  assert.ok(client.records.some(e => e.method === 'notify' && /invalid|unsupported/i.test(e.message)));
});
