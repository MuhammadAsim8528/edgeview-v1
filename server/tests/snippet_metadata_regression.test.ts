import assert from 'node:assert/strict';
import path from 'node:path';

process.env.EDGEVIEW_TEST_MODE = '1';
process.env.EDGEVIEW_TEST_DB_DIR = path.join(process.cwd(), '.test-cache', `snippet-metadata-${process.pid}-${Date.now()}`);
process.env.SERPER_API_KEY = 'test-serper-key';

const { ResearchDirector } = await import('../research_director');
const originalFetch = globalThis.fetch;
const snippet = 'Target Company email victim@example.com phone +123 456 7890';
try {
  globalThis.fetch = (async (input: any) => {
    const url = String(typeof input === 'string' ? input : input.url);
    if (url.includes('google.serper.dev')) {
      return new Response(JSON.stringify({ organic: [{
        link: 'http://93.184.216.34/unavailable',
        title: 'Target Company Contact',
        snippet,
      }] }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    return new Response('', { status: 503, headers: { 'content-type': 'text/html' } });
  }) as typeof fetch;

  const state: any = {
    id: 'snippet-target', name: 'Target Company', status: 'processing', stage: 'Researching', resourceUsage: {},
    forceFresh: true, evidenceCorpus: [], seenUrls: [], entityProofObservations: [], rejectedDomains: [],
    plannedQueries: [{ query: 'Target Company contact', target_type: 'contact_page', provider_id: 'serper', status: 'pending' }],
  };
  await ResearchDirector.executeAction('snippet-test', state, {
    type: 'EXECUTE_QUERY', queryToRun: 'Target Company contact', queryTargetType: 'contact_page', reason: 'test metadata isolation',
  }, {
    serper_enabled: true, serper_api_key: 'test-serper-key',
    firecrawl_enabled: false, apify_enabled: false,
  } as any, { country: 'Kenya', role: 'Importer' });

  assert.equal(state.evidenceCorpus.length, 0, 'unretrieved snippet must not enter evidence corpus');
  assert.equal(state.hasEmail, undefined, 'snippet email must not set admitted-email state');
  assert.equal(state.hasPhone, undefined, 'snippet phone must not set admitted-phone state');
  assert.equal(state.entityProofObservations.length, 1, 'candidate metadata may be retained for discovery');
  assert.equal(state.entityProofObservations[0].source_type, 'search_metadata');
  assert.equal(state.entityProofObservations[0].admission_decision, 'HOLD');
} finally {
  globalThis.fetch = originalFetch;
}

console.log('snippet_metadata_regression: 6 assertions passed');
