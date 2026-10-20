import assert from 'assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { validateHttpHeaderValue } from '../utils/header_encoder';

const live = process.env.EDGEVIEW_LIVE_PROVIDER_TESTS === '1';
const originalConfig = process.env.EDGEVIEW_CONFIG;
const originalFetch = globalThis.fetch;
const root = live ? null : fs.mkdtempSync(path.join(os.tmpdir(), 'edgeview-model-discovery-'));
if (root) {
  process.env.EDGEVIEW_CONFIG = path.join(root, 'config.json');
  fs.writeFileSync(process.env.EDGEVIEW_CONFIG, JSON.stringify({ nvidia_api_key: 'synthetic-nvidia-discovery', groq_api_key: 'synthetic-groq-discovery' }));
  globalThis.fetch = (async () => { throw new Error('Unexpected network request in isolated model-discovery test'); }) as typeof fetch;
}
const { fetchProviderModels, NvidiaProvider, GroqProvider } = await import('../ai_providers');
const { resolveApiKey, getAppSettings } = await import('../settings');
const originalNvidia = NvidiaProvider.listModels;
const originalGroq = GroqProvider.listModels;
if (!live) {
  NvidiaProvider.listModels = async key => {
    if (process.env.EDGEVIEW_TEST_MODEL_FAILURE === 'nvidia') throw new Error('Controlled catalog failure');
    assert.equal(key, 'synthetic-nvidia-discovery');
    return [{ id: 'synthetic-nvidia-model', name: 'Synthetic NVIDIA' }];
  };
  GroqProvider.listModels = async key => {
    if (process.env.EDGEVIEW_TEST_MODEL_FAILURE === 'groq') throw new Error('Controlled catalog failure');
    assert.equal(key, 'synthetic-groq-discovery');
    return [{ id: 'synthetic-groq-model', name: 'Synthetic Groq' }];
  };
}
console.log(live ? 'LIVE model-catalog verification; errors fail the run' : 'ISOLATED model-discovery contract; synthetic catalogs, no live provider verification');

async function testModelDiscoveryArchitecture() {
  const settings = getAppSettings();
  assert.ok(settings.nvidia_api_key && settings.groq_api_key, 'Both provider credentials are required for this selected test mode');

  // Test 1: Resolve Key logic for NVIDIA & Groq
  const maskedNvidia = 'nvap••••••••CZf';
  const resolvedNvidia = resolveApiKey(maskedNvidia, settings.nvidia_api_key);
  assert.strictEqual(resolvedNvidia, settings.nvidia_api_key, 'Masked NVIDIA key must resolve to stored config key');
  console.log('✅ Test 1 Passed: Masked NVIDIA key resolved to stored credential');

  const maskedGroq = 'gsk_••••••••2G9u';
  const resolvedGroq = resolveApiKey(maskedGroq, settings.groq_api_key);
  assert.strictEqual(resolvedGroq, settings.groq_api_key, 'Masked Groq key must resolve to stored config key');
  console.log('✅ Test 2 Passed: Masked Groq key resolved to stored credential');

  // Test 3: ByteString safety check on resolved keys
  const nvidiaHeaderCheck = validateHttpHeaderValue(`Bearer ${resolvedNvidia}`, 'NVIDIA Authorization');
  assert.strictEqual(nvidiaHeaderCheck.valid, true, 'Resolved NVIDIA key header must be ByteString safe');

  const groqHeaderCheck = validateHttpHeaderValue(`Bearer ${resolvedGroq}`, 'Groq Authorization');
  assert.strictEqual(groqHeaderCheck.valid, true, 'Resolved Groq key header must be ByteString safe');
  console.log('✅ Test 3 Passed: Both resolved provider keys are ByteString safe (0 bullet characters)');

  // Test 4: Verify fetchProviderModels with masked key parameter
    const nvidiaResult = await fetchProviderModels('nvidia', 'nvap••••••••CZf', undefined, true);
    assert.ok(Array.isArray(nvidiaResult.models), 'NVIDIA model discovery must return array of models');
    assert.ok(nvidiaResult.models.length > 0, 'NVIDIA model discovery must return available models');
    console.log(`✅ Test 4 Passed: NVIDIA model discovery fetched ${nvidiaResult.models.length} models using secret-state architecture`);

    const groqResult = await fetchProviderModels('groq', 'gsk_••••••••2G9u', undefined, true);
    assert.ok(Array.isArray(groqResult.models), 'Groq model discovery must return array of models');
    assert.ok(groqResult.models.length > 0, 'Groq model discovery must return available models');
    console.log(`✅ Test 5 Passed: Groq model discovery fetched ${groqResult.models.length} models using secret-state architecture`);

  // Test 6: Verify accidental bullet character in new raw key is caught cleanly before HTTP fetch
  NvidiaProvider.listModels = originalNvidia;
  try {
    await NvidiaProvider.listModels('nvapi-bad•bullet•key');
    assert.fail('Should have thrown clean validation error for bullet in key');
  } catch (err: any) {
    assert.ok(err.message.includes('invalid HTTP-header character'), 'Must throw clean validation error');
    assert.ok(err.message.includes('U+2022'), 'Must cite code point U+2022');
    console.log('✅ Test 6 Passed: Raw key with bullet rejected by transport guard before fetch');
  }

  console.log(live ? 'PASS explicitly requested live model catalogs and credential/header assertions; not UI or generation verification' : 'PASS isolated masked-key routing and header assertions; live model catalogs NOT VERIFIED');
}

try { await testModelDiscoveryArchitecture(); }
catch {
  // Provider errors can contain request details. A failed assertion/transport is
  // a real test failure, never an overall-success warning or raw secret dump.
  console.error('FAIL model-discovery verification; no success claim for failed catalogs');
  process.exitCode = 1;
} finally {
  NvidiaProvider.listModels = originalNvidia;
  GroqProvider.listModels = originalGroq;
  globalThis.fetch = originalFetch;
  if (originalConfig === undefined) delete process.env.EDGEVIEW_CONFIG;
  else process.env.EDGEVIEW_CONFIG = originalConfig;
  if (root) fs.rmSync(root, { recursive: true, force: true });
}
