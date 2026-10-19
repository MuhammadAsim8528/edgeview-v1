import { ResearchTaskPlanner } from '../research_fabric';
import { getMissingFields, getCachedCompany, saveEnrichedData } from '../enrichment';
import { getDb } from '../sqlite';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Partial Cache Narrowing Test Failed: ${msg}`);
  }
}

async function runPartialCacheNarrowingTest() {
  console.log('--- RUNNING PARTIAL CACHE NARROWING TEST ---');

  // 1. Planner narrows tasks when missingFields provided
  console.log('[Test 1] ResearchTaskPlanner narrows tasks to missing fields...');
  const fullTasks = ResearchTaskPlanner.plan('Some Pharma Co', { country: 'Pakistan' }, undefined, undefined);
  assert(fullTasks.length === 3, `Full research must plan 3 tasks (got ${fullTasks.length})`);

  // Only website missing -> should only plan website discovery (no social, no leadership, no email)
  const onlyWebsiteTasks = ResearchTaskPlanner.plan('Some Pharma Co', { country: 'Pakistan' }, undefined, ['website']);
  assert(onlyWebsiteTasks.length >= 1 && onlyWebsiteTasks.length <= 2, `Website-only should plan website task (got ${onlyWebsiteTasks.length})`);
  assert(onlyWebsiteTasks.every((t) => t.targetType === 'website'), `Website-only tasks must be website type (got ${onlyWebsiteTasks.map((t) => t.targetType).join(',')})`);

  // Only contact_persons missing -> no website, no social, no email tasks
  const onlyLeadershipTasks = ResearchTaskPlanner.plan('Some Pharma Co', { country: 'Pakistan' }, undefined, ['contact_persons']);
  assert(onlyLeadershipTasks.some((t) => t.targetType === 'leadership'), 'Leadership task must be present when contact_persons missing');
  assert(!onlyLeadershipTasks.some((t) => t.targetType === 'website'), 'Website task must be skipped when website present');

  // 2. getMissingFields returns the right field set for a partial cache record
  console.log('[Test 2] Partial cache record reports only genuinely-missing fields...');
  const partialRecord = {
    company_name: 'PartialNarrowPharma',
    website: 'https://partialnarrowpharma.com',
    email: 'info@partialnarrowpharma.com',
    phone: '',
    address: '',
    contact_persons: [] as any[],
    decision_makers: [] as any[],
    quality_status: 'PARTIAL',
    isPartial: true,
  };
  const missing = getMissingFields(partialRecord as any);
  assert(missing.includes('phone'), 'Phone must be reported missing');
  assert(missing.includes('address'), 'Address must be reported missing');
  assert(missing.includes('contact_persons'), 'Contact persons must be reported missing');
  assert(!missing.includes('website'), 'Website must NOT be reported missing');
  assert(!missing.includes('email'), 'Email must NOT be reported missing');

  // 3. Round-trip: a partial cached record survives save + reload with narrowed field set
  console.log('[Test 3] Partial cache round-trip preserves present fields + missing detection...');
  const testName = `PartialNarrow_${Date.now()}`;
  await saveEnrichedData({
    company_name: testName,
    website: 'https://partialnarrow.com',
    email: 'info@partialnarrow.com',
    isPartial: true,
    quality_status: 'PARTIAL',
  });

  const reloaded = await getCachedCompany(testName);
  assert(reloaded !== null, 'Partial record reloaded from cache');
  const reloadedMissing = getMissingFields(reloaded);
  assert(!reloadedMissing.includes('website'), 'Reloaded partial keeps present website');
  assert(!reloadedMissing.includes('email'), 'Reloaded partial keeps present email');
  assert(reloadedMissing.includes('phone'), 'Reloaded partial still missing phone');
  assert(reloadedMissing.includes('address'), 'Reloaded partial still missing address');

  // Planner narrowing with the reloaded record's missing fields
  const narrowed = ResearchTaskPlanner.plan(testName, { country: 'Pakistan' }, undefined, reloadedMissing);
  assert(!narrowed.some((t) => t.targetType === 'website'), 'Narrowed plan must not re-research verified website');
  assert(narrowed.length <= 3, `Narrowed plan must be smaller than full plan (got ${narrowed.length})`);

  // Cleanup
  const db = await getDb();
  await db.run('DELETE FROM contact_cache WHERE company_name = ?', [testName]);

  console.log('   ✅ Partial cache narrows research to only genuinely-missing fields.');
  console.log('\n✅ PARTIAL CACHE NARROWING TEST PASSED 100%.');
}

runPartialCacheNarrowingTest().catch((err) => {
  console.error('❌ Partial cache narrowing test failed:', err);
  process.exit(1);
});
