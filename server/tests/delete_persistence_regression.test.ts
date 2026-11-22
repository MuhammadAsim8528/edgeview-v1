import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'edgeview-delete-persistence-'));
process.env.EDGEVIEW_TEST_MODE = '1';
process.env.EDGEVIEW_TEST_DB_DIR = scratch;
process.env.EDGEVIEW_SQLITE_DB = path.join(scratch, 'operational.db');
const jsonPath = path.join(scratch, 'dataset.json'), configPath = path.join(scratch, 'config.json');
process.env.EDGEVIEW_JSON_DB = jsonPath;
process.env.EDGEVIEW_CONFIG = configPath;
process.env.EDGEVIEW_V1_DATA_DIR = path.join(scratch, 'runs');
process.env.EDGEVIEW_MONITORING_ENABLED = '0';
fs.writeFileSync(jsonPath, '[]');
fs.writeFileSync(configPath, '{}');

// Runtime paths must be selected before any application module is imported.
const { db } = await import('../db');
const { loadAllFilesFromDb, deleteFileFromHistory, saveFileToDb, computeFileHash } = await import('../sqlite_persistence');
const { flushInitializedDatabase, resetDbInstanceForTests } = await import('../sqlite');
const { computeSummary } = await import('../summary');

async function runDeletePersistenceRegressionTest() {
  const fileId = `file-delreg-${Date.now()}`;
  const rows = [
    { Importer: 'Synthetic ImpA', Exporter: 'Synthetic ExpA', Item: 'Drug A', Country: 'Pakistan' },
    { Importer: 'Synthetic ImpB', Exporter: 'Synthetic ExpB', Item: 'Drug B', Country: 'Pakistan' },
  ];
  const fileRecord = {
    id: fileId,
    name: 'delete_regression_test.csv',
    file_type: 'CSV' as const,
    size: 100,
    upload_time: new Date().toISOString(),
    columns: ['Importer', 'Exporter', 'Item', 'Country'],
    rows,
    summary: computeSummary(['Importer', 'Exporter', 'Item', 'Country'], rows),
  };
  try {
    const hash = computeFileHash(Buffer.from(JSON.stringify(fileRecord.rows)));
    await saveFileToDb(fileRecord as any, hash, 'real');
    let loaded = await loadAllFilesFromDb();
    assert.ok(loaded.some(file => file.id === fileId), 'owned saved file must be loadable from the isolated DB');

    db.files.set(fileId, fileRecord as any);
    assert.equal(db.getFileById(fileId)?.id, fileId, 'the owned known-id control must resolve independently of sample data');
    assert.equal(db.getFileById('file-does-not-exist-xyz'), undefined, 'unknown id must not fall back to another file');

    const deleted = await deleteFileFromHistory(fileId);
    assert.equal(deleted, true, 'deleteFileFromHistory must report removal of the owned record');
    loaded = await loadAllFilesFromDb();
    assert.equal(loaded.some(file => file.id === fileId), false, 'deleted file must be absent from the isolated DB');
    assert.equal(await deleteFileFromHistory(fileId), false, 'second delete must be a no-op');
    console.log('PASS isolated delete persistence and known/unknown file lookup; no seeded sample assumption');
  } finally {
    db.files.delete(fileId);
  }
}

runDeletePersistenceRegressionTest().catch(error => {
  console.error('Delete persistence regression failed:', error instanceof Error ? error.message : 'unknown failure');
  process.exitCode = 1;
}).finally(async () => {
  await flushInitializedDatabase();
  resetDbInstanceForTests();
  assert.equal(path.dirname(fs.realpathSync(scratch)), fs.realpathSync(os.tmpdir()));
  fs.rmSync(scratch, { recursive: true, force: true });
});
