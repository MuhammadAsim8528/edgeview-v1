// Production Data Integrity & Test Isolation suite.
// Proves that test-process persistence is redirected to an isolated store,
// that the production database is never touched by test writes (hard guard),
// that synthetic names are deterministically detectable, and that clean
// fixtures export without synthetic tokens.

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { isTestProcess, getSqlitePath, getJsonPersistencePath } from '../db_paths';
import { getDb } from '../sqlite';
import { saveFileToDb, computeFileHash, loadAllFilesFromDb, deleteFileFromHistory } from '../sqlite_persistence';
import { db } from '../db';
import { computeSummary } from '../summary';
import { scanCompanyNames } from '../data_provenance';
import { processExportRequest } from '../export_manager';

const PROD_DB = path.join(process.cwd(), 'edgeview.db');
const PROD_JSON = path.join(process.cwd(), 'edgeview_db.json');

function sha256(p: string): string | null {
  if (!fs.existsSync(p)) return null;
  return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
}

async function main() {
  console.log('--- PRODUCTION DATA INTEGRITY & TEST ISOLATION SUITE ---');

  assert(isTestProcess(), 'running under server/tests/ must be detected as a test process');

  const sqlitePath = getSqlitePath();
  const jsonPath = getJsonPersistencePath();
  assert(sqlitePath !== PROD_DB, `isolated sqlite path must not equal production (${sqlitePath})`);
  assert(jsonPath !== PROD_JSON, `isolated json path must not equal production (${jsonPath})`);
  assert(sqlitePath.includes('.test-cache'), `sqlite path must live in .test-cache, got ${sqlitePath}`);
  assert(jsonPath.includes('.test-cache'), `json path must live in .test-cache, got ${jsonPath}`);
  console.log(`   Isolated sqlite: ${sqlitePath}`);
  console.log(`   Isolated json:   ${jsonPath}`);

  const prevSql = process.env.EDGEVIEW_SQLITE_DB;
  process.env.EDGEVIEW_SQLITE_DB = PROD_DB;
  let threwSql = false;
  try {
    getSqlitePath();
  } catch (e: any) {
    threwSql = /REFUSING TEST WRITE TO PRODUCTION DATABASE/.test(String(e.message));
  }
  if (prevSql === undefined) delete process.env.EDGEVIEW_SQLITE_DB;
  else process.env.EDGEVIEW_SQLITE_DB = prevSql;
  assert(threwSql, 'overriding sqlite path to production must throw REFUSING TEST WRITE TO PRODUCTION DATABASE');

  const prevJson = process.env.EDGEVIEW_JSON_DB;
  process.env.EDGEVIEW_JSON_DB = PROD_JSON;
  let threwJson = false;
  try {
    getJsonPersistencePath();
  } catch (e: any) {
    threwJson = /REFUSING TEST WRITE TO PRODUCTION JSON PERSISTENCE/.test(String(e.message));
  }
  if (prevJson === undefined) delete process.env.EDGEVIEW_JSON_DB;
  else process.env.EDGEVIEW_JSON_DB = prevJson;
  assert(threwJson, 'overriding json path to production must throw REFUSING TEST WRITE TO PRODUCTION JSON PERSISTENCE');

  const dbBefore = sha256(PROD_DB);
  const jsonBefore = sha256(PROD_JSON);

  const sqlDb = await getDb();
  const syntheticCompany = `AcadGuard Test Company ${Date.now()}`;
  await sqlDb.run('INSERT INTO contact_cache (company_name, source) VALUES (?, ?)', [syntheticCompany, 'api']);
  const row = await sqlDb.get('SELECT company_name FROM contact_cache WHERE company_name = ?', [syntheticCompany]);
  assert(!!row, 'isolated contact_cache write must be visible in the test db');
  await sqlDb.run('DELETE FROM contact_cache WHERE company_name = ?', [syntheticCompany]);

  const buf = Buffer.from('importer,exporter\nIsolated Importer Test Co,X\n');
  const rec = {
    id: `file-isolation-${Date.now()}`,
    name: 'isolation_probe.csv',
    file_type: 'CSV' as const,
    size: buf.length,
    upload_time: new Date().toISOString(),
    columns: ['importer', 'exporter'],
    rows: [{ importer: 'Isolated Importer Test Co', exporter: 'X' }],
    summary: computeSummary(['importer', 'exporter'], [{ importer: 'Isolated Importer Test Co', exporter: 'X' }]),
  };
  await saveFileToDb(rec, computeFileHash(buf), 'real');
  const reloaded = await loadAllFilesFromDb();
  assert(reloaded.some((f) => f.id === rec.id), 'isolated saveFileToDb record must reload from the test json');
  await deleteFileFromHistory(rec.id);
  db.files.delete(rec.id);

  const dbAfter = sha256(PROD_DB);
  const jsonAfter = sha256(PROD_JSON);
  assert(dbBefore === dbAfter, 'production edgeview.db must remain byte-identical after test writes');
  assert(jsonBefore === jsonAfter, 'production edgeview_db.json must remain byte-identical after test writes');
  console.log('   Production edgeview.db / edgeview_db.json unchanged by test writes ✓');

  const hits = scanCompanyNames(['IMPORTER4666', 'EXPORTER123', 'TEST_IMPORTER_1', 'Real Pharma Ltd', 'Global Health Importers Ltd 7']);
  const flagged = new Set(hits.map((h) => h.name));
  assert(flagged.has('IMPORTER4666'), 'IMPORTER4666 must be flagged');
  assert(flagged.has('EXPORTER123'), 'EXPORTER123 must be flagged');
  assert(flagged.has('TEST_IMPORTER_1'), 'TEST_IMPORTER_1 must be flagged');
  assert(flagged.has('Global Health Importers Ltd 7'), 'mem-regress synthetic company must be flagged');
  assert(!flagged.has('Real Pharma Ltd'), 'Real Pharma Ltd must NOT be flagged');
  console.log('   Provenance scanner flags synthetic names, leaves real names alone ✓');

  const contacts = [
    { id: 'c1', company_name: 'Emerchemie NB Ceylon Limited', type: 'Importer', country: 'Sri Lanka' },
    { id: 'c2', company_name: 'FEROZSONS LABORATRIES LIMITED', type: 'Exporter', country: 'Pakistan' },
    { id: 'c3', company_name: 'Novartis Pharma AG', type: 'Importer', country: 'Switzerland' },
  ];
  const csv = await processExportRequest({
    dataset: 'contacts',
    title: 'Purity',
    records: contacts,
    selectedRows: [],
    report_type: 'importer',
    filenamePrefix: 'EdgeView_Purity',
    format: 'csv',
  });
  const text = typeof csv.buffer === 'string' ? csv.buffer : csv.buffer.toString('utf8');
  const syntheticTokenPatterns = [
    /\bIMPORTER\s*[0-9]{2,}\b/i,
    /\bEXPORTER\s*[0-9]{2,}\b/i,
    /\bTEST_\w+/i,
    /AcadGuard/i,
    /mem-regress/i,
    /Global Health Importers/i,
  ];
  for (const re of syntheticTokenPatterns) {
    assert(!re.test(text), `clean export must not contain synthetic token matching ${re}`);
  }
  assert(text.includes('Emerchemie NB Ceylon Limited'), 'clean export must contain the real contact');
  console.log('   Clean-fixture CSV export contains no synthetic tokens ✓');

  console.log('\n✅ PRODUCTION DATA INTEGRITY & TEST ISOLATION SUITE PASSED');
}

main().catch((err) => {
  console.error('❌ Production data integrity suite failed:', err);
  process.exit(1);
});