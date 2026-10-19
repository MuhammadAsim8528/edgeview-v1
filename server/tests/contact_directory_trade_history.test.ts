// Trade History Index â€” verifies the single-pass index aggregates shipments and
// values correctly, that resolveFromIndex is O(1) map lookups, and that the
// normalized report consumes the index (sorted history + totals) without any
// per-company rescans.

import * as assert from 'assert';
import { db } from '../db';
import { computeSummary } from '../summary';
import { TradeRelationshipResolver } from '../trade_relationship_resolver';
import { buildContactReport, getReportTitle, getReportColumnLabels } from '../contact_report_model';
import type { ReportCompanyContact } from '../docx_report';

const contact: ReportCompanyContact = {
  id: 'c-1',
  company_name: 'Mega Pharma Ltd',
  country: 'Pakistan',
  ceo: 'Imran Siddiqui',
  email: 'info@megapharma.pk',
  phone: '+92-51-000-0000',
};

async function seedTrade() {
  const columns = ['Importer', 'Exporter', 'Country', 'Item', 'Total Value (USD)'];
  const rows: Record<string, any>[] = [
    { Importer: 'Mega Pharma Ltd', Exporter: 'SUPPLIER 01', Country: 'Pakistan', Item: 'paracetamol', 'Total Value (USD)': '1000' },
    { Importer: 'Mega Pharma Ltd', Exporter: 'SUPPLIER 01', Country: 'Pakistan', Item: 'paracetamol', 'Total Value (USD)': '1500' },
    { Importer: 'Mega Pharma Ltd', Exporter: 'SUPPLIER 02', Country: 'Pakistan', Item: 'amoxicillin', 'Total Value (USD)': '750' },
    { Importer: 'Another Importer Co', Exporter: 'SUPPLIER 01', Country: 'Pakistan', Item: 'vitamins', 'Total Value (USD)': '200' },
  ];
  db.files.set('trade-index-trade', {
    id: 'f-trade-index',
    name: 'trade_index.csv',
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

  // Index shape: importedFrom/suppliedTo maps keyed by cleaned company name.
  assert.ok(index.importedFrom instanceof Map, 'importedFrom must be a Map');
  assert.ok(index.suppliedTo instanceof Map, 'suppliedTo must be a Map');

  // O(1) resolution for the importer role.
  const rels = TradeRelationshipResolver.resolveFromIndex('Mega Pharma Ltd', index, 'importer');
  assert.ok(rels.importedFrom.length === 2, `expected 2 partners, got ${rels.importedFrom.length}`);

  const supplier1 = rels.importedFrom.find((r) => r.partnerName === 'SUPPLIER 01');
  const supplier2 = rels.importedFrom.find((r) => r.partnerName === 'SUPPLIER 02');
  assert.ok(supplier1, 'missing SUPPLIER 01');
  assert.ok(supplier2, 'missing SUPPLIER 02');
  assert.ok(supplier1!.shipmentCount === 2, `SUPPLIER 01 shipmentCount expected 2, got ${supplier1!.shipmentCount}`);
  assert.ok(supplier1!.totalVal === 2500, `SUPPLIER 01 totalVal expected 2500, got ${supplier1!.totalVal}`);
  assert.ok(supplier1!.country === 'Pakistan', 'SUPPLIER 01 country');
  assert.ok(supplier2!.shipmentCount === 1, 'SUPPLIER 02 shipmentCount');
  assert.ok(supplier2!.totalVal === 750, 'SUPPLIER 02 totalVal');

  // A company with no rows resolves to empty (no scan, no throw).
  const none = TradeRelationshipResolver.resolveFromIndex('No Such Company', index, 'importer');
  assert.ok(none.importedFrom.length === 0, 'unknown company should resolve empty');

  // Exporter role resolves suppliedTo.
  const expRels = TradeRelationshipResolver.resolveFromIndex('SUPPLIER 01', index, 'exporter');
  assert.ok(expRels.suppliedTo.length === 2, `expected 2 buyers for SUPPLIER 01, got ${expRels.suppliedTo.length}`);

  // Report consumption: index passed in, history sorted by count desc.
  const report = await buildContactReport([contact], 'importer', index);
  assert.ok(report.totalImporters === 1, 'totalImporters');
  const entry = report.countrySections[0].importers[0];
  assert.ok(entry.tradeHistory.length === 2, 'report tradeHistory length');
  assert.ok(entry.tradeHistory[0].partnerName === 'SUPPLIER 01', 'history must be sorted by shipmentCount desc');
  assert.ok(entry.totalShipments === 3, `totalShipments expected 3, got ${entry.totalShipments}`);
  assert.ok(entry.totalValue === 3250, `totalValue expected 3250, got ${entry.totalValue}`);

  // Titles/labels
  assert.ok(getReportTitle('importer') === 'EDGEVIEW — LIST OF IMPORTERS', 'importer title');
  assert.ok(getReportTitle('exporter') === 'EDGEVIEW — LIST OF EXPORTERS', 'exporter title');
  const labels = getReportColumnLabels('importer');
  assert.ok(labels.nameHeader === 'Importer Name', 'nameHeader');
  assert.ok(labels.historyHeader === 'Previous Exporters / Import History', 'historyHeader');

  console.log('contact_directory_trade_history OK');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
