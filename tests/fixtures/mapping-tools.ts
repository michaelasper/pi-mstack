import { appendFileSync } from 'node:fs';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';

export default function mappingTools(pi: ExtensionAPI) {
  const record = (value: unknown) => appendFileSync(process.env.MSTACK_MAPPING_LOG!, JSON.stringify(value) + '\n');
  const question = (name: string, exposure: 'direct' | 'model-only' | 'hidden' | 'codemode' | 'deferred', defaultActive = true) => ({
    name, label: name, description: 'Fixture question', exposure, defaultActive,
    parameters: Type.Object({}),
    async execute() { record({ executed: name }); return { content: [{ type: 'text' as const, text: 'fixture' }], details: {} }; },
  });
  pi.registerTool(question('mapping_direct', 'direct'));
  pi.registerTool(question('mapping_model', 'model-only'));
  pi.registerTool(question('mapping_inactive', 'direct', false));
  pi.registerTool(question('mapping_hidden', 'hidden'));
  pi.registerTool(question('mapping_codemode', 'codemode'));
  pi.registerTool(question('mapping_deferred', 'deferred'));
  pi.registerTool(question('mapping_concealed', 'direct'));
  pi.registerTool({
    ...question('mapping_orchestrator', 'model-only'),
    prepareLoadout() { return { hiddenDeclarations: ['mapping_concealed'] }; },
  });
  pi.registerCommand('mapping-withdraw', { handler: async () => { pi.registerTool(question('mapping_model', 'hidden')); } });
  pi.registerCommand('mapping-state', { handler: async () => { record({ active: pi.getActiveTools() }); } });
  pi.registerCommand('mapping-reload', { handler: async (_args, ctx) => { await ctx.reload(); } });
}
