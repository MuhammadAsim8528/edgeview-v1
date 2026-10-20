import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { isTestRecord, resolveDatasetSource, getHistoryFilesFromDb } from '../sqlite_persistence';
for (const name of ['latest.xlsx', 'contest.csv', 'customer-demo-sales.csv', 'sampled-production.csv', 'my_suppliers_master_export.csv']) assert.equal(isTestRecord('file-customer-001', name), false, `${name} is not synthetic by substring`);
for (const name of ['sample.csv', 'test_fixture.csv', 'demo.xlsx', 'mock-data.csv', 'trade_manifest.csv']) assert.equal(isTestRecord('file-customer-001', name), true);
assert.equal(isTestRecord('file-sample-csv-1', 'something.csv'), true);
assert.equal(resolveDatasetSource({ file_name: 'latest.xlsx', source: 'real' }, false), 'real');
assert.equal(resolveDatasetSource({ file_name: 'latest.xlsx', source: 'test' }, false), 'test', 'never guess that an existing test record is real');
assert.equal(resolveDatasetSource({ file_name: 'sample.csv', source: 'real' }, false), 'test', 'legacy known synthetic data remains excluded');
assert.equal(resolveDatasetSource({ file_name: 'sample.csv', source: 'real', provenance_version: 1 }, false), 'real', 'explicit new upload provenance wins over filename hints');
assert.equal(resolveDatasetSource({ file_name: 'data.csv' }, true), 'test', 'unmarked isolated-test data remains test');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'edgeview-history-provenance-'));
process.env.EDGEVIEW_JSON_DB = path.join(root, 'persistence.json');
try {
  const records = [
    { id: 'file-customer-a', file_name: 'latest.xlsx', source: 'real', file_data: { rows: [{ Importer: 'Retain A' }] } },
    { id: 'file-customer-b', file_name: 'latest-old.xlsx', source: 'test', file_data: { rows: [{ Importer: 'Retain B' }] } },
    { id: 'file-sample-csv-1', file_name: 'sample.csv', source: 'real', file_data: { rows: [{ Importer: 'Retain C' }] } },
    { id: 'file-customer-d', file_name: 'sample-customer.csv', source: 'real', provenance_version: 1, file_data: { rows: [{ Importer: 'Retain D' }] } },
  ];
  const bytes = JSON.stringify(records);
  fs.writeFileSync(process.env.EDGEVIEW_JSON_DB, bytes);
  assert.deepEqual((await getHistoryFilesFromDb()).map(record => record.id).sort(), ['file-customer-a', 'file-customer-d']);
  assert.equal(fs.readFileSync(process.env.EDGEVIEW_JSON_DB, 'utf8'), bytes, 'history reads must not migrate, delete or rewrite old records');
  console.log('PASS history provenance avoids substring false positives while preserving explicit and legacy test records');
} finally { delete process.env.EDGEVIEW_JSON_DB; fs.rmSync(root, { recursive: true, force: true }); }
