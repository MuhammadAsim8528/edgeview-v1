import assert from 'node:assert/strict';
import {
  buildTradeEntityFingerprint,
  canRunEntityProofAction,
  classifyEntitySource,
  createEntityProofState,
  generateEntityProofCandidates,
  planContactRecoveryActions,
  planDiscriminatingResearch,
  shouldUseEntityProofSearch,
  updateEntityProofState,
  verifiedDomainForHunter,
  type EntityProofEvidenceInput,
} from '../entity_proof_search';
import { classifyBenchmarkFailure } from '../benchmark_evaluation';
import { deduplicateSearchResults } from '../orchestrator';

const fp = buildTradeEntityFingerprint('Atlas Medical Imports', {
  country: 'Ghana', role: 'Importer', traded_with: ['Verified Supplier BV'], known_products: ['medical devices'],
});
const tradeEvidence: EntityProofEvidenceInput[] = [
  { url: 'https://tendata.com/atlas', title: 'Atlas Medical Imports Ghana', content: 'Atlas Medical Imports Ghana imports medical devices from Verified Supplier BV.', source_type: 'trade database', admission_decision: 'ADMIT' },
  { url: 'https://volza.com/atlas', title: 'Atlas Medical Imports Ghana trade', content: 'Atlas Medical Imports Ghana buyer record; Verified Supplier BV.', source_type: 'trade database', admission_decision: 'ADMIT' },
];
const tradeCandidate = generateEntityProofCandidates(fp, tradeEvidence)[0];
assert.equal(tradeCandidate.status, 'TRADE_ENTITY_SUPPORTED');
assert.deepEqual(tradeCandidate.source_families, ['trade-data-derived']);
assert(!tradeCandidate.supporting_evidence.some((edge) => edge.type === 'INDEPENDENT_SOURCE_CORROBORATION'), 'two trade resellers are not family-diverse');

assert.deepEqual(classifyEntitySource({ url: 'https://registry.gov.gh/company/atlas', source_type: 'government registry' }), { authority: 'GOVERNMENT_REGISTRY', family: 'government' });
assert.deepEqual(classifyEntitySource({ url: 'https://linkedin.com/company/atlas', source_type: 'professional profile' }), { authority: 'PROFESSIONAL_BUSINESS_PROFILE', family: 'professional' });

const legalEvidence: EntityProofEvidenceInput[] = [
  { url: 'https://registry.gov.gh/atlas', title: 'Atlas Medical Imports Ghana', content: 'Atlas Medical Imports Ghana; medical devices; Verified Supplier BV.', source_type: 'government registry', admission_decision: 'ADMIT' },
  { url: 'https://supplier.example.invalid/atlas', title: 'Authorized Ghana importer', content: 'Atlas Medical Imports Ghana is our importer for medical devices.', source_type: 'official partner', admission_decision: 'ADMIT' },
];
assert.equal(generateEntityProofCandidates(fp, legalEvidence)[0].status, 'LEGAL_ENTITY_SUPPORTED');

const officialEvidence: EntityProofEvidenceInput[] = [
  { url: 'https://atlasmedical.example/contact', title: 'Atlas Medical Imports Ghana', content: 'Atlas Medical Imports Ghana contact office.', official_domain: 'https://atlasmedical.example', admission_decision: 'ADMIT' },
];
const officialState = updateEntityProofState(createEntityProofState('Atlas Medical Imports', { country: 'Ghana', traded_with: ['Verified Supplier BV'] }), officialEvidence, []);
assert.equal(officialState.result, 'OFFICIAL_WEB_IDENTITY_SUPPORTED');
assert.equal(verifiedDomainForHunter(officialState), 'atlasmedical.example');

const rejected = updateEntityProofState(createEntityProofState('Atlas Medical Imports', { country: 'Ghana' }), [
  { url: 'https://wrong.example/contact', title: 'Different Logistics Ltd', content: 'Different Logistics Ltd Ghana.', admission_decision: 'REJECT', admission_reason: 'Other entity dominates page' },
], []);
assert.equal(rejected.candidate_memory[0].decision, 'REJECT');
assert.deepEqual(rejected.rejected_domains, ['wrong.example']);

// No Somalia/Hamar special casing: shared country normalization handles unrelated countries.
const ghana = generateEntityProofCandidates(fp, tradeEvidence)[0];
assert.equal(ghana.country, 'Ghana');
const kenyaFp = buildTradeEntityFingerprint('Atlas Medical Imports', { country: 'Kenya', traded_with: ['Verified Supplier BV'] });
assert.notEqual(generateEntityProofCandidates(kenyaFp, tradeEvidence)[0].status, 'TRADE_ENTITY_SUPPORTED');

const unresolved = createEntityProofState('Atlas Medical Imports', { country: 'Ghana', traded_with: ['Verified Supplier BV'] });
const escalation = planDiscriminatingResearch(unresolved.fingerprint, [], ['query one', 'query two']);
assert(escalation.some((action) => action.provider_id === 'tavily'), 'lexical zero gain triggers one complementary provider');

const contactActions = planContactRecoveryActions(
  { ...unresolved, result: 'TRADE_ENTITY_SUPPORTED', candidates: [tradeCandidate] },
  ['address', 'email', 'phone', 'fax', 'contact_persons', 'linkedin'], [], 1,
  { serper: true, tavily: true, exa: true, linkup: true, hunter: true }
);
assert(contactActions.some((action) => action.discriminator.includes('address')));
assert(contactActions.some((action) => action.provider_id === 'exa' && action.discriminator.includes('leadership')));
assert(!contactActions.some((action) => action.provider_id === 'hunter'), 'trade identity never unlocks Hunter');
const officialActions = planContactRecoveryActions(officialState, ['email'], [], 0, { serper: true, hunter: true });
assert(officialActions.some((action) => action.provider_id === 'hunter' && action.query === 'atlasmedical.example'));

assert.equal(shouldUseEntityProofSearch({ website_verified: true }, { EDGEVIEW_ENTITY_PROOF_SEARCH_V1: '1' }), false, 'easy verified entity stops before proof escalation');
unresolved.searches_used = unresolved.budget.max_additional_searches;
assert.equal(canRunEntityProofAction(unresolved), false, 'hard-entity proof budget is finite');

const deduped = deduplicateSearchResults([
  { link: 'https://example.com/contact?utm_source=a', title: 'A', snippet: '' },
  { link: 'https://www.example.com/contact?utm_source=b', title: 'B', snippet: '' },
  { link: 'https://example.com/team', title: 'Team', snippet: '' },
]);
assert.equal(deduped.length, 2);

assert.equal(classifyBenchmarkFailure({ entity: 'wrong' }), 'ENTITY_RESOLUTION');
assert.equal(classifyBenchmarkFailure({ entity: 'ambiguous', discoveredUrls: 0, complementaryProviderAttempted: false }), 'SOURCE_DISCOVERY');
assert.equal(classifyBenchmarkFailure({ entity: 'correct', discoveredUrls: 2, retrievedPages: 2, admittedSources: 0 }), 'SOURCE_ADMISSION');
assert.equal(classifyBenchmarkFailure({ entity: 'correct', discoveredUrls: 2, retrievedPages: 2, admittedSources: 2, extractedFacts: 2, validatedFacts: 2, persistedFacts: 2, projectedFacts: 1 }), 'UI_PROJECTION');

console.log('importer_intelligence_recovery_v1.test.ts: PASS');
