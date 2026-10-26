import assert from 'node:assert/strict';
import { db } from '../db';
import { computeSummary } from '../summary';

assert.equal(db.files.size, 0, 'ordinary construction starts empty');
assert.equal(db.contacts.size, 0, 'ordinary construction has no demo companies');
const own = { id: 'retained-user-file', name: 'synthetic-user.csv', file_type: 'CSV', size: 1,
  upload_time: '2026-01-02T00:00:00Z', columns: [], rows: [], summary: computeSummary([], []) } as any;
db.files.set(own.id, own);
db.seedInitialData();
assert.equal(db.files.get(own.id), own, 'explicit demo must not replace unrelated uploaded data');
const examples = [...db.files.values()].filter(file => file.id.startsWith('file-sample-'));
assert.equal(examples.length, 5, 'existing five format examples remain available explicitly');
assert.deepEqual(new Set(examples.map(file => file.file_type)), new Set(['NVL', 'DBF', 'Excel', 'CSV', 'DOCX']));
for (const file of examples) {
  assert.ok(file.name.startsWith('synthetic-demo.'), 'demo is visibly labelled');
  assert.equal(file.rows.length, 1);
  assert.equal(file.rows[0].Importer, 'Synthetic Demo Buyer');
  assert.equal(file.rows[0].Exporter, 'Synthetic Demo Supplier');
  assert.ok(file.raw_text?.includes('Synthetic demonstration product'));
  assert.ok(!/verified|GMP|FDA|audit score|Novartis|Pfizer|FEROZSONS/i.test(JSON.stringify(file)), 'no fabricated real-company compliance/trade claim');
  assert.equal(db.getFileById(file.id), file, 'explicit demo indexes are immediately usable');
}
assert.ok([...db.contacts.values()].every(contact => contact.company_name.startsWith('Synthetic Demo ')));
db.seedInitialData();
assert.equal(db.files.size, 6, 'repeated explicit demo seeding does not multiply files');
console.log('PASS empty default, explicit five-format synthetic examples, usable indexes, repeat safety and preservation of unrelated uploaded files');
