import { getAppSettings } from '../settings';
import { enrichCompanyDetails, getCachedCompany, saveEnrichedData } from '../enrichment';
import { canonicalContactCacheKey, canonicalEntityIdentityKey } from '../company_identity';

console.log('=== MISSION 11: BREAK CACHE / PERSISTENCE ===\n');

// Test 1: Stale COMPLETE cache vs fresh research
console.log('=== TEST 1: Stale COMPLETE cache behavior ===');
console.log('From enrichment.ts:1408-1417:');
console.log('  if (!forceFetch && !extraContext?.deep_recovery) {');
console.log('    const cached = await getCachedCompany(cleanName, extraContext?.country, extraContext?.role);');
console.log('    if (cached) {');
console.log('      const missing = getMissingFields(cached);');
console.log('      if (missing.length === 0 || cached.quality_status === \'COMPLETE\') {');
console.log('        return cached;  // Returns stale COMPLETE without research');
console.log('      }');
console.log('    }');
console.log('  }');
console.log('');
console.log('ISSUE: If cached.quality_status === COMPLETE but missing fields exist (e.g., procurement, import contacts),');
console.log('the system returns the stale cache WITHOUT researching the missing fields.');

// Test 2: Force Fetch behavior
console.log('\n=== TEST 2: Force Fetch behavior ===');
console.log('From enrichment.ts:1444: companyState.forceFresh = forceFetch;');
console.log('From research_runtime.ts:811: companyState.forceFresh = forceFetch;');
console.log('But: forceFresh is checked in scrapeControlledPage (research_runtime.ts:665)');
console.log('  - If forceFresh, it bypasses scraped_url_cache');
console.log('  - But search_query_cache is checked at research_runtime.ts:1360 BEFORE forceFresh check!');
console.log('  - So forceFetch bypasses scrape cache but NOT search cache - INCONSISTENT!');

// Test 3: Failed fresh research erasing valid data
console.log('\n=== TEST 3: Failed fresh research erasing valid data ===');
console.log('From enrichCompanyDetailsInternal (enrichment.ts:1488-1486):');
console.log('  const finalDetails = await getCachedCompany(cleanName, extraContext?.country);');
console.log('  if (finalDetails) { return finalDetails; }');
console.log('  // Fallback in case of failure or uncached');
console.log('  return { quality_status: \'FAILED\', ... };');
console.log('');
console.log('ISSUE: If fresh research fails (network error, provider failure), it returns FAILED');
console.log('and does NOT fall back to the previously cached valid data!');

// Test 4: Stale data overwriting new richer data
console.log('\n=== TEST 4: Stale data overwriting new richer data ===');
console.log('From saveEnrichedData (enrichment.ts:1342-1358):');
console.log('  INSERT INTO contact_cache ... ON CONFLICT(company_name) DO UPDATE SET');
console.log('  website=excluded.website, address=excluded.address, ... details_json=excluded.details_json');
console.log('');
console.log('ISSUE: ON CONFLICT overwrites ALL fields with new research result.');
console.log('If new research is PARTIAL but cached was COMPLETE, the COMPLETE data is LOST!');
console.log('The code does NOT merge - it REPLACES.');

// Test 5: Legacy countryless rows vs country-aware rows
console.log('\n=== TEST 5: Legacy countryless rows vs country-aware rows ===');
console.log('From company_identity.ts:');
console.log('  canonicalContactCacheKey(name, country?, role?)');
console.log('  - With country: "company__country" or "company__country__role"');
console.log('  - Without country: "company" (countryless)');
console.log('');
console.log('From selectContactCacheRow (contact_projection.ts:27-68):');
console.log('  - Tries exact role key first, then exact country key, then countryless');
console.log('  - But countryless row may have WRONG country data!');
console.log('');
console.log('ISSUE: Legacy countryless rows can be returned for country-specific queries');
console.log('if no country-specific row exists, even if the data is for a DIFFERENT country.');

// Test 6: Force Fetch not actually forcing in all paths
console.log('\n=== TEST 6: Force Fetch not forcing in all paths ===');
console.log('research_runtime.ts:1360 - search cache checked BEFORE forceFresh:');
console.log('  if (!state.forceFresh) { cachedSearch = await db.get(...) }');
console.log('research_runtime.ts:1422 - scrape cache checked with forceFresh:');
console.log('  if (!state.forceFresh) { cachedScrape = await db.get(...) }');
console.log('');
console.log('INCONSISTENCY: forceFetch bypasses scrape cache but NOT search cache.');

// Test 7: Deleted data resurrection
console.log('\n=== TEST 7: Deleted data resurrection ===');
console.log('From server.ts:418-430 (deleteFileFromHistory):');
console.log('  Deletes from file_history, file_data, and contact_cache');
console.log('  But: does NOT delete from search_query_cache, scraped_url_cache');
console.log('');
console.log('If a file is re-uploaded with same hash:');
console.log('  - findFileByHash returns existing file');
console.log('  - Old cached research results may be reused');
console.log('  - Old search/scrape caches still exist and will be used!');

// Test 8: Test/Production isolation
console.log('\n=== TEST 8: Test/Production isolation ===');
console.log('From db_paths.ts:');
console.log('  isTestProcess() checks: NODE_ENV=test, EDGEVIEW_TEST_MODE, argv patterns');
console.log('  getSqlitePath() returns: .test-cache/edgeview-test-{pid}.db for tests');
console.log('  getConfigPath() returns: .test-cache/config.json for tests');
console.log('');
console.log('ISSUE: config_persistence_safety.test.ts shows tests write to .test-cache/');
console.log('But: getAppSettings() in production reads from repo-root config.json');
console.log('If test process runs with NODE_ENV=test but cwd is repo root:');
console.log('  - Could accidentally read production config if test config missing');