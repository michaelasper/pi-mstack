import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { packed } from './helpers.mjs';
import { createBashToolDefinition, SessionManager } from '@earendil-works/pi-coding-agent';

const artifact = packed();
after(() => { if (!process.env.MSTACK_KEEP_TEST_ARTIFACTS) rmSync(artifact.dir, { recursive: true, force: true }); });
const adapter = readFileSync(join(artifact.packageRoot, 'generated/docs/harness/pi.md'), 'utf8');
const gates = [
  ['Shipping without independent product verification', /Missing independent real-product verification blocks Shipping before merge\./],
  ['required UI verification without control', /Missing control-ui blocks required UI verification until a demonstrated equivalent exists\./],
  ['unavailable explicit reviewer', /An unavailable explicit reviewer blocks that review and dependent actions\./],
  ['optional missing evidence', /Optional unavailable evidence stays labeled missing and may be skipped only when no mandatory gate depends on it\./],
];
for (const [scenario, instruction] of gates) {
  test(`packed adapter prose gate, not model behavior: ${scenario}`, () => {
    assert.match(adapter, instruction);
    assert.match(adapter, /A substitute must satisfy the original requirement with retained evidence\./);
    assert.match(adapter, /Do not label placeholders as verdicts\./);
    const mode = readFileSync(join(artifact.packageRoot, 'generated/skills/poteto-mode/SKILL.md'), 'utf8');
    assert.match(mode, /docs\/harness\/pi\.md/);
  });
}

test('packed mapping instructions defer to runtime guidance without granting authority', () => {
  assert.match(adapter, /Use the question mapping in the pi-mstack-mappings section when present/);
  assert.match(adapter, /Recheck that the tool is actually declared and available/);
  assert.match(adapter, /ask a plain question/);
  assert.match(adapter, /not capabilities, authentication, review verdicts, or merge authority/);
  assert.match(adapter, /absent CLI, failed or ambiguous result, or nonmember PR blocks/);
});

test('packed authoring procedure and destinations are Pi-native prose, not model compliance', () => {
  const skills = join(artifact.packageRoot, 'generated/skills');
  for (const path of readdirSync(skills, { recursive: true }).filter(path => path.endsWith('.md'))) {
    const text = readFileSync(join(skills, path), 'utf8');
    assert.doesNotMatch(text, /create-skill|\.cursor\/skills\//, path);
  }
  const procedure = readFileSync(join(skills, 'poteto-mode/playbooks/authoring-a-skill.md'), 'utf8');
  for (const pattern of [/\.agents\/skills\/<name>\/SKILL\.md/, /~\/\.agents\/skills\//, /name.*description/, /\/reload/, /\/skill:name/, /negative/, /retained evidence/]) assert.match(procedure, pattern);
  assert.match(readFileSync(join(skills, 'create-verification-skill/SKILL.md'), 'utf8'), /\.agents\/skills\/verify-<app>\/SKILL\.md/);
  assert.match(readFileSync(join(skills, 'maintain-verification-skill/SKILL.md'), 'utf8'), /\.agents\/skills\/verify-\*/);
});

test('packed transcript instructions require exact authorized Pi paths, not model compliance', () => {
  for (const path of ['recall/SKILL.md', 'reflect/SKILL.md', 'automate-me/SKILL.md', 'show-me-your-work/SKILL.md', 'poteto-mode/playbooks/session-pickup.md', 'poteto-mode/playbooks/eval.md']) {
    const text = readFileSync(join(artifact.packageRoot, 'generated/skills', path), 'utf8');
    assert.doesNotMatch(text, /agent-transcripts|\.cursor\/projects|ls -t/, path);
    assert.match(text, /exact.*path/i, path);
  }
  assert.match(adapter, /printf '%s\\n' "\$\{PI_SESSION_FILE:-\}"/);
  assert.match(adapter, /unset.*ephemeral/i);
  assert.match(adapter, /Cross-chat mining without an authorized corpus is blocked/);
  assert.match(adapter, /header.*cwd/);
  assert.match(adapter, /getBranch\(\)/);
  assert.match(adapter, /Never.*glob.*sessions/i);
});


test('documented acquisition command uses the installed Pi shell session API', async () => {
  const path = join(artifact.dir, 'authorized session.jsonl');
  const header = { type: 'session', version: 3, id: 'acquisition-test', timestamp: new Date().toISOString(), cwd: artifact.dir };
  writeFileSync(path, JSON.stringify(header) + '\n');
  const sessionManager = SessionManager.open(path);
  const command = `printf '%s\\n' "\${PI_SESSION_FILE:-}"`;
  const context = { cwd: artifact.dir, sessionManager };
  const tool = createBashToolDefinition(artifact.dir);
  const result = await tool.execute('path', { command }, undefined, undefined, context);
  assert.equal(result.isError, undefined);
  assert.equal(result.content[0].text.trim(), path);
  const firstLine = await tool.execute('header', { command: 'head -n 1 -- "$PI_SESSION_FILE"' }, undefined, undefined, context);
  assert.deepEqual(JSON.parse(firstLine.content[0].text), header);
  for (const [shell, manager] of [[tool, SessionManager.inMemory(artifact.dir)], [createBashToolDefinition(artifact.dir, { exposeSessionEnvironment: false }), sessionManager]]) {
    const missing = await shell.execute('missing', { command }, undefined, undefined, { cwd: artifact.dir, sessionManager: manager });
    assert.equal(missing.content[0].text.trim(), '');
  }
});
