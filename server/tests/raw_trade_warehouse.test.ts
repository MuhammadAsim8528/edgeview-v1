import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { SqliteTradeWarehouse } from '../storage/sqlite_trade_warehouse';
import type { RawTradeRow, TradeColumn } from '../storage/raw_trade';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'edgeview-warehouse-test-'));
let store = new SqliteTradeWarehouse(path.join(root, 'trade.sqlite'));
async function* input(count: number): AsyncIterable<RawTradeRow> {
  for (let i = 1; i <= count; i += 1) yield { source_row: i, company: `Company ${i % 3}`, country: i % 2 ? 'Kenya' : 'Sri Lanka', date: '2026-10-01', product: 'Medicine 100%', raw: { importer: `Company ${i % 3}`, unknown_field: `retained-${i}` } };
}
try {
  const failedInput = async function* () { yield* input(501); throw new Error('source interrupted'); };
  await assert.rejects(store.ingest('dataset-a', failedInput()), /source interrupted/);
  assert.equal(store.count('dataset-a'), 500);
  assert.equal(store.checkpoint('dataset-a'), 500);
  store.close();
  store = new SqliteTradeWarehouse(path.join(root, 'trade.sqlite'));
  const resumed = await store.ingest('dataset-a', input(1001));
  assert.equal(resumed.inserted, 501);
  assert.equal(resumed.checkpoint, 1001);
  assert.equal(store.count('dataset-a'), 1001);
  assert.equal((await store.ingest('dataset-a', input(1001))).inserted, 0);
  const page = store.page({ dataset: 'dataset-a', country: 'Kenya', limit: 10, columns: ['source_row', 'raw'] });
  assert.equal(page.length, 10);
  assert.equal(page[0].raw?.unknown_field, 'retained-1');
  assert.equal(Object.hasOwn(page[0], 'company'), false, 'column pruning must happen at storage');
  const next = store.page({ dataset: 'dataset-a', country: 'Kenya', after: page[9].source_row, limit: 10 });
  assert.ok(next[0].source_row! > page[9].source_row!);
  assert.equal(store.page({ dataset: 'dataset-a', company: "' OR 1=1 --" }).length, 0);
  assert.equal(store.page({ dataset: 'dataset-a', product: '100%', limit: 1000 }).length, 1000);
  assert.throws(() => store.page({ dataset: 'dataset-a', limit: 1001 }), /Page size/);
  assert.throws(() => store.page({ dataset: 'dataset-a', columns: ['raw; DROP TABLE trade_rows' as TradeColumn] }), /Unknown projection/);
  let streamed = 0;
  for await (const row of store.stream({ dataset: 'dataset-a', columns: ['company'] })) {
    assert.deepEqual(Object.keys(row), ['company']); streamed += 1;
  }
  assert.equal(streamed, 1001);
  assert.equal(store.count('other-dataset'), 0);
  async function* changed() { for await (const row of input(1)) yield { ...row, company: 'Changed' }; }
  await assert.rejects(store.ingest('dataset-a', changed()), /Source row changed/);
  assert.equal(store.count('dataset-a'), 1001);
  console.log('PASS disk warehouse restart, resume, deduplication, raw retention, projection, cursor paging, streaming, validation and rollback.');
} finally { store.close(); fs.rmSync(root, { recursive: true, force: true }); }
