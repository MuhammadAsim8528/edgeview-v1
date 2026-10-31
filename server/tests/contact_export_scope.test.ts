import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { GlobalExportModal } from '../../src/components/GlobalExportModal';
import { buildExportRequest, contactExportReportType } from '../../src/utils/exportRequest';

for (const [filter, expected] of [['EXPORTER', 'exporter'], ['IMPORTER', 'importer'], ['ALL', 'both'], ['ENRICHED', 'both'], ['UNRESOLVED', 'both']] as const) {
  assert.equal(contactExportReportType(filter), expected);
  const payload = { dataset: 'contacts', title: 'Contacts', records: [{ id: 'selected' }], selectedRows: ['selected'], defaultReportType: contactExportReportType(filter) };
  const markup = renderToStaticMarkup(React.createElement(GlobalExportModal, { isOpen: true, onClose() {}, payload }));
  assert.equal((markup.match(/aria-pressed="true"/g) || []).length, 1);
  const selectedButton = markup.match(/<button[^>]*aria-pressed="true"[^>]*>([\s\S]*?)<\/button>/)?.[1];
  assert.ok(selectedButton?.includes(`>${expected === 'both' ? 'Both' : expected === 'exporter' ? 'Exporter' : 'Importer'}</span>`));
  const request = buildExportRequest(payload, 'csv');
  assert.ok('report_type' in request.body);
  assert.equal(request.body.report_type, expected);
  assert.deepEqual(request.body.selectedRows, ['selected']);
  const override = buildExportRequest(payload, 'csv', 'international_importer');
  assert.ok('report_type' in override.body);
  assert.equal(override.body.report_type, 'international_importer');
}
assert.equal(renderToStaticMarkup(React.createElement(GlobalExportModal, { isOpen: false, onClose() {}, payload: null })), '');
const fileRequest = buildExportRequest({ dataset: 'files', title: 'File', records: [], sourceFileId: 'synthetic-file' }, 'csv', 'exporter');
assert.equal(Object.hasOwn(fileRequest.body, 'report_type'), false);
assert.throws(() => buildExportRequest({ dataset: 'files', title: 'File', records: [] }, 'csv'), /stored file/i);
console.log('PASS contact report scope defaults, explicit override, selection preservation and modal markup (not browser interaction)');
