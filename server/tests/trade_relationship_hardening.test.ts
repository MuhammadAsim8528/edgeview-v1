import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'edgeview-trade-hardening-'));
Object.assign(process.env, {
  EDGEVIEW_TEST_MODE: '1', EDGEVIEW_TEST_DB_DIR: root,
  EDGEVIEW_JSON_DB: path.join(root, 'rows.json'), EDGEVIEW_SQLITE_DB: path.join(root, 'operations.db'),
});

try {
  const { db } = await import('../db');
  const { getDb, flushInitializedDatabase, resetDbInstanceForTests } = await import('../sqlite');
  const { TradeRelationshipResolver } = await import('../trade_relationship_resolver');
  const { computeTopProducts } = await import('../international_importer_directory');
  const { computeSummary } = await import('../summary');
  db.files.clear(); db.contacts.clear(); db.rebuildIndexes();

  const addFile = (id: string, name: string, rows: Array<Record<string, unknown>>) => {
    const columns = ['Importer', 'Exporter', 'Country', 'Item', 'TOT_FC'];
    db.files.set(id, { id, name, file_type: 'CSV', size: 0, upload_time: new Date().toISOString(),
      columns, rows, summary: computeSummary(columns, rows) });
  };
  addFile('first', 'shared.csv', [
    { Importer: 'Frequency Buyer', Exporter: 'Supplier', Country: 'Kenya', Item: 'z recurring product', TOT_FC: 1 },
    { Importer: 'Frequency Buyer', Exporter: 'Supplier', Country: 'Kenya', Item: 'z recurring product', TOT_FC: 1 },
    { Importer: 'Frequency Buyer', Exporter: 'Supplier', Country: 'Kenya', Item: 'a single product', TOT_FC: 1 },
    { Importer: 'Kenya Buyer', Exporter: 'Shared Exporter', Country: 'Kenya', Item: 'Kenya product', TOT_FC: 1 },
  ]);
  addFile('second', 'shared.csv', [
    { Importer: 'Uganda Buyer', Exporter: 'Shared Exporter', Country: 'Uganda', Item: 'Uganda product', TOT_FC: 1 },
  ]);
  addFile('unique', 'unique.csv', [
    { Importer: 'Unique Buyer', Exporter: 'Unique Supplier', Country: 'Kenya', Item: 'Unique product', TOT_FC: 1 },
  ]);

  const sqlite = await getDb();
  await sqlite.run(`INSERT INTO history_data
    (file_id, file_name, importer, exporter, country, item, tot_fc) VALUES (NULL, ?, ?, ?, ?, ?, ?)`,
    ['shared.csv', 'Legacy Buyer', 'Legacy Supplier', 'Kenya', 'Legacy product', 1]);
  await sqlite.run(`INSERT INTO history_data
    (file_id, file_name, importer, exporter, country, item, tot_fc) VALUES (NULL, ?, ?, ?, ?, ?, ?)`,
    ['unique.csv', 'Unique Buyer', 'Unique Supplier', 'Kenya', 'Unique product', 1]);

  const index = await TradeRelationshipResolver.buildTradeIndex();
  const kenya = TradeRelationshipResolver.resolveFromIndex('Shared Exporter', index, 'exporter', 'Kenya').suppliedTo;
  const uganda = TradeRelationshipResolver.resolveFromIndex('Shared Exporter', index, 'exporter', 'Uganda').suppliedTo;
  assert.deepEqual(kenya.map(row => row.partnerName), ['Kenya Buyer'], 'exporter history is country-isolated');
  assert.deepEqual(uganda.map(row => row.partnerName), ['Uganda Buyer']);
  assert.equal(TradeRelationshipResolver.resolveFromIndex('Shared Exporter', index, 'exporter').suppliedTo.length, 2,
    'explicitly country-less compatibility still exposes both scoped branches');

  const frequency = TradeRelationshipResolver.resolveFromIndex('Frequency Buyer', index, 'importer', 'Kenya').importedFrom;
  assert.equal(frequency[0].shipmentCount, 3);
  assert.deepEqual(frequency[0].itemShipmentCounts, { 'z recurring product': 2, 'a single product': 1 });
  assert.deepEqual(computeTopProducts(frequency).split('\n'), ['• z recurring product', '• a single product'],
    'two shipments outrank one even when the unique product sorts first alphabetically');

  const legacy = TradeRelationshipResolver.resolveFromIndex('Legacy Buyer', index, 'importer', 'Kenya').importedFrom;
  assert.equal(legacy.length, 1, 'null-owner legacy history is preserved when its filename is ambiguous');
  const unique = TradeRelationshipResolver.resolveFromIndex('Unique Buyer', index, 'importer', 'Kenya').importedFrom;
  assert.equal(unique[0].shipmentCount, 1, 'a unique loaded filename still deduplicates its null-owner SQLite copy');

  const originalAll = sqlite.all;
  let historyReads = 0;
  sqlite.all = async (...args: Parameters<typeof sqlite.all>) => {
    historyReads++;
    return originalAll.apply(sqlite, args);
  };
  try {
    const scoped = await TradeRelationshipResolver.buildTradeIndex('first');
    assert.ok(historyReads > 0, 'scoped indexes still query scoped persisted history');
    assert.equal(TradeRelationshipResolver.resolveFromIndex('Legacy Buyer', scoped, 'importer', 'Kenya').importedFrom.length, 0,
      'ambiguous legacy ownership is not invented for a file-scoped export');
  } finally { sqlite.all = originalAll; }

  await flushInitializedDatabase(); resetDbInstanceForTests();
  db.files.clear(); db.contacts.clear(); db.rebuildIndexes();
  console.log('PASS exporter country isolation, exact product shipment recurrence, legacy ambiguity preservation and scoped-history reads');
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
