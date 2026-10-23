import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import ExcelJS from 'exceljs';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'edgeview-upload-names-'));
Object.assign(process.env, {
  NODE_ENV: 'test', EDGEVIEW_TEST_MODE: '1', EDGEVIEW_TEST_DB_DIR: root,
  EDGEVIEW_JSON_DB: path.join(root, 'rows.json'), EDGEVIEW_SQLITE_DB: path.join(root, 'operational.db'),
  EDGEVIEW_CONFIG: path.join(root, 'config.json'), EDGEVIEW_V1_DATA_DIR: path.join(root, 'runs'),
});
const { uploadRouter, validateUploadFileName } = await import('../routes/upload');
const { db } = await import('../db');
const sql = await (await import('../sqlite')).getDb();
const aliases = ['/api/upload', '/api/files/upload', '/upload', '/files/upload'];
const app = express();
app.use(aliases, uploadRouter);
const server = app.listen(0, '127.0.0.1');
await new Promise<void>(resolve => server.once('listening', resolve));
const address = server.address();
assert.ok(address && typeof address !== 'string');
const port = address.port;
let sequence = 0;
async function upload(alias: string, name: string, bytes?: Buffer, ordinary = false) {
  const boundary = 'EdgeViewFilenameBoundary';
  // Extended filename preserves adversarial names without header injection.
  const encoded = encodeURIComponent(name).replace(/'/g, '%27');
  const filename = ordinary
    ? `filename="${name.replace(/\r/g, '%0D').replace(/\n/g, '%0A').replace(/"/g, '%22')}"`
    : `filename="fallback.csv"; filename*=UTF-8''${encoded}`;
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; ${filename}\r\nContent-Type: application/octet-stream\r\n\r\n`),
    bytes || Buffer.from(`IMPORTER,COUNTRY,ITEM\nSynthetic ${++sequence},Kenya,Test\n`),
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  return fetch(`http://127.0.0.1:${port}${alias}`, { method: 'POST', headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` }, body, signal: AbortSignal.timeout(10_000) });
}
async function state() {
  return JSON.stringify({ files: [...db.files], contacts: [...db.contacts], history: await sql.all('SELECT * FROM history_data'),
    json: fs.existsSync(path.join(root, 'rows.json')) ? fs.readFileSync(path.join(root, 'rows.json'), 'utf8') : null });
}
try {
  const invalid = ['csv', 'xlsx', 'nvl', '.csv', ' .csv', 'report.', 'report.csv ', 'report.csv.', 'report.csv.exe', '../report.csv', '..\\report.csv', 'C:\\fakepath\\report.csv', 'report.csv:stream', 'CON.csv', 'NUL.xlsx', 'COM1.csv', 'LPT².csv', 'report\n.csv', 'report\r.csv', 'report\u0000.csv', 'report".csv'];
  for (const name of invalid) assert.equal(validateUploadFileName(name), false, JSON.stringify(name));
  for (const name of ['report.csv', 'DATA.NVL', 'report.XLSX', 'report.exe.csv', '医薬品.csv', '50%.csv', 'COM10.csv']) assert.equal(validateUploadFileName(name), true, name);
  for (const alias of aliases) {
    for (const name of invalid) {
      const before = await state();
      const response = await upload(alias, name);
      assert.equal(response.status, 400, `${alias}: ${JSON.stringify(name)}`);
      assert.equal((await response.json()).code, 'UNSUPPORTED_FILE_TYPE');
      assert.equal(await state(), before, 'rejected upload must not persist or publish');
    }
  }
  for (const name of ['../ordinary.csv', 'ordinary\n.csv', 'ordinary".csv']) {
    const before = await state();
    const response = await upload(aliases[0], name, undefined, true);
    assert.equal(response.status, 400);
    assert.equal((await response.json()).code, 'UNSUPPORTED_FILE_TYPE');
    assert.equal(await state(), before);
  }
  assert.equal((await upload(aliases[0], '普通のファイル.CSV', undefined, true)).status, 201);
  for (const [index, name] of ['valid.CSV', 'valid.NVL', '医薬品.csv', 'report.exe.csv'].entries()) {
    const response = await upload(aliases[index], name);
    assert.equal(response.status, 201, name);
    assert.ok(db.files.size > index);
  }
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Trade');
  sheet.addRow(['IMPORTER', 'COUNTRY', 'ITEM']);
  sheet.addRow(['Workbook Synthetic', 'Kenya', 'Test']);
  const validWorkbook = await upload(aliases[0], 'valid.XLSX', Buffer.from(await workbook.xlsx.writeBuffer()));
  assert.equal(validWorkbook.status, 201);
  assert.ok((await sql.all('SELECT * FROM history_data')).length >= 5);
  // Reusing already accepted bytes cannot bypass filename validation via deduplication.
  const duplicateBytes = Buffer.from('IMPORTER,COUNTRY,ITEM\nDuplicate Synthetic,Kenya,Test\n');
  assert.equal((await upload(aliases[0], 'duplicate.csv', duplicateBytes)).status, 201);
  assert.equal((await upload(aliases[0], 'duplicate.csv', duplicateBytes)).status, 200);
  const beforeDuplicate = await state();
  assert.equal((await upload(aliases[0], 'csv', duplicateBytes)).status, 400);
  assert.equal(await state(), beforeDuplicate);
  const beforeMalformed = await state();
  assert.equal((await upload(aliases[0], 'broken.xlsx', Buffer.from('not a workbook'))).status, 422);
  assert.equal(await state(), beforeMalformed);
  console.log('Upload filename HTTP aliases and pre-persistence rejection: PASS');
} finally {
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  await sql.flush();
  fs.rmSync(root, { recursive: true, force: true });
}
