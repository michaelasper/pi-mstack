import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { packed, isolated, captures, rpc, cli } from './helpers.mjs';
import { validateSnapshot, walk, sha } from '../tools/importer.mjs';

const artifact = packed();
after(() => { if (!process.env.MSTACK_KEEP_TEST_ARTIFACTS) rmSync(artifact.dir, { recursive: true, force: true }); });

test('tarball preserves source inventory and discoverable skill names', () => {
  const root = artifact.packageRoot;
  validateSnapshot(join(root, 'upstream/pstack'), JSON.parse(readFileSync(join(root, 'upstream/manifest.json'))));
  const names = walk(join(root, 'generated/skills')).filter(p => /^[^/]+\/SKILL.md$/.test(p));
  assert.equal(names.length, 58);
  assert.ok(names.includes('make-bot-ui/SKILL.md'));
  assert.ok(!walk(join(root, 'generated')).some(p => p.includes('benny')));
});

test('packed maintenance check runs independently', () => {
  execFileSync(process.execPath, ['tools/upstream.mjs', 'check'], { cwd: artifact.packageRoot });
});

test('packed CLI exports source bytes, modes, visibility and license independently', () => {
  const root = artifact.packageRoot;
  const reconstructed = join(artifact.dir, 'reconstructed');
  execFileSync(process.execPath, ['tools/upstream.mjs', 'export', '--root', root, '--destination', reconstructed], { cwd: root });
  const manifest = JSON.parse(readFileSync(join(root, 'upstream/manifest.json')));
  assert.equal(walk(reconstructed).length, 573);
  for (const r of manifest.records) {
    assert.equal(sha(readFileSync(join(reconstructed, r.sourcePath))), r.sha256);
    assert.equal((statSync(join(reconstructed, r.sourcePath)).mode & 0o111) !== 0, r.gitMode === '100755');
    if (/^skills\/[^/]+\/SKILL.md$/.test(r.sourcePath)) {
      const source = readFileSync(join(reconstructed, r.sourcePath), 'utf8');
      const generated = readFileSync(join(root, 'generated', r.sourcePath), 'utf8');
      assert.equal(generated.match(/^name: (.+)$/m)?.[1], source.match(/^name: (.+)$/m)?.[1]);
      assert.equal(generated.match(/^disable-model-invocation: (.+)$/m)?.[1], source.match(/^disable-model-invocation: (.+)$/m)?.[1]);
    }
  }
  assert.deepEqual(readFileSync(join(root, 'LICENSE')), readFileSync(join(reconstructed, 'LICENSE')));
  assert.match(readFileSync(join(root, 'LICENSE'), 'utf8'), /MIT License/);
  assert.ok(existsSync(join(reconstructed, '.gitignore')));
});

test('advertised scripts reference shipped resources and tarball excludes private state', () => {
  const root = artifact.packageRoot;
  const pkg = JSON.parse(readFileSync(join(root, 'package.json')));
  for (const [name, script] of Object.entries(pkg.scripts)) {
    for (const path of script.match(/(?:tools|tests)\/[\w.*\/-]+/g) ?? []) {
      if (path.includes('*')) assert.ok(walk(root).some(p => p.startsWith(path.split('*')[0]) && p.endsWith(path.split('*')[1])), `${name}: ${path}`);
      else assert.ok(existsSync(join(root, path)), `${name}: ${path}`);
    }
    assert.ok(script.startsWith('node ') || script === 'tsc', `inspect new script ${name}`);
  }
  assert.ok(existsSync(join(root, 'tsconfig.json')));
  for (const path of walk(root)) assert.doesNotMatch(path, /(^|\/)(node_modules|\.cache|\.pi|\.git|\.env|auth\.json|capture\.jsonl)(\/|$)/);
});

function assertTask(env, packageRoot, task, native) {
  const request = captures(env).find(c => JSON.stringify(c.messages.at(-1)).includes(task));
  assert.ok(request, `captured task ${task}`);
  if (native) {
    assert.ok(JSON.stringify(request.messages).includes(join(packageRoot, 'generated/skills/poteto-mode/SKILL.md')));
    assert.match(request.system, /<pi-mstack-mode>/);
    assert.ok(request.system.includes(join(packageRoot, 'generated/skills/poteto-mode/SKILL.md')));
  }
}

test('headless setup and task-bearing short command never infer or write config', () => {
  const dir = join(artifact.dir, 'headless'); mkdirSync(dir);
  const iso = isolated(dir, artifact.packageRoot);
  for (const command of ['/setup-pstack', '/poteto-mode SHORT_TASK']) {
    const result = spawnSync(process.execPath, [cli, ...iso.args, '-p', command], { cwd: dir, env: iso.env, encoding: 'utf8', timeout: 15000 });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(captures(iso.env).length, 0);
    assert.equal(existsSync(join(iso.agentDir, 'pstack/models.json')), false);
    assert.match(result.stderr, /No changes written|unsupported/);
  }
});

test('real CLI prototype records one-shot forwarding lifetime and native baseline', () => {
  for (const mode of ['print', 'json']) {
    for (const route of ['prototype-forward', 'skill:poteto-mode']) {
      const dir = join(artifact.dir, `${mode}-${route.replace(':', '-')}`); mkdirSync(dir);
      const iso = isolated(dir, artifact.packageRoot);
      const result = spawnSync(process.execPath, [cli, ...iso.args, '-e', join(artifact.packageRoot, 'tests/fixtures/prototype.ts'), ...(mode === 'print' ? ['-p'] : ['--mode', 'json']), `/${route} PROTOTYPE_TASK`], { cwd: dir, env: iso.env, encoding: 'utf8', timeout: 15000 });
      assert.equal(result.status, 0, result.stderr);
      if (route === 'skill:poteto-mode') {
        assertTask(iso.env, artifact.packageRoot, 'PROTOTYPE_TASK', true);
        if (mode === 'json') {
          const events = result.stdout.trim().split('\n').map(JSON.parse);
          assert.ok(events.some(e => e.type === 'message_end' && e.message?.role === 'assistant' && e.message.stopReason === 'stop' && e.message.content.some(c => c.type === 'text' && c.text === 'scripted-complete')));
          assert.ok(events.some(e => e.type === 'agent_end'));
        } else assert.match(result.stdout, /scripted-complete/);
      }
      process.stdout.write(`prototype ${mode} ${route}: completed-output=${result.stdout.includes('scripted-complete')} requests=${captures(iso.env).length}\n`);
    }
  }
});

test('real TUI prototype and native baseline complete through a PTY', { timeout: 40000 }, () => {
  for (const route of ['prototype-forward', 'skill:poteto-mode']) {
    const dir = join(artifact.dir, 'tui-' + route.replace(':', '-')); mkdirSync(dir);
    const iso = isolated(dir, artifact.packageRoot);
    const result = spawnSync('python3', [join(artifact.packageRoot, 'tests/pty-smoke.py'), process.execPath, cli, ...iso.args, '-e', join(artifact.packageRoot, 'tests/fixtures/prototype.ts'), `/${route} TUI_PROTOTYPE`], { cwd: dir, env: iso.env, encoding: 'utf8', timeout: 20000 });
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.equal(JSON.parse(result.stdout).completedOutput, true);
    assert.equal(JSON.parse(result.stdout).processExited, true);
    assertTask(iso.env, artifact.packageRoot, 'TUI_PROTOTYPE', route === 'skill:poteto-mode');
  }
});

test('real RPC packed mode, roles while off, busy refusal and retry, resume and collision refusal', { timeout: 45000 }, async t => {
  const dir = join(artifact.dir, 'rpc'); mkdirSync(dir);
  const iso = isolated(dir, artifact.packageRoot);
  const client = rpc({ dir, ...iso, args: [...iso.args, '-e', join(artifact.packageRoot, 'tests/fixtures/prototype.ts')] }); t.after(() => client.stop());
  let prototypeSettled = client.wait(e => e.type === 'agent_settled');
  assert.equal((await client.send('prompt', { message: '/prototype-forward RPC_PROTOTYPE' })).disposition, 'handled');
  await prototypeSettled;
  assert.ok(captures(iso.env).some(c => JSON.stringify(c.messages).includes('RPC_PROTOTYPE')));
  await client.send('new_session');
  const commands = (await client.send('get_commands')).commands;
  assert.equal(commands.filter(c => c.source === 'skill').length, 58);
  assert.equal((await client.send('prompt', { message: '/poteto-mode' })).disposition, 'handled');
  await client.send('prompt', { message: '/poteto-mode' });
  assert.equal((await client.send('get_entries')).entries.filter(e => e.customType === 'pi-mstack/mode').length, 1);
  await client.turn('MODE_ON');
  assert.match(captures(iso.env).at(-1).system, /<pi-mstack-mode>/);
  await client.send('prompt', { message: '/skill:poteto-mode off' });
  mkdirSync(join(iso.agentDir, 'pstack'), { recursive: true });
  writeFileSync(join(iso.agentDir, 'pstack/models.json'), JSON.stringify({ version: 'pi-mstack/1', roles: { 'how explorer': 'mstack-test/other:off' } }));
  await client.turn('/skill:how MODE_OFF');
  assert.doesNotMatch(captures(iso.env).at(-1).system, /<pi-mstack-mode>/);
  assert.match(captures(iso.env).at(-1).system, /how explorer: mstack-test\/other:off/);
  const settled = client.wait(e => e.type === 'agent_settled');
  await client.send('prompt', { message: 'BUSY' });
  assert.equal((await client.send('prompt', { message: '/skill:poteto-mode REFUSED_FOLLOW_UP', streamingBehavior: 'followUp' })).disposition, 'handled');
  await settled;
  assert.ok(!captures(iso.env).some(c => JSON.stringify(c.messages).includes('REFUSED_FOLLOW_UP')));
  assert.doesNotMatch(captures(iso.env).at(-1).system, /<pi-mstack-mode>/);
  assert.ok(client.records.some(e => e.method === 'notify' && /request refused while the agent is busy/.test(e.message)));
  await client.turn('/skill:poteto-mode RETRIED_FOLLOW_UP');
  assert.match(JSON.stringify(captures(iso.env).at(-1).messages), /RETRIED_FOLLOW_UP/);
  assert.match(captures(iso.env).at(-1).system, /<pi-mstack-mode>/);
  prototypeSettled = client.wait(e => e.type === 'agent_settled');
  await client.send('prompt', { message: 'BUSY_PROTOTYPE' });
  assert.equal((await client.send('prompt', { message: '/prototype-forward RPC_BUSY_PROTOTYPE' })).disposition, 'handled');
  await prototypeSettled;
  assert.ok(captures(iso.env).some(c => JSON.stringify(c.messages).includes('RPC_BUSY_PROTOTYPE')));
  const file = (await client.send('get_state')).sessionFile;
  await client.send('new_session');
  await client.turn('FRESH');
  assert.doesNotMatch(captures(iso.env).at(-1).system, /<pi-mstack-mode>/);
  await client.send('switch_session', { sessionPath: file });
  await client.turn('RESUMED');
  assert.match(captures(iso.env).at(-1).system, /<pi-mstack-mode>/);
  const user = (await client.send('get_entries')).entries.find(e => e.type === 'message' && e.message.role === 'user' && JSON.stringify(e.message.content).includes('RESUMED'));
  assert.ok(user);
  await client.send('fork', { entryId: user.id });
  await client.turn('FORK_INHERITS');
  assert.match(captures(iso.env).at(-1).system, /<pi-mstack-mode>/);
  await client.send('prompt', { message: '/poteto-mode off' });
  await client.turn('FORK_OFF');
  assert.doesNotMatch(captures(iso.env).at(-1).system, /<pi-mstack-mode>/);
  await client.stop();

  const collisionDir = join(artifact.dir, 'collision'); mkdirSync(collisionDir);
  const collision = isolated(collisionDir, artifact.packageRoot);
  const competing = join(collisionDir, 'other.ts');
  writeFileSync(competing, 'export default pi => { pi.registerCommand("poteto-mode", { handler: async () => {} }); }');
  const other = rpc({ dir: collisionDir, ...collision, args: [...collision.args, '-e', competing] }); t.after(() => other.stop());
  const listed = (await other.send('get_commands')).commands;
  const own = listed.find(c => c.source === 'extension' && c.name.startsWith('poteto-mode:') && c.sourceInfo.path.includes('/package/'));
  assert.ok(own);
  await other.send('prompt', { message: '/' + own.name });
  assert.equal((await other.send('get_entries')).entries.filter(e => e.customType === 'pi-mstack/mode').length, 0);
  assert.ok(other.records.some(e => JSON.stringify(e).includes('collision')));
  await other.send('prompt', { message: '/' + own.name + ' off' });
  assert.equal((await other.send('get_entries')).entries.filter(e => e.customType === 'pi-mstack/mode').length, 0);
  await other.stop();

  const skillDir = join(artifact.dir, 'skill-collision'); mkdirSync(skillDir);
  const skillIso = isolated(skillDir, artifact.packageRoot);
  const foreign = join(skillIso.agentDir, 'skills/poteto-mode'); mkdirSync(foreign, { recursive: true });
  writeFileSync(join(foreign, 'SKILL.md'), '---\nname: poteto-mode\ndescription: foreign skill\n---\nFOREIGN_SKILL\n');
  const skillClient = rpc({ dir: skillDir, ...skillIso }); t.after(() => skillClient.stop());
  await skillClient.send('get_commands');
  await skillClient.turn('/skill:poteto-mode off');
  assert.match(JSON.stringify(captures(skillIso.env).at(-1).messages), /FOREIGN_SKILL/);
  assert.equal((await skillClient.send('get_entries')).entries.filter(e => e.customType === 'pi-mstack/mode').length, 0);
  assert.ok(skillClient.records.some(e => JSON.stringify(e).includes(foreign)));
});
