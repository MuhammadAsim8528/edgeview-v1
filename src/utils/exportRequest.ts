import type { ExportFormat, GlobalExportPayload } from '../components/GlobalExportModal';

export function contactExportReportType(filter: string): 'importer' | 'exporter' | 'both' {
  return filter === 'EXPORTER' ? 'exporter' : filter === 'IMPORTER' ? 'importer' : 'both';
}

export function buildExportRequest(payload: GlobalExportPayload, format: ExportFormat, reportType?: string) {
  const common = { dataset: payload.dataset, title: payload.title, filenamePrefix: payload.filenamePrefix || 'EdgeView_Export', format };
  if (payload.sourceFileId !== undefined && payload.sourceFileIds !== undefined) throw new Error('Choose one stored export source.');
  if (payload.sourceFileId !== undefined) {
    if (payload.dataset !== 'files' || !payload.sourceFileId) throw new Error('Invalid stored-file export source.');
    if (payload.selectedRows?.length || (payload.filters && Object.keys(payload.filters).length)) throw new Error('Full-file export cannot apply a selection or filters. Use filtered export instead.');
    return { url: `/api/export/file/${encodeURIComponent(payload.sourceFileId)}`, body: { ...common, ...(payload.sourceView ? { view: payload.sourceView } : {}) } };
  }
  if (payload.dataset === 'files') throw new Error('File exports require a stored file reference.');
  if (payload.dataset === 'reports') {
    if (!payload.sourceReportId) throw new Error('Choose a saved report before exporting.');
    return { url: '/api/export', body: { ...common, report_id: payload.sourceReportId } };
  }
  if (['summary','country','stats'].includes(payload.dataset)) {
    if (!Array.isArray(payload.sourceFileIds) || !payload.sourceFileIds.length) throw new Error('Choose stored files before exporting.');
    return { url: '/api/export', body: { ...common, source_file_ids: payload.sourceFileIds, ...(payload.dataset === 'stats' ? { filters: payload.filters } : {}) } };
  }
  return { url: '/api/export', body: { ...common, records: payload.records, columns: payload.columns,
    selectedRows: payload.selectedRows, filters: payload.filters, report_type: payload.dataset === 'contacts' ? reportType ?? payload.defaultReportType ?? 'importer' : undefined } };
}
