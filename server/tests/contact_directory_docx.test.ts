// DOCX Directory Report â€” verifies the generated Word document contains the
// exact title banner, 5-column header row, country sections, per-country S.No,
// leadership details, trade partners, and full contact information with sources.

import * as assert from 'assert';
import fs from 'fs';
import os from 'node:os';
import path from 'path';
import JSZip from 'jszip';
import { db } from '../db';
import { computeSummary } from '../summary';
import { TradeRelationshipResolver } from '../trade_relationship_resolver';
import { generateDocxReport, type ReportCompanyContact } from '../docx_report';

const SCRATCH = fs.mkdtempSync(path.join(os.tmpdir(), 'edgeview-export-contract-'));

const fixture: ReportCompanyContact[] = [
  {
    id: 'c-1',
    company_name: 'Aurora Pharma Pty Ltd',
    country: 'Australia',
    ceo: 'Hannah Lee',
    email: 'info@aurorapharma.com.au',
    phone: '+61-2-5550-1010',
    address: 'Level 6, 100 George St, Sydney NSW',
    website: 'https://aurorapharma.com.au',
    contact_persons: [
      { name: 'Owen Reid', designation: 'Import Manager', email: 'owen@aurorapharma.com.au', phone: '+61-400-000-101' },
    ],
    sources: [{ url: 'https://source.com/aurora', title: 'Aurora Profile' }],
  },
  {
    id: 'c-2',
    company_name: 'Blue Peak Healthcare',
    country: 'Australia',
    ceo: 'Mia Thompson',
    email: 'hello@bluepeakhealth.com',
    phone: '+61-3-5550-2020',
    address: '12 Collins St, Melbourne VIC',
  },
  {
    id: 'c-3',
    company_name: 'Harare Medical Supplies',
    country: 'Zimbabwe',
    ceo: 'Tendai Moyo',
    email: 'info@hararemed.co.zw',
    phone: '+263-4-555-3030',
    address: '45 Samora Machel Ave, Harare',
    decision_makers: [
      { name: 'Rudo Chikore', designation: 'Procurement Lead', emails: [{ value: 'rudo@hararemed.co.zw' }] },
    ],
  },
];

async function seedTrade() {
  const columns = ['Importer', 'Exporter', 'Country', 'Item', 'Total Value (USD)'];
  const rows: Record<string, any>[] = [
    { Importer: 'Aurora Pharma Pty Ltd', Exporter: 'Sinochem Trading', Country: 'Australia', Item: 'API', 'Total Value (USD)': '5000' },
    { Importer: 'Harare Medical Supplies', Exporter: 'Bayer AG', Country: 'Zimbabwe', Item: 'vaccine', 'Total Value (USD)': '9000' },
  ];
  db.files.set('docx-trade', {
    id: 'f-docx-trade',
    name: 'docx_trade.csv',
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

  const buf = await generateDocxReport(fixture, 'importer', index);
  fs.writeFileSync(path.join(SCRATCH, 'contact_directory_docx.docx'), buf);

  const zip = await JSZip.loadAsync(buf);
  const xml = await zip.file('word/document.xml')!.async('string');

  // Title banner
  assert.ok(xml.includes('EDGEVIEW — LIST OF IMPORTERS'), 'missing title banner');

  // 5-column header row
  for (const h of [
    'S.No',
    'Importer Name',
    'Previous Exporters / Import History',
    'CEO / Leadership / Decision Makers',
    'Contact Information &amp; Address',
  ]) {
    assert.ok(xml.includes(h), `missing column header: ${h}`);
  }

  // Country sections (uppercased) with correct ordering
  const idxAustralia = xml.indexOf('AUSTRALIA');
  const idxZimbabwe = xml.indexOf('ZIMBABWE');
  assert.ok(idxAustralia >= 0, 'missing AUSTRALIA section');
  assert.ok(idxZimbabwe >= 0, 'missing ZIMBABWE section');
  assert.ok(idxAustralia < idxZimbabwe, 'country ordering: AUSTRALIA should precede ZIMBABWE');

  // Companies
  assert.ok(xml.includes('AURORA PHARMA'), 'missing company AURORA PHARMA');
  assert.ok(xml.includes('HARARE MEDICAL SUPPLIES'), 'missing company HARARE MEDICAL SUPPLIES');

  // S.No values
  assert.ok(xml.includes('>1<'), 'missing S.No 1');
  assert.ok(xml.includes('>2<'), 'missing S.No 2');

  // Leadership + contact details
  assert.ok(xml.includes('Owen Reid'), 'missing leadership person Owen Reid');
  assert.ok(xml.includes('owen@aurorapharma.com.au'), 'missing leadership email');
  assert.ok(xml.includes('Rudo Chikore'), 'missing decision maker Rudo Chikore');
  assert.ok(xml.includes('rudo@hararemed.co.zw'), 'missing decision maker email');

  // Trade partners from the index
  assert.ok(xml.includes('Sinochem Trading'), 'missing trade partner Sinochem Trading');
  assert.ok(xml.includes('Bayer AG'), 'missing trade partner Bayer AG');

  // Contact info + sources
  assert.ok(xml.includes('Level 6, 100 George St, Sydney NSW'), 'missing address');
  assert.ok(xml.includes('+61-2-5550-1010'), 'missing phone');
  assert.ok(xml.includes('https://source.com/aurora'), 'missing source url');

  console.log('contact_directory_docx OK');
}

main().finally(() => {
  assert.equal(path.dirname(fs.realpathSync(SCRATCH)), fs.realpathSync(os.tmpdir()));
  fs.rmSync(SCRATCH, { recursive: true, force: true });
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
