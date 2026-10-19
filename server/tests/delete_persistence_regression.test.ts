import { db } from '../db';
import { loadAllFilesFromDb, deleteFileFromHistory, saveFileToDb } from '../sqlite_persistence';
import { computeFileHash } from '../sqlite_persistence';
import { computeSummary } from '../summary';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Delete & File Lookup Regression Test Failed: ${msg}`);
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function runDeletePersistenceRegressionTest() {
  console.log('--- RUNNING DELETE PERSISTENCE & FILE LOOKUP REGRESSION TEST ---');

  const fileId = `file-delreg-${Date.now()}`;
  const fileRecord = {
    id: fileId,
    name: 'delete_regression_test.csv',
    file_type: 'CSV' as const,
    size: 100,
    upload_time: new Date().toISOString(),
    columns: ['Importer', 'Exporter', 'Item', 'Country'],
    rows: [
      { Importer: 'ImpA', Exporter: 'ExpA', Item: 'Drug A', Country: 'Pakistan' },
      { Importer: 'ImpB', Exporter: 'ExpB', Item: 'Drug B', Country: 'Pakistan' },
    ],
    summary: computeSummary(
      ['Importer', 'Exporter', 'Item', 'Country'],
      [
        { Importer: 'ImpA', Exporter: 'ExpA', Item: 'Drug A', Country: 'Pakistan' },
        { Importer: 'ImpB', Exporter: 'ExpB', Item: 'Drug B', Country: 'Pakistan' },
      ]
    ),
  };

  // Phase 1: Save to disk DB, load back, verify present
  const hash = computeFileHash(Buffer.from(JSON.stringify(fileRecord.rows)));
  await saveFileToDb(fileRecord as any, hash, 'real');
  await sleep(150);

  let loaded = await loadAllFilesFromDb();
  assert(loaded.some((f) => f.id === fileId), 'Saved file must be loadable from disk DB');
  console.log(`   ✅ [Phase 1] File persisted to disk DB (found ${loaded.length} total records).`);

  // Phase 2: getFileById returns undefined for unknown / typo'd ids (no wrong-file 200)
  const unknown = db.getFileById('file-does-not-exist-xyz');
  assert(unknown === undefined, 'Unknown id must return undefined (so routes 404), got: ' + JSON.stringify(unknown?.name));
  console.log('   ✅ [Phase 2] getFileById returns undefined for unknown id (no wrong-file fallback).');

  const deletedSampleLookup = db.getFileById('file-sample-csv-1');
  console.log(`   ℹ️  sample lookup (present in seed) -> ${deletedSampleLookup?.name || 'undefined'}`);
  assert(deletedSampleLookup !== undefined, 'Existing seeded sample should still resolve');

  // Phase 3: deleteFileFromHistory removes the record from disk DB
  const deleted = await deleteFileFromHistory(fileId);
  assert(deleted === true, 'deleteFileFromHistory must return true when a record was removed');
  await sleep(150);

  loaded = await loadAllFilesFromDb();
  assert(!loaded.some((f) => f.id === fileId), 'Deleted file must NOT be present in disk DB after delete');
  console.log(`   ✅ [Phase 3] deleteFileFromHistory removed record from disk DB (${loaded.length} records remain).`);

  // Phase 4: deleting an already-deleted id returns false and is a no-op
  const deletedAgain = await deleteFileFromHistory(fileId);
  assert(deletedAgain === false, 'Second delete of same id must return false (no-op)');
  console.log('   ✅ [Phase 4] Idempotent delete confirmed (second delete is a no-op).');

  // Cleanup: in-memory only
  db.files.delete(fileId);
  console.log('\n✅ DELETE PERSISTENCE & FILE LOOKUP REGRESSION PASSED 100%.');
}

runDeletePersistenceRegressionTest().catch((err) => {
  console.error('❌ Delete persistence regression test failed:', err);
  process.exit(1);
});