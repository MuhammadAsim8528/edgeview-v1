// International Importer Directory — verifies the canonical projection:
//   - full ISO country normalization (alpha-2/alpha-3/codes/spellings)
//   - deterministic Pakistan exclusion (PK/PAK/Pakistan, etc.)
//   - A→Z country sections ("Not Specified" last) + A→Z importers
//   - concise data-driven projection: unique "Traded With" partner companies,
//     deterministic Top 5/10 products (frequency + alphabetical tie-break),
//     dynamic contact/leadership (no "Not found" placeholders)
//   - 10-column CSV/XLSX grid, DOCX sections, PDF page headers
//   - no fabricated data (missing values omitted)

import * as assert from 'assert';
import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';
import ExcelJS from 'exceljs';
import { db } from '../db';
import { computeSummary } from '../summary';
import { TradeRelationshipResolver } from '../trade_relationship_resolver';
import {
  getInternationalImporterDirectory,
  flattenInternationalImporterRows,
  INTERNATIONAL_IMPORTER_COLUMNS,
  INTERNATIONAL_IMPORTER_DIRECTORY_TITLE,
  isImporterContact,
  computeTopProducts,
  computeTradedWith,
  titleCaseName,
  DEFAULT_TOP_PRODUCTS_LIMIT,
  MAX_TOP_PRODUCTS_LIMIT,
  MAX_TRADED_WITH,
} from '../international_importer_directory';
import {
  normalizeCountryName,
  isPakistanCountry,
} from '../../src/utils/countryNormalizer';
import { processExportRequest } from '../export_manager';
import { countPdfPages, extractPdfText, pdfTextContains } from './pdf_inspect';

const SCRATCH = 'C:/Users/asimh/AppData/Local/Temp/opencode/edgeview_tests';
fs.mkdirSync(SCRATCH, { recursive: true });

const fixture: any[] = [
  // Pakistan importer → must be excluded.
  {
    id: 'c-1',
    company_name: 'Zeta Pharma (Pvt) Ltd',
    country: 'Pakistan',
    email: 'info@zetapharma.pk',
    phone: '+92-21-1111-2222',
    contact_persons: [{ name: 'Ayesha Khan', designation: 'Supply Chain Head' }],
    sources: [{ url: 'https://source.com/zetapharma' }],
  },
  // Pakistani importer using alpha-3 code → must be excluded too.
  {
    id: 'c-1b',
    company_name: 'Karachi Remedies',
    country: 'PAK',
    email: 'info@karachiremedies.com',
  },
  // US importer.
  {
    id: 'c-2',
    company_name: 'Alpha Medisys LLC',
    country: 'US',
    email: 'info@alphamedisys.com',
    phone: '+1-212-555-0148',
    website: 'https://alphamedisys.com',
    decision_makers: [{ name: 'Sofia Reyes', designation: 'Director', department: 'Procurement' }],
  },
  // Swedish importer.
  {
    id: 'c-3',
    company_name: 'Nordic Health AB',
    country: 'Sweden',
    email: 'info@nordichealth.se',
    address: 'Sveavagen 20, Stockholm',
  },
  // Exporter-only → must NOT be in the directory.
  {
    id: 'c-4',
    company_name: 'Gamma Remedies',
    country: 'Sweden',
    type: 'exporter',
    email: 'info@gammaremedies.com',
  },
  // Empty country → "Not Specified", still included as importer.
  {
    id: 'c-5',
    company_name: 'Omega Chemicals',
    country: '',
    email: 'info@omegachemicals.com',
  },
];

async function seedTrade() {
  const columns = ['Importer', 'Exporter', 'Country', 'Item', 'Total Value (USD)'];
  const rows: Record<string, any>[] = [
    { Importer: 'Alpha Medisys LLC', Exporter: 'SUPPLIER 01', Country: 'US', Item: 'paracetamol, ibuprofen', 'Total Value (USD)': '1000' },
    { Importer: 'Alpha Medisys LLC', Exporter: 'SUPPLIER 01', Country: 'US', Item: 'paracetamol', 'Total Value (USD)': '1500' },
    { Importer: 'Alpha Medisys LLC', Exporter: 'SUPPLIER 02', Country: 'US', Item: 'amoxicillin', 'Total Value (USD)': '750' },
    { Importer: 'Alpha Medisys LLC', Exporter: 'SUPPLIER 05', Country: 'US', Item: 'paracetamol', 'Total Value (USD)': '300' },
    { Importer: 'Nordic Health AB', Exporter: 'SUPPLIER 03', Country: 'Sweden', Item: 'vitamins', 'Total Value (USD)': '200' },
    { Importer: 'Omega Chemicals', Exporter: 'SUPPLIER 04', Country: '', Item: 'citric acid', 'Total Value (USD)': '90' },
  ];
  db.files.set('trade-index-international', {
    id: 'f-trade-index-international',
    name: 'trade_index_international.csv',
    file_type: 'CSV',
    size: 0,
    upload_time: new Date().toISOString(),
    columns,
    rows,
    summary: computeSummary(columns, rows),
  });
}

function assertBuffer(buf: Buffer | string, minLen: number, label: string): Buffer {
  assert.ok(Buffer.isBuffer(buf), `${label}: expected Buffer`);
  assert.ok(buf.length > minLen, `${label}: expected length > ${minLen}, got ${buf.length}`);
  return buf as Buffer;
}

async function main() {
  // ---- Country normalization ----
  assert.ok(normalizeCountryName('AF') === 'Afghanistan', 'AF → Afghanistan');
  assert.ok(normalizeCountryName('AFG') === 'Afghanistan', 'AFG → Afghanistan');
  assert.ok(normalizeCountryName('afghanistan') === 'Afghanistan', 'afghanistan case-insensitive');
  assert.ok(normalizeCountryName('United States') === 'United States', 'US full name');
  assert.ok(normalizeCountryName('USA') === 'United States', 'USA → United States');
  assert.ok(normalizeCountryName('PAK') === 'Pakistan', 'PAK → Pakistan');
  assert.ok(normalizeCountryName('PK') === 'Pakistan', 'PK → Pakistan');
  assert.ok(normalizeCountryName('China') === 'China', 'China full name');
  assert.ok(normalizeCountryName('CN') === 'China', 'CN → China');
  assert.ok(normalizeCountryName('CHN') === 'China', 'CHN → China');
  assert.ok(normalizeCountryName('Russia') === 'Russia', 'Russia full name (no "US" fragment bug)');
  assert.ok(normalizeCountryName('zzz-not-a-country') === 'zzz-not-a-country', 'unresolvable preserved verbatim');
  assert.ok(isPakistanCountry('Pakistan'), 'Pakistan detected');
  assert.ok(isPakistanCountry('PK'), 'PK detected');
  assert.ok(isPakistanCountry('PAK'), 'PAK detected');
  assert.ok(isPakistanCountry('pakistan'), 'pakistan case-insensitive');
  assert.ok(!isPakistanCountry('India'), 'India not Pakistan');

  // ---- Importer-only classification ----
  assert.ok(isImporterContact({ id: 'a', company_name: 'A', country: 'US', type: 'importer' }), 'importer included');
  assert.ok(isImporterContact({ id: 'b', company_name: 'A', country: 'US', type: 'both' }), 'both included');
  assert.ok(isImporterContact({ id: 'c', company_name: 'A', country: 'US', type: 'Company' }), 'company included');
  assert.ok(isImporterContact({ id: 'd', company_name: 'A', country: 'US' }), 'untyped included');
  assert.ok(!isImporterContact({ id: 'e', company_name: 'A', country: 'US', type: 'exporter' }), 'exporter excluded');
  assert.ok(!isImporterContact({ id: 'f', company_name: 'A', country: 'US', type: 'Export' }), 'Export excluded');

  // ---- Safe title-casing of display names ----
  assert.ok(titleCaseName('ABC PHARMA LTD') === 'Abc Pharma Ltd', 'all-caps name title-cased');
  assert.ok(titleCaseName('ABC PHARMA LLC') === 'Abc Pharma LLC', 'legal-form acronym preserved');
  assert.ok(titleCaseName('E.S.B & COMPANY') === 'E.S.B & Company', 'dotted acronym preserved');
  assert.ok(titleCaseName('M/S ROYAL GROUP') === 'M/S Royal Group', 'M/S preserved');
  assert.ok(titleCaseName('COTTON WOOL 500GM') === 'Cotton Wool 500GM', 'digit-bearing token preserved');
  assert.ok(titleCaseName('GETZ PHARMA (PRIVATE) LIMITED') === 'Getz Pharma (Private) Limited', 'parenthesised suffix title-cased');
  assert.ok(titleCaseName('Dr. John Smith') === 'Dr. John Smith', 'mixed-case name unchanged');
  assert.ok(titleCaseName('') === '', 'empty name stays empty');
  assert.ok(titleCaseName('  ALPHA   MEDISYS  ') === 'Alpha Medisys', 'whitespace collapsed before casing');

  // ---- Deterministic top-products ranking (pure function) ----
  const ranked = computeTopProducts(
    [
      { itemDescription: 'paracetamol, ibuprofen' },
      { itemDescription: 'paracetamol' },
      { itemDescription: 'amoxicillin' },
      { itemDescription: 'paracetamol' },
      { itemDescription: 'vitamins, amoxicillin' },
    ],
    10
  );
  const rankedLines = ranked.split('\n').map((l) => l.trim());
  assert.deepStrictEqual(rankedLines, [
    '• paracetamol',   // count 3
    '• amoxicillin',   // count 2
    '• ibuprofen',     // count 1 (alpha after amoxicillin tie-break order is per tie)
    '• vitamins',      // count 1
  ], `deterministic product ranking: ${rankedLines.join(', ')}`);

  // Cap behavior: limit is clamped to [1, MAX_TOP_PRODUCTS_LIMIT].
  assert.ok(computeTopProducts([{ itemDescription: 'a' }, { itemDescription: 'b' }, { itemDescription: 'c' }], 1).split('\n').length === 1, 'limit 1');
  assert.ok(DEFAULT_TOP_PRODUCTS_LIMIT === 5, 'default limit 5');
  assert.ok(MAX_TOP_PRODUCTS_LIMIT === 10, 'max limit 10');
  const many = Array.from({ length: 15 }, (_, i) => ({ itemDescription: `product-${i}` }));
  assert.ok(computeTopProducts(many, 99).split('\n').length === 10, 'never exceeds Top 10');

  // Parenthetical invoice annotations are stripped so identical products merge.
  const annotated = computeTopProducts([
    { itemDescription: 'CREAM (OTHER DETAIL AS PER INVOICE # RG-23/APU/PAK/SEA-120 & PACKING LIST)' },
    { itemDescription: 'CREAM' },
    { itemDescription: 'CREAM (OTHER DETAIL AS PER INVOICE # RG-23/APU/PAK/SEA-118 & PACKING LIST)' },
    { itemDescription: 'COTTON WOOL 500GM (OTHER DETAIL AS PER INVOICE # RG-23/APU/PAK/SEA118 & PACKING LIST)' },
  ]);
  const annotatedLines = annotated.split('\n').map((l) => l.trim());
  assert.deepStrictEqual(annotatedLines, ['• Cream', '• Cotton Wool 500GM'], `annotated product cleanup: ${annotatedLines.join(', ')}`);

  // Trailing annotation segments, generic prefixes and container words are removed.
  const annot2 = computeTopProducts([
    { itemDescription: 'TESTOVIRON DEPOT 250MG INJ DRAP NO. A-1749400446189 DATE OF ISSUE: 15-DEC-2023' },
    { itemDescription: 'TESTOVIRON DEPOT 250MG INJ' },
    { itemDescription: 'PHARMACEUTICAL MEDICINES - ROSUVAX TABLET' },
    { itemDescription: 'MEDICINES' },
    { itemDescription: '000' },
  ]);
  const annot2Lines = annot2.split('\n').map((l) => l.trim());
  assert.deepStrictEqual(annot2Lines, ['• Testoviron Depot 250MG Inj', '• Rosuvax Tablet'], `annotation cut + generic drop: ${annot2Lines.join(', ')}`);

  // ---- Unique Traded With (dedup + placeholder filtering) ----
  const tw = computeTradedWith([
    { partnerName: 'SUPPLIER 01', shipmentCount: 2 },
    { partnerName: 'supplier 01', shipmentCount: 1 }, // same name, case-insensitive dedup
    { partnerName: 'SUPPLIER 02', shipmentCount: 3 },
    { partnerName: 'N/A', shipmentCount: 5 },
    { partnerName: 'unknown', shipmentCount: 5 },
  ]);
  const twNames = tw.tradedWith.split('\n').map((l) => l.trim().replace(/^•\s*/, ''));
  assert.deepStrictEqual(twNames, ['Supplier 01', 'Supplier 02'], `dedup + tie-break order: ${twNames.join(', ')}`);
  assert.ok(tw.tradedWithCount === 2, 'tradedWithCount is unique partners');

  // Traded With is capped at MAX_TRADED_WITH companies with a "+N more" line.
  const manyPartners = Array.from({ length: 15 }, (_, i) => ({ partnerName: `PARTNER ${String(i).padStart(2, '0')}`, shipmentCount: 15 - i }));
  const capped = computeTradedWith(manyPartners);
  const cappedLines = capped.tradedWith.split('\n').filter(Boolean);
  assert.ok(MAX_TRADED_WITH === 10, 'MAX_TRADED_WITH is 10');
  assert.ok(cappedLines.length === 11, `capped lines = 10 bullets + "+N more", got ${cappedLines.length}`);
  assert.ok(cappedLines[10] === '+5 more', 'capped remainder line present');
  assert.ok(capped.tradedWithCount === 15, 'tradedWithCount keeps the full unique count');

  // ---- Directory projection ----
  await seedTrade();
  const tradeIndex = await TradeRelationshipResolver.buildTradeIndex();
  const dir = await getInternationalImporterDirectory(fixture, tradeIndex);

  assert.ok(dir.title === INTERNATIONAL_IMPORTER_DIRECTORY_TITLE, 'directory title');
  assert.ok(dir.excluded.country === 'Pakistan', 'excluded country label');
  assert.ok(dir.excluded.count === 2, `excluded 2 Pakistani importers, got ${dir.excluded.count}`);

  const countryNames = dir.countrySections.map((s) => s.country);
  // A→Z with "Not Specified" last: Sweden, United States, Not Specified.
  assert.deepStrictEqual(countryNames, ['Sweden', 'United States', 'Not Specified'], `country order: ${countryNames.join(', ')}`);
  assert.ok(dir.totalImporters === 3, `total importers 3, got ${dir.totalImporters}`);
  assert.ok(dir.topProductsLimit === DEFAULT_TOP_PRODUCTS_LIMIT, 'topProductsLimit default 5');

  // Alpha Medisys (US → "United States") — concise projection.
  const usSection = dir.countrySections.find((s) => s.country === 'United States');
  assert.ok(usSection, 'United States section present');
  const alpha = usSection!.importers.find((r) => r.importer === 'Alpha Medisys LLC');
  assert.ok(alpha, 'Alpha Medisys present');
  assert.ok(alpha!.website === 'https://alphamedisys.com', 'website kept');
  assert.ok(alpha!.email === 'info@alphamedisys.com', 'email kept');
  assert.ok(alpha!.phone === '+1-212-555-0148', 'phone kept');
  assert.ok(alpha!.tradedWith.includes('Supplier 01'), 'tradedWith includes Supplier 01');
  assert.ok(alpha!.tradedWith.includes('Supplier 02'), 'tradedWith includes Supplier 02');
  assert.ok(alpha!.tradedWith.includes('Supplier 05'), 'tradedWith includes Supplier 05');
  assert.ok(!/China|India|Brazil/.test(alpha!.tradedWith), 'tradedWith lists companies, not countries');
  const alphaTw = alpha!.tradedWith.split('\n').filter(Boolean);
  assert.ok(alphaTw.length === 3, 'tradedWith has exactly 3 unique partners');
  assert.ok(alphaTw[0].includes('Supplier 01'), 'Supplier 01 ranked first by shipment count');
  assert.ok(alpha!.topProducts.includes('paracetamol'), 'topProducts includes paracetamol');
  assert.ok(alpha!.topProducts.includes('amoxicillin'), 'topProducts includes amoxicillin');
  assert.ok(alpha!.topProducts.indexOf('paracetamol') < alpha!.topProducts.indexOf('amoxicillin'), 'paracetamol ranked above amoxicillin (frequency)');
  assert.ok(alpha!.topProducts.indexOf('amoxicillin') < alpha!.topProducts.indexOf('ibuprofen'), 'amoxicillin before ibuprofen (alphabetical tie-break)');
  assert.ok(!alpha!.topProducts.includes('\n\n'), 'topProducts no blank lines');
  assert.ok(alpha!.leadership.includes('Sofia Reyes'), 'leadership includes Sofia Reyes');
  assert.ok(alpha!.leadership.includes('Director'), 'leadership includes designation');
  assert.ok(alpha!.address === '', 'empty address stays empty (no fabrication)');
  assert.ok(alpha!.sources === '', 'empty sources stays empty (no fabrication)');

  // Nordic Health AB section (Sweden) has Gamma excluded (exporter-only).
  const swedenSection = dir.countrySections.find((s) => s.country === 'Sweden');
  const nordic = swedenSection!.importers.find((r) => r.importer === 'Nordic Health AB');
  assert.ok(nordic, 'Nordic Health present');
  assert.ok(swedenSection!.importers.length === 1, 'Gamma exporter excluded from Sweden section');
  assert.ok(nordic!.tradedWith.includes('Supplier 03'), 'Nordic traded with Supplier 03');
  assert.ok(nordic!.topProducts.includes('vitamins'), 'Nordic top product vitamins');
  assert.ok(nordic!.address === 'Sveavagen 20, Stockholm', 'Nordic address kept');
  // Dynamic leadership: Nordic has no people → omitted entirely (no "Not found").
  assert.ok(nordic!.leadership === '', 'Nordic leadership omitted (dynamic)');

  // Omega → "Not Specified", still present with empty-but-real fields.
  const nsSection = dir.countrySections.find((s) => s.country === 'Not Specified');
  assert.ok(nsSection, 'Not Specified section present');
  const omega = nsSection!.importers[0];
  assert.ok(omega.importer === 'Omega Chemicals', 'Omega present');
  assert.ok(omega.tradedWith.includes('Supplier 04'), 'Omega traded with Supplier 04');
  assert.ok(omega.topProducts.includes('citric acid'), 'Omega top product citric acid');

  // ---- Top 10 limit via options ----
  const dir10 = await getInternationalImporterDirectory(fixture, tradeIndex, { topProductsLimit: 10 });
  assert.ok(dir10.topProductsLimit === 10, 'topProductsLimit option respected');
  const dirClamped = await getInternationalImporterDirectory(fixture, tradeIndex, { topProductsLimit: 50 });
  assert.ok(dirClamped.topProductsLimit === MAX_TOP_PRODUCTS_LIMIT, 'limit clamped to Top 10');

  // ---- Flattened 10-column grid ----
  const flat = flattenInternationalImporterRows(dir);
  assert.ok(flat.length === 3, `flattened rows: ${flat.length}`);
  const headers = INTERNATIONAL_IMPORTER_COLUMNS.map((c) => c.header);
  assert.deepStrictEqual(headers, [
    'Country', 'Importer', 'Traded With', 'Top Products',
    'Website', 'Email', 'Phone', 'Address', 'Leadership', 'Sources',
  ], '10-column headers');
  for (const rec of flat) {
    for (const c of INTERNATIONAL_IMPORTER_COLUMNS) {
      assert.ok(c.key in rec, `row missing key ${c.key}`);
    }
  }
  assert.ok(!flat.some((r) => /pakistan/i.test(String(r.country))), 'no Pakistan row in flattened grid');
  // Flat formats replace line breaks with "; " so cells never contain raw newlines.
  for (const rec of flat) {
    assert.ok(!Object.values(rec).some((v) => typeof v === 'string' && v.includes('\n')), 'flat cells have no raw newlines');
  }
  const flatAlpha = flat.find((r) => r['importer'] === 'Alpha Medisys LLC');
  assert.ok(flatAlpha, 'flat Alpha present');
  assert.ok(String(flatAlpha['tradedWith'] || '').includes('Supplier 01'), 'flat tradedWith joined');
  assert.ok(String(flatAlpha['tradedWith'] || '').includes('; '), 'flat tradedWith uses semicolon separator');
  const flatNordic = flat.find((r) => r['importer'] === 'Nordic Health AB');
  assert.ok(flatNordic && flatNordic['address'] === 'Sveavagen 20, Stockholm', 'flat address present');

  // ---- End-to-end via processExportRequest ----
  const common = {
    dataset: 'contacts',
    title: 'Contact Directory',
    records: fixture,
    selectedRows: [],
    filenamePrefix: 'EdgeView_Intl_Test',
  };

  // CSV — 9 headers, no Pakistan, includes country/importer.
  const csv = await processExportRequest({ ...common, format: 'csv', report_type: 'international_importer' });
  const csvStr = String(csv.buffer);
  for (const h of headers) {
    assert.ok(csvStr.includes(h), `CSV missing header: ${h}`);
  }
  assert.ok(!/pakistan/i.test(csvStr), 'CSV must not contain Pakistan');
  assert.ok(csvStr.includes('Alpha Medisys LLC'), 'CSV includes Alpha Medisys');
  assert.ok(csvStr.includes('Supplier 01'), 'CSV tradedWith includes Supplier 01');
  assert.ok(csvStr.includes('Sveavagen 20, Stockholm'), 'CSV includes Address');
  assert.ok(csvStr.includes('paracetamol'), 'CSV topProducts includes paracetamol');
  fs.writeFileSync(path.join(SCRATCH, 'international_importer_directory.csv'), Buffer.from(csvStr, 'utf8'));

  // XLSX — 9 headers, no Pakistan row.
  const xlsx = await processExportRequest({ ...common, format: 'xlsx', report_type: 'international_importer' });
  const xlsxBuf = assertBuffer(xlsx.buffer, 1000, 'XLSX');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(xlsxBuf as any);
  const ws = wb.worksheets[0];
  const aoa: any[][] = [];
  ws.eachRow(row => aoa.push((row.values as any[]).slice(1)));
  const xHeaders = (aoa[0] || []).map(String);
  for (const h of headers) assert.ok(xHeaders.includes(h), `XLSX missing header: ${h}`);
  const body = aoa.slice(1).map((r) => r.join('|')).join('\n');
  assert.ok(!/pakistan/i.test(body), 'XLSX must not contain Pakistan');
  assert.ok(body.includes('Alpha Medisys LLC'), 'XLSX includes Alpha Medisys');
  assert.ok(body.includes('Supplier 01'), 'XLSX tradedWith includes Supplier 01');
  assert.ok(body.includes('Sveavagen 20, Stockholm'), 'XLSX includes Address');
  fs.writeFileSync(path.join(SCRATCH, 'international_importer_directory.xlsx'), xlsxBuf);

  // DOCX — title banner + country heading + concise column headers.
  const docx = await processExportRequest({ ...common, format: 'docx', report_type: 'international_importer' });
  const docxBuf = assertBuffer(docx.buffer, 3000, 'DOCX');
  const docxZip = await JSZip.loadAsync(docxBuf);
  const docxXml = await docxZip.file('word/document.xml')!.async('string');
  assert.ok(docxXml.includes('EDGEVIEW — INTERNATIONAL IMPORTER DIRECTORY'), 'DOCX missing title');
  assert.ok(docxXml.includes('SWEDEN'), 'DOCX missing country heading');
  assert.ok(docxXml.includes('Traded With'), 'DOCX missing Traded With header');
  assert.ok(docxXml.includes('Top Products'), 'DOCX missing Top Products header');
  assert.ok(docxXml.includes('Alpha Medisys LLC'), 'DOCX missing importer');
  assert.ok(docxXml.includes('Supplier 01'), 'DOCX missing traded partner');
  assert.ok(docxXml.includes('Address: Sveavagen 20, Stockholm'), 'DOCX missing Address');
  assert.ok(!docxXml.includes('ZETA PHARMA'), 'DOCX must not contain Pakistani importer');
  fs.writeFileSync(path.join(SCRATCH, 'international_importer_directory.docx'), docxBuf);

  // PDF — page headers with country, no blank pages, no Pakistan, importer blocks.
  const pdf = await processExportRequest({ ...common, format: 'pdf', report_type: 'international_importer' });
  const pdfBuf = assertBuffer(pdf.buffer, 2000, 'PDF');
  const pdfText = extractPdfText(pdfBuf);
  assert.ok(pdfTextContains(pdfText, 'EDGEVIEW'), 'PDF missing EDGEVIEW');
  assert.ok(
    pdfTextContains(pdfText, 'INTERNATIONAL IMPORTER DIRECTORY / Country:'),
    'PDF missing directory page header'
  );
  assert.ok(pdfTextContains(pdfText, 'SWEDEN'), 'PDF missing country heading');
  assert.ok(pdfTextContains(pdfText, 'Alpha Medisys'), 'PDF missing importer');
  assert.ok(pdfTextContains(pdfText, 'Supplier 01'), 'PDF missing traded partner');
  assert.ok(pdfTextContains(pdfText, 'Traded With'), 'PDF missing Traded With label');
  assert.ok(pdfTextContains(pdfText, 'Top Products'), 'PDF missing Top Products label');
  assert.ok(pdfTextContains(pdfText, 'Address: Sveavagen 20, Stockholm'), 'PDF missing Address');
  assert.ok(!/ZETA\s?PHARMA/i.test(pdfText.replace(/\s+/g, ' ')), 'PDF must not contain Pakistani importer');
  const pages = countPdfPages(pdfBuf);
  assert.ok(pages >= 1, 'PDF page count >= 1');
  assert.ok(!/ZETA\s?PHARMA|PAKISTAN/i.test(pdfText.replace(/\s+/g, ' ')), 'PDF no Pakistan anywhere');
  fs.writeFileSync(path.join(SCRATCH, 'international_importer_directory.pdf'), pdfBuf);

  // ZIP ('all') — 4 international assets, no Pakistan.
  const all = await processExportRequest({ ...common, format: 'all', report_type: 'international_importer' });
  const allZip = await JSZip.loadAsync(assertBuffer(all.buffer, 1000, 'ALL ZIP'));
  const names = Object.keys(allZip.files);
  assert.ok(names.some((n) => n.endsWith('.csv')), 'ZIP missing csv');
  assert.ok(names.some((n) => n.endsWith('.xlsx')), 'ZIP missing xlsx');
  assert.ok(names.some((n) => n.endsWith('.docx')), 'ZIP missing docx');
  assert.ok(names.some((n) => n.endsWith('.pdf')), 'ZIP missing pdf');
  const zipCsv = await allZip.file(names.find((n) => n.endsWith('.csv'))!)!.async('string');
  assert.ok(!/pakistan/i.test(zipCsv), 'ZIP CSV must not contain Pakistan');
  const zipPdf = await allZip.file(names.find((n) => n.endsWith('.pdf'))!)!.async('nodebuffer');
  const zipPdfText = extractPdfText(zipPdf as Buffer);
  assert.ok(pdfTextContains(zipPdfText, 'Alpha Medisys'), 'ZIP PDF has importer');
  assert.ok(!/ZETA\s?PHARMA/i.test(zipPdfText.replace(/\s+/g, ' ')), 'ZIP PDF no Pakistan');
  fs.writeFileSync(path.join(SCRATCH, 'international_importer_directory_all.zip'), all.buffer as Buffer);

  console.log('international_importer_directory OK');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
