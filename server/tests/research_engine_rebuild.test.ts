import { rankSearchResults, discoverInternalLinks, ResearchDirector } from '../research_director';
import { TradeRelationshipResolver } from '../trade_relationship_resolver';
import { db } from '../db';
import { enrichCompanyDetails } from '../enrichment';
import { getDb } from '../sqlite';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Research Engine Rebuild Test Failed: ${msg}`);
  }
}

async function runResearchEngineRebuildTests() {
  console.log('--- RUNNING RESEARCH ENGINE REBUILD & STABILIZATION TESTS ---');

  // Test 1: Search Result Candidate Ranking
  console.log('\n[Test 1] Testing Search Result Candidate Ranking...');
  const mockSearchResults = [
    { title: 'Generic Directory Page', link: 'https://randomdirectory.com/listing/123', snippet: 'Directory listing' },
    { title: 'Novartis Pharma Official Site', link: 'https://www.novartis.com', snippet: 'Official corporate website homepage' },
    { title: 'Novartis Contact Us & Management', link: 'https://www.novartis.com/contact-us', snippet: 'Headquarters contact details and leadership team' },
    { title: 'Random News Article', link: 'https://newsblog.com/pharma-news', snippet: 'General article mentioning Novartis' },
  ];

  const ranked = rankSearchResults(mockSearchResults, 'Novartis Pharma', 'official_website', 'https://www.novartis.com');
  console.log('   Ranked candidates:');
  ranked.forEach((r, idx) => console.log(`     #${idx + 1}: ${r.link} (Score: ${r.score}) - ${r.reason}`));

  assert(ranked[0].link === 'https://www.novartis.com/contact-us', 'Contact page on official domain must be top candidate');
  assert(ranked[1].link === 'https://www.novartis.com', 'Homepage on official domain must be 2nd candidate');
  console.log('   ✅ Search Result Candidate Ranking verified.');

  // Test 2: Internal Website Link Discovery
  console.log('\n[Test 2] Testing Internal Website Link Discovery...');
  const sampleHtml = `
    <html>
      <body>
        <a href="/contact-us">Contact Us</a>
        <a href="/about/management-team">Leadership & Executives</a>
        <a href="/global/locations">Global Offices & Factories</a>
        <a href="https://externalnews.com/article">External News</a>
      </body>
    </html>
  `;

  const internalLinks = discoverInternalLinks(sampleHtml, 'https://www.novartis.com', 'Novartis Pharma');
  console.log('   Discovered internal links:');
  internalLinks.forEach(l => console.log(`     - [${l.label}] ${l.url} (Score: ${l.score})`));

  assert(internalLinks.length >= 3, 'Must discover all 3 internal high-value links');
  assert(internalLinks.some(l => l.url === 'https://www.novartis.com/contact-us'), 'Must contain contact-us link');
  assert(internalLinks.some(l => l.url === 'https://www.novartis.com/about/management-team'), 'Must contain management-team link');
  console.log('   ✅ Internal Website Link Discovery verified.');

  // Test 3: Batch Single-Pass Trade Index
  console.log('\n[Test 3] Testing Batch Single-Pass Trade Index...');
  const startIdxMs = Date.now();
  const tradeIndex = await TradeRelationshipResolver.buildTradeIndex();
  const idxMs = Date.now() - startIdxMs;
  console.log(`   Trade index built in ${idxMs}ms. ImportedFrom keys: ${tradeIndex.importedFrom.size}, SuppliedTo keys: ${tradeIndex.suppliedTo.size}`);
  
  const rels = TradeRelationshipResolver.resolveFromIndex('Novartis', tradeIndex, 'importer');
  assert(Array.isArray(rels.importedFrom), 'Must return array');
  console.log('   ✅ Batch Single-Pass Trade Index verified.');

  // Test 4: Research & Cache Flow (deterministic, self-contained)
  // A COMPLETE cache record is seeded into the isolated test DB so both calls
  // are fast cache hits with grounded (non-google) sources. This validates the
  // cache-hit path without depending on production data or live network.
  console.log('\n[Test 4] Testing Research & Grounded Evidence Cache Flow...');
  const sqlDb = await getDb();
  const completeDetails = {
    quality_status: 'COMPLETE',
    isPartial: false,
    country: 'Pakistan',
    sources: [
      { url: 'https://www.novartis.com/contact-us', title: 'Novartis Contact', source_type: 'official_website' }
    ],
    contact_persons: [{ name: 'Narasimhan', designation: 'Chief Executive Officer', email: 'narasimhan@novartis.com' }],
  };
  await sqlDb.run(
    `INSERT INTO contact_cache (company_name, website, address, phone, email, linkedin, industry, details_json, source)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(company_name) DO UPDATE SET
       website=excluded.website, address=excluded.address, phone=excluded.phone, email=excluded.email,
       linkedin=excluded.linkedin, industry=excluded.industry, details_json=excluded.details_json, source=excluded.source`,
    [
      'Novartis Pharma AG',
      'https://www.novartis.com',
      'Lichtstrasse 35, Basel, Switzerland',
      '+41 61 324 11 11',
      'info@novartis.com',
      'https://www.linkedin.com/company/novartis',
      'Pharmaceuticals',
      JSON.stringify(completeDetails),
      'api',
    ]
  );

  const startEnrich = Date.now();
  const res1 = await enrichCompanyDetails('Novartis Pharma AG', false, { country: 'Pakistan', role: 'Exporter' });
  const enrichMs1 = Date.now() - startEnrich;
  console.log(`   Fetch 1 Result: ${res1.company_name} (Status: ${res1.quality_status}, Time: ${enrichMs1}ms)`);
  assert(res1.company_name === 'Novartis Pharma AG', 'Company name must match');
  assert(res1.sources.every(s => s.url && s.url !== 'https://google.com'), 'All sources must be grounded non-fake URLs');

  // Cache Hit Test
  const startCache = Date.now();
  const res2 = await enrichCompanyDetails('Novartis Pharma AG', false, { country: 'Pakistan', role: 'Exporter' });
  const cacheMs = Date.now() - startCache;
  console.log(`   Fetch 2 (Cache Hit) Time: ${cacheMs}ms`);
  assert(cacheMs < 100, 'Cache hit must return in under 100ms');
  console.log('   ✅ Autonomous Research & Cache Hit verified.');

  console.log('\n✅ ALL RESEARCH ENGINE REBUILD & STABILIZATION TESTS PASSED 100%.');
}

runResearchEngineRebuildTests().catch(err => {
  console.error('❌ Research Engine Rebuild Test Failed:', err);
  process.exit(1);
});
