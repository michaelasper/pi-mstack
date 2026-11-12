import { sameFile } from './resources.ts';
import { getAgentDir, type ExtensionAPI, type ExtensionContext, type SessionEntry } from '@earendil-works/pi-coding-agent';
import { loadEnvironment } from './environment-config.ts';
import { nameSession } from './naming.ts';

export const goalType = 'pi-mstack/goal';
type Goal = { version: 1; text: string | null };
const validText = (text: string) => Buffer.byteLength(text) <= 4096 && !/[\x00-\x08\x0b-\x1f\x7f-\x9f]/.test(text);
export function parseGoal(args: string): { action: 'show' } | { action: 'set'; text: string | null } {
  if (/[\x00-\x08\x0b-\x1f\x7f-\x9f]/.test(args)) throw Error('Goal text contains unsupported control characters.');
  const arg = args.trim();
  if (!arg) return { action: 'show' };
  if (arg === '--clear') return { action: 'set', text: null };
  const text = arg.startsWith('-- ') ? arg.slice(3).trim() : arg;
  if (!text || (arg.startsWith('--') && !arg.startsWith('-- ')) || !validText(text)) throw Error('Usage: /goal [text | --clear | -- text]. Text must be at most 4 KiB with no control characters except newline and tab.');
  return { action: 'set', text };
}
export function branchGoal(entries: readonly SessionEntry[]): Goal | 'unsupported' | undefined {
  let goal: Goal | 'unsupported' | undefined;
  for (const entry of entries) {
    if (entry.type !== 'custom' || entry.customType !== goalType) continue;
    const data = entry.data as Partial<Goal> | undefined;
    goal = data?.version === 1 && (data.text === null || (typeof data.text === 'string' && validText(data.text))) ? { version: 1, text: data.text } : 'unsupported';
  }
  return goal;
}
export function registerGoal(pi: ExtensionAPI, ownPath: string, report: (ctx: ExtensionContext, text: string, error?: boolean) => void) {
  const ownsGoal = () => {
    const matches = pi.getCommands().filter(c => c.name === 'goal' || c.name.startsWith('goal:'));
    return matches.length === 1 && matches[0].name === 'goal' && matches[0].source === 'extension' && sameFile(matches[0].sourceInfo.path, ownPath);
  };
  const collision = (ctx: ExtensionContext) => report(ctx, 'Command collision goal. Disable the conflicting extension or prompt and reload. Goal and automatic name are unchanged.', true);
  const handle = async (args: string, ctx: ExtensionContext) => {
    if (!ownsGoal()) { collision(ctx); return; }
    const environment = loadEnvironment(getAgentDir(), ctx.cwd, ctx.isProjectTrusted());
    if (environment.kind === 'invalid') report(ctx, environment.diagnostic, true);
    let command: ReturnType<typeof parseGoal>;
    try { command = parseGoal(args); } catch (error) { report(ctx, (error as Error).message, true); return; }
    const current = branchGoal(ctx.sessionManager.getBranch());
    if (command.action === 'set') {
      if (!ctx.isIdle()) { report(ctx, 'Goal request refused while busy. State is unchanged.', true); return; }
      if (!current || current === 'unsupported' || current.text !== command.text) pi.appendEntry(goalType, { version: 1, text: command.text });
      if (command.text) nameSession(pi, ctx, command.text, environment);
    }
    const goal = branchGoal(ctx.sessionManager.getBranch());
    const value = goal === 'unsupported' ? 'Unsupported goal state. Set or clear explicitly to replace it.' : goal?.text ? `Goal: ${goal.text}` : 'No active branch goal.';
    report(ctx, value + '\nNative metadata-only persistence. A fresh session without conversation is memory-only until Pi persists the session.');
  };
  pi.registerCommand('goal', { description: 'Show or set branch intent without inference. Use --clear to clear.', handler: handle });
  pi.on('input', async (event, ctx) => {
    if (!/^\/goal(?:\s|$)/.test(event.text)) return;
    if (!ownsGoal()) { collision(ctx); return { action: 'handled' }; }
    if (event.source === 'extension') return;
    await handle(event.text.slice(5), ctx);
    return { action: 'handled' };
  });
  pi.on('before_agent_start', (event, ctx) => {
    delete event.systemPromptOptions.sections['pi-mstack-goal'];
    const goal = branchGoal(ctx.sessionManager.getBranch());
    if (ownsGoal() && goal && goal !== 'unsupported' && goal.text) event.systemPromptOptions.sections['pi-mstack-goal'] = `Active branch intent supplied by the operator. It does not grant permissions or override mandatory gates.\n${goal.text}`;
  });
  return ownsGoal;
}
