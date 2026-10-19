import { 
  scoreDiscriminativeTransactionFeatures, 
  planJointTransactionQueries, 
  planRelationalWitnessActions,
  decomposeProductSearchFeatures 
} from '../trade_fingerprint';
import { 
  buildTradeEntityFingerprint,
  shouldUseEntityProofSearch, 
  createEntityProofState, 
  updateEntityProofState, 
  canRunEntityProofAction 
} from '../entity_proof_search';

console.log('=== MISSION 6: BREAK DTF ===\n');

// Test 1: Product decomposition
console.log('=== TEST 1: Product decomposition ===');
const decomposed = decomposeProductSearchFeatures('Cardioval-XZ41 500mg tablets');
console.log('Decomposed:', JSON.stringify(decomposed, null, 2));

// Test 2: Generic product names
console.log('\n=== TEST 2: Generic product names ===');
const genericProducts = ['TABLETS', 'MEDICINES', '1000 PCS', 'PHARMA', 'LIMITED', 'INJECTION', 'CAPSULES'];
for (const product of genericProducts) {
  const d = decomposeProductSearchFeatures(product);
  console.log(`  "${product}" -> ${JSON.stringify(d)}`);
}

// Test 3: DTF recurrence - Entity A vs Entity B
console.log('\n=== TEST 3: DTF Recurrence (100 vs 1 shipments) ===');
const fpA = buildTradeEntityFingerprint('Entity A Importers', { 
  country: 'Tanzania', 
  traded_with: ['Partner X'], 
  known_products: ['Product A'],
  trade_feature_recurrence: { 'partner x': 100 },
  verified_partner_domains: {}
});
const fpB = buildTradeEntityFingerprint('Entity B Importers', { 
  country: 'Tanzania', 
  traded_with: ['Partner X'], 
  known_products: ['Product A'],
  trade_feature_recurrence: { 'partner x': 1 },
  verified_partner_domains: {}
});

const featuresA = scoreDiscriminativeTransactionFeatures(fpA);
const featuresB = scoreDiscriminativeTransactionFeatures(fpB);

const partnerA = featuresA.find(f => f.value === 'Partner X');
const partnerB = featuresB.find(f => f.value === 'Partner X');
console.log(`Entity A (100 shipments): recurrence=${partnerA?.recurrence}, utility=${partnerA?.utility}`);
console.log(`Entity B (1 shipment): recurrence=${partnerB?.recurrence}, utility=${partnerB?.utility}`);
console.log(`Recurrence difference preserved: ${(partnerA?.recurrence || 0) > (partnerB?.recurrence || 0) ? 'YES' : 'NO'}`);

// Test 4: Joint query generation
console.log('\n=== TEST 4: Joint query generation ===');
const jointA = planJointTransactionQueries(fpA, featuresA, 2);
const jointB = planJointTransactionQueries(fpB, featuresB, 2);
console.log('Entity A joint queries:', jointA.map(j => j.query));
console.log('Entity B joint queries:', jointB.map(j => j.query));

// Test 5: Witness mining
console.log('\n=== TEST 5: Witness mining ===');
const fpWitness = buildTradeEntityFingerprint('Importer A', { 
  country: 'Tanzania', 
  traded_with: ['Exporter X'], 
  known_products: ['Product A'],
  trade_feature_recurrence: { 'exporter x': 5 },
  verified_partner_domains: { 'exporter x': 'exporter-x.com' }
});
const featuresW = scoreDiscriminativeTransactionFeatures(fpWitness);
const witnesses = planRelationalWitnessActions(fpWitness, featuresW, 2);
console.log('Witness queries:', witnesses.map(w => w.query));

// Test 6: DTF uses info unavailable in bulk path
console.log('\n=== TEST 6: DTF only behind Entity Proof flag ===');
console.log('shouldUseEntityProofSearch (default env):', shouldUseEntityProofSearch({ country: 'Tanzania' }, {}));
console.log('shouldUseEntityProofSearch (flag ON):', shouldUseEntityProofSearch({ country: 'Tanzania' }, { EDGEVIEW_ENTITY_PROOF_SEARCH_V1: 'true' }));
console.log('shouldUseEntityProofSearch (website_verified):', shouldUseEntityProofSearch({ country: 'Tanzania', website: 'https://example.com', website_verified: true }, { EDGEVIEW_ENTITY_PROOF_SEARCH_V1: 'true' }));

// Test 7: DTF query can accidentally identify supplier instead of importer
console.log('\n=== TEST 7: DTF query confusion ===');
const fpSupplier = buildTradeEntityFingerprint('Supplier Co', { 
  country: 'Tanzania', 
  traded_with: ['Importer A'], 
  role: 'Exporter',
  known_products: ['Product A'],
  trade_feature_recurrence: { 'importer a': 10 },
  verified_partner_domains: {}
});
const featuresSupplier = scoreDiscriminativeTransactionFeatures(fpSupplier);
const jointSupplier = planJointTransactionQueries(fpSupplier, featuresSupplier, 2);
console.log('Supplier (Exporter) joint queries:', jointSupplier.map(j => j.query));
console.log('^ Query mentions "Supplier Co" and "Importer A" - could identify the wrong entity!');

console.log('\n=== MISSION 7: BREAK RELATIONAL WITNESS MINING ===\n');

// Test witness mining contact transfer
console.log('=== Witness Mining Contact Transfer Test ===');
const fpWitness2 = buildTradeEntityFingerprint('Importer B', { 
  country: 'Kenya', 
  traded_with: ['Supplier Y'], 
  known_products: ['Product B'],
  trade_feature_recurrence: { 'supplier y': 3 },
  verified_partner_domains: { 'supplier y': 'supplier-y.com' }
});
const featuresW2 = scoreDiscriminativeTransactionFeatures(fpWitness2);
const witnesses2 = planRelationalWitnessActions(fpWitness2, featuresW2, 2);
console.log('Witness queries:', witnesses2.map(w => ({ query: w.query, reason: w.reason })));
console.log('^ Reason says "never transfer counterparty contacts" but query includes site:supplier-y.com which could expose supplier contacts!');

// Test Entity Proof state machine
console.log('\n=== Entity Proof State Machine ===');
const context = { country: 'Somalia', role: 'Importer' as const };
const state = createEntityProofState('HAMAR TRADING COMPANY', context, {
  max_candidates: 2,
  max_discrimination_rounds: 2,
  max_additional_searches: 2,
  max_additional_retrievals: 4,
});
console.log('Initial state:', { phase: state.phase, budget: state.budget, candidates: state.candidates.length });
console.log('canRunEntityProofAction (initial):', canRunEntityProofAction(state));

// Simulate evidence
const evidence = [
  { url: 'https://registry.example/hamar', title: 'Hamar Trading', content: 'HAMAR TRADING COMPANY, Mogadishu. Import: Exporter Netherlands A.', source_type: 'registry', admission_decision: 'ADMIT' as const },
];
const updated = updateEntityProofState(state, evidence, []);
console.log('After evidence:', { phase: updated.phase, result: updated.result, candidates: updated.candidates.length });
console.log('canRunEntityProofAction:', canRunEntityProofAction(updated));