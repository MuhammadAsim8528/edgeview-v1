import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { unusedTestPort } from '../../scripts/test-server-port.mjs';
import { buildExportRequest } from '../../src/utils/exportRequest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { GlobalExportModal } from '../../src/components/GlobalExportModal';
import { loadFilePage } from '../../src/utils/filePage';
import { loadCountryDetails, loadImporterDetails } from '../../src/utils/countryDetails';

const count = 17612;
const sourcePayload = { dataset: 'files', title: 'Synthetic full file', records: [], sourceFileId: 'large-synthetic', recordCount: count };
const request = buildExportRequest(sourcePayload, 'csv');
const markup = renderToStaticMarkup(React.createElement(GlobalExportModal, { isOpen: true, onClose: () => {}, payload: sourcePayload }));
assert.match(markup, /17,612/);
assert.match(markup, /Total Records/);
assert.ok(Buffer.byteLength(JSON.stringify(request.body)) < 1024);
assert.equal(Object.hasOwn(request.body, 'records'), false);
assert.throws(() => buildExportRequest({ ...sourcePayload, selectedRows: ['row-1'] }, 'csv'));
assert.throws(() => buildExportRequest({ ...sourcePayload, filters: { country: 'Kenya' } }, 'csv'));
const generic = buildExportRequest({ dataset: 'contacts', title: 'Synthetic contacts', records: [{ id: 'one' }], selectedRows: ['one'] }, 'csv', 'exporter');
assert.equal(generic.url, '/api/export');
assert.equal((generic.body as any).report_type, 'exporter');
assert.deepEqual((generic.body as any).selectedRows, ['one']);

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'edgeview-stored-export-'));
const port = await unusedTestPort();
const base = `http://127.0.0.1:${port}`;
const inherited = Object.fromEntries(Object.entries(process.env).filter(([key]) => /^(PATH|SystemRoot|WINDIR|COMSPEC|USERPROFILE|TEMP|TMP|APPDATA|LOCALAPPDATA)$/i.test(key)));
const child = spawn(process.execPath, ['--import', 'tsx', '--input-type=module', '--eval', `
  const {db}=await import('./server/db.ts');
  process.on('message', count=>{
    db.files.clear(); // Only this owned test process: remove built-in demo fixtures.
    const rows=Array.from({length:count},(_,index)=>({Date:'2026-01-01',Importer:'Synthetic Importer '+index,Country:'Kenya',Exporter:'Synthetic Exporter',Item:'Product '+index+' '+ 'x'.repeat(300),TOT_FC:index+1}));
    db.files.set('large-synthetic',{id:'large-synthetic',name:'large.csv',rows});
    db.files.set('small-synthetic',{id:'small-synthetic',name:'small.csv',rows:rows.slice(0,2)});
    db.files.set('empty-synthetic',{id:'empty-synthetic',name:'empty.csv',rows:[]});
    db.files.set('other-synthetic',{id:'other-synthetic',name:'other.csv',rows:[{Importer:'OTHER_FILE_MUST_NOT_APPEAR',Country:'Kenya',Item:'Other'}]});
    process.send({seeded:true,jsonBytes:Buffer.byteLength(JSON.stringify(rows))});
  });
  await import('./server.ts');
`], { cwd: process.cwd(), env: { ...inherited, NODE_ENV: 'test', PORT: String(port), EDGEVIEW_TEST_MODE: '1', EDGEVIEW_TEST_DB_DIR: root,
  EDGEVIEW_JSON_DB: path.join(root, 'rows.json'), EDGEVIEW_SQLITE_DB: path.join(root, 'operational.db'), EDGEVIEW_CONFIG: path.join(root, 'config.json'), EDGEVIEW_V1_DATA_DIR: path.join(root, 'runs') }, stdio: ['ignore', 'ignore', 'pipe', 'ipc'] });
let stderr = '';
child.stderr?.on('data', bytes => { stderr = (stderr + String(bytes)).slice(-2000); });
const post = (route: string, body: unknown) => fetch(`${base}${route}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(30_000) });
try {
  let ready = false;
  for (const deadline = Date.now() + 60_000; Date.now() < deadline;) {
    assert.equal(child.exitCode, null, `isolated server exited: ${stderr}`);
    try {
      const health = await (await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(1000) })).json();
      assert.equal(health.app.pid, child.pid); ready = true; break;
    } catch { await new Promise(resolve => setTimeout(resolve, 100)); }
  }
  assert.ok(ready, 'owned isolated actual server must start');
  const seeded = once(child, 'message', { signal: AbortSignal.timeout(30_000) }); child.send(count);
  assert.ok((await seeded)[0].jsonBytes > 5 * 1024 * 1024, 'fixture must exceed the unchanged JSON limit');
  const overview = await (await fetch(`${base}/api/countries?overview=1&file_id=large-synthetic`)).json();
  assert.deepEqual(overview.stats, { totalCountries: 1, totalImporters: count, totalExporters: 1, totalValue: count * (count + 1) / 2 });
  assert.deepEqual(overview.countries, [{ country: 'Kenya', importers_count: count }]);
  const allOverview = await (await fetch(`${base}/api/countries?overview=1`)).json();
  assert.equal(allOverview.stats.totalImporters, count + 1, 'same importer repeated in another file is not counted twice');
  assert.equal(allOverview.stats.totalExporters, 1);
  const emptyOverview = await (await fetch(`${base}/api/countries?overview=1&file_id=empty-synthetic`)).json();
  assert.deepEqual(emptyOverview.stats, { totalCountries: 0, totalImporters: 0, totalExporters: 0, totalValue: 0 });
  assert.equal((await fetch(`${base}/api/countries?overview=1&file_id=missing`)).status, 404);
  const legacyCountries = await (await fetch(`${base}/api/countries?file_id=small-synthetic`)).json();
  assert.deepEqual(legacyCountries, [{ country: 'Kenya', importers_count: 2 }], 'legacy list contract remains unchanged');
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (input, init) => originalFetch(new URL(String(input), base), init);
  try {
    const country = await loadCountryDetails('Kenya', 'small-synthetic', new AbortController().signal);
    assert.ok(country.ok);
    if (country.ok) {
      assert.equal(country.data.summary.total_export_value, 3);
      assert.equal(country.data.importers.length, 2);
    }
    const importer = await loadImporterDetails('Kenya', 'Synthetic Importer 0', 'small-synthetic', new AbortController().signal);
    assert.ok(importer.ok);
    if (importer.ok) { assert.equal(importer.data.length, 1); assert.equal(importer.data[0].exporter, 'Synthetic Exporter'); }
  } finally { globalThis.fetch = originalFetch; }
  const secondPage = await loadFilePage(`${base}/api/files/large-synthetic/data?limit=25&offset=25&group_shipments=false`, 25, 25, new AbortController().signal);
  assert.ok(secondPage.ok);
  if (secondPage.ok) {
    assert.equal(secondPage.total, count);
    assert.equal(secondPage.rows.length, 25);
    assert.equal(secondPage.rows[0].Importer, 'Synthetic Importer 25');
    assert.equal(secondPage.rows[24].Importer, 'Synthetic Importer 49');
  }
  const oversized = await post('/api/export', { dataset: 'files', format: 'csv', records: [], padding: 'x'.repeat(5 * 1024 * 1024) });
  assert.equal(oversized.status, 413, 'do not raise request limit to conceal the round-trip bug');
  const response = await post(request.url, request.body);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-disposition') || '', /attachment/);
  const csv = await response.text();
  assert.equal(csv.trim().split('\n').length, count + 1, 'all rows, including beyond first page, must export');
  assert.match(csv, /Synthetic Importer 17611/);
  assert.doesNotMatch(csv, /OTHER_FILE_MUST_NOT_APPEAR/);
  for (const patch of [{ dataset: 'contacts' }, { records: [] }, { selectedRows: ['missing'] }, { selectedRows: [{ Importer: 'INJECTED' }] }, { filters: { country: 'Other' } }, { format: 'exe' }, { filenamePrefix: '../escape' }]) {
    assert.equal((await post(request.url, { ...request.body, ...patch })).status, 400);
  }
  assert.equal((await post('/api/export/file/missing', request.body)).status, 404);
  for (const format of ['csv', 'xlsx', 'docx', 'pdf', 'all']) {
    const small = buildExportRequest({ ...sourcePayload, sourceFileId: 'small-synthetic', recordCount: 2 }, format as any);
    const download = await post(small.url, small.body);
    assert.equal(download.status, 200, format);
    assert.equal(download.headers.get('x-export-failed-formats'), null);
    assert.ok((await download.arrayBuffer()).byteLength > 50);
  }
  console.log('PASS actual stored-file export: 17,612 rows >5MiB, compact request, file isolation, validation and all format routes; browser download NOT VERIFIED');
} finally {
  if (child.exitCode === null) { const exited = once(child, 'exit'); child.kill(); await exited; }
  fs.rmSync(root, { recursive: true, force: true });
}
