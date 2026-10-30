import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'edgeview-json-authority-'));
const target = path.join(root, 'authority.json');
Object.assign(process.env, { EDGEVIEW_TEST_MODE: '1', EDGEVIEW_TEST_DB_DIR: root, EDGEVIEW_JSON_DB: target });
const { loadAllFilesFromDb, saveFileToDb, deleteFileFromHistory, decodePersistenceRecords } = await import('../sqlite_persistence');
const synthetic: any = { id: 'new', name: 'new.csv', file_type: 'CSV', size: 1, columns: [], rows: [], summary: {} };
const refused = (error: any) => error?.code === 'DATASET_UNAVAILABLE' && error.cause === undefined
  && !String(error.message).includes('PRIVATE') && !String(error.stack).includes('PRIVATE');
let failure: unknown;
try {
  assert.deepEqual(await loadAllFilesFromDb(), [], 'genuinely missing authority is a fresh installation');
  for (const raw of ['{"PRIVATE_CUSTOMER_RECORD":', '{"PRIVATE_CUSTOMER_RECORD":PRIVATE}', '', '   ', '{}', '[null]', '[{"file_data":{"rows":{}}}]', Buffer.from([0xff])]) {
    fs.writeFileSync(target, raw);
    const before = fs.readFileSync(target);
    await assert.rejects(loadAllFilesFromDb(), refused, 'invalid authority must not become an empty dataset');
    await assert.rejects(saveFileToDb(synthetic, 'synthetic-hash', 'test'), refused);
    await assert.rejects(deleteFileFromHistory('existing'), refused);
    assert.deepEqual(fs.readFileSync(target), before, 'read/save/delete refusal must retain original bytes at original path');
    assert.deepEqual(fs.readdirSync(root), ['authority.json'], 'reads must not rename or create recovery files');
  }
  fs.writeFileSync(target, '[]');
  assert.deepEqual(await loadAllFilesFromDb(), [], 'explicit empty authority is valid');
  const read = fs.readFileSync;
  try {
    for (const code of ['EACCES', 'ENOENT']) {
    fs.readFileSync = ((file: any, ...args: any[]) => {
      if (String(file) === target) throw Object.assign(new Error('PRIVATE_PERMISSION_ERROR'), { code });
      return (read as any)(file, ...args);
    }) as typeof fs.readFileSync;
    await assert.rejects(loadAllFilesFromDb(), refused);
    await assert.rejects(saveFileToDb(synthetic, 'synthetic-hash', 'test'), refused);
    }
  } finally { fs.readFileSync = read; }
  assert.equal(fs.readFileSync(target, 'utf8'), '[]');
  fs.unlinkSync(target); fs.mkdirSync(target);
  await assert.rejects(loadAllFilesFromDb(), refused);
  assert.equal(fs.lstatSync(target).isDirectory(), true); fs.rmdirSync(target);
  let linkMade = false;
  try { fs.symlinkSync(path.join(root, 'missing.json'), target, 'file'); linkMade = true; } catch { /* host may refuse links */ }
  if (linkMade) { await assert.rejects(loadAllFilesFromDb(), refused); fs.unlinkSync(target); }
  else console.log('SKIPPED dangling-file-link probe: host denies creation');
  fs.writeFileSync(target, '[]');
  const ordinary = decodePersistenceRecords(JSON.stringify([{ id: 'legacy', filename: '医薬品.csv', rows: [{ Importer: 'کمپنی' }], columns: ['Importer'] }]), false);
  assert.equal(ordinary[0].file_data.rows![0].Importer, 'کمپنی'); assert.equal(ordinary[0].file_name, '医薬品.csv');
  for (const invalid of [[{ id: 'same' }, { id: 'same' }], [{ id: 'partial', row_count: 10, rows: [] }], [{ id: 'bad-columns', columns: [null] }]]) {
    assert.throws(() => decodePersistenceRecords(JSON.stringify(invalid)), refused);
  }
  console.log('PASS malformed/unreadable JSON authority refuses load/save/delete with original bytes/path retained and no private error text');
} catch (error) { failure = error; }
finally { assert.equal(path.dirname(fs.realpathSync(root)), fs.realpathSync(os.tmpdir())); fs.rmSync(root, { recursive: true, force: true }); }
if (failure) { console.error(failure); process.exitCode = 1; }
