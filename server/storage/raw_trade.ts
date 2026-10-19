/** Raw trade storage is separate from operational contacts and evidence.
 * Implementations must page in storage and never materialize a full dataset.
 */
export interface RawTradeRow {
  source_row: number;
  company: string;
  country: string;
  date: string;
  product: string;
  raw: Readonly<Record<string, unknown>>;
}
export const TRADE_COLUMNS = ['source_row', 'company', 'country', 'date', 'product', 'raw'] as const;
export type TradeColumn = typeof TRADE_COLUMNS[number];
export interface TradeQuery {
  dataset: string;
  country?: string;
  company?: string;
  from?: string;
  to?: string;
  product?: string;
  after?: number;
  limit?: number;
  columns?: readonly TradeColumn[];
}
export interface RawTradeWarehouse {
  ingest(dataset: string, rows: AsyncIterable<RawTradeRow>): Promise<{ inserted: number; checkpoint: number }>;
  page(query: TradeQuery): Array<Partial<RawTradeRow>>;
  stream(query: Omit<TradeQuery, 'after' | 'limit'>): AsyncIterable<Partial<RawTradeRow>>;
  count(dataset: string): number;
  checkpoint(dataset: string): number;
  close(): void;
}
