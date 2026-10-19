import { saveEnrichedData, isValidEmail, isValidPhone, isValidUrl } from '../enrichment';
import { isSafeExternalUrl } from '../research_director';
import { getDb } from '../sqlite';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Provider Failure Test Failed: ${msg}`);
  }
}

async function runProviderFailureStressTests() {
  console.log('--- RUNNING PROVIDER FAILURE & CORRUPTION RESILIENCE SUITE ---');

  // 1. SSRF Boundary Tests
  console.log('[Test 1] SSRF Security Boundary Enforcement...');
  assert(isSafeExternalUrl('http://169.254.169.254/latest/meta-data/') === false, 'Cloud metadata IP blocked');
  assert(isSafeExternalUrl('http://127.0.0.1:3000/api/files') === false, 'Loopback IPv4 blocked');
  assert(isSafeExternalUrl('http://[fe80::1]/') === false, 'Bracketed IPv6 link-local blocked');
  assert(isSafeExternalUrl('javascript:alert(1)') === false, 'Non-HTTP protocol blocked');
  assert(isSafeExternalUrl('https://emerchemie.lk/contact') === true, 'Public HTTPS domain allowed');

  // 2. Malformed AI Output Rejection & Validation
  console.log('[Test 2] Malformed AI JSON Output Rejection...');
  const testCompany = `ResilienceTest_${Date.now()}`;
  
  // Feed malformed emails and invalid phone numbers into saveEnrichedData
  const savedData = await saveEnrichedData({
    company_name: testCompany,
    website: 'https://resiliencetest.org',
    email: 'invalid-email-no-domain',
    phone: '123', // invalid short digits
    emails_list: ['invalid-email-no-domain', 'valid@resiliencetest.org'],
    phones_list: ['123', '+1 617 555 0199', '+1 617 555 0199'], // includes duplicate
    evidence: [
      {
        field: 'email',
        value: 'valid@resiliencetest.org',
        source_url: 'https://resiliencetest.org/contact',
        source_type: 'official_page',
        confidence: 90,
        evidence_text: 'Verified contact email on site'
      },
      {
        field: 'email',
        value: 'fake@google.com',
        source_url: 'https://google.com', // fake fallback URL - MUST BE REJECTED
        source_type: 'fake',
        confidence: 10,
        evidence_text: 'Fake google search URL'
      }
    ]
  });

  assert(savedData.email === 'valid@resiliencetest.org', 'Valid email retained, invalid email string rejected');
  assert(savedData.phone === '+1 617 555 0199', 'Valid phone retained, short digits rejected');
  assert(savedData.emails_list?.length === 1, 'Invalid email stripped from list');
  assert(savedData.phones_list?.length === 1, 'Duplicate phone number deduplicated');
  assert(savedData.evidence?.some((e) => e.source_url === 'https://google.com') === false, 'Fake google.com evidence URL rejected');
  assert(savedData.evidence?.some((e) => e.source_url === 'https://resiliencetest.org/contact') === true, 'Authentic site evidence URL retained');

  // 3. Database Persistence Integrity
  console.log('[Test 3] SQLite Persistence Verification...');
  const db = await getDb();
  // Cache rows use canonical lowercase identities; persistence verification
  // must not assume that the display casing is also the storage key.
  const dbRecord = await db.get('SELECT * FROM contact_cache WHERE LOWER(company_name) = LOWER(?)', [testCompany]);
  assert(dbRecord !== undefined, 'Enriched record persisted into SQLite database table');
  
  const parsedDetails = JSON.parse(dbRecord.details_json);
  assert(parsedDetails.email === 'valid@resiliencetest.org', 'Persisted DB record matches enriched data');

  // Cleanup
  await db.run('DELETE FROM contact_cache WHERE LOWER(company_name) = LOWER(?)', [testCompany]);
  console.log('✅ ALL PROVIDER FAILURE & CORRUPTION RESILIENCE TESTS PASSED SUCCESSFULLY.');
}

runProviderFailureStressTests().catch((err) => {
  console.error('❌ Provider failure tests failed:', err);
  process.exit(1);
});
