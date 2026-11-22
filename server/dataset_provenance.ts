import type { FileRecord } from './db';
import { normalizeCountryNameStrict } from '../src/utils/countryNormalizer';

const normalizedColumn = (value: unknown) => String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
const EXPORTER_COLUMNS = new Set(['EXPORTER', 'EXPORTER_NAME', 'SELLER', 'SELLER_NAME', 'SUPPLIER', 'SUPPLIER_NAME', 'SHIPPER']);
const EXPORTER_COUNTRY_COLUMNS = new Set(['EXPORTER_COUNTRY', 'EXPORTER_COUNTRY_CODE', 'SELLER_COUNTRY', 'SUPPLIER_COUNTRY']);

/**
 * Exporter country comes only from an explicit exporter-country field whose
 * affirmed value is complete and consistent for every populated exporter row.
 * Destination country, valuation columns and file-wide port ratios do not prove
 * each exporter's identity and therefore cannot supply this value.
 */
export function inferExporterCountryFromDataset(file: Pick<FileRecord, 'columns' | 'rows'>): string {
  const columns = (file.columns || []).map(original => ({ original, normalized: normalizedColumn(original) }));
  const exporter = columns.find(column => EXPORTER_COLUMNS.has(column.normalized));
  const country = columns.find(column => EXPORTER_COUNTRY_COLUMNS.has(column.normalized));
  if (!exporter || !country) return '';

  let inferred = '';
  let populatedExporters = 0;
  for (const row of file.rows || []) {
    if (!String(row[exporter.original] || '').trim()) continue;
    populatedExporters++;
    const explicit = normalizeCountryNameStrict(String(row[country.original] || ''));
    if (!explicit || (inferred && inferred !== explicit)) return '';
    inferred = explicit;
  }
  return populatedExporters ? inferred : '';
}
