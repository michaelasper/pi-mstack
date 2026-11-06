import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, chmodSync, cpSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { inventory, validateSnapshot, digest, propose, accept, generate, acquireLock, repairLock } from '../tools/importer.mjs';

const root = process.cwd();
const repo = join(root, '.cache/cursor-plugins');
const commit = '2776ddd2355d6d6c8747d3964600f28daf62f049';
function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'mstack-import-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  for (const name of ['tools', 'port']) cpSync(join(root, name), join(dir, name), { recursive: true });
  return dir;
}

test('pinned source accounts for every record and Git executable bit', () => {
  const manifest = JSON.parse(readFileSync('upstream/manifest.json'));
  assert.equal(manifest.records.length, 573);
  assert.equal(manifest.records.filter(r => r.gitMode === '100755').length, 6);
  assert.equal(manifest.records.filter(r => /^skills\/[^/]+\/SKILL.md$/.test(r.sourcePath)).length, 58);
  validateSnapshot('upstream/pstack', manifest);
});

test('Git object inventory ignores checkout edits', { skip: !process.env.MSTACK_GIT_TESTS }, () => {
  const files = inventory({ repo, commit });
  assert.equal(files.records.length, 573);
});

test('digest changes for template-only additions and vocabulary inventory changes', t => {
  const dir = fixture(t);
  const manifest = { schema: 1, records: [] };
  const before = digest(dir, manifest);
  writeFileSync(join(dir, 'port/new-template.md'), 'new');
  assert.notEqual(digest(dir, manifest), before);
  const withTemplate = digest(dir, manifest);
  const path = join(dir, 'port/required-terms.json');
  const inventory = JSON.parse(readFileSync(path));
  inventory.protocolFields.novel_field = 'Task';
  writeFileSync(path, JSON.stringify(inventory));
  assert.notEqual(digest(dir, manifest), withTemplate);
});

test('lock excludes concurrent writers and refuses live repair', t => {
  const dir = fixture(t);
  const release = acquireLock(dir, 'review');
  assert.throws(() => acquireLock(dir, 'other'), /lock/i);
  assert.throws(() => generate(dir), /lock/i);
  assert.throws(() => accept(dir, { proposal: 'unused', reviewed: 'other' }), /lock/i);
  assert.throws(() => repairLock(dir), /Live local owner with matching process-start/);
  release();
  acquireLock(dir, 'again')();
});

test('raw byte and mode drift are rejected', t => {
  const dir = fixture(t);
  cpSync('upstream', join(dir, 'upstream'), { recursive: true });
  const manifest = JSON.parse(readFileSync(join(dir, 'upstream/manifest.json')));
  const path = join(dir, 'upstream/pstack/LICENSE');
  chmodSync(path, 0o755);
  assert.throws(() => validateSnapshot(join(dir, 'upstream/pstack'), manifest), /mode/i);
  chmodSync(path, 0o644);
  writeFileSync(path, 'changed');
  assert.throws(() => validateSnapshot(join(dir, 'upstream/pstack'), manifest), /hash/i);
});

test('generation is deterministic and refuses manual edits', t => {
  const dir = fixture(t);
  cpSync('upstream', join(dir, 'upstream'), { recursive: true });
  generate(dir);
  generate(dir, { check: true });
  const index = readFileSync(join(dir, 'generated/index.json'));
  generate(dir);
  assert.deepEqual(readFileSync(join(dir, 'generated/index.json')), index);
  writeFileSync(join(dir, 'generated/skills/how/SKILL.md'), 'manual');
  assert.throws(() => generate(dir), /manual|drift/i);
  generate(dir, { repair: true });
  generate(dir, { check: true });
  writeFileSync(join(dir, 'generated/index.json'), readFileSync(join(dir, 'generated/index.json'), 'utf8') + '\n');
  assert.throws(() => generate(dir), /index drift/);
  generate(dir, { repair: true });
  writeFileSync(join(dir, 'generated/unowned.md'), 'retain me');
  assert.throws(() => generate(dir, { repair: true }), /Unowned/);
  rmSync(join(dir, 'generated/unowned.md'));
  cpSync(join(dir, 'generated'), join(dir, '.mstack-generated-backup'), { recursive: true });
  assert.throws(() => generate(dir, { check: true }), /Interrupted/);
  writeFileSync(join(dir, '.mstack-generated-backup/unowned.md'), 'retain me');
  assert.throws(() => generate(dir, { repair: true }), /Unowned backup/);
  rmSync(join(dir, '.mstack-generated-backup/unowned.md'));
  generate(dir, { repair: true });
  generate(dir, { check: true });
});
