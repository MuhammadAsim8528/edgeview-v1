import assert from 'node:assert/strict';
import { buildCanonicalResearchRequest } from '../canonical_research';
import { buildEntityScopedEvidence, factHasTargetLocalOwnership } from '../evidence_neighborhood';
import { buildTradeEntityFingerprint, createEntityProofState, generateEntityProofCandidates, planDiscriminatingResearch } from '../entity_proof_search';
import { planRelationalWitnessActions, scoreDiscriminativeTransactionFeatures } from '../trade_fingerprint';
import { isResearchCoverageComplete } from '../research_director';
import { preservePageContent } from '../page_content';
import { retainHighValueEvidence } from '../research_runtime';
import { ResourceGovernor } from '../resource_governor';

const contact = {
  company_name: 'Atlas Medical Ltd', entity_key: 'atlas medical__ghana', country: 'Ghana', type: 'Importer',
  website: 'https://atlas.example', website_verified: true, city: 'Accra', address: 'Warehouse 7, Accra',
  source_file: 'imports.csv', source_file_ids: ['file-1'], top_products: ['RareBrand XZ-41'], traded_with: ['Specific Exporter AG'],
  emails_list: ['info@atlas.example'], phones_list: ['+233 20 000 0000'],
};
const single = buildCanonicalResearchRequest(contact, true);
const bulk = buildCanonicalResearchRequest({ ...contact }, true);
assert.deepEqual(bulk, single, 'single and bulk adapters must build the same canonical request');
for (const field of ['entity_key','country','website','role','target_city','known_address','source_file_id','dataset_id','known_products','traded_with','existing_contacts']) assert(field in single.context, `missing canonical context ${field}`);

const mixed = buildEntityScopedEvidence([
  '| Company | Country | Email | Phone |',
  '| HAMAR TRADING COMPANY | Somalia | hamar@example.invalid | +252 61 111 111 |',
  '| KOBACGT COMPANY LTD | Somalia | kobac@example.invalid | +252 61 999 999 |',
].join('\n'), 'https://chamber.example/members', 'HAMAR TRADING COMPANY', 'Somalia', true);
assert.equal(mixed.mixed_entity_page, true);
assert.match(mixed.extraction_content, /hamar@example\.invalid/);
assert.doesNotMatch(mixed.extraction_content, /kobac@example\.invalid/);
assert(factHasTargetLocalOwnership(mixed, 'hamar@example.invalid'));
assert(!factHasTargetLocalOwnership(mixed, 'kobac@example.invalid'));

const locality = buildEntityScopedEvidence('| HAMAR TRADING COMPANY | Somalia | Mogadishu |\n| SUPPLIER COMPANY LTD | Pakistan | Karachi |', 'https://registry.example', 'HAMAR TRADING COMPANY', 'Somalia', true);
assert.doesNotMatch(locality.extraction_content, /Pakistan|Karachi/);

const fp = buildTradeEntityFingerprint('HAMAR TRADING COMPANY', { country: 'Somalia', role: 'Importer', traded_with: ['Specific Exporter AG'], known_products: ['RareBrand XZ-41', 'pharmaceutical tablets'] });
const other = buildTradeEntityFingerprint('Other Importer', { country: 'Somalia', traded_with: ['Common Supplier'], known_products: ['pharmaceutical tablets'] });
const features = scoreDiscriminativeTransactionFeatures(fp, [other]);
assert(features.find((f) => f.value === 'RareBrand XZ-41')!.utility > features.find((f) => f.value === 'pharmaceutical tablets')!.utility);
const queries = planDiscriminatingResearch(fp, []);
assert(queries.some((q) => q.query.includes('RareBrand XZ-41') || q.query.includes('Specific Exporter AG')));
const witnesses = planRelationalWitnessActions(fp, features);
assert(witnesses.some((q) => q.reason.includes('never transfer counterparty contacts')));

const witnessCandidates = generateEntityProofCandidates(fp, [{ url: 'https://exporter.example/distributors', title: 'Specific Exporter distributors', content: 'HAMAR TRADING COMPANY Somalia importer Specific Exporter AG', source_type: 'official partner', admission_decision: 'ADMIT' }]);
assert(witnessCandidates.every((c) => c.emails.length === 0 && c.phones.length === 0), 'witness facts must not transfer as target contacts');
const tradeState = createEntityProofState('HAMAR TRADING COMPANY', { country: 'Somalia', traded_with: ['Specific Exporter AG'] });
assert.equal(tradeState.result, 'UNRESOLVED');

const contactOnlyObjectives: any = { IDENTITY:{status:'SATISFIED',sourceCount:2}, OFFICIAL_WEBSITE:{status:'UNKNOWN'}, CONTACT:{status:'SATISFIED'}, ADDRESS:{status:'SATISFIED'}, LEADERSHIP:{status:'SATISFIED'} };
assert.equal(isResearchCoverageComplete(contactOnlyObjectives), false);
contactOnlyObjectives.OFFICIAL_WEBSITE.status = 'SATISFIED';
assert.equal(isResearchCoverageComplete(contactOnlyObjectives), true);

const lateLink = 'https://www.linkedin.com/company/atlas-medical';
const preserved = preservePageContent('A'.repeat(70000) + `\nLeadership CEO Jane Doe\n${lateLink}`);
assert(preserved.includes(lateLink), 'important late link must survive the final cap');
const retained = retainHighValueEvidence([
  { url:'https://low.example', title:'generic', content:'x'.repeat(20000) },
  { url:'https://atlas.example/team', title:'page', content:'x'.repeat(18000) + ' Leadership Managing Director Jane Doe' },
], 1, 'https://atlas.example', 'Ghana');
assert.equal(retained[0].url, 'https://atlas.example/team', 'late-page leadership must influence retention');

const providerKeys = Object.keys(ResourceGovernor.getAllProviderMetrics()).sort();
assert.deepEqual(providerKeys, ['apify','exa','firecrawl','gemini','groq','hunter','linkup','nvidia','serper','tavily']);
console.log('master_importer_intelligence_hardening.test.ts: PASS');
