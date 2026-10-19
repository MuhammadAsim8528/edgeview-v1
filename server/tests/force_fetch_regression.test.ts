/**
 * FORCE-FETCH REGRESSION — "forceFetch must actually force"
 *
 * Guards the two confirmed information-loss boundaries exposed by the live
 * Slim Pharmaceuticals re-enrichment (2026-08-19):
 *
 *   RC-A  A COMPLETE cached record was seeded into `state.extractedDetails`
 *         during INITIALIZE even when forceFetch=true, so the research loop
 *         skipped EXTRACT_INFORMATION entirely and FINALIZE re-saved the stale
 *         record — newly gathered evidence was silently discarded.
 *
 *   RC-B  `search_query_cache` and `scraped_url_cache` were read
 *         unconditionally even on forceFetch, so pre-fix 5,000/6,000-char
 *         truncated page content (e.g. slimpharma.com/corporate-management at
 *         exactly 6,000 chars) kept reaching the model forever.
 *
 * Self-running (no framework); mirrors the emerchemie_scenario harness style.
 */
import { getDb } from '../sqlite';
import { enrichCompanyDetails } from '../enrichment';

let passed = 0;
function ok(name: string, cond: boolean, detail?: string) {
  if (!cond) throw new Error(`TEST FAILED: ${name}${detail ? ` — ${detail}` : ''}`);
  passed++;
  console.log(`  ✓ ${name}`);
}

const COMPANY = 'ForceFresh Pharma Ltd';
const TARGET_URL = 'https://forcefresh-pharma.invalid/contact';
const LEADERSHIP_SNIPPET =
  'ForceFresh Pharma Ltd is led by Gayan Edirisinghe (Managing Director) and Riza Cassim (Chief Executive Officer). ' +
  'Contact fresh@forcefresh-pharma.invalid or +94 11 999 888. Colombo, Sri Lanka.';
const STALE_SEARCH_SEED = JSON.stringify({ organic: [] });
const STALE_SCRAPE_SEED = 'STALE-SCRAPE-SEED-CONTENT — this must never reach the model on forceFetch';

async function seedCachedCompleteRecord(db: any): Promise<void> {
  // Mirrors the Slim baseline: a "COMPLETE" record that is actually thin.
  const details = {
    company_name: COMPANY,
    website: 'https://forcefresh-pharma.invalid',
    address: '',
    phone: '',
    email: 'stale@forcefresh-pharma.invalid',
    linkedin: '',
    industry: '',
    country: '',
    fax_numbers: [],
    emails_list: ['stale@forcefresh-pharma.invalid'],
    phones_list: [],
    linkedin_urls: [],
    addresses: [],
    contact_persons: [],
    decision_makers: [],
    socials: [],
    whatsapp_details: { value: '', status: 'unknown' },
    sources: [],
    isPartial: false,
    quality_status: 'COMPLETE',
    evidence: [],
    source: 'Evidence Fusion Engine',
  };
  await db.run(
    `INSERT INTO contact_cache (company_name, address, phone, email, linkedin, industry, website, details_json, fetched_at, source)
     VALUES (?, '', '', ?, '', '', ?, ?, CURRENT_TIMESTAMP, ?)
     ON CONFLICT(company_name) DO UPDATE SET email = excluded.email, website = excluded.website, details_json = excluded.details_json`,
    [COMPANY, 'stale@forcefresh-pharma.invalid', 'https://forcefresh-pharma.invalid', JSON.stringify(details), 'Evidence Fusion Engine']
  );
  // Poison the sub-caches with stale content that must NOT be used on forceFetch.
  await db.run(
    'INSERT INTO search_query_cache (query, response) VALUES (?, ?) ON CONFLICT(query) DO UPDATE SET response = excluded.response',
    [`${COMPANY} CEO president founder export manager director`, STALE_SEARCH_SEED]
  );
  await db.run(
    'INSERT INTO scraped_url_cache (url, content) VALUES (?, ?) ON CONFLICT(url) DO UPDATE SET content = excluded.content',
    [TARGET_URL, STALE_SCRAPE_SEED]
  );
}

async function cleanup(db: any): Promise<void> {
  await db.run('DELETE FROM contact_cache WHERE company_name = ?', [COMPANY]);
  await db.run(`DELETE FROM search_query_cache WHERE query LIKE '${COMPANY}%'`);
  await db.run('DELETE FROM scraped_url_cache WHERE url = ?', [TARGET_URL]);
}

async function runTest() {
  // Explicit test-only provider configuration. Never inherit production config.
  process.env.SERPER_API_KEY = 'TEST-' + 'SERPER-FIXTURE-000000000000';
  process.env.FIRECRAWL_API_KEY = 'TEST-' + 'FIRECRAWL-FIXTURE-000000000000';
  process.env.NVIDIA_API_KEY = 'TEST-' + 'NVIDIA-FIXTURE-000000000000';
  console.log('=== STARTING FORCE-FETCH REGRESSION TESTS ===');
  const db = await getDb();
  await cleanup(db);
  await seedCachedCompleteRecord(db);

  let searchStubHit = false;
  let extractionSeen = false;
  let extractionPrompt = '';

  (globalThis as any).fetch = async (input: any, init: any) => {
    const url = typeof input === 'string' ? input : input.url;
    const u = String(url);
    // Any configured search provider (serper/tavily/exa/linkup/hunter) serves
    // the deterministic mock organic results. forceFetch must reach one of them
    // instead of reading the poisoned search_query_cache.
    if (/(google\.serper\.dev|api\.tavily\.com|api\.exa\.ai|api\.linkup\.so|api\.hunter\.io)/.test(u)) {
      searchStubHit = true;
      const mockItem = {
        link: TARGET_URL,
        url: TARGET_URL,
        title: 'ForceFresh Pharma Ltd - Leadership',
        snippet: LEADERSHIP_SNIPPET,
        content: LEADERSHIP_SNIPPET,
        text: LEADERSHIP_SNIPPET,
      };
      return { ok: true, status: 200, json: async () => ({ organic: [mockItem], results: [mockItem] }) };
    }
    if (u.includes('api.firecrawl.dev')) {
      return { ok: true, status: 200, json: async () => ({ success: true, data: { markdown: LEADERSHIP_SNIPPET } }) };
    }
    // Direct fetches fail; factual extraction must use retrieved Firecrawl content, never the snippet.
    return { ok: false, status: 403, json: async () => ({}) };
  };

  (globalThis as any).__mockExecuteAIPlan = async (_plan: any, prompt: string, _settings: any, _logLabel: string) => {
    if (prompt.includes('<BEGIN SCRAPED WEB EVIDENCE CORPUS')) {
      extractionSeen = true;
      extractionPrompt = prompt;
      return {
        content: JSON.stringify({
          company_name: COMPANY,
          website: 'https://forcefresh-pharma.invalid',
          industry: 'Pharmaceuticals',
          country: 'Sri Lanka',
          emails: ['fresh@forcefresh-pharma.invalid'],
          phones: ['+94 11 999 888'],
          fax_numbers: [],
          linkedin_urls: [],
          addresses: [{ address: 'Colombo, Sri Lanka', type: 'head_office', source_url: TARGET_URL }],
          contact_persons: [
            { name: 'Gayan Edirisinghe', designation: 'Managing Director', source_url: TARGET_URL },
            { name: 'Riza Cassim', designation: 'Chief Executive Officer', source_url: TARGET_URL },
          ],
          sources: [{ url: TARGET_URL, title: 'ForceFresh Pharma Ltd - Leadership', source_type: 'official_website' }],
        }),
        executedProvider: 'groq',
        executedModel: 'openai/gpt-oss-120b',
        attempts: 1,
        latencyMs: 100,
      };
    }
    // Model planning: propose one leadership search (matches the runtime's
    // KnowledgeGapPlanner JSON contract; a rejected proposal simply degrades
    // to the deterministic planner, which is fine either way).
    return JSON.stringify({
      coverage: 0.7,
      confidence: 0.8,
      missing_information: ['phone', 'contact_persons'],
      proposed_actions: [
        {
          action: 'search_web',
          reason: 'find leadership',
          arguments: { query: `${COMPANY} CEO president founder export manager director`, target_type: 'leadership' },
        },
      ],
    });
  };

  try {
    const seeded = await db.get('SELECT * FROM contact_cache WHERE company_name = ?', [COMPANY]);
    console.log(`Seeded row: email=${seeded?.email} website=${seeded?.website}`);
    const result = await enrichCompanyDetails(COMPANY, true, { country: 'Sri Lanka', role: 'Importer' });

    console.log(`Result: email=${result.email} phones=${JSON.stringify(result.phones_list)} persons=${JSON.stringify(result.contact_persons)}`);

    ok('RC-B search: forceFetch bypassed search_query_cache and hit the provider', searchStubHit);
    ok('RC-A extraction: EXTRACT_INFORMATION ran instead of finalizing the stale cached record', extractionSeen);
    ok('fresh leadership evidence reached the model', extractionPrompt.includes('Gayan Edirisinghe'), `len=${extractionPrompt.length}`);
    ok('RC-B scrape: stale scraped_url_cache seed did NOT reach the model', !extractionPrompt.includes('STALE-SCRAPE-SEED'));
    ok('fresh email extracted and persisted', Array.isArray(result.emails_list) && result.emails_list.includes('fresh@forcefresh-pharma.invalid'));
    ok('fresh phone extracted and persisted', Array.isArray(result.phones_list) && result.phones_list.includes('+94 11 999 888'));
    ok(
      'executive survived the pipeline (Gayan Edirisinghe, Managing Director)',
      Array.isArray(result.contact_persons) &&
        result.contact_persons.some((cp: any) => cp.name === 'Gayan Edirisinghe' && cp.designation === 'Managing Director')
    );
    const ledgerRun = await db.get('SELECT status FROM research_ledger_runs WHERE research_id = ?', [(result as any).research_id]);
    const ledgerActions = await db.get('SELECT COUNT(*) AS count FROM research_ledger_actions WHERE research_id = ?', [(result as any).research_id]);
    ok('production force-fetch persists a completed Research Ledger run', ledgerRun?.status === 'COMPLETED');
    ok('production force-fetch persists executed Research Ledger actions', Number(ledgerActions?.count || 0) > 0);

    // Non-force runs must still honor the cache fast-path (no extra extraction).
    extractionSeen = false;
    const cachedRun = await enrichCompanyDetails(COMPANY, false, { country: 'Sri Lanka', role: 'Importer' });
    ok('non-force run returns the cached COMPLETE record without re-extraction', !extractionSeen && cachedRun.quality_status === 'COMPLETE');

    console.log('\n=============================================');
    console.log(`  SUCCESS: force-fetch regression checks passed (${passed} assertions)`);
    console.log('=============================================\n');
  } finally {
    (globalThis as any).fetch = undefined;
    delete (globalThis as any).__mockCallAi;
    await cleanup(db);
  }
}

runTest().catch((err) => {
  console.error('Force-fetch regression test failed with error:', err);
  process.exit(1);
});
