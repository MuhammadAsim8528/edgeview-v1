import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { db } from '../db';
import { getDb, flushInitializedDatabase, resetDbInstanceForTests } from '../sqlite';
import { TradeRelationshipResolver } from '../trade_relationship_resolver';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'edgeview-dense-products-'));
process.env.EDGEVIEW_TEST_MODE = '1';
process.env.EDGEVIEW_TEST_DB_DIR = root;
process.env.EDGEVIEW_SQLITE_DB = path.join(root, 'operations.db');
process.env.EDGEVIEW_JSON_DB = path.join(root, 'rows.json');
async function main() {
  try {
    const products = Array.from({ length: 3200 }, (_, i) => `Product-${i}-${'x'.repeat(1800)}`);
    products.push('Product', products[0]); // Substring is a distinct product; exact duplicate is not.
    const rows = products.map(Item => ({ Importer: 'Synthetic Buyer Δ', Country: 'Kenya', Exporter: 'Synthetic Supplier', Item, TOT_FC: 1 }));
    db.files.set('dense', { id: 'dense', name: 'dense.csv', file_type: 'CSV', size: 0, upload_time: new Date().toISOString(), columns: Object.keys(rows[0]), rows, summary: {} as any });
    const sql = await getDb();
    await sql.run('INSERT INTO history_data (importer, exporter, country, item, tot_fc, file_name) VALUES (?, ?, ?, ?, ?, ?)', ['Synthetic Buyer Δ', 'Synthetic Supplier', 'Kenya', products[0], 1, 'dense.csv']);
    await sql.run('INSERT INTO history_data (importer, exporter, country, item, tot_fc, file_name) VALUES (?, ?, ?, ?, ?, ?)', ['Synthetic Buyer Δ', 'Synthetic Supplier', 'Kenya', 'History-only product', 2, 'archived.csv']);
    const started = performance.now();
    const index = await TradeRelationshipResolver.buildTradeIndex();
    const elapsed = performance.now() - started;
    const result = TradeRelationshipResolver.resolveFromIndex('Synthetic Buyer Δ', index, 'importer', 'Kenya').importedFrom;
    assert.equal(result.length, 1);
    assert.deepEqual(result[0].itemDescription?.split(', '), [...new Set(products), 'History-only product']);
    assert.equal(result[0].shipmentCount, rows.length + 1, 'loaded SQLite copy must not duplicate shipments');
    assert.equal(result[0].totalVal, rows.length + 2);
    assert.equal(TradeRelationshipResolver.resolveFromIndex('Synthetic Buyer Δ', index, 'importer', 'Pakistan').importedFrom.length, 0);
    assert.ok(elapsed < 10000, 'dense index must not regress to repeated multi-megabyte string scans');
    const readHistory = sql.all;
    try {
      sql.all = async () => { throw new Error('SYNTHETIC_PRIVATE_HISTORY_FAILURE'); };
      await assert.rejects(TradeRelationshipResolver.buildTradeIndex(), error => error instanceof Error
        && (error as NodeJS.ErrnoException).code === 'TRADE_HISTORY_UNAVAILABLE'
        && !error.message.includes('SYNTHETIC_PRIVATE_HISTORY_FAILURE'), 'unavailable archived history must not silently publish a partial trade index');
    } finally { sql.all = readHistory; }
    const recovered = await TradeRelationshipResolver.buildTradeIndex();
    assert.equal(TradeRelationshipResolver.resolveFromIndex('Synthetic Buyer Δ', recovered, 'importer', 'Kenya').importedFrom[0].shipmentCount, rows.length + 1, 'retry must recover the complete stored history after the database read is repaired');
    console.log(`PASS dense 3200-product index, exact deduplication, substring preservation, history and country scope (${Math.round(elapsed)}ms)`);
  } finally {
    db.files.clear();
    await flushInitializedDatabase();
    resetDbInstanceForTests();
    fs.rmSync(root, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
