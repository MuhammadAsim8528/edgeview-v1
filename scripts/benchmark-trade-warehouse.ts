import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { SqliteTradeWarehouse } from '../server/storage/sqlite_trade_warehouse';
import type { RawTradeRow } from '../server/storage/raw_trade';

const count = Number(process.argv[2] || 100000);
if (![100000, 1000000].includes(count)) throw new Error('Benchmark is capped at 100k or 1M synthetic rows.');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'edgeview-warehouse-bench-'));
const disk = fs.statfsSync(root);
if (Number(disk.bavail) * Number(disk.bsize) < 2 * 1024 ** 3) {
  fs.rmdirSync(root); throw new Error('Benchmark requires at least 2 GB free before starting.');
}
const file = path.join(root, 'synthetic.sqlite');
const store = new SqliteTradeWarehouse(file);
async function* rows(): AsyncIterable<RawTradeRow> {
  for (let i = 1; i <= count; i += 1) yield {
    source_row: i, company: `Synthetic Importer ${i % 10000}`, country: ['Kenya','Sri Lanka','Uganda','Egypt'][i % 4],
    date: `2026-${String(i % 12 + 1).padStart(2, '0')}-01`, product: `Synthetic product ${i % 100}`,
    raw: { importer: `Synthetic Importer ${i % 10000}`, quantity: i % 1000, value: (i % 5000) / 10, source: 'synthetic benchmark' },
  };
}
try {
  const started = performance.now();
  await store.ingest('synthetic-v1', rows());
  const ingestionMs = performance.now() - started;
  const queryStart = performance.now();
  const page = store.page({ dataset: 'synthetic-v1', country: 'Kenya', company: 'Synthetic Importer 100', limit: 100, columns: ['source_row','company','country'] });
  const queryMs = performance.now() - queryStart;
  const exportStart = performance.now();
  let exported = 0;
  let exportBytes = 0;
  for await (const row of store.stream({ dataset: 'synthetic-v1', columns: ['source_row','company','country','date','product','raw'] })) {
    // Serialize one row at a time to measure an export sink without storing a second large file.
    exportBytes += Buffer.byteLength(JSON.stringify(row)) + 1; exported += 1;
  }
  const exportMs = performance.now() - exportStart;
  const files = fs.readdirSync(root).map(name => fs.statSync(path.join(root, name)).size);
  console.log(JSON.stringify({ engine: 'node:sqlite disk candidate', node: process.version, platform: process.platform,
    rows: count, persisted: store.count('synthetic-v1'), ingestionMs, queryMs, queryRows: page.length,
    exportMs, exported, serializedExportBytes: exportBytes, exportRowsPerSecond: exported / (exportMs / 1000),
    peakRssMiB: process.resourceUsage().maxRSS / 1024, totalStoreBytes: files.reduce((sum, size) => sum + size, 0),
    caveat: 'One synthetic run; warm query; serialization sink, not disk export; not integrated into production UI.' }));
} finally { store.close(); fs.rmSync(root, { recursive: true, force: true }); }
