import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { installAiTransportFixture } from './fixtures/ai_transport';

const restoreAiTransport = installAiTransportFixture(['api.groq.com']);

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'edgeview-model-origin-'));
process.env.EDGEVIEW_CONFIG = path.join(root, 'config.json');
const savedFetch = globalThis.fetch;
try {
  fs.writeFileSync(process.env.EDGEVIEW_CONFIG, JSON.stringify({ nvidia_api_key: 'synthetic-stored-key-ABCDEF', nvidia_base_url: 'https://integrate.api.nvidia.com/v1' }));
  const { fetchProviderModels, GroqProvider, NvidiaProvider } = await import('../ai_providers');
  let requests = 0;
  globalThis.fetch = (async (_url, options) => {
    requests += 1;
    assert.equal(options?.redirect, 'error');
    assert.ok(options?.signal);
    return new Response(JSON.stringify({ data: [{ id: `model-${requests}` }] }), { status: 200 });
  }) as typeof fetch;
  await assert.rejects(fetchProviderModels('nvidia', undefined, 'https://example.com/v1'), /configured provider origin/);
  await assert.rejects(fetchProviderModels('nvidia', '****', 'https://example.com/v1'), /configured provider origin/);
  const connection = await NvidiaProvider.testConnection('synthetic-stored-key-ABCDEF', undefined, 'https://example.com/v1');
  assert.equal(connection.success, false);
  assert.match(connection.message, /configured provider origin/);
  assert.equal(requests, 0, 'saved key must never leave the process for a request-controlled host');
  await fetchProviderModels('groq', 'synthetic-key-one-ABCDEF');
  await fetchProviderModels('groq', 'synthetic-key-two-ABCDEF');
  assert.equal(requests, 2, 'keys sharing a suffix must not collide in model cache');
  await fetchProviderModels('groq', 'synthetic-key-one-ABCDEF');
  assert.equal(requests, 2, 'identical full credential should reuse cache');
  await GroqProvider.listModels('synthetic-groq');
  fs.writeFileSync(process.env.EDGEVIEW_CONFIG, JSON.stringify({ nvidia_api_key: 'synthetic-custom-origin-key', nvidia_base_url: 'https://custom-provider.test/v1' }));
  const beforeDefault = requests;
  await assert.rejects(NvidiaProvider.listModels('synthetic-custom-origin-key'), /configured provider origin/, 'guard must check actual default transport URL, not a different configured URL');
  assert.equal(requests, beforeDefault);
  console.log('PASS saved credential origin binding, distinct cache keys, timeout and redirect policy.');
} finally {
  restoreAiTransport();
  globalThis.fetch = savedFetch;
  delete process.env.EDGEVIEW_CONFIG;
  fs.rmSync(root, { recursive: true, force: true });
}
