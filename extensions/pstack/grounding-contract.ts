export type GroundingRequest = Readonly<{ task: string; angles: readonly string[]; mode: 'evidence-only' | 'explain' }>;

export function parseGroundingRequest(value: unknown): GroundingRequest {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).sort().join(',') !== 'angles,mode,task') throw Error('Grounding requires only task, angles, and mode.');
  const v = value as Record<string, unknown>;
  const text = (s: unknown, max: number): s is string => typeof s === 'string' && Boolean(s.trim()) && !/[\uD800-\uDFFF]/u.test(s) && Buffer.byteLength(s) <= max;
  if (!text(v.task, 8192) || !Array.isArray(v.angles) || v.angles.length < 1 || v.angles.length > 4 || !v.angles.every(a => text(a, 256) && a === a.trim()) || new Set(v.angles).size !== v.angles.length || (v.mode !== 'evidence-only' && v.mode !== 'explain') || Buffer.byteLength(JSON.stringify(v)) > 12288) throw Error('Invalid grounding request or exceeded UTF-8 bounds.');
  return Object.freeze({ task: v.task, angles: Object.freeze([...v.angles]), mode: v.mode as GroundingRequest['mode'] });
}

const text = (maxLength: number) => ({ type: 'string', minLength: 1, maxLength });
const object = (properties: Record<string, unknown>) => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });
const list = (items: unknown, minItems: number, maxItems: number) => ({ type: 'array', items, minItems, maxItems });
export const evidenceSchema = {
  anyOf: [
    object({ version: { const: 1 }, status: { const: 'complete' }, findings: list(object({ claim: text(1024), sources: list(object({ kind: { const: 'repository' }, path: text(512), revision: { const: 'working-tree' }, firstLine: { type: 'integer', minimum: 1 }, lastLine: { type: 'integer', minimum: 1 } }), 1, 4) }), 1, 12), limitations: list(text(512), 0, 8) }),
    object({ version: { const: 1 }, status: { const: 'blocked' }, reasons: list(text(512), 1, 8) }),
  ],
};

export const gateSource = String.raw`
function bytes(s) {
  let n = 0;
  for (const c of s) {
    const p = c.codePointAt(0);
    if (p >= 0xd800 && p <= 0xdfff) return Infinity;
    n += p <= 127 ? 1 : p <= 2047 ? 2 : p <= 65535 ? 3 : 4;
  }
  return n;
}
function text(s, max) { return typeof s === 'string' && s.trim().length > 0 && bytes(s) <= max; }
function closed(v, keys) { return v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).sort().join(',') === keys; }
function reportValid(v) {
  if (!closed(v, 'findings,limitations,status,version') || v.version !== 1 || v.status !== 'complete' || bytes(JSON.stringify(v)) > 24576) return false;
  if (!Array.isArray(v.limitations) || v.limitations.length > 8 || !v.limitations.every(s => text(s, 512))) return false;
  return Array.isArray(v.findings) && v.findings.length >= 1 && v.findings.length <= 12 && v.findings.every(f =>
    closed(f, 'claim,sources') && text(f.claim, 1024) && Array.isArray(f.sources) && f.sources.length >= 1 && f.sources.length <= 4 && f.sources.every(s =>
      closed(s, 'firstLine,kind,lastLine,path,revision') && s.kind === 'repository' && s.revision === 'working-tree' && text(s.path, 512) &&
      !s.path.startsWith('/') && !s.path.includes('\\') && !/[:\x00-\x1f\x7f]/.test(s.path) && !s.path.split('/').some(p => !p || p === '.' || p === '..') &&
      Number.isSafeInteger(s.firstLine) && Number.isSafeInteger(s.lastLine) && s.firstLine > 0 && s.lastLine >= s.firstLine));
}
function usable(r) {
  if (!r || r.ok !== true || r.reused === true || r.state === 'running' || r.stopped || r.detached || r.interrupted || r.error || r.terminalOutcome) return false;
  if (typeof r.runId !== 'string' || !r.runId || typeof r.outputReference !== 'string' || !r.outputReference) return false;
  if (!Array.isArray(r.results) || r.results.length !== 1) return false;
  const row = r.results[0], a = row.acceptance;
  if (row.exitCode !== 0 || row.error || row.savedOutputPath !== r.outputReference) return false;
  if (!a || a.status !== 'attested' || a.evidenceStatus !== 'attested' || a.explicit !== true || a.effectiveAcceptance?.level !== 'attested' || a.childReportParseError) return false;
  if (a.reviewResult || a.effectiveAcceptance.review || a.parentDecision?.status === 'rejected') return false;
  if (!Array.isArray(a.runtimeChecks) || a.runtimeChecks.some(c => c.status === 'failed')) return false;
  const report = a.childReport;
  if (!report || !text(report.manualNotes, 8192) || !Array.isArray(report.residualRisks) || !report.residualRisks.some(s => text(s, 8192)) || !Array.isArray(report.criteriaSatisfied) || report.criteriaSatisfied.length !== 1 || report.criteriaSatisfied[0].id !== 'criterion-1' || report.criteriaSatisfied[0].status !== 'satisfied') return false;
  if (report.commandsRun?.some(c => c.result === 'failed')) return false;
  return reportValid(r.structuredOutput);
}
function bind(r, selector) {
  const row = r.results[0];
  return { key: r.key, runId: r.runId, reference: r.outputReference, report: r.structuredOutput,
    attribution: { requestedSelector: selector, actualModel: typeof row.model === 'string' ? row.model : null, actualThinking: typeof row.thinking === 'string' ? row.thinking : null } };
}
`;
