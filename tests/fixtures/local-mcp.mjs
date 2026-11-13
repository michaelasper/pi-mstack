import { appendFileSync } from 'node:fs';
import { createInterface } from 'node:readline';

const reply = (id, result) => process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, result }) + '\n');
createInterface({ input: process.stdin }).on('line', line => {
  const request = JSON.parse(line);
  if (request.id === undefined) return;
  if (request.method === 'initialize') return reply(request.id, { protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'mstack-local-fixture', version: '1' } });
  if (request.method === 'tools/list') return reply(request.id, { tools: [{ name: 'echo_nonce', description: 'Return a local test nonce.', inputSchema: { type: 'object', properties: { nonce: { type: 'string' } }, required: ['nonce'], additionalProperties: false } }] });
  if (request.method === 'tools/call') {
    const result = { content: [{ type: 'text', text: 'LOCAL_MCP_NONCE:' + request.params.arguments.nonce }] };
    appendFileSync(process.argv[2], JSON.stringify({ request, result }) + '\n');
    return reply(request.id, result);
  }
  reply(request.id, {});
});
