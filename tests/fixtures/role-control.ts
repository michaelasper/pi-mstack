import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { Type } from 'typebox';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
export default function control(pi: ExtensionAPI) {
  let anchor: string | null = null;
  pi.registerCommand('role-anchor', { description: 'Retain fixture tree entry', handler: async (_args, ctx) => { anchor = ctx.sessionManager.getLeafId(); } });
  pi.registerCommand('role-tree', { description: 'Navigate fixture tree', handler: async (_args, ctx) => {
    try { if (!anchor) throw Error('Missing anchor'); await ctx.navigateTree(anchor, { summarize: false }); ctx.ui.notify('Fixture tree navigated', 'info'); }
    catch { ctx.ui.notify('Fixture tree rejected', 'info'); }
  } });
  pi.registerTool({ name: 'mcp__fixture__model', label: 'Model only', description: 'Exposure fixture', exposure: 'model-only', parameters: Type.Object({}), execute: async () => ({ content: [], details: {} }) });
  pi.registerCommand('role-metadata', { description: 'Fixture metadata', handler: async (_args, ctx) => { ctx.ui.notify(JSON.stringify(pi.getAllTools().filter(tool => tool.name.startsWith('mcp__'))), 'info'); } });
  pi.on('tool_call', async (event, ctx) => {
    const path = join(ctx.cwd, 'control.json');
    if (event.toolName !== 'pstack_context' || !existsSync(path)) return;
    const command = JSON.parse(readFileSync(path, 'utf8'));
    if (command.config) writeFileSync(command.file, JSON.stringify(command.config));
    if (command.revoke) unlinkSync(command.revoke);
    if (command.withdraw) pi.setActiveTools(pi.getActiveTools().filter(name => name !== command.withdraw));
  });
}
