import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'edgeview-upload-history-identity-'));
Object.assign(process.env, { NODE_ENV: 'test', EDGEVIEW_TEST_MODE: '1', EDGEVIEW_TEST_DB_DIR: root,
  EDGEVIEW_JSON_DB: path.join(root, 'rows.json'), EDGEVIEW_SQLITE_DB: path.join(root, 'operational.db'),
  EDGEVIEW_CONFIG: path.join(root, 'config.json'), EDGEVIEW_V1_DATA_DIR: path.join(root, 'runs') });
const { uploadRouter } = await import('../routes/upload');
const { statsRouter } = await import('../stats_router');
const { getDb, resetDbInstanceForTests } = await import('../sqlite');
const { loadAllFilesFromDb } = await import('../sqlite_persistence');
const sql = await getDb();
const app = express(); app.use('/api', uploadRouter);
app.use('/api/stats', statsRouter);
const server = app.listen(0, '127.0.0.1');
await new Promise<void>(resolve => server.once('listening', resolve));
const address = server.address(); assert.ok(address && typeof address !== 'string');
const url = `http://127.0.0.1:${address.port}/api/files/upload`;
async function upload(buyer: string) {
  const form = new FormData();
  form.set('file', new Blob([`Date,Importer,Country,Exporter,Item,TOT_FC\n2026-01-01,${buyer},Kenya,Synthetic Supplier,Product,10\n`]), 'shared-name.csv');
  const response = await fetch(url, { method: 'POST', body: form, signal: AbortSignal.timeout(10000) });
  assert.equal(response.status, 201, 'different file contents must remain distinct uploads');
  return response.json();
}
let failure: unknown;
try {
  const first = await upload('Synthetic First Buyer');
  const firstId = first.id || first.data?.id; assert.equal(typeof firstId, 'string');
  assert.equal((await sql.get('SELECT COUNT(*) AS count FROM history_data WHERE importer = ?', ['Synthetic First Buyer'])).count, 1);
  await upload('Synthetic Second Buyer');
  const saved = (await loadAllFilesFromDb()).filter(file => file.name === 'shared-name.csv');
  assert.equal(saved.length, 2, 'both primary datasets must remain saved');
  assert.notEqual(saved[0].id, saved[1].id);
  const rows = await sql.all('SELECT importer FROM history_data WHERE file_name = ? ORDER BY importer', ['shared-name.csv']);
  assert.deepEqual(rows.map(row => row.importer), ['Synthetic First Buyer', 'Synthetic Second Buyer'],
    'a same-name upload must not erase shipment history owned by a different dataset ID');
  const deleted = await fetch(`http://127.0.0.1:${address.port}/api/stats/history-files/${encodeURIComponent(firstId)}`,
    { method: 'DELETE', signal: AbortSignal.timeout(10000) });
  assert.equal(deleted.status, 200);
  assert.deepEqual((await sql.all('SELECT importer FROM history_data WHERE file_name = ?', ['shared-name.csv'])).map(row => row.importer),
    ['Synthetic Second Buyer'], 'deleting one dataset must preserve same-name sibling history');
  await sql.flush(); resetDbInstanceForTests();
  assert.deepEqual((await (await getDb()).all('SELECT importer FROM history_data WHERE file_name = ?', ['shared-name.csv'])).map(row => row.importer),
    ['Synthetic Second Buyer'], 'sibling history must survive database reopen');
  console.log('PASS distinct same-name uploads retain both authoritative datasets and derived shipment histories');
} catch (error) {
  failure = error;
} finally {
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  await (await getDb()).flush(); resetDbInstanceForTests();
  assert.equal(path.dirname(fs.realpathSync(root)), fs.realpathSync(os.tmpdir()));
  fs.rmSync(root, { recursive: true, force: true });
}
if (failure) { console.error(failure); process.exitCode = 1; }
