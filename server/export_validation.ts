export class ExportValidationError extends Error {
  constructor(message: string) { super(message); this.name = 'ExportValidationError'; }
}
const record = (value: unknown): value is Record<string, any> => Boolean(value && typeof value === 'object' && !Array.isArray(value));

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
  if (Object.keys(input).some(key => !['dataset', 'title', 'filenamePrefix', 'format'].includes(key))) throw new ExportValidationError('Full-file export does not accept client rows, selections, filters or other overrides.');
  const payload = { dataset: 'files', records: rows, title: input.title, filenamePrefix: input.filenamePrefix, format: input.format };
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
