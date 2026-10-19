import assert from 'node:assert/strict';
import { executeProviderAwareSearch } from '../orchestrator';
import { getAppSettings } from '../settings';

const settings = {
  ...getAppSettings(),
  serper_api_key: 'test-disabled-key', serper_enabled: false,
  tavily_api_key: '', tavily_enabled: false,
  exa_api_key: '', exa_enabled: false,
  linkup_api_key: '', linkup_enabled: false,
  hunter_api_key: '', hunter_enabled: false,
};
let calls = 0;
const originalFetch = globalThis.fetch;
globalThis.fetch = (async () => {
  calls++;
  throw new Error('Disabled provider made an HTTP call');
}) as typeof fetch;

try {
  await assert.rejects(
    executeProviderAwareSearch('Example Company Kenya official website', 'official_website', settings, () => {}, 'Example Company'),
    /No research providers are configured or healthy/,
  );
  assert.equal(calls, 0, 'A configured but disabled Serper provider must make zero HTTP calls');
} finally {
  globalThis.fetch = originalFetch;
}

console.log('disabled_search_provider: 2 assertions passed');
