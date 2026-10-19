import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const port = 3912;
const base = `http://127.0.0.1:${port}`;
const testRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'edgeview-release-smoke-'));
const isolatedEnv = {
  ...process.env,
  PORT: String(port),
  NODE_ENV: 'test',
  EDGEVIEW_TEST_MODE: '1',
  EDGEVIEW_TEST_DB_DIR: testRoot,
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
    try {
      const response = await fetch(`${base}/api/health`);
      if (response.ok) return response;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error(`release server did not become healthy: ${stderr.slice(-1000)}`);
}

try {
  const healthResponse = await waitForHealth();
  const health = await healthResponse.json();
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

  const sampleSeed = await fetch(`${base}/api/sample-data/seed`, { method: 'POST' });
  assert.equal(sampleSeed.status, 404, 'sample-data mutation must be unavailable in release mode');

  const malformedUpload = new FormData();
  malformedUpload.append('file', new Blob(['not an xlsx archive']), 'malformed.xlsx');
  const malformedResponse = await fetch(`${base}/api/files/upload`, { method: 'POST', body: malformedUpload });
  const malformedBody = await malformedResponse.json();
  assert.equal(malformedResponse.status, 422);
  assert.equal(malformedBody.code, 'FILE_PARSE_FAILED');
  assert.equal(Object.hasOwn(malformedBody, 'details'), false, 'parse failure must not disclose local internals');

  const validUpload = new FormData();
  const validName = `release-smoke-${Date.now()}.csv`;
  validUpload.append('file', new Blob(['Importer,Exporter,Country,Item,TOT_FC\nSmoke Importer,Smoke Exporter,Kenya,Test Product,100\n']), validName);
  const validUploadResponse = await fetch(`${base}/api/files/upload`, { method: 'POST', body: validUpload });
  const validUploadBody = await validUploadResponse.json();
  assert.equal(validUploadResponse.status, 201, JSON.stringify(validUploadBody));
  assert.equal(validUploadBody.success, true);
  const uploadedId = validUploadBody.data?.id || validUploadBody.id;
  assert.ok(uploadedId, 'successful upload must return its persisted file id');

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
  child.kill('SIGTERM');
  await new Promise(resolve => child.once('exit', resolve));
  try { fs.rmSync(testRoot, { recursive: true, force: true }); } catch {}
}
