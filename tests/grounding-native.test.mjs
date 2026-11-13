import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync, readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash, randomUUID } from 'node:crypto';
import { packed } from './helpers.mjs';

const version = process.env.MSTACK_GROUNDING_PI_VERSION ?? '1.5.0';
const base = process.env.MSTACK_GROUNDING_EVIDENCE ?? mkdtempSync(join(tmpdir(), 'mstack-grounding-'));
mkdirSync(base, { recursive: true });
const pack = packed(), install = join(base, 'install');
mkdirSync(install);
execFileSync('npm', ['install', '--ignore-scripts', '--prefix', install, join(pack.dir, readdirSync(pack.dir).find(p => p.endsWith('.tgz'))), '@earendil-works/pi-coding-agent@' + version, '@earendil-works/pi-ai@' + version], { stdio: ['ignore', 'pipe', 'pipe'] });
const root = join(install, 'node_modules'), pkg = join(root, 'pi-mstack');
const installedVersions = Object.fromEntries(['@earendil-works/pi-coding-agent', '@earendil-works/pi-ai', 'pi-subagents'].map(name => [name, JSON.parse(readFileSync(join(root, name, 'package.json'))).version]));
assert.equal(installedVersions['@earendil-works/pi-coding-agent'], version);
assert.equal(installedVersions['@earendil-works/pi-ai'], version);
assert.equal(installedVersions['pi-subagents'], '0.88.1');
writeFileSync(join(base, 'install.json'), JSON.stringify({ installedVersions, pack, root }, null, 2));
process.env.MSTACK_PI_CLI = join(root, '@earendil-works/pi-coding-agent/dist/bundle/cli.js');
const { isolated, rpc, captures } = await import(join(pkg, 'tests/helpers.mjs'));
const hash = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const acceptanceReport = { criteriaSatisfied: [{ id: 'criterion-1', status: 'satisfied', evidence: 'Scripted fixture returns a configured report. No source inspection or command execution is claimed.' }], changedFiles: [], testsAddedOrUpdated: [], commandsRun: [], validationOutput: [], residualRisks: ['Synthetic fixture citations are not source truth.'], manualNotes: 'Only the structured_output protocol was exercised.' };
const domain = nonce => ({ version: 1, status: 'complete', findings: [{ claim: nonce, sources: [{ kind: 'repository', path: 'fixture-source.ts', revision: 'working-tree', firstLine: 1, lastLine: 1 }] }], limitations: ['Synthetic fixture only.'] });
const call = value => [{ name: 'structured_output', arguments: { value, acceptanceReport } }];

for (const variant of ['barrier', 'evidence-only', 'domain-blocked', 'refusal', 'schema-invalid', 'acceptance-invalid', 'missing-report', 'owner-none', 'owner-verified', 'owner-missing', 'explicit-rejection', 'abort', 'explainer-blocked', 'invalid-request', 'unavailable-model', 'owner-absent']) {
  test('independent npm grounding ' + version + ' ' + variant, { timeout: 60000 }, async () => {
    const dir = join(base, variant); mkdirSync(dir);
    const iso = isolated(dir, pkg, { packages: variant === 'owner-absent' ? [pkg] : [pkg, join(root, 'pi-subagents')], subagents: { orcaProgressTabs: { enabled: false } } });
    iso.args.push('-e', join(pkg, 'tests/fixtures/grounding.ts'));
    Object.assign(iso.env, { MSTACK_PLAN: join(dir, 'plan.json'), MSTACK_GROUNDING_PLAN: join(dir, 'child-plan.json'), PI_SUBAGENTS_TEMP_ROOT: join(dir, 'native-state'), PI_SUBAGENTS_PI_CODING_AGENT_PACKAGE_ROOT: join(root, '@earendil-works/pi-coding-agent') });
    if (['barrier', 'abort'].includes(variant)) iso.env.MSTACK_BARRIER = join(dir, 'release');
    if (variant === 'explicit-rejection') iso.env.MSTACK_REJECT_LAUNCH = '1';
    const marker = join(dir, 'verified-marker');
    if (['owner-none', 'owner-missing', 'owner-verified'].includes(variant)) {
      mkdirSync(join(iso.agentDir, 'agents'));
      const command = JSON.stringify(process.execPath) + ' -e ' + "'" + `require("node:fs").writeFileSync(${JSON.stringify(marker)},"native-verify-ran")` + "'";
      const policy = variant === 'owner-none' ? { level: 'none', reason: 'Isolated owner override.' } : { level: 'verified', report: 'on', criteria: ['Return scripted protocol evidence.'], verify: [{ id: 'owner-verification', command, timeoutMs: 5000 }] };
      const agent = readFileSync(join(pkg, 'generated/agents/pstack-explorer.md'), 'utf8').replace(/^acceptance: .*\n/m, variant === 'owner-missing' ? '' : 'acceptance: ' + JSON.stringify(policy) + '\n');
      writeFileSync(join(iso.agentDir, 'agents/pstack-explorer.md'), agent);
    }
    mkdirSync(join(iso.agentDir, 'pstack'));
    writeFileSync(join(iso.agentDir, 'pstack/models.json'), JSON.stringify({ version: 'pi-mstack/1', roles: { 'how explorer': variant === 'unavailable-model' ? 'absent/no-model:off' : 'mstack-test/script/model:off', 'how explainer': 'mstack-test/other:off' } }));
    const settings = join(iso.agentDir, 'settings.json'), before = hash(settings), nonce = randomUUID();
    const childPlan = { first: call(domain(nonce)), second: call(domain(nonce + '-second')), explainer: call(domain(nonce + '-explanation')) };
    if (variant === 'domain-blocked') childPlan.second = call({ version: 1, status: 'blocked', reasons: ['Fixture cannot inspect sources.'] });
    if (variant === 'missing-report') childPlan.second = [{ name: 'structured_output', arguments: { value: domain(nonce) } }];
    if (variant === 'refusal') childPlan.second = [];
    if (variant === 'schema-invalid') childPlan.second = call({ ...domain(nonce), findings: [] });
    if (variant === 'acceptance-invalid') childPlan.second = [{ name: 'structured_output', arguments: { value: domain(nonce), acceptanceReport: { ...acceptanceReport, criteriaSatisfied: [{ id: 'criterion-1', status: 'invalid' }] } } }];
    if (variant === 'explainer-blocked') childPlan.explainer = call({ version: 1, status: 'blocked', reasons: ['No explanation.'] });
    writeFileSync(iso.env.MSTACK_GROUNDING_PLAN, JSON.stringify(childPlan));
    const client = rpc({ dir, ...iso });
    const plan = async calls => { writeFileSync(iso.env.MSTACK_PLAN, JSON.stringify(calls)); await client.turn('EXECUTE_TEST_PLAN'); };
    const explaining = () => captures(iso.env).filter(c => c.system?.includes('<active_agent name="pstack-explainer"/>'));
    try {
      await client.turn('Inspect tools');
      if (variant === 'owner-absent') {
        const commands = await client.send('get_commands');
        assert.ok(JSON.stringify(commands).includes('pstack'));
        assert.ok(JSON.stringify(client.records).includes('pstack.ground disabled') || client.stderr().includes('pstack.ground disabled'));
        assert.equal(captures(iso.env).some(c => c.tools.includes('subagent')), false);
      } else {
        if (captures(iso.env).at(-1).tools.includes('subagents_enable')) await plan([{ name: 'subagents_enable', arguments: {} }]);
        const args = { task: 'Fixture evidence', angles: ['first', 'second'], mode: variant === 'evidence-only' ? 'evidence-only' : 'explain', ...(variant === 'invalid-request' ? { model: 'injected' } : {}) };
        const done = plan([{ name: 'subagent', arguments: { workflow: 'pstack.ground', args, async: false, options: { timeoutMs: 30000 } } }]);
        if (['barrier', 'abort'].includes(variant)) {
          const deadline = Date.now() + 12000;
          const firstCompleted = () => client.records.some(e => e.partialResult?.details?.workflow?.trace?.some(t => t.key === 'explore-0' && t.state === 'completed'));
          while (!(existsSync(iso.env.MSTACK_BARRIER + '.held') && firstCompleted())) { assert.ok(Date.now() < deadline, 'first explorer completes while second remains held'); await new Promise(r => setTimeout(r, 25)); }
          assert.equal(explaining().length, 0);
          writeFileSync(join(dir, 'held.json'), JSON.stringify({ firstCompleted: true, secondHeld: true, explainerRequests: 0, events: client.records }, null, 2));
          if (variant === 'abort') await client.send('abort');
          else writeFileSync(iso.env.MSTACK_BARRIER, 'release');
        }
        await done;
        const event = client.records.filter(e => e.type === 'tool_execution_end' && e.toolName === 'subagent').at(-1);
        writeFileSync(join(dir, 'result.json'), JSON.stringify(event ?? null, null, 2));
        const v = event?.result.details?.workflow?.value;
        if (variant === 'abort') {
          assert.notEqual(v?.status, 'explained');
          assert.equal(explaining().length, 0);
          assert.equal(hash(settings), before);
          writeFileSync(join(dir, 'checks.json'), JSON.stringify({ status: 'PASS', variant, version, settingsBefore: before, settingsAfter: hash(settings) }));
          return;
        }
        const stateRoot = join(dir, 'native-state/async-subagent-runs');
        const statuses = existsSync(stateRoot) ? readdirSync(stateRoot).filter(p => !p.startsWith('.') && existsSync(join(stateRoot, p, 'status.json'))).map(id => JSON.parse(readFileSync(join(stateRoot, id, 'status.json')))) : [];
        writeFileSync(join(dir, 'statuses.json'), JSON.stringify(statuses, null, 2));
        const ledgers = statuses.flatMap(s => s.steps ?? []).map(s => s.acceptance).filter(Boolean);
        if (['barrier', 'evidence-only', 'owner-none', 'owner-missing'].includes(variant)) assert.ok(ledgers.length >= 2);
        if (['barrier', 'evidence-only'].includes(variant)) for (const a of ledgers) {
          assert.equal(a.explicit, true); assert.equal(a.status, 'attested'); assert.equal(a.effectiveAcceptance.level, 'attested');
        }
        if (['acceptance-invalid', 'missing-report'].includes(variant)) assert.ok(ledgers.some(a => a.explicit === true && a.status === 'rejected'));
        if (['owner-none', 'owner-missing'].includes(variant)) assert.ok(ledgers.every(a => a.effectiveAcceptance.level === 'none'));
        if (variant === 'owner-verified') {
          assert.ok(ledgers.length > 0);
          for (const a of ledgers) { assert.equal(a.effectiveAcceptance.level, 'verified'); assert.equal(a.verifyRuns[0].status, 'passed'); }
          assert.equal(readFileSync(marker, 'utf8'), 'native-verify-ran');
        }
        const early = ['invalid-request', 'unavailable-model'].includes(variant);
        if (early) assert.equal(event.isError ?? event.result.isError, true);
        else assert.equal(v?.status, variant === 'barrier' ? 'explained' : variant === 'evidence-only' ? 'evidence-ready' : 'blocked', JSON.stringify(event));
        assert.equal(new Set(explaining().map(c => c.pid)).size, ['barrier', 'explainer-blocked'].includes(variant) ? 1 : 0);
        if (variant === 'barrier' || variant === 'evidence-only') {
          assert.equal(new Set(v.evidence.explorers.map(e => e.reference)).size, 2);
          for (const e of v.evidence.explorers) {
            assert.deepEqual(JSON.parse(readFileSync(e.reference)), e.report);
            assert.equal(e.attribution.requestedSelector, 'mstack-test/script/model:off');
            assert.equal(e.attribution.actualModel, 'mstack-test/script/model:off');
            if (variant === 'barrier') assert.ok(JSON.stringify(explaining()[0].messages).includes(e.reference));
          }
          if (variant === 'barrier') assert.equal(explaining()[0].model, 'other');
        }
        const children = captures(iso.env).filter(c => c.system?.includes('<active_agent name="pstack-'));
        if (early || variant === 'explicit-rejection') assert.equal(children.length, 0);
        else assert.ok(children.length >= 2, 'negative cases must exercise real children');
        for (const c of children) {
          for (const tool of ['read', 'grep', 'find', 'ls', 'structured_output']) assert.ok(c.tools.includes(tool));
          for (const tool of ['bash', 'edit', 'write', 'subagent', 'pstack_context']) assert.equal(c.tools.includes(tool), false);
        }
      }
      assert.equal(hash(settings), before);
      writeFileSync(join(dir, 'checks.json'), JSON.stringify({ status: 'PASS', variant, version, cli: process.env.MSTACK_PI_CLI, sdk: iso.env.PI_SUBAGENTS_PI_CODING_AGENT_PACKAGE_ROOT, settingsBefore: before, settingsAfter: hash(settings), nonce }, null, 2));
    } finally {
      if (iso.env.MSTACK_BARRIER) writeFileSync(iso.env.MSTACK_BARRIER, 'release');
      await client.stop();
      writeFileSync(join(dir, 'events.json'), JSON.stringify(client.records, null, 2));
      writeFileSync(join(dir, 'stderr.txt'), client.stderr());
    }
  });
}

for (const outcome of ['complete', 'blocked']) test('independent npm grounding ' + version + ' concurrent invocations keep distinct native bindings ' + outcome, { timeout: 60000 }, async () => {
  const dir = join(base, 'concurrent-' + outcome); mkdirSync(dir);
  const iso = isolated(dir, pkg, { packages: [pkg, join(root, 'pi-subagents')], subagents: { orcaProgressTabs: { enabled: false } } });
  iso.args.push('-e', join(pkg, 'tests/fixtures/grounding.ts'));
  Object.assign(iso.env, { MSTACK_PLAN: join(dir, 'plan.json'), MSTACK_GROUNDING_PLAN: join(dir, 'child-plan.json'), MSTACK_BARRIER: join(dir, 'release'), PI_SUBAGENTS_TEMP_ROOT: join(dir, 'native-state'), PI_SUBAGENTS_PI_CODING_AGENT_PACKAGE_ROOT: join(root, '@earendil-works/pi-coding-agent') });
  mkdirSync(join(iso.agentDir, 'pstack'));
  writeFileSync(join(iso.agentDir, 'pstack/models.json'), JSON.stringify({ version: 'pi-mstack/1', roles: { 'how explorer': 'mstack-test/script/model:off', 'how explainer': 'mstack-test/other:off' } }));
  const nonce = randomUUID(), settings = join(iso.agentDir, 'settings.json'), before = hash(settings);
  writeFileSync(iso.env.MSTACK_GROUNDING_PLAN, JSON.stringify({ first: call(domain(nonce)), second: call(outcome === 'complete' ? domain(nonce + '-second') : { version: 1, status: 'blocked', reasons: ['Concurrent negative fixture.'] }), explainer: call(domain(nonce + '-explanation')) }));
  const client = rpc({ dir, ...iso });
  const plan = async calls => { writeFileSync(iso.env.MSTACK_PLAN, JSON.stringify(calls)); await client.turn('EXECUTE_TEST_PLAN'); };
  try {
    await client.turn('Inspect tools');
    if (captures(iso.env).at(-1).tools.includes('subagents_enable')) await plan([{ name: 'subagents_enable', arguments: {} }]);
    await plan([1, 2].map(i => ({ name: 'subagent', arguments: { workflow: 'pstack.ground', args: { task: 'Concurrent fixture ' + i, angles: ['first', 'second'], mode: 'explain' }, async: true, options: { timeoutMs: 30000 } } })));
    const launches = client.records.filter(e => e.type === 'tool_execution_end' && e.toolName === 'subagent');
    const ids = launches.map(e => e.result.details.runId);
    assert.equal(new Set(ids).size, 2);
    const deadline = Date.now() + 20000;
    while (!existsSync(iso.env.MSTACK_BARRIER + '.held') || readFileSync(iso.env.MSTACK_BARRIER + '.held', 'utf8') !== 'heldheld') {
      assert.ok(Date.now() < deadline, 'both invocations have a held explorer'); await new Promise(r => setTimeout(r, 25));
    }
    assert.equal(captures(iso.env).filter(c => c.system?.includes('<active_agent name="pstack-explainer"/>')).length, 0);
    writeFileSync(join(dir, 'held.json'), JSON.stringify({ ids, heldExplorers: 2, explainerRequests: 0 }));
    writeFileSync(iso.env.MSTACK_BARRIER, 'release');
    const statusPaths = ids.map(id => join(dir, 'native-state/async-subagent-runs', id, 'status.json'));
    let statuses;
    do {
      statuses = statusPaths.map(p => JSON.parse(readFileSync(p)));
      if (statuses.every(s => s.state === 'complete')) break;
      assert.ok(Date.now() < deadline, 'both workflows finish'); await new Promise(r => setTimeout(r, 50));
    } while (true);
    writeFileSync(join(dir, 'statuses.json'), JSON.stringify(statuses, null, 2));
    if (outcome === 'blocked') {
      for (const s of statuses) assert.equal(s.workflow.value.status, 'blocked');
      const references = statuses.flatMap(s => s.workflow.value.partialReferences);
      assert.equal(new Set(references).size, 4);
      assert.equal(captures(iso.env).filter(c => c.system?.includes('<active_agent name="pstack-explainer"/>')).length, 0);
      assert.equal(hash(settings), before);
      writeFileSync(join(dir, 'checks.json'), JSON.stringify({ status: 'PASS', version, ids, references, settingsBefore: before, settingsAfter: hash(settings) }, null, 2));
      return;
    }
    const bindings = statuses.flatMap(s => {
      assert.equal(s.workflow.value.status, 'explained');
      return [...s.workflow.value.evidence.explorers, s.workflow.value.explanation];
    });
    assert.equal(new Set(bindings.map(e => e.reference)).size, 6);
    assert.equal(new Set(bindings.map(e => e.runId)).size, 6);
    for (const e of bindings) assert.deepEqual(JSON.parse(readFileSync(e.reference)), e.report);
    assert.equal(hash(settings), before);
    writeFileSync(join(dir, 'checks.json'), JSON.stringify({ status: 'PASS', version, ids, bindings, settingsBefore: before, settingsAfter: hash(settings) }, null, 2));
  } finally {
    writeFileSync(iso.env.MSTACK_BARRIER, 'release');
    await client.stop();
    writeFileSync(join(dir, 'events.json'), JSON.stringify(client.records, null, 2));
    writeFileSync(join(dir, 'stderr.txt'), client.stderr());
  }
});
