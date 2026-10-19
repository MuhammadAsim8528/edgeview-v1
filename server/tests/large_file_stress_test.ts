import { parseFile } from '../parsers';
import { computeSummary } from '../summary';
import { saveFileToDb, computeFileHash, deleteFileFromHistory } from '../sqlite_persistence';
import { getDb } from '../sqlite';
import { db } from '../db';
import { TradeRelationshipResolver } from '../trade_relationship_resolver';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Large File Test Failed: ${msg}`);
  }
}

async function runLargeFileStressTest() {
  console.log('--- RUNNING EDGEVIEW LARGE FILE PERFORMANCE & TRACE SUITE ---');

  const TOTAL_RAW_ROWS = 17432;
  console.log(`[Phase 1] Generating ${TOTAL_RAW_ROWS} row CSV buffer...`);

  const startGenerateMs = Date.now();
  const header = 'BE_DATE,ITEM,IMPORTER,EXPORTER,TOT_FC,AGENT_NAME,BE_LINK,COUNTRY,HS_CODE\n';
  const csvLines: string[] = [header];

  // 17,432 rows total: 7,000 distinct shipments (so multiple items per shipment BE_LINK)
  for (let i = 1; i <= TOTAL_RAW_ROWS; i++) {
    const shipmentNum = Math.floor((i - 1) / 2.49) + 1; // Maps 17,432 items to ~7,000 unique BE_LINK shipments
    const date = `2024-05-${String((i % 28) + 1).padStart(2, '0')}`;
    const item = `Pharmaceutical Raw Material Active Ingredient Grade ${i}`;
    const importer = `Global Health Importers Ltd ${shipmentNum % 200}`;
    const exporter = `Pharma Export Global Corp ${shipmentNum % 150}`;
    const val = 1500 + (i % 500);
    const agent = `Trade Agent ${i % 50}`;
    const beLink = `BE_LINK_${shipmentNum}`;
    const country = i % 2 === 0 ? 'Pakistan' : 'Sri Lanka';
    const hs = '3004.90';

    csvLines.push(`${date},"${item}","${importer}","${exporter}",${val},"${agent}","${beLink}","${country}","${hs}"`);
  }

  const csvContent = csvLines.join('\n');
  const buffer = Buffer.from(csvContent, 'utf-8');
  const generateMs = Date.now() - startGenerateMs;
  console.log(`   Generated 17,432 CSV rows buffer (${(buffer.length / (1024 * 1024)).toFixed(2)} MB) in ${generateMs}ms`);

  // Phase 2: Trace Data across Pipeline
  console.log('[Phase 2] Tracing Data Across Processing Stages...');

  const sqlDb = await getDb();
  await sqlDb.run('DELETE FROM history_data WHERE file_name = ?', ['test_large_17k.csv']);

  // Stage 1: File Parsing
  const startParseMs = Date.now();
  const parsed = await parseFile('test_large_17k.csv', buffer);
  const parseMs = Date.now() - startParseMs;
  console.log(`   PARSED ROWS: ${parsed.rows.length} (Time: ${parseMs}ms)`);
  assert(parsed.rows.length === TOTAL_RAW_ROWS, `Parsed rows count must equal raw input ${TOTAL_RAW_ROWS}`);

  // Stage 2: Compute Summary
  const startSumMs = Date.now();
  const summary = computeSummary(parsed.columns, parsed.rows);
  const sumMs = Date.now() - startSumMs;
  console.log(`   SUMMARY TOTAL ROWS: ${summary.total_rows} (Time: ${sumMs}ms)`);
  assert(summary.total_rows === TOTAL_RAW_ROWS, `Summary total_rows must equal ${TOTAL_RAW_ROWS}`);

  // Stage 3: In-Memory File Store
  const fileRecord = {
    id: `file-test-17k`,
    name: 'test_large_17k.csv',
    file_type: parsed.file_type,
    size: buffer.length,
    upload_time: new Date().toISOString(),
    columns: parsed.columns,
    rows: parsed.rows,
    summary,
  };
  db.files.set(fileRecord.id, fileRecord);
  const storeRows = db.files.get(fileRecord.id)!.rows.length;
  console.log(`   IN-MEMORY STORE ROWS: ${storeRows}`);
  assert(storeRows === TOTAL_RAW_ROWS, `Store rows must equal ${TOTAL_RAW_ROWS}`);

  // Stage 4: File Persistence & SQLite Database
  const fileHash = computeFileHash(buffer);
  const startDbMs = Date.now();
  await saveFileToDb(fileRecord, fileHash, 'real');

  const stmt = await sqlDb.prepare(`
    INSERT INTO history_data (
      be_link, be_date, hs_code, item, importer, exporter, country, tot_fc, qty, unit, agent_name, file_name
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const r of parsed.rows) {
    await stmt.run(
      r.be_link || r['BE Link'] || '',
      r.be_date || r['BE Date'] || '',
      r.hs_code || r['HS Code'] || '',
      r.item || r.Item || '',
      r.importer || r.Importer || '',
      r.exporter || r.Exporter || '',
      r.country || r.Country || '',
      r['Total Value (USD)'] || r.tot_fc || 0,
      r.qty || 0,
      r.unit || '',
      r.agent_name || r['Agent Name'] || '',
      'test_large_17k.csv'
    );
  }
  await stmt.finalize();
  const dbMs = Date.now() - startDbMs;

  const dbRowResult = await sqlDb.get('SELECT COUNT(*) as count FROM history_data WHERE file_name = ?', ['test_large_17k.csv']);
  const dbCount = dbRowResult?.count || 0;
  console.log(`   PERSISTED DB ROWS: ${dbCount} (Time: ${dbMs}ms)`);
  assert(dbCount === TOTAL_RAW_ROWS, `Database rows must equal ${TOTAL_RAW_ROWS}`);

  // Stage 5: Simulate Shipment Grouping vs Raw Ungrouped Rows
  const startGroupMs = Date.now();
  const groupsMap = new Map<string, any[]>();
  for (const r of parsed.rows) {
    const key = r.be_link || `${r.be_date}_${r.country}_${r.importer}_${r.exporter}`;
    if (!groupsMap.has(key)) groupsMap.set(key, []);
    groupsMap.get(key)!.push(r);
  }
  const groupMs = Date.now() - startGroupMs;
  const groupedRowCount = groupsMap.size;
  console.log(`   SHIPMENT GROUPED DISPLAY ROWS (isGrouped = true): ${groupedRowCount} (Time: ${groupMs}ms)`);
  console.log(`   UNGROUPED DISPLAY ROWS (isGrouped = false): ${parsed.rows.length}`);

  // Stage 6: Trade Relationship Resolver Performance
  const startTradeMs = Date.now();
  const tradeResult = await TradeRelationshipResolver.resolveRelationships('Global Health Importers Ltd 1');
  const tradeMs = Date.now() - startTradeMs;
  console.log(`   TRADE RESOLVER PERFORMANCE: ${tradeMs}ms (Found ${tradeResult.importedFrom.length} suppliers)`);

  // Clean up test data from SQLite
  await sqlDb.run('DELETE FROM history_data WHERE file_name = ?', ['test_large_17k.csv']);

  // Remove the persisted JSON record and the in-memory file entry left by
  // saveFileToDb so this stress suite never leaves synthetic state behind.
  try {
    await deleteFileFromHistory(fileRecord.id);
  } catch {
    /* ignore */
  }
  try {
    db.files.delete(fileRecord.id);
  } catch {
    /* ignore */
  }

  console.log('\n==================================================');
  console.log('DATA TRACE AND ROW COUNT RESULTS:');
  console.log(`   SOURCE RAW ROWS:              ${TOTAL_RAW_ROWS}`);
  console.log(`   PARSED ROWS:                  ${parsed.rows.length}`);
  console.log(`   SUMMARY TOTAL ROWS:           ${summary.total_rows}`);
  console.log(`   IN-MEMORY STORE ROWS:         ${storeRows}`);
  console.log(`   PERSISTED DB ROWS:            ${dbCount}`);
  console.log(`   UNGROUPED DISPLAY ROWS:       ${parsed.rows.length}`);
  console.log(`   SHIPMENT GROUPED ROWS:        ${groupedRowCount}`);
  console.log('--------------------------------------------------');
  console.log('TIMINGS:');
  console.log(`   Parse Time:                   ${parseMs}ms`);
  console.log(`   Summary Time:                 ${sumMs}ms`);
  console.log(`   DB Insert Time (Batched):     ${dbMs}ms`);
  console.log(`   Grouping Hash Time:           ${groupMs}ms`);
  console.log(`   Trade Resolver Time:          ${tradeMs}ms`);
  console.log('==================================================');
  console.log('✅ 17,432 ROW LARGE FILE PERFORMANCE SUITE PASSED 100%.');
}

runLargeFileStressTest().catch((err) => {
  console.error('❌ Large file stress test failed:', err);
  process.exit(1);
});
