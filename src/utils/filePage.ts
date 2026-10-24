import { safeFetchJson } from './safeFetch';

export type FilePageResult = { ok: true; rows: any[]; total: number; filters: { countries: string[]; importers: string[] } } | { ok: false; error: string };

export async function loadFilePage(url: string, limit: number, offset: number, signal: AbortSignal, timeoutMs = 30_000): Promise<FilePageResult> {
  const timeout = AbortSignal.timeout(timeoutMs);
  const response = await safeFetchJson<any>(url, { signal: AbortSignal.any([signal, timeout]) });
  if (!response.ok) return { ok: false, error: timeout.aborted ? 'Loading timed out. Please retry.' : 'Could not load this page. Check that EdgeView is running and retry.' };
  const data = response.data;
  const rows = data?.rows;
  const total = data?.total_count;
  const filters = data?.filter_options ?? { countries: [], importers: [] };
  if (!Array.isArray(rows) || !Number.isSafeInteger(total) || total < 0
    || rows.length !== Math.min(limit, Math.max(0, total - offset))
    || rows.some(row => !row || typeof row !== 'object' || Array.isArray(row))
    || !filters || !['countries', 'importers'].every(key => Array.isArray(filters[key]) && filters[key].every((value: unknown) => typeof value === 'string'))) {
    return { ok: false, error: 'EdgeView returned an incomplete or invalid page. Please retry.' };
  }
  return { ok: true, rows, total, filters };
}
