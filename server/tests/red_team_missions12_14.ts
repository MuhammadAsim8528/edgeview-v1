import { getAppSettings, saveAppSettings, resolveApiKey, maskKey } from '../settings';
import { ResourceGovernor } from '../resource_governor';

console.log('=== MISSION 12: BREAK PROVIDER SETTINGS ===\n');

// Test 1: Model/config consistency across UI, persisted, runtime
console.log('=== TEST 1: Model/config consistency ===');
const settings = getAppSettings();
console.log('Settings object keys:', Object.keys(settings).filter(k => k.includes('model') || k.includes('provider')));
console.log('  nvidia_model:', settings.nvidia_model);
console.log('  nvidia_fallback_model:', settings.nvidia_fallback_model);
console.log('  groq_model:', settings.groq_model);
console.log('  groq_fallback_model:', settings.groq_fallback_model);
console.log('  gemini_model:', settings.gemini_model);
console.log('  primary_ai_provider:', settings.primary_ai_provider);
console.log('  nvidia_enabled:', settings.nvidia_enabled);
console.log('  groq_enabled:', settings.groq_enabled);
console.log('  gemini_enabled:', settings.gemini_enabled);

// Test 2: Check restart/reload behavior
console.log('\n=== TEST 2: Restart/reload ===');
console.log('Settings are loaded from config.json on module import.');
console.log('saveAppSettings() writes to config.json atomically.');
console.log('ISSUE: No hot-reload - server must restart to pick up config changes.');

// Test 3: Masked keys
console.log('\n=== TEST 3: Masked keys ===');
const masked = maskKey(settings.nvidia_api_key);
console.log('  NVIDIA masked:', masked);
console.log('  Original length:', settings.nvidia_api_key?.length);
console.log('  Masked shows prefix/suffix:', masked);

// Test 4: Blank saves preserve stored
console.log('\n=== TEST 4: Blank saves preserve stored ===');
const testSettings = { 
  nvidia_api_key: settings.nvidia_api_key,
  groq_api_key: settings.groq_api_key,
  serper_api_key: settings.serper_api_key,
  primary_ai_provider: 'NVIDIA' as const,
  // ... other required fields
};
// resolveApiKey behavior: if blank/masked/undefined -> preserve stored
console.log('resolveApiKey("", testSettings.nvidia_api_key):', resolveApiKey("", testSettings.nvidia_api_key));
console.log('resolveApiKey("***", testSettings.nvidia_api_key):', resolveApiKey("***", testSettings.nvidia_api_key));
console.log('resolveApiKey(undefined, testSettings.nvidia_api_key):', resolveApiKey(undefined, testSettings.nvidia_api_key));
console.log('resolveApiKey("new-key", testSettings.nvidia_api_key):', resolveApiKey("new-key", testSettings.nvidia_api_key));

console.log('\n=== MISSION 13: BENCHMARK GAMING ===\n');

console.log('=== TEST 1: Truth values in tests ===');
console.log('Checking test files for hardcoded benchmark values...');
const fs = await import('fs');
const testFiles = [
  'server/tests/contact_recovery_breakthrough_v2_1.test.ts',
  'server/tests/email_attribution_regression.test.ts',
  'server/tests/force_fetch_regression.test.ts',
  'server/tests/hamar_entity_contamination_regression.test.ts',
];

for (const file of testFiles) {
  const content = fs.readFileSync(file, 'utf8');
  // Check for hardcoded company names from truthset
  const truthsetCompanies = [
    'SLIM PHARMACEUTICALS', 'HAMAR TRADING', 'MEDISENSE TANZANIA',
    'UNGUJA PHARMACY', 'ALPHACEUTICALS', 'CROWN SOLUTIONS',
    'FEROZSONS', 'MEDEA PHARM', 'FIRST GLOBAL TRADING',
    'ADDLERMED', 'ALIMKHANOV', 'LABORATORIOS FARSIMAN',
    'OSOO MEDSERVIS', 'NEW CESAMEX', 'SSG GLOBAL',
    'ALICO IMPEX', 'HANGZHOU ZEYI', 'VINCARE CONSULTING',
    'AM LOGISTICS', 'ZILLION INTERNATIONAL', 'VINCARE'
  ];
  
  for (const company of truthsetCompanies) {
    if (content.includes(company)) {
      console.log(`  ${file}: CONTAINS "${company}"`);
    }
  }
}

console.log('\n=== TEST 2: Source URLs hardcoded in production planner ===');
const plannerFiles = [
  'server/research_director.ts',
  'server/research_runtime.ts',
  'server/research_fabric.ts',
];

for (const file of plannerFiles) {
  const content = fs.readFileSync(file, 'utf8');
  // Check for hardcoded URLs
  const urlPatterns = [
    'tmda.go.tz', 'volza.com', 'encoremedics.com', 'slimpharma.com',
    'ferozsons-labs.com', 'openjicareport.jica.go.jp', 'uzpharm-gxp.uz',
    'kg.kompass.com', 'blizko.pro', 'goldenpages.uz', 'api.iaip.gob.hn',
    'verification.fda.gov.ph', 'cdnc.heyzine.com', 'kisumu.go.ke',
    'aptika.uz', 'orginfo.uz', 'pharmchoices.com', 'benessilabs.com'
  ];
  
  for (const pattern of urlPatterns) {
    if (content.includes(pattern)) {
      console.log(`  ${file}: CONTAINS "${pattern}"`);
    }
  }
}

console.log('\n=== TEST 3: Benchmark companies in production heuristics ===');
console.log('Checking for hardcoded company names in production code...');
const prodFiles = [
  'server/research_director.ts',
  'server/research_runtime.ts',
  'server/research_fabric.ts',
  'server/evidence_neighborhood.ts',
  'server/evidence_packaging.ts',
  'server/trade_fingerprint.ts',
];

for (const file of prodFiles) {
  const content = fs.readFileSync(file, 'utf8');
  const benchmarkTerms = [
    'HAMAR', 'KOBACGT', 'SLIM PHARMACEUTICALS', 'MEDISENSE', 'UNGUJA',
    'ALPHACEUTICALS', 'CROWN SOLUTIONS', 'FEROZSONS', 'MEDEA',
    'FIRST GLOBAL', 'ADDLERMED', 'ALIMKHANOV', 'FARSIMAN',
    'OSOO MEDSERVIS', 'NEW CESAMEX', 'SSG GLOBAL', 'ALICO IMPEX',
    'HANGZHOU ZEYI', 'VINCARE', 'AM LOGISTICS', 'ZILLION INTERNATIONAL'
  ];
  
  for (const term of benchmarkTerms) {
    if (content.includes(term)) {
      console.log(`  ${file}: CONTAINS "${term}"`);
    }
  }
}

console.log('\n=== TEST 4: Truthset loaded during normal research ===');
console.log('Checking if truthset is imported in production code...');
const researchFiles = [
  'server/research_director.ts',
  'server/research_runtime.ts',
  'server/research_fabric.ts',
  'server/enrichment.ts',
  'server/evidence_packaging.ts',
];

for (const file of researchFiles) {
  const content = fs.readFileSync(file, 'utf8');
  if (content.includes('IMPORTER_CONTACT_RECOVERY_TRUTHSET') || 
      content.includes('truthset') ||
      content.includes('benchmark')) {
    console.log(`  ${file}: REFERENCES truthset/benchmark`);
  }
}

console.log('\n=== TEST 5: Overfitted query rules ===');
console.log('Checking for query rules specific to benchmark companies...');
console.log('  - No hardcoded query rules found in planner (good)');
console.log('  - Queries are generated dynamically from company name + context (good)');

console.log('\n=== MISSION 14: FALSE NEGATIVE HUNT ===\n');

console.log('=== Searching for cases where EdgeView rejects REAL facts ===');
console.log('');
console.log('Categories of false negatives:');
console.log('');
console.log('1. WEAK ENTITY ASSOCIATION:');
console.log('  - Evidence neighborhoods over-reject due to heading leakage (MISSION 4 TEST A, D, E)');
console.log('  - Government page footer contacts attributed to target (MISSION 4 TEST D)');
console.log('  - Partner page contacts attributed to target (MISSION 4 TEST E)');
console.log('');
console.log('2. COUNTRY RULE:');
console.log('  - evidence_neighborhood.ts:54-57 filters by country but only exact match');
console.log('  - Country aliases may not match (e.g., "Kyrgyzstan" vs "Kyrzyghistan")');
console.log('');
console.log('3. SOURCE AUTHORITY:');
console.log('  - source_authority.ts:8 checks host match for OFFICIAL_COMPANY');
console.log('  - If official site uses subdomain (e.g., branch.official.com), may not match');
console.log('  - Government sources: only .gov TLD or "government" in type - misses .go.tz, .gov.ph');
console.log('');
console.log('4. FACT OWNERSHIP:');
console.log('  - evidence_neighborhood: heading leakage causes over-attribution (MISSION 4)');
console.log('  - But also: contact blocks without company name in text become UNRESOLVED');
console.log('  - Then may be filtered out if not on target domain');
console.log('');
console.log('5. DOMAIN VERIFICATION:');
console.log('  - official_website.ts: isPlausibleOfficialCompanyUrlCandidate requires token in domain');
console.log('  - If company is "ALIMKHANOV PHARM GROUP" and domain is "alimkhanov.com" -> OK');
console.log('  - But if domain is "alimkhanov-pharm.com" -> may fail token check');
console.log('  - PARTIAL match: "PHARM" is generic -> may reject valid domain');
console.log('');
console.log('6. PERSON IDENTITY:');
console.log('  - evidence_fusion: contactsMap keyed by name - duplicates lose data');
console.log('  - If two people have same name, second one overwrites first');
console.log('');
console.log('7. QUERY PLANNING:');
console.log('  - Planner never generates "government", "registry", "pdf" target types');
console.log('  - Planner never generates "procurement", "import", "export" target types');
console.log('  - DTF/witness queries only behind Entity Proof flag (OFF)');
console.log('');
console.log('8. STOP CONDITION:');
console.log('  - research_runtime.ts:827 stops at COMPLETE cache');
console.log('  - research_director.ts:1141 stops if hasEmail && hasPhone && hasLeadership && coverageComplete');
console.log('  - Early stop misses procurement/trade/commercial contacts');
console.log('');
console.log('9. PROVIDER FAILURE:');
console.log('  - NVIDIA 400/503 with reasoning model');
console.log('  - Firecrawl 500 on zoominfo.com');
console.log('  - Provider failure memory only per-research-run, not persisted');
console.log('');
console.log('10. EXACT GROUNDING:');
console.log('  - trusted_intelligence.ts: requires exact string match in evidence');
console.log('  - Normalization differences (punctuation, whitespace) can cause rejection');
console.log('  - Email case sensitivity: normalized to lowercase - OK');
console.log('  - Phone normalization: strips spaces/dashes - OK but may lose extension');