export class ExportValidationError extends Error {
  constructor(message: string) { super(message); this.name = 'ExportValidationError'; }
}
const record = (value: unknown): value is Record<string, any> => Boolean(value && typeof value === 'object' && !Array.isArray(value));

export function validateExportRequest(payload: unknown): void {
  if (!record(payload)) throw new ExportValidationError('Export payload must be an object.');
  if (!['files','contacts','outreach','country','reports','stats','summary'].includes(payload.dataset)) throw new ExportValidationError('Unsupported export dataset.');
  if (!['pdf','docx','xlsx','csv','all'].includes(payload.format)) throw new ExportValidationError('Unsupported export format.');
  if (!Array.isArray(payload.records) || !payload.records.every(record)) throw new ExportValidationError('Export records must be an array of objects.');
  for (const key of ['title', 'filenamePrefix']) if (payload[key] !== undefined && typeof payload[key] !== 'string') throw new ExportValidationError(`Export ${key} must be text.`);
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
