import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gateSource, parseGroundingRequest } from '../extensions/pstack/grounding-contract.ts';
import { compileGrounding, registerGrounding } from '../extensions/pstack/grounding.ts';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const { usable, reportValid } = Function(gateSource + ';return {usable,reportValid};')();
const report = { version: 1, status: 'complete', findings: [{ claim: 'A claim', sources: [{ kind: 'repository', path: 'src/a.ts', revision: 'working-tree', firstLine: 1, lastLine: 2 }] }], limitations: [] };
function result(key = 'explore-0') {
  return { key, ok: true, runId: key, outputReference: '/saved/' + key, structuredOutput: structuredClone(report), results: [{ exitCode: 0, savedOutputPath: '/saved/' + key, acceptance: { status: 'attested', evidenceStatus: 'attested', explicit: true, effectiveAcceptance: { level: 'attested' }, runtimeChecks: [], childReport: { manualNotes: 'Fixture', residualRisks: ['Not source truth'], criteriaSatisfied: [{ id: 'criterion-1', status: 'satisfied' }] } } }] };
}
const request = { task: 'Explain', angles: ['one', 'two'], mode: 'explain' };
const AsyncFunction = Object.getPrototypeOf(async function() {}).constructor;
async function execute(explorers, req = request, explanation = result('explain')) {
  const calls = [];
  const value = await new AsyncFunction('runs', compileGrounding(parseGroundingRequest(req), 'provider/explorer:high', 'provider/explainer:off'))({
    all: async specs => { calls.push(specs); if (explorers instanceof Error) throw explorers; return explorers; },
    run: async (key, spec) => { calls.push({ key, spec }); if (explanation instanceof Error) throw explanation; return explanation; },
  });
  return { value, calls };
}

test('closed request bounds reject injection and count UTF-8 bytes', () => {
  assert.deepEqual(parseGroundingRequest(request), request);
  for (const change of [{ model: 'x' }, { task: '' }, { angles: [] }, { angles: ['x', 'x'] }, { angles: [' x'] }, { angles: ['😀'.repeat(65)] }, { task: '😀'.repeat(2049) }, { task: '\ud800' }, { mode: 'script' }, { mode: ['explain'] }, { mode: ['evidence-only'] }, { mode: {} }]) assert.throws(() => parseGroundingRequest({ ...request, ...change }));
  assert.equal(parseGroundingRequest({ ...request, task: '😀'.repeat(2048) }).task.length, 4096);
  assert.throws(() => parseGroundingRequest(JSON.parse('{"task":"x","angles":["x"],"mode":"explain","__proto__":{}}')));
});

test('domain gate checks closed claims and local locator syntax, not truth', () => {
  assert.equal(reportValid(report), true);
  for (const path of ['/tmp/a', '../a', 'a/../b', 'a\\b', 'C:a', 'a\u0000b', './a', 'a//b']) { const v = structuredClone(report); v.findings[0].sources[0].path = path; assert.equal(reportValid(v), false, path); }
  for (const mutate of [v => v.findings = [], v => v.findings[0].sources = [], v => v.findings[0].claim = '😀'.repeat(257), v => v.findings[0].sources[0].lastLine = 0, v => v.findings[0].sources[0].revision = 'fake-sha', v => v.runId = 'invented', v => v.status = 'blocked', v => v.findings[0].sources[0].kind = 'external']) { const v = structuredClone(report); mutate(v); assert.equal(reportValid(v), false); }
  const fabricated = structuredClone(report); fabricated.findings[0].sources[0].path = 'nonexistent-but-syntactically-valid.ts'; assert.equal(reportValid(fabricated), true);
});

test('every native or domain failure prevents synthesis', async () => {
  const mutations = [r => r.ok = false, r => r.reused = true, r => r.state = 'running', r => r.stopped = true, r => r.detached = true, r => r.interrupted = true, r => r.error = 'error', r => r.terminalOutcome = {}, r => delete r.runId, r => delete r.outputReference, r => r.results = [], r => r.results.push(r.results[0]), r => r.results[0].exitCode = 1, r => r.results[0].savedOutputPath = '/wrong', r => delete r.results[0].acceptance, r => r.results[0].acceptance.status = 'rejected', r => r.results[0].acceptance.evidenceStatus = 'claimed', r => r.results[0].acceptance.explicit = false, r => r.results[0].acceptance.effectiveAcceptance.level = 'verified', r => r.results[0].acceptance.childReportParseError = 'bad', r => r.results[0].acceptance.reviewResult = {}, r => r.results[0].acceptance.effectiveAcceptance.review = {}, r => r.results[0].acceptance.parentDecision = { status: 'rejected' }, r => r.results[0].acceptance.runtimeChecks = [{ status: 'failed' }], r => delete r.results[0].acceptance.runtimeChecks, r => delete r.results[0].acceptance.childReport.manualNotes, r => r.results[0].acceptance.childReport.criteriaSatisfied[0].status = 'not-satisfied', r => r.results[0].acceptance.childReport.commandsRun = [{ result: 'failed' }], r => r.structuredOutput.status = 'blocked', r => delete r.structuredOutput, r => r.key = 'wrong'];
  for (const mutate of mutations) {
    const broken = result('explore-1'); mutate(broken);
    const { value, calls } = await execute([result(), broken]);
    assert.equal(value.status, 'blocked'); assert.equal(calls.length, 1);
  }
  for (const explorers of [[], [result()], [result(), result()], Error('native rejection')]) { const { value, calls } = await execute(explorers); assert.equal(value.status, 'blocked'); assert.equal(calls.length, 1); }
});

test('evidence-only never starts an explainer and explain receives native associations', async () => {
  const explorers = [result(), result('explore-1')];
  const only = await execute(explorers, { ...request, mode: 'evidence-only' });
  assert.equal(only.value.status, 'evidence-ready'); assert.equal(only.calls.length, 1);
  const explained = await execute(explorers);
  assert.equal(explained.value.status, 'explained'); assert.equal(explained.calls[1].spec.model, 'provider/explainer:off');
  for (const r of explorers) assert.ok(explained.calls[1].spec.task.includes(r.outputReference));
  assert.equal(explained.value.evidence.explorers[0].attribution.actualModel, null);
  for (const spec of [...explained.calls[0], explained.calls[1].spec]) assert.equal(Object.hasOwn(spec, 'acceptance'), false, 'native resolved agent default stays authoritative');
  assert.equal(explained.calls[0][0].model, 'provider/explorer:high');
  for (const explanation of [Error('rejected'), { ...result('explain'), ok: false }]) assert.equal((await execute(explorers, request, explanation)).value.status, 'blocked');
  assert.equal(usable(result()), true);
});

test('grounding import and owner failure do not remove other extension handlers', async () => {
  const handlers = {}, notices = [];
  const pi = { on: (event, handler) => handlers[event] = handler, getAllTools: () => [] };
  const ctx = { sessionManager: { getSessionId: () => 'isolated-test' }, modelRegistry: { getAvailable: () => [] }, scopedModels: [] };
  const status = registerGrounding(pi, join(mkdtempSync(join(tmpdir(), 'grounding-')), 'missing.json'), (_ctx, text) => notices.push(text));
  await handlers.session_start({}, ctx);
  assert.match(status(), /disabled/); assert.equal(notices.length, 1);
  handlers.session_shutdown(); assert.match(status(), /not registered/);
});
