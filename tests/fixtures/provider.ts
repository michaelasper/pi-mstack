import { appendFileSync, readFileSync } from 'node:fs';
import { createAssistantMessageEventStream, getCurrentSystemPrompt, type AssistantMessage, type ToolCall } from '@earendil-works/pi-ai';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';

export default function provider(pi: ExtensionAPI) {
  if (process.env.MSTACK_IMPORT_TESTS === '1') process.env.MSTACK_IMPORT_AUTH = 'scripted-not-a-credential';
  if (process.env.MSTACK_IMPORT_TESTS === '1') pi.registerCommand('mstack-import-test', {
    handler: async (args, ctx) => {
      if (args === 'remove') pi.unregisterProvider('team/custom');
      else if (args === 'revoke') delete process.env.MSTACK_IMPORT_AUTH;
      else if (args === 'reregister-revoke') {
        delete process.env.MSTACK_IMPORT_AUTH;
        pi.registerProvider('team/custom', ctx.modelRegistry.getRegisteredProviderConfig('team/custom')!);
      }
      else if (args === 'collision') pi.registerCommand('setup-pstack', { handler: async () => {} });
      else throw Error('Unknown import test mutation');
      await ctx.modelRegistry.refresh({ allowNetwork: false });
      ctx.ui.notify(JSON.stringify({ available: ctx.modelRegistry.getAvailable().map(m => `${m.provider}/${m.id}`), catalog: ctx.modelRegistry.getAll().map(m => `${m.provider}/${m.id}`) }));
    },
  });
  for (const provider of ['mstack-test', 'team/custom', 'https://example.test/v1']) pi.registerProvider(provider, {
    api: 'mstack-scripted', baseUrl: 'http://127.0.0.1:1',
    apiKey: provider === 'team/custom' && process.env.MSTACK_IMPORT_TESTS === '1' ? '$MSTACK_IMPORT_AUTH' : 'scripted-not-a-credential',
    models: ['script/model', 'other', 'no-reasoning'].map(id => ({ id, name: id, reasoning: id !== 'no-reasoning', input: ['text', 'image'], cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 200000, maxTokens: 4096 })),
    streamSimple(model, context, options) {
      const stream = createAssistantMessageEventStream();
      const log = process.env.MSTACK_CAPTURE;
      if (log) appendFileSync(log, JSON.stringify({ pid: process.pid, model: model.id, tools: pi.getActiveTools(), system: getCurrentSystemPrompt(context.messages), messages: context.messages }) + '\n');
      const message: AssistantMessage = { role: 'assistant', provider: model.provider, api: model.api, model: model.id, timestamp: Date.now(), content: [], stopReason: 'stop', usage: { input: 1, output: 1, cacheRead: 0, cacheWrite: 0, totalTokens: 2, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } } };
      const last = context.messages.filter(m => !(m.role === 'user' && JSON.stringify(m).includes('Context source '))).at(-1);
      const text = JSON.stringify(last) ?? "";
      let calls: Array<{ name: string; arguments: ToolCall['arguments'] }> = [];
      if (last?.role === 'user' && text.includes('EXECUTE_TEST_PLAN') && process.env.MSTACK_PLAN) calls = JSON.parse(readFileSync(process.env.MSTACK_PLAN, 'utf8'));
      if (last?.role === 'user' && text.includes('EXECUTE_CHILD_PLAN') && process.env.MSTACK_CHILD_PLAN) calls = JSON.parse(readFileSync(process.env.MSTACK_CHILD_PLAN, 'utf8'));
      setTimeout(() => {
        if (options?.signal?.aborted) {
          message.stopReason = 'aborted'; message.errorMessage = 'aborted';
          stream.push({ type: 'error', reason: 'aborted', error: message }); stream.end(); return;
        }
        stream.push({ type: 'start', partial: message });
        if (calls.length) {
          message.stopReason = 'toolUse';
          for (const [index, call] of calls.entries()) {
            const block = { type: 'toolCall' as const, id: `test-${Date.now()}-${index}`, name: call.name, arguments: call.arguments };
            message.content.push(block);
            stream.push({ type: 'toolcall_start', contentIndex: index, partial: message });
            stream.push({ type: 'toolcall_delta', contentIndex: index, delta: JSON.stringify(call.arguments), partial: message });
            stream.push({ type: 'toolcall_end', contentIndex: index, toolCall: block, partial: message });
          }
        } else {
          const childPlan = context.messages.some(m => m.role === 'user' && JSON.stringify(m).includes('EXECUTE_CHILD_PLAN'));
          const output = childPlan && last?.role === 'toolResult' ? JSON.stringify(context.messages.filter(m => m.role === 'toolResult').map(m => m.content)) : text.includes('NATIVE_CHILD') ? 'native-child-retained' : 'scripted-complete';
          message.content.push({ type: 'text', text: output });
          stream.push({ type: 'text_start', contentIndex: 0, partial: message });
          stream.push({ type: 'text_delta', contentIndex: 0, delta: output, partial: message });
          stream.push({ type: 'text_end', contentIndex: 0, content: output, partial: message });
        }
        stream.push({ type: 'done', reason: message.stopReason === 'toolUse' ? 'toolUse' : 'stop', message });
        stream.end();
      }, 80);
      return stream;
    },
  });
}
