import assert from 'node:assert/strict';
import { readProviderResponse } from '../provider_response';

const payload = { organic: [], unknown: { deeply: ['retained', 17] } };
assert.deepEqual((await readProviderResponse(Response.json(payload))).body, payload);
const malformed = '<html>upstream broken, not empty search</html>';
const captured = await readProviderResponse(new Response(malformed));
assert.equal(captured.body, malformed);
assert.equal(captured.failure?.name, 'ProviderSchemaError');
assert.deepEqual((await readProviderResponse(new Response(new Uint8Array([255, 254])))).body, { encoding: 'base64', bytes: '//4=' });
assert.equal((await readProviderResponse(Response.json([]))).failure?.name, 'ProviderSchemaError');
await assert.rejects(readProviderResponse(new Response('123456'), 3), { name: 'ProviderBodyLimit' });
let cancelled = false;
const stalled = new ReadableStream<Uint8Array>({ cancel() { cancelled = true; } });
await assert.rejects(readProviderResponse(new Response(stalled), 100, 20), { name: 'ProviderBodyTimeout' });
assert.equal(cancelled, true);
console.log('PASS bounded provider bodies retain malformed evidence and reject timeouts/oversize');
