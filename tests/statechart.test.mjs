import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdirSync, readFileSync, realpathSync, rmSync, symlinkSync } from 'node:fs';
import { join, relative } from 'node:path';
import { spawnSync } from 'node:child_process';
import { packed } from './helpers.mjs';

const scriptsPath = 'generated/skills/statechart/scripts';

test('packed statechart checks broken and fixed models with live TLC', { skip: !process.env.MSTACK_LIVE_TLC, timeout: 120000 }, t => {
  assert.ok(process.env.TLA2TOOLS, 'TLA2TOOLS must name the checksum-verified TLC jar');
  const artifact = packed();
  t.after(() => rmSync(artifact.dir, { recursive: true, force: true }));
  const installed = join(artifact.dir, 'live/node_modules/pi-mstack');
  cpSync(artifact.packageRoot, installed, { recursive: true });
  const scripts = join(installed, scriptsPath);
  for (const [fixture, status] of [['MediaPlayer', 1], ['MediaPlayerFixed', 0]]) {
    const corpus = join(scripts, 'test/corpus', fixture);
    const out = join(artifact.dir, fixture);
    const result = spawnSync(join(scripts, 'statechart'), [join(corpus, `${fixture}.tla`), '--view', join(corpus, 'view.mjs'), '--out', out], {
      encoding: 'utf8', timeout: 55000,
    });
    assert.equal(result.status, status, result.stdout + result.stderr + String(result.error ?? ''));
    assert.equal(result.stderr, '');
    for (const file of ['chart.mmd', 'report.md']) assert.equal(readFileSync(join(out, file), 'utf8'), readFileSync(join(corpus, file), 'utf8'));
  }
});

test('statechart offline CLI and recorded-output regressions', { timeout: 120000 }, () => {
  const env = { ...process.env, TLA2TOOLS: '' };
  delete env.NODE_TEST_CONTEXT;
  const result = spawnSync(process.execPath, ['--test', `${scriptsPath}/test/cli.test.ts`, `${scriptsPath}/test/tlc-out.test.ts`], {
    encoding: 'utf8', timeout: 110000,
    env,
  });
  assert.equal(result.status, 0, result.stdout + result.stderr + String(result.error ?? ''));
  assert.match(result.stdout, /tests 127\b/);
});

test('packed statechart runs beneath node_modules, directly and through symlinks', { timeout: 30000 }, t => {
  const artifact = packed();
  t.after(() => rmSync(artifact.dir, { recursive: true, force: true }));
  const installed = join(artifact.dir, 'installation with spaces/node_modules/pi-mstack');
  cpSync(artifact.packageRoot, installed, { recursive: true });
  const scripts = join(installed, scriptsPath);
  const links = join(realpathSync(artifact.dir), 'links');
  mkdirSync(links);
  symlinkSync(relative(links, realpathSync(join(scripts, 'statechart'))), join(links, 'relative'));
  symlinkSync(join(links, 'relative'), join(links, 'absolute'));
  for (const [name, command] of [['direct', join(scripts, 'statechart')], ['symlink', join(links, 'absolute')]]) {
    for (const [fixture, status] of [['MediaPlayer', 1], ['MediaPlayerFixed', 0]]) {
      const corpus = join(scripts, 'test/corpus', fixture);
      const out = join(artifact.dir, `${name}-${fixture}`);
      const result = spawnSync(command, [join(corpus, `${fixture}.tla`), '--view', join(corpus, 'view.mjs'), '--out', out], {
        encoding: 'utf8', timeout: 10000,
        env: { ...process.env, TLA2TOOLS: 'replayed-not-live.jar', JAVA: join(artifact.packageRoot, scriptsPath, 'test/java.ts'), STATECHART_REPLAY: corpus },
      });
      assert.equal(result.status, status, result.stdout + result.stderr + String(result.error ?? ''));
      assert.equal(result.stderr, '');
      for (const file of ['chart.mmd', 'report.md']) assert.equal(readFileSync(join(out, file), 'utf8'), readFileSync(join(corpus, file), 'utf8'));
    }
  }
});
