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
  assert.deepEqual(request.body.records, [{ id: 'selected' }]);
  assert.equal('selectedRows' in request.body, false, 'selection is sent once, as stored references');
  const override = buildExportRequest(payload, 'csv', 'international_importer');
  assert.ok('report_type' in override.body);
  assert.equal(override.body.report_type, 'international_importer');
}
assert.equal(renderToStaticMarkup(React.createElement(GlobalExportModal, { isOpen: false, onClose() {}, payload: null })), '');
const fileRequest = buildExportRequest({ dataset: 'files', title: 'File', records: [], sourceFileId: 'synthetic-file' }, 'csv', 'exporter');
assert.equal(Object.hasOwn(fileRequest.body, 'report_type'), false);
assert.throws(() => buildExportRequest({ dataset: 'files', title: 'File', records: [] }, 'csv'), /stored file/i);
const fatContacts = Array.from({ length: 5000 }, (_, i) => ({ id: `comp-${String(i).padStart(16, '0')}`, evidence: 'private client state '.repeat(100) }));
const compact = buildExportRequest({ dataset: 'contacts', title: 'Synthetic large selection', records: fatContacts, selectedRows: fatContacts.slice(0, 4000) }, 'all');
assert.ok('records' in compact.body);
assert.equal(compact.body.records.length, 4000);
assert.ok(Buffer.byteLength(JSON.stringify(compact.body)) < 160000, 'thousands of selected references must not carry huge client objects or duplicate selection arrays');
assert.ok(!JSON.stringify(compact.body).includes('private client state'));
const guarded = { id: 'stored-id' };
Object.defineProperty(guarded, 'evidence', { enumerable: true, get() { throw new Error('Sensitive enrichment must not be read for export request construction'); } });
assert.doesNotThrow(() => JSON.stringify(buildExportRequest({ dataset: 'contacts', title: 'Guarded', records: [guarded] }, 'csv').body));
assert.throws(() => buildExportRequest({ dataset: 'contacts', title: 'Invalid', records: [{ id: 'a' }], selectedRows: ['missing'] }, 'csv'), /unavailable selection/);
console.log('PASS contact report scope defaults, explicit override, selection preservation and modal markup (not browser interaction)');
