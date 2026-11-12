import { appendFileSync } from 'node:fs';
import { Type } from 'typebox';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
export default function childTool(pi: ExtensionAPI) {
  pi.registerTool({
    name: 'fixture_child_tool', label: 'Child fixture', description: 'Return a nonce for native invocation tests.',
    parameters: Type.Object({ nonce: Type.String() }),
    async execute(_id, { nonce }) {
      if (process.env.MSTACK_CHILD_LOG) appendFileSync(process.env.MSTACK_CHILD_LOG, JSON.stringify({ nonce }) + '\n');
      return { content: [{ type: 'text', text: 'CHILD_TOOL_NONCE:' + nonce }], details: {} };
    },
  });
}
