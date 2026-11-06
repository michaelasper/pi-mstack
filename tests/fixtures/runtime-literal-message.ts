import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';

export default function literalMessage(pi: ExtensionAPI) {
  pi.registerCommand('runtime-literal-message', {
    handler: async () => { pi.sendUserMessage('/skill:poteto-mode off'); },
  });
}
