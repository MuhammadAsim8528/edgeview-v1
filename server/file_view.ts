import { normalizeRow, groupShipmentRows } from './grouping';

export class FileViewValidationError extends Error {}
const viewKeys = ['search','sort_by','sort_dir','group_shipments','group','product','country','importer','start_date','end_date'];

export const FILE_VIEW_SORT_KEYS: Record<string, string> = {
  date: 'Date', importer: 'Importer', country: 'Country', exporter: 'Exporter',
  item: 'Item', total_fc_usd: 'Total Value (USD)',
};

export function canonicalFileViewSortKey(key: string): string {
  return FILE_VIEW_SORT_KEYS[key] || key;
}

function dayKey(year: number, month: number, day: number): number | null {
  if (![year, month, day].every(Number.isInteger) || year < 1000 || year > 9999 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCFullYear(year);
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return year * 10000 + month * 100 + day;
}

/** A timezone-stable calendar-day key shared by file filtering and sorting. */
export function parseFileViewDateKey(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : dayKey(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate());
  const text = String(value).trim();
  if (!text || text === 'N/A' || text.startsWith('####')) return null;

  const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:$|[T\s])/);
  if (iso) return dayKey(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  if (/^\d{8}$/.test(text) && /^(19|20)/.test(text)) {
    return dayKey(Number(text.slice(0, 4)), Number(text.slice(4, 6)), Number(text.slice(6, 8)));
  }
  if (/^\d+(?:\.\d+)?$/.test(text)) {
    const serial = Number(text);
    if (serial >= 1000 && serial <= 90000) {
      const date = new Date(Date.UTC(1899, 11, 30) + Math.floor(serial) * 86400000);
      return dayKey(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
    }
  }

  const parts = text.split(/[\/\-\.\s]+/);
  if (parts.length >= 3) {
    const monthNames = ['january','february','march','april','may','june','july','august','september','october','november','december'];
    const month = monthNames.findIndex(name => name.startsWith(parts[1].toLowerCase() || 'xyz'));
    if (month !== -1 && /^\d{1,2}$/.test(parts[0]) && /^\d{4}$/.test(parts[2])) {
      return dayKey(Number(parts[2]), month + 1, Number(parts[0]));
    }
    if (parts.slice(0, 3).every(part => /^\d+$/.test(part))) {
      const first = Number(parts[0]);
      const second = Number(parts[1]);
      const third = Number(parts[2]);
      if (parts[0].length === 4) return dayKey(first, second, third);
      if (parts[2].length === 4) {
        // Match the viewer's established day-first interpretation, switching
        // only when the second component cannot be a month.
        return second > 12 && first <= 12 ? dayKey(third, first, second) : dayKey(third, second, first);
      }
    }
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : dayKey(parsed.getUTCFullYear(), parsed.getUTCMonth() + 1, parsed.getUTCDate());
}

export function compareFileViewDates(a: unknown, b: unknown): number {
  const keyA = parseFileViewDateKey(a);
  const keyB = parseFileViewDateKey(b);
  if (keyA !== null && keyB !== null) return keyA - keyB;
  if (keyA !== null) return -1;
  if (keyB !== null) return 1;
  return String(a ?? '').toLowerCase().localeCompare(String(b ?? '').toLowerCase());
}

/** Shared derived view for paging and export; input never supplies row values. */
export function selectFileViewRows(storedRows: Record<string, unknown>[], input: unknown, allowPaging = false, retainSourceValues = false, positions?: WeakMap<Record<string, unknown>, number>) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new FileViewValidationError('File view must be an object.');
  const view = input as Record<string, string>;
  for (const [key, value] of Object.entries(view)) {
    if (allowPaging && ['limit','offset'].includes(key)) continue;
    if (allowPaging && key === 'source_values' && value === 'true') { retainSourceValues = true; continue; }
    if (!viewKeys.includes(key) || typeof value !== 'string' || value.length > 1000) throw new FileViewValidationError('Unsupported or invalid file view option.');
  }
  for (const key of ['group_shipments','group']) if (view[key] !== undefined && !['true','false'].includes(view[key])) throw new FileViewValidationError('Invalid shipment grouping option.');
  if (view.sort_dir !== undefined && !['asc','desc'].includes(view.sort_dir.toLowerCase())) throw new FileViewValidationError('Invalid sort direction.');
  const search = (view.search as string || '').toLowerCase().trim();
  const sortBy = view.sort_by as string;
  const sortDir = (view.sort_dir as string || 'asc').toLowerCase();

  const isGrouped = view.group_shipments === 'true' || view.group === 'true';
  const productFilter = (view.product as string || '').toLowerCase().trim();
  const countryFilter = (view.country as string || '').toLowerCase().trim();
  const importerFilter = (view.importer as string || '').toLowerCase().trim();
  const startDate = (view.start_date as string || '').trim();
  const endDate = (view.end_date as string || '').trim();
  const startDateKey = startDate ? parseFileViewDateKey(startDate) : null;
  const endDateKey = endDate ? parseFileViewDateKey(endDate) : null;
  if ((startDate && startDateKey === null) || (endDate && endDateKey === null)) throw new FileViewValidationError('Date bounds must be valid calendar dates.');

  if (retainSourceValues && isGrouped) throw new FileViewValidationError('Source columns require ungrouped rows.');
  const sourceByView = retainSourceValues ? new WeakMap<Record<string, unknown>, Record<string, unknown>>() : null;
  let rows = storedRows.map((row, index) => {
    const normalized = normalizeRow(row);
    if (!isGrouped) positions?.set(retainSourceValues ? row : normalized, index);
    sourceByView?.set(normalized, row);
    return normalized;
  });

  if (isGrouped) {
    rows = groupShipmentRows(rows);
  }

  if (productFilter) {
    rows = rows.filter((r) => String(r.Item || r.item || '').toLowerCase().includes(productFilter));
  }

  if (countryFilter) {
    rows = rows.filter((r) => String(r.Country || r.country || '').toLowerCase() === countryFilter);
  }

  if (importerFilter) {
    rows = rows.filter((r) => String(r.Importer || r.importer || '').toLowerCase() === importerFilter);
  }

  if (startDate || endDate) {
    rows = rows.filter((r) => {
      const rawDate = r.Date || r.date || '';
      const dateKey = parseFileViewDateKey(rawDate);
      // Keep rows without a recognizable date visible, as in the original
      // file-scoped view, while comparing all recognizable formats by day.
      if (dateKey === null) return true;
      if (startDateKey !== null && dateKey < startDateKey) return false;
      if (endDateKey !== null && dateKey > endDateKey) return false;
      return true;
    });
  }

  if (search) {
    rows = rows.filter((r) =>
      Object.values(r).some((v) => String(v).toLowerCase().includes(search))
    );
  }

  if (sortBy) {
    const sortKey = canonicalFileViewSortKey(sortBy);
    const isDateSort = sortKey === 'Date' || normalizeRow({ [sortBy]: true }).Date === true;
    const sortValue = (row: Record<string, unknown>) => {
      const source = sourceByView?.get(row);
      return source && Object.hasOwn(source, sortBy) ? source[sortBy] : row[sortKey];
    };
    rows = [...rows].sort((a, b) => {
      const valA = sortValue(a);
      const valB = sortValue(b);
      if (isDateSort) {
        const comparison = compareFileViewDates(valA, valB);
        return sortDir === 'asc' ? comparison : -comparison;
      }
      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortDir === 'asc' ? valA - valB : valB - valA;
      }
      const strA = String(valA ?? '').toLowerCase();
      const strB = String(valB ?? '').toLowerCase();
      if (strA < strB) return sortDir === 'asc' ? -1 : 1;
      if (strA > strB) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }

  return sourceByView ? rows.map(row => sourceByView.get(row)!) : rows;
}
