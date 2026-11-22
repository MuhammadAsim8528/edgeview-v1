import { parseQueries, classifyRunStatus, fallbackIdentityQueries, assessV1FreshReuse, createV1ResearchContext } from '../v1_engine';
import { canonicalEntityIdentityKey, canonicalCountryIdentityKey, canonicalCompanyIdentityKey } from '../company_identity';
import { getAppSettings } from '../settings';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`v1_engine pure functions test failed: ${message}`);
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

// Test canonical identity keys
console.log('Testing canonical identity keys...');

const entityKey1 = canonicalEntityIdentityKey('Acme Corp', 'USA');
const entityKey2 = canonicalEntityIdentityKey('acme corp', 'usa');
assertEqual(entityKey1, entityKey2, 'Entity key should be case-insensitive');

const entityKey3 = canonicalEntityIdentityKey('Acme Corp', 'USA');
const entityKey4 = canonicalEntityIdentityKey('Acme Corp', 'Canada');
assert(entityKey3 !== entityKey4, 'Entity key should differ by country');

const companyKey1 = canonicalCompanyIdentityKey('Acme Corp Ltd');
const companyKey2 = canonicalCompanyIdentityKey('acme corp ltd');
assertEqual(companyKey1, companyKey2, 'Company key should normalize case without dropping legal suffixes');
assert(companyKey1 !== canonicalCompanyIdentityKey('Acme Corp'),
  'Distinct legal names must not collapse by dropping the Ltd suffix');

const countryKey1 = canonicalCountryIdentityKey('United States of America');
const countryKey2 = canonicalCountryIdentityKey('USA');
assertEqual(countryKey1, countryKey2, 'Country key should normalize');

console.log('PASS canonical identity keys');

// Test fallbackIdentityQueries
console.log('Testing fallbackIdentityQueries...');

const fallbackQueries = fallbackIdentityQueries('Acme Corp', 'USA', 4);
assert(fallbackQueries.length === 4, 'Should return 4 queries');
assert(fallbackQueries[0].includes('Acme Corp') && fallbackQueries[0].includes('USA'), 'Query 0 should contain company and country');
assert(fallbackQueries[1].includes('official website'), 'Query 1 should contain official website');
assert(fallbackQueries[2].includes('contact management leadership'), 'Query 2 should contain contact management leadership');
assert(fallbackQueries[3].includes('LinkedIn company'), 'Query 3 should contain LinkedIn company');

console.log('PASS fallbackIdentityQueries');

// Test parseQueries with valid JSON array
console.log('Testing parseQueries...');

const aiResponseWithJson = `Here are the queries:
["Acme Corp USA official website", "Acme Corp USA contact", "Acme Corp USA leadership"]
Some additional text.`;

const parsed1 = parseQueries(aiResponseWithJson, 'Acme Corp', 'USA', 4);
assert(parsed1.length >= 2, 'Should parse at least 2 queries');
assert(parsed1.every(q => q.includes('Acme Corp') && q.includes('USA')), 'All queries should contain company and country');

// Test parseQueries with quoted candidates
const aiResponseWithQuotes = `Query 1: "Acme Corp USA headquarters"
Query 2: "Acme Corp USA contact email"
Query 3: "Acme Corp USA CEO"`;

const parsed2 = parseQueries(aiResponseWithQuotes, 'Acme Corp', 'USA', 4);
assert(parsed2.length >= 2, 'Should parse at least 2 quoted queries');
assert(parsed2.every(q => q.includes('Acme Corp') && q.includes('USA')), 'All queries should contain company and country');

// Test parseQueries throws on insufficient anchored queries
try {
  parseQueries('No valid queries here', 'Acme Corp', 'USA', 4);
  assert(false, 'Should throw on insufficient anchored queries');
} catch (e) {
  assert(e instanceof Error && e.message.includes('at least two'), 'Should throw with correct message');
}

console.log('PASS parseQueries');

// Test classifyRunStatus
console.log('Testing classifyRunStatus...');

assertEqual(classifyRunStatus(5, false, 3), 'COMPLETED', 'Results with no failures = COMPLETED');
assertEqual(classifyRunStatus(5, true, 3), 'PARTIAL', 'Results with failures = PARTIAL');
assertEqual(classifyRunStatus(0, false, 3), 'COMPLETED', 'No results but successful searches = COMPLETED (NOT_FOUND)');
assertEqual(classifyRunStatus(0, true, 0), 'FAILED', 'No results, no successful searches, has failures = FAILED');
assertEqual(classifyRunStatus(0, false, 0), 'FAILED', 'No results, no searches = FAILED');

console.log('PASS classifyRunStatus');

// Test assessV1FreshReuse
console.log('Testing assessV1FreshReuse...');

const settings = getAppSettings();
const context = createV1ResearchContext('interactive', settings);

const mockRun = {
  company_name: 'Acme Corp',
  country: 'USA',
  status: 'COMPLETED' as const,
  started_at: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
  completed_at: new Date(Date.now() - 43200000).toISOString(), // 12 hours ago
  research_context: context,
};

const target = { company_name: 'Acme Corp', country: 'USA' };

// Test eligible reuse
const result1 = assessV1FreshReuse(mockRun, target, context);
assert(result1.eligible === true, 'Recent completed run should be eligible');
assertEqual(result1.code, 'REUSE_RECENT_COMPATIBLE', 'Should have correct code');

// Test identity mismatch
const targetWrongCompany = { company_name: 'Different Corp', country: 'USA' };
const result2 = assessV1FreshReuse(mockRun, targetWrongCompany, context);
assert(result2.eligible === false, 'Wrong company should not be eligible');
assertEqual(result2.code, 'REUSE_IDENTITY_MISMATCH', 'Should have identity mismatch code');

// Test wrong country
const targetWrongCountry = { company_name: 'Acme Corp', country: 'Canada' };
const result3 = assessV1FreshReuse(mockRun, targetWrongCountry, context);
assert(result3.eligible === false, 'Wrong country should not be eligible');
assertEqual(result3.code, 'REUSE_IDENTITY_MISMATCH', 'Should have identity mismatch code');

// Test incomplete run
const mockRunPartial = { ...mockRun, status: 'PARTIAL' as const };
const result4 = assessV1FreshReuse(mockRunPartial, target, context);
assert(result4.eligible === false, 'Partial run should not be eligible');
assertEqual(result4.code, 'REUSE_INCOMPLETE_RESULT', 'Should have incomplete result code');

// Test expired run with a valid start/completion chronology
const mockRunOld = {
  ...mockRun,
  started_at: new Date(Date.now() - 401 * 86400000).toISOString(), // 401 days ago
  completed_at: new Date(Date.now() - 400 * 86400000).toISOString(), // 400 days ago (beyond V1_REUSE_MAX_AGE_DAYS)
};
const result5 = assessV1FreshReuse(mockRunOld, target, context);
assert(result5.eligible === false, 'Expired run should not be eligible');
assertEqual(result5.code, 'REUSE_EXPIRED', 'Should have expired code');

// Invalid chronology and future captures remain unverified, not merely expired
const reversedTime = assessV1FreshReuse({ ...mockRunOld, started_at: mockRun.started_at }, target, context);
assertEqual(reversedTime.code, 'REUSE_TIME_UNVERIFIED', 'Completion before start must remain chronologically unverified');
const futureTime = assessV1FreshReuse({ ...mockRun, completed_at: new Date(Date.now() + 1000).toISOString() }, target, context);
assertEqual(futureTime.code, 'REUSE_TIME_UNVERIFIED', 'Future completion must remain chronologically unverified');

// Test context mismatch
const differentContext = createV1ResearchContext('bulk', settings);
const result6 = assessV1FreshReuse(mockRun, target, differentContext);
assert(result6.eligible === false, 'Different context should not be eligible');
assertEqual(result6.code, 'REUSE_CONTEXT_UNVERIFIED', 'Should have context unverified code');

console.log('PASS assessV1FreshReuse');

console.log('\nAll v1_engine pure function tests passed!');