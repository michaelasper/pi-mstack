import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
export default function namingControls(pi: ExtensionAPI) {
  pi.registerCommand('test-clear-name', { handler: async () => { pi.setSessionName(''); } });
  pi.registerCommand('test-interrupted-name', { handler: async () => { pi.appendEntry('pi-mstack/naming-attempt', { version: 1 }); } });
}
