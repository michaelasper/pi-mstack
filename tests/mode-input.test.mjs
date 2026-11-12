import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { packed, isolated, captures, rpc, cli } from './helpers.mjs';

const artifact = packed();
after(() => rmSync(artifact.dir, { recursive: true, force: true }));
const routes = ['/poteto-mode\n', '/poteto-mode \n', '/potete-mode\n', '/poteto-mode ', '/skill:poteto-mode\n'];
const prompt = 'MULTILINE_TASK\nKeep "quotes", $variables, and /slashes unchanged.';

for (const mode of ['print', 'json']) {
  test(`${mode} short and multiline requests finish exactly once with mode and skill context`, { timeout: 60000 }, () => {
    for (const [i, route] of routes.entries()) {
      const dir = join(artifact.dir, `${mode}-${i}`); mkdirSync(dir);
      const iso = isolated(dir, artifact.packageRoot);
      const r = spawnSync(process.execPath, [cli, ...iso.args, ...(mode === 'print' ? ['-p'] : ['--mode', 'json']), route + prompt], { cwd: dir, env: iso.env, encoding: 'utf8', timeout: 15000 });
      assert.equal(r.status, 0, r.stderr);
      if (mode === 'json') {
        const events = r.stdout.trim().split('\n').map(JSON.parse);
        assert.ok(events.some(e => e.type === 'message_end' && e.message?.role === 'assistant' && e.message.stopReason === 'stop' && e.message.content.some(c => c.type === 'text' && c.text === 'scripted-complete')));
        assert.ok(events.some(e => e.type === 'agent_end'));
      } else assert.equal(r.stdout.trim(), 'scripted-complete');
      const requests = captures(iso.env);
      assert.equal(requests.length, 1);
      assert.match(requests[0].system, /<pi-mstack-mode>/);
      assert.match(requests[0].messages.at(-1).content[0].text, /<skill name="poteto-mode"/);
      assert.ok(requests[0].messages.at(-1).content[0].text.endsWith(prompt));
    }
  });
}

test('RPC multiline input and saved default preserve explicit branch overrides across new sessions', { timeout: 30000 }, async t => {
  const dir = join(artifact.dir, 'rpc-default'); mkdirSync(dir);
  const iso = isolated(dir, artifact.packageRoot);
  iso.args = iso.args.filter(arg => arg !== '--no-prompt-templates');
  const configPath = join(iso.agentDir, 'pstack/models.json');
  mkdirSync(join(iso.agentDir, 'pstack'));
  const roles = { 'how explorer': 'mstack-test/other:off' };
  writeFileSync(configPath, JSON.stringify({ version: 'pi-mstack/1', roles }));
  const client = rpc({ dir, ...iso }); t.after(() => client.stop());
  const commands = (await client.send('get_commands')).commands;
  for (const name of ['poteto-mode', 'potete-mode']) assert.ok(commands.some(c => c.name === name && c.source === 'prompt'));
  // An explicit off must persist even if mode was already off.
  await client.send('prompt', { message: '/poteto-mode off' });
  await client.send('prompt', { message: '/pstack default on' });
  assert.equal(captures(iso.env).length, 0);
  assert.deepEqual(JSON.parse(readFileSync(configPath)), { version: 'pi-mstack/1', roles, potetoModeDefault: true });
  await client.turn('EXPLICIT_OFF');
  assert.doesNotMatch(captures(iso.env).at(-1).system, /<pi-mstack-mode>/);
  const offSession = (await client.send('get_state')).sessionFile;
  await client.send('new_session');
  await client.turn('DEFAULT_ON');
  assert.match(captures(iso.env).at(-1).system, /<pi-mstack-mode>/);
  await client.send('prompt', { message: '/pstack default off' });
  await client.turn('DEFAULT_OFF');
  assert.doesNotMatch(captures(iso.env).at(-1).system, /<pi-mstack-mode>/);
  for (const route of routes) {
    await client.turn(route + prompt);
    assert.match(captures(iso.env).at(-1).system, /<pi-mstack-mode>/);
    assert.ok(captures(iso.env).at(-1).messages.at(-1).content[0].text.endsWith(prompt));
  }
  const images = [{ type: 'image', mimeType: 'image/png', data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC' }];
  const settled = client.wait(e => e.type === 'agent_settled');
  await client.send('prompt', { message: '/poteto-mode\nWITH_IMAGE', images });
  await settled;
  assert.deepEqual(captures(iso.env).at(-1).messages.at(-1).content.filter(c => c.type === 'image'), images);
  const original = readFileSync(configPath, 'utf8');
  await client.send('prompt', { message: '/pstack default maybe' });
  assert.equal(readFileSync(configPath, 'utf8'), original);
  await client.send('prompt', { message: '/pstack default on' });
  await client.send('switch_session', { sessionPath: offSession });
  await client.turn('RESUMED_OFF');
  assert.doesNotMatch(captures(iso.env).at(-1).system, /<pi-mstack-mode>/);
  const user = (await client.send('get_entries')).entries.find(e => e.type === 'message' && e.message.role === 'user' && JSON.stringify(e.message.content).includes('RESUMED_OFF'));
  assert.ok(user);
  await client.send('fork', { entryId: user.id });
  await client.turn('FORKED_OFF');
  assert.doesNotMatch(captures(iso.env).at(-1).system, /<pi-mstack-mode>/);
  await client.stop();
  const restarted = rpc({ dir, ...iso }); t.after(() => restarted.stop());
  await restarted.turn('RESTART_DEFAULT_ON');
  assert.match(captures(iso.env).at(-1).system, /<pi-mstack-mode>/);
  writeFileSync(configPath, '{invalid');
  await restarted.send('prompt', { message: '/pstack default off' });
  assert.equal(readFileSync(configPath, 'utf8'), '{invalid');
  assert.ok(restarted.records.some(e => e.method === 'notify' && /Refusing to overwrite/.test(e.message)));
});

test('foreign alias prompt blocks default mode without consuming its contents', { timeout: 30000 }, async t => {
  const dir = join(artifact.dir, 'prompt-collision'); mkdirSync(dir);
  const iso = isolated(dir, artifact.packageRoot);
  iso.args = iso.args.filter(arg => arg !== '--no-prompt-templates');
  mkdirSync(join(iso.agentDir, 'prompts'));
  writeFileSync(join(iso.agentDir, 'prompts/potete-mode.md'), '---\ndescription: Foreign alias\n---\nFOREIGN_ALIAS $@\n');
  mkdirSync(join(iso.agentDir, 'pstack'));
  writeFileSync(join(iso.agentDir, 'pstack/models.json'), JSON.stringify({ version: 'pi-mstack/1', roles: {}, potetoModeDefault: true }));
  const client = rpc({ dir, ...iso }); t.after(() => client.stop());
  await client.turn('/potete-mode off');
  const request = captures(iso.env).at(-1);
  assert.match(request.messages.at(-1).content[0].text, /FOREIGN_ALIAS off/);
  assert.doesNotMatch(request.system, /<pi-mstack-mode>/);
  assert.equal((await client.send('get_entries')).entries.filter(e => e.customType === 'pi-mstack/mode').length, 0);
  assert.ok(client.records.some(e => e.method === 'notify' && /collision/.test(e.message)));
});

test('TUI multiline short prompt completes under a PTY', { timeout: 30000 }, () => {
  const dir = join(artifact.dir, 'tui-multiline'); mkdirSync(dir);
  const iso = isolated(dir, artifact.packageRoot);
  const r = spawnSync('python3', [join(artifact.packageRoot, 'tests/pty-smoke.py'), process.execPath, cli, ...iso.args, '/poteto-mode \n' + prompt], { cwd: dir, env: iso.env, encoding: 'utf8', timeout: 20000 });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.equal(JSON.parse(r.stdout).completedOutput, true);
  assert.equal(captures(iso.env).length, 1);
  assert.match(captures(iso.env)[0].system, /<pi-mstack-mode>/);
});
