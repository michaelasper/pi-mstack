import { getAgentDir, type ExtensionAPI, type ExtensionContext } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import { loadEnvironment, type Environment } from './environment-config.ts';

const ticketIds = (text: string) => [...new Set(text.match(/\b[A-Z][A-Z0-9]+-[1-9][0-9]*\b/g) ?? [])];
const hasNameHistory = (ctx: ExtensionContext) => !!ctx.sessionManager.getSessionName() || ctx.sessionManager.getEntries().some(entry => entry.type === 'session_info' || (entry.type === 'custom' && entry.customType === 'pi-mstack/naming-attempt'));

export function taskName(raw: string): string {
  const text = raw.replace(/[\p{Cc}\p{Cf}\s]+/gu, ' ').trim();
  const ids = ticketIds(text);
  return [...(ids.length === 1 ? ids[0] : text)].slice(0, 80).join('');
}

export function nameSession(pi: ExtensionAPI, ctx: ExtensionContext, raw: string, environment: Environment): void {
  if (process.env.PI_SUBAGENT_CHILD === '1' || environment.kind === 'invalid' || environment.naming !== 'task' || hasNameHistory(ctx)) return;
  const name = taskName(raw);
  if (!name) return;
  pi.appendEntry('pi-mstack/naming-attempt', { version: 1 });
  pi.setSessionName(name);
}

type Offer = { kind: 'closed' } | { kind: 'eligible'; sessionId: string; ticket: string | undefined };

export function registerNaming(pi: ExtensionAPI) {
  const tool = 'mstack_set_session_title';
  let offer: Offer = { kind: 'closed' };
  const activate = (enabled: boolean) => {
    const active = pi.getActiveTools();
    if (active.includes(tool) !== enabled) pi.setActiveTools(enabled ? [...active, tool] : active.filter(name => name !== tool));
  };
  const clear = () => { offer = { kind: 'closed' }; activate(false); };
  pi.registerTool({
    name: tool,
    label: 'Set session title',
    description: 'Set this never-named session title once. Use 3-8 words without ticket identifiers. The extension supplies the accepted task ticket prefix. Final title is limited to 80 Unicode code points.',
    promptGuidelines: ['Call mstack_set_session_title once after the task is clear. Supply 3-8 words with no ticket key because the extension prefixes it. Continue the task normally.'],
    defaultActive: false,
    exposure: 'model-only',
    executionMode: 'sequential',
    parameters: Type.Object({ title: Type.String({ minLength: 1, maxLength: 160 }) }, { additionalProperties: false }),
    async execute(_id, params, signal, _update, ctx) {
      const environment = loadEnvironment({ agentDir: getAgentDir(), cwd: ctx.cwd, nativeTrusted: ctx.isProjectTrusted(), sessionId: ctx.sessionManager.getSessionId(), notify: text => {
        if (ctx.hasUI) ctx.ui.notify(text, 'warning');
        else process.stderr.write(`pi-mstack: ${text}\n`);
      } });
      if (signal?.aborted || process.env.PI_SUBAGENT_CHILD === '1' || offer.kind !== 'eligible' || offer.sessionId !== ctx.sessionManager.getSessionId() || environment.kind === 'invalid' || environment.naming !== 'model' || hasNameHistory(ctx)) {
        clear();
        throw Error('Session title is no longer eligible.');
      }
      if (typeof params.title !== 'string' || /[\p{Cc}\p{Cf}]/u.test(params.title)) throw Error('Title must contain text without control or format characters.');
      const title = params.title.trim().replace(/\s+/gu, ' ');
      const words = title ? title.split(' ').length : 0;
      if (words < 3 || words > 8 || /\b[A-Z][A-Z0-9]*-[0-9]+\b/i.test(title)) throw Error('Use 3-8 title words without ticket identifiers.');
      const name = offer.ticket ? `${offer.ticket} ${title}` : title;
      if ([...name].length > 80) throw Error('Final title including ticket prefix must fit 80 Unicode code points.');
      try {
        pi.appendEntry('pi-mstack/naming-attempt', { version: 1 });
        pi.setSessionName(name);
      } finally { clear(); }
      return { content: [{ type: 'text', text: `Session title set to ${JSON.stringify(name)}.` }], details: {} };
    },
  });
  return {
    clear,
    accept(ctx: ExtensionContext, raw: string, environment: Environment) {
      clear();
      nameSession(pi, ctx, raw, environment);
      if (process.env.PI_SUBAGENT_CHILD === '1' || environment.kind === 'invalid' || environment.naming !== 'model' || hasNameHistory(ctx)) return;
      const ids = ticketIds(raw);
      offer = { kind: 'eligible', sessionId: ctx.sessionManager.getSessionId(), ticket: ids.length === 1 ? ids[0] : undefined };
      activate(true);
    },
  };
}
