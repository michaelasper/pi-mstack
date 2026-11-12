import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, cpSync, readFileSync, writeFileSync, rmSync, appendFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync, spawnSync } from 'node:child_process';
import { validateRelease, validateVersionAdvance, packRelease, verifyArtifact } from '../scripts/release.mjs';

function metadata() {
  return {
    pkg: JSON.parse(readFileSync('package.json', 'utf8')),
    lock: JSON.parse(readFileSync('package-lock.json', 'utf8')),
    changelog: readFileSync('CHANGELOG.md', 'utf8'),
  };
}

test('release metadata binds a stable version, lockfile, changelog and exact tag', () => {
  const input = metadata();
  assert.equal(validateRelease({ ...input, tag: `v${input.pkg.version}` }).version, input.pkg.version);
  const cases = [
    x => x.pkg.private = true,
    x => x.pkg.publishConfig.access = 'restricted',
    x => x.pkg.publishConfig.registry = 'https://example.test/',
    x => x.pkg.repository.url = 'https://example.test/repo',
    x => x.pkg.name = 'other-package',
    x => x.pkg.version = '01.0.0',
    x => x.pkg.version = '1.0.0-rc.1',
    x => x.lock.version = '9.9.9',
    x => x.lock.packages[''].version = '9.9.9',
    x => x.lock = null,
    x => x.changelog = '# No release notes',
    x => x.tag = 'v999.0.0',
    x => x.tag = 'v0.1.0; echo unsafe',
  ];
  for (const mutate of cases) {
    const value = structuredClone(input); mutate(value);
    assert.throws(() => validateRelease(value));
  }
});

test('stable releases cannot reuse a version or move latest backwards', () => {
  const published = { versions: ['0.1.0', '0.2.0'], 'dist-tags': { latest: '0.2.0' } };
  for (const version of ['0.2.1', '0.3.0', '1.0.0']) assert.doesNotThrow(() => validateVersionAdvance(version, published));
  for (const version of ['0.1.0', '0.2.0', '0.1.1', '0.0.9', '0.3.0-rc.1']) assert.throws(() => validateVersionAdvance(version, published));
  assert.doesNotThrow(() => validateVersionAdvance('0.2.1', [published]));
  assert.doesNotThrow(() => validateVersionAdvance('0.1.1', { versions: '0.1.0', 'dist-tags': { latest: '0.1.0' } }));
  assert.throws(() => validateVersionAdvance('0.1.0', {}), /bootstrap/);
});

test('release pack verifies the real archive and rejects changed bytes or identity', t => {
  const root = mkdtempSync(join(tmpdir(), 'mstack-release-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const name of ['package.json', 'package-lock.json', 'CHANGELOG.md', 'LICENSE', 'tsconfig.json', 'extensions', 'generated', 'upstream', 'port', 'tools', 'scripts', 'tests', 'docs']) cpSync(name, join(root, name), { recursive: true });
  const version = metadata().pkg.version;
  const result = packRelease(root, `v${version}`);
  assert.deepEqual(verifyArtifact(root, `v${version}`), result);
  const archive = join(root, 'dist', result.filename);
  const entries = execFileSync('tar', ['-tzf', archive], { encoding: 'utf8' }).split('\n');
  for (const name of ['package/scripts/release.mjs', 'package/CHANGELOG.md', 'package/generated/index.json']) assert.ok(entries.includes(name));
  assert.ok(!entries.some(path => /^package\/(?:dist|\.github|node_modules|\.cache|\.pi)\//.test(path)));
  const recordPath = join(root, 'dist/release.json');
  writeFileSync(recordPath, JSON.stringify({ ...result, filename: '../other.tgz' }));
  assert.throws(() => verifyArtifact(root), /filename/);
  writeFileSync(recordPath, JSON.stringify(result));
  appendFileSync(archive, 'tampered');
  assert.throws(() => verifyArtifact(root), /integrity/);
});

test('release CLI rejects malformed requests without packing', t => {
  const root = mkdtempSync(join(tmpdir(), 'mstack-release-cli-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const args of [[], ['publish'], ['pack', '--tag'], ['check', '--other', 'v0.1.0'], ['pack', '--tag', 'v0.1.0', 'extra']]) {
    const result = spawnSync(process.execPath, [join(process.cwd(), 'scripts/release.mjs'), ...args], { cwd: root, encoding: 'utf8' });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Usage:/);
    assert.equal(existsSync(join(root, 'dist')), false);
  }
});

test('release workflow retains explicit publication and artifact verification gates', { skip: !existsSync('.github/workflows/release.yml') && 'Workflow definitions are checkout-only' }, () => {
  const text = readFileSync('.github/workflows/release.yml', 'utf8');
  assert.match(text, /workflow_dispatch:/);
  assert.match(text, /default: false/);
  assert.match(text, /if: inputs.publish && github.ref == 'refs\/heads\/main'/);
  assert.match(text, /environment: npm/);
  assert.ok(text.includes('test "$(git rev-parse HEAD)" = "$GITHUB_SHA"'));
  assert.match(text, /id-token: write/);
  assert.match(text, /ref: \$\{\{ needs.prepare.outputs.commit \}\}/);
  assert.match(text, /npm run release:verify -- --tag/);
  assert.match(text, /--ignore-scripts --access public --provenance/);
  assert.equal([...text.matchAll(/npm publish "\.\/dist\//g)].length, 2);
  assert.doesNotMatch(text, /pull_request_target|NODE_AUTH_TOKEN:|NPM_TOKEN/);
  for (const workflow of ['ci.yml', 'release.yml']) {
    const yaml = readFileSync(join('.github/workflows', workflow), 'utf8');
    for (const match of yaml.matchAll(/uses: ([^\s]+)/g)) assert.match(match[1], /^actions\/[\w-]+@[0-9a-f]{40}$/);
  }
});
