import { getAppSettings } from '../settings';
import { enrichCompanyDetails } from '../enrichment';
import { normalizeCountryName, detectCountryNamesInText } from '../../src/utils/countryNormalizer';
import { canonicalCountryIdentityKey, canonicalEntityIdentityKey, canonicalContactCacheKey } from '../company_identity';

console.log('=== MISSION 5: BREAK COUNTRY OWNERSHIP ===\n');

// Test country normalization edge cases
console.log('=== TEST 1: Country normalization edge cases ===');
const countryTests = [
  'Somalia', 'Mali',
  'Nigeria', 'Niger',
  'Guinea', 'Equatorial Guinea', 'Papua New Guinea',
  'Sudan', 'South Sudan',
  'Dominica', 'Dominican Republic',
  'Oman', 'Romania',
  'Congo', 'Democratic Republic of the Congo',
  'Georgia', 'Georgia US',
  'Turkey', 'Türkiye',
  'USA', 'U.S.', 'United States',
  'UK', 'United Kingdom', 'England',
  'Côte d\'Ivoire', 'Ivory Coast',
  'Kyrgyzstan', 'Kyrzyghistan',
  'Czech Republic', 'Czechia',
  'Swaziland', 'Eswatini',
];

for (const c of countryTests) {
  const norm = normalizeCountryName(c);
  const canon = canonicalCountryIdentityKey(c);
  console.log(`  "${c}" -> normalized="${norm}" canonical="${canon}"`);
}

// Test country detection in text
console.log('\n=== TEST 2: Country detection in text ===');
const texts = [
  'Company based in Guinea with operations in Equatorial Guinea',
  'Operations in Sudan and South Sudan',
  'Office in Georgia, USA and Georgia country',
  'Shipping to USA and UK',
  'Dominica office vs Dominican Republic branch',
  'Congo operations (not DRC)',
  'Turkey and Türkiye',
];
for (const text of texts) {
  const detected = detectCountryNamesInText(text);
  console.log(`  "${text}" -> ${detected.join(', ')}`);
}

// Test country ownership in cache keys
console.log('\n=== TEST 3: Cache key country ownership ===');
const keys = [
  canonicalEntityIdentityKey('Company A', 'Kenya'),
  canonicalEntityIdentityKey('Company A', 'Nigeria'),
  canonicalEntityIdentityKey('Company A', 'Niger'),
  canonicalContactCacheKey('Company A', 'Kenya', 'Importer'),
  canonicalContactCacheKey('Company A', 'Kenya', 'Exporter'),
  canonicalContactCacheKey('Company A', 'Niger', 'Importer'),
];
keys.forEach(k => console.log(`  ${k}`));

console.log('\n=== MISSION 8: BREAK DEEP RECOVERY ===\n');

// Test: quality_status COMPLETE but missing procurement contacts
console.log('=== TEST 1: Deep Recovery stops at COMPLETE ===');
console.log('From research_runtime.ts:827:');
console.log('  if (!forceFetch && !extraContext?.deep_recovery && (missing.length === 0 || cached.quality_status === \'COMPLETE\')) {');
console.log('    return cached;  // STOPS HERE - no gap analysis');
console.log('');
console.log('Cases where Deep Recovery stops prematurely:');
console.log('  - basic contact found, procurement missing');
console.log('  - CEO found, importing manager missing');
console.log('  - address found, email missing');
console.log('  - website found, branch address missing');
console.log('  - one phone found, multiple addresses exist');
console.log('  - old cached profile predates newer public info');
console.log('');
console.log('Deep Recovery should check:');
console.log('  - research coverage');
console.log('  - address coverage (head office? branch? factory? warehouse?)');
console.log('  - email coverage (any? executive? procurement?)');
console.log('  - phone/fax coverage');
console.log('  - executive coverage (CEO, MD, Director, Country Manager)');
console.log('  - buying/procurement coverage (Procurement, Purchasing, Sourcing)');
console.log('  - trade-role coverage (Import, Export, Distribution)');
console.log('  - commercial-role coverage (Sales, Commercial, Business Development)');
console.log('  - professional profile coverage (LinkedIn, professional directories)');
console.log('  - provenance (official vs third-party sources)');
console.log('  - source diversity (registry, directory, official, government)');
console.log('  - entity support (trade partners corroborating)');
console.log('  - contradictions (unresolved)');
console.log('  - remaining information gain (zero-gain streak already tracked but not acted on)');

console.log('\n=== MISSION 9: BREAK BULK VS MANUAL PARITY ===\n');

console.log('=== TEST: Context field parity ===');
console.log('Manual Fetch: buildCanonicalResearchRequest(contact, forceFetch, companyName, peerContacts)');
console.log('SSE Batch: buildCanonicalResearchRequest(contact, forceFetch, \'\', peerContacts)');
console.log('Bulk Job: buildCanonicalResearchRequest(contact, forceFetch, companyRealName, peerContacts)');
console.log('');
console.log('Differences:');
console.log('  - Manual: fallbackName = company_name from request');
console.log('  - Batch: fallbackName = \'\' (empty string!)');
console.log('  - Bulk: fallbackName = companyRealName from contact');
console.log('');
console.log('This means batch enrichment may lose the original company name if contact.company_name is empty!');
console.log('');
console.log('Also: deep_recovery = forceFetch in all three paths - CORRECT');
console.log('But: trade_feature_recurrence populated from contact.trade_feature_recurrence - only available in bulk/manual where contact has full data');

console.log('\n=== MISSION 10: BREAK CANONICAL DATA FLOW ===\n');

console.log('=== Data flow trace ===');
console.log('research -> claims -> fusion -> persistence -> API -> Contacts -> View Intelligence -> Importer Directory -> CSV/XLSX/PDF/DOCX');
console.log('');
console.log('Attack vectors:');
console.log('  1. Second email disappears: EvidenceFusionEngine.fuse() uses Set for emails - OK');
console.log('  2. Second address disappears: addressesMap uses address string as key - DUPLICATE LOSS!');
console.log('  3. Person LinkedIn disappears: contactsMap uses name as key - could lose LinkedIn if duplicate name');
console.log('  4. Fax disappears: faxesSet uses Set - OK');
console.log('  5. 11 people become fewer: contactsMap keyed by name - if two people have same name, one wins!');
console.log('  6. Source authority downgrade: source_authority.ts only checks host match - could misclassify');
console.log('  7. Country disappear: canonicalCountryIdentityKey used throughout - OK if consistent');
console.log('  8. Branch identity collapse: canonicalContactCacheKey with role - only used in selectContactCacheRow');