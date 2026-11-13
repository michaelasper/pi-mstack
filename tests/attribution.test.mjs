import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const script = resolve('scripts/attribution.mjs');
const env = { PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: tmpdir() };
const pinned = JSON.parse(readFileSync('package.json', 'utf8')).devDependencies['@earendil-works/pi-coding-agent'];
function temporary(t) {
  const dir = mkdtempSync(join(tmpdir(), 'mstack-attribution-test-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}
function fixture(dir, source, name = '@earendil-works/pi-coding-agent') {
  mkdirSync(join(dir, 'dist/bundle'), { recursive: true });
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name, version: '9.8.7', type: 'module' }));
  const cli = join(dir, 'dist/bundle/cli.js');
  writeFileSync(cli, source);
  return cli;
}
function run(args = [], extra = {}, cwd = process.cwd(), entry = script) {
  return spawnSync(process.execPath, [entry, ...args], { cwd, env: { ...env, ...extra }, encoding: 'utf8', timeout: 20000 });
}
function manifest(result) {
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

test('default CLI and SDK observations agree with pinned resolution and helpers', t => {
  const dir = temporary(t), output = join(dir, 'manifest.json');
  const result = run(['--output', output]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, '');
  const value = JSON.parse(readFileSync(output, 'utf8'));
  assert.equal(value.schema, 'pi-mstack/attribution/1');
  assert.equal(value.cli.override, false);
  assert.equal(value.cli.packageVersion, pinned);
  assert.equal(value.cli.versionOutput, pinned);
  assert.equal(value.sdk.packageVersion, pinned);
  assert.equal(value.repository.commit, execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim());
  assert.equal(typeof value.repository.dirty, 'boolean');
  const helper = execFileSync(process.execPath, ['--input-type=module', '-e', "import { cli } from './tests/helpers.mjs'; console.log(cli)"], { env, encoding: 'utf8' }).trim();
  assert.equal(value.cli.path, helper);
  assert.notEqual(value.cli.path, value.sdk.entry);
});

test('override keeps package and output separate and excludes ambient poisoning', t => {
  const dir = temporary(t);
  const cli = fixture(dir, `
    import assert from 'node:assert/strict';
    import { existsSync, realpathSync } from 'node:fs';
    assert.equal(process.argv[2], '--version');
    for (const key of ['PI_PACKAGE_DIR', 'SENTINEL_SECRET', 'NODE_OPTIONS', 'MSTACK_PI_CLI']) assert.equal(process.env[key], undefined);
    assert.equal(process.env.PI_OFFLINE, '1');
    assert.ok(existsSync(process.env.HOME));
    assert.ok(existsSync(process.env.PI_CODING_AGENT_DIR));
    assert.equal(process.cwd(), realpathSync(process.env.TMPDIR));
    console.log('  printed-7.6.5\\u0007\\u202e  ');
  `);
  const extra = { MSTACK_PI_CLI: cli, PI_PACKAGE_DIR: '/bogus/package', SENTINEL_SECRET: 'secret-not-for-manifest' };
  const result = run([], extra), value = manifest(result);
  assert.equal(value.cli.override, true);
  assert.equal(value.cli.path, cli);
  assert.equal(value.cli.packageVersion, '9.8.7');
  assert.equal(value.cli.versionOutput, 'printed-7.6.5');
  assert.equal(value.sdk.packageVersion, pinned);
  assert.deepEqual(value.ambient, { MSTACK_PI_CLI: true, PI_PACKAGE_DIR: true });
  assert.ok(!result.stdout.includes('secret-not-for-manifest'));
  assert.ok(!result.stdout.includes('/bogus/package'));
  const helper = execFileSync(process.execPath, ['--input-type=module', '-e', "import { cli } from './tests/helpers.mjs'; console.log(cli)"], { env: { ...env, ...extra }, encoding: 'utf8' }).trim();
  assert.equal(value.cli.path, helper);
});

test('unavailable CLI observations still write evidence without fallback', t => {
  const dir = temporary(t), output = join(dir, 'manifest.json');
  const missing = run(['--output', output], { MSTACK_PI_CLI: join(dir, 'missing/dist/bundle/cli.js') });
  assert.equal(missing.status, 0);
  const value = JSON.parse(readFileSync(output, 'utf8'));
  assert.deepEqual(value.cli.packageVersion, { unavailable: 'not-found' });
  assert.deepEqual(value.cli.versionOutput, { unavailable: 'exit-nonzero' });
  assert.equal(value.sdk.packageVersion, pinned);
  const cli = fixture(dir, 'process.exit(3)', 'wrong-package');
  const failed = manifest(run([], { MSTACK_PI_CLI: cli }));
  assert.deepEqual(failed.cli.packageVersion, { unavailable: 'name-mismatch' });
  assert.deepEqual(failed.cli.versionOutput, { unavailable: 'exit-nonzero' });
  assert.equal(failed.sdk.packageVersion, pinned);
});

test('stdout has no implicit destination outside a checkout', t => {
  const dir = temporary(t), value = manifest(run([], {}, dir));
  assert.deepEqual(readdirSync(dir), []);
  assert.deepEqual(value.repository.commit, { unavailable: 'git-unavailable' });
  assert.deepEqual(value.repository.dirty, { unavailable: 'git-unavailable' });
});

test('usage and destination failures exit nonzero', t => {
  const dir = temporary(t);
  for (const args of [['--unknown'], ['--output'], ['--output', dir], ['--output', join(dir, 'missing/out.json')]]) {
    const result = run(args);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Usage:/);
  }
});

test('version probe bounds stdout, stderr, and a SIGTERM-resistant process', t => {
  const dir = temporary(t);
  for (const source of ["process.stdout.write('x'.repeat(100000))", "process.stderr.write('x'.repeat(100000))"]) {
    const cli = fixture(dir, source);
    assert.deepEqual(manifest(run([], { MSTACK_PI_CLI: cli })).cli.versionOutput, { unavailable: 'output-limit' });
  }
  const cli = fixture(dir, "process.on('SIGTERM', () => {}); setInterval(() => {}, 1000)");
  assert.deepEqual(manifest(run([], { MSTACK_PI_CLI: cli })).cli.versionOutput, { unavailable: 'timeout' });
});

test('missing SDK stays unavailable without importing or substituting CLI metadata', t => {
  const dir = temporary(t);
  mkdirSync(join(dir, 'scripts'));
  mkdirSync(join(dir, 'tests'));
  copyFileSync(script, join(dir, 'scripts/attribution.mjs'));
  copyFileSync(resolve('tests/helpers.mjs'), join(dir, 'tests/helpers.mjs'));
  const cli = fixture(join(dir, 'fake'), "console.log('9.8.7')");
  const value = manifest(run([], { MSTACK_PI_CLI: cli }, dir, join(dir, 'scripts/attribution.mjs')));
  assert.deepEqual(value.sdk, { entry: { unavailable: 'not-found' }, packageVersion: { unavailable: 'not-found' } });
  const sdk = join(dir, 'node_modules/@earendil-works/pi-coding-agent');
  mkdirSync(sdk, { recursive: true });
  writeFileSync(join(sdk, 'package.json'), JSON.stringify({ name: '@earendil-works/pi-coding-agent', version: '6.5.4', exports: './entry.mjs' }));
  writeFileSync(join(sdk, 'entry.mjs'), "throw Error('SDK must not be imported')");
  const resolved = manifest(run([], { MSTACK_PI_CLI: cli }, dir, join(dir, 'scripts/attribution.mjs')));
  assert.equal(resolved.sdk.entry, realpathSync(join(sdk, 'entry.mjs')));
  assert.equal(resolved.sdk.packageVersion, '6.5.4');
});
