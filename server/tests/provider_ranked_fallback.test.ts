import assert from 'node:assert/strict';
import { executeProviderAwareSearch } from '../orchestrator';
import { getAppSettings } from '../settings';
import { ResourceGovernor } from '../resource_governor';

const originalFetch = globalThis.fetch;
const settings: any = { ...getAppSettings(), serper_api_key:'test', serper_enabled:true, tavily_api_key:'test', tavily_enabled:true, exa_enabled:false, linkup_enabled:false, hunter_enabled:false };
ResourceGovernor.resetCircuit('serper');
ResourceGovernor.resetCircuit('tavily');
let serper = 0; let tavily = 0;
globalThis.fetch = (async (input: any) => {
  const url = String(input);
  if (url.includes('serper')) { serper++; return new Response('failed', { status: 503 }); }
  if (url.includes('tavily')) { tavily++; return new Response(JSON.stringify({ results:[{ url:'https://atlas.example', title:'Atlas', content:'Atlas Medical Ghana' }] }), { status:200, headers:{'content-type':'application/json'} }); }
  throw new Error(`unexpected ${url}`);
}) as any;
try {
  const result = await executeProviderAwareSearch('"Atlas Medical" "Ghana"', 'company', settings, () => {}, 'Atlas Medical', { preferredProvider:'serper' });
  assert.equal(result.providerUsed, 'tavily');
  assert.equal(result.results[0].link, 'https://atlas.example');
  assert(serper >= 1 && tavily === 1);
} finally { globalThis.fetch = originalFetch; ResourceGovernor.resetCircuit('serper'); ResourceGovernor.resetCircuit('tavily'); }
console.log('provider_ranked_fallback.test.ts: PASS');
