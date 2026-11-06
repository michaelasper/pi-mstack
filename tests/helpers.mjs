import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';

export const cli = resolve('node_modules/@earendil-works/pi-coding-agent/dist/bundle/cli.js');
export function packed() {
  const dir = mkdtempSync(join(tmpdir(), 'mstack-packed-'));
  const result = JSON.parse(execFileSync('npm', ['pack', '--json', '--ignore-scripts', '--pack-destination', dir], { encoding: 'utf8' }));
  execFileSync('tar', ['-xzf', join(dir, (Array.isArray(result) ? result[0] : result['pi-mstack']).filename), '-C', dir]);
  return { dir, packageRoot: join(dir, 'package') };
}
export function isolated(dir, packageRoot, extra = {}) {
  const agentDir = join(dir, 'agent');
  mkdirSync(agentDir, { recursive: true });
  const settings = { packages: [packageRoot], defaultProvider: 'mstack-test', defaultModel: 'script/model', defaultThinkingLevel: 'off', cacheWarming: 'off', compaction: { enabled: false }, retry: { enabled: false }, defaultProjectTrust: 'never', enableInstallTelemetry: false, ...extra };
  writeFileSync(join(agentDir, 'settings.json'), JSON.stringify(settings));
  const env = { PATH: process.env.PATH, HOME: dir, TMPDIR: tmpdir(), PI_CODING_AGENT_DIR: agentDir, PI_OFFLINE: '1', MSTACK_CAPTURE: join(dir, 'capture.jsonl'), NO_COLOR: '1', TERM: 'xterm-256color' };
  const args = ['--offline', '--no-context-files', '--no-prompt-templates', '--no-themes', '--no-mcp', '-e', join(packageRoot, 'tests/fixtures/provider.ts'), '--model', 'mstack-test/script/model:off'];
  return { agentDir, settings, env, args };
}
export function captures(env) {
  return existsSync(env.MSTACK_CAPTURE) ? readFileSync(env.MSTACK_CAPTURE, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse) : [];
}
export function rpc({ dir, env, args }) {
  const child = spawn(process.execPath, [cli, '--mode', 'rpc', ...args], { cwd: dir, env, stdio: ['pipe', 'pipe', 'pipe'] });
  let buffer = '', stderr = '', id = 0;
  const records = [], waiters = new Set();
  child.stderr.on('data', chunk => { stderr += chunk; });
  child.stdout.on('data', chunk => {
    buffer += chunk;
    let i;
    while ((i = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, i); buffer = buffer.slice(i + 1);
      if (!line.trim()) continue;
      const value = JSON.parse(line); records.push(value);
      for (const waiter of [...waiters]) waiter(value);
    }
  });
  function wait(predicate, timeout = 15000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { waiters.delete(listener); reject(Error(`RPC timeout. ${stderr}`)); }, timeout);
      function listener(value) { if (predicate(value)) { clearTimeout(timer); waiters.delete(listener); resolve(value); } }
      waiters.add(listener);
    });
  }
  async function send(type, fields = {}) {
    const requestId = String(++id), response = wait(v => v.type === 'response' && v.id === requestId);
    child.stdin.write(JSON.stringify({ id: requestId, type, ...fields }) + '\n');
    const result = await response;
    assert.equal(result.success, true, result.error);
    return result.data;
  }
  async function turn(message) {
    const settled = wait(v => v.type === 'agent_settled');
    const response = await send('prompt', { message });
    assert.notEqual(response.disposition, 'handled');
    await settled;
  }
  async function stop() {
    if (child.exitCode !== null || child.signalCode !== null) return;
    child.stdin.end();
    await new Promise(resolve => { const timer = setTimeout(() => child.kill('SIGKILL'), 3000); child.once('exit', () => { clearTimeout(timer); resolve(); }); });
  }
  function respond(id, fields) { child.stdin.write(JSON.stringify({ type: 'extension_ui_response', id, ...fields }) + '\n'); }
  return { child, wait, send, turn, stop, respond, records, stderr: () => stderr };
}
