import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadEnvironment, readBoundedFile } from '../extensions/pstack/environment-config.ts';

const version = 'pi-mstack/environment/1';
test('scoped environment merges exact terms in order and fails closed', t => {
  const dir = mkdtempSync(join(tmpdir(), 'mstack-env-')); t.after(() => rmSync(dir, { recursive: true, force: true }));
  const user = join(dir, 'agent'); const cwd = join(dir, 'project');
  mkdirSync(join(user, 'pstack'), { recursive: true }); mkdirSync(join(cwd, '.pi/pstack'), { recursive: true });
  writeFileSync(join(user, 'pstack/environment-grants.json'), JSON.stringify({ version: 'pi-mstack/environment-grants/1', projects: [realpathSync(cwd)] }));
  const load = nativeTrusted => loadEnvironment({ agentDir: user, cwd, nativeTrusted, sessionId: dir, notify() {} });
  const write = (base, data) => writeFileSync(join(base, 'pstack/environment.json'), JSON.stringify(data));
  assert.deepEqual(load(true), { kind: 'valid', naming: 'task', glossary: [], sources: [], mappings: { reviewBots: [] } });
  const term = (term, meaning) => ({ term, meaning, availability: 'conditional' });
  write(user, { version, glossary: [term('Jira', 'user'), term('Docs', 'second')], sources: [{ id: 'u', kind: 'memory', path: join(dir, 'memory'), delivery: 'automatic' }] });
  write(join(cwd, '.pi'), { version, glossary: [term('Jira', 'project'), term('jira', 'distinct')] });
  assert.deepEqual(load(true).glossary.map(g => g.meaning), ['project', 'second', 'distinct']);
  assert.deepEqual(load(false).glossary.map(g => g.meaning), ['user', 'second']);
  for (const data of [{ version, naming: 'off' }, { version, sources: [{ id: 'u', kind: 'mcp', tool: 'mcp__docs__search', queryArgument: 'query' }] }, { version, sources: [{ id: 'bad', kind: 'mcp', tool: 'bash', queryArgument: 'query' }] }]) {
    write(join(cwd, '.pi'), data); assert.equal(load(true).kind, 'invalid');
  }
  writeFileSync(join(cwd, '.pi/pstack/environment.json'), ' '.repeat(65537));
  assert.equal(load(true).kind, 'invalid');
  assert.equal(load(false).kind, 'valid');
  const projectConfig = join(cwd, '.pi/pstack/environment.json');
  rmSync(projectConfig);
  symlinkSync(join(cwd, 'missing-config'), projectConfig);
  assert.equal(load(true).kind, 'invalid');
  assert.equal(load(false).kind, 'valid');
});

test('bounded files reject directories, oversized files, symlinks and project escapes', t => {
  const dir = mkdtempSync(join(tmpdir(), 'mstack-files-')); t.after(() => rmSync(dir, { recursive: true, force: true }));
  const project = join(dir, 'project'); mkdirSync(project);
  writeFileSync(join(project, 'ok'), 'safe'); writeFileSync(join(dir, 'outside'), 'secret');
  assert.equal(readBoundedFile(join(project, 'ok'), 4, project), 'safe');
  assert.throws(() => readBoundedFile(join(project, 'ok'), 3, project));
  assert.throws(() => readBoundedFile(project, 100, project));
  assert.throws(() => readBoundedFile(join(dir, 'outside'), 100, project));
  symlinkSync(join(dir, 'outside'), join(project, 'link'));
  assert.throws(() => readBoundedFile(join(project, 'link'), 100, project));
});

function fixture(t) {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'mstack-grants-')));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const agentDir = join(dir, 'agent'), cwd = join(dir, 'project');
  mkdirSync(join(agentDir, 'pstack'), { recursive: true });
  mkdirSync(join(cwd, '.pi/pstack'), { recursive: true });
  const file = join(cwd, '.pi/pstack/environment.json');
  const grants = join(agentDir, 'pstack/environment-grants.json');
  const messages = [];
  const request = { agentDir, cwd, nativeTrusted: true, sessionId: dir, notify: text => messages.push(text) };
  writeFileSync(join(agentDir, 'pstack/environment.json'), JSON.stringify({ version, naming: 'off', glossary: [{ term: 'User', meaning: 'USER', availability: 'available' }] }));
  writeFileSync(file, JSON.stringify({ version, glossary: [{ term: 'Project', meaning: 'PROJECT', availability: 'available' }], sources: [{ id: 'project', kind: 'memory', path: 'memory', delivery: 'automatic' }] }));
  writeFileSync(join(cwd, 'memory'), 'PROJECT_MEMORY');
  const grant = (projects = [cwd]) => writeFileSync(grants, JSON.stringify({ version: 'pi-mstack/environment-grants/1', projects }));
  const load = (changes = {}) => loadEnvironment({ ...request, ...changes });
  return { dir, agentDir, cwd, file, grants, messages, grant, load };
}

test('exact canonical grants require native trust and refresh after revocation and reapproval', t => {
  const s = fixture(t);
  const userOnly = result => {
    assert.equal(result.kind, 'valid'); assert.equal(result.naming, 'off');
    assert.deepEqual(result.glossary.map(g => g.meaning), ['USER']); assert.deepEqual(result.sources, []);
  };
  userOnly(s.load());
  for (const root of [s.dir, join(s.dir, 'sibling'), s.cwd + '-suffix']) {
    mkdirSync(root, { recursive: true }); s.grant([root]); userOnly(s.load());
  }
  s.grant(); assert.equal(s.load().sources.length, 1);
  userOnly(s.load({ nativeTrusted: false }));
  rmSync(s.grants); userOnly(s.load());
  s.grant(); assert.equal(s.load().sources.length, 1);
  const alias = join(s.dir, 'alias'); symlinkSync(s.cwd, alias);
  assert.equal(s.load({ cwd: alias }).sources[0].projectRoot, s.cwd);
  rmSync(alias); symlinkSync(join(s.dir, 'sibling'), alias);
  userOnly(s.load({ cwd: alias }));
  assert.equal(s.messages.length, 1);
  userOnly(s.load({ nativeTrusted: false, sessionId: 'another' }));
  assert.equal(s.messages.length, 2);
});

test('invalid and unsafe grants never disable valid user configuration or permit self-approval', t => {
  const s = fixture(t);
  for (const data of ['{', '{}', JSON.stringify({ version: 'wrong', projects: [s.cwd] }), JSON.stringify({ version: 'pi-mstack/environment-grants/1', projects: [s.cwd], extra: true }), ...['.', s.cwd + '/.', s.cwd + '/*', join(s.dir, 'absent')].map(path => JSON.stringify({ version: 'pi-mstack/environment-grants/1', projects: [path] })), ' '.repeat(65537)]) {
    writeFileSync(s.grants, data);
    assert.deepEqual(s.load().glossary.map(g => g.meaning), ['USER']);
  }
  rmSync(s.grants);
  writeFileSync(s.file, JSON.stringify({ version, approved: true, projects: [s.cwd] }));
  writeFileSync(join(s.cwd, '.pi/pstack/environment-grants.json'), JSON.stringify({ version: 'pi-mstack/environment-grants/1', projects: [s.cwd] }));
  assert.equal(s.load().kind, 'valid');
  symlinkSync(join(s.cwd, '.pi/pstack/environment-grants.json'), s.grants);
  assert.equal(s.load().kind, 'valid'); assert.equal(s.load().sources.length, 0);
  rmSync(s.grants); rmSync(join(s.agentDir, 'pstack'), { recursive: true });
  writeFileSync(s.file, JSON.stringify({ version, naming: 'off' }));
  symlinkSync(join(s.cwd, '.pi/pstack'), join(s.agentDir, 'pstack'));
  assert.equal(s.load().sources.length, 0);
  const inside = join(s.cwd, 'agent'); mkdirSync(join(inside, 'pstack'), { recursive: true });
  writeFileSync(join(inside, 'pstack/environment-grants.json'), JSON.stringify({ version: 'pi-mstack/environment-grants/1', projects: [s.cwd] }));
  assert.equal(s.load({ agentDir: inside }).sources.length, 0);
});

test('denied project config and sources are never opened or read, even malformed or nonregular', async t => {
  const fs = (await import('node:fs')).default;
  const { syncBuiltinESMExports } = await import('node:module');
  const { execFileSync } = await import('node:child_process');
  const s = fixture(t), opened = [], reads = [];
  const open = fs.openSync, read = fs.readSync;
  fs.openSync = (path, ...args) => { opened.push(String(path)); return open(path, ...args); };
  fs.readSync = (fd, ...args) => { reads.push(fd); return read(fd, ...args); };
  syncBuiltinESMExports();
  t.after(() => { fs.openSync = open; fs.readSync = read; syncBuiltinESMExports(); });
  const denied = () => {
    opened.length = 0; reads.length = 0;
    assert.equal(s.load().kind, 'valid');
    assert.ok(opened.length > 0); assert.ok(reads.length > 0, 'instrumentation observes user config reads');
    assert.ok(!opened.some(path => path.startsWith(s.cwd + '/')), JSON.stringify(opened));
  };
  denied();
  for (const content of ['{INVALID', ' '.repeat(65537)]) { writeFileSync(s.file, content); denied(); }
  rmSync(s.file); mkdirSync(s.file); denied(); rmSync(s.file, { recursive: true });
  execFileSync('mkfifo', [s.file]); denied(); rmSync(s.file);
  symlinkSync(join(s.cwd, 'missing'), s.file); denied();
  rmSync(join(s.cwd, '.pi'), { recursive: true });
  symlinkSync(s.agentDir, join(s.cwd, '.pi')); denied();
});

test('authorized config symlinks remain rejected and absent ignored config is silent', t => {
  const s = fixture(t); s.grant();
  rmSync(s.file); symlinkSync(join(s.cwd, 'memory'), s.file);
  assert.equal(s.load().kind, 'invalid');
  rmSync(s.file); rmSync(s.grants);
  assert.equal(s.load().kind, 'valid'); assert.deepEqual(s.messages, []);
  rmSync(join(s.cwd, '.pi/pstack'), { recursive: true });
  symlinkSync(join(s.agentDir, 'pstack'), join(s.cwd, '.pi/pstack'));
  assert.equal(s.load().kind, 'valid'); assert.equal(s.messages.length, 1);
  s.grant(); assert.equal(s.load().kind, 'invalid');
});
