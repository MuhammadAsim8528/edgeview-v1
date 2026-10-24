import assert from 'node:assert/strict';
import { loadFilePage } from '../../src/utils/filePage';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { FileViewer } from '../../src/components/FileViewer';

const original = globalThis.fetch;
const controller = new AbortController();
const run = (body: unknown, status = 200, offset = 0) => {
  globalThis.fetch = async () => new Response(JSON.stringify(body), { status });
  return loadFilePage('/synthetic', 25, offset, controller.signal);
};
try {
  const markup = renderToStaticMarkup(React.createElement(FileViewer, { file: { id: 'synthetic', name: 'Synthetic.csv', file_type: 'CSV', columns: ['Importer'], rows: [], summary: { total_rows: 17612 } } as any, onExportCSV() {} }));
  assert.match(markup, /Loading shipment records/);
  assert.doesNotMatch(markup, /No matching shipment records found|\(0 items\)/);
  const rows = Array.from({ length: 25 }, (_, index) => ({ Importer: `Synthetic ${index}` }));
  const page = await run({ rows, total_count: 17612 });
  assert.ok(page.ok); assert.equal(page.total, 17612); assert.equal(page.rows.length, 25);
  assert.equal((await run({ rows: [], total_count: 0 })).ok, true, 'empty is legitimate only with zero count');
  assert.equal((await run({ rows: rows.slice(0, 2), total_count: 27 }, 200, 25)).ok, true);
  for (const body of [null, {}, { rows: [], total_count: 17612 }, { rows, total_count: -1 }, { rows, total_count: '25' }, { rows: ['bad'], total_count: 1 }, { rows, total_count: 25, filter_options: { countries: [null], importers: [] } }]) {
    assert.equal((await run(body)).ok, false, 'malformed or incomplete success must not become an empty/valid page');
  }
  const failure = await run({ error: 'PRIVATE SERVER PATH' }, 500);
  assert.ok('error' in failure); assert.doesNotMatch(failure.error, /PRIVATE/);
  globalThis.fetch = async () => { throw new Error('offline'); };
  assert.equal((await loadFilePage('/synthetic', 25, 0, controller.signal)).ok, false);
  globalThis.fetch = async (_url, init) => new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
  });
  const keepAlive = setTimeout(() => {}, 1000);
  try {
    const timeout = await loadFilePage('/synthetic', 25, 0, controller.signal, 10);
    assert.ok('error' in timeout); assert.match(timeout.error, /timed out/);
    const cancelled = new AbortController();
    const pending = loadFilePage('/synthetic', 25, 0, cancelled.signal);
    cancelled.abort();
    assert.equal((await pending).ok, false);
  } finally { clearTimeout(keepAlive); }
  console.log('PASS file paging totals, partial/malformed response rejection, offline, sanitized failure, timeout and cancellation');
} finally { globalThis.fetch = original; }
