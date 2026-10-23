import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import JSZip from 'jszip';
import net from 'node:net';
import { unusedTestPort } from './test-server-port.mjs';

const port = Number(process.env.EDGEVIEW_RELEASE_TEST_PORT || await unusedTestPort());
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid isolated test port.');
const base = `http://127.0.0.1:${port}`;
const testRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'edgeview-release-smoke-'));
const isolatedEnv = {
  ...process.env,
  PORT: String(port),
  NODE_ENV: 'test',
  EDGEVIEW_TEST_MODE: '1',
  EDGEVIEW_TEST_DB_DIR: testRoot,
  EDGEVIEW_JSON_DB: path.join(testRoot, 'persistence.json'),
  EDGEVIEW_SQLITE_DB: path.join(testRoot, 'operational.db'),
  EDGEVIEW_V1_DATA_DIR: path.join(testRoot, 'runs'),
  EDGEVIEW_CONFIG: path.join(testRoot, 'config.json'),
  SERPER_API_KEY: '',
  HUNTER_API_KEY: '',
  NVIDIA_API_KEY: '',
  GROQ_API_KEY: '',
  FIRECRAWL_API_KEY: '',
  TAVILY_API_KEY: '',
  EXA_API_KEY: '',
  LINKUP_API_KEY: '',
  APIFY_API_KEY: '',
  GEMINI_API_KEY: '',
};
const child = spawn(process.execPath, ['dist/server.cjs'], {
  cwd: process.cwd(),
  env: isolatedEnv,
  stdio: ['ignore', 'pipe', 'pipe'],
});

let stderr = '';
child.stderr.on('data', chunk => { stderr += String(chunk); });

async function waitForHealth() {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) throw new Error('Isolated release server exited before becoming healthy.');
    let response;
    try {
      response = await fetch(`${base}/api/health`);
    } catch {}
    if (response?.ok) {
      const identity = await response.clone().json();
      if (identity.app?.pid !== child.pid) throw new Error('Test port belongs to a different process; no mutations permitted.');
      return response;
    }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error(`release server did not become healthy: ${stderr.slice(-1000)}`);
}

// Raw sockets are necessary: fetch automatically inserts a Host header.
async function rawLocalRequest(headers, version = '1.1', target = '/api/health', method = 'GET') {
  return new Promise((resolve, reject) => {
    const socket = net.connect(port, '127.0.0.1');
    let response = '';
    socket.setTimeout(5000, () => socket.destroy(new Error('Raw HTTP response timed out')));
    socket.on('error', reject);
    socket.on('data', chunk => { response += chunk.toString(); });
    socket.on('end', () => resolve(response));
    socket.on('connect', () => socket.write(`${method} ${target} HTTP/${version}\r\n${headers}Connection: close\r\n\r\n`));
  });
}

try {
  const healthResponse = await waitForHealth();
  const health = await healthResponse.json();
  assert.equal(fs.realpathSync(health.app.project_root), fs.realpathSync(process.cwd()), 'isolated server must resolve the installation being tested');
  assert.deepEqual(Object.keys(health.providers).sort(), ['groq', 'hunter', 'nvidia', 'serper']);
  assert.equal(healthResponse.headers.get('x-content-type-options'), 'nosniff');
  assert.match(healthResponse.headers.get('content-security-policy') || '', /frame-ancestors 'none'/);
  assert.doesNotMatch(healthResponse.headers.get('content-security-policy') || '', /script-src[^;]*unsafe-inline/);

  const shellResponse = await fetch(`${base}/`);
  const shell = await shellResponse.text();
  assert.equal(shellResponse.status, 200);
  assert.doesNotMatch(shell, /@vite\/client|react-refresh|24678/i, 'release shell must not contain Vite HMR code');
  assert.match(shell, /\/assets\/index-[^"']+\.js/, 'release shell must reference a built JavaScript asset');

  const badOrigin = await fetch(`${base}/api/health`, { headers: { Origin: 'https://evil.example' } });
  assert.equal(badOrigin.status, 403);

  for (const version of ['1.0', '1.1']) {
    for (const headers of ['', 'Host: \r\n']) {
      assert.match(await rawLocalRequest(headers, version), /^HTTP\/1\.1 (?:400|403)\b/, 'missing/empty Host must never reach health');
    }
  }
  assert.match(await rawLocalRequest('', '1.0', `${base}/api/health`), /^HTTP\/1\.1 403\b/, 'absolute-form target cannot substitute for Host');
  assert.match(await rawLocalRequest('', '1.0', '*', 'OPTIONS'), /^HTTP\/1\.1 403\b/, 'asterisk target cannot bypass global guard');
  for (const host of [`127.0.0.1:${port}`, `localhost:${port}`, `LOCALHOST:${port}`, `[::1]:${port}`]) {
    assert.match(await rawLocalRequest(`Host: ${host}\r\n`), /^HTTP\/1\.1 200\b/, `allowed Host ${host}`);
  }
  for (const host of ['evil.example', `127.0.0.1:${port + 1}`, `localhost.evil.example:${port}`, `localhost:${port}@evil.example`]) {
    assert.match(await rawLocalRequest(`Host: ${host}\r\n`), /^HTTP\/1\.1 403\b/, 'foreign Host must fail');
  }
  assert.match(await rawLocalRequest(`Host: localhost:${port}\r\nOrigin: null\r\n`), /^HTTP\/1\.1 403\b/);
  for (const hosts of [`Host: localhost:${port}\r\nhOsT: evil.example\r\n`, `Host: evil.example\r\nHost: localhost:${port}\r\n`]) {
    assert.match(await rawLocalRequest(hosts), /^HTTP\/1\.1 (?:400|403)\b/, 'duplicate Host must not be interpreted by first-value wins');
  }

  const sampleSeed = await fetch(`${base}/api/sample-data/seed`, { method: 'POST' });
  assert.equal(sampleSeed.status, 404, 'sample-data mutation must be unavailable in release mode');

  const malformedUpload = new FormData();
  malformedUpload.append('file', new Blob(['not an xlsx archive']), 'malformed.xlsx');
  const malformedResponse = await fetch(`${base}/api/files/upload`, { method: 'POST', body: malformedUpload });
  const malformedBody = await malformedResponse.json();
  assert.equal(malformedResponse.status, 422);
  assert.equal(malformedBody.code, 'FILE_PARSE_FAILED');
  assert.equal(Object.hasOwn(malformedBody, 'details'), false, 'parse failure must not disclose local internals');

  const filesBeforeWide = await (await fetch(`${base}/api/files`)).json();
  const wideUpload = new FormData();
  wideUpload.append('file', new Blob([`${Array.from({ length: 513 }, (_, i) => `Field${i}`).join(',')}\nx\nx`]), 'wide.csv');
  const wideResponse = await fetch(`${base}/api/files/upload`, { method: 'POST', body: wideUpload });
  const wideBody = await wideResponse.json();
  assert.equal(wideResponse.status, 422);
  assert.equal(wideBody.code, 'FILE_PARSE_FAILED');
  assert.equal(Object.hasOwn(wideBody, 'details'), false);
  assert.deepEqual(await (await fetch(`${base}/api/files`)).json(), filesBeforeWide, 'rejected expansion must not persist a partial file');

  const validUpload = new FormData();
  const validName = `release-smoke-${Date.now()}.csv`;
  validUpload.append('file', new Blob(['Date,Importer,Exporter,Country,Item,TOT_FC\n2026-01-01,Alpha,Exporter One,Niger,Product One,100\n2026-01-02,Alpha Trading,Exporter Two,Niger,Product Two,200\n2026-01-03,Alpha,Exporter Three,Nigeria,Product Three,300\n2026-01-04,Unicode Pharma,Exporter Four,Sri Lanka,Product Four,400\n']), validName);
  const validUploadResponse = await fetch(`${base}/api/files/upload`, { method: 'POST', body: validUpload });
  const validUploadBody = await validUploadResponse.json();
  assert.equal(validUploadResponse.status, 201, JSON.stringify(validUploadBody));
  assert.equal(validUploadBody.success, true);
  const uploadedId = validUploadBody.data?.id || validUploadBody.id;
  assert.ok(uploadedId, 'successful upload must return its persisted file id');

  const fileScope = `file_id=${encodeURIComponent(uploadedId)}`;
  const jsonGet = async route => {
    const response = await fetch(`${base}${route}`);
    assert.equal(response.status, 200, route); return response.json();
  };
  const page = await jsonGet(`/api/files/${uploadedId}/data?limit=1&offset=1&sort_by=Importer&sort_dir=asc`);
  assert.equal(page.rows.length, 1); assert.equal(page.total_count, 4);
  const filtered = await jsonGet(`/api/files/${uploadedId}/data?country=Niger&importer=Alpha`);
  assert.equal(filtered.total_count, 1, 'file filters must retain exact country/company scope');
  for (const query of ['limit=-1','limit=0','limit=1001','limit=abc','limit=1.5','offset=-1','limit=1&limit=2']) {
    assert.equal((await fetch(`${base}/api/files/${uploadedId}/data?${query}`)).status, 400, `invalid pagination: ${query}`);
  }
  const countries = await jsonGet(`/api/countries?${fileScope}`);
  assert.equal(countries.find(row => row.country === 'Niger').importers_count, 2);
  const niger = await jsonGet(`/api/countries/Niger/summary?${fileScope}`);
  assert.equal(niger.total_export_value, 300, 'Niger must not include Nigeria');
  const importers = await jsonGet(`/api/countries/Niger/importers?${fileScope}`);
  assert.equal(importers.length, 2);
  const alpha = await jsonGet(`/api/countries/Niger/Alpha/details?${fileScope}`);
  assert.equal(alpha.length, 1, 'Alpha must not include Alpha Trading or Nigerian records');
  assert.equal(alpha[0].total_value, 100);
  const statsAlpha = await jsonGet(`/api/stats/importers/Alpha/summary?country=Niger&${fileScope}`);
  assert.equal(statsAlpha.total_export_value, 100); assert.equal(statsAlpha.total_shipments, 1);
  const statsImporters = await jsonGet(`/api/stats/countries/Niger/importers?${fileScope}`);
  assert.equal(statsImporters.length, 2);
  assert.deepEqual(await jsonGet('/api/countries?file_id=missing-synthetic-file'), [], 'missing file scope must not silently widen to all files');
  const savedHistory = await fetch(`${base}/api/files/${uploadedId}/save-to-history`, { method: 'POST' });
  assert.equal(savedHistory.status, 200);
  const savedHistoryBody = await savedHistory.json();
  assert.equal(savedHistoryBody.success, true); assert.equal(savedHistoryBody.data.row_count, 4);
  assert.ok(JSON.parse(fs.readFileSync(path.join(testRoot, 'persistence.json'), 'utf8')).some(file => file.id === uploadedId && file.row_count === 4), 'history save must be durable');
  const history = await jsonGet('/api/stats/history-files');
  assert.ok(!history.data.some(file => file.file_name === validName), 'test-mode records must remain excluded from the real history listing');

  const exportRecords = [
    { id: 'chosen', Date: '2026-01-01', Importer: 'Chosen Company', Country: 'Niger', Exporter: 'Fixture Exporter', Item: 'Fixture Product', TOT_FC: 100 },
    { id: 'excluded', Date: '2026-01-02', Importer: 'Excluded Company', Country: 'Nigeria', Exporter: 'Fixture Exporter', Item: 'Fixture Product', TOT_FC: 200 },
  ];
  const exportPayload = { dataset: 'files', title: 'Release Fixture', records: exportRecords, selectedRows: ['chosen'], filenamePrefix: 'EdgeView_QA' };
  for (const format of ['csv','xlsx','docx','pdf','all']) {
    const response = await fetch(`${base}/api/export`, { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ ...exportPayload, format }) });
    assert.equal(response.status, 200, `export ${format}`);
    assert.ok(response.headers.get('content-disposition')?.includes('attachment'));
    assert.equal(response.headers.get('x-export-failed-formats'), null, `all requested formats must succeed: ${format}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    assert.ok(bytes.length > 50);
    if (format === 'csv') {
      assert.match(bytes.toString('utf8'), /Chosen Company/); assert.doesNotMatch(bytes.toString('utf8'), /Excluded Company/);
    } else if (format === 'pdf') assert.equal(bytes.subarray(0, 5).toString(), '%PDF-');
    else {
      const archive = await JSZip.loadAsync(bytes);
      if (format === 'xlsx' || format === 'docx') {
        const member = format === 'docx' ? 'word/document.xml' : 'xl/sharedStrings.xml';
        const content = await archive.file(member).async('string');
        assert.match(content, /Chosen Company/); assert.doesNotMatch(content, /Excluded Company/);
      } else {
        for (const extension of ['csv','xlsx','docx','pdf']) assert.ok(Object.keys(archive.files).some(name => name.endsWith(`.${extension}`)), `ZIP contains ${extension}`);
      }
    }
  }
  for (const patch of [{ selectedRows: ['missing'] }, { selectedRows: ['chosen','missing'] }, { format: 'exe' }, { records: {} }]) {
    const response = await fetch(`${base}/api/export`, { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ ...exportPayload, format: 'csv', ...patch }) });
    assert.equal(response.status, 400, 'invalid export or stale selection must not produce a wider download');
  }

  // Download handlers must share one bounded budget, including Express aliases.
  const csvPath = `/api/export/csv/${encodeURIComponent(uploadedId)}`;
  const ordinaryDownload = await fetch(`${base}${csvPath}`);
  assert.equal(ordinaryDownload.status, 200);
  assert.match(ordinaryDownload.headers.get('content-disposition') || '', /attachment/);
  await ordinaryDownload.arrayBuffer();
  const statsDownload = await fetch(`${base}/api/stats//importers/Alpha/export?${fileScope}`);
  assert.equal(statsDownload.status, 200, 'ordinary stats mount alias remains supported');
  assert.match(statsDownload.headers.get('content-disposition') || '', /attachment/);
  await statsDownload.arrayBuffer();
  let exportThrottled = false;
  for (let attempt = 0; attempt < 25; attempt += 1) {
    const download = await fetch(`${base}${csvPath}`);
    await download.arrayBuffer();
    if (download.status === 429) { exportThrottled = true; break; }
    assert.equal(download.status, 200);
  }
  assert.equal(exportThrottled, true, 'GET exports must exhaust a bounded budget');
  for (const route of [csvPath, `${csvPath}/`, `/API/EXPORT/CSV/${encodeURIComponent(uploadedId)}`, '/api/export/history/csv', '/api/export/country/csv', '/api/export/report', '/api/export/docx', '/api/export/pdf', '/api/stats/importers/Alpha/export', '/API/STATS/IMPORTERS/%41lpha/EXPORT/', '/api/stats//importers/Alpha/export', '/API/STATS//IMPORTERS/%41lpha/EXPORT/']) {
    const limited = await fetch(`${base}${route}`);
    assert.equal(limited.status, 429, `shared export budget: ${route}`);
    assert.equal((await limited.json()).code, 'LOCAL_RATE_LIMITED');
    assert.ok(Number(limited.headers.get('retry-after')) > 0);
  }
  assert.equal((await fetch(`${base}${csvPath}`, { method: 'HEAD' })).status, 429);
  for (const route of ['/api/export', '/api/export/blocks', '/api/export/csv', '/api/export/report', '/api/export/docx', '/api/export/pdf']) {
    const blockedPostExport = await fetch(`${base}${route}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    assert.equal(blockedPostExport.status, 429, route);
    assert.equal((await blockedPostExport.json()).code, 'LOCAL_RATE_LIMITED');
  }
  assert.equal((await fetch(`${base}/api/export/report`, { method: 'OPTIONS' })).status, 429, 'ALL-method report generator shares budget');
  assert.equal((await fetch(`${base}/api/health`)).status, 200, 'exports must not consume ordinary read budget');
  assert.equal((await fetch(`${base}/api/files`)).status, 200);

  const deleteResponse = await fetch(`${base}/api/files/${encodeURIComponent(uploadedId)}`, { method: 'DELETE' });
  const deleteBody = await deleteResponse.json();
  assert.ok([200, 207].includes(deleteResponse.status), JSON.stringify(deleteBody));
  assert.equal(deleteBody.success, true);
  assert.equal(deleteBody.persisted, true, 'release delete must confirm the primary durable record was removed');

  const legacyProvider = await fetch(`${base}/api/settings/test`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ service: 'firecrawl' }),
  });
  assert.equal(legacyProvider.status, 400);

  const invalidSettings = await fetch(`${base}/api/settings`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ groq_enabled: 'yes' }),
  });
  assert.equal(invalidSettings.status, 400);
  const unsupportedSettings = await fetch(`${base}/api/settings`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ primary_ai_provider: 'GROQ', provider_weights: { apify: 100 } }),
  });
  assert.equal(unsupportedSettings.status, 400);
  assert.equal((await unsupportedSettings.json()).code, 'UNSUPPORTED_V1_SETTING');
  assert.equal((await (await fetch(`${base}/api/settings`)).json()).primary_ai_provider, 'NVIDIA', 'rejected configuration must not partially save');
  const arraySettings = await fetch(`${base}/api/settings`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '[]' });
  assert.equal(arraySettings.status, 400);

  const oversizedIdentity = await fetch(`${base}/api/enrich/company`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ company_name: 'x'.repeat(301), country: 'Sri Lanka' }),
  });
  assert.equal(oversizedIdentity.status, 400);

  const settings = await (await fetch(`${base}/api/settings`)).json();
  for (const name of ['serper_api_key', 'hunter_api_key', 'nvidia_api_key', 'groq_api_key']) assert.equal(settings[name], '');
  for (const legacy of ['firecrawl_api_key', 'tavily_api_key', 'exa_api_key', 'linkup_api_key', 'apify_api_key', 'gemini_api_key']) {
    assert.equal(Object.hasOwn(settings, legacy), false, `legacy setting leaked through V1 API: ${legacy}`);
  }

  const savedSettingsResponse = await fetch(`${base}/api/settings`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ primary_ai_provider: 'GROQ', hunter_enabled: false }),
  });
  assert.equal(savedSettingsResponse.status, 200);
  const persistedSettings = await (await fetch(`${base}/api/settings`)).json();
  assert.equal(persistedSettings.primary_ai_provider, 'GROQ');
  assert.equal(persistedSettings.hunter_enabled, false);

  const providerMetrics = await (await fetch(`${base}/api/governor/provider-metrics`)).json();
  assert.deepEqual(Object.keys(providerMetrics.report).sort(), ['groq', 'hunter', 'nvidia', 'serper']);
  for (const metric of Object.values(providerMetrics.report)) {
    assert.ok(['available', 'cooldown', 'suppressed', 'disabled', 'unconfigured'].includes(metric.routingState));
    assert.equal(metric.status === 'healthy', false, 'GET telemetry must not fabricate a successful live check');
    assert.equal(metric.successRate === null || (metric.successRate >= 0 && metric.successRate <= 1), true);
    if (metric.requestCount === 0) {
      assert.equal(metric.successRate, null);
      assert.equal(metric.averageLatencyMs, null, 'no completed retrieval samples must not produce an average');
    }
    assert.equal(metric.lastDiagnosticLatencyMs, null, 'passive telemetry must not fabricate a diagnostic timing');
  }

  const systemHealth = await (await fetch(`${base}/api/system/health`)).json();
  assert.deepEqual(Object.keys(systemHealth.providers).sort(), ['groq', 'hunter', 'nvidia', 'serper']);

  const runtimeState = await (await fetch(`${base}/api/runtime/state`)).json();
  assert.deepEqual(Object.keys(runtimeState.providers).sort(), ['groq', 'hunter', 'nvidia', 'serper']);
  assert.equal(runtimeState.capabilities?.company_enrichment?.available, false, 'research must be unavailable without Serper in isolated release smoke');
  assert.equal(runtimeState.capabilities?.company_enrichment?.dependencies?.includes('serper'), true);
  for (const legacy of ['firecrawl', 'tavily', 'exa', 'linkup', 'apify', 'gemini']) {
    assert.equal(Object.hasOwn(runtimeState.resources, legacy), false, `legacy resource appeared in V1 runtime state: ${legacy}`);
  }

  const unavailableResearch = await fetch(`${base}/api/enrich/company`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ company_name: 'Release Smoke Company', country: 'Kenya' }),
  });
  const unavailableResearchBody = await unavailableResearch.json();
  assert.equal(unavailableResearch.status, 503);
  assert.equal(unavailableResearchBody.code, 'CAPABILITY_UNAVAILABLE');
  assert.match(unavailableResearchBody.remediation || '', /Serper/i);

  const logs = await (await fetch(`${base}/api/logs/system?tail=50000`)).json();
  assert.ok(Array.isArray(logs));
  assert.ok(logs.length <= 1000, 'runtime log API must remain bounded');
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const modelResponse = await fetch(`${base}/api/ai/models?provider=unsupported&refresh=true`);
    assert.equal(modelResponse.status, 400);
  }
  const throttledModels = await fetch(`${base}/api/ai/models?refresh=true`);
  assert.equal(throttledModels.status, 429, 'model discovery GET must have a bounded request budget');
  assert.ok(Number(throttledModels.headers.get('retry-after')) > 0);
  const throttledBody = await throttledModels.json();
  assert.equal(throttledBody.code, 'LOCAL_RATE_LIMITED');
  let uploadThrottled = false;
  for (let attempt = 0; attempt <= 120; attempt += 1) {
    const emptyUpload = await fetch(`${base}/upload`, { method: 'POST' });
    if (emptyUpload.status === 429) { uploadThrottled = true; break; }
    assert.equal(emptyUpload.status, 400, 'empty upload must be rejected without storing data');
  }
  assert.equal(uploadThrottled, true, 'non-API upload alias must share the mutation request budget');
  assert.equal((await fetch(`${base}/files/upload`, { method: 'POST' })).status, 429, 'another upload alias cannot bypass the budget');
  console.log('PASS EdgeView production release smoke');
} finally {
  if (child.exitCode === null && child.signalCode === null) {
    const stopped = new Promise(resolve => child.once('exit', resolve));
    child.kill('SIGTERM'); await stopped;
  }
  try { fs.rmSync(testRoot, { recursive: true, force: true }); } catch {}
}
