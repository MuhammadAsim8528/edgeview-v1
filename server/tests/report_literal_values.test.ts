import assert from 'node:assert/strict';
import JSZip from 'jszip';
import ExcelJS from 'exceljs';
import { cleanMarkdown, generateDocxReport } from '../docx_report';
import { generateDocxReportStream } from '../docx_stream';
import { generatePdfReport } from '../pdf_report';
import { contactReportColumns, flattenContactReportRows, generateCsvData, generateXlsxWorkbook } from '../export_manager';
import type { ContactReport } from '../contact_report_model';
import { extractPdfText, pdfTextContains } from './pdf_inspect';

const company = 'Literal_Company*Ltd';
const product = 'DRUG_A~B*10';
const person = 'Alex_Smith';
const address = 'Unit_A, Block*B';
const source = 'https://example.test/contact_us';
for (const value of [company, product, person, address, source, 'team_ops@example.test', '[literal](code)', '`code`', '薬品_A']) assert.equal(cleanMarkdown(value), value, 'structured report facts must not be reinterpreted as Markdown');
const report: ContactReport = { reportType: 'importer', title: 'Synthetic literal facts', totalImporters: 1, countrySections: [{ country: 'Kenya', importers: [{
  country: 'Kenya', sNo: 1, companyName: company, cleanName: company, role: 'Importer', totalShipments: 2, totalValue: 3,
  tradeHistory: [{ partnerName: 'Supplier_A', country: 'Kenya', itemDescription: product, shipmentCount: 2, totalVal: 3 }],
  leadership: [{ name: person, designation: 'Ops_Manager', emails: ['team_ops@example.test'], phones: [], sources: [source] }],
  contactInfo: { addresses: [{ address }], emails: ['team_ops@example.test'], phones: [], fax_numbers: [], linkedin_urls: [], socials: [], sources: [{ url: source }] },
}] }] };
const columns = contactReportColumns('importer'), rows = flattenContactReportRows(report, columns);
const csv = generateCsvData(columns, rows);
for (const value of [company, product, person, address, source, 'team_ops@example.test']) assert.ok(csv.includes(value), 'CSV must retain literal fact characters');
for (const generate of [generateDocxReport, generateDocxReportStream]) {
  const zip = await JSZip.loadAsync(await generate([], 'importer', undefined, report));
  const xml = await zip.file('word/document.xml')!.async('string');
  for (const value of [company.toUpperCase(), product, person, address, source]) assert.ok(xml.includes(value), 'DOCX must retain literal fact characters');
}
const pdf = extractPdfText(await generatePdfReport([], 'importer', undefined, report));
for (const value of [company.toUpperCase(), product, person, address, source]) assert.ok(pdfTextContains(pdf, value), 'PDF must retain literal fact characters');
const workbook = new ExcelJS.Workbook();
await workbook.xlsx.load(await generateXlsxWorkbook('Synthetic literals', columns, rows) as any);
const serialized = JSON.stringify(workbook.worksheets[0].getRow(2).values);
for (const value of [company, product, person, address, source]) assert.ok(serialized.includes(value), 'XLSX must retain literal fact characters');
console.log('PASS literal company/product/person/address/email/source punctuation in shared text, CSV, both DOCX generators, PDF extraction and XLSX reload');
