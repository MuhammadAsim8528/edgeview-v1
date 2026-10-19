/**
 * EMAIL ATTRIBUTION REGRESSION — "regex emails must be company-attributed"
 *
 * Guards the confirmed contamination vector (RC-E) found in the live Slim
 * re-enrichment (2026-08-19): the REG_EX_SCANNER added every email found in
 * any evidence corpus item, so an unrelated email (sales@novaoneadvisor.com)
 * from a third-party LinkedIn page leaked into Slim's persisted emails_list.
 *
 * Rule under test: when a target website is known, a regex-scanned email is
 * admitted only when the corpus item is on the company's own site, or the
 * email's domain matches the company's site domain.
 *
 * Self-running (no framework); mirrors the force_fetch_regression harness.
 */
import { getDb } from '../sqlite';
import { enrichCompanyDetails } from '../enrichment';

let passed = 0;
function ok(name: string, cond: boolean, detail?: string) {
  if (!cond) throw new Error(`TEST FAILED: ${name}${detail ? ` — ${detail}` : ''}`);
  passed++;
  console.log(`  ✓ ${name}`);
}

const COMPANY = 'AttributionTest Pharma Ltd';
const COMPANY_SITE = 'https://attributiontest-pharma.invalid/contact';
const THIRD_PARTY = 'https://www.linkedin.com/posts/attributiontest-pharma-ltd-123';
const COMPANY_EMAIL = 'info@attributiontest-pharma.invalid';
const UNRELATED_EMAIL = 'sales@unrelated.example';

const COMPANY_CONTENT =
  `${COMPANY} operates in Colombo, Sri Lanka. For sales enquiries contact ${COMPANY_EMAIL} or +94 11 123 4567.`;
const THIRD_PARTY_CONTENT =
  `${COMPANY} announcement: please reach the business development team at ${UNRELATED_EMAIL}.`;

async function cleanup(db: any): Promise<void> {
  await db.run('DELETE FROM contact_cache WHERE company_name = ?', [COMPANY]);
  await db.run('DELETE FROM scraped_url_cache WHERE url IN (?, ?)', [COMPANY_SITE, THIRD_PARTY]);
  await db.run(`DELETE FROM search_query_cache WHERE query LIKE '${COMPANY}%'`);
}

async function runTest() {
  // Explicit test-only provider configuration. Never inherit production config.
  process.env.SERPER_API_KEY = 'TEST-' + 'SERPER-FIXTURE-000000000000';
  process.env.FIRECRAWL_API_KEY = 'TEST-' + 'FIRECRAWL-FIXTURE-000000000000';
  process.env.NVIDIA_API_KEY = 'TEST-' + 'NVIDIA-FIXTURE-000000000000';
  console.log('=== STARTING EMAIL ATTRIBUTION REGRESSION TESTS ===');
  const db = await getDb();
  await cleanup(db);

  let extractionSeen = false;
  let extractionPrompt = '';
  const originalFetch = globalThis.fetch;

  (globalThis as any).fetch = async (input: any, init: any) => {
    const url = typeof input === 'string' ? input : input.url;
    const u = String(url);
    if (/(google\.serper\.dev|api\.tavily\.com|api\.exa\.ai|api\.linkup\.so|api\.hunter\.io)/.test(u)) {
      const items = [
        { link: COMPANY_SITE, url: COMPANY_SITE, title: `${COMPANY} - Contact`, snippet: COMPANY_CONTENT, content: COMPANY_CONTENT, text: COMPANY_CONTENT },
        { link: THIRD_PARTY, url: THIRD_PARTY, title: `${COMPANY} post`, snippet: THIRD_PARTY_CONTENT, content: THIRD_PARTY_CONTENT, text: THIRD_PARTY_CONTENT },
      ];
      return { ok: true, status: 200, json: async () => ({ organic: items, results: items }) };
    }
    if (u.includes('api.firecrawl.dev')) {
      const target = JSON.parse(String(init?.body || '{}')).url;
      const markdown = target === COMPANY_SITE ? COMPANY_CONTENT : target === THIRD_PARTY ? THIRD_PARTY_CONTENT : '';
      return { ok: true, status: 200, json: async () => ({ success: true, data: { markdown } }) };
    }
    if (u.includes('api.apify.com') || u.includes('api.apify.dev')) {
      return { ok: false, status: 403, json: async () => ({}) };
    }
    if (u === COMPANY_SITE) {
      return { ok: true, status: 200, text: async () => COMPANY_CONTENT, json: async () => ({}) };
    }
    if (u === THIRD_PARTY) {
      return { ok: true, status: 200, text: async () => THIRD_PARTY_CONTENT, json: async () => ({}) };
    }
    return { ok: false, status: 403, json: async () => ({}) };
  };

  (globalThis as any).__mockExecuteAIPlan = async (_plan: any, prompt: string, _settings: any, _logLabel: string) => {
    if (prompt.includes('<BEGIN SCRAPED WEB EVIDENCE CORPUS')) {
      extractionSeen = true;
      extractionPrompt = prompt;
      // Extraction returns NO emails so emails_list is populated solely by the
      // regex scanner — isolating the attribution gate under test.
      return {
        content: JSON.stringify({
          company_name: COMPANY,
          website: '',
          industry: '',
          country: 'Sri Lanka',
          emails: [],
          phones: [],
          fax_numbers: [],
          linkedin_urls: [],
          addresses: [],
          contact_persons: [],
          sources: [],
        }),
        executedProvider: 'groq',
        executedModel: 'openai/gpt-oss-120b',
        attempts: 1,
        latencyMs: 100,
      };
    }
    return {
      coverage: 0.5,
      confidence: 0.7,
      missing_information: ['email', 'phone', 'contact_persons'],
      proposed_actions: [
        {
          action: 'search_web',
          reason: 'find company contact details',
          arguments: { query: `${COMPANY} official website contact email`, target_type: 'website' },
        },
      ],
    };
  };

  try {
    const result = await enrichCompanyDetails(COMPANY, true, { country: 'Sri Lanka', role: 'Importer' });

    const emails = Array.isArray(result.emails_list) ? result.emails_list : [];
    console.log(`Result: emails=${JSON.stringify(emails)}`);

    ok('extraction ran (evidence synthesized)', extractionSeen);
    ok('third-party page reached the model corpus', extractionPrompt.includes(UNRELATED_EMAIL));
    ok('company-site email is retained', emails.includes(COMPANY_EMAIL));
    ok('unrelated email from third-party page is rejected', !emails.includes(UNRELATED_EMAIL));

    console.log('\n=============================================');
    console.log(`  SUCCESS: email attribution checks passed (${passed} assertions)`);
    console.log('=============================================\n');
  } finally {
    globalThis.fetch = originalFetch;
    delete (globalThis as any).__mockExecuteAIPlan;
    await cleanup(db);
  }
}

runTest().catch((err) => {
  console.error('\nEmail attribution regression test failed with error:', err);
  process.exit(1);
});
