import { rankSearchResults, assessEvidenceForCountry } from '../research_director';
import { ResearchTaskPlanner } from '../research_fabric';
import { saveEnrichedData, getCachedCompany } from '../enrichment';
import { getDb } from '../sqlite';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Country-Specific Importer Targeting Test Failed: ${msg}`);
  }
}

async function runCountryTargetingTests() {
  console.log('--- RUNNING COUNTRY-SPECIFIC IMPORTER BRANCH TARGETING TESTS ---');

  // Test 1: Planner targets the importer operation in the given country
  console.log('\n[Test 1] Query planner targets the country-specific branch...');
  const kenyaTasks = ResearchTaskPlanner.plan('Getz Pharma', { country: 'Kenya', role: 'Importer' }, undefined, undefined);
  assert(kenyaTasks.length >= 3, `Kenya plan must include website/social/leadership tasks (got ${kenyaTasks.length})`);
  assert(kenyaTasks.every((t) => /kenya/i.test(t.query)), `All Kenya tasks must mention Kenya in the query (got ${kenyaTasks.map((t) => t.query).join(' | ')})`);
  assert(kenyaTasks.every((t) => !/pakistan|tanzania/i.test(t.query)), 'Kenya tasks must not mention other countries');

  const tanzaniaTasks = ResearchTaskPlanner.plan('Getz Pharma', { country: 'Tanzania', role: 'Importer' }, undefined, undefined);
  assert(tanzaniaTasks.every((t) => /tanzania/i.test(t.query)), 'Tanzania tasks must mention Tanzania in the query');
  assert(tanzaniaTasks.every((t) => !/kenya/i.test(t.query)), 'Tanzania tasks must not mention Kenya');

  const globalTasks = ResearchTaskPlanner.plan('Getz Pharma', { role: 'Importer' }, undefined, undefined);
  assert(globalTasks.every((t) => !/kenya|tanzania|pakistan/i.test(t.query)), 'Global (no-country) tasks must stay unqualified');
  console.log('   ✅ Planner queries are country-scoped without touching no-country behavior.');

  // Test 2: Search ranking prefers the target-country branch
  console.log('\n[Test 2] Search ranking prefers Kenya branch when targeting Kenya...');
  const mockResults = [
    { title: 'Getz Pharma Kenya branch office', link: 'https://getzpharma.co.ke', snippet: 'Getz Pharma Kenya Nairobi contact email' },
    { title: 'Getz Pharma Pakistan contact', link: 'https://getzpharma.pk/contact', snippet: 'Getz Pharma Pakistan Karachi phone email' },
    { title: 'Getz Pharma official site', link: 'https://getzpharma.com', snippet: 'Global headquarters email' },
  ];
  const noCountryRanked = rankSearchResults(mockResults, 'Getz Pharma', 'official_website', undefined);
  assert(noCountryRanked[0].link === 'https://getzpharma.pk/contact', 'Without a country, Pakistan page ranks #1 (baseline, no country bonus)');

  const kenyaRanked = rankSearchResults(mockResults, 'Getz Pharma', 'official_website', undefined, 'Kenya');
  console.log('   Kenya-target ranking:');
  kenyaRanked.forEach((r, i) => console.log(`     #${i + 1}: ${r.link} (Score: ${r.score}) - ${r.reason}`));
  assert(kenyaRanked[0].link === 'https://getzpharma.co.ke', 'Kenya branch must rank #1 when targeting Kenya');
  assert(kenyaRanked[0].score > kenyaRanked[1].score, 'Kenya branch must outscore the 2nd candidate');
  assert(kenyaRanked.some((r) => r.reason.includes('target country branch')), 'Kenya boost reason must be recorded');
  console.log('   ✅ Country-aware ranking verified.');

  // Test 3: Pakistan evidence is NOT promoted for a Kenya target
  console.log('\n[Test 3] Foreign-country evidence is rejected for a Kenya target...');
  const pakistanContent = 'Getz Pharma Pakistan, Plot 27 Korangi Industrial Area, Karachi. Email info@getzpharma.com.pk, phone +92 21 111 111 500.';
  const kenyaAssessment = assessEvidenceForCountry(pakistanContent, 'https://getzpharma.pk/contact', 'Getz Pharma', 'Kenya');
  assert(kenyaAssessment.admissible === false, 'Pakistan evidence must be inadmissible for a Kenya target');
  assert(kenyaAssessment.foreignCountryMentions.includes('pakistan'), 'Pakistan must be detected as the foreign country');
  assert(kenyaAssessment.targetCountryMatch === false, 'Kenya must not be detected in Pakistan evidence');

  const pakistanAssessment = assessEvidenceForCountry(pakistanContent, 'https://getzpharma.pk/contact', 'Getz Pharma', 'Pakistan');
  assert(pakistanAssessment.admissible === true, 'Pakistan evidence is admissible for a Pakistan target');
  assert(pakistanAssessment.targetCountryMatch === true, 'Pakistan target match detected');

  const kenyaContent = 'Getz Pharma Kenya, Old Mombasa Road, Nairobi. Email info@getzpharma.co.ke, phone +254 20 555 000.';
  const ke = assessEvidenceForCountry(kenyaContent, 'https://getzpharma.co.ke/contact', 'Getz Pharma', 'Kenya');
  assert(ke.admissible === true, 'Kenya evidence admissible for a Kenya target');
  assert(ke.targetCountryMatch === true, 'Kenya target match detected');
  console.log('   ✅ Foreign-country evidence cannot be promoted for a different country target.');

  // Test 4: (company, country) cache separation for multi-country importers
  console.log('\n[Test 4] Kenya and Tanzania contexts keep separate cache entries...');
  const name = `GetzPharma_${Date.now()}`;
  await saveEnrichedData({
    company_name: name,
    country: 'Kenya',
    website: 'https://getzpharma.co.ke',
    email: 'ke@getzpharma.co.ke',
    quality_status: 'COMPLETE',
    isPartial: false,
    sources: [{ url: 'https://getzpharma.co.ke/contact', title: 'Getz Kenya Contact', source_type: 'official_website' }],
  });
  const kenyaCached = await getCachedCompany(name, 'Kenya');
  assert(kenyaCached !== null && kenyaCached.email === 'ke@getzpharma.co.ke', 'Kenya context retrieves the Kenya record');
  assert(kenyaCached!.company_name === name, 'Retrieved record keeps the clean company name (no cache-key leakage)');

  const tanzaniaCached = await getCachedCompany(name, 'Tanzania');
  assert(tanzaniaCached === null, 'Kenya record must NOT serve a Tanzania context');

  const plainCached = await getCachedCompany(name);
  assert(plainCached === null, 'Country-specific record must not surface as a plain/global record');

  await saveEnrichedData({
    company_name: name,
    country: 'Tanzania',
    website: 'https://getzpharma.co.tz',
    email: 'tz@getzpharma.co.tz',
    quality_status: 'COMPLETE',
    isPartial: false,
    sources: [{ url: 'https://getzpharma.co.tz/contact', title: 'Getz Tanzania Contact', source_type: 'official_website' }],
  });

  const tanzaniaCached2 = await getCachedCompany(name, 'Tanzania');
  assert(tanzaniaCached2 !== null && tanzaniaCached2.email === 'tz@getzpharma.co.tz', 'Tanzania context has its own record');

  const kenyaCached2 = await getCachedCompany(name, 'Kenya');
  assert(kenyaCached2 !== null && kenyaCached2.email === 'ke@getzpharma.co.ke', 'Kenya record remains separate after Tanzania save');

  const db = await getDb();
  await db.run('DELETE FROM contact_cache WHERE company_name LIKE ?', [`${name}%`]);
  console.log('   ✅ (company, country) cache separation verified.');

  // Test 5: Global page without country info is supporting-only, not primary
  console.log('\n[Test 5] Global page without country info stays supporting-only...');
  const globalContent = 'Getz Pharma is a pharmaceutical company with operations worldwide. For general enquiries contact info@getzpharma.com.';
  const globalAssessment = assessEvidenceForCountry(globalContent, 'https://getzpharma.com', 'Getz Pharma', 'Kenya');
  assert(globalAssessment.admissible === true, 'Global page remains admissible as supporting evidence');
  assert(globalAssessment.targetCountryMatch === false, 'Global page carries no target-country signal -> not primary');
  assert(globalAssessment.foreignCountryMentions.length === 0, 'Global page mentions no foreign country');
  assert(globalAssessment.associationScore < ke.associationScore, 'Global page scores lower than a Kenya-specific page');

  const globalVsKenya = rankSearchResults(
    [
      { title: 'Getz Pharma official site', link: 'https://getzpharma.com', snippet: 'Global headquarters email' },
      { title: 'Getz Pharma Kenya branch office', link: 'https://getzpharma.co.ke', snippet: 'Getz Pharma Kenya Nairobi location' },
    ],
    'Getz Pharma',
    'official_website',
    undefined,
    'Kenya'
  );
  assert(globalVsKenya[0].link === 'https://getzpharma.co.ke', 'Kenya-specific page must rank above the global page for a Kenya target');
  console.log('   ✅ Global page treated as supporting-only (never primary) for a country target.');

  console.log('\n✅ ALL COUNTRY-SPECIFIC IMPORTER BRANCH TARGETING TESTS PASSED 100%.');
}

runCountryTargetingTests().catch((err) => {
  console.error('❌ Country-specific importer targeting test failed:', err);
  process.exit(1);
});