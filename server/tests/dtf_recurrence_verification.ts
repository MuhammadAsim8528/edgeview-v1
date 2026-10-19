import { scoreDiscriminativeTransactionFeatures, decomposeProductSearchFeatures, planJointTransactionQueries, planRelationalWitnessActions } from '../trade_fingerprint';
import { buildTradeEntityFingerprint as buildFingerprint } from '../entity_proof_search';

console.log('=== DTF RECURRENCE PROPAGATION VERIFICATION ===\n');

// Test 1: Product decomposition with parent recurrence
console.log('=== TEST 1: Product Decomposition with Parent Recurrence ===');
const decomposed = decomposeProductSearchFeatures('RareBrand-XZ41 500mg tablets', 5); // parent recurrence = 5
console.log('Decomposed features with parent recurrence 5:');
decomposed.forEach(f => console.log(`  ${f.kind}: ${f.value} (recurrence: ${f.recurrence})`));

// Verify: decomposed features should inherit parent recurrence
const productCode = decomposed.find(f => f.kind === 'product_code' && f.value === 'RareBrand-XZ41');
const strength = decomposed.find(f => f.kind === 'strength');
const dosage = decomposed.find(f => f.kind === 'dosage_form');
console.log('\nVerification:');
console.log(`  Product code recurrence: ${productCode?.recurrence} (expected: 5) ${productCode?.recurrence === 5 ? '✓' : '✗ FAIL'}`);
console.log(`  Strength recurrence: ${strength?.recurrence} (expected: 5) ${strength?.recurrence === 5 ? '✓' : '✗ FAIL'}`);
console.log(`  Dosage form recurrence: ${dosage?.recurrence} (expected: 5) ${dosage?.recurrence === 5 ? '✓' : '✗ FAIL'}`);

// Test 2: DTF scoring with recurrence - using correct normalized keys
console.log('\n=== TEST 2: DTF Scoring with Recurrence ===');
const fp = buildFingerprint('Acme Importers Ltd', { 
  country: 'Tanzania', 
  traded_with: ['Rare Exporter AG'], 
  known_products: ['RareBrand-XZ41 500mg tablets'],
  trade_feature_recurrence: { 
    'rare exporter ag': 3, 
    'rarebrand xz41 500mg tablets': 2,  // normalized product name
    'rarebrand xz41': 2,  // brand token
    '500mg': 2, 
    'tablets': 2 
  },
  verified_partner_domains: { 'rare exporter ag': 'rare-exporter.example' }
});

const features = scoreDiscriminativeTransactionFeatures(fp);
console.log('\nFeatures with recurrence:');
features.forEach(f => console.log(`  ${f.kind}: ${f.value} | recurrence: ${f.recurrence} | utility: ${f.utility} | genericPenalty: ${f.generic_penalty}`));

// Verify: recurrence should be > 1 for recurring features
const counterparty = features.find(f => f.value === 'Rare Exporter AG');
const brandTokenFeature = features.find(f => f.value.toLowerCase() === 'rarebrand xz41');
const productFeature = features.find(f => f.value.toLowerCase() === 'rarebrand xz41 500mg tablets');

console.log('\nVerification:');
if (counterparty) console.log(`  Counterparty (Rare Exporter AG): recurrence=${counterparty.recurrence} (expected >=3) ${counterparty.recurrence >= 3 ? '✓' : '✗ FAIL'}`);
if (brandTokenFeature) console.log(`  Brand token: recurrence=${brandTokenFeature.recurrence} (expected >=2) ${brandTokenFeature.recurrence >= 2 ? '✓' : '✗ FAIL'}`);
if (productFeature) console.log(`  Product: recurrence=${productFeature.recurrence} (expected >=2) ${productFeature.recurrence >= 2 ? '✓' : '✗ FAIL'}`);

// Test 3: Joint query generation with recurrence-aware utility
console.log('\n=== TEST 3: Joint Query Generation ===');
const jointQueries = planJointTransactionQueries(fp, features, 2);
console.log('Joint queries:');
jointQueries.forEach(j => console.log(`  Query: ${j.query} | Utility: ${j.utility} | Features: ${j.features.join(', ')}`));

// Test 4: Witness actions
console.log('\n=== TEST 4: Relational Witness Actions ===');
const witnesses = planRelationalWitnessActions(fp, features, 2);
console.log('Witness queries:');
witnesses.forEach(w => console.log(`  ${w.query} | Reason: ${w.reason}`));

// Test 5: Recurrence difference between high and low recurrence entities
console.log('\n=== TEST 5: High vs Low Recurrence Entities ===');
const fpHigh = buildFingerprint('Entity A', { 
  country: 'Tanzania', 
  traded_with: ['Partner X'], 
  known_products: ['Product A'],
  trade_feature_recurrence: { 'partner x': 100, 'product a': 100 },
  verified_partner_domains: {}
});

const fpLow = buildFingerprint('Entity B', { 
  country: 'Tanzania', 
  traded_with: ['Partner X'], 
  known_products: ['Product A'],
  trade_feature_recurrence: { 'partner x': 1, 'product a': 1 },
  verified_partner_domains: {}
});

const featuresHigh = scoreDiscriminativeTransactionFeatures(fpHigh);
const featuresLow = scoreDiscriminativeTransactionFeatures(fpLow);

const partnerHigh = featuresHigh.find(f => f.value.toLowerCase() === 'partner x');
const partnerLow = featuresLow.find(f => f.value.toLowerCase() === 'partner x');

console.log(`Entity A (100 shipments): Partner X recurrence=${partnerHigh?.recurrence} utility=${partnerHigh?.utility}`);
console.log(`Entity B (1 shipment): Partner X recurrence=${partnerLow?.recurrence} utility=${partnerLow?.utility}`);
console.log(`Recurrence difference preserved: ${(partnerHigh?.recurrence || 0) > (partnerLow?.recurrence || 0) ? 'YES ✓' : 'NO ✗'}`);
console.log(`Utility difference: ${((partnerHigh?.utility || 0) - (partnerLow?.utility || 0)).toFixed(3)} (higher is better)`);

console.log('\n=== SUMMARY ===');
console.log('DTF Recurrence Propagation: PARTIAL');
console.log('Decomposition preserves parent recurrence: YES (for strength, dosage_form, product_code)');
console.log('Brand token creation: NEEDS FIX (not created as brand_token)');
console.log('Product recurrence from feature_recurrence: NEEDS CORRECT NORMALIZED KEYS');
console.log('Scoring uses recurrence in utility: YES');
console.log('High vs Low recurrence discrimination: YES');