import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { arch, platform, release, tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { cli } from '../tests/helpers.mjs';

const packageName = '@earendil-works/pi-coding-agent';
const unavailable = reason => ({ unavailable: reason });
const present = name => Object.hasOwn(process.env, name);

function packageVersion(path) {
  try {
    const pkg = JSON.parse(readFileSync(path, 'utf8'));
    if (pkg.name !== packageName) return unavailable('name-mismatch');
    return typeof pkg.version === 'string' && pkg.version ? pkg.version : unavailable('invalid-version');
  } catch (error) {
    return unavailable(error.code === 'ENOENT' ? 'not-found' : 'unreadable-package');
  }
}

function sdkObservation() {
  let entry;
  try {
    entry = fileURLToPath(import.meta.resolve(packageName));
  } catch {
    return { entry: unavailable('not-found'), packageVersion: unavailable('not-found') };
  }
  let directory = dirname(entry);
  for (let depth = 0; depth < 12; depth++) {
    const version = packageVersion(join(directory, 'package.json'));
    if (typeof version === 'string' || version.unavailable === 'invalid-version') return { entry, packageVersion: version };
    const parent = dirname(directory);
    if (parent === directory) break;
    directory = parent;
  }
  return { entry, packageVersion: unavailable('not-found') };
}

function versionObservation() {
  let scratch;
  try {
    scratch = mkdtempSync(join(tmpdir(), 'mstack-attribution-'));
    const home = join(scratch, 'home'), agent = join(scratch, 'agent');
    mkdirSync(home);
    mkdirSync(agent);
    const result = spawnSync(process.execPath, [cli, '--version'], {
      cwd: scratch,
      env: { PATH: process.env.PATH, HOME: home, PI_CODING_AGENT_DIR: agent, TMPDIR: scratch, PI_OFFLINE: '1', NO_COLOR: '1', TERM: 'dumb' },
      encoding: 'utf8', timeout: 10000, maxBuffer: 4096, killSignal: 'SIGKILL',
    });
    if (result.error) return unavailable(result.error.code === 'ETIMEDOUT' ? 'timeout' : result.error.code === 'ENOBUFS' ? 'output-limit' : 'spawn-error');
    if (result.status !== 0) return unavailable('exit-nonzero');
    const line = result.stdout.trim().split(/\r?\n/, 1)[0].replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, '').trim();
    return line || unavailable('empty-output');
  } catch {
    return unavailable('spawn-error');
  } finally {
    if (scratch) rmSync(scratch, { recursive: true, force: true });
  }
}

function repositoryObservation() {
  const options = { encoding: 'utf8', timeout: 10000, maxBuffer: 1024 * 1024, killSignal: 'SIGKILL' };
  const commit = spawnSync('git', ['rev-parse', 'HEAD'], options);
  const status = spawnSync('git', ['status', '--porcelain'], options);
  return {
    commit: !commit.error && commit.status === 0 ? commit.stdout.trim() : unavailable('git-unavailable'),
    dirty: !status.error && status.status === 0 ? Boolean(status.stdout.trim()) : unavailable('git-unavailable'),
  };
}

const args = process.argv.slice(2);
if (args.length !== 0 && (args.length !== 2 || args[0] !== '--output' || !args[1] || args[1].startsWith('--'))) {
  console.error('Usage: node scripts/attribution.mjs [--output <path>]');
  process.exitCode = 1;
} else {
  const manifest = {
    schema: 'pi-mstack/attribution/1',
    generatedAt: new Date().toISOString(),
    repository: repositoryObservation(),
    node: { version: process.version, executable: process.execPath },
    os: { platform: platform(), architecture: arch(), release: release() },
    cli: { override: present('MSTACK_PI_CLI'), path: cli, packageVersion: packageVersion(resolve(dirname(cli), '../../package.json')), versionOutput: versionObservation() },
    sdk: sdkObservation(),
    ambient: { MSTACK_PI_CLI: present('MSTACK_PI_CLI'), PI_PACKAGE_DIR: present('PI_PACKAGE_DIR') },
  };
  const json = JSON.stringify(manifest, null, 2) + '\n';
  try {
    if (args.length) writeFileSync(args[1], json);
    else process.stdout.write(json);
  } catch {
    console.error('Cannot write attribution manifest.\nUsage: node scripts/attribution.mjs [--output <path>]');
    process.exitCode = 1;
  }
}
