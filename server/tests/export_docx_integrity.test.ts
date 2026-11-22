import assert from 'node:assert/strict';
import JSZip from 'jszip';
import mammoth from 'mammoth';
import { generateDocxReport } from '../docx_report';
import { generateDocxReportStream, generateGenericDocxReportStream, generateInternationalImporterDirectoryDocx } from '../docx_stream';
import type { ContactReport } from '../contact_report_model';
import type { InternationalImporterDirectory } from '../international_importer_directory';

async function documentXml(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const entry = zip.file('word/document.xml');
  assert.ok(entry, 'DOCX must contain word/document.xml');
  return entry.async('string');
}

async function mammothText(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  assert.deepEqual(result.messages.filter((message) => message.type === 'error'), [], 'Mammoth must parse without XML errors');
  return result.value;
}

const generic = await generateGenericDocxReportStream(
  'R&D Report \u0001',
  [{ key: 'fact', header: 'A&B <header>' }],
  [{ fact: 'R&D &amp; <API> "quoted" \u0001\u000b 医药 😀' }],
);
const genericXml = await documentXml(generic);
assert.ok(genericXml.includes('<w:spacing w:after="0"/>'), 'spacing values must be attributes, not nested elements');
assert.ok(!genericXml.includes('<w:spacing <'), 'malformed spacing XML must not be emitted');
assert.ok(genericXml.includes('R&amp;D &amp;amp; &lt;API&gt;'), 'ampersands/markup must be escaped exactly once');
assert.ok(!genericXml.includes('R&amp;amp;D'), 'original ampersands must not be double escaped');
assert.ok(!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(genericXml), 'XML 1.0-forbidden controls must be removed');
const genericText = await mammothText(generic);
for (const expected of ['EdgeView — R&D Report', 'A&B <header>', 'R&D &amp; <API> "quoted"', '医药', '😀']) {
  assert.ok(genericText.includes(expected), `Mammoth lost literal DOCX text: ${expected}`);
}

const directory: InternationalImporterDirectory = {
  title: 'Directory & <Global>',
  countrySections: [{ country: 'Côte & 医药', importers: [{
    country: 'Côte & 医药', importer: 'R&D 医药', tradedWith: '• Supplier & Co', topProducts: '• API <A>',
    website: '', email: '', phone: '', address: '', leadership: '', sources: '', sNo: 1,
  }] }],
  totalImporters: 1,
  excluded: { country: 'Pakistan', count: 0 },
  topProductsLimit: 3,
};
const international = await generateInternationalImporterDirectoryDocx([], undefined, directory);
const internationalXml = await documentXml(international);
assert.ok(internationalXml.includes('CÔTE &amp; 医药'), 'international headings must be escaped exactly once');
assert.ok(!internationalXml.includes('CÔTE &amp;amp; 医药'), 'international headings must not be double escaped');
const internationalText = await mammothText(international);
for (const expected of ['Directory & <Global>', 'INTERNATIONAL IMPORTERS — CÔTE & 医药', 'R&D 医药', 'Supplier & Co', 'API <A>']) {
  assert.ok(internationalText.includes(expected), `international DOCX lost: ${expected}`);
}

const report: ContactReport = {
  reportType: 'importer', title: 'Synthetic legacy bullet', totalImporters: 1,
  countrySections: [{ country: 'Kenya', importers: [{
    country: 'Kenya', sNo: 1, companyName: 'R&D Pharma', cleanName: 'r&d pharma', role: 'Importer', totalShipments: 1, totalValue: 1,
    tradeHistory: [{ partnerName: 'Supplier & Co', country: 'Kenya', itemDescription: 'API', shipmentCount: 1, totalVal: 1 }],
    leadership: [],
    contactInfo: { addresses: [], emails: [], phones: [], fax_numbers: [], linkedin_urls: [], socials: [], sources: [{ url: 'https://example.test/evidence', title: 'Evidence & Report' }] },
  }] }],
};
const legacy = await generateDocxReport([], 'importer', undefined, report);
const streamed = await generateDocxReportStream([], 'importer', undefined, report);
for (const buffer of [legacy, streamed]) {
  const text = await mammothText(buffer);
  assert.ok(text.includes('• Supplier & Co'), 'contact DOCX must contain a real Unicode bullet');
  assert.ok(!text.includes('â€¢'), 'contact DOCX must not contain mojibake');
  assert.ok(text.includes('Evidence & Report (https://example.test/evidence)'), 'contact DOCX must retain source titles and URLs');
}

console.log('PASS Mammoth parsing, spacing XML, single escaping, XML controls, source titles, international headings, and legacy Unicode bullet');
