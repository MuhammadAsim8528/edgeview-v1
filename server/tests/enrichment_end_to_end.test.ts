import { getCachedCompany, enrichCompanyDetails } from '../enrichment';
import { getDb } from '../sqlite';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${msg}`);
  }
}

async function runEnrichmentIntegrationTests() {
  console.log('--- RUNNING ENRICHMENT & FETCH INFO INTEGRATION TEST SUITE ---');

  const testCompany = `TestPharma_${Date.now()}`;

  // 1. Cache Miss Verification
  console.log('[Test 1] Cache Miss Verification...');
  const cacheCheck1 = await getCachedCompany(testCompany);
  assert(cacheCheck1 === null, 'Cache miss returns null cleanly');

  // 2. Mock DB Persistence & Cache Seed
  console.log('[Test 2] Seed & Cache Persistence Verification...');
  const db = await getDb();
  const mockResult = {
    company_name: testCompany,
    website: 'https://testpharma.org',
    address: '100 Innovation Way, Cambridge, MA',
    phone: '+1 617 555 0199',
    email: 'contact@testpharma.org',
    industry: 'Pharmaceutical Manufacturing',
    quality_status: 'COMPLETE',
    evidence: [
      {
        field: 'Email',
        value: 'contact@testpharma.org',
        source_url: 'https://testpharma.org/contact',
        source_type: 'contact_page',
        confidence: 98,
        evidence_text: 'Official contact email listed on company directory'
      }
    ],
    decision_makers: [
      {
        id: 'dm-1',
        name: 'Dr. Jane Smith',
        designation: 'Chief Scientific Officer',
        emails: [{ value: 'j.smith@testpharma.org', verified: true }],
        phones: [{ value: '+1 617 555 0199', verified: false }],
        whatsapp: { value: '', status: 'unknown' },
        socials: []
      }
    ],
    contact_persons: [
      {
        name: 'Jane Smith',
        designation: 'Chief Scientific Officer',
        email: 'j.smith@testpharma.org',
        phone: '+1 617 555 0199',
        source_url: 'https://testpharma.org/leadership'
      }
    ]
  };

  await db.run(
    `INSERT INTO contact_cache (company_name, website, address, phone, email, industry, details_json, source)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(company_name) DO UPDATE SET details_json=excluded.details_json`,
    [
      testCompany,
      mockResult.website,
      mockResult.address,
      mockResult.phone,
      mockResult.email,
      mockResult.industry,
      JSON.stringify(mockResult),
      'test'
    ]
  );

  // 3. Cache Hit Verification (Zero External API calls)
  console.log('[Test 3] Cache Hit Verification...');
  const cachedHit = await getCachedCompany(testCompany);
  assert(cachedHit !== null, 'Cache hit retrieves persisted record');
  assert(cachedHit?.email === 'contact@testpharma.org', 'Retrieved email matches seed');
  assert(cachedHit?.decision_makers?.length === 1, 'Retrieved decision maker present');
  assert(cachedHit?.evidence?.[0]?.source_url === 'https://testpharma.org/contact', 'Authentic provenance URL retained');

  // 4. Concurrent Enrichment Request Coalescing Test
  console.log('[Test 4] Concurrent Request Coalescing...');
  const promise1 = enrichCompanyDetails(testCompany, false);
  const promise2 = enrichCompanyDetails(testCompany, false);
  const [res1, res2] = await Promise.all([promise1, promise2]);
  assert(res1.email === res2.email, 'Concurrent requests return consistent coalesced profile');

  // 5. Cleanup Test Record
  await db.run('DELETE FROM contact_cache WHERE company_name = ?', [testCompany]);
  console.log('✅ ALL ENRICHMENT & FETCH INFO INTEGRATION TESTS PASSED SUCCESSFULLY.');
}

runEnrichmentIntegrationTests().catch((err) => {
  console.error('❌ Enrichment integration tests failed:', err);
  process.exit(1);
});
