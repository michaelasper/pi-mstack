import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
export default function permission(pi: ExtensionAPI) {
  pi.on('tool_call', async (event, ctx) => {
    if (event.toolName === 'mcp__tracker__update' && typeof event.input.key === 'string' && event.input.key.startsWith('prompt:') && !await ctx.ui.confirm('Fixture permission', 'Allow update?')) return { block: true, reason: 'Fixture declined' };
    if (event.toolName === 'mcp__tracker__update' && typeof event.input.key === 'string' && event.input.key.startsWith('denied:')) return { block: true, reason: 'Fixture denial' };
  });
}
