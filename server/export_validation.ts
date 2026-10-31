import { selectFileViewRows, FileViewValidationError } from './file_view';

export class ExportValidationError extends Error {
  constructor(message: string) { super(message); this.name = 'ExportValidationError'; }
}
const record = (value: unknown): value is Record<string, any> => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const validOptionalDate = (value: unknown) => value === undefined || value === '' || (typeof value === 'string'
  && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`))
  && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value);

export function resolveStoredReportExport(input: unknown, reports: ReadonlyMap<string, { title: string; report_type: string; columns?: string[]; rows?: Record<string, unknown>[]; content_text?: string }>) {
  if (!record(input) || input.dataset !== 'reports' || Object.keys(input).some(key => !['dataset','title','filenamePrefix','format','report_id'].includes(key))) throw new ExportValidationError('Report export requires a saved report ID without client content overrides.');
  if (typeof input.report_id !== 'string' || !input.report_id.trim() || input.report_id.length > 200) throw new ExportValidationError('Select a saved report before exporting.');
  const report = reports.get(input.report_id);
  if (!report || typeof report.title !== 'string') throw new ExportValidationError('Saved report is no longer available. Refresh before exporting.');
  let columns: Array<{ key: string; header: string }>;
  let records: Record<string, unknown>[];
  if (report.report_type === 'table') {
    const keys = report.columns;
    if (!Array.isArray(keys) || !keys.length || keys.length > 256 || new Set(keys).size !== keys.length
      || !keys.every(key => typeof key === 'string' && key.trim() && key.length <= 200)
      || !Array.isArray(report.rows) || !report.rows.length || !report.rows.every(record)) throw new ExportValidationError('Saved report table is invalid or empty.');
    columns = keys.map(key => ({ key, header: key }));
    records = report.rows.map(row => Object.fromEntries(keys.map(key => {
      const value = Object.hasOwn(row, key) ? row[key] : '';
      if (value !== null && value !== undefined && !['string','number','boolean'].includes(typeof value)) throw new ExportValidationError('Saved report contains unsupported cell values.');
      return [key, value ?? ''];
    })));
  } else {
    if (typeof report.content_text !== 'string' || !report.content_text.length) throw new ExportValidationError('Saved report has no text to export.');
    columns = [{ key: 'report_content', header: 'Report Content' }];
    records = [];
    // Excel cells have a finite text capacity. Preserve longer document text
    // in ordered continuation rows instead of truncating it or corrupting XLSX.
    for (let start = 0; start < report.content_text.length;) {
      let end = Math.min(start + 30000, report.content_text.length);
      if (end < report.content_text.length && /[\uD800-\uDBFF]/.test(report.content_text[end - 1])) end--;
      records.push({ report_content: report.content_text.slice(start, end) }); start = end;
    }
  }
  const payload = { dataset: 'reports', title: report.title, format: input.format, filenamePrefix: input.filenamePrefix, columns, records };
  validateExportRequest(payload);
  return payload;
}

/** Derived scope is explicit stored file IDs, never a client row union. */
export function resolveStoredDerivedExport(input: unknown, files: ReadonlyMap<string, { rows: Record<string, unknown>[] }>) {
  if (!record(input) || !['summary','country','stats'].includes(input.dataset)) throw new ExportValidationError('Unsupported stored dataset export.');
  if (Object.keys(input).some(key => !['dataset','title','filenamePrefix','format','source_file_ids', ...(input.dataset === 'stats' ? ['filters'] : [])].includes(key))) throw new ExportValidationError('Stored dataset export does not accept client rows or overrides.');
  let statsScope: { country: string; importer: string; startDate: string; endDate: string } | undefined;
  if (input.dataset === 'stats') {
    const filters = input.filters;
    if (!record(filters) || Object.keys(filters).some(key => !['country','importer','startDate','endDate'].includes(key))
      || typeof filters.importer !== 'string' || !filters.importer.trim() || filters.importer.length > 300
      || typeof filters.country !== 'string' || !filters.country.trim() || filters.country.length > 120
      || ['startDate','endDate'].some(key => !validOptionalDate(filters[key]))) throw new ExportValidationError('Invalid importer analytics scope.');
    statsScope = { country: filters.country.trim(), importer: filters.importer.trim(), startDate: filters.startDate || '', endDate: filters.endDate || '' };
    if (statsScope.startDate && statsScope.endDate && statsScope.startDate > statsScope.endDate) throw new ExportValidationError('Invalid analytics date range.');
  }
  const ids = input.source_file_ids;
  if (!Array.isArray(ids) || !ids.length || ids.length > 10000
    || !ids.every(id => typeof id === 'string' && id.trim() && id.length <= 200)
    || new Set(ids).size !== ids.length || (input.dataset === 'summary' && ids.length !== 1)) throw new ExportValidationError('Select a valid stored file scope before exporting.');
  const sources = ids.map(id => files.get(id));
  if (sources.some(file => !file || !Array.isArray(file.rows))) throw new ExportValidationError('Selected files are no longer available. Refresh before exporting.');
  const records: Record<string, unknown>[] = [];
  for (const source of sources) for (const row of source!.rows) records.push(row);
  if (!records.length) throw new ExportValidationError('No stored rows in this file scope.');
  const payload = { dataset: input.dataset, title: input.title, filenamePrefix: input.filenamePrefix, format: input.format, records };
  validateExportRequest(payload);
  return { ...payload, stats_scope: statsScope };
}

/** Browser records identify a scoped selection; their facts are never authority. */
export function resolveStoredContactExport(input: unknown, contacts: Array<{ id: string }>) {
  validateExportRequest(input);
  const payload = input as Record<string, any>;
  if (payload.dataset !== 'contacts') throw new ExportValidationError('Stored-contact export requires the contacts dataset.');
  if (!payload.records.length) throw new ExportValidationError('Select stored contacts before exporting.');
  const authoritative = new Map(contacts.map(contact => [contact.id, contact]));
  const seen = new Set<string>();
  const records = payload.records.map((candidate: Record<string, unknown>) => {
    const id = candidate.id;
    if (typeof id !== 'string' || !id.trim() || id.length > 200 || seen.has(id) || !authoritative.has(id)) {
      throw new ExportValidationError('Contact selection is invalid or no longer available. Refresh before exporting.');
    }
    seen.add(id);
    return authoritative.get(id)!;
  });
  let selectedRows = payload.selectedRows;
  if (selectedRows !== undefined) {
    if (!Array.isArray(selectedRows)) throw new ExportValidationError('Export selection must be an array.');
    selectedRows = selectedRows.map(item => typeof item === 'string' ? item : record(item) ? item.id : undefined);
    if (selectedRows.some(id => typeof id !== 'string' || !seen.has(id)) || new Set(selectedRows).size !== selectedRows.length) {
      throw new ExportValidationError('Contact selection is invalid or no longer available. Refresh before exporting.');
    }
  }
  return { ...payload, records, selectedRows };
}

/** Full-file export takes its rows exclusively from the authoritative store. */
export function resolveStoredFileExport(input: unknown, rows: any[]) {
  if (!record(input)) throw new ExportValidationError('Export payload must be an object.');
  if (input.dataset !== undefined && input.dataset !== 'files') throw new ExportValidationError('Stored-file export requires the files dataset.');
  if (Object.keys(input).some(key => !['dataset', 'title', 'filenamePrefix', 'format', 'view'].includes(key))) throw new ExportValidationError('Full-file export does not accept client rows, selections, filters or other overrides.');
  let selected = rows;
  if (input.view !== undefined) {
    try { selected = selectFileViewRows(rows, input.view); }
    catch (error) { if (error instanceof FileViewValidationError) throw new ExportValidationError(error.message); throw error; }
    if (!selected.length) throw new ExportValidationError('No stored rows match this file view.');
    if (input.view.group_shipments === 'true' || input.view.group === 'true') {
      // Grouping retains a sample row for display context. Do not let its raw
      // ITEM/TOT_FC aliases override the computed grouped item/amount in export.
      selected = selected.map(row => ({ Date: row.Date, Importer: row.Importer,
        Country: row.Country, Exporter: row.Exporter, Item: row.Item,
        'Total FC (USD)': row['Total FC (USD)'] }));
    }
  }
  const payload = { dataset: 'files', records: selected, title: input.title, filenamePrefix: input.filenamePrefix, format: input.format };
  validateExportRequest(payload);
  return payload;
}

export function validateExportFilenamePart(value: unknown): void {
  if (value === undefined) return;
  // Check both platforms' separators and Windows drive/ADS/device syntax even
  // when tests or a future deployment run on another platform. Never decode or
  // silently strip input: a rejected prefix must not select a different path.
  if (typeof value !== 'string' || /[\\/:*?"<>|\u0000-\u001f\u007f]/u.test(value)) {
    throw new ExportValidationError('Export filename prefix must be a plain name without path separators or control characters.');
  }
}

export function validateExportRequest(payload: unknown): void {
  if (!record(payload)) throw new ExportValidationError('Export payload must be an object.');
  if (!['files','contacts','outreach','country','reports','stats','summary'].includes(payload.dataset)) throw new ExportValidationError('Unsupported export dataset.');
  if (!['pdf','docx','xlsx','csv','all'].includes(payload.format)) throw new ExportValidationError('Unsupported export format.');
  if (!Array.isArray(payload.records) || !payload.records.every(record)) throw new ExportValidationError('Export records must be an array of objects.');
  for (const key of ['title', 'filenamePrefix']) if (payload[key] !== undefined && typeof payload[key] !== 'string') throw new ExportValidationError(`Export ${key} must be text.`);
  validateExportFilenamePart(payload.filenamePrefix);
  if (payload.report_type !== undefined && !['importer','exporter','both','international_importer'].includes(payload.report_type)) throw new ExportValidationError('Unsupported contact report type.');
  if (payload.columns !== undefined && (!Array.isArray(payload.columns) || !payload.columns.every(column => record(column) && typeof column.key === 'string' && typeof column.header === 'string'))) throw new ExportValidationError('Invalid export columns.');
}

export function selectExportRecords(payload: { records: any[]; selectedRows?: unknown }): any[] {
  const selected = payload.selectedRows;
  if (selected === undefined || (Array.isArray(selected) && selected.length === 0)) return payload.records;
  if (!Array.isArray(selected)) throw new ExportValidationError('Export selection must be an array.');
  if (selected.every(item => typeof item === 'string')) {
    const ids = new Set(selected);
    const matchedIds = new Set<string>();
    const matches = payload.records.filter(row => {
      const id = row.id || row.company_id || row._id;
      if (!ids.has(id)) return false;
      matchedIds.add(id); return true;
    });
    if (matchedIds.size !== ids.size) throw new ExportValidationError('Selected records are no longer available. Refresh the selection before exporting.');
    return matches;
  }
  if (!selected.every(record)) throw new ExportValidationError('Export selection must contain only record objects or only IDs.');
  return selected;
}
