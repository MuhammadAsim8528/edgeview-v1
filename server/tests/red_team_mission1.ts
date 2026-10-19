import { getAppSettings, saveAppSettings } from '../settings';
import { ResourceGovernor } from '../resource_governor';
import { executeProviderAwareSearch } from '../orchestrator';
import { enrichCompanyDetails } from '../enrichment';
import { callAi } from '../enrichment';

const settings = getAppSettings();

async function testProviderFailures() {
  console.log('=== MISSION 1: PROVIDER FAILURE BRUTALITY ===\n');
  
  // 1. Check current provider configuration
  console.log('1. Provider Configuration:');
  console.log(`   primary_ai_provider: ${settings.primary_ai_provider}`);
  console.log(`   nvidia_model: ${settings.nvidia_model}`);
  console.log(`   groq_model: ${settings.groq_model}`);
  console.log(`   nvidia_enabled: ${settings.nvidia_enabled}`);
  console.log(`   groq_enabled: ${settings.groq_enabled}`);
  console.log(`   gemini_enabled: ${settings.gemini_enabled}`);
  
  // 2. Test NVIDIA with reasoning model
  console.log('\n2. Testing NVIDIA with reasoning model...');
  try {
    const result = await callAi('Return JSON: {"test": "ok"}', settings);
    console.log(`   SUCCESS: ${result.slice(0, 50)}`);
  } catch (e: any) {
    console.log(`   FAILED: ${e.message}`);
  }
  
  // 3. Test Groq
  console.log('\n3. Testing Groq...');
  try {
    // Temporarily switch to Groq
    const oldPrimary = settings.primary_ai_provider;
    settings.primary_ai_provider = 'GROQ';
    const result = await callAi('Return JSON: {"test": "ok"}', settings);
    console.log(`   SUCCESS: ${result.slice(0, 50)}`);
    settings.primary_ai_provider = oldPrimary;
  } catch (e: any) {
    console.log(`   FAILED: ${e.message}`);
  }
  
  // 4. Test ResourceGovernor circuit breaker
  console.log('\n4. Testing ResourceGovernor circuit breaker...');
  const governor = ResourceGovernor;
  const state = governor.getCircuitState('nvidia');
  console.log(`   NVIDIA circuit state: ${state}`);
  
  // 5. Test provider failure memory
  console.log('\n5. Testing provider failure memory...');
  const { classifyProviderFailure, failureContextFingerprint, shouldSuppressEquivalentFailure, rememberProviderFailure } = await import('../provider_failure_memory');
  
  const testError = new Error('HTTP 503 Service Unavailable');
  const fp = failureContextFingerprint({ action: 'test', evidence: 0 });
  const memory = rememberProviderFailure([], 'nvidia', 'extract', fp, testError);
  console.log(`   Recorded failure: ${memory[0].failure_class}, attempts: ${memory[0].attempts}`);
  
  const suppressed = shouldSuppressEquivalentFailure(memory, 'nvidia', 'extract', fp);
  console.log(`   Suppress equivalent: ${suppressed}`);
  
  // Different context should NOT be suppressed
  const fp2 = failureContextFingerprint({ action: 'test', evidence: 1 });
  const suppressed2 = shouldSuppressEquivalentFailure(memory, 'nvidia', 'extract', fp2);
  console.log(`   Suppress different context: ${suppressed2}`);
  
  // 6. Test search provider fallback
  console.log('\n6. Testing search provider allocation...');
  try {
    const { results, providerUsed } = await executeProviderAwareSearch(
      'SLIM PHARMACEUTICALS PVT LTD Sri Lanka contact',
      'company',
      settings,
      (msg) => console.log(`   [LOG] ${msg}`),
      'SLIM PHARMACEUTICALS PVT LTD',
      { fallbackAttempts: 2 }
    );
    console.log(`   Provider used: ${providerUsed}, Results: ${results.length}`);
  } catch (e: any) {
    console.log(`   Search failed: ${e.message}`);
  }
  
  // 7. Test health endpoint
  console.log('\n7. Testing health endpoint...');
  try {
    const response = await fetch('http://127.0.0.1:3901/api/health');
    const health = await response.json();
    console.log(`   Status: ${health.status}`);
    console.log(`   Providers: ${Object.entries(health.providers).filter(([k,v]: any) => v.configured).map(([k,v]: any) => `${k}: ${v.status}`).join(', ')}`);
  } catch (e: any) {
    console.log(`   Health check failed: ${e.message}`);
  }
}

testProviderFailures().catch(console.error);