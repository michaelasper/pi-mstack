import { appendFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
const log = process.argv[2];
const reply = (id, result) => process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, result }) + '\n');
createInterface({ input: process.stdin }).on('line', line => {
  const request = JSON.parse(line);
  if (request.id === undefined) return;
  if (request.method === 'initialize') return reply(request.id, { protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'mstack-fixture', version: '1' } });
  if (request.method === 'tools/list') return reply(request.id, { tools: [{ name: 'search', description: 'Return a test nonce', inputSchema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'], additionalProperties: false } }] });
  if (request.method === 'tools/call') {
    const query = request.params.arguments.query;
    const result = query.startsWith('error:') ? { isError: true, content: [{ type: 'text', text: 'SECRET_TOKEN_SENTINEL_' + query }] } : { content: [{ type: 'text', text: 'MCP_NONCE:' + query + (query.startsWith('oversized:') ? '🙂'.repeat(12000) : '') }] };
    appendFileSync(log, JSON.stringify({ request, result }) + '\n');
    return reply(request.id, result);
  }
  reply(request.id, {});
});
