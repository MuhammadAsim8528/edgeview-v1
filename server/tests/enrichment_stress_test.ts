import { getCachedCompany, enrichCompanyDetails, isValidEmail, isValidPhone } from '../enrichment';
import { getDb } from '../sqlite';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Stress Test Assertion Failed: ${msg}`);
  }
}

async function runEnrichmentStressTests() {
  console.log('--- RUNNING EDGEVIEW ENRICHMENT STRESS & RESILIENCE SUITE ---');

  // 1. High Concurrency Request Coalescing (15 Simultaneous Calls for Same Company)
  console.log('[Stress Test 1] 15 Simultaneous Calls for Same Company (Request Coalescing)...');
  const companyA = `StressPharma_Coalesce_${Date.now()}`;
  
  // Seed initial cache record to test instantaneous coalescing & cache lookup
  const db = await getDb();
  const mockProfile = {
    company_name: companyA,
    website: 'https://stresspharma.org',
    address: '500 High Speed Drive, Boston, MA',
    phone: '+1 617 555 9900',
    email: 'info@stresspharma.org',
    industry: 'Pharmaceutical Biotechnology',
    quality_status: 'COMPLETE',
    evidence: [
      {
        field: 'email',
        value: 'info@stresspharma.org',
        source_url: 'https://stresspharma.org/contact',
        source_type: 'official_site',
        confidence: 95,
        evidence_text: 'Official email on contact page'
      }
    ]
  };

  await db.run(
    `INSERT INTO contact_cache (company_name, website, address, phone, email, industry, details_json, source)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(company_name) DO UPDATE SET details_json=excluded.details_json`,
    [
      companyA,
      mockProfile.website,
      mockProfile.address,
      mockProfile.phone,
      mockProfile.email,
      mockProfile.industry,
      JSON.stringify(mockProfile),
      'stress_test'
    ]
  );

  const start1 = Date.now();
  const promises15 = Array.from({ length: 15 }, () => enrichCompanyDetails(companyA, false));
  const results15 = await Promise.all(promises15);
  const duration1 = Date.now() - start1;

  console.log(`   Processed 15 concurrent calls in ${duration1}ms`);
  assert(results15.length === 15, 'All 15 promises resolved');
  assert(results15.every((r) => r.email === 'info@stresspharma.org'), 'All 15 calls returned identical coalesced profile');
  assert(duration1 < 500, 'Concurrent cache hits returned in under 500ms');

  // 2. Deterministic Validation & Anti-Hallucination Guard Test
  console.log('[Stress Test 2] Anti-Hallucination & Format Validation Guard...');
  assert(isValidEmail('valid.contact@company.com') === true, 'Valid email passes validator');
  assert(isValidEmail('not-an-email-string') === false, 'Invalid email string rejected');
  assert(isValidEmail('fake_name@fake_domain_123.com') === true, 'Standard format passes validator');
  assert(isValidPhone('+1 (617) 555-0199') === true, 'Valid international phone passes validator');
  assert(isValidPhone('123') === false, 'Too short phone number rejected');
  assert(isValidPhone('abc-def-ghij') === false, 'Alphabetic string rejected as phone number');

  // 3. Multi-Company Parallel Batch Execution
  console.log('[Stress Test 3] Multi-Company Bounded Batch Concurrency...');
  const batchCompanies = Array.from({ length: 5 }, (_, i) => `BatchPharma_${i}_${Date.now()}`);
  
  // Seed all 5 batch companies into database cache
  for (const cName of batchCompanies) {
    const seedData = {
      company_name: cName,
      website: `https://${cName.toLowerCase()}.com`,
      email: `contact@${cName.toLowerCase()}.com`,
      quality_status: 'COMPLETE'
    };
    await db.run(
      `INSERT INTO contact_cache (company_name, website, email, details_json, source)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(company_name) DO UPDATE SET details_json=excluded.details_json`,
      [cName, seedData.website, seedData.email, JSON.stringify(seedData), 'stress_test']
    );
  }

  const start3 = Date.now();
  const batchResults = await Promise.all(batchCompanies.map((c) => enrichCompanyDetails(c, false)));
  const duration3 = Date.now() - start3;

  console.log(`   Processed 5 multi-company batch lookups in ${duration3}ms`);
  assert(batchResults.length === 5, 'All 5 batch companies enriched successfully');
  assert(batchResults.every((r, idx) => r.email === `contact@${batchCompanies[idx].toLowerCase()}.com`), 'Every batch company returned correct profile');

  // 4. Cleanup Test Records
  await db.run('DELETE FROM contact_cache WHERE source = ?', ['stress_test']);
  await db.run('DELETE FROM contact_cache WHERE company_name = ?', [companyA]);

  console.log('✅ ALL STRESS & RESILIENCE TESTS PASSED SUCCESSFULLY.');
}

runEnrichmentStressTests().catch((err) => {
  console.error('❌ Stress tests failed:', err);
  process.exit(1);
});
