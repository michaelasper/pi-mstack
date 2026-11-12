import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadEnvironment, readBoundedFile } from '../extensions/pstack/environment-config.ts';

const version = 'pi-mstack/environment/1';
test('scoped environment merges exact terms in order and fails closed', t => {
  const dir = mkdtempSync(join(tmpdir(), 'mstack-env-')); t.after(() => rmSync(dir, { recursive: true, force: true }));
  const user = join(dir, 'agent'); const cwd = join(dir, 'project');
  mkdirSync(join(user, 'pstack'), { recursive: true }); mkdirSync(join(cwd, '.pi/pstack'), { recursive: true });
  const write = (base, data) => writeFileSync(join(base, 'pstack/environment.json'), JSON.stringify(data));
  assert.deepEqual(loadEnvironment(user, cwd, true), { kind: 'valid', naming: 'task', glossary: [], sources: [] });
  const term = (term, meaning) => ({ term, meaning, availability: 'conditional' });
  write(user, { version, glossary: [term('Jira', 'user'), term('Docs', 'second')], sources: [{ id: 'u', kind: 'memory', path: join(dir, 'memory'), delivery: 'automatic' }] });
  write(join(cwd, '.pi'), { version, glossary: [term('Jira', 'project'), term('jira', 'distinct')] });
  assert.deepEqual(loadEnvironment(user, cwd, true).glossary.map(g => g.meaning), ['project', 'second', 'distinct']);
  assert.deepEqual(loadEnvironment(user, cwd, false).glossary.map(g => g.meaning), ['user', 'second']);
  for (const data of [{ version, naming: 'off' }, { version, sources: [{ id: 'u', kind: 'mcp', tool: 'mcp__docs__search', queryArgument: 'query' }] }, { version, sources: [{ id: 'bad', kind: 'mcp', tool: 'bash', queryArgument: 'query' }] }]) {
    write(join(cwd, '.pi'), data); assert.equal(loadEnvironment(user, cwd, true).kind, 'invalid');
  }
  writeFileSync(join(cwd, '.pi/pstack/environment.json'), ' '.repeat(65537));
  assert.equal(loadEnvironment(user, cwd, true).kind, 'invalid');
  assert.equal(loadEnvironment(user, cwd, false).kind, 'valid');
  const projectConfig = join(cwd, '.pi/pstack/environment.json');
  rmSync(projectConfig);
  symlinkSync(join(cwd, 'missing-config'), projectConfig);
  assert.equal(loadEnvironment(user, cwd, true).kind, 'invalid');
  assert.equal(loadEnvironment(user, cwd, false).kind, 'valid');
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
