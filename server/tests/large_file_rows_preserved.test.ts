import fs from 'fs';
import { saveFileToDb, loadAllFilesFromDb, computeFileHash } from '../sqlite_persistence';
import { getJsonPersistencePath } from '../db_paths';
import { db } from '../db';
import { computeSummary } from '../summary';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Large File Rows Preserved Test Failed: ${msg}`);
  }
}

async function runLargeFileRowsPreservedTest() {
  console.log('--- RUNNING LARGE FILE ROWS PRESERVED (PERSISTENCE ROUND-TRIP) TEST ---');

  const TOTAL_ROWS = 250;
  const fileId = `file-rows-preserved-${Date.now()}`;
  const fileName = 'test_rows_preserved.csv';

  const header = 'BE_DATE,ITEM,IMPORTER,EXPORTER,TOT_FC,AGENT_NAME,BE_LINK,COUNTRY,HS_CODE\n';
  const csvLines: string[] = [header];
  for (let i = 1; i <= TOTAL_ROWS; i++) {
    csvLines.push(`2024-05-${String((i % 28) + 1).padStart(2, '0')},"Item ${i}","Importer Ltd ${i % 10}","Exporter Corp ${i % 7}",${1500 + i},"Agent ${i % 5}","BE_LINK_${i}","Pakistan","3004.90"`);
  }
  const buffer = Buffer.from(csvLines.join('\n'), 'utf-8');

  const parsed = {
    file_type: 'CSV' as const,
    columns: ['BE_DATE', 'ITEM', 'IMPORTER', 'EXPORTER', 'TOT_FC', 'AGENT_NAME', 'BE_LINK', 'COUNTRY', 'HS_CODE'],
    rows: [] as any[],
  };
  for (let i = 1; i <= TOTAL_ROWS; i++) {
    parsed.rows.push({
      be_date: `2024-05-${String((i % 28) + 1).padStart(2, '0')}`,
      item: `Item ${i}`,
      importer: `Importer Ltd ${i % 10}`,
      exporter: `Exporter Corp ${i % 7}`,
      tot_fc: 1500 + i,
      agent_name: `Agent ${i % 5}`,
      be_link: `BE_LINK_${i}`,
      country: 'Pakistan',
      hs_code: '3004.90',
      'Total Value (USD)': 1500 + i,
    });
  }
  assert(parsed.rows.length === TOTAL_ROWS, `Parsed rows must equal ${TOTAL_ROWS}`);

  const summary = computeSummary(parsed.columns, parsed.rows);
  const fileRecord = {
    id: fileId,
    name: fileName,
    file_type: parsed.file_type,
    size: buffer.length,
    upload_time: new Date().toISOString(),
    columns: parsed.columns,
    rows: parsed.rows,
    summary,
  };

  // Step 1: In-memory store must keep ALL rows (no thinning)
  db.files.set(fileId, fileRecord);
  assert(db.files.get(fileId)!.rows.length === TOTAL_ROWS, 'In-memory rows must NOT be thinned for >50-row files');

  const DB_FILE_PATH = getJsonPersistencePath();

  try {
    // Step 2: Persist to disk, then reload via loadAllFilesFromDb (server restart path)
    const fileHash = computeFileHash(buffer);
    await saveFileToDb(fileRecord, fileHash, 'test');

    const reloaded = await loadAllFilesFromDb();
    const found = reloaded.find((f) => f.id === fileId);
    assert(!!found, 'Reloaded file must exist after persistence round-trip');
    assert(found!.rows.length === TOTAL_ROWS, `Reloaded rows must be ${TOTAL_ROWS}, got ${found!.rows.length}`);

    const firstReloaded = found!.rows[0];
    assert(!!firstReloaded && (firstReloaded.item || firstReloaded.ITEM), 'Reloaded rows must contain data (not empty objects)');

    console.log(`   In-memory rows: ${db.files.get(fileId)!.rows.length}`);
    console.log(`   Reloaded rows:  ${found!.rows.length}`);
    console.log('   ✅ >50-row file survives persistence round-trip with FULL dataset intact.');

    // Step 3: Also confirm the on-disk record holds full rows (not thinned)
    const raw = fs.readFileSync(DB_FILE_PATH, 'utf-8');
    const diskRecords = JSON.parse(raw);
    const diskRecord = diskRecords.find((r: any) => r.id === fileId);
    assert(!!diskRecord, 'Disk record must exist');
    const diskRows = diskRecord.file_data?.rows || [];
    assert(diskRows.length === TOTAL_ROWS, `Disk file_data.rows must be ${TOTAL_ROWS}, got ${diskRows.length}`);
    console.log('   ✅ On-disk file_data.rows holds the full dataset.');
  } finally {
    // Cleanup: remove the test record from disk persistence and memory
    try {
      const raw = fs.readFileSync(DB_FILE_PATH, 'utf-8');
      const diskRecords = JSON.parse(raw);
      const remaining = diskRecords.filter((r: any) => r.id !== fileId);
      fs.writeFileSync(DB_FILE_PATH, JSON.stringify(remaining, null, 2), 'utf-8');
    } catch (cleanupErr) {
      console.warn('Cleanup warning:', cleanupErr);
    }
    db.files.delete(fileId);
  }

  console.log('\n✅ LARGE FILE ROWS PRESERVED TEST PASSED 100%.');
}

runLargeFileRowsPreservedTest().catch((err) => {
  console.error('❌ Large file rows preserved test failed:', err);
  process.exit(1);
});
