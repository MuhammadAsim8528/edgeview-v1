import { getMissingFields, getCachedCompany, saveEnrichedData, enrichCompanyDetails } from '../enrichment';
import { getDb } from '../sqlite';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Cache Test Failed: ${msg}`);
  }
}

async function runCacheCompletenessTests() {
  console.log('--- RUNNING ENRICHMENT CACHE COMPLETENESS SUITE ---');

  // 1. Test getMissingFields predicate function
  console.log('[Test 1] Testing getMissingFields predicate function...');
  const emptyFields = getMissingFields(null);
  assert(emptyFields.length === 5, 'Null record reports all 5 fields missing');

  const partialRecord = {
    company_name: 'PartialPharma',
    website: 'https://partialpharma.org',
    email: '',
    phone: '',
    address: '',
  };
  const missing = getMissingFields(partialRecord);
  assert(missing.includes('email'), 'Partial record detects missing email');
  assert(missing.includes('phone'), 'Partial record detects missing phone');
  assert(missing.includes('address'), 'Partial record detects missing address');
  assert(!missing.includes('website'), 'Partial record detects present website');

  // 2. Test Partial Cache Persistence & Retrieval
  console.log('[Test 2] Partial Cache Enrichment Persistence...');
  const testName = `PartialTestCompany_${Date.now()}`;
  
  // Save initial partial profile
  await saveEnrichedData({
    company_name: testName,
    website: 'https://partialtest.com',
    isPartial: true,
    quality_status: 'PARTIAL',
  });

  const cachedPartial = await getCachedCompany(testName);
  assert(cachedPartial !== null, 'Partial record successfully stored in cache');
  assert(getMissingFields(cachedPartial).length > 0, 'Cached partial record identifies missing fields');

  // Clean up
  const db = await getDb();
  await db.run('DELETE FROM contact_cache WHERE company_name = ?', [testName]);

  console.log('✅ ALL ENRICHMENT CACHE COMPLETENESS TESTS PASSED SUCCESSFULLY.');
}

runCacheCompletenessTests().catch((err) => {
  console.error('❌ Cache completeness tests failed:', err);
  process.exit(1);
});
