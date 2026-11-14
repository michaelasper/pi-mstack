import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync, readFileSync, readdirSync, existsSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash, randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { packed } from './helpers.mjs';

const version = process.env.MSTACK_LOCAL_PI_VERSION ?? '1.5.0';
const packageVersion = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
const base = process.env.MSTACK_LOCAL_EVIDENCE ?? mkdtempSync(join(tmpdir(), 'mstack-local-'));
mkdirSync(base, { recursive: true });
const artifact = packed();
const install = join(base, 'install');
mkdirSync(install, { recursive: true });
execFileSync('npm', ['install', '--ignore-scripts', '--prefix', install, join(artifact.dir, readdirSync(artifact.dir).find(p => p.endsWith('.tgz'))), '@earendil-works/pi-coding-agent@' + version, '@earendil-works/pi-ai@' + version], { stdio: ['ignore', 'pipe', 'pipe'] });
const root = join(install, 'node_modules'), pkg = join(root, 'pi-mstack'), sub = join(root, 'pi-subagents');
const installedVersions = Object.fromEntries(['@earendil-works/pi-coding-agent', '@earendil-works/pi-ai', 'pi-subagents', 'pi-mstack'].map(name => [name, JSON.parse(readFileSync(join(root, name, 'package.json'))).version]));
assert.equal(installedVersions['@earendil-works/pi-coding-agent'], version);
assert.equal(installedVersions['@earendil-works/pi-ai'], version);
assert.equal(installedVersions['pi-subagents'], '0.88.1');
writeFileSync(join(base, 'install.json'), JSON.stringify({ installedVersions, artifact, root }, null, 2));
process.env.MSTACK_PI_CLI = join(root, '@earendil-works/pi-coding-agent/dist/bundle/cli.js');
const { isolated, rpc, captures } = await import(join(pkg, 'tests/helpers.mjs'));
const provider = join(pkg, 'tests/fixtures/provider.ts');
after(() => { if (!process.env.MSTACK_KEEP_TEST_ARTIFACTS) rmSync(artifact.dir, { recursive: true, force: true }); });

const hash = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const toolEvent = (client, name) => client.records.filter(e => e.type === 'tool_execution_end' && e.toolName === name).at(-1);
const childCaptures = (env, agent, token) => captures(env).filter(c => c.messages.at(-1)?.role === 'user' && (token ? JSON.stringify(c.messages.at(-1)).includes(token) : c.system?.includes(`<active_agent name="${agent}"/>`)));
const declared = capture => capture.providerTools.map(tool => tool.name);
async function waitRun(dir, runId, timeout = 30000) {
  const path = join(dir, 'native-state/async-subagent-runs', runId, 'status.json'), deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (existsSync(path)) {
      const status = JSON.parse(readFileSync(path));
      if (!['pending', 'running'].includes(status.state)) return status;
    }
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw Error(`Async run ${runId} did not finish`);
}
const acceptanceReport = (changedFiles, commandsRun = []) => ({ criteriaSatisfied: [{ id: 'criterion-1', status: 'satisfied', evidence: 'Scripted fixture returns a configured local report.' }], changedFiles, testsAddedOrUpdated: [], commandsRun, validationOutput: commandsRun.length ? ['Scripted command observed.'] : [], residualRisks: ['Synthetic fixture evidence only.'], reviewFindings: ['no blockers'], manualNotes: 'Scripted acceptance path.' });
const workerCommands = [{ command: 'cat worker-created.txt', result: 'passed', summary: 'Observed WORKER_TWO.' }];
const fenced = (changedFiles, commandsRun = []) => '```acceptance-report\n' + JSON.stringify(acceptanceReport(changedFiles, commandsRun)) + '\n```\n';
const explorerTools = ['contact_supervisor', 'find', 'grep', 'ls', 'read'];
const workerTools = ['bash', 'contact_supervisor', 'edit', 'find', 'grep', 'ls', 'read', 'write'];

async function setup(t, name, { settings = {}, projectSettings, reports = true, mcp = false, mcpServers } = {}) {
  const dir = join(base, name); rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
  const plans = join(dir, 'plans'), finals = join(dir, 'finals');
  mkdirSync(plans, { recursive: true }); mkdirSync(finals, { recursive: true });
  const iso = isolated(dir, pkg, { packages: [pkg, sub], defaultProjectTrust: 'always', subagents: { orcaProgressTabs: { enabled: false }, defaultExtensions: [provider], ...settings } }, { mcp });
  const home = join(dir, 'home'); mkdirSync(home, { recursive: true }); iso.env.HOME = home;
  iso.args = iso.args.filter(arg => arg !== '--no-context-files');
  Object.assign(iso.env, { MSTACK_PLAN: join(dir, 'plan.json'), MSTACK_CHILD_PLAN: join(plans, 'default.json'), MSTACK_CHILD_PLAN_DIR: plans, MSTACK_CHILD_FINAL_DIR: finals, MSTACK_CHILD_LOG: join(dir, 'extension-calls.jsonl'), PI_SUBAGENTS_TEMP_ROOT: join(dir, 'native-state') });
  writeFileSync(join(dir, 'AGENTS.md'), 'PROJECT_CONTEXT_SENTINEL');
  writeFileSync(join(iso.agentDir, 'AGENTS.md'), 'GLOBAL_CONTEXT_SENTINEL');
  mkdirSync(join(iso.agentDir, 'skills/local-sentinel'), { recursive: true });
  writeFileSync(join(iso.agentDir, 'skills/local-sentinel/SKILL.md'), '---\nname: local-sentinel\ndescription: SKILL_CATALOG_SENTINEL\n---\n\nbody\n');
  writeFileSync(join(dir, 'fixture.txt'), 'FIXTURE_LINE_ONE\nFIXTURE_LINE_TWO\n');
  if (reports) {
    writeFileSync(join(finals, 'pstack-local-explorer.txt'), fenced([]));
    writeFileSync(join(finals, 'pstack-local-worker.txt'), fenced(['worker-created.txt', 'worker-note.txt'], workerCommands));
  }
  if (projectSettings) {
    mkdirSync(join(dir, '.pi'), { recursive: true });
    writeFileSync(join(dir, '.pi/settings.json'), JSON.stringify(projectSettings));
  }
  if (mcp) writeFileSync(join(iso.agentDir, 'mcp.json'), JSON.stringify({ mcpServers: mcpServers ?? { local_fixture: { command: process.execPath, args: [join(pkg, 'tests/fixtures/local-mcp.mjs'), join(dir, 'mcp-calls.jsonl')], exposure: 'direct' } } }));
  const client = rpc({ dir, ...iso });
  t.after(async () => {
    writeFileSync(join(dir, 'evidence.json'), JSON.stringify({ records: client.records, requests: captures(iso.env) }, null, 2));
    await client.stop();
  });
  const plan = async args => { const calls = Array.isArray(args) ? args : [args]; writeFileSync(iso.env.MSTACK_PLAN, JSON.stringify(calls.map(entry => ({ name: 'subagent', arguments: entry })))); await client.turn('EXECUTE_TEST_PLAN'); };
  const childPlan = (agent, calls) => writeFileSync(join(plans, agent + '.json'), JSON.stringify(calls));
  const enable = async () => {
    await client.turn('Inspect native tools');
    if (captures(iso.env).at(-1).tools.includes('subagents_enable')) {
      writeFileSync(iso.env.MSTACK_PLAN, JSON.stringify([{ name: 'subagents_enable', arguments: {} }]));
      await client.turn('EXECUTE_TEST_PLAN enable');
    }
    assert.ok(captures(iso.env).at(-1).tools.includes('subagent'));
  };
  return { dir, iso, client, plan, childPlan, enable, plans, finals };
}

test('packed artifact lists and preflights both local agents with package provenance', { timeout: 60000 }, async t => {
  const s = await setup(t, 'discovery');
  await s.enable();
  await s.plan([{ action: 'list', options: { capabilities: true, search: 'pstack-local' } }]);
  const list = toolEvent(s.client, 'subagent');
  assert.equal(list?.isError, false, JSON.stringify(list));
  const capabilities = list.result.details.agentCapabilities;
  assert.deepEqual(capabilities.agents.map(agent => agent.name).sort(), ['pstack-local-explorer', 'pstack-local-worker']);
  for (const row of capabilities.agents) {
    assert.equal(row.source, 'package');
    assert.deepEqual(row.aliases ?? [], []);
    assert.deepEqual(row.tools.names, row.name === 'pstack-local-explorer' ? ['read', 'grep', 'find', 'ls'] : ['read', 'grep', 'find', 'ls', 'bash', 'edit', 'write']);
  }
  assert.ok(JSON.stringify(list).includes(`pi-mstack@${packageVersion}`));
  await s.plan([{ action: 'get', agent: 'pstack-local-explorer' }]);
  const get = toolEvent(s.client, 'subagent');
  assert.equal(get?.isError, false, JSON.stringify(get));
  assert.match(JSON.stringify(get), /pstack-local-explorer/);
  assert.match(JSON.stringify(get), /generated\/agents\/pstack-local-explorer\.md/);
  await s.plan([{ action: 'list', options: { capabilities: true } }]);
  const all = toolEvent(s.client, 'subagent').result.details.agentCapabilities.agents;
  for (const name of ['pstack-local-explorer', 'pstack-local-worker']) {
    const matches = all.filter(agent => agent.name === name || (agent.aliases ?? []).includes(name));
    assert.equal(matches.length, 1, `catalog resolves ${name} once`);
    assert.equal(matches[0].name, name);
  }
  const previous = { ...process.env };
  process.env.PI_CODING_AGENT_DIR = s.iso.agentDir; process.env.HOME = s.iso.env.HOME;
  const { resolveSubagentLaunchContract } = await import(pathToFileURL(join(sub, 'bundle/preflight.js')).href);
  for (const [agent, expected] of [['pstack-local-explorer', explorerTools], ['pstack-local-worker', workerTools]]) {
    const result = await resolveSubagentLaunchContract({ agent, cwd: s.dir, projectTrusted: true, availableModels: [{ provider: 'mstack-test', id: 'script/model', reasoning: true }], knownProviders: { 'mstack-test': { models: ['script/model', 'other'] } }, preferredProvider: 'mstack-test' });
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(result.contract.agent.source, 'package');
    assert.equal(result.contract.agent.localName, agent);
    assert.ok(result.contract.agent.filePath.endsWith(`generated/agents/${agent}.md`));
    assert.deepEqual([...result.contract.tools.effectiveAllowlist].sort(), expected);
    assert.equal(result.contract.tools.explicitAllowlist, true);
    assert.equal(result.contract.tools.fanoutAuthorized, false);
    assert.deepEqual(result.contract.tools.effectiveMcpTools, []);
    assert.equal(result.contract.context, 'fresh');
    assert.equal(result.contract.inheritProjectContext, true);
    assert.equal(result.contract.inheritGlobalContext, false);
    assert.equal(result.contract.inheritSkills, false);
    writeFileSync(join(s.dir, `preflight-${agent}.json`), JSON.stringify(result, null, 2));
  }
  for (const key of Object.keys(process.env)) if (!(key in previous)) delete process.env[key];
  Object.assign(process.env, previous);
  assert.deepEqual(installedVersions, { '@earendil-works/pi-coding-agent': version, '@earendil-works/pi-ai': version, 'pi-subagents': '0.88.1', 'pi-mstack': packageVersion });
});

test('fresh explorer reads local evidence, cannot mutate, and inherits only project context', { timeout: 60000 }, async t => {
  const s = await setup(t, 'explorer-defaults');
  await s.enable();
  const target = join(s.dir, 'explorer-never-written.txt');
  s.childPlan('pstack-local-explorer', [
    { name: 'read', arguments: { path: join(s.dir, 'fixture.txt') } },
    { name: 'write', arguments: { path: target, content: 'MUST_NOT_WRITE' } },
    { name: 'edit', arguments: { path: join(s.dir, 'fixture.txt'), oldText: 'FIXTURE_LINE_ONE', newText: 'MUTATED' } },
    { name: 'bash', arguments: { command: 'printf MUTATED' } },
  ]);
  await s.plan({ agent: 'pstack-local-explorer', task: 'EXECUTE_CHILD_PLAN EXPLORER_DEFAULT_EVIDENCE', async: false, model: 'mstack-test/script/model:off', options: { timeoutMs: 20000 } });
  const event = toolEvent(s.client, 'subagent');
  assert.equal(event?.isError, false, JSON.stringify(event));
  const child = childCaptures(s.iso.env, 'pstack-local-explorer', 'EXPLORER_DEFAULT_EVIDENCE').at(-1);
  assert.ok(child, 'fresh explorer provider request captured');
  assert.deepEqual(declared(child).sort(), explorerTools);
  assert.equal(declared(child).includes('subagent'), false);
  assert.equal(declared(child).includes('structured_output'), false);
  assert.equal(declared(child).some(name => name.startsWith('mcp')), false);
  assert.equal(child.system.includes('PROJECT_CONTEXT_SENTINEL'), true);
  assert.equal(child.system.includes('GLOBAL_CONTEXT_SENTINEL'), false);
  assert.equal(child.system.includes('SKILL_CATALOG_SENTINEL'), false);
  const output = JSON.stringify(event.result);
  assert.match(output, /FIXTURE_LINE_ONE/);
  for (const tool of ['write', 'edit', 'bash']) assert.match(output, new RegExp(`Tool ${tool} not found`), tool);
  assert.equal(existsSync(target), false);
  assert.equal(readFileSync(join(s.dir, 'fixture.txt'), 'utf8'), 'FIXTURE_LINE_ONE\nFIXTURE_LINE_TWO\n');
  assert.equal(event.result.details.results[0].acceptance.status, 'attested');
  assert.equal(event.result.details.results[0].acceptance.evidenceStatus, 'attested');
  assert.doesNotMatch(output, /```acceptance-report/);
});

test('worker writes, edits, and runs a real local command with updated bytes', { timeout: 60000 }, async t => {
  const s = await setup(t, 'worker-defaults');
  await s.enable();
  const target = join(s.dir, 'worker-created.txt');
  s.childPlan('pstack-local-worker', [
    { name: 'write', arguments: { path: target, content: 'WORKER_ONE\n' } },
    { name: 'edit', arguments: { path: target, oldText: 'WORKER_ONE', newText: 'WORKER_TWO' } },
    { name: 'bash', arguments: { command: `cat ${JSON.stringify(target)}` } },
  ]);
  await s.plan({ agent: 'pstack-local-worker', task: 'EXECUTE_CHILD_PLAN WORKER_DEFAULT_MUTATION', async: false, model: 'mstack-test/script/model:off', options: { timeoutMs: 20000 } });
  const event = toolEvent(s.client, 'subagent');
  assert.equal(event?.isError, false, JSON.stringify(event));
  assert.equal(readFileSync(target, 'utf8'), 'WORKER_TWO\n');
  const child = childCaptures(s.iso.env, 'pstack-local-worker', 'WORKER_DEFAULT_MUTATION').at(-1);
  assert.deepEqual(declared(child).sort(), workerTools);
  assert.equal(child.system.includes('PROJECT_CONTEXT_SENTINEL'), true);
  assert.equal(child.system.includes('GLOBAL_CONTEXT_SENTINEL'), false);
  assert.equal(child.system.includes('SKILL_CATALOG_SENTINEL'), false);
  const output = JSON.stringify(event.result);
  assert.match(output, /WORKER_TWO/);
  assert.equal(event.result.details.results[0].acceptance.status, 'checked');
  assert.equal(event.result.details.results[0].acceptance.evidenceStatus, 'checked');
});

test('acceptance rejects a missing report and accepts a schema-bound report sibling', { timeout: 60000 }, async t => {
  const s = await setup(t, 'acceptance', { reports: false });
  await s.enable();
  s.childPlan('pstack-local-explorer', [{ name: 'read', arguments: { path: join(s.dir, 'fixture.txt') } }]);
  await s.plan({ agent: 'pstack-local-explorer', task: 'EXECUTE_CHILD_PLAN ACCEPTANCE_MISSING_REPORT', async: false, model: 'mstack-test/script/model:off', options: { timeoutMs: 20000 } });
  const missing = toolEvent(s.client, 'subagent');
  assert.equal(missing?.isError, true, JSON.stringify(missing));
  assert.match(JSON.stringify(missing.result), /Acceptance rejected: Structured acceptance report not found\./);
  const schema = { type: 'object', properties: { answer: { type: 'string' } }, required: ['answer'], additionalProperties: false };
  s.childPlan('pstack-local-explorer', [{ name: 'structured_output', arguments: { value: { answer: 'SCHEMA_ANSWER_SENTINEL' }, acceptanceReport: acceptanceReport([]) } }]);
  await s.plan({ agent: 'pstack-local-explorer', task: 'EXECUTE_CHILD_PLAN ACCEPTANCE_SCHEMA_REPORT', async: false, model: 'mstack-test/script/model:off', options: { timeoutMs: 20000, outputSchema: schema, acceptance: { level: 'attested', report: 'on', criteria: ['Return the schema answer.'], evidence: ['manual-notes', 'residual-risks'] } } });
  const bound = toolEvent(s.client, 'subagent');
  assert.equal(bound?.isError, false, JSON.stringify(bound));
  assert.match(JSON.stringify(bound.result), /SCHEMA_ANSWER_SENTINEL/);
  const child = childCaptures(s.iso.env, 'pstack-local-explorer', 'ACCEPTANCE_SCHEMA_REPORT').at(-1);
  assert.deepEqual(declared(child).sort(), [...explorerTools, 'structured_output'].sort());
});

test('unrelated extension tool returns a nonce only when the fixture is loaded', { timeout: 60000 }, async t => {
  for (const loaded of [true, false]) {
    const s = await setup(t, `extension-control-${loaded}`, { settings: { defaultExtensions: loaded ? [provider, join(pkg, 'tests/fixtures/child-tool.ts')] : [provider], agentOverrides: { 'pstack-local-explorer': { tools: ['fixture_child_tool'] } } } });
    await s.enable();
    const nonce = 'extension-control-' + randomUUID();
    s.childPlan('pstack-local-explorer', [{ name: 'fixture_child_tool', arguments: { nonce } }]);
    await s.plan({ agent: 'pstack-local-explorer', task: 'EXECUTE_CHILD_PLAN EXTENSION_CONTROL', async: false, model: 'mstack-test/script/model:off', options: { timeoutMs: 20000 } });
    const event = toolEvent(s.client, 'subagent');
    assert.equal(event?.isError, !loaded, JSON.stringify(event));
    const children = childCaptures(s.iso.env, 'pstack-local-explorer', 'EXTENSION_CONTROL');
    if (loaded) {
      assert.ok(declared(children.at(-1)).includes('fixture_child_tool'));
      assert.ok(event.result.details.results[0].finalOutput.includes('CHILD_TOOL_NONCE:' + nonce));
      assert.deepEqual(readFileSync(s.iso.env.MSTACK_CHILD_LOG, 'utf8').trim().split('\n').map(JSON.parse), [{ nonce }]);
    } else {
      assert.ok(JSON.stringify(event.result).includes('these child tools were unavailable: fixture_child_tool.'));
      assert.equal(children.length, 0, 'missing extension is rejected before child inference');
      assert.equal(existsSync(s.iso.env.MSTACK_CHILD_LOG), false);
    }
  }
});

test('background children persist output and never declare unrelated extension tools', { timeout: 60000 }, async t => {
  const s = await setup(t, 'background', { settings: { defaultExtensions: [provider, join(pkg, 'tests/fixtures/child-tool.ts')] } });
  await s.enable();
  const explorerOutput = join(s.dir, 'explorer-report.md'), workerOutput = join(s.dir, 'worker-report.md'), target = join(s.dir, 'background-worker.txt');
  s.childPlan('pstack-local-explorer', [{ name: 'read', arguments: { path: join(s.dir, 'fixture.txt') } }, { name: 'fixture_child_tool', arguments: { nonce: 'DEFAULT_EXPLORER_MUST_NOT_CALL_EXTENSION' } }]);
  s.childPlan('pstack-local-worker', [{ name: 'write', arguments: { path: target, content: 'BACKGROUND_WORKER_BYTES\n' } }, { name: 'fixture_child_tool', arguments: { nonce: 'DEFAULT_WORKER_MUST_NOT_CALL_EXTENSION' } }]);
  await s.plan({ agent: 'pstack-local-explorer', task: 'EXECUTE_CHILD_PLAN BACKGROUND_EXPLORER', async: true, model: 'mstack-test/script/model:off', output: explorerOutput, options: { timeoutMs: 20000 } });
  const statuses = [await waitRun(s.dir, toolEvent(s.client, 'subagent').result.details.runId)];
  assert.match(readFileSync(explorerOutput, 'utf8'), /FIXTURE_LINE_ONE/);
  assert.doesNotMatch(readFileSync(explorerOutput, 'utf8'), /```acceptance-report/);
  await s.plan({ agent: 'pstack-local-worker', task: 'EXECUTE_CHILD_PLAN BACKGROUND_WORKER', async: true, model: 'mstack-test/script/model:off', output: workerOutput, options: { timeoutMs: 20000 } });
  statuses.push(await waitRun(s.dir, toolEvent(s.client, 'subagent').result.details.runId));
  assert.equal(readFileSync(target, 'utf8'), 'BACKGROUND_WORKER_BYTES\n');
  assert.ok(readFileSync(workerOutput, 'utf8').includes('Successfully wrote to ' + target));
  for (const output of [explorerOutput, workerOutput]) {
    assert.ok(readFileSync(output, 'utf8').includes('Tool fixture_child_tool not found'));
    assert.equal(readFileSync(output, 'utf8').includes('CHILD_TOOL_NONCE:'), false);
  }
  for (const [agent, expected, token] of [['pstack-local-explorer', explorerTools, 'BACKGROUND_EXPLORER'], ['pstack-local-worker', workerTools, 'BACKGROUND_WORKER']]) {
    const child = childCaptures(s.iso.env, agent, token).at(-1);
    assert.ok(child, `${agent} background provider request captured`);
    assert.deepEqual(declared(child).sort(), expected);
    assert.equal(declared(child).includes('fixture_child_tool'), false);
    assert.equal(declared(child).some(name => name.startsWith('mcp')), false);
    assert.equal(child.system.includes('PROJECT_CONTEXT_SENTINEL'), true);
    assert.equal(child.system.includes('SKILL_CATALOG_SENTINEL'), false);
  }
  for (const status of statuses) {
    assert.equal(status.state, 'complete');
    assert.equal(status.steps.length, 1);
  }
  assert.equal(existsSync(s.iso.env.MSTACK_CHILD_LOG), false, 'default profiles never execute the loaded extension tool');
  const explorerAcceptance = statuses[0].steps[0].acceptance;
  assert.equal(explorerAcceptance.status, 'attested');
  assert.equal(explorerAcceptance.evidenceStatus, 'attested');
  const workerAcceptance = statuses[1].steps[0].acceptance;
  assert.equal(workerAcceptance.status, 'review-required');
  assert.equal(workerAcceptance.evidenceStatus, 'checked');
  assert.equal(workerAcceptance.effectiveAcceptance.level, 'checked');
  assert.equal(workerAcceptance.effectiveAcceptance.review.required, true);
  assert.equal(workerAcceptance.reviewResult.status, 'review-required');
  assert.equal(workerAcceptance.runtimeChecks.find(check => check.id === 'evidence:commands-run')?.status, 'passed');
});

test('configured builtin MCP works in the parent but stays unavailable to both default local profiles', { timeout: 60000 }, async t => {
  const tool = 'mcp__local_fixture__echo_nonce';
  const s = await setup(t, 'mcp-configured', { mcp: true });
  await s.enable();
  assert.ok(captures(s.iso.env).at(-1).tools.includes(tool), 'configured parent exposes the actual MCP tool');
  assert.ok(declared(captures(s.iso.env).at(-1)).includes(tool));
  const nonce = 'parent-mcp-control-' + randomUUID();
  writeFileSync(s.iso.env.MSTACK_PLAN, JSON.stringify([{ name: tool, arguments: { nonce } }]));
  await s.client.turn('EXECUTE_TEST_PLAN MCP_PARENT_CONTROL');
  const control = toolEvent(s.client, tool);
  assert.equal(control?.isError, false, JSON.stringify(control));
  assert.ok(JSON.stringify(control.result).includes('LOCAL_MCP_NONCE:' + nonce));
  const calls = () => readFileSync(join(s.dir, 'mcp-calls.jsonl'), 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
  assert.equal(calls().length, 1);
  assert.equal(calls()[0].request.params.arguments.nonce, nonce);
  for (const [agent, expected] of [['pstack-local-explorer', explorerTools], ['pstack-local-worker', workerTools]]) {
    s.childPlan(agent, [{ name: tool, arguments: { nonce: `MUST_NOT_DISPATCH_${agent}` } }]);
    const outputPath = join(s.dir, agent + '-mcp-output.md');
    await s.plan({ agent, task: 'EXECUTE_CHILD_PLAN MCP_DEFAULT_EXCLUSION', async: true, output: outputPath, model: 'mstack-test/script/model:off', options: { timeoutMs: 20000 } });
    const event = toolEvent(s.client, 'subagent');
    assert.equal(event?.isError, false, JSON.stringify(event));
    const status = await waitRun(s.dir, event.result.details.runId);
    assert.equal(status.state, 'complete');
    assert.equal(status.steps[0].acceptance.status, agent === 'pstack-local-explorer' ? 'attested' : 'review-required');
    const child = childCaptures(s.iso.env, agent, 'MCP_DEFAULT_EXCLUSION').at(-1);
    assert.deepEqual(declared(child).sort(), expected);
    assert.equal(child.tools.includes(tool), false);
    const output = readFileSync(outputPath, 'utf8');
    assert.ok(output.includes(`Tool ${tool} not found`), output);
    assert.equal(output.includes('LOCAL_MCP_NONCE:'), false);
    assert.equal(calls().length, 1, 'default child dispatch never reaches configured MCP server');
  }

  const absent = await setup(t, 'mcp-unconfigured', { mcp: true, mcpServers: {} });
  await absent.enable();
  assert.equal(captures(absent.iso.env).at(-1).tools.includes(tool), false);
  writeFileSync(absent.iso.env.MSTACK_PLAN, JSON.stringify([{ name: tool, arguments: { nonce: 'UNCONFIGURED_MUST_NOT_RETURN' } }]));
  await absent.client.turn('EXECUTE_TEST_PLAN MCP_ABSENT_CONTROL');
  const missing = toolEvent(absent.client, tool);
  assert.equal(missing?.isError, true, JSON.stringify(missing));
  assert.ok(JSON.stringify(missing.result).includes(`Tool ${tool} not found`));
  assert.equal(JSON.stringify(missing.result).includes('LOCAL_MCP_NONCE:'), false);
  assert.equal(existsSync(join(absent.dir, 'mcp-calls.jsonl')), false);
});

test('file-backed workflow awaits runs.run and runs.all with local children', { timeout: 60000 }, async t => {
  const s = await setup(t, 'workflow');
  await s.enable();
  s.childPlan('pstack-local-explorer', [{ name: 'read', arguments: { path: join(s.dir, 'fixture.txt') } }]);
  s.childPlan('pstack-local-worker', [{ name: 'write', arguments: { path: join(s.dir, 'workflow-worker.txt'), content: 'WORKFLOW_WORKER\n' } }]);
  writeFileSync(join(s.dir, 'local-work.js'), 'const scan = await runs.run("scan", { agent: "pstack-local-explorer", task: "EXECUTE_CHILD_PLAN WORKFLOW_SCAN" });\nif (!scan.ok) return scan;\nreturn runs.all([{ key: "worker", agent: "pstack-local-worker", task: "EXECUTE_CHILD_PLAN WORKFLOW_WORKER" }, { key: "second", agent: "pstack-local-explorer", task: "EXECUTE_CHILD_PLAN WORKFLOW_SECOND" }]);\n');
  await s.plan({ workflow: './local-work.js', async: false, options: { timeoutMs: 30000 } });
  const event = toolEvent(s.client, 'subagent');
  assert.equal(event?.isError, false, JSON.stringify(event));
  assert.equal(readFileSync(join(s.dir, 'workflow-worker.txt'), 'utf8'), 'WORKFLOW_WORKER\n');
  for (const token of ['WORKFLOW_SCAN', 'WORKFLOW_SECOND']) assert.ok(childCaptures(s.iso.env, 'pstack-local-explorer', token).length, token);
  const worker = childCaptures(s.iso.env, 'pstack-local-worker', 'WORKFLOW_WORKER').at(-1);
  assert.deepEqual(declared(worker).sort(), workerTools);
  assert.match(JSON.stringify(event.result), /FIXTURE_LINE_ONE|WORKFLOW_WORKER/);
});

test('explicit fork replays declarations without granting tools, and explicit fresh beats a fork preference', { timeout: 60000 }, async t => {
  const fork = await setup(t, 'fork');
  await fork.enable();
  await fork.client.turn('PARENT_ONLY_SENTINEL');
  fork.childPlan('pstack-local-explorer', [
    { name: 'subagent', arguments: { agent: 'pstack-local-worker', task: 'MUST_NOT_DELEGATE' } },
    { name: 'write', arguments: { path: join(fork.dir, 'fork-never-written.txt'), content: 'MUST_NOT_WRITE' } },
  ]);
  const output = join(fork.dir, 'fork-output.md');
  await fork.plan({ agent: 'pstack-local-explorer', task: 'EXECUTE_CHILD_PLAN FORK_CHILD AGENT:pstack-local-explorer', async: true, model: 'mstack-test/script/model:off', output, options: { context: 'fork', timeoutMs: 20000 } });
  const runId = toolEvent(fork.client, 'subagent').result.details.runId;
  const status = await waitRun(fork.dir, runId);
  assert.equal(status.state, 'complete');
  assert.equal(status.steps[0].acceptance.status, 'attested');
  assert.equal(status.steps[0].acceptance.evidenceStatus, 'attested');
  const child = childCaptures(fork.iso.env, 'pstack-local-explorer', 'FORK_CHILD').at(-1);
  assert.ok(child, 'fork child captured');
  assert.ok(JSON.stringify(child.messages).includes('PARENT_ONLY_SENTINEL'));
  assert.ok(declared(child).includes('subagent'), 'fork keeps parent tool declarations');
  assert.equal(declared(child).includes('write'), true, 'fork declares parent write');
  assert.equal(existsSync(join(fork.dir, 'fork-never-written.txt')), false);
  assert.ok(readFileSync(output, 'utf8').includes('Tool write not found'));
  assert.equal(child.tools.includes('write'), false, 'fork active tools stay local');
  assert.equal(child.tools.includes('subagent'), false, 'fork active tools never gain delegation');
  assert.equal(childCaptures(fork.iso.env, 'pstack-local-worker', 'MUST_NOT_DELEGATE').length, 0);

  const fresh = await setup(t, 'fresh-beats-fork', { settings: { defaultSubagentContext: 'fork' } });
  await fresh.enable();
  await fresh.client.turn('PARENT_ONLY_SENTINEL');
  fresh.childPlan('pstack-local-explorer', [{ name: 'read', arguments: { path: join(fresh.dir, 'fixture.txt') } }]);
  await fresh.plan({ agent: 'pstack-local-explorer', task: 'EXECUTE_CHILD_PLAN FRESH_OVERRIDE', async: false, model: 'mstack-test/script/model:off', options: { context: 'fresh', timeoutMs: 20000 } });
  const freshChild = childCaptures(fresh.iso.env, 'pstack-local-explorer', 'FRESH_OVERRIDE').at(-1);
  assert.ok(freshChild, 'fresh child captured');
  assert.equal(JSON.stringify(freshChild.messages).includes('PARENT_ONLY_SENTINEL'), false);
  assert.deepEqual(declared(freshChild).sort(), explorerTools);
});

test('operator overrides widen, narrow, inherit, and project settings win without a per-call tool list', { timeout: 120000 }, async t => {
  const widen = await setup(t, 'override-widen', { settings: { agentOverrides: { 'pstack-local-explorer': { tools: ['read', 'bash'] } } }, reports: false });
  await widen.enable();
  widen.childPlan('pstack-local-explorer', [{ name: 'bash', arguments: { command: 'printf WIDENED_BASH' } }]);
  await widen.plan({ agent: 'pstack-local-explorer', task: 'EXECUTE_CHILD_PLAN OVERRIDE_WIDEN', async: false, model: 'mstack-test/script/model:off', options: { timeoutMs: 20000, acceptance: { level: 'none', reason: 'operator tool override probe' } } });
  const widened = childCaptures(widen.iso.env, 'pstack-local-explorer', 'OVERRIDE_WIDEN').at(-1);
  assert.deepEqual(declared(widened).sort(), ['bash', 'contact_supervisor', 'read']);
  assert.match(JSON.stringify(toolEvent(widen.client, 'subagent').result), /WIDENED_BASH/);

  const narrow = await setup(t, 'override-narrow', { settings: { agentOverrides: { 'pstack-local-worker': { tools: ['read'] } } }, reports: false });
  await narrow.enable();
  const blocked = join(narrow.dir, 'narrow-never-written.txt');
  narrow.childPlan('pstack-local-worker', [{ name: 'write', arguments: { path: blocked, content: 'MUST_NOT_WRITE' } }]);
  await narrow.plan({ agent: 'pstack-local-worker', task: 'EXECUTE_CHILD_PLAN OVERRIDE_NARROW', async: false, model: 'mstack-test/script/model:off', options: { timeoutMs: 20000, acceptance: { level: 'none', reason: 'operator tool override probe' } } });
  const narrowed = childCaptures(narrow.iso.env, 'pstack-local-worker', 'OVERRIDE_NARROW').at(-1);
  assert.deepEqual(declared(narrowed).sort(), ['contact_supervisor', 'read']);
  assert.equal(existsSync(blocked), false);

  const inherit = await setup(t, 'override-inherit', { settings: { agentOverrides: { 'pstack-local-worker': { tools: 'inherit' } } }, reports: false });
  await inherit.enable();
  inherit.childPlan('pstack-local-worker', [{ name: 'bash', arguments: { command: 'printf INHERITED_BASH' } }]);
  await inherit.plan({ agent: 'pstack-local-worker', task: 'EXECUTE_CHILD_PLAN OVERRIDE_INHERIT', async: false, model: 'mstack-test/script/model:off', options: { timeoutMs: 20000, acceptance: { level: 'none', reason: 'operator tool override probe' } } });
  const inherited = childCaptures(inherit.iso.env, 'pstack-local-worker', 'OVERRIDE_INHERIT').at(-1);
  for (const tool of ['bash', 'edit', 'write', 'read']) assert.ok(declared(inherited).includes(tool), `${tool} inherited`);
  assert.match(JSON.stringify(toolEvent(inherit.client, 'subagent').result), /INHERITED_BASH/);

  const precedence = await setup(t, 'override-precedence', { settings: { agentOverrides: { 'pstack-local-worker': { tools: ['read'] } } }, projectSettings: { subagents: { agentOverrides: { 'pstack-local-worker': { tools: ['read', 'bash', 'write', 'edit', 'grep', 'find', 'ls'] } } } }, reports: false });
  await precedence.enable();
  precedence.childPlan('pstack-local-worker', [{ name: 'bash', arguments: { command: 'printf PROJECT_WINS' } }]);
  await precedence.plan({ agent: 'pstack-local-worker', task: 'EXECUTE_CHILD_PLAN OVERRIDE_PRECEDENCE', async: false, model: 'mstack-test/script/model:off', options: { timeoutMs: 20000, acceptance: { level: 'none', reason: 'operator tool override probe' } } });
  const projectChild = childCaptures(precedence.iso.env, 'pstack-local-worker', 'OVERRIDE_PRECEDENCE').at(-1);
  assert.ok(declared(projectChild).includes('bash'), 'project override wins over user override');
  assert.match(JSON.stringify(toolEvent(precedence.client, 'subagent').result), /PROJECT_WINS/);

  await narrow.plan({ agent: 'pstack-local-worker', task: 'REJECTED_OPTIONS_TOOLS', async: false, model: 'mstack-test/script/model:off', options: { tools: ['read'], timeoutMs: 10000 } });
  const rejected = toolEvent(narrow.client, 'subagent');
  assert.equal(rejected?.isError, true, JSON.stringify(rejected));
  assert.ok(JSON.stringify(rejected.result).includes("subagent: unknown options key 'tools'."));
  assert.equal(childCaptures(narrow.iso.env, 'pstack-local-worker', 'REJECTED_OPTIONS_TOOLS').length, 0);
});

test('tools false empties declarations and project excludeTools false clears a user exclusion', { timeout: 60000 }, async t => {
  for (const [name, override, projectSettings, expected, canRead] of [
    ['tools-false', { tools: false }, undefined, [], false],
    ['exclude-read', { excludeTools: ['read'] }, undefined, ['contact_supervisor', 'find', 'grep', 'ls'], false],
    ['clear-exclusions', { excludeTools: ['read'] }, { subagents: { agentOverrides: { 'pstack-local-explorer': { excludeTools: false } } } }, explorerTools, true],
  ]) {
    const s = await setup(t, name, { settings: { agentOverrides: { 'pstack-local-explorer': override } }, projectSettings });
    await s.enable();
    s.childPlan('pstack-local-explorer', [{ name: 'read', arguments: { path: join(s.dir, 'fixture.txt') } }]);
    await s.plan({ agent: 'pstack-local-explorer', task: 'EXECUTE_CHILD_PLAN FALSE_OVERRIDE', async: false, model: 'mstack-test/script/model:off', options: { timeoutMs: 20000 } });
    const event = toolEvent(s.client, 'subagent');
    assert.equal(event?.isError, false, JSON.stringify(event));
    const child = childCaptures(s.iso.env, 'pstack-local-explorer', 'FALSE_OVERRIDE').at(-1);
    assert.deepEqual(declared(child).sort(), expected);
    const output = event.result.details.results[0].finalOutput;
    assert.equal(output.includes('FIXTURE_LINE_ONE'), canRead);
    assert.equal(output.includes('Tool read not found'), !canRead);
  }
});

test('context overrides can inherit global context and skills when an operator asks', { timeout: 60000 }, async t => {
  const s = await setup(t, 'context-control', { settings: { agentOverrides: { 'pstack-local-explorer': { inheritGlobalContext: true, inheritSkills: true } } } });
  await s.enable();
  s.childPlan('pstack-local-explorer', [{ name: 'read', arguments: { path: join(s.dir, 'fixture.txt') } }]);
  await s.plan({ agent: 'pstack-local-explorer', task: 'EXECUTE_CHILD_PLAN CONTEXT_CONTROL', async: false, model: 'mstack-test/script/model:off', options: { timeoutMs: 20000 } });
  const child = childCaptures(s.iso.env, 'pstack-local-explorer', 'CONTEXT_CONTROL').at(-1);
  assert.equal(child.system.includes('PROJECT_CONTEXT_SENTINEL'), true);
  assert.equal(child.system.includes('GLOBAL_CONTEXT_SENTINEL'), true);
  assert.equal(child.system.includes('SKILL_CATALOG_SENTINEL'), true);
});

test('defaults preserve grounding agents byte for byte', () => {
  for (const [name, expected] of [['pstack-explorer', '385e2bffecd2f1134bb173a8695730fa6199967b6fa88bdde8460bbdd99757a2'], ['pstack-explainer', '3238da4c6e1ce4ff3a15b6c6461fa9da460ebecdbb9a6b79883e8a8c17248694']]) {
    assert.equal(hash(join(pkg, `generated/agents/${name}.md`)), expected, name);
  }
  assert.equal(hash(join(pkg, 'upstream/manifest.json')), '6961122244aa92fdf83dd80987351d4db42b80a9e364953a5efd4a3833e9f149');
});
