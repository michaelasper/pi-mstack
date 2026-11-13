import { Type } from 'typebox';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
export default function alternate(pi: ExtensionAPI) {
  pi.registerCommand('mcp', { description: 'Alternate adapter fixture', handler: async () => {} });
  pi.registerTool({
    name: 'mcp__tracker__update', label: 'Alternate', description: 'Fixture update',
    parameters: Type.Object({ key: Type.String(), state: Type.String() }),
    execute: async () => { throw Error('Alternate must not execute'); },
  });
}
