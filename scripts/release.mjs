import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const stableVersion = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const registry = 'https://registry.npmjs.org/';

export function validateRelease({ pkg, lock, changelog, tag }) {
  if (pkg.name !== 'pi-mstack' || !stableVersion.test(pkg.version)) throw Error('Expected pi-mstack with a stable SemVer version');
  if (pkg.private !== false || pkg.publishConfig?.access !== 'public' || pkg.publishConfig?.registry !== registry) throw Error('Public npm release configuration is missing');
  if (pkg.repository?.url !== 'https://github.com/michaelasper/pi-mstack.git') throw Error('Unexpected package repository');
  if (lock !== undefined && (!lock || lock.name !== pkg.name || lock.version !== pkg.version || lock.packages?.['']?.name !== pkg.name || lock.packages?.['']?.version !== pkg.version)) throw Error('package-lock.json and package.json versions must match');
  if (!changelog.split('\n').some(line => line === `## [${pkg.version}]` || line.startsWith(`## [${pkg.version}] - `))) throw Error(`Missing changelog section for ${pkg.version}`);
  if (tag !== undefined && tag !== `v${pkg.version}`) throw Error(`Release tag must be v${pkg.version}`);
  return { name: pkg.name, version: pkg.version, filename: `${pkg.name}-${pkg.version}.tgz` };
}

export function validateVersionAdvance(version, published) {
  const record = Array.isArray(published) && published.length === 1 ? published[0] : published;
  const latest = record?.['dist-tags']?.latest;
  const versions = typeof record?.versions === 'string' ? [record.versions] : record?.versions;
  if (!stableVersion.test(latest) || !Array.isArray(versions) || !stableVersion.test(version)) throw Error('Expected existing npm package with a stable latest version; bootstrap the first release manually');
  if (versions.includes(version)) throw Error(`Version ${version} is already published`);
  const next = version.split('.').map(BigInt), previous = latest.split('.').map(BigInt);
  for (let i = 0; i < next.length; i++) {
    if (next[i] > previous[i]) return;
    if (next[i] < previous[i]) break;
  }
  throw Error(`Version ${version} must be newer than npm latest ${latest}`);
}

export function releaseMetadata(root, tag) {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  const lock = JSON.parse(readFileSync(join(root, 'package-lock.json'), 'utf8'));
  const changelog = readFileSync(join(root, 'CHANGELOG.md'), 'utf8');
  return validateRelease({ pkg, lock, changelog, tag });
}

function integrity(path) {
  return 'sha512-' + createHash('sha512').update(readFileSync(path)).digest('base64');
}

export function verifyArtifact(root, tag) {
  const expected = releaseMetadata(root, tag);
  const record = JSON.parse(readFileSync(join(root, 'dist/release.json'), 'utf8'));
  for (const key of ['name', 'version', 'filename']) if (record[key] !== expected[key]) throw Error(`Artifact ${key} does not match release metadata`);
  const archive = join(root, 'dist', expected.filename);
  if (record.integrity !== integrity(archive)) throw Error('Artifact integrity mismatch');
  const pkg = JSON.parse(execFileSync('tar', ['-xOf', archive, 'package/package.json'], { encoding: 'utf8' }));
  const changelog = execFileSync('tar', ['-xOf', archive, 'package/CHANGELOG.md'], { encoding: 'utf8' });
  const actual = validateRelease({ pkg, changelog, tag: `v${expected.version}` });
  if (actual.name !== expected.name || actual.version !== expected.version) throw Error('Packed metadata does not match the release');
  return { ...expected, integrity: record.integrity };
}

export function packRelease(root, tag) {
  const expected = releaseMetadata(root, tag);
  execFileSync(process.execPath, ['tools/upstream.mjs', 'check'], { cwd: root, stdio: 'inherit' });
  const destination = join(root, 'dist');
  mkdirSync(destination, { recursive: true });
  const result = JSON.parse(execFileSync('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', destination], { cwd: root, encoding: 'utf8' }));
  const packed = Array.isArray(result) ? result[0] : result[expected.name];
  if (packed?.filename !== expected.filename || packed.integrity !== integrity(join(destination, expected.filename))) throw Error('Unexpected npm pack output');
  writeFileSync(join(destination, 'release.json'), JSON.stringify({ ...expected, integrity: packed.integrity }, null, 2) + '\n');
  return verifyArtifact(root, tag);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const [command, ...args] = process.argv.slice(2);
    if (!['check', 'pack', 'verify', 'available'].includes(command) || (args.length !== 0 && (args.length !== 2 || args[0] !== '--tag' || !args[1]))) throw Error('Usage: node scripts/release.mjs <check|pack|verify|available> [--tag vVERSION]');
    const root = process.cwd(), tag = args[1];
    let result;
    if (command === 'available') {
      result = releaseMetadata(root, tag);
      const published = JSON.parse(execFileSync('npm', ['view', result.name, 'versions', 'dist-tags', '--json', '--registry', registry], { encoding: 'utf8' }));
      validateVersionAdvance(result.version, published);
    } else result = command === 'check' ? releaseMetadata(root, tag) : command === 'pack' ? packRelease(root, tag) : verifyArtifact(root, tag);
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
