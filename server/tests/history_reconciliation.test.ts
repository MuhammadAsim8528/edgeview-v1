import assert from 'node:assert/strict';
import { planHistoryReconciliation } from '../history_reconciliation';
import type { UploadedFileRecord } from '../sqlite_persistence';

const file = (id: string, importer: string, country = 'Kenya'): UploadedFileRecord => ({
  id, file_name: 'same.csv', file_hash: 'a'.repeat(64), source: 'real', row_count: 1,
  file_data: { rows: [{ Importer: importer, Country: country, Item: 'Product', TOT_FC: 10 }] },
  total_value: 10, unique_countries: 1, unique_importers: 1, uploaded_at: '2026-01-01T00:00:00Z', file_type: 'CSV', size: 100,
});
const row = (importer: string, id = 7, owner: string | null = null) => ({
  id, be_link: '', be_date: '', hs_code: '', item: 'Product', importer, exporter: '', country: 'Kenya',
  tot_fc: 10, qty: 0, unit: '', agent_name: '', file_name: 'same.csv', file_id: owner, source: 'real',
});
const files = [file('first', 'Buyer A'), file('second', 'Buyer B')];
const legacy = [row('Buyer B')];
const before = JSON.stringify({ files, legacy });
const plan = planHistoryReconciliation('same.csv', files, legacy);
assert.equal(plan.status, 'RECONCILABLE');
assert.equal(plan.primaryRows, 2); assert.equal(plan.legacyRows, 1); assert.equal(plan.missingRows, 1);
assert.equal(plan.appliesChanges, false); assert.equal(plan.requiresPreimageBackup, true);
assert.equal(JSON.stringify({ files, legacy }), before, 'planning must not alter saved rows or original evidence');
assert.deepEqual(planHistoryReconciliation('same.csv', [...files].reverse(), legacy), plan, 'source file ordering does not invent another plan');
assert.equal(planHistoryReconciliation('same.csv', files, [row('Buyer A', 1, 'first'), row('Buyer B', 2, 'second')]).status, 'CURRENT');
const blocked = (data: ReturnType<typeof planHistoryReconciliation>, code: string) => {
  assert.equal(data.status, 'BLOCKED'); assert.equal(data.code, code); assert.equal(data.appliesChanges, false);
};
blocked(planHistoryReconciliation('same.csv', files, [row('Unmatched Buyer')]), 'UNMATCHED_HISTORY_ROW');
blocked(planHistoryReconciliation('same.csv', files, [row('Buyer B', 1), row('Buyer B', 2)]), 'EXCESS_HISTORY_ROWS');
blocked(planHistoryReconciliation('same.csv', files, [row('Buyer B', 1, 'first')]), 'OWNED_HISTORY_MISMATCH');
blocked(planHistoryReconciliation('same.csv', files, [row('Buyer B', 1, 'unknown')]), 'OWNED_HISTORY_MISMATCH');
blocked(planHistoryReconciliation('same.csv', files, [{ ...row('Buyer B'), country: 'Pakistan' }]), 'UNMATCHED_HISTORY_ROW');
blocked(planHistoryReconciliation('same.csv', files, [{ ...row('Buyer B'), tot_fc: 11 }]), 'UNMATCHED_HISTORY_ROW');
blocked(planHistoryReconciliation('same.csv', files, [{ ...row('Buyer B'), source: 'test' }]), 'UNMATCHED_HISTORY_ROW');
blocked(planHistoryReconciliation('same.csv', [], legacy), 'NO_PRIMARY_DATASET');
blocked(planHistoryReconciliation('same.csv', [files[0], files[0]], []), 'INVALID_INPUT');
blocked(planHistoryReconciliation('same.csv', [{ ...files[0], row_count: 100 }], []), 'INVALID_INPUT');
blocked(planHistoryReconciliation('same.csv', files, [row('Buyer B'), row('Buyer B')]), 'INVALID_INPUT');
blocked(planHistoryReconciliation('same.csv', files, legacy, { maxRows: 1, maxBytes: 1024 }), 'LIMIT_EXCEEDED');
blocked(planHistoryReconciliation('same.csv', files, legacy, { maxRows: 10, maxBytes: 1 }), 'LIMIT_EXCEEDED');
blocked(planHistoryReconciliation('same.csv', files, legacy, { maxRows: 50001, maxBytes: 1024 }), 'INVALID_INPUT');
// Identical row content in two primary datasets permits a replacement index,
// never a claim about which dataset owned an ambiguous historical row ID.
const ambiguous = planHistoryReconciliation('same.csv', [file('one', 'Same Buyer'), file('two', 'Same Buyer')], [row('Same Buyer')]);
assert.equal(ambiguous.status, 'RECONCILABLE'); assert.equal(ambiguous.missingRows, 1);
assert.ok(!('assignments' in ambiguous), 'never fabricate per-row provenance for indistinguishable copies');
assert.ok(!JSON.stringify(plan).includes('Buyer'), 'the plan summary does not expose row values');
console.log('PASS non-mutating exact-row/multiplicity history preflight, missing-index detection, ownership/country refusal and resource bounds; no apply performed');
