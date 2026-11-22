import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import express from 'express';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'edgeview-upload-admission-'));
const environmentKeys = ['NODE_ENV', 'EDGEVIEW_TEST_MODE', 'EDGEVIEW_TEST_DB_DIR', 'EDGEVIEW_JSON_DB', 'EDGEVIEW_SQLITE_DB', 'EDGEVIEW_CONFIG', 'EDGEVIEW_V1_DATA_DIR'];
const originalEnvironment = Object.fromEntries(environmentKeys.map(key => [key, process.env[key]]));
const jsonPath = path.join(root, 'rows.json');
const sqlitePath = path.join(root, 'operational.db');
Object.assign(process.env, {
  NODE_ENV: 'test', EDGEVIEW_TEST_MODE: '1', EDGEVIEW_TEST_DB_DIR: root,
  EDGEVIEW_JSON_DB: jsonPath, EDGEVIEW_SQLITE_DB: sqlitePath,
  EDGEVIEW_CONFIG: path.join(root, 'config.json'), EDGEVIEW_V1_DATA_DIR: path.join(root, 'runs'),
});

const { uploadRouter } = await import('../routes/upload');
const { getDb, resetDbInstanceForTests } = await import('../sqlite');
const { computeFileHash, findFileByHash, loadAllFilesFromDb, saveFileToDb } = await import('../sqlite_persistence');
let sql = await getDb();
const app = express(); app.use('/api', uploadRouter);
const server = app.listen(0, '127.0.0.1');
await new Promise<void>(resolve => server.once('listening', resolve));
const address = server.address(); assert.ok(address && typeof address !== 'string');
const url = `http://127.0.0.1:${address.port}/api/files/upload`;
async function upload(content: string | Uint8Array, name = 'concurrent.csv') {
  const form = new FormData();
  let body: string | ArrayBuffer = content as string;
  if (typeof content !== 'string') {
    body = new ArrayBuffer(content.byteLength);
    new Uint8Array(body).set(content);
  }
  form.set('file', new Blob([body]), name);
  const response = await fetch(url, { method: 'POST', body: form, signal: AbortSignal.timeout(15000) });
  return { status: response.status, body: await response.json() as any };
}
const header = 'BE_LINK,BE_DATE,HS_CODE,ITEM,IMPORTER,EXPORTER,COUNTRY,TOT_FC,QTY,UNT,AGENT_NAME\n';
const row = (buyer: string, link = 'BE-1') => `${link},20240229,3004.90,Product,${buyer},Seller,Kenya,"USD 1,250.50",2,PCS,Agent\n`;
let failure: unknown;
try {
  // H04 + M30 + H06 + H19: only one admitted dataset/history batch survives.
  const content = header + row('Concurrent Buyer');
  const responses = await Promise.all(Array.from({ length: 6 }, () => upload(content)));
  assert.deepEqual(responses.map(result => result.status).sort((a, b) => a - b), [200, 200, 200, 200, 200, 201]);
  const ids = new Set(responses.map(result => result.body.id || result.body.data?.id));
  assert.equal(ids.size, 1);
  for (const result of responses) {
    assert.deepEqual(result.body.rows, []);
    assert.deepEqual(result.body.data.rows, []);
    assert.equal(result.body.raw_text, undefined);
    assert.equal(JSON.stringify(result.body).includes('BE-1'), false, 'duplicate/success responses contain no full row payload');
  }
  const fileId = responses[0].body.id;
  assert.equal((await sql.get('SELECT COUNT(*) AS count FROM history_data WHERE file_id = ?', [fileId])).count, 1);
  assert.deepEqual(await sql.get(`SELECT be_link,be_date,hs_code,item,importer,exporter,country,tot_fc,qty,unit,agent_name
    FROM history_data WHERE file_id = ?`, [fileId]), {
    be_link: 'BE-1', be_date: '2024-02-29', hs_code: '3004.90', item: 'Product', importer: 'Concurrent Buyer',
    exporter: 'Seller', country: 'Kenya', tot_fc: 1250.5, qty: 2, unit: 'PCS', agent_name: 'Agent',
  });
  const saved = await loadAllFilesFromDb();
  assert.equal(saved.filter(file => file.name === 'concurrent.csv').length, 1);
  assert.equal(saved[0].summary.total_cost_usd, 1250.5);

  // H03: first history durability failure rolls back in memory and on disk;
  // a later unrelated flush/reopen cannot resurrect the rejected batch.
  const rename = fs.renameSync;
  let historyFailureInjected = false;
  try {
    fs.renameSync = ((from, to) => {
      if (String(to) === sqlitePath && !historyFailureInjected) {
        historyFailureInjected = true;
        throw Object.assign(new Error('Controlled history finalize durability failure'), { code: 'ENOSPC' });
      }
      return rename(from, to);
    }) as typeof fs.renameSync;
    const failed = await upload(header + row('Rejected History Buyer', 'REJECTED-HISTORY'), 'rejected-history.csv');
    assert.equal(failed.status, 507);
    assert.equal(failed.body.code, 'DISK_FULL');
  } finally { fs.renameSync = rename; }
  assert.equal(historyFailureInjected, true);
  assert.equal((await sql.get('SELECT COUNT(*) AS count FROM history_data WHERE importer = ?', ['Rejected History Buyer'])).count, 0);
  assert.equal((await loadAllFilesFromDb()).some(file => file.name === 'rejected-history.csv'), false);
  await sql.run('INSERT INTO history_data (file_id,file_name,importer) VALUES (?,?,?)', ['later-probe', 'later.csv', 'Later Buyer']);
  await sql.flush();
  resetDbInstanceForTests(); sql = await getDb();
  assert.equal((await sql.get('SELECT COUNT(*) AS count FROM history_data WHERE importer = ?', ['Rejected History Buyer'])).count, 0);
  assert.equal((await sql.get('SELECT COUNT(*) AS count FROM history_data WHERE importer = ?', ['Later Buyer'])).count, 1);

  // Finalization/publication failure in the primary JSON store also invokes the
  // history inverse, preserving the older authoritative records.
  let jsonFailureInjected = false;
  try {
    fs.renameSync = ((from, to) => {
      if (String(to) === jsonPath && !jsonFailureInjected) {
        jsonFailureInjected = true;
        throw Object.assign(new Error('Controlled primary finalize failure'), { code: 'ENOSPC' });
      }
      return rename(from, to);
    }) as typeof fs.renameSync;
    const failed = await upload(header + row('Rejected JSON Buyer', 'REJECTED-JSON'), 'rejected-json.csv');
    assert.equal(failed.status, 507);
  } finally { fs.renameSync = rename; }
  assert.equal(jsonFailureInjected, true);
  assert.equal((await sql.get('SELECT COUNT(*) AS count FROM history_data WHERE importer = ?', ['Rejected JSON Buyer'])).count, 0);
  assert.equal((await loadAllFilesFromDb()).some(file => file.name === 'rejected-json.csv'), false);

  // L02: two different 128-byte streams with the same published MD5 collision
  // receive different SHA-256 identities and neither can substitute the other.
  const hexA = [
    'd131dd02c5e6eec4693d9a0698aff95c2fcab58712467eab4004583eb8fb7f89',
    '55ad340609f4b30283e488832571415a085125e8f7cdc99fd91dbdf280373c5b',
    'd8823e3156348f5bae6dacd436c919c6dd53e2b487da03fd02396306d248cda0',
    'e99f33420f577ee8ce54b67080a80d1ec69821bcb6a8839396f9652b6ff72a70',
  ].join('');
  const hexB = [
    'd131dd02c5e6eec4693d9a0698aff95c2fcab50712467eab4004583eb8fb7f89',
    '55ad340609f4b30283e4888325f1415a085125e8f7cdc99fd91dbd7280373c5b',
    'd8823e3156348f5bae6dacd436c919c6dd53e23487da03fd02396306d248cda0',
    'e99f33420f577ee8ce54b67080280d1ec69821bcb6a8839396f965ab6ff72a70',
  ].join('');
  const bytesA = Buffer.from(hexA, 'hex'), bytesB = Buffer.from(hexB, 'hex');
  const md5 = (bytes: Buffer) => createHash('md5').update(bytes).digest('hex');
  assert.equal(md5(bytesA), md5(bytesB));
  assert.notEqual(computeFileHash(bytesA), computeFileHash(bytesB));
  const collisionA = await upload(bytesA, 'collision-a.txt');
  const collisionB = await upload(bytesB, 'collision-b.txt');
  assert.equal(collisionA.status, 201); assert.equal(collisionB.status, 201);
  assert.notEqual(collisionA.body.id, collisionB.body.id);
  await saveFileToDb({ id: 'legacy-md5', name: 'legacy-md5.txt', file_type: 'Unknown', size: bytesA.length,
    upload_time: new Date().toISOString(), columns: [], rows: [], summary: {} as any }, md5(bytesA), 'test');
  assert.equal(await findFileByHash(md5(bytesA)), null, 'legacy MD5 alone is never duplicate authority');

  console.log('PASS H03/H04/H06/H19/M30/L02 concurrent admission, rollback/reopen, aliases, metadata, lightweight responses and collision resistance');
} catch (error) { failure = error; }
finally {
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  await sql.flush(); resetDbInstanceForTests();
  for (const key of environmentKeys) {
    const value = originalEnvironment[key];
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
  assert.equal(path.dirname(fs.realpathSync(root)), fs.realpathSync(os.tmpdir()));
  fs.rmSync(root, { recursive: true, force: true });
}
if (failure) { console.error(failure); process.exitCode = 1; }
