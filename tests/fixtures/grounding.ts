import { fileURLToPath } from 'node:url';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { registerRequiredChildExtensions } from 'pi-subagents/required-child-extensions';

export default function groundingFixture(pi: ExtensionAPI) {
  if (process.env.PI_SUBAGENT_CHILD === '1') return;
  pi.on('tool_call', event => {
    if (process.env.MSTACK_REJECT_LAUNCH === '1' && event.toolName === 'subagent_launch') return { block: true, reason: 'Scripted owner refusal.' };
  });
  let registration: { dispose(): void } | undefined;
  pi.on('session_start', (_event, ctx) => {
    registration = registerRequiredChildExtensions({ sessionId: ctx.sessionManager.getSessionId(), extensions: [{ id: 'scripted-fixture', path: fileURLToPath(new URL('./provider.ts', import.meta.url)) }] });
  });
  pi.on('session_shutdown', () => registration?.dispose());
}
