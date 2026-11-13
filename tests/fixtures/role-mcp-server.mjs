import { appendFileSync, existsSync, watch } from 'node:fs';
import { dirname } from 'node:path';
import { createInterface } from 'node:readline';
const [log, effects, gate, listGate] = process.argv.slice(2);
const reply = (id, result) => process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, result }) + '\n');
const released = (path = gate) => new Promise(resolve => {
  const watcher = watch(dirname(path), () => { if (existsSync(path)) { watcher.close(); resolve(); } });
  if (existsSync(path)) { watcher.close(); resolve(); }
});
createInterface({ input: process.stdin }).on('line', async line => {
  const request = JSON.parse(line);
  if (request.id === undefined) return;
  if (request.method === 'initialize') return reply(request.id, { protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'fixture', version: '1' } });
  if (request.method === 'tools/list' && listGate) {
    appendFileSync(log, JSON.stringify({ event: 'listing' }) + '\n');
    await released(listGate);
  }
  if (request.method === 'tools/list') return reply(request.id, { tools: ['update', 'search', 'update-name', 'update_name'].map(name => ({ name, description: 'Fixture ' + name, inputSchema: { type: 'object', properties: name !== 'search' ? { key: { type: 'string' }, state: { type: 'string' } } : { query: { type: 'string' } }, required: name !== 'search' ? ['key', 'state'] : ['query'], additionalProperties: false } })) });
  if (request.method === 'tools/call') {
    appendFileSync(log, JSON.stringify({ event: 'call', request }) + '\n');
    if (request.params.name !== 'search') appendFileSync(effects, JSON.stringify(request.params.arguments) + '\n');
    const key = request.params.arguments.key ?? request.params.arguments.query;
    if (key.startsWith('slow:')) await released();
    reply(request.id, { ...(key.startsWith('error:') ? { isError: true } : {}), content: [{ type: 'text', text: 'SUCCESS ' + JSON.stringify(request.params.arguments) + (key.startsWith('oversized:') ? '\u0000🙂'.repeat(12000) : '') }] });
    appendFileSync(log, JSON.stringify({ event: 'replied', id: request.id }) + '\n');
    return;
  }
  reply(request.id, {});
});
