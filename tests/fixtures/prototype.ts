import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
export default function prototype(pi: ExtensionAPI) {
  pi.registerCommand('prototype-forward', {
    handler: async (args, ctx) => {
      pi.sendUserMessage(`/skill:poteto-mode ${args}`, { expandPromptTemplates: true, ...(ctx.isIdle() ? {} : { deliverAs: 'followUp' }) });
    },
  });
  pi.registerCommand('test-wake', {
    handler: async () => {
      pi.sendMessage({ customType: 'test-wake', content: 'CUSTOM_WAKE', display: false }, { triggerTurn: true });
    },
  });
}
