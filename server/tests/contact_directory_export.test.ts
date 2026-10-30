// Contact Directory Export — end-to-end. Verifies the /api/export 'contacts'
// pipeline (processExportRequest -> processContactExport) produces real, non-empty
// PDF/DOCX/CSV/XLSX artifacts, 5-column CSV/XLSX headers, and correct ZIP packaging
// for report_type 'both'.

import * as assert from 'assert';
import fs from 'fs';
import os from 'node:os';
import path from 'path';
import JSZip from 'jszip';
import ExcelJS from 'exceljs';
import { processExportRequest } from '../export_manager';
import { countPdfPages, extractPdfText, pdfTextContains } from './pdf_inspect';

const SCRATCH = fs.mkdtempSync(path.join(os.tmpdir(), 'edgeview-export-contract-'));

const fixture: any[] = [
  {
    id: 'c-1',
    company_name: 'Zeta Pharma (Pvt) Ltd',
    country: 'Pakistan',
    ceo: 'Imran Siddiqui',
    email: 'info@zetapharma.pk',
    phone: '+92-21-1111-2222',
    address: 'Plot 14, SITE Industrial Area, Karachi',
    website: 'https://zetapharma.pk',
    contact_persons: [
      { name: 'Ayesha Khan', designation: 'Supply Chain Head', email: 'ayesha@zetapharma.pk', phone: '+92-300-111-2222' },
    ],
    sources: [{ url: 'https://source.com/zetapharma', title: 'Zeta Pharma Profile' }],
  },
  {
    id: 'c-2',
    company_name: 'Alpha Medisys LLC',
    country: 'United States',
    ceo: 'James Carter',
    email: 'info@alphamedisys.com',
    phone: '+1-212-555-0148',
    website: 'https://alphamedisys.com',
    decision_makers: [
      { name: 'Sofia Reyes', designation: 'Director', department: 'Procurement', emails: [{ value: 'sofia@alphamedisys.com' }] },
    ],
  },
  {
    id: 'c-3',
    company_name: 'Nordic Health AB',
    country: 'Sweden',
    ceo: 'Erik Lindgren',
    email: 'info@nordichealth.se',
    phone: '+46-8-555-1234',
    address: 'Sveavagen 20, Stockholm',
  },
  {
    id: 'c-4',
    company_name: 'Gamma Remedies',
    country: '',
    ceo: 'Fatima Noor',
    email: 'info@gammaremedies.com',
    phone: '+92-51-555-7788',
  },
];

function assertBuffer(buf: Buffer | string, minLen: number, label: string): Buffer {
  assert.ok(Buffer.isBuffer(buf), `${label}: expected Buffer`);
  assert.ok(buf.length > minLen, `${label}: expected length > ${minLen}, got ${buf.length}`);
  return buf as Buffer;
}

async function main() {
  // PDF importer
  const pdf = await processExportRequest({
    dataset: 'contacts',
    title: 'Contact Directory',
    records: fixture,
    selectedRows: [],
    format: 'pdf',
    report_type: 'importer',
    filenamePrefix: 'EdgeView_Test',
  });
  const pdfBuf = assertBuffer(pdf.buffer, 2000, 'PDF');
  assert.ok(pdf.contentType === 'application/pdf', 'PDF content type');
  const pdfText = extractPdfText(pdfBuf);
  assert.ok(pdfTextContains(pdfText, 'LIST OF IMPORTERS'), 'PDF missing title');
  assert.ok(pdfTextContains(pdfText, 'ZETA PHARMA'), 'PDF missing company (uppercased)');
  assert.ok(pdfTextContains(pdfText, 'Ayesha Khan'), 'PDF missing leadership person');
  assert.ok(countPdfPages(pdfBuf) >= 1, 'PDF page count >= 1');
  fs.writeFileSync(path.join(SCRATCH, 'contact_directory_export_importer.pdf'), pdfBuf);

  // PDF exporter title
  const pdfExp = await processExportRequest({
    dataset: 'contacts', title: 'Contact Directory', records: fixture, selectedRows: [],
    format: 'pdf', report_type: 'exporter', filenamePrefix: 'EdgeView_Test',
  });
  const pdfExpText = extractPdfText(assertBuffer(pdfExp.buffer, 2000, 'PDF exp'));
  assert.ok(pdfTextContains(pdfExpText, 'LIST OF EXPORTERS'), 'PDF exporter missing title');

  // DOCX
  const docx = await processExportRequest({
    dataset: 'contacts', title: 'Contact Directory', records: fixture, selectedRows: [],
    format: 'docx', report_type: 'importer', filenamePrefix: 'EdgeView_Test',
  });
  const docxBuf = assertBuffer(docx.buffer, 3000, 'DOCX');
  const docxZip = await JSZip.loadAsync(docxBuf);
  const docxXml = await docxZip.file('word/document.xml')!.async('string');
  assert.ok(docxXml.includes('EDGEVIEW'), 'DOCX missing EDGEVIEW');
  assert.ok(docxXml.includes('LIST OF IMPORTERS'), 'DOCX missing title');
  assert.ok(docxXml.includes('Importer Name'), 'DOCX missing column header');
  assert.ok(docxXml.includes('Previous Exporters / Import History'), 'DOCX missing history header');
  assert.ok(docxXml.includes('ZETA PHARMA'), 'DOCX missing company');
  fs.writeFileSync(path.join(SCRATCH, 'contact_directory_export.docx'), docxBuf);

  // CSV importer — 5 columns
  const csv = await processExportRequest({
    dataset: 'contacts', title: 'Contact Directory', records: fixture, selectedRows: [],
    format: 'csv', report_type: 'importer', filenamePrefix: 'EdgeView_Test',
  });
  const csvStr = String(csv.buffer);
  for (const h of ['S.No', 'Importer Name', 'Previous Exporters / Import History', 'CEO / Leadership / Decision Makers', 'Contact Information & Address']) {
    assert.ok(csvStr.includes(h), `CSV missing header: ${h}`);
  }
  assert.ok(csvStr.includes('Zeta Pharma (Pvt) Ltd'), 'CSV missing company');
  fs.writeFileSync(path.join(SCRATCH, 'contact_directory_export.csv'), Buffer.from(csvStr, 'utf8'));

  // CSV exporter header
  const csvExp = await processExportRequest({
    dataset: 'contacts', title: 'Contact Directory', records: fixture, selectedRows: [],
    format: 'csv', report_type: 'exporter', filenamePrefix: 'EdgeView_Test',
  });
  const csvExpStr = String(csvExp.buffer);
  assert.ok(csvExpStr.includes('Exporter Name'), 'CSV exporter missing header');
  assert.ok(csvExpStr.includes('Supplied To / Export History'), 'CSV exporter missing history header');

  // XLSX
  const xlsx = await processExportRequest({
    dataset: 'contacts', title: 'Contact Directory', records: fixture, selectedRows: [],
    format: 'xlsx', report_type: 'importer', filenamePrefix: 'EdgeView_Test',
  });
  const xlsxBuf = assertBuffer(xlsx.buffer, 1000, 'XLSX');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(xlsxBuf as any);
  const ws = wb.worksheets[0];
  const headers = ((ws?.getRow(1).values || []) as any[]).slice(1).map(String);
  for (const h of ['S.No', 'Importer Name', 'Previous Exporters / Import History']) {
    assert.ok(headers.includes(h), `XLSX missing header: ${h}`);
  }
  fs.writeFileSync(path.join(SCRATCH, 'contact_directory_export.xlsx'), xlsxBuf);

  // 'both' + pdf -> ZIP of importer + exporter PDFs
  const both = await processExportRequest({
    dataset: 'contacts', title: 'Contact Directory', records: fixture, selectedRows: [],
    format: 'pdf', report_type: 'both', filenamePrefix: 'EdgeView_Test',
  });
  const bothZip = await JSZip.loadAsync(assertBuffer(both.buffer, 1000, 'both PDF ZIP'));
  const pdfNames = Object.keys(bothZip.files).filter((n) => n.endsWith('.pdf'));
  assert.ok(pdfNames.length === 2, `both PDF: expected 2 pdf files, got ${pdfNames.length}`);
  fs.writeFileSync(path.join(SCRATCH, 'contact_directory_export_both_pdf.zip'), both.buffer as Buffer);

  // 'both' + all -> ZIP with importer+exporter csv/xlsx/docx/pdf
  const allBoth = await processExportRequest({
    dataset: 'contacts', title: 'Contact Directory', records: fixture, selectedRows: [],
    format: 'all', report_type: 'both', filenamePrefix: 'EdgeView_Test',
  });
  const allZip = await JSZip.loadAsync(assertBuffer(allBoth.buffer, 1000, 'both ALL ZIP'));
  const names = Object.keys(allZip.files);
  const extCount = names.filter((n) => n.endsWith('.pdf')).length +
    names.filter((n) => n.endsWith('.docx')).length +
    names.filter((n) => n.endsWith('.csv')).length +
    names.filter((n) => n.endsWith('.xlsx')).length;
  assert.ok(extCount === 8, `both ALL: expected 8 assets, got ${extCount}`);
  fs.writeFileSync(path.join(SCRATCH, 'contact_directory_export_both_all.zip'), allBoth.buffer as Buffer);

  console.log('contact_directory_export OK');
}

main().finally(() => {
  assert.equal(path.dirname(fs.realpathSync(SCRATCH)), fs.realpathSync(os.tmpdir()));
  fs.rmSync(SCRATCH, { recursive: true, force: true });
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
