export type ActivityLogTab = 'system' | 'enrichment';
export interface ActivityLogRow { id: string; timestamp: string; level: string; subsystem: string; company: string; message: string; details: string }
const text = (value: unknown, limit = 4000) => typeof value === 'string' ? value.slice(0, limit) : '';

/** Bounded presentation only; immutable run evidence remains authoritative. */
export function normalizeActivityLogs(input: unknown, tab: ActivityLogTab): ActivityLogRow[] | null {
  if (!Array.isArray(input)) return null;
  const rows: Array<ActivityLogRow & { sortAt: number }> = [];
  const newest = (a: { sortAt: number }, b: { sortAt: number }) => b.sortAt - a.sortAt;
  for (const [index, entry] of input.entries()) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry) || typeof entry.message !== 'string') return null;
    const timestamp = text(entry.timestamp || entry.at, 100);
    const status = text(tab === 'system' ? entry.level : entry.status, 40).toUpperCase();
    rows.push({ id: `${text(entry.id, 200) || text(entry.run_id, 100) || tab}:${index}`,
      timestamp, level: status === 'FAILED' ? 'ERROR' : status || 'UNKNOWN',
      subsystem: text(tab === 'system' ? entry.subsystem : entry.stage || entry.step, 100) || 'UNKNOWN',
      company: text(entry.company_name, 300), message: text(entry.message), details: text(entry.details || entry.error),
      sortAt: Number.isFinite(Date.parse(timestamp)) ? Date.parse(timestamp) : -Infinity });
    // Keep at most 1,000 projected rows while scanning a larger response.
    if (rows.length === 1000) { rows.sort(newest); rows.length = 500; }
  }
  rows.sort(newest);
  return rows.slice(0, 500).map(({ sortAt: _sortAt, ...row }) => row);
}
