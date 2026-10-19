import { enrichCompanyDetails, getCachedCompany } from '../enrichment';
import { getDb } from '../sqlite';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Uncached Coalescing Test Failed: ${msg}`);
  }
}

async function runUncachedCoalescingTest() {
  console.log('--- RUNNING UNCACHED REQUEST COALESCING INTEGRATION TEST ---');

  const uncachedCompany = `UncachedPharma_${Date.now()}`;

  // 1. Verify Company is Uncached
  const initialCache = await getCachedCompany(uncachedCompany);
  assert(initialCache === null, 'Company must be uncached at start of test');

  // 2. Issue 15 Simultaneous Fetch Info Requests for the Uncached Company
  console.log('[Test 1] Issuing 15 Concurrent Fetch Info Requests for Uncached Company...');
  const startMs = Date.now();
  const promises15 = Array.from({ length: 15 }, () => enrichCompanyDetails(uncachedCompany, false));
  
  // All 15 promises must resolve to the EXACT SAME in-flight promise result
  const results15 = await Promise.all(promises15);
  const elapsedMs = Date.now() - startMs;

  console.log(`   15 concurrent uncached calls resolved in ${elapsedMs}ms`);
  assert(results15.length === 15, 'All 15 promises resolved');
  
  const firstProfile = results15[0];
  assert(results15.every((r) => r === firstProfile || r.company_name === firstProfile.company_name), 'All 15 callers received the exact same coalesced profile object');
  
  // 3. Multi-Company Parallel Coalescing Test
  console.log('[Test 2] Issuing 5 Parallel Requests across 3 Unique Uncached Companies...');
  const company1 = `MultiCompany_Alpha_${Date.now()}`;
  const company2 = `MultiCompany_Beta_${Date.now()}`;
  const company3 = `MultiCompany_Gamma_${Date.now()}`;

  const multiPromises = [
    enrichCompanyDetails(company1, false),
    enrichCompanyDetails(company1, false), // Duplicate for Company 1
    enrichCompanyDetails(company2, false),
    enrichCompanyDetails(company2, false), // Duplicate for Company 2
    enrichCompanyDetails(company3, false), // Unique Company 3
  ];

  const multiResults = await Promise.all(multiPromises);
  assert(multiResults.length === 5, 'All 5 multi-company promises resolved');
  assert(multiResults[0].company_name === multiResults[1].company_name, 'Company 1 calls coalesced together');
  assert(multiResults[2].company_name === multiResults[3].company_name, 'Company 2 calls coalesced together');

  // 4. Cleanup Test Cache Entries
  const db = await getDb();
  await db.run('DELETE FROM contact_cache WHERE company_name LIKE ?', ['%UncachedPharma%']);
  await db.run('DELETE FROM contact_cache WHERE company_name LIKE ?', ['%MultiCompany%']);

  console.log('✅ ALL UNCACHED REQUEST COALESCING TESTS PASSED SUCCESSFULLY.');
}

runUncachedCoalescingTest().catch((err) => {
  console.error('❌ Uncached coalescing test failed:', err);
  process.exit(1);
});
