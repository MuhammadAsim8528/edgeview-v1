import { normalizeRow, groupShipmentRows } from './grouping';

export class FileViewValidationError extends Error {}
const viewKeys = ['search','sort_by','sort_dir','group_shipments','group','product','country','importer','start_date','end_date'];

/** Shared derived view for paging and export; input never supplies row values. */
export function selectFileViewRows(storedRows: Record<string, unknown>[], input: unknown, allowPaging = false) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new FileViewValidationError('File view must be an object.');
  const view = input as Record<string, string>;
  for (const [key, value] of Object.entries(view)) {
    if (allowPaging && ['limit','offset'].includes(key)) continue;
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

  let rows = storedRows.map(normalizeRow);

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
      const d = String(r.Date || r.date || '').trim();
      if (!d) return true;
      if (startDate && d < startDate) return false;
      if (endDate && d > endDate) return false;
      return true;
    });
  }

  if (search) {
    rows = rows.filter((r) =>
      Object.values(r).some((v) => String(v).toLowerCase().includes(search))
    );
  }

  if (sortBy) {
    rows = [...rows].sort((a, b) => {
      const valA = a[sortBy];
      const valB = b[sortBy];
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

  return rows;
}
