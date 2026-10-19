import assert from 'node:assert/strict';
import {
  buildTradeEntityFingerprint,
  canRunEntityProofAction,
  createEntityProofState,
  generateEntityProofCandidates,
  planDiscriminatingResearch,
  shouldUseEntityProofSearch,
  updateEntityProofState,
  type EntityProofEvidenceInput,
} from '../entity_proof_search';
import { getCachedCompany, saveEnrichedData } from '../enrichment';

const context = {
  country: 'Somalia',
  role: 'Importer' as const,
  target_city: 'Mogadishu',
  known_address: 'Hamar Weyne District, Mogadishu',
  known_products: ['pharmaceutical preparations', 'medical supplies'],
  traded_with: ['Exporter Netherlands A'],
  source_file_id: 'test-source-only',
  dataset_id: 'test-dataset-only',
};

const fingerprint = buildTradeEntityFingerprint('HAMAR TRADING COMPANY', context);
assert.equal(fingerprint.entity_key, 'hamar trading company__somalia');
assert.equal(fingerprint.normalized_country, 'somalia');
assert.deepEqual(fingerprint.trade_partners, ['Exporter Netherlands A']);

// Default-off and solved-entity controls.
assert.equal(shouldUseEntityProofSearch(context, {}), false);
assert.equal(shouldUseEntityProofSearch(context, { EDGEVIEW_ENTITY_PROOF_SEARCH_V1: 'true' }), true);
assert.equal(shouldUseEntityProofSearch({ ...context, website_verified: true }, { EDGEVIEW_ENTITY_PROOF_SEARCH_V1: 'true' }), false);
assert.equal(shouldUseEntityProofSearch({ country: 'Sri Lanka', website: 'https://slimpharma.com', website_verified: true }, { EDGEVIEW_ENTITY_PROOF_SEARCH_V1: 'true' }), false, 'resolved Slim Pharma control skips proof search');

const evidence: EntityProofEvidenceInput[] = [
  {
    url: 'https://registry.example.invalid/hamar-trading',
    title: 'Hamar Trading Company — Somalia registry entry',
    content: 'HAMAR TRADING COMPANY, Hamar Weyne District, Mogadishu, Somalia. Import relationship: Exporter Netherlands A.',
    source_type: 'registry',
    admission_decision: 'ADMIT',
  },
  {
    url: 'https://exporter-a.example.invalid/partners/hamar',
    title: 'Exporter Netherlands A distribution partners',
    content: 'Our Somali customer HAMAR TRADING COMPANY in Mogadishu imports pharmaceutical preparations.',
    source_type: 'official_relationship',
    admission_decision: 'ADMIT',
  },
  {
    url: 'https://kobacgt.so/',
    title: 'Kobac General Trading Company',
    content: 'KobacGT is a Somali logistics and trading company. info@kobacgt.so +252 619 520 999.',
    source_type: 'candidate_official',
    admission_decision: 'REJECT',
  },
  {
    url: 'https://kobacgt.so/contact',
    title: 'KobacGT Contact',
    content: 'Contact KobacGT in Somalia. Hassan Kobac, CEO.',
    source_type: 'candidate_official',
    admission_decision: 'REJECT',
  },
];

const candidates = generateEntityProofCandidates(fingerprint, evidence);
assert.equal(candidates.length, 2, 'pages cluster into organizations, not one candidate per page');
const hamar = candidates.find((candidate) => candidate.status === 'LEGAL_ENTITY_SUPPORTED');
assert(hamar, 'cross-source exact identity plus trusted trade discriminator supports Hamar');
assert(hamar.supporting_evidence.some((edge) => edge.type === 'TRADE_PARTNER_MATCH'));
assert(hamar.supporting_evidence.some((edge) => edge.type === 'INDEPENDENT_SOURCE_CORROBORATION'));
assert(hamar.proof_paths.every((path) => path[0] === `TARGET:${fingerprint.entity_key}`));
const kobac = candidates.find((candidate) => candidate.domains.includes('kobacgt.so'));
assert.equal(kobac?.status, 'REJECTED');
assert(kobac?.contradicting_evidence.some((edge) => edge.type === 'OTHER_ENTITY_DOMINATES_PAGE'));

const actions = planDiscriminatingResearch(fingerprint, [], []);
assert(actions.length <= 3);
assert(actions[0].query.includes('HAMAR TRADING COMPANY'));
assert(actions.some((action) => action.query.includes('Exporter Netherlands A')), 'trusted trade partner drives discrimination');
assert(actions.every((action) => action.provider_id === 'serper'), 'exact lexical proof starts with Serper');
assert(actions.every((action) => Number.isFinite(action.utility) && action.utility > 0));

let state = createEntityProofState('HAMAR TRADING COMPANY', context, {
  max_candidates: 2,
  max_discrimination_rounds: 2,
  max_additional_searches: 2,
  max_additional_retrievals: 4,
});
state = updateEntityProofState(state, evidence, []);
assert.equal(state.candidates.length, 2);
assert.equal(state.result, 'LEGAL_ENTITY_SUPPORTED');
assert.equal(canRunEntityProofAction(state), false, 'deep searches stop once one entity is supported');
const persisted = await saveEnrichedData({
  company_name: 'HAMAR TRADING COMPANY',
  country: 'Somalia',
  quality_status: 'NOT_FOUND',
  entity_proof: state,
  source: 'isolated entity-proof regression',
});
assert.equal(persisted.entity_proof?.result, 'LEGAL_ENTITY_SUPPORTED');
const reloaded = await getCachedCompany('HAMAR TRADING COMPANY', 'Somalia');
assert.equal(reloaded?.entity_proof?.candidates.length, 2, 'proof graph survives cache persistence/reload');

const unresolved = createEntityProofState('Generic Trading', { country: 'Kenya' }, {
  max_discrimination_rounds: 1,
  max_additional_searches: 1,
  max_additional_retrievals: 1,
});
assert.equal(canRunEntityProofAction(unresolved), true);
unresolved.searches_used = 1;
assert.equal(canRunEntityProofAction(unresolved), false, 'search budget is a hard boundary');

// Small 12-entity R&D fixture: all state remains in memory and no production persistence is imported.
const corpus = [
  ['Alpha Trading', 'Kenya'], ['Alpha Trading', 'Pakistan'], ['Unity Pharma', 'Kenya'],
  ['Unity Pharmaceuticals', 'Kenya'], ['Global Health', 'Somalia'], ['Global Health', 'Uganda'],
  ['Medi Supply', 'Mauritius'], ['Medi Supply', 'Sri Lanka'], ['Acme Importers', 'Somalia'],
  ['Acme Importers', 'Kenya'], ['Nova Distribution', 'Netherlands'], ['Nova Distribution', 'Pakistan'],
] as const;
const keys = corpus.map(([name, country]) => buildTradeEntityFingerprint(name, { country }).entity_key);
assert.equal(new Set(keys).size, corpus.length, 'multi-country ambiguous fixture remains entity-isolated');

console.log('entity_proof_search.test.ts: PASS');
