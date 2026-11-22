import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'edgeview-api-stats-regressions-'));
Object.assign(process.env, {
  NODE_ENV: 'test', EDGEVIEW_TEST_MODE: '1', EDGEVIEW_TEST_DB_DIR: root,
  EDGEVIEW_JSON_DB: path.join(root, 'rows.json'), EDGEVIEW_SQLITE_DB: path.join(root, 'operational.db'),
  EDGEVIEW_CONFIG: path.join(root, 'config.json'), EDGEVIEW_V1_DATA_DIR: path.join(root, 'runs'),
});

const { db } = await import('../db');
const { statsRouter, extractRowData } = await import('../stats_router');
const { groupShipmentRows } = await import('../grouping');
const { saveFileToDb, loadAllFilesFromDb } = await import('../sqlite_persistence');
const { getDb, resetDbInstanceForTests } = await import('../sqlite');

const fileId = 'stats-regression-file';
const rows = [
  { Country: 'Kenya', Importer: 'Shared Importer', Exporter: '"Quoted" Supplier', Item: 'Product "A"', BE_DATE: '31/12/2025', TOT_FC: '$1,234.50', Qty: '1,000 kg' },
  { Country: 'Uganda', Importer: 'Shared Importer', Exporter: 'Uganda Supplier', Item: 'Other', Date: '2026-01-02', TOT_FC: '250', Qty: '2' },
  { Country: 'Kenya', Importer: 'Other Importer', Exporter: 'Bad Numeric', Item: 'Bad Numeric', Date: '2026-02-01', TOT_FC: '12garbage', Qty: 'Infinity' },
];
const file: any = {
  id: fileId, name: 'Uploaded file', file_type: 'CSV', size: 100,
  upload_time: '2026-01-01T00:00:00.000Z',
  columns: ['Country', 'Importer', 'Exporter', 'Item', 'Date', 'TOT_FC', 'Qty'], rows, summary: {},
};
db.files.set(fileId, file);

const app = express();
app.use('/api/stats', statsRouter);
const server = app.listen(0, '127.0.0.1');
await new Promise<void>(resolve => server.once('listening', resolve));
const address = server.address();
assert.ok(address && typeof address !== 'string');
const base = `http://127.0.0.1:${address.port}/api/stats`;
const sql = await getDb();
let failure: unknown;

try {
  const summary = await (await fetch(`${base}/summary`)).json();
  assert.equal(summary.total_records, 3);
  assert.equal(summary.total_companies, 3, 'the same importer in two countries is two country-scoped companies');
  assert.equal(summary.total_countries, 2);
  assert.equal(summary.total_value, 1484.5, 'currency and thousands separators use the canonical numeric parser');
  assert.equal(extractRowData(rows[2]).total_value, 0, 'malformed numeric text cannot leak a parseFloat prefix');
  assert.equal(extractRowData(rows[2]).quantity, 0, 'infinite quantities are rejected');
  assert.equal(extractRowData({ ...rows[1], TOT_FC: '($25.50)' }).total_value, -25.5,
    'accounting totals remain signed through the shared parser');

  const grouped = groupShipmentRows([
    { ...rows[0], BE_LINK: 'shipment-1' },
    { ...rows[0], BE_LINK: 'shipment-1', Item: 'Second product', Qty: '2 kg' },
    { ...rows[0], BE_LINK: 'shipment-1', Item: 'Invalid numeric product', TOT_FC: '12garbage', Qty: '3garbage' },
  ]);
  assert.equal(grouped.length, 1);
  assert.equal(grouped[0]['Total Value (USD)'], 1234.5, 'identical shipment values are not multiplied');
  assert.equal(grouped[0].Qty, 1002, 'formatted quantities aggregate and malformed suffixes are skipped');
  const signedGroup = groupShipmentRows([
    { ...rows[0], BE_LINK: 'signed-shipment', TOT_FC: '($1,234.50)', Qty: '(5)' },
    { ...rows[0], BE_LINK: 'signed-shipment', Item: 'Correction', TOT_FC: '($1,234.50)', Qty: '2 kg' },
  ]);
  assert.equal(signedGroup[0]['Total Value (USD)'], -1234.5, 'grouping preserves signed accounting totals');
  assert.equal(signedGroup[0].Qty, 2, 'grouping excludes negative quantities at its own boundary');

  const scoped = await (await fetch(`${base}/importers/${encodeURIComponent('Shared Importer')}/summary?country=Kenya&start=31%2F12%2F2025&end=31%2F12%2F2025`)).json();
  assert.equal(scoped.total_shipments, 1, 'mixed date formats are normalized before inclusive date filtering');
  assert.equal(scoped.total_export_value, 1234.5);

  const csv = await (await fetch(`${base}/importers/${encodeURIComponent('Shared Importer')}/export?country=Kenya&start=2025-12-31&end=2025-12-31`)).text();
  assert.ok(csv.includes('"Product ""A"""'), 'embedded product quotes are RFC 4180 escaped');
  assert.ok(csv.includes('"""Quoted"" Supplier"'), 'embedded exporter quotes are RFC 4180 escaped');

  await saveFileToDb(file, 'stats-regression-unique-hash', 'test');
  for (const row of rows) {
    await sql.run('INSERT INTO history_data (file_id, file_name, importer) VALUES (?, ?, ?)', [fileId, file.name, row.Importer]);
  }
  await sql.flush();
  assert.equal((await sql.get('SELECT COUNT(*) AS count FROM history_data WHERE file_id = ?', [fileId])).count, 3);

  const run = sql.run;
  (sql as any).run = async (query: string, params: any[] = []) => {
    if (query.includes('DELETE FROM history_data') && params[0] === fileId) throw new Error('Controlled derived-history failure');
    return run(query, params);
  };
  try {
    const response = await fetch(`${base}/history-files/${fileId}`, { method: 'DELETE' });
    const body = await response.json();
    assert.equal(response.status, 503);
    assert.equal(body.success, false);
    assert.equal(body.code, 'HISTORY_CLEANUP_FAILED');
    assert.equal(body.retryable, true);
    assert.equal(body.deleted, false);
  } finally {
    (sql as any).run = run;
  }
  assert.ok((await loadAllFilesFromDb()).some(saved => saved.id === fileId), 'failed cleanup leaves the primary record retryable');
  assert.ok(db.files.has(fileId), 'failed cleanup leaves the in-memory file and name available');
  assert.equal((await sql.get('SELECT COUNT(*) AS count FROM history_data WHERE file_id = ?', [fileId])).count, 3);

  const retry = await fetch(`${base}/history-files/${fileId}`, { method: 'DELETE' });
  assert.equal(retry.status, 200, 'the identical delete request succeeds after SQL recovery');
  assert.ok(!(await loadAllFilesFromDb()).some(saved => saved.id === fileId));
  assert.equal((await sql.get('SELECT COUNT(*) AS count FROM history_data WHERE file_id = ?', [fileId])).count, 0,
    'the literal Uploaded file name no longer skips SQL cleanup');

  console.log('PASS API/stats numeric parsing, date filtering, country identity, CSV quotes, and retryable deletion');
} catch (error) {
  failure = error;
} finally {
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  await sql.flush();
  resetDbInstanceForTests();
  assert.equal(path.dirname(fs.realpathSync(root)), fs.realpathSync(os.tmpdir()));
  fs.rmSync(root, { recursive: true, force: true });
}
if (failure) {
  console.error(failure);
  process.exitCode = 1;
}
