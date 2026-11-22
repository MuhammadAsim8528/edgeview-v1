import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import { generateGenericPdfReport, processFullDatasetExport } from '../export_manager';
import { generateInternationalImporterDirectoryPdf, generatePdfReport } from '../pdf_report';
import type { ContactReport } from '../contact_report_model';
import type { InternationalImporterDirectory } from '../international_importer_directory';
import { countPdfPages, extractPdfText, pdfTextContains } from './pdf_inspect';

const longCell = Array.from({ length: 90 }, (_, index) =>
  `SEGMENT_${String(index + 1).padStart(3, '0')}_PARACETAMOL_API_${'LONGPRODUCTCODE'.repeat(4)}`,
).join(' ') + ' FINAL_CELL_SENTINEL';
const longPdf = await generateGenericPdfReport('Long cells', [{ key: 'Item', header: 'Item' }], [{ Item: longCell }]);
assert.ok(countPdfPages(longPdf) > 1, 'a long cell must continue onto additional pages');
const longText = extractPdfText(longPdf);
for (let index = 1; index <= 90; index++) {
  const sentinel = `SEGMENT_${String(index).padStart(3, '0')}_PARACETAMOL_API`;
  assert.ok(pdfTextContains(longText, sentinel), `long PDF cell dropped ${sentinel}`);
}
assert.ok(pdfTextContains(longText, 'FINAL_CELL_SENTINEL'), 'long PDF cell dropped its final text');

// PDFKit writes a ToUnicode CMap only for glyphs actually used by an embedded
// font. Checking those mappings proves the non-Latin facts were encoded as their
// real code points, not substituted with .notdef/WinAnsi characters. This is
// content evidence, not a visual/layout acceptance claim.
function unicodeCMaps(pdf: Buffer): string {
  const source = pdf.toString('latin1');
  const maps: string[] = [];
  const streamPattern = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let match: RegExpExecArray | null;
  while ((match = streamPattern.exec(source)) !== null) {
    try {
      const inflated = zlib.inflateSync(Buffer.from(match[1], 'latin1')).toString('latin1');
      if (inflated.includes('beginbfrange')) maps.push(inflated);
    } catch {
      // Content streams are intentionally unrelated to this CMap assertion.
    }
  }
  return maps.join('\n').toLowerCase();
}

function assertUnicodeEncoded(pdf: Buffer, facts: string[]): void {
  const source = pdf.toString('latin1');
  assert.ok(source.includes('/Subtype /Type0'), 'Unicode facts require an embedded Type0 font');
  assert.ok(source.includes('/FontFile2'), 'Unicode font program must be embedded');
  assert.ok(source.includes('/ToUnicode'), 'Unicode font must have a reverse Unicode mapping');
  const maps = unicodeCMaps(pdf);
  assert.ok(maps.length > 0, 'generated PDF must contain a readable ToUnicode CMap');
  for (const fact of facts) {
    for (const char of new Set(Array.from(fact))) {
      const cp = char.codePointAt(0)!;
      if (cp <= 0x7f) continue;
      assert.ok(cp <= 0xffff, 'this fixture intentionally uses BMP non-Latin facts');
      const encoded = `<${cp.toString(16).padStart(4, '0')}>`;
      assert.ok(maps.includes(encoded), `PDF Unicode mapping is missing U+${cp.toString(16).toUpperCase()} from ${fact}`);
    }
  }
}

const genericUnicode = await generateGenericPdfReport(
  'Unicode 出口',
  [{ key: 'Fact', header: 'Fact' }],
  [{ Fact: '医药公司' }, { Fact: 'فارما کارپوریشن' }],
);
assertUnicodeEncoded(genericUnicode, ['医药公司', 'فارماکارپوریشن', '出口']);

const report: ContactReport = {
  reportType: 'importer', title: 'Unicode contact facts', totalImporters: 1,
  countrySections: [{ country: '中国', importers: [{
    country: '中国', sNo: 1, companyName: '中国医药有限公司', cleanName: '中国医药有限公司', role: 'Importer', totalShipments: 1, totalValue: 1,
    tradeHistory: [{ partnerName: '供应商', country: '中国', itemDescription: '药品', shipmentCount: 1, totalVal: 1 }],
    leadership: [{ name: 'خالد', designation: 'مدیر', emails: [], phones: [], sources: [] }],
    contactInfo: { addresses: [{ address: 'فارما کارپوریشن' }], emails: [], phones: [], fax_numbers: [], linkedin_urls: [], socials: [], sources: [] },
  }] }],
};
const contactUnicode = await generatePdfReport([], 'importer', undefined, report);
assertUnicodeEncoded(contactUnicode, ['中国医药有限公司', '供应商', '药品', 'فارماکارپوریشن', 'خالد', 'مدیر']);

const directory: InternationalImporterDirectory = {
  title: 'International 出口',
  countrySections: [{ country: '中国', importers: [{
    country: '中国', importer: '医药公司', tradedWith: '• 供应商', topProducts: '• 药品', website: '', email: '',
    phone: '', address: 'فارما کارپوریشن', leadership: 'خالد', sources: '', sNo: 1,
  }] }],
  totalImporters: 1,
  excluded: { country: 'Pakistan', count: 0 },
  topProductsLimit: 3,
};
const internationalUnicode = await generateInternationalImporterDirectoryPdf([], undefined, directory);
assertUnicodeEncoded(internationalUnicode, ['医药公司', '供应商', '药品', 'فارماکارپوریشن', 'خالد', '出口']);

const saved = await processFullDatasetExport({
  dataset: 'reports', title: 'Saved 出口', records: [{ Fact: '医药公司' }],
  columns: [{ key: 'Fact', header: 'Fact' }], format: 'pdf',
});
assert.ok(Buffer.isBuffer(saved.buffer));
assertUnicodeEncoded(saved.buffer as Buffer, ['医药公司', '出口']);

await assert.rejects(
  generateGenericPdfReport('Unsupported mixed run', [{ key: 'Fact', header: 'Fact' }], [{ Fact: '医药 فارما' }]),
  (error) => error instanceof Error && error.name === 'PDF_UNICODE_FONT_UNAVAILABLE',
  'an uncovered mixed-script run must fail rather than silently substitute glyphs',
);

console.log('PASS long-cell pagination and embedded Unicode mappings for generic/contact/international/saved PDFs; no visual acceptance claimed');
