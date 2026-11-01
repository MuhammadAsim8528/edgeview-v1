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
  if (payload.dataset === 'contacts') {
    const idOf = (value: unknown): string => {
      const id = typeof value === 'string' ? value : value && typeof value === 'object' ? (value as { id?: unknown }).id : undefined;
      if (typeof id !== 'string' || !id.trim() || id.length > 200) throw new Error('Refresh contacts before exporting an invalid selection.');
      return id;
    };
    if (!Array.isArray(payload.records) || !payload.records.length) throw new Error('Select stored contacts before exporting.');
    const scopeIds = payload.records.map(idOf), scope = new Set(scopeIds);
    if (scope.size !== scopeIds.length) throw new Error('Refresh contacts before exporting a duplicate selection.');
    if (payload.selectedRows !== undefined && !Array.isArray(payload.selectedRows)) throw new Error('Invalid contact export selection.');
    const ids = payload.selectedRows?.length ? payload.selectedRows.map(idOf) : scopeIds;
    if (new Set(ids).size !== ids.length || ids.some(id => !scope.has(id))) throw new Error('Refresh contacts before exporting an unavailable selection.');
    // This existing server contract resolves these IDs to stored contacts.
    // Never serialize enrichment/trade/evidence objects back to the server.
    return { url: '/api/export', body: { ...common, records: ids.map(id => ({ id })),
      report_type: reportType ?? payload.defaultReportType ?? 'importer' } };
  }
  return { url: '/api/export', body: { ...common, records: payload.records, columns: payload.columns,
    selectedRows: payload.selectedRows, filters: payload.filters, report_type: payload.dataset === 'contacts' ? reportType ?? payload.defaultReportType ?? 'importer' : undefined } };
}
