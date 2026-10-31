// Synthetic export regression: 17k trade rows and thousands of generated contacts.
// Five repeat cycles and broad process ceilings are a smoke guard, not proof of
// leak freedom, target-device performance or real customer-data correctness.

import * as assert from 'assert';
import fs from 'fs';
import path from 'path';
import os from 'os';
import JSZip from 'jszip';
import ExcelJS from 'exceljs';
import { db } from '../db';
import { getDb, flushInitializedDatabase, resetDbInstanceForTests } from '../sqlite';
import { parseFile } from '../parsers';
import { computeSummary } from '../summary';
import { processExportRequest } from '../export_manager';
import { extractPdfText, pdfTextContains } from './pdf_inspect';

const SCRATCH = fs.mkdtempSync(path.join(os.tmpdir(), 'edgeview-export-memory-'));
process.env.EDGEVIEW_TEST_MODE = '1';
process.env.EDGEVIEW_TEST_DB_DIR = SCRATCH;
process.env.EDGEVIEW_SQLITE_DB = path.join(SCRATCH, 'operations.db');
process.env.EDGEVIEW_JSON_DB = path.join(SCRATCH, 'dataset.json');

const TOTAL_RAW_ROWS = 17432;
const FILE_ID = 'mem-regress-17k.csv';

function mem(label: string) {
  const m = process.memoryUsage();
  const str = `[MEM] ${label}: RSS=${Math.round(m.rss / 1024 / 1024)}MB heapUsed=${Math.round(m.heapUsed / 1024 / 1024)}MB heapTotal=${Math.round(m.heapTotal / 1024 / 1024)}MB ext=${Math.round(m.external / 1024 / 1024)}MB arr=${Math.round((m.arrayBuffers || 0) / 1024 / 1024)}MB`;
  console.log(str);
  return {
    rss: m.rss,
    heapUsed: m.heapUsed,
    heapTotal: m.heapTotal,
    external: m.external,
    arrayBuffers: m.arrayBuffers || 0,
  };
}

// Seed db.files + sqlite history_data with the same 17,432-row realistic trade
// dataset used by large_file_stress_test, so buildTradeIndex has real work.
async function seed17kFile() {
  const header = 'BE_DATE,ITEM,IMPORTER,EXPORTER,TOT_FC,AGENT_NAME,BE_LINK,COUNTRY,HS_CODE\n';
  const csvLines: string[] = [header];
  for (let i = 1; i <= TOTAL_RAW_ROWS; i++) {
    const shipmentNum = Math.floor((i - 1) / 2.49) + 1;
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
  const buffer = Buffer.from(csvLines.join('\n'), 'utf-8');

  const sqlDb = await getDb();
  await sqlDb.run('DELETE FROM history_data WHERE file_name = ?', [FILE_ID]);

  const parsed = await parseFile(FILE_ID, buffer);
  const summary = computeSummary(parsed.columns, parsed.rows);
  db.files.set(FILE_ID, {
    id: FILE_ID,
    name: FILE_ID,
    file_type: parsed.file_type,
    size: buffer.length,
    upload_time: new Date().toISOString(),
    columns: parsed.columns,
    rows: parsed.rows,
    summary,
  });

  const stmt = await sqlDb.prepare(
    `INSERT INTO history_data (
      be_link, be_date, hs_code, item, importer, exporter, country, tot_fc, qty, unit, agent_name, file_name
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
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
      FILE_ID
    );
  }
  await stmt.finalize();
}

async function cleanupSeed() {
  try {
    db.files.delete(FILE_ID);
  } catch {
    /* ignore */
  }
  try {
    const sqlDb = await getDb();
    await sqlDb.run('DELETE FROM history_data WHERE file_name = ?', [FILE_ID]);
  } catch {
    /* ignore */
  }
}

// Build a realistic contacts array (~3,500 companies, matching the real
// companies.json shape plus enrichment-style arrays).
function buildRealisticContacts(count: number): any[] {
  const countries = ['Pakistan', 'United States', 'United Kingdom', 'Germany', 'Sweden', 'UAE', 'Saudi Arabia', 'India', 'China', 'Turkey', 'Egypt', 'Sri Lanka'];
  const out: any[] = [];
  for (let i = 0; i < count; i++) {
    const company = `Real Pharma Company ${i} (Pvt) Ltd`;
    const country = countries[i % countries.length];
    const person1 = { name: `Dr. Person A ${i}`, designation: 'CEO', department: 'Executive' };
    const person2 = { name: `Ms. Person B ${i}`, designation: 'Supply Chain Head', department: 'Procurement' };
    out.push({
      id: `comp-mem-${i}`,
      company_name: company,
      type: i % 2 === 0 ? 'Importer' : 'Exporter',
      country,
      ceo: `CEO Name ${i}`,
      email: `info@company${i}.example.com`,
      phone: `+92-21-555-${String(i % 10000).padStart(4, '0')}`,
      whatsapp: `+92-300-555-${String(i % 10000).padStart(4, '0')}`,
      linkedin: `https://linkedin.com/company-${i}`,
      website: `https://company${i}.example.com`,
      address: `Plot ${i}, SITE Industrial Area, Karachi`,
      emails_list: [`info@company${i}.example.com`, `sales@company${i}.example.com`],
      phones_list: [`+92-21-555-${String(i % 10000).padStart(4, '0')}`, `+92-300-555-${String((i + 1) % 10000).padStart(4, '0')}`],
      contact_persons: [person1],
      decision_makers: [person2],
      addresses: [{ address: `Plot ${i}, SITE Industrial Area, Karachi`, type: 'Head Office' }],
      socials: [{ platform: 'LinkedIn', url: `https://linkedin.com/company-${i}` }],
      sources: [{ url: `https://company${i}.example.com/about`, title: 'Company Profile' }],
    });
  }
  return out;
}

function assertBuffer(buf: Buffer | string, minLen: number, label: string): Buffer {
  assert.ok(Buffer.isBuffer(buf), `${label}: expected Buffer`);
  assert.ok(buf.length > minLen, `${label}: expected length > ${minLen}, got ${buf.length}`);
  return buf as Buffer;
}

async function validateCsv(buf: Buffer | string) {
  const text = typeof buf === 'string' ? buf : buf.toString('utf8');
  assert.ok(text.startsWith('\uFEFF'), 'CSV missing BOM');
  const lines = text.replace(/^\uFEFF/, '').split('\r\n').filter(Boolean);
  assert.ok(lines.length >= 2, 'CSV has no data rows');
  assert.ok(lines[0].includes('S.No') && lines[0].includes('Importer Name'), 'CSV wrong headers');
  return lines.length - 1;
}

async function validateXlsx(buf: Buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as any);
  assert.ok(wb.worksheets.length >= 1, 'XLSX has no sheets');
  const ws = wb.worksheets[0];
  assert.ok(ws.actualRowCount >= 2, 'XLSX has no data rows');
  return ws.actualRowCount - 1;
}

async function validateDocx(buf: Buffer) {
  const zip = await JSZip.loadAsync(buf);
  assert.ok(zip.file('[Content_Types].xml'), 'DOCX missing [Content_Types].xml');
  const docXml = await zip.file('word/document.xml')!.async('string');
  assert.ok(docXml.includes('EDGEVIEW'), 'DOCX missing EDGEVIEW title');
  assert.ok(docXml.includes('LIST OF IMPORTERS'), 'DOCX missing title');
  return (docXml.match(/<w:tr[ >]/g) || []).length;
}

async function validatePdf(buf: Buffer) {
  assert.ok(buf.subarray(0, 5).toString('latin1') === '%PDF-', 'PDF missing header');
  const text = extractPdfText(buf);
  assert.ok(pdfTextContains(text, 'LIST OF IMPORTERS'), 'PDF missing title');
  return 1;
}

async function measurePeakDuringExport(promise: Promise<any>): Promise<{ peak: any; result: any }> {
  let peak = { rss: 0, heapUsed: 0, external: 0, arrayBuffers: 0 };
  let done = false;
  const poll = setInterval(() => {
    const m = process.memoryUsage();
    if (m.rss > peak.rss) peak.rss = m.rss;
    if (m.heapUsed > peak.heapUsed) peak.heapUsed = m.heapUsed;
    if (m.external > peak.external) peak.external = m.external;
    if ((m.arrayBuffers || 0) > peak.arrayBuffers) peak.arrayBuffers = m.arrayBuffers || 0;
  }, 20);
  const result = await promise;
  clearInterval(poll);
  return { peak, result };
}

async function main() {
  console.log('--- EXPORT MEMORY REGRESSION (real-world scale) ---');
  await seed17kFile();

  const CONTACT_COUNT = 3500;
  const contacts = buildRealisticContacts(CONTACT_COUNT);
  console.log(`Contacts in payload: ${contacts.length}; trade history rows: ${TOTAL_RAW_ROWS}`);

  const payloadBase: any = {
    dataset: 'contacts',
    title: 'Real World Contact Directory',
    records: contacts,
    selectedRows: [],
    report_type: 'importer',
    filenamePrefix: 'EdgeView_MemRegress',
  };

  const results: Record<string, { before: any; peak: any; after: any }> = {};
  const baseline = mem('baseline (post-seed)');

  // 1. CSV
  let b = mem('before csv');
  const { peak: peakCsv, result: csv } = await measurePeakDuringExport(processExportRequest({ ...payloadBase, format: 'csv' }));
  const csvRows = await validateCsv(csv.buffer);
  const csvLen = typeof csv.buffer === 'string' ? (csv.buffer as string).length : (csv.buffer as Buffer).length;
  let a = mem('after csv');
  results.csv = { before: b, peak: peakCsv, after: a };
  console.log(`CSV: ${csvRows} data rows, ${csvLen} bytes`);

  // 2. XLSX
  b = mem('before xlsx');
  const { peak: peakXlsx, result: xlsx } = await measurePeakDuringExport(processExportRequest({ ...payloadBase, format: 'xlsx' }));
  const xlsxRows = await validateXlsx(assertBuffer(xlsx.buffer, 1000, 'XLSX'));
  a = mem('after xlsx');
  results.xlsx = { before: b, peak: peakXlsx, after: a };
  console.log(`XLSX: ${xlsxRows} data rows, ${(xlsx.buffer as Buffer).length} bytes`);

  // 3. DOCX
  b = mem('before docx');
  const { peak: peakDocx, result: docx } = await measurePeakDuringExport(processExportRequest({ ...payloadBase, format: 'docx' }));
  const docxRows = await validateDocx(assertBuffer(docx.buffer, 5000, 'DOCX'));
  a = mem('after docx');
  results.docx = { before: b, peak: peakDocx, after: a };
  console.log(`DOCX: ${docxRows} table rows, ${(docx.buffer as Buffer).length} bytes`);

  // 4. PDF
  b = mem('before pdf');
  const { peak: peakPdf, result: pdf } = await measurePeakDuringExport(processExportRequest({ ...payloadBase, format: 'pdf' }));
  await validatePdf(assertBuffer(pdf.buffer, 2000, 'PDF'));
  a = mem('after pdf');
  results.pdf = { before: b, peak: peakPdf, after: a };
  console.log(`PDF: ${(pdf.buffer as Buffer).length} bytes`);

  // 5. ALL (single role)
  b = mem('before all');
  const { peak: peakAll, result: all } = await measurePeakDuringExport(processExportRequest({ ...payloadBase, format: 'all' }));
  const allZip = await JSZip.loadAsync(assertBuffer(all.buffer, 1000, 'ALL ZIP'));
  const names = Object.keys(allZip.files);
  for (const n of names.filter((x) => x.endsWith('.csv'))) {
    const cb = await allZip.file(n)!.async('nodebuffer');
    await validateCsv(cb);
  }
  for (const n of names.filter((x) => x.endsWith('.xlsx'))) {
    const xb = await allZip.file(n)!.async('nodebuffer');
    await validateXlsx(xb);
  }
  for (const n of names.filter((x) => x.endsWith('.docx'))) {
    const dbuf = await allZip.file(n)!.async('nodebuffer');
    await validateDocx(dbuf);
  }
  for (const n of names.filter((x) => x.endsWith('.pdf'))) {
    const pbuf = await allZip.file(n)!.async('nodebuffer');
    await validatePdf(pbuf);
  }
  a = mem('after all');
  results.all = { before: b, peak: peakAll, after: a };
  console.log(`ALL ZIP: ${names.length} entries, ${(all.buffer as Buffer).length} bytes`);

  // 6. ALL × 5 repeat (short allocation smoke, not a long leak test)
  const repeatRss: number[] = [];
  for (let i = 1; i <= 5; i++) {
    const before = process.memoryUsage().rss;
    const res = await processExportRequest({ ...payloadBase, format: 'all' });
    assertBuffer(res.buffer, 1000, `ALL repeat ${i}`);
    await JSZip.loadAsync(res.buffer as Buffer);
    const after = process.memoryUsage().rss;
    repeatRss.push(after);
    console.log(`ALL repeat ${i}: RSS before=${Math.round(before / 1024 / 1024)}MB after=${Math.round(after / 1024 / 1024)}MB`);
    fs.writeFileSync(path.join(SCRATCH, `all_repeat_${i}.zip`), res.buffer as Buffer);
  }

  fs.writeFileSync(path.join(SCRATCH, 'memory_export_regression_results.json'), JSON.stringify({
    baseline,
    results,
    repeatRss,
    contactCount: CONTACT_COUNT,
    tradeRows: TOTAL_RAW_ROWS,
  }, null, 2));

  // Assertions
  const MB = 1024 * 1024;
  const peakAllRss = results.all.peak.rss;
  const maxRepeat = Math.max(...repeatRss);
  const minRepeat = Math.min(...repeatRss);
  const drift = maxRepeat - minRepeat;

  console.log('\n--- ASSERTIONS ---');
  console.log(`ALL peak RSS: ${Math.round(peakAllRss / MB)}MB`);
  console.log(`ALL repeats RSS spread: ${Math.round(drift / MB)}MB (max ${Math.round(maxRepeat / MB)}MB)`);

  assert.ok(peakAllRss < 4000 * MB, `ALL peak RSS must stay < 4GB, got ${Math.round(peakAllRss / MB)}MB`);
  assert.ok(drift < 400 * MB, `Repeated ALL exports must not drift > 400MB, got ${Math.round(drift / MB)}MB`);
  assert.ok(repeatRss[repeatRss.length - 1] < 4000 * MB, `Final repeat RSS must stay < 4GB`);
  assert.ok(results.csv.before.rss > 0, 'csv before must be measurable');
  assert.ok(db.files.has(FILE_ID), `seeded file ${FILE_ID} must be present`);

  console.log('\n✅ EXPORT MEMORY REGRESSION PASSED');
}

main().catch(async (err) => {
  console.error('❌ Export memory regression failed:', err);
  process.exitCode = 1;
}).finally(async () => {
  await cleanupSeed();
  await flushInitializedDatabase();
  resetDbInstanceForTests();
  assert.strictEqual(path.dirname(fs.realpathSync(SCRATCH)), fs.realpathSync(os.tmpdir()), 'refuse cleanup outside owned temporary root');
  fs.rmSync(SCRATCH, { recursive: true, force: true });
});
