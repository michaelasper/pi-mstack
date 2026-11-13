import type { ExtensionAPI, ExtensionContext } from '@earendil-works/pi-coding-agent';
import { loadConfig, resolveRole, type RoleSelection } from './config.ts';
import { evidenceSchema, gateSource, parseGroundingRequest, type GroundingRequest } from './grounding-contract.ts';

type Snapshot = Readonly<{ sessionId: string; explorer: RoleSelection; explainer: RoleSelection }>;

export function compileGrounding(request: GroundingRequest, explorer: string, explainer?: string) {
  const spec = { agent: 'pstack-explorer', context: 'fresh', model: explorer, outputMode: 'file-only', outputSchema: evidenceSchema };
  return `${gateSource}
const request = ${JSON.stringify(request)};
const specs = request.angles.map((angle, i) => ({ ...${JSON.stringify(spec)}, key: 'explore-' + i, output: 'explore-' + i + '.json', task: 'Inspect repository sources for this task and angle. Return the requested structured report.\\n' + JSON.stringify({task: request.task, angle}) }));
let explorers;
try { explorers = await runs.all(specs); }
catch (error) { return {status:'blocked', blockers:[String(error).slice(0,4096)]}; }
const partialReferences = explorers.filter(r => typeof r.outputReference === 'string').map(r => r.outputReference);
if (explorers.length !== specs.length || explorers.some((r,i) => r.key !== specs[i].key || !usable(r)) || new Set(explorers.map(r => r.runId)).size !== specs.length || new Set(partialReferences).size !== specs.length) return {status:'blocked', blockers:['Required explorer evidence or native acceptance failed.'], partialReferences};
const evidence = {version:1, explorers:explorers.map(r => bind(r, ${JSON.stringify(explorer)}))};
if (bytes(JSON.stringify(evidence)) > 131072) return {status:'blocked', blockers:['Evidence packet exceeds 128 KiB.'], partialReferences};
${request.mode === 'evidence-only' ? "return {status:'evidence-ready', evidence};" : `let result;
try { result = await runs.run('explain', { ...${JSON.stringify({ ...spec, agent: 'pstack-explainer', model: explainer, output: 'explanation.json' })}, task: 'Explain the task using only this evidence packet. Preserve source limitations. Return the requested structured report.\\n' + JSON.stringify({task:request.task,evidence}) }); }
catch (error) { return {status:'blocked', blockers:[String(error).slice(0,4096)], evidence}; }
if (!usable(result)) return {status:'blocked', blockers:['Explainer evidence or native acceptance failed.'], evidence};
return {status:'explained', evidence, explanation:bind(result, ${JSON.stringify(explainer)})};`}`;
}

export function registerGrounding(pi: ExtensionAPI, path: string, report: (ctx: ExtensionContext, text: string, error?: boolean) => void) {
  let registration: { dispose(): void } | undefined;
  let snapshot: Snapshot | undefined;
  let diagnostic = 'pstack.ground is not registered.';
  let generation = 0;
  function refresh(ctx: ExtensionContext) {
    const state = loadConfig(path);
    snapshot = Object.freeze({ sessionId: ctx.sessionManager.getSessionId(), explorer: Object.freeze(resolveRole(state, ctx, 'how explorer')[0]), explainer: Object.freeze(resolveRole(state, ctx, 'how explainer')[0]) });
  }
  pi.on('before_agent_start', (_event, ctx) => refresh(ctx));
  pi.on('session_start', async (_event, ctx) => {
    const current = ++generation;
    registration?.dispose();
    registration = undefined;
    refresh(ctx);
    const sessionId = ctx.sessionManager.getSessionId();
    try {
      const api = await import('pi-subagents/workflow-resources');
      if (current !== generation) return;
      const owner = pi.getAllTools().find(t => t.name === 'subagent' || t.name === 'subagents_enable');
      if (!owner) throw Error('Native owner is absent. Load pi-subagents@0.88.1 and reload.');
      registration = api.registerWorkflowResource({ sessionId, definition: { name: 'pstack.ground', version: 1, resolve(args) {
        try {
          const request = parseGroundingRequest(args), state = snapshot;
          if (!state || state.sessionId !== sessionId) throw Error('Grounding role snapshot belongs to another session.');
          if (state.explorer.blocked || !state.explorer.selector) throw Error(`Explorer role blocked. ${state.explorer.blocked}`);
          if (request.mode === 'explain' && (state.explainer.blocked || !state.explainer.selector)) throw Error(`Explainer role blocked. ${state.explainer.blocked}`);
          return { script: compileGrounding(request, state.explorer.selector, state.explainer.selector) };
        } catch (error) { return { error: String(error) }; }
      } } });
      diagnostic = `pstack.ground registered. Native owner compatibility and launch eligibility remain unverified. Tool provenance ${JSON.stringify(owner.sourceInfo)}.`;
    } catch (error) {
      diagnostic = `pstack.ground disabled. Install the npm package with pi-subagents@0.88.1 and reload. ${String(error)}`;
      report(ctx, diagnostic, true);
    }
  });
  pi.on('session_shutdown', () => { generation++; registration?.dispose(); registration = undefined; snapshot = undefined; diagnostic = 'pstack.ground is not registered.'; });
  return () => diagnostic;
}
