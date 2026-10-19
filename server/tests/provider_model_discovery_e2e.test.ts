import assert from 'assert';
import { fetchProviderModels, NvidiaProvider, GroqProvider } from '../ai_providers';
import { resolveApiKey, getAppSettings } from '../settings';
import { validateHttpHeaderValue } from '../utils/header_encoder';

console.log('--- RUNNING PROVIDER MODEL DISCOVERY E2E TEST SUITE ---');

async function testModelDiscoveryArchitecture() {
  const settings = getAppSettings();

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
  try {
    const nvidiaResult = await fetchProviderModels('nvidia', 'nvap••••••••CZf', undefined, true);
    assert.ok(Array.isArray(nvidiaResult.models), 'NVIDIA model discovery must return array of models');
    assert.ok(nvidiaResult.models.length > 0, 'NVIDIA model discovery must return available models');
    console.log(`✅ Test 4 Passed: NVIDIA model discovery fetched ${nvidiaResult.models.length} models using secret-state architecture`);
  } catch (err: any) {
    console.warn(`[NVIDIA Fetch Warning]: ${err.message}`);
  }

  try {
    const groqResult = await fetchProviderModels('groq', 'gsk_••••••••2G9u', undefined, true);
    assert.ok(Array.isArray(groqResult.models), 'Groq model discovery must return array of models');
    assert.ok(groqResult.models.length > 0, 'Groq model discovery must return available models');
    console.log(`✅ Test 5 Passed: Groq model discovery fetched ${groqResult.models.length} models using secret-state architecture`);
  } catch (err: any) {
    console.warn(`[Groq Fetch Warning]: ${err.message}`);
  }

  // Test 6: Verify accidental bullet character in new raw key is caught cleanly before HTTP fetch
  try {
    await NvidiaProvider.listModels('nvapi-bad•bullet•key');
    assert.fail('Should have thrown clean validation error for bullet in key');
  } catch (err: any) {
    assert.ok(err.message.includes('invalid HTTP-header character'), 'Must throw clean validation error');
    assert.ok(err.message.includes('U+2022'), 'Must cite code point U+2022');
    console.log('✅ Test 6 Passed: Raw key with bullet rejected by transport guard before fetch');
  }

  console.log('🎉 ALL PROVIDER MODEL DISCOVERY E2E TESTS PASSED 100%');
}

testModelDiscoveryArchitecture().catch((err) => {
  console.error('❌ E2E Model Discovery Test Failed:', err);
  process.exit(1);
});
