import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, cpSync, chmodSync, symlinkSync } from 'node:fs';
import { tmpdir, hostname } from 'node:os';
import { join } from 'node:path';
import { inventory, validateSnapshot, safePath, propose, accept, generate, repairLock, exportSource, readJSON, json } from '../tools/importer.mjs';
import { render } from '../tools/render.mjs';

function workspace(t) {
  const root = mkdtempSync(join(tmpdir(), 'mstack-update-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const name of ['tools', 'port', 'upstream']) cpSync(name, join(root, name), { recursive: true });
  return root;
}
function git(repo, ...args) { return execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8', env: { ...process.env, GIT_AUTHOR_NAME: 'Fixture', GIT_AUTHOR_EMAIL: 'fixture@example.invalid', GIT_COMMITTER_NAME: 'Fixture', GIT_COMMITTER_EMAIL: 'fixture@example.invalid' } }).trim(); }
function revision(repo) {
  git(repo, 'add', '--all');
  return git(repo, 'commit-tree', git(repo, 'write-tree'), '-m', 'isolated importer fixture');
}

test('local Git proposals account for add/remove/hash/mode drift and repair interrupted acceptance', { timeout: 30000 }, t => {
  const root = workspace(t), repo = join(root, 'repo'); mkdirSync(repo);
  exportSource(root, join(repo, 'pstack'));
  git(repo, 'init', '-q');
  writeFileSync(join(repo, 'pstack/skills/new-reference.md'), '# Reference\n');
  rmSync(join(repo, 'pstack/assets/logo.png'));
  chmodSync(join(repo, 'pstack/LICENSE'), 0o755);
  writeFileSync(join(repo, 'pstack/README.md'), '# Changed historical documentation\n');
  const commit = revision(repo);
  const proposal = propose(root, { repo, commit });
  const review = readJSON(join(proposal, 'review.json'));
  assert.ok(review.changes.some(c => c.kind === 'added' && c.path.endsWith('new-reference.md')));
  assert.ok(review.changes.some(c => c.kind === 'removed' && c.path.endsWith('logo.png')));
  assert.ok(review.changes.some(c => c.kind === 'changed' && c.path === 'README.md' && c.field === 'sha256'));
  assert.ok(review.changes.some(c => c.kind === 'modeChanged' && c.path === 'LICENSE'));
  const template = join(root, 'port/templates/setup.md'), original = readFileSync(template);
  writeFileSync(template, 'changed template');
  assert.throws(() => accept(root, { proposal, reviewed: review.reviewDigest }), /Stale/);
  writeFileSync(template, original);
  for (const interruptAt of ['journal', 'rename']) {
    assert.throws(() => accept(root, { proposal, reviewed: review.reviewDigest, interruptAt }), /interruption/);
    assert.throws(() => generate(root), /Interrupted acceptance/);
    accept(root, { proposal, reviewed: review.reviewDigest });
    generate(root);
    generate(root, { check: true });
  }
  writeFileSync(join(repo, 'pstack/LICENSE'), 'checkout differs from commit');
  const fromGit = inventory({ repo, commit });
  assert.equal(fromGit.records.find(r => r.sourcePath === 'LICENSE').sha256, readJSON(join(root, 'upstream/manifest.json')).records.find(r => r.sourcePath === 'LICENSE').sha256);
});

test('Git symlinks and unknown kinds fail closed', t => {
  const root = workspace(t), repo = join(root, 'repo'); mkdirSync(repo);
  git(repo, 'init', '-q'); mkdirSync(join(repo, 'pstack'));
  writeFileSync(join(repo, 'pstack/plugin.json'), '{"version":"fixture"}');
  symlinkSync('/etc/passwd', join(repo, 'pstack/link.md'));
  assert.throws(() => inventory({ repo, commit: revision(repo) }), /Unsupported Git mode/);
  rmSync(join(repo, 'pstack/link.md'));
  writeFileSync(join(repo, 'pstack/unknown.never'), 'new kind');
  assert.throws(() => inventory({ repo, commit: revision(repo) }), /Unknown resource kind/);
});

test('unsafe manifest paths, arbitrary storage remaps, duplicate destinations, and unsupported schemas reject', t => {
  const root = workspace(t), manifest = readJSON(join(root, 'upstream/manifest.json'));
  for (const path of ['../escape', '/absolute', 'a/../b', 'a\\b', 'a\n']) assert.throws(() => safePath(path), /Unsafe/);
  const check = change => { const next = structuredClone(manifest); change(next); assert.throws(() => validateSnapshot(join(root, 'upstream/pstack'), next)); };
  check(m => m.schema = 99);
  check(m => m.records[0].storagePath = 'hidden');
  check(m => m.records[0].disposition.kind = 'unknown');
  check(m => m.records[0].gitMode = '120000');
  check(m => { const copies = m.records.filter(r => r.disposition.outputPath); copies[1].disposition.outputPath = copies[0].disposition.outputPath; });
});

test('abandoned local lock needs explicit repair and foreign ownership needs acknowledgment', t => {
  const root = workspace(t), lock = join(root, '.mstack-lock'); mkdirSync(lock);
  writeFileSync(join(lock, 'owner.json'), json({ hostname: hostname(), pid: 2147483647, start: 'dead fixture', token: 'dead-owner' }));
  assert.throws(() => generate(root), /lock/i);
  repairLock(root);
  generate(root);
  mkdirSync(lock);
  writeFileSync(join(lock, 'owner.json'), json({ hostname: 'foreign-host.invalid', pid: 1, start: 'unknown', token: 'foreign-token' }));
  assert.throws(() => repairLock(root), /acknowledgment/);
  repairLock(root, 'foreign-token');
});

test('missing mappings, stale roles, unknown adapters, and surviving fallback paragraphs reject generation', t => {
  const root = workspace(t), manifest = readJSON(join(root, 'upstream/manifest.json'));
  const mutations = [
    ['port/policy.json', value => { value.replacements['skills/technical-writing/SKILL.md'] = 'missing-adapter'; return value; }, /Unknown disposition policy/],
    ['port/mappings.json', value => value.slice(1), /Unmapped host term/],
    ['port/roles.json', value => value.slice(1), /role registry/],
    ['port/patches.json', value => { delete value['skills/arena/SKILL.md']; return value; }, /Forbidden fallback/],
    ['port/patches.json', value => { value['skills/setup-pstack/SKILL.md'].sourceHash = '0'.repeat(64); return value; }, /source hash/],
    ['port/patches.json', value => { value['skills/setup-pstack/SKILL.md'].template = '../../outside.md'; return value; }, /Unsafe path/],
  ];
  for (const [file, mutate, pattern] of mutations) {
    const path = join(root, file), original = readFileSync(path);
    writeFileSync(path, json(mutate(JSON.parse(original))));
    assert.throws(() => render(root, join(root, 'upstream/pstack'), manifest), pattern);
    writeFileSync(path, original);
  }
});

test('missing and malformed lock owners require manual inspection without removing the lock', t => {
  const root = workspace(t), lock = join(root, '.mstack-lock');
  mkdirSync(lock);
  for (const content of [undefined, '{broken', 'null', '{}']) {
    if (content !== undefined) writeFileSync(join(lock, 'owner.json'), content);
    assert.throws(() => repairLock(root, 'anything'), /inspect.*manually.*refused/);
    assert.throws(() => generate(root), /lock/i);
  }
});

test('local repair verifies start evidence and never steals a reused PID', t => {
  const root = workspace(t), lock = join(root, '.mstack-lock');
  mkdirSync(lock);
  const owner = { hostname: hostname(), pid: process.pid, start: 'another process start', token: 'owner' };
  writeFileSync(join(lock, 'owner.json'), json(owner));
  assert.throws(() => repairLock(root, owner.token), /process-start mismatch.*PID reuse/);
  owner.start = execFileSync('ps', ['-p', String(process.pid), '-o', 'lstart='], { encoding: 'utf8' }).trim();
  assert.ok(owner.start);
  writeFileSync(join(lock, 'owner.json'), json(owner));
  assert.throws(() => repairLock(root, owner.token), /Live local owner with matching process-start/);
  const originalPath = process.env.PATH;
  try {
    process.env.PATH = root;
    assert.throws(() => repairLock(root, owner.token), /process-start verification unavailable/);
  } finally { process.env.PATH = originalPath; }
});

test('host vocabulary detection is independent of mapping patterns and checks source before patches', t => {
  const root = workspace(t), source = join(root, 'upstream/pstack'), manifest = readJSON(join(root, 'upstream/manifest.json'));
  const path = join(source, 'skills/no-comments/SKILL.md'), original = readFileSync(path, 'utf8');
  for (const text of ['Task(novel_field: true)', 'Task(novel: true)', '`novel_field: true`', '`Task` with `"novel_field": true`', 'Read ~/.cursor/novel-host/config']) {
    writeFileSync(path, original + '\n' + text);
    assert.throws(() => render(root, source, manifest), /Unmapped host vocabulary novel/);
  }
  writeFileSync(path, original);
  const agentPath = join(source, 'agents/poteto-agent.md'), agentOriginal = readFileSync(agentPath);
  writeFileSync(agentPath, agentOriginal + '\nTask(novel_field: true)\n');
  assert.throws(() => render(root, source, manifest), /Unmapped host vocabulary novel_field/);
  writeFileSync(agentPath, agentOriginal);
  writeFileSync(join(source, 'README.md'), 'Historical Task(novel_field: true) in .cursor/unknown');
  const output = render(root, source, manifest);
  const coverage = JSON.parse(output.get('host-coverage.json').bytes);
  assert.ok(coverage.find(row => row.path === 'skills/no-comments/SKILL.md').terms.includes('subagent_type'));
  assert.match(output.get('docs/harness/pi.md').bytes.toString(), /Do not pass subagent_type to native subagent/);
  const inventoryPath = join(root, 'port/required-terms.json');
  const inventory = readJSON(inventoryPath);
  inventory.mappings = inventory.mappings.filter(key => key !== 'subagent_type');
  delete inventory.protocolFields.subagent_type;
  writeFileSync(inventoryPath, json(inventory));
  const mappingPath = join(root, 'port/mappings.json');
  writeFileSync(mappingPath, json(readJSON(mappingPath).filter(row => row.key !== 'subagent_type')));
  assert.throws(() => render(root, source, manifest), /Unmapped host vocabulary subagent_type/);
});

test('role model, selector, and panel references reject unknown labels', t => {
  const root = workspace(t), source = join(root, 'upstream/pstack'), manifest = readJSON(join(root, 'upstream/manifest.json'));
  const path = join(source, 'skills/no-comments/SKILL.md'), original = readFileSync(path, 'utf8');
  for (const noun of ['model', 'selector', 'panel', 'line', 'role']) {
    writeFileSync(path, original + `\nUse the \`swarm typo\` ${noun}.\n`);
    assert.throws(() => render(root, source, manifest), /Unregistered role reference: swarm typo/);
  }
  writeFileSync(path, original + '\nUse the `swarm workers` model and `arena runners` panel.\n');
  assert.ok(render(root, source, manifest).has('host-coverage.json'));
});

test('host vocabulary inventory validates shapes and mapping references', t => {
  const root = workspace(t), source = join(root, 'upstream/pstack'), manifest = readJSON(join(root, 'upstream/manifest.json'));
  const path = join(root, 'port/required-terms.json'), original = readJSON(path);
  for (const mutate of [value => value.protocolFields = [], value => value.cursorPaths = null, value => value.protocolFields.subagent_type = 'missing', value => value.mappings.push(value.mappings[0])]) {
    const value = structuredClone(original);
    mutate(value);
    writeFileSync(path, json(value));
    assert.throws(() => render(root, source, manifest), /Invalid host vocabulary inventory/);
  }
});
