// PDF Pagination â€” proves that a single importer with large trade history,
// leadership, and source lists spans multiple pages WITHOUT dropping or clipping
// any content. This is the regression test for the old "one page per company +
// off-page clipping" bug.

import * as assert from 'assert';
import fs from 'fs';
import path from 'path';
import { db } from '../db';
import { computeSummary } from '../summary';
import { TradeRelationshipResolver } from '../trade_relationship_resolver';
import { generatePdfReport } from '../pdf_report';
import { countPdfPages, extractPdfText, pdfTextContains } from './pdf_inspect';
import type { ReportCompanyContact } from '../docx_report';

const SCRATCH = 'C:/Users/asimh/AppData/Local/Temp/opencode/edgeview_tests';
fs.mkdirSync(SCRATCH, { recursive: true });

// Build a large importer that comfortably overflows a single page.
function bigImporter(): ReportCompanyContact {
  const contact_persons = Array.from({ length: 30 }, (_, i) => ({
    name: `Executive ${i + 1}`,
    designation: `Role ${i + 1}`,
    email: `executive${i + 1}@megapharma.pk`,
    phone: `+1-000-000-00${(i + 1).toString().padStart(2, '0')}`,
  }));
  const sources = Array.from({ length: 15 }, (_, i) => ({
    url: `https://source-${i + 1}.example.com/report`,
    title: `Report ${i + 1}`,
  }));
  return {
    id: 'c-big',
    company_name: 'Mega Pharma Ltd',
    country: 'Pakistan',
    ceo: 'CEO Zero',
    email: 'info@megapharma.pk',
    phone: '+92-51-000-0000',
    address: 'Head Office, Islamabad',
    contact_persons,
    sources,
  };
}

async function seedTrade() {
  const columns = ['Importer', 'Exporter', 'Country', 'Item', 'Total Value (USD)'];
  const rows: Record<string, any>[] = [];
  for (let i = 1; i <= 40; i++) {
    rows.push({
      Importer: 'Mega Pharma Ltd',
      Exporter: `SUPPLIER ${String(i).padStart(2, '0')}`,
      Country: 'Pakistan',
      Item: 'paracetamol',
      'Total Value (USD)': '1000',
    });
  }
  db.files.set('pdf-pagination-trade', {
    id: 'f-pdf-pagination-trade',
    name: 'pdf_pagination_trade.csv',
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

  const contact = bigImporter();
  const buf = await generatePdfReport([contact], 'importer', index);

  fs.writeFileSync(path.join(SCRATCH, 'contact_directory_pdf_pagination.pdf'), buf);

  const pages = countPdfPages(buf);
  assert.ok(pages > 1, `expected multi-page PDF, got ${pages} page(s)`);

  const text = extractPdfText(buf);

  // Every leadership person must appear (30/30) â€” content is never dropped.
  for (let i = 1; i <= 30; i++) {
    assert.ok(pdfTextContains(text, `Executive ${i}`), `missing leadership person Executive ${i}`);
  }

  // The final (hardest-to-reach) trade partner must appear â€” nothing clipped.
  assert.ok(pdfTextContains(text, 'SUPPLIER 40'), 'missing last trade partner SUPPLIER 40');

  // The last source URL (the one the old renderer clipped) must appear.
  assert.ok(pdfTextContains(text, 'https://source-15.example.com/report'), 'missing last source URL');

  // Company name and continuation marker.
  assert.ok(pdfTextContains(text, 'MEGA PHARMA'), 'missing company name');
  assert.ok(pdfTextContains(text, 'continued'), 'missing continuation marker');

  console.log(`contact_directory_pdf_pagination OK (${pages} pages)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
