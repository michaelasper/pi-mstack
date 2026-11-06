import { appendFileSync, readFileSync } from 'node:fs';
import { createAssistantMessageEventStream, getCurrentSystemPrompt, type AssistantMessage, type ToolCall } from '@earendil-works/pi-ai';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';

export default function provider(pi: ExtensionAPI) {
  pi.registerProvider('mstack-test', {
    api: 'mstack-scripted', baseUrl: 'http://127.0.0.1:1', apiKey: 'scripted-not-a-credential',
    models: ['script/model', 'other', 'no-reasoning'].map(id => ({ id, name: id, reasoning: id !== 'no-reasoning', input: ['text'], cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 200000, maxTokens: 4096 })),
    streamSimple(model, context, options) {
      const stream = createAssistantMessageEventStream();
      const log = process.env.MSTACK_CAPTURE;
      if (log) appendFileSync(log, JSON.stringify({ pid: process.pid, model: model.id, tools: pi.getActiveTools(), system: getCurrentSystemPrompt(context.messages), messages: context.messages }) + '\n');
      const message: AssistantMessage = { role: 'assistant', provider: model.provider, api: model.api, model: model.id, timestamp: Date.now(), content: [], stopReason: 'stop', usage: { input: 1, output: 1, cacheRead: 0, cacheWrite: 0, totalTokens: 2, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } } };
      const last = context.messages.at(-1);
      const text = JSON.stringify(last) ?? "";
      let calls: Array<{ name: string; arguments: ToolCall['arguments'] }> = [];
      if (last?.role === 'user' && text.includes('EXECUTE_TEST_PLAN') && process.env.MSTACK_PLAN) calls = JSON.parse(readFileSync(process.env.MSTACK_PLAN, 'utf8'));
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
          const output = text.includes('NATIVE_CHILD') ? 'native-child-retained' : 'scripted-complete';
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
