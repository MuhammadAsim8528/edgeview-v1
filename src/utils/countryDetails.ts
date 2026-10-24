import { safeFetchJson } from './safeFetch';

export interface CountrySummary { country: string; importers_count: number; total_export_value: number; exporters_count: number }
export interface ImporterItem { importer: string; total_export_value: number; exporters_count: number }
export interface ExporterDetail { exporter: string; product: string; quantity: number; unit: string; total_value: number }
type Result<T> = { ok: true; data: T } | { ok: false; error: string };
const count = (value: unknown) => Number.isSafeInteger(value) && Number(value) >= 0;
const scopeQuery = (fileId?: string) => fileId ? `?${new URLSearchParams({ file_id: fileId })}` : '';
const failure = { ok: false as const, error: 'Details could not be loaded. Please retry.' };

export async function loadCountryDetails(country: string, fileId: string | undefined, signal: AbortSignal, timeoutMs = 30_000): Promise<Result<{ summary: CountrySummary; importers: ImporterItem[] }>> {
  const init = { signal: AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]) };
  const prefix = `/api/countries/${encodeURIComponent(country)}`;
  const query = scopeQuery(fileId);
  const [summary, importers] = await Promise.all([safeFetchJson<CountrySummary>(`${prefix}/summary${query}`, init), safeFetchJson<ImporterItem[]>(`${prefix}/importers${query}`, init)]);
  const value = summary.data;
  if (!summary.ok || !importers.ok || !value || typeof value.country !== 'string' || value.country.toLowerCase() !== country.toLowerCase()
    || !count(value.importers_count) || !count(value.exporters_count) || !Number.isFinite(value.total_export_value)
    || !Array.isArray(importers.data) || !importers.data.every(item => item && typeof item.importer === 'string' && count(item.exporters_count) && Number.isFinite(item.total_export_value))) return failure;
  return { ok: true, data: { summary: value, importers: importers.data } };
}

export async function loadImporterDetails(country: string, importer: string, fileId: string | undefined, signal: AbortSignal, timeoutMs = 30_000): Promise<Result<ExporterDetail[]>> {
  const result = await safeFetchJson<ExporterDetail[]>(`/api/countries/${encodeURIComponent(country)}/${encodeURIComponent(importer)}/details${scopeQuery(fileId)}`, { signal: AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]) });
  if (!result.ok || !Array.isArray(result.data) || !result.data.every(row => row && typeof row.exporter === 'string' && typeof row.product === 'string'
    && typeof row.unit === 'string' && Number.isFinite(row.quantity) && Number.isFinite(row.total_value))) return failure;
  return { ok: true, data: result.data };
}
