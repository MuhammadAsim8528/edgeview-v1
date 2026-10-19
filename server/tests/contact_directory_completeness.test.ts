// Directory Completeness â€” builds a full directory across 3 country sections
// (including "Not Specified" last), generates the real PDF + DOCX, and proves that
// every company, leader, source, and address makes it into BOTH artifacts â€” nothing
// dropped, clipped, or skipped. Also verifies country ordering and per-country S.No.

import * as assert from 'assert';
import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';
import { db } from '../db';
import { computeSummary } from '../summary';
import { TradeRelationshipResolver } from '../trade_relationship_resolver';
import { buildContactReport } from '../contact_report_model';
import { generatePdfReport } from '../pdf_report';
import { generateDocxReport, type ReportCompanyContact } from '../docx_report';
import { extractPdfText, pdfTextContains } from './pdf_inspect';

const SCRATCH = 'C:/Users/asimh/AppData/Local/Temp/opencode/edgeview_tests';
fs.mkdirSync(SCRATCH, { recursive: true });

function fixture(): ReportCompanyContact[] {
  const mk = (
    id: string,
    company_name: string,
    country: string,
    leader: string,
    sourceUrl: string,
    address: string
  ): ReportCompanyContact => ({
    id,
    company_name,
    country,
    ceo: leader,
    email: `${id}@example.com`,
    phone: '+1-555-000-0000',
    address,
    sources: [{ url: sourceUrl, title: `${id} source` }],
  });

  return [
    // Australia (3)
    mk('au-1', 'Brighton Medical', 'Australia', 'Alice Bright', 'https://src.com/brighton', '11 Bond St, Sydney'),
    mk('au-2', 'Coastal Pharma', 'Australia', 'Bob Shore', 'https://src.com/coastal', '22 Beach Rd, Perth'),
    mk('au-3', 'Delta Labs', 'Australia', 'Carol Delta', 'https://src.com/delta', '33 Queen St, Brisbane'),
    // Zimbabwe (2)
    mk('zw-1', 'Victoria Falls Health', 'Zimbabwe', 'David Moyo', 'https://src.com/victoria', '5 Main Rd, Victoria Falls'),
    mk('zw-2', 'Bulawayo Supplies', 'Zimbabwe', 'Eva Ncube', 'https://src.com/bulawayo', '9 Robert Mugabe Way, Bulawayo'),
    // Not Specified (1, must sort last)
    mk('ns-1', 'Omega Global', '', 'Frank Omega', 'https://src.com/omega', '101 Global Ave'),
  ];
}

async function seedTrade() {
  const columns = ['Importer', 'Exporter', 'Country', 'Item', 'Total Value (USD)'];
  const rows: Record<string, any>[] = fixture().map((c, i) => ({
    Importer: c.company_name,
    Exporter: `Partner ${i + 1}`,
    Country: c.country || 'Unknown',
    Item: 'API',
    'Total Value (USD)': String(100 * (i + 1)),
  }));
  db.files.set('completeness-trade', {
    id: 'f-completeness',
    name: 'completeness_trade.csv',
    file_type: 'CSV',
    size: 0,
    upload_time: new Date().toISOString(),
    columns,
    rows,
    summary: computeSummary(columns, rows),
  });
}

async function main() {
  await seedTrade();
  const index = await TradeRelationshipResolver.buildTradeIndex();
  const contacts = fixture();

  // ---- Model-level assertions: country ordering + per-country S.No.
  const report = await buildContactReport(contacts, 'importer', index);
  const countryNames = report.countrySections.map((s) => s.country);
  assert.deepStrictEqual(countryNames, ['Australia', 'Zimbabwe', 'Not Specified'], 'country order: Not Specified last');

  for (const section of report.countrySections) {
    const sNos = section.importers.map((imp) => imp.sNo);
    const expected = section.importers.map((_, i) => i + 1);
    assert.deepStrictEqual(sNos, expected, `S.No must reset to 1 per country (${section.country})`);
  }

  // ---- PDF assertions: every piece of content present (nothing clipped).
  const pdf = await generatePdfReport(contacts, 'importer', index);
  fs.writeFileSync(path.join(SCRATCH, 'contact_directory_completeness.pdf'), pdf);
  const pdfText = extractPdfText(pdf);
  for (const c of contacts) {
    assert.ok(pdfTextContains(pdfText, c.company_name.toUpperCase()), `PDF missing company: ${c.company_name}`);
    assert.ok(pdfTextContains(pdfText, c.ceo), `PDF missing leader: ${c.ceo}`);
    assert.ok(pdfTextContains(pdfText, c.sources![0].url), `PDF missing source: ${c.sources![0].url}`);
    assert.ok(pdfTextContains(pdfText, c.address!), `PDF missing address: ${c.address}`);
  }
  // Trade partners for every company
  for (let i = 1; i <= contacts.length; i++) {
    assert.ok(pdfTextContains(pdfText, `Partner ${i}`), `PDF missing trade partner Partner ${i}`);
  }

  // ---- DOCX assertions: full content in the Word XML.
  const docx = await generateDocxReport(contacts, 'importer', index);
  fs.writeFileSync(path.join(SCRATCH, 'contact_directory_completeness.docx'), docx);
  const zip = await JSZip.loadAsync(docx);
  const xml = await zip.file('word/document.xml')!.async('string');
  for (const c of contacts) {
    assert.ok(xml.includes(c.company_name.toUpperCase()), `DOCX missing company: ${c.company_name}`);
    assert.ok(xml.includes(c.ceo), `DOCX missing leader: ${c.ceo}`);
    assert.ok(xml.includes(c.sources![0].url), `DOCX missing source: ${c.sources![0].url}`);
    assert.ok(xml.includes(c.address!), `DOCX missing address: ${c.address}`);
  }
  const idxA = xml.indexOf('AUSTRALIA');
  const idxZ = xml.indexOf('ZIMBABWE');
  const idxN = xml.indexOf('NOT SPECIFIED');
  assert.ok(idxA >= 0 && idxZ >= 0 && idxN >= 0, 'DOCX missing country sections');
  assert.ok(idxA < idxZ && idxZ < idxN, 'DOCX country order: Australia < Zimbabwe < Not Specified');

  console.log('contact_directory_completeness OK');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});