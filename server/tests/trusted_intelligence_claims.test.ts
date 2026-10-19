import assert from 'node:assert/strict';
import { buildTrustedIntelligence } from '../trusted_intelligence';

const result = buildTrustedIntelligence('Alpha Pharma', 'Kenya', 'https://alpha.example', [
  { field: 'Decision Maker', value: 'Ahmed Khan (CEO)', source_url: 'https://alpha.example/leadership' },
  { field: 'Decision Maker', value: 'David Ali (CEO)', source_url: 'https://registry.go.ke/alpha' },
  { field: 'email', value: 'info@alpha.example', source_url: 'https://alpha.example/contact' },
  { field: 'phone', value: '+254 700 000000', source_url: 'https://alpha.example/contact' },
], 5);

assert.equal(result.claims.length, 4);
assert.equal(result.contradictions.length, 1, 'competing CEO claims must remain linked');
assert.equal(result.contradictions[0].status, 'unresolved');
assert.equal(result.claims.filter((claim) => claim.predicate === 'leadership_role:ceo').every((claim) => claim.status === 'disputed'), true);
assert.equal(result.assessment.coverage, 'HIGH');
assert.equal(result.assessment.evidence_strength, 'STRONG');
assert.match(result.assessment.basis, /not a calibrated probability/i);

console.log('trusted_intelligence_claims.test.ts: PASS');
