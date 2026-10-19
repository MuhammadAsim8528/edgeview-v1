import assert from 'node:assert/strict';
import { extractRecoveredValue, loadBenchmarkTruthset, scoreBenchmarkFact } from './cold_benchmark_runner';

const trackA = loadBenchmarkTruthset('A');
assert.equal(trackA.entities.flatMap((entity) => entity.facts).length, 18, 'Track A must remain exactly 18 facts');
assert.ok(trackA.entities.flatMap((entity) => entity.facts).every((fact) => fact.status === 'VERIFIED'));

const phone = scoreBenchmarkFact({ field: 'phone', value: '+254 111 041600', status: 'VERIFIED' }, '+254111041600', 0);
assert.equal(phone.status, 'RECOVERED_CORRECTLY');

const address = scoreBenchmarkFact(
  { field: 'address', value: 'MSIMBAZI/SIKUKUU STREET, KARIAKOO', status: 'VERIFIED' },
  ['Msimbazi Sikukuu Street Kariakoo'],
  1,
  1,
);
assert.equal(address.status, 'RECOVERED_CORRECTLY');

const missed = scoreBenchmarkFact({ field: 'email', value: 'info@example.com', status: 'VERIFIED' }, [], 2, 3);
assert.equal(missed.status, 'MISSED');
assert.equal(missed.first_loss_boundary, 'UNTRACED', 'evidence count alone must not invent a first-loss boundary');

const leaders = extractRecoveredValue(
  { field: 'leaders', value: 2, status: 'VERIFIED' },
  {
    company_name: 'Example', website: '', address: '', phone: '', email: '', linkedin: '', industry: '',
    isPartial: false, source: 'test', contact_persons: [{ name: 'A Person' }, { name: 'B Person' }],
    decision_makers: [{ name: 'A Person' }],
  },
);
assert.equal(leaders, 2, 'Leader-count facts must score a deduplicated count, not names against a number');

assert.throws(
  () => scoreBenchmarkFact({ field: 'phone', status: 'UNKNOWN' }, '', 3),
  /Only VERIFIED facts/,
  'UNKNOWN and PARTIAL truth must never enter primary scoring',
);

console.log('cold_benchmark_runner: 7 assertions passed');
