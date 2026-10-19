import assert from 'node:assert/strict';
import { executeParallelDiscoverySearch } from '../orchestrator';

const settings: any = {
  serper_api_key: 'serper-test', serper_enabled: true,
  exa_api_key: 'exa-test', exa_enabled: true,
  tavily_api_key: 'tavily-test', tavily_enabled: true,
  linkup_enabled: false, hunter_enabled: false,
};
const calls: string[] = [];
(globalThis as any).fetch = async (input: any) => {
  const url = String(input);
  calls.push(url);
  if (url.includes('serper')) return { ok: true, json: async () => ({ organic: [{ link: 'https://example.com/leadership?utm_source=serper', title: 'Leadership', snippet: 'discovery only' }] }) };
  if (url.includes('exa')) return { ok: true, json: async () => ({ results: [{ url: 'https://example.com/leadership', title: 'Leadership', text: 'discovery only' }, { url: 'https://example.com/contact', title: 'Contact' }] }) };
  if (url.includes('tavily')) return { ok: true, json: async () => ({ results: [{ url: 'https://example.com/contact/', title: 'Contact', content: 'discovery only' }] }) };
  throw new Error(`Unexpected URL ${url}`);
};

const result = await executeParallelDiscoverySearch('Example Pharma Kenya leadership', 'leadership', settings, () => {}, 'Example Pharma', { maxProviders: 3 });
assert.equal(calls.length, 3, 'all three eligible discovery providers run');
assert.equal(result.results.length, 2, 'same underlying URLs collapse');
assert.deepEqual(result.results.find((item) => item.link.includes('leadership'))?.discoveredBy.sort(), ['exa', 'serper']);
assert.deepEqual(result.results.find((item) => item.link.includes('contact'))?.discoveredBy.sort(), ['exa', 'tavily']);
delete (globalThis as any).fetch;
console.log('parallel_discovery_campaign.test.ts: PASS');
