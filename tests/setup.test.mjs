import { execFileSync, spawnSync } from 'node:child_process';
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, statSync, readdirSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';
import { cli, packed, isolated, rpc } from './helpers.mjs';
const artifact = packed();
after(() => {
  if (process.env.MSTACK_IMPORT_EVIDENCE) {
    mkdirSync(process.env.MSTACK_IMPORT_EVIDENCE, { recursive: true });
    for (const name of readdirSync(artifact.dir).filter(name => name.endsWith('.tgz'))) copyFileSync(join(artifact.dir, name), join(process.env.MSTACK_IMPORT_EVIDENCE, name));
  }
  rmSync(artifact.dir, { recursive: true, force: true });
});

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

function retain(name, client, path) {
  if (!process.env.MSTACK_IMPORT_EVIDENCE) return;
  mkdirSync(process.env.MSTACK_IMPORT_EVIDENCE, { recursive: true });
  writeFileSync(join(process.env.MSTACK_IMPORT_EVIDENCE, name + '.json'), JSON.stringify({ records: client.records, stderr: client.stderr(), destination: existsSync(path) ? readFileSync(path, 'utf8') : null }, null, 2));
}

for (const defaultValue of [true, false, undefined]) test(`RPC import previews exact replacement and preserves default ${defaultValue}`, { timeout: 30000 }, async t => {
  const dir = join(artifact.dir, `import-${defaultValue}`); mkdirSync(dir);
  const iso = isolated(dir, artifact.packageRoot, { enabledModels: ['mstack-test/script/model'] });
  const path = join(iso.agentDir, 'pstack/models.json'); mkdirSync(join(iso.agentDir, 'pstack'));
  writeFileSync(path, JSON.stringify({ version: 'pi-mstack/1', ...(defaultValue === undefined ? {} : { potetoModeDefault: defaultValue }), roles: { 'bug-fix': 'auto' } }));
  const source = join(dir, 'legacy roles.mdc');
  const text = '\uFEFF---\r\ndescription: legacy\r\n---\r\n# budget: large\r\nfeature, refactoring: auto\r\nreflect judgment, divergent, synthesizer: inherit-parent\r\narena runners: mstack-test/other:off, inherit-parent, mstack-test/other:off';
  writeFileSync(source, text);
  const client = rpc({ dir, ...iso });
  t.after(async () => { await client.stop(); retain(`success-${defaultValue}`, client, path); });
  await client.send('get_state');
  const dialog = client.wait(e => e.method === 'confirm');
  const input = defaultValue === true ? './legacy roles.mdc' : defaultValue === false ? '"~/legacy roles.mdc"' : "'./legacy roles.mdc'";
  const prompt = client.send('prompt', { message: `/setup-pstack import ${input}` });
  const current = await dialog;
  const expected = { 'feature, refactoring': 'auto', 'reflect judgment, divergent, synthesizer': 'inherit-parent', 'arena runners': ['mstack-test/other:off', 'inherit-parent', 'mstack-test/other:off'] };
  assert.ok(current.message.includes(source)); assert.ok(current.message.includes(path));
  assert.match(current.message, /Replace ALL configured role assignments/);
  assert.match(current.message, /outside session picker scope/);
  assert.ok(current.message.includes(`Preserved potetoModeDefault: ${defaultValue ?? 'absent'}`));
  assert.ok(current.message.includes(JSON.stringify(expected, null, 2)));
  for (const role of JSON.parse(readFileSync(new URL('../port/roles.json', import.meta.url)))) assert.ok(current.message.includes(`${role.name}:`));
  assert.match(current.message, /arena runners: mstack-test\/other:off.*mstack-test\/script\/model:off.*mstack-test\/other:off/);
  client.respond(current.id, { confirmed: true }); await prompt;
  assert.deepEqual(JSON.parse(readFileSync(path)), { version: 'pi-mstack/1', ...(defaultValue === undefined ? {} : { potetoModeDefault: defaultValue }), roles: expected });
  assert.equal(statSync(path).mode & 0o777, 0o600);
  assert.equal(readFileSync(source, 'utf8'), text);
});

for (const mutation of ['cancel', 'destination', 'source', 'model', 'thinking', 'remove', 'revoke', 'reregister-revoke', 'lock', 'collision']) test(`RPC import pending confirmation handles ${mutation}`, { timeout: 30000 }, async t => {
  const dir = join(artifact.dir, `race-${mutation}`); mkdirSync(dir);
  const iso = isolated(dir, artifact.packageRoot); iso.env.MSTACK_IMPORT_TESTS = '1';
  const path = join(iso.agentDir, 'pstack/models.json'); mkdirSync(join(iso.agentDir, 'pstack'));
  const original = '{"version":"pi-mstack/1","potetoModeDefault":false,"roles":{}}\n'; writeFileSync(path, original);
  const source = join(dir, 'roles'); const text = 'bug-fix: team/custom/other:off'; writeFileSync(source, text);
  const client = rpc({ dir, ...iso });
  t.after(async () => { await client.stop(); retain(`race-${mutation}`, client, path); });
  await client.send('get_state');
  const dialog = client.wait(e => e.method === 'confirm');
  const prompt = client.send('prompt', { message: `/setup-pstack import ${source}` });
  const current = await dialog;
  let expected = original;
  if (mutation === 'destination') { expected = original.replace('false', 'true'); writeFileSync(path, expected); }
  if (mutation === 'source') writeFileSync(source, 'bug-fix: auto');
  if (mutation === 'model') { await client.send('set_model', { provider: 'mstack-test', modelId: 'other' }); assert.equal((await client.send('get_state')).model.id, 'other'); }
  if (mutation === 'thinking') { await client.send('set_thinking_level', { level: 'high' }); assert.equal((await client.send('get_state')).thinkingLevel, 'high'); }
  if (mutation === 'reregister-revoke') await client.send('prompt', { message: '/mstack-import-test reregister-revoke' });
  if (mutation === 'remove' || mutation === 'revoke' || mutation === 'collision') {
    await client.send('prompt', { message: `/mstack-import-test ${mutation}` });
    const observation = client.records.filter(e => e.method === 'notify' && e.message.startsWith('{"available":')).at(-1);
    const state = JSON.parse(observation.message);
    assert.equal(state.available.includes('team/custom/other'), mutation === 'collision');
    assert.equal(state.catalog.includes('team/custom/other'), mutation !== 'remove');
  }
  if (mutation === 'lock') mkdirSync(path + '.lock');
  client.respond(current.id, { confirmed: mutation !== 'cancel' }); await prompt;
  if (mutation === 'source') assert.deepEqual(JSON.parse(readFileSync(path)).roles, { 'bug-fix': 'team/custom/other:off' });
  else assert.equal(readFileSync(path, 'utf8'), expected);
  if (['model', 'thinking', 'remove', 'revoke', 'reregister-revoke'].includes(mutation)) assert.ok(client.records.some(e => e.method === 'notify' && /preview changed or became invalid/.test(e.message)));
  if (mutation === 'destination') assert.ok(client.records.some(e => e.method === 'notify' && /changed during setup/.test(e.message)));
  if (mutation === 'lock') assert.ok(existsSync(path + '.lock'));
  if (mutation === 'collision') assert.ok(client.records.some(e => e.method === 'notify' && /Command collision setup-pstack/.test(e.message)));
});

test('RPC import rejects invalid sources and arguments without a dialog or write', { timeout: 30000 }, async t => {
  const dir = join(artifact.dir, 'import-invalid'); mkdirSync(dir);
  const iso = isolated(dir, artifact.packageRoot);
  const path = join(iso.agentDir, 'pstack/models.json');
  const source = join(dir, 'roles');
  const client = rpc({ dir, ...iso });
  t.after(async () => { await client.stop(); retain('invalid', client, path); });
  await client.send('get_state');
  for (const content of ['bug-fix: slug', 'bug-fix: auto\nunknown: auto', 'bug-fix: missing/model', 'bug-fix: mstack-test/no-reasoning:high', Buffer.from([0xc3, 0x28]), Buffer.alloc(1024 * 1024 + 1, 32), '', '# comment', 'bug-fix: auto\n---']) {
    writeFileSync(source, content);
    const start = client.records.length;
    await client.send('prompt', { message: `/setup-pstack import ${source}` });
    assert.equal(existsSync(path), false);
    assert.ok(client.records.slice(start).some(e => e.method === 'notify' && e.notifyType === 'error'));
    assert.ok(!client.records.slice(start).some(e => ['select', 'confirm', 'input'].includes(e.method)));
    assert.deepEqual(readFileSync(source), Buffer.from(content));
  }
  execFileSync('mkfifo', [join(dir, 'fifo')]);
  for (const arg of [`import ${dir}/fifo`, 'unknown', 'import', 'import ~other/a', 'import "a" junk', `import ${dir}`, `import ${dir}/missing`]) {
    const start = client.records.length;
    await client.send('prompt', { message: `/setup-pstack ${arg}` });
    assert.ok(client.records.slice(start).some(e => e.method === 'notify' && e.notifyType === 'error'));
    assert.equal(existsSync(path), false);
  }
  mkdirSync(join(iso.agentDir, 'pstack')); writeFileSync(path, ''); writeFileSync(source, 'bug-fix: auto');
  await client.send('prompt', { message: `/setup-pstack import ${source}` });
  assert.equal(readFileSync(path, 'utf8'), '');
  assert.ok(client.records.some(e => e.method === 'notify' && /Refusing to overwrite/.test(e.message)));
});

test('print setup and import never write without confirmation UI', { timeout: 30000 }, () => {
  const dir = join(artifact.dir, 'import-headless'); mkdirSync(dir);
  const iso = isolated(dir, artifact.packageRoot);
  const path = join(iso.agentDir, 'pstack/models.json');
  const source = join(dir, 'roles'); writeFileSync(source, 'bug-fix: auto');
  for (const message of ['/setup-pstack', `/setup-pstack import ${source}`]) {
    const result = spawnSync(process.execPath, [cli, ...iso.args, '-p', message], { cwd: dir, env: iso.env, encoding: 'utf8', timeout: 15000 });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stderr, /Use interactive \/setup-pstack/);
    assert.match(result.stderr, /No changes written/);
    assert.equal(existsSync(path), false);
    if (process.env.MSTACK_IMPORT_EVIDENCE) {
      mkdirSync(process.env.MSTACK_IMPORT_EVIDENCE, { recursive: true });
      writeFileSync(join(process.env.MSTACK_IMPORT_EVIDENCE, message === '/setup-pstack' ? 'print-setup.json' : 'print-import.json'), JSON.stringify(result, null, 2));
    }
  }
});
