import assert from 'node:assert/strict';
import initSqlJs from 'sql.js';
import { buildHistoryRepairCandidate } from '../history_repair_candidate';
import { planHistoryReconciliation } from '../history_reconciliation';

const SQL = await initSqlJs();
const database = new SQL.Database();
database.exec(`PRAGMA user_version=2;
 CREATE TABLE history_data(id INTEGER PRIMARY KEY AUTOINCREMENT,be_link TEXT,be_date TEXT,hs_code TEXT,
 item TEXT,importer TEXT,exporter TEXT,country TEXT,tot_fc REAL,qty REAL,unit TEXT,agent_name TEXT,
 file_name TEXT,source TEXT DEFAULT 'real',uploaded_at TEXT DEFAULT CURRENT_TIMESTAMP,file_id TEXT);
 CREATE TABLE untouched(id INTEGER PRIMARY KEY,value TEXT);
 INSERT INTO untouched VALUES(1,'Synthetic private evidence');
 INSERT INTO history_data(id,be_link,be_date,hs_code,item,importer,exporter,country,tot_fc,qty,unit,agent_name,file_name,source,uploaded_at,file_id)
 VALUES(7,'','','','Product','Buyer B','','Kenya',10,0,'','','same.csv','real','2026-01-01',NULL),
 (8,'','','','Other','Sibling','','Pakistan',9,0,'','','other.csv','real','2025-01-01','sibling');`);
const makeFile = (id: string, importer: string) => ({ id, file_name: 'same.csv', file_hash: id,
  source: 'real', row_count: 1, file_data: { rows: [{ Importer: importer, Country: 'Kenya', Item: 'Product', TOT_FC: 10 }], columns: [] } });
const primary = Buffer.from(JSON.stringify([makeFile('first', 'Buyer A'), makeFile('second', 'Buyer B')]));
const original = database.export(); database.close();
const prePrimary = Buffer.from(primary), preDatabase = original.slice();
const result = await buildHistoryRepairCandidate(primary, original, 'same.csv');
assert.equal(result.status, 'CANDIDATE_ONLY');
assert.equal(result.appliesChanges, false);
assert.equal(result.insertedRows, 2); assert.equal(result.removedLegacyRows, 1);
assert.deepEqual(primary, prePrimary); assert.deepEqual(original, preDatabase);
assert.ok(result.candidate);
const repaired = new SQL.Database(result.candidate);
assert.deepEqual(repaired.exec("SELECT importer,country,file_id FROM history_data WHERE file_name='same.csv' ORDER BY file_id")[0].values,
  [['Buyer A', 'Kenya', 'first'], ['Buyer B', 'Kenya', 'second']]);
assert.deepEqual(repaired.exec("SELECT id,importer,country,uploaded_at,file_id FROM history_data WHERE file_name='other.csv'")[0].values,
  [[8, 'Sibling', 'Pakistan', '2025-01-01', 'sibling']]);
assert.equal(repaired.exec('SELECT value FROM untouched')[0].values[0][0], 'Synthetic private evidence');
const repairedBytes = repaired.export();
const current = await buildHistoryRepairCandidate(primary, repairedBytes, 'same.csv');
assert.equal(current.status, 'CURRENT'); assert.ok(!('candidate' in current), 'no unnecessary row rewriting');
// Existing valid owned records retain row IDs and ingestion timestamps.
repaired.run("UPDATE history_data SET file_id=NULL WHERE file_id='second'");
const kept = repaired.exec("SELECT id,uploaded_at FROM history_data WHERE file_id='first'")[0].values;
const partlyOwned = await buildHistoryRepairCandidate(primary, repaired.export(), 'same.csv');
assert.equal(partlyOwned.status, 'CANDIDATE_ONLY');
const ownedReopened = new SQL.Database(partlyOwned.candidate);
assert.deepEqual(ownedReopened.exec("SELECT id,uploaded_at FROM history_data WHERE file_id='first'")[0].values, kept);
ownedReopened.close();
for (const change of ["UPDATE history_data SET country='Pakistan' WHERE file_name='same.csv'",
  'PRAGMA user_version=4', 'CREATE TRIGGER unexpected AFTER DELETE ON history_data BEGIN DELETE FROM untouched; END',
  'CREATE TABLE dependent(history_id INTEGER REFERENCES history_data(id))']) {
  const bad = new SQL.Database(original); bad.exec(change);
  const refused = await buildHistoryRepairCandidate(primary, bad.export(), 'same.csv');
  assert.equal(refused.status, 'BLOCKED'); assert.ok(!('candidate' in refused)); bad.close();
}
for (const malformed of [Buffer.from('{private marker'), Buffer.from('{}'), Buffer.from([0xff])]) {
  assert.equal((await buildHistoryRepairCandidate(malformed, original, 'same.csv')).status, 'BLOCKED');
}
const privateChanged = Buffer.from(primary);
const pending = buildHistoryRepairCandidate(privateChanged, original, 'same.csv');
privateChanged.fill(0);
const captured = await pending;
assert.equal(captured.status, 'CANDIDATE_ONLY', 'bind bytes before asynchronous initialization');
assert.equal(captured.primarySha256, result.primarySha256);
const empty = { ...makeFile('empty', ''), source: 'invalid', row_count: 0, file_data: { rows: [], columns: [] } };
assert.equal(planHistoryReconciliation('same.csv', [empty] as never, []).status, 'BLOCKED');
const identical = Buffer.from(JSON.stringify([makeFile('copy-one', 'Buyer B'), makeFile('copy-two', 'Buyer B')]));
const duplicate = await buildHistoryRepairCandidate(identical, original, 'same.csv');
assert.equal(duplicate.status, 'CANDIDATE_ONLY');
const duplicateDb = new SQL.Database(duplicate.candidate);
assert.deepEqual(duplicateDb.exec("SELECT importer,file_id FROM history_data WHERE file_name='same.csv' ORDER BY file_id")[0].values,
  [['Buyer B', 'copy-one'], ['Buyer B', 'copy-two']], 'derive duplicate multiplicity from primary IDs, not guesses about the old row');
duplicateDb.close();
const schema3 = new SQL.Database(original);
schema3.exec(`PRAGMA user_version=3; CREATE TABLE company_aliases(alias_id TEXT PRIMARY KEY, proof_json TEXT);
  INSERT INTO company_aliases VALUES('synthetic-alias','{"raw_name":"Synthetic original alias","run_id":"run-retained"}');`);
const aliasPreimage = schema3.exec('SELECT * FROM company_aliases')[0].values;
const newerCandidate = await buildHistoryRepairCandidate(primary, schema3.export(), 'same.csv');
assert.equal(newerCandidate.status, 'CANDIDATE_ONLY');
const newerReopened = new SQL.Database(newerCandidate.candidate);
assert.equal(newerReopened.exec('PRAGMA user_version')[0].values[0][0], 3);
assert.deepEqual(newerReopened.exec('SELECT * FROM company_aliases')[0].values, aliasPreimage,
  'history repair preserves existing alias proofs verbatim');
newerReopened.close(); schema3.close();
repaired.close();
console.log('PASS offline history candidate: preserved preimages/siblings/owned metadata, restored missing rows, reopened integrity, current no-op, unsafe input/schema/trigger refusal; no filesystem apply');
