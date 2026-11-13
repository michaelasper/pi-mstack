import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { getAgentDir, type ExtensionAPI } from '@earendil-works/pi-coding-agent';

export default function controls(pi: ExtensionAPI) {
  let race = '';
  pi.registerCommand('test-title-race', { handler: async args => { race = args; } });
  pi.registerCommand('test-title-reload', { handler: async (_args, ctx) => { await ctx.reload(); } });
  pi.registerCommand('test-title-tree', { handler: async (args, ctx) => { await ctx.navigateTree(args, { summarize: false }); } });
  pi.registerCommand('test-title-force', { handler: async () => { pi.setActiveTools([...pi.getActiveTools(), 'mstack_set_session_title']); } });
  pi.registerCommand('test-title-clear', { handler: async () => { pi.setSessionName(''); } });
  pi.registerCommand('test-title-seal', { handler: async () => { pi.appendEntry('pi-mstack/naming-attempt', { version: 1 }); } });
  pi.on('input', event => {
    if (event.text.startsWith('CONSUME_TITLE')) return { action: 'handled' };
    if (event.text.startsWith('REPLACE_TITLE')) return { action: 'transform', text: 'EXECUTE_TEST_PLAN changed task' };
  });
  pi.on('tool_call', (event, ctx) => {
    if (event.toolName !== 'mstack_set_session_title') return;
    const action = race; race = '';
    if (action === 'rename') pi.setSessionName('Manual title');
    if (action === 'cancel') ctx.abort();
    if (action === 'policy') writeFileSync(join(getAgentDir(), 'pstack/environment.json'), JSON.stringify({ version: 'pi-mstack/environment/1', naming: 'off' }));
  });
  pi.on('session_before_compact', event => ({ compaction: { summary: event.reason === 'overflow' ? 'EXECUTE_TEST_PLAN continue parser repair' : 'Local test summary', firstKeptEntryId: event.preparation.firstKeptEntryId, tokensBefore: event.preparation.tokensBefore } }));
}
