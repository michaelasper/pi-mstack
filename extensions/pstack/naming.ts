import type { ExtensionAPI, ExtensionContext } from '@earendil-works/pi-coding-agent';
import type { Environment } from './environment-config.ts';

export function taskName(raw: string): string {
  const text = raw.replace(/[\p{Cc}\p{Cf}\s]+/gu, ' ').trim();
  const ids = [...new Set(text.match(/\b[A-Z][A-Z0-9]+-[1-9][0-9]*\b/g) ?? [])];
  return [...(ids.length === 1 ? ids[0] : text)].slice(0, 80).join('');
}

export function nameSession(pi: ExtensionAPI, ctx: ExtensionContext, raw: string, environment: Environment): void {
  if (process.env.PI_SUBAGENT_CHILD === '1' || environment.kind === 'invalid' || environment.naming === 'off') return;
  if (ctx.sessionManager.getSessionName() || ctx.sessionManager.getEntries().some(entry => entry.type === 'session_info' || (entry.type === 'custom' && entry.customType === 'pi-mstack/naming-attempt'))) return;
  const name = taskName(raw);
  if (!name) return;
  pi.appendEntry('pi-mstack/naming-attempt', { version: 1 });
  pi.setSessionName(name);
}
