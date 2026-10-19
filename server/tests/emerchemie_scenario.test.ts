import { getDb } from '../sqlite';
import { enrichCompanyDetails } from '../enrichment';

async function runTest() {
  console.log('=== STARTING EMERCHEMIE INTEGRATION TEST ===');

  const db = await getDb();

  const companyName = 'Emerchemie Ltd';
  // RFC 2606 reserved .invalid TLD -> guaranteed DNS resolution failure.
  // This deterministically forces the scraper to FAIL, exercising the real
  // production snippet-fallback (research_director EXECUTE_QUERY: if all scrapers
  // fail or are blocked, the search snippet is preserved as evidence).
  const targetUrl = 'https://emerchemie.example.invalid/contact';

  // Clear any existing cache for "Emerchemie Ltd" to ensure a clean slate
  console.log('Clearing existing cache rows...');
  await db.run('DELETE FROM contact_cache WHERE company_name = ?', [companyName]);

  // Insert mock Serper query response into search_query_cache
  const mockSerperResponse = {
    organic: [
      {
        title: 'Emerchemie Ltd - Contact Us',
        link: targetUrl,
        snippet: 'Emerchemie Ltd can be reached at info@emerchemie.lk or call +94 11 1234567. Address: Colombo, Sri Lanka.',
        domain: 'emerchemie.example.invalid'
      }
    ]
  };

  // We seed the cache for the queries the AI Planner or defaults would generate
  const queriesToSeed = [
    'Emerchemie Ltd official website contact address',
    'Emerchemie Ltd Sri Lanka official website contact',
    'Emerchemie Ltd linkedin page company profile facebook',
    'Emerchemie Ltd CEO president founder export manager director',
    'Emerchemie Ltd CEO president founder export manager director decision maker',
    'Emerchemie Ltd headquarters email address phone number contact'
  ];

  for (const q of queriesToSeed) {
    await db.run(
      'INSERT INTO search_query_cache (query, response) VALUES (?, ?) ON CONFLICT(query) DO UPDATE SET response = excluded.response',
      [q, JSON.stringify(mockSerperResponse)]
    );
  }

  // Poison the scrape cache for the target URL with empty content. This is
  // intentionally NOT a cache hit (empty content is falsy) so the scraper runs
  // against the non-resolvable .invalid domain and fails. Search metadata must
  // remain discovery-only and never become extraction evidence.
  await db.run(
    'INSERT INTO scraped_url_cache (url, content) VALUES (?, ?) ON CONFLICT(url) DO UPDATE SET content = excluded.content',
    [targetUrl, '']
  );

  // Set up mock AI settings to bypass key checks if needed
  if (!process.env.GEMINI_API_KEY) {
    process.env.GEMINI_API_KEY = 'mock-key';
  }

  // Set up global mock hook for callAi
  let snippetFoundInEvidence = false;

  (globalThis as any).__mockCallAi = async (prompt: string, settings: any) => {
    console.log('[MOCK AI] Prompt received of length:', prompt.length);
    if (prompt.includes('info@emerchemie.lk') || prompt.includes('Colombo, Sri Lanka') || prompt.includes('Emerchemie Ltd can be reached')) {
      snippetFoundInEvidence = true;
    }

    // Check if the prompt is for query planning or structured extraction
    if (prompt.includes('multi-query') || prompt.includes('OSINT researcher')) {
      console.log('[MOCK AI] Returning query plan.');
      return JSON.stringify([
        {
          query: 'Emerchemie Ltd official website contact address',
          target_type: 'official_website',
          reason: 'Identify official domain and contact page'
        }
      ]);
    }

    console.log('[MOCK AI] Returning structured extraction details.');
    return JSON.stringify({
      company_name: companyName,
      website: 'https://emerchemie.lk',
      industry: 'Pharmaceuticals',
      country: 'Sri Lanka',
      emails: ['info@emerchemie.lk'],
      phones: ['+94 11 1234567'],
      fax_numbers: [],
      linkedin_urls: [],
      addresses: [
        {
          address: 'Colombo, Sri Lanka',
          type: 'head_office',
          source_url: targetUrl
        }
      ],
      contact_persons: [],
      sources: [
        {
          url: targetUrl,
          title: 'Emerchemie Ltd - Contact Us',
          source_type: 'official_website'
        }
      ]
    });
  };

  try {
    // 3. Execute enrichment (forceFetch=false: the contact row is already
    //    deleted above, so research still runs while the seeded search/scrape
    //    sub-caches remain honored. forceFetch=true would now intentionally
    //    bypass the search/scrape caches to force a genuinely fresh re-research.)
    console.log('Running enrichCompanyDetails for Emerchemie...');
    const result = await enrichCompanyDetails(companyName, false, { country: 'Sri Lanka', role: 'Importer' });

    console.log('Result of enrichment:', JSON.stringify(result, null, 2));

    // 4. Run assertions
    if (snippetFoundInEvidence) throw new Error('TEST FAILED: Search metadata entered the factual extraction prompt.');
    if (result.email || result.phone || result.address) throw new Error('TEST FAILED: Unretrieved snippet values entered canonical facts.');

    console.log('\n=============================================');
    console.log('  SUCCESS: Emerchemie integration test passed! ');
    console.log('  Search metadata remained non-factual.       ');
    console.log('=============================================\n');
  } finally {
    // Clean up global mock
    delete (globalThis as any).__mockCallAi;
  }
}

runTest().catch((err) => {
  console.error('Integration test failed with error:', err);
  process.exit(1);
});
