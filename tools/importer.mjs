import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, readdirSync, lstatSync, mkdirSync, chmodSync, renameSync, rmSync, mkdtempSync } from 'node:fs';
import { join, dirname, posix, resolve } from 'node:path';
import { hostname } from 'node:os';
import { render } from './render.mjs';

export const sha = bytes => createHash('sha256').update(bytes).digest('hex');
export const json = value => JSON.stringify(value, null, 2) + '\n';
export const storagePath = record => record.sourcePath === '.gitignore' ? '__npm_reserved_gitignore__' : record.sourcePath;
export const readJSON = path => JSON.parse(readFileSync(path, 'utf8'));
export function safePath(path) {
  if (typeof path !== 'string' || !path || path.startsWith('/') || path.includes('\\') || path.split('/').some(p => !p || p === '.' || p === '..') || /[\x00-\x1f\x7f]/.test(path)) throw Error(`Unsafe path ${path}`);
  return path;
}
export function walk(root, prefix = '') {
  if (!existsSync(root)) return [];
  return readdirSync(root).sort().flatMap(name => {
    const path = join(root, name), rel = prefix + name, stat = lstatSync(path);
    if (stat.isSymbolicLink()) throw Error(`Symlink rejected: ${path}`);
    if (stat.isDirectory()) return walk(path, rel + '/');
    if (!stat.isFile()) throw Error(`Unsupported file: ${path}`);
    return [rel];
  });
}
export function put(root, path, bytes, mode = '100644') {
  safePath(path);
  const file = join(root, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, bytes);
  chmodSync(file, mode === '100755' ? 0o755 : 0o644);
}
function git(repo, ...args) { return execFileSync('git', ['-C', repo, ...args], { maxBuffer: 64 * 1024 * 1024 }); }
export function disposition(path, policy) {
  if (policy.replacements[path]) return { kind: 'adapt', outputPath: path, adapterId: policy.replacements[path] };
  if (path.startsWith('automations/')) return { kind: 'preserve', reason: 'dormant', exposure: 'snapshot-only' };
  if (path === 'skills/make-bot-ui/SKILL.md') return { kind: 'preserve', reason: 'capability-gap', gapId: 'bot-ui', exposure: 'generated-notice', outputPath: path };
  if (path.startsWith('skills/')) return { kind: path.endsWith('.md') && !path.includes('/scripts/') ? 'adapt' : 'copy', outputPath: path, ...(path.endsWith('.md') && !path.includes('/scripts/') ? { adapterId: 'pi-prose' } : {}) };
  return { kind: 'preserve', reason: path === 'LICENSE' || path.endsWith('plugin.json') ? 'provenance' : 'historical', exposure: 'snapshot-only' };
}
export function inventory({ repo, commit, policy = readJSON(join(import.meta.dirname, '../port/policy.json')) }) {
  if (!/^[0-9a-f]{40}$/.test(commit)) throw Error('Full commit SHA required');
  if (git(repo, 'rev-parse', `${commit}^{commit}`).toString().trim() !== commit) throw Error('Commit mismatch');
  const records = [], blobs = new Map();
  for (const entry of git(repo, 'ls-tree', '-rz', commit, '--', 'pstack/').toString().split('\0').filter(Boolean)) {
    const match = entry.match(/^(\d+) (\w+) ([0-9a-f]+)\t(pstack\/(.+))$/);
    if (!match || match[2] !== 'blob' || !['100644', '100755'].includes(match[1])) throw Error(`Unsupported Git mode: ${entry}`);
    const path = safePath(match[5]);
    if (!policy.extensions.includes(posix.extname(path)) && !policy.basenames.includes(posix.basename(path))) throw Error(`Unknown resource kind: ${path}`);
    const bytes = git(repo, 'cat-file', 'blob', match[3]);
    blobs.set(path, bytes);
    records.push({ sourcePath: path, ...(path === '.gitignore' ? { storagePath: '__npm_reserved_gitignore__' } : {}), sha256: sha(bytes), gitMode: match[1], disposition: disposition(path, policy) });
  }
  records.sort((a, b) => a.sourcePath.localeCompare(b.sourcePath, 'en'));
  const pluginVersion = JSON.parse(blobs.get('plugin.json')?.toString() ?? '{}').version;
  if (!records.length || typeof pluginVersion !== 'string') throw Error('Missing pstack plugin version');
  return { schema: 1, repository: 'https://github.com/cursor/plugins', fullCommit: commit, subtree: 'pstack', pluginVersion, records, blobs };
}
export function validateSnapshot(root, manifest) {
  if (manifest.schema !== 1 || !/^[0-9a-f]{40}$/.test(manifest.fullCommit) || manifest.subtree !== 'pstack' || !Array.isArray(manifest.records)) throw Error('Invalid snapshot schema');
  const paths = new Set(), stored = new Set(), destinations = new Set();
  for (const record of manifest.records) {
    const path = safePath(record.sourcePath), d = record.disposition;
    if (paths.has(path)) throw Error(`Duplicate source ${path}`);
    paths.add(path);
    const storage = safePath(storagePath(record));
    if ((record.storagePath ?? record.sourcePath) !== storage || stored.has(storage)) throw Error(`Invalid or duplicate storage path ${path}`);
    stored.add(storage);
    if (!['100644', '100755'].includes(record.gitMode)) throw Error(`Invalid mode ${path}`);
    if (!/^[0-9a-f]{64}$/.test(record.sha256)) throw Error(`Invalid hash ${path}`);
    if (!d || !['copy', 'adapt', 'preserve'].includes(d.kind)) throw Error(`Unknown disposition ${path}`);
    if (d.kind === 'adapt' && typeof d.adapterId !== 'string') throw Error(`Missing adapter ${path}`);
    if (d.kind === 'preserve' && (!['provenance', 'historical', 'dormant', 'capability-gap'].includes(d.reason) || !['snapshot-only', 'generated-notice', 'generated-asset'].includes(d.exposure) || (d.reason === 'dormant' && d.exposure !== 'snapshot-only'))) throw Error(`Invalid preservation ${path}`);
    if (d.kind !== 'preserve' || d.exposure !== 'snapshot-only') {
      safePath(d.outputPath);
      if (destinations.has(d.outputPath)) throw Error(`Duplicate destination ${d.outputPath}`);
      destinations.add(d.outputPath);
    }
    const file = join(root, storage), stat = lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink()) throw Error(`Non-file ${path}`);
    if (((stat.mode & 0o111) !== 0) !== (record.gitMode === '100755')) throw Error(`Source mode drift ${path}`);
    if (sha(readFileSync(file)) !== record.sha256) throw Error(`Source hash drift ${path}`);
  }
  if (json([...stored].sort()) !== json(walk(root).sort())) throw Error('Source inventory mismatch');
}
export function digest(root, manifest) {
  const inputs = ['tools', 'port'].flatMap(dir => walk(join(root, dir)).map(path => ({ path: `${dir}/${path}`, sha256: sha(readFileSync(join(root, dir, path))) })));
  return sha(json({ manifest, inputs }));
}
function processStart(pid) {
  try { return execFileSync('ps', ['-p', String(pid), '-o', 'lstart='], { encoding: 'utf8' }).trim(); } catch { return ''; }
}
export function acquireLock(root, proposalDigest) {
  const path = join(root, '.mstack-lock'), token = randomUUID();
  try { mkdirSync(path); } catch { throw Error(`Writer lock exists at ${path}; inspect owner.json and use upstream:repair lock`); }
  const owner = { hostname: hostname(), pid: process.pid, start: processStart(process.pid), proposalDigest, token };
  writeFileSync(join(path, 'owner.json'), json(owner), { flag: 'wx', mode: 0o600 });
  return () => {
    if (readJSON(join(path, 'owner.json')).token !== token) throw Error('Lock ownership changed');
    rmSync(path, { recursive: true });
  };
}
export function repairLock(root, acknowledgment) {
  const path = join(root, '.mstack-lock');
  let owner;
  try { owner = readJSON(join(path, 'owner.json')); } catch {
    throw Error(`Missing or malformed lock owner at ${path}; inspect the lock and running writers, then remove it manually only after establishing no writer can publish. Automatic repair refused`);
  }
  if (!owner || typeof owner !== 'object' || typeof owner.token !== 'string' || !owner.token) {
    throw Error(`Missing or malformed lock ownership token at ${path}; inspect the lock and running writers, then remove it manually only after establishing no writer can publish. Automatic repair refused`);
  }
  if (owner.hostname !== hostname() || !Number.isInteger(owner.pid) || owner.pid <= 0 || typeof owner.start !== 'string' || !owner.start.trim()) {
    if (acknowledgment !== owner.token || !acknowledgment) throw Error('Ambiguous or foreign lock requires exact ownership-token acknowledgment');
  } else {
    let dead = false;
    try { process.kill(owner.pid, 0); } catch (error) { dead = error.code === 'ESRCH'; }
    if (!dead) {
      const start = processStart(owner.pid);
      if (!start) throw Error('Ambiguous local owner; process-start verification unavailable; refusing repair');
      if (start !== owner.start) throw Error('Ambiguous local owner; process-start mismatch (possible PID reuse); refusing repair');
      throw Error('Live local owner with matching process-start evidence; refusing repair');
    }
  }
  if (json(readJSON(join(path, 'owner.json'))) !== json(owner)) throw Error('Lock changed during repair');
  rmSync(path, { recursive: true });
}
export function propose(root, { repo, commit }) {
  const { blobs, ...manifest } = inventory({ repo, commit, policy: readJSON(join(root, 'port/policy.json')) });
  mkdirSync(join(root, '.cache'), { recursive: true });
  const dir = mkdtempSync(join(root, '.cache/proposal-'));
  for (const r of manifest.records) put(join(dir, 'pstack'), storagePath(r), blobs.get(r.sourcePath), r.gitMode);
  validateSnapshot(join(dir, 'pstack'), manifest);
  render(root, join(dir, 'pstack'), manifest);
  const previous = existsSync(join(root, 'upstream/manifest.json')) ? readJSON(join(root, 'upstream/manifest.json')).records : [];
  const old = new Map(previous.map(r => [r.sourcePath, r]));
  const changes = manifest.records.flatMap(r => {
    const before = old.get(r.sourcePath); old.delete(r.sourcePath);
    return !before ? [{ path: r.sourcePath, kind: 'added' }] : ['sha256', 'gitMode', 'disposition'].filter(k => json(before[k]) !== json(r[k])).map(k => ({ path: r.sourcePath, kind: k === 'gitMode' ? 'modeChanged' : 'changed', field: k }));
  }).concat([...old.keys()].map(path => ({ path, kind: 'removed' })));
  writeFileSync(join(dir, 'manifest.json'), json(manifest));
  writeFileSync(join(dir, 'review.json'), json({ changes, reviewDigest: digest(root, manifest), acknowledgment: 'Acceptance acknowledges every listed change and unchanged copy policy.' }));
  return dir;
}
export function accept(root, { proposal, reviewed, interruptAt }) {
  const release = acquireLock(root, reviewed);
  try {
    const manifest = readJSON(join(proposal, 'manifest.json'));
    if (digest(root, manifest) !== reviewed || readJSON(join(proposal, 'review.json')).reviewDigest !== reviewed) throw Error('Stale review digest');
    validateSnapshot(join(proposal, 'pstack'), manifest);
    const policy = readJSON(join(root, 'port/policy.json'));
    for (const r of manifest.records) if (json(r.disposition) !== json(disposition(r.sourcePath, policy))) throw Error(`Disposition differs from reviewed policy: ${r.sourcePath}`);
    render(root, join(proposal, 'pstack'), manifest);
    const stage = mkdtempSync(join(root, '.mstack-source-'));
    for (const r of manifest.records) put(join(stage, 'pstack'), storagePath(r), readFileSync(join(proposal, 'pstack', storagePath(r))), r.gitMode);
    put(stage, 'manifest.json', json(manifest));
    put(stage, 'acceptance.json', json({ schema: 1, reviewDigest: reviewed }));
    writeFileSync(join(root, '.mstack-pending'), json({ reviewed }));
    if (interruptAt === 'journal') throw Error('Injected interruption after journal');
    const backup = join(root, '.mstack-source-backup');
    if (existsSync(join(root, 'upstream'))) {
      if (existsSync(backup)) rmSync(backup, { recursive: true });
      renameSync(join(root, 'upstream'), backup);
    }
    if (interruptAt === 'rename') throw Error('Injected interruption after rename');
    renameSync(stage, join(root, 'upstream'));
    rmSync(join(root, '.mstack-pending'));
    if (existsSync(backup)) rmSync(backup, { recursive: true });
  } finally { release(); }
}
function currentTree(root) {
  return walk(root).map(path => ({ path, sha256: sha(readFileSync(join(root, path))), gitMode: lstatSync(join(root, path)).mode & 0o111 ? '100755' : '100644' }));
}
export function generate(root, { check = false, repair = false } = {}) {
  if (check && existsSync(join(root, '.mstack-lock'))) throw Error('Writer lock present; retry check after publication');
  const release = check ? () => {} : acquireLock(root, 'generation');
  try {
    if (existsSync(join(root, '.mstack-pending'))) throw Error('Interrupted acceptance; repeat the verified proposal');
    const manifest = readJSON(join(root, 'upstream/manifest.json'));
    validateSnapshot(join(root, 'upstream/pstack'), manifest);
    const acceptance = readJSON(join(root, 'upstream/acceptance.json'));
    if (acceptance.schema !== 1 || acceptance.reviewDigest !== digest(root, manifest)) throw Error('Adaptation inputs changed or acceptance invalid; propose and accept a fresh review digest');
    const output = render(root, join(root, 'upstream/pstack'), manifest);
    const index = [...output].map(([path, r]) => ({ path, sha256: sha(r.bytes), gitMode: r.gitMode, sourceHash: r.sourceHash, adapterId: r.adapterId }));
    output.set('index.json', { bytes: Buffer.from(json(index)), gitMode: '100644' });
    output.set('index.sha256', { bytes: Buffer.from(sha(json(index)) + '\n'), gitMode: '100644' });
    const dir = join(root, 'generated');
    const backup = join(root, '.mstack-generated-backup');
    if (existsSync(backup) && !repair) throw Error('Interrupted generation; use explicit repair generated');
    const wanted = [...output].map(([path, r]) => ({ path, sha256: sha(r.bytes), gitMode: r.gitMode })).sort((a,b) => a.path.localeCompare(b.path, 'en'));
    const actual = currentTree(dir).sort((a,b) => a.path.localeCompare(b.path, 'en'));
    if (json(wanted) === json(actual) && !existsSync(backup)) return;
    if (check) throw Error('Generated drift');
    if (existsSync(dir) && !repair) {
      const priorBytes = readFileSync(join(dir, 'index.json'));
      if (readFileSync(join(dir, 'index.sha256'), 'utf8') !== sha(priorBytes) + '\n') throw Error('Manual generated index drift; inspect then explicitly repair generated');
      const prior = JSON.parse(priorBytes);
      const expected = prior.map(({ path, sha256, gitMode }) => ({ path, sha256, gitMode })).sort((a,b) => a.path.localeCompare(b.path, 'en'));
      if (json(actual.filter(r => !['index.json', 'index.sha256'].includes(r.path))) !== json(expected)) throw Error('Manual generated drift; inspect then explicitly repair generated');
    }
    if (repair && existsSync(dir)) {
      const known = new Set([...output.keys(), ...readJSON(join(dir, 'index.json')).map(r => r.path)]);
      if (actual.some(r => !known.has(r.path))) throw Error('Unowned generated file; refusing deletion');
    }
    const stage = mkdtempSync(join(root, '.mstack-generated-'));
    for (const [path, r] of output) put(stage, path, r.bytes, r.gitMode);
    if (existsSync(backup)) {
      const known = new Set(['index.json', 'index.sha256', ...readJSON(join(backup, 'index.json')).map(r => r.path)]);
      if (currentTree(backup).some(r => !known.has(r.path))) throw Error('Unowned backup file; refusing deletion');
      rmSync(backup, { recursive: true });
    }
    if (existsSync(dir)) renameSync(dir, backup);
    renameSync(stage, dir);
    if (existsSync(backup)) rmSync(backup, { recursive: true });
  } finally { release(); }
}

export function exportSource(root, destination) {
  if (existsSync(destination)) throw Error('Export destination must not exist');
  const manifest = readJSON(join(root, 'upstream/manifest.json'));
  validateSnapshot(join(root, 'upstream/pstack'), manifest);
  mkdirSync(destination, { recursive: true });
  for (const r of manifest.records) put(destination, r.sourcePath, readFileSync(join(root, 'upstream/pstack', storagePath(r))), r.gitMode);
}
