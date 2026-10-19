import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { setImmediate as yieldToLoop } from 'node:timers/promises';
import { TRADE_COLUMNS, type RawTradeRow, type RawTradeWarehouse, type TradeQuery } from './raw_trade';

/** Candidate disk-backed baseline. Run in a dedicated worker/process for UI use:
 * node:sqlite is synchronous. This adapter is not wired into production startup.
 */
export class SqliteTradeWarehouse implements RawTradeWarehouse {
  private readonly db: DatabaseSync;
  constructor(file: string) {
    if (file === ':memory:') throw new Error('Raw trade warehouse requires a disk-backed file.');
    this.db = new DatabaseSync(file);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA cache_size=-16384;
      PRAGMA temp_store=FILE; PRAGMA busy_timeout=3000;
      CREATE TABLE IF NOT EXISTS trade_rows (
        dataset TEXT NOT NULL, source_row INTEGER NOT NULL, company TEXT NOT NULL,
        country TEXT NOT NULL, date TEXT NOT NULL, product TEXT NOT NULL,
        raw TEXT NOT NULL, digest TEXT NOT NULL, PRIMARY KEY(dataset, source_row)
      ) WITHOUT ROWID;
      CREATE INDEX IF NOT EXISTS trade_country_date ON trade_rows(dataset,country,date,source_row);
      CREATE INDEX IF NOT EXISTS trade_company ON trade_rows(dataset,company,source_row);
      CREATE TABLE IF NOT EXISTS trade_checkpoints(dataset TEXT PRIMARY KEY, source_row INTEGER NOT NULL);`);
  }
  private validateDataset(dataset: string): void {
    if (typeof dataset !== 'string' || !dataset.trim() || dataset.length > 200) throw new Error('Invalid dataset identity.');
  }
  checkpoint(dataset: string): number {
    this.validateDataset(dataset);
    return Number(this.db.prepare('SELECT source_row FROM trade_checkpoints WHERE dataset=?').get(dataset)?.source_row || 0);
  }
  count(dataset: string): number {
    this.validateDataset(dataset);
    return Number(this.db.prepare('SELECT COUNT(*) AS count FROM trade_rows WHERE dataset=?').get(dataset)?.count || 0);
  }
  async ingest(dataset: string, rows: AsyncIterable<RawTradeRow>): Promise<{ inserted: number; checkpoint: number }> {
    this.validateDataset(dataset);
    const insert = this.db.prepare('INSERT INTO trade_rows VALUES(?,?,?,?,?,?,?,?)');
    const existing = this.db.prepare('SELECT digest FROM trade_rows WHERE dataset=? AND source_row=?');
    const progress = this.db.prepare('INSERT INTO trade_checkpoints VALUES(?,?) ON CONFLICT(dataset) DO UPDATE SET source_row=MAX(source_row,excluded.source_row)');
    let inserted = 0;
    let previous = 0;
    let batch: RawTradeRow[] = [];
    let batchBytes = 0;
    const flush = () => {
      if (!batch.length) return;
      let committed = 0;
      this.db.exec('BEGIN IMMEDIATE');
      try {
        for (const row of batch) {
          if (!Number.isSafeInteger(row.source_row) || row.source_row < 1) throw new Error('Invalid source row identity.');
          for (const field of ['company', 'country', 'date', 'product'] as const) {
            if (typeof row[field] !== 'string' || row[field].length > 10000) throw new Error(`Invalid ${field}.`);
          }
          const raw = JSON.stringify(row.raw);
          if (!raw || Buffer.byteLength(raw) > 1024 * 1024) throw new Error('Raw row exceeds the 1 MB boundary.');
          const digest = createHash('sha256').update(JSON.stringify([row.company,row.country,row.date,row.product,raw])).digest('hex');
          const found = existing.get(dataset, row.source_row);
          if (found) {
            if (found.digest !== digest) throw new Error('Source row changed; use a new dataset identity.');
          } else {
            insert.run(dataset,row.source_row,row.company,row.country,row.date,row.product,raw,digest);
            committed += 1;
          }
          progress.run(dataset, row.source_row);
        }
        this.db.exec('COMMIT');
        inserted += committed;
      } catch (error) {
        this.db.exec('ROLLBACK');
        throw error;
      }
      batch = [];
      batchBytes = 0;
    };
    for await (const row of rows) {
      if (!Number.isSafeInteger(row.source_row) || row.source_row <= previous) throw new Error('Source rows must arrive in increasing order.');
      if (!row.raw || typeof row.raw !== 'object' || Array.isArray(row.raw)) throw new Error('Raw row must retain a source-field object.');
      previous = row.source_row;
      const snapshot = JSON.stringify(row);
      const bytes = Buffer.byteLength(snapshot);
      if (bytes > 1024 * 1024) throw new Error('Raw row exceeds the 1 MB boundary.');
      if (batchBytes + bytes > 4 * 1024 * 1024) { flush(); await yieldToLoop(); }
      batch.push(JSON.parse(snapshot) as RawTradeRow);
      batchBytes += bytes;
      if (batch.length >= 500) { flush(); await yieldToLoop(); }
    }
    flush();
    return { inserted, checkpoint: this.checkpoint(dataset) };
  }
  page(query: TradeQuery): Array<Partial<RawTradeRow>> {
    this.validateDataset(query.dataset);
    const limit = query.limit ?? 100;
    const after = query.after ?? 0;
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1000) throw new Error('Page size must be 1–1000.');
    if (!Number.isSafeInteger(after) || after < 0) throw new Error('Invalid page cursor.');
    const columns = query.columns ?? TRADE_COLUMNS;
    if (!columns.length || columns.some(column => !TRADE_COLUMNS.includes(column))) throw new Error('Unknown projection column.');
    const clauses = ['dataset=?', 'source_row>?'];
    const params: SQLInputValue[] = [query.dataset, after];
    for (const field of ['country', 'company'] as const) {
      if (query[field] !== undefined) { clauses.push(`${field}=?`); params.push(query[field]!); }
    }
    for (const [field, operator] of [['from','>='], ['to','<=']] as const) {
      if (query[field] !== undefined) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(query[field]!)) throw new Error('Date filter requires YYYY-MM-DD.');
        clauses.push(`date${operator}?`); params.push(query[field]!);
      }
    }
    if (query.product !== undefined) {
      clauses.push("product LIKE ? ESCAPE '\\'");
      params.push(`%${query.product.replace(/[\\%_]/g, '\\$&')}%`);
    }
    params.push(limit);
    const records = this.db.prepare(`SELECT ${columns.join(',')} FROM trade_rows WHERE ${clauses.join(' AND ')} ORDER BY source_row LIMIT ?`).all(...params);
    return records.map(record => ({ ...record, ...(columns.includes('raw') ? { raw: JSON.parse(String(record.raw)) } : {}) })) as Array<Partial<RawTradeRow>>;
  }
  async *stream(query: Omit<TradeQuery, 'after' | 'limit'>): AsyncIterable<Partial<RawTradeRow>> {
    let after = 0;
    const requested = query.columns ?? TRADE_COLUMNS;
    const columns = [...new Set([...requested, 'source_row' as const])];
    while (true) {
      const rows = this.page({ ...query, columns, after, limit: 500 });
      if (!rows.length) break;
      for (const row of rows) {
        after = row.source_row!;
        if (!requested.includes('source_row')) delete row.source_row;
        yield row;
      }
      await yieldToLoop();
    }
  }
  close(): void { this.db.close(); }
}
