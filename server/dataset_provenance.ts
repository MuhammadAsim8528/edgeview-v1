import type { FileRecord } from './db';

const PAKISTAN_EXPORT_PORTS = /^(?:KP|LP|IP|PK|PQ|TL|QC|MP|SP|QT|GB|PP|SK)[A-Z]{2}$/i;

/**
 * Detect the Pakistan customs export schema without relying on a user's file
 * name alone. Destination COUNTRY/ORIGIN belongs to the foreign importer; the
 * exporter country is supplied only when the file has Pakistan valuation
 * fields and a strong majority of recognizable Pakistan export port codes.
 */
export function inferExporterCountryFromDataset(file: Pick<FileRecord, 'columns' | 'rows'>): string {
  const columns = new Set((file.columns || []).map((value) => String(value).trim().toUpperCase()));
  const hasPakistanValuation = columns.has('DV_PAK') && columns.has('AV_PAK');
  const hasTradeParties = columns.has('IMPORTER') && columns.has('EXPORTER') && columns.has('COUNTRY');
  if (!hasPakistanValuation || !hasTradeParties) return '';

  const ports = (file.rows || [])
    .map((row) => String(row.PORT || row.port || '').trim())
    .filter(Boolean);
  if (ports.length < 10) return '';
  const pakistanPortRatio = ports.filter((port) => PAKISTAN_EXPORT_PORTS.test(port)).length / ports.length;
  return pakistanPortRatio >= 0.9 ? 'Pakistan' : '';
}
