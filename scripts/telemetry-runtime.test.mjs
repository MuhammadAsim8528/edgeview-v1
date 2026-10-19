import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { unusedTestPort } from './test-server-port.mjs';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'edgeview-telemetry-runtime-'));
const runDir = path.join(root, 'runs'); fs.mkdirSync(runDir);
const config = path.join(root, 'config.json');
fs.writeFileSync(config, JSON.stringify({ serper_enabled: true, serper_api_key: 'synthetic-serper-diagnostic', hunter_enabled: true, hunter_api_key: 'synthetic-hunter-diagnostic', nvidia_enabled: false, nvidia_api_key: '', groq_enabled: false, groq_api_key: '' }));
fs.writeFileSync(path.join(runDir, 'provider-metrics.json'), JSON.stringify({ format: 1, processed_run_ids: [], providers: {
  serper: { request_count: 2, success_count: 2, failure_count: 0, timeout_count: 0, rate_limit_count: 0, total_latency_ms: 600, last_error: null, last_http_status: null, last_completed_at: new Date().toISOString() },
} }));
const port = await unusedTestPort();
const base = `http://127.0.0.1:${port}`;
const child = spawn(process.execPath, ['--import', pathToFileURL(path.resolve('server/tests/fixtures/telemetry-fetch.mjs')).href, 'dist/server.cjs'], {
  env: { ...process.env, PORT: String(port), NODE_ENV: 'test', EDGEVIEW_TEST_MODE: '1', EDGEVIEW_TEST_DB_DIR: root, EDGEVIEW_CONFIG: config, EDGEVIEW_V1_DATA_DIR: runDir },
  stdio: ['ignore','pipe','pipe'],
});
let output = '';
child.stdout.on('data', chunk => { output = (output + chunk).slice(-8000); });
child.stderr.on('data', chunk => { output = (output + chunk).slice(-8000); });
try {
  let ready = false;
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error('Isolated telemetry server exited before ready.');
    let health;
    try { health = await fetch(`${base}/api/health`); } catch {}
    if (health?.ok) {
      const identity = await health.json();
      assert.equal(identity.app?.pid, child.pid, 'test port belongs to another process; mutation forbidden');
      ready = true; break;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(ready, output);
  const tested = await fetch(`${base}/api/system/health/test`, { method: 'POST' });
  assert.equal(tested.status, 200);
  const body = await tested.json();
  assert.equal(body.success, true);
  assert.equal(body.providers.serper.averageLatencyMs, 300, 'last check must not overwrite the completed-call average');
  assert.equal(body.providers.serper.requestCount, 2, 'diagnostic calls have a separate denominator');
  assert.ok(body.providers.serper.lastDiagnosticLatencyMs >= 40);
  assert.ok(body.providers.hunter.lastDiagnosticLatencyMs >= 70);
  assert.equal(body.providers.hunter.averageLatencyMs, null);
  assert.equal(body.providers.hunter.successRate, null);
  assert.equal(body.providers.serper.status, 'healthy');
  assert.equal(body.providers.hunter.status, 'healthy');
  const saveSettings = async patch => {
    const result = await fetch(`${base}/api/settings`, { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify(patch) });
    assert.equal(result.status, 200);
  };
  const health = async () => (await (await fetch(`${base}/api/system/health`)).json()).providers;
  await saveSettings({ serper_enabled: false });
  assert.equal((await health()).serper.status, 'disabled', 'disabled settings must override prior successful tests');
  await saveSettings({ serper_enabled: true, serper_api_key: 'synthetic-auth-failed-key' });
  assert.equal((await health()).serper.status, 'unknown', 'new credential must not inherit old healthy status');
  const enrich = async company => {
    const response = await fetch(`${base}/api/enrich/company`, { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ company_name: company, country: 'Kenya' }) });
    assert.equal(response.status, 200);
    return response.json();
  };
  const failed = await enrich('Synthetic Diagnostic Failure Company');
  assert.equal(failed.run.status, 'FAILED');
  assert.equal((await health()).serper.routingState, 'suppressed');
  await saveSettings({ serper_enabled: false });
  assert.equal((await health()).serper.status, 'disabled', 'disabled settings must override old suppression');
  await saveSettings({ serper_enabled: true, serper_api_key: 'synthetic-recovered-key' });
  assert.equal((await health()).serper.routingState, 'available', 'credential replacement must release the old account failure');
  const recovered = await enrich('Synthetic Diagnostic Recovery Company');
  assert.notEqual(recovered.run.status, 'FAILED', 'normal UI settings flow must recover without a backend restart');
  await saveSettings({ serper_api_key: 'synthetic-upstream-failed-key' });
  await fetch(`${base}/api/system/health/test`, { method: 'POST' });
  assert.equal((await health()).serper.status, 'healthy');
  await enrich('Synthetic Diagnostic Upstream Failure Company');
  assert.equal((await health()).serper.status, 'degraded', 'a newer real 503 must override an older successful diagnostic');
  console.log('PASS runtime telemetry keeps diagnostic timing separate from retrieval averages and unknown denominators.');
} finally {
  if (child.exitCode === null && child.signalCode === null) {
    const stopped = new Promise(resolve => child.once('exit', resolve));
    child.kill('SIGTERM'); await stopped;
  }
  fs.rmSync(root, { recursive: true, force: true });
}
