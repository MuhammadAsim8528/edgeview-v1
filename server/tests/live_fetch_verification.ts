import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { unusedTestPort } from '../../scripts/test-server-port.mjs';

// Hermetic replacement for the retired fixed-port live-provider probe. Only an
// owned temporary backend is contacted; provider and monitoring transports are
// denied before application modules load, and response bodies are never logged.
async function runIsolatedVerification() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'edgeview-fetch-contract-'));
  const port = await unusedTestPort();
  const base = `http://127.0.0.1:${port}`;
  const outboundAudit = path.join(root, 'outbound-attempts.txt');
  fs.writeFileSync(path.join(root, 'rows.json'), '[]');
  fs.writeFileSync(path.join(root, 'config.json'), '{}');
  const inherited = Object.fromEntries(Object.entries(process.env).filter(([key]) => /^(PATH|SystemRoot|WINDIR|COMSPEC|USERPROFILE|TEMP|TMP|APPDATA|LOCALAPPDATA)$/i.test(key)));
  const child = spawn(process.execPath, ['--require', path.resolve('scripts/test-no-egress.cjs'), '--import', 'tsx', 'server.ts'], {
    cwd: process.cwd(),
    env: {
      ...inherited,
      NODE_ENV: 'test',
      PORT: String(port),
      EDGEVIEW_TEST_MODE: '1',
      EDGEVIEW_TEST_DB_DIR: root,
      EDGEVIEW_JSON_DB: path.join(root, 'rows.json'),
      EDGEVIEW_SQLITE_DB: path.join(root, 'operational.db'),
      EDGEVIEW_CONFIG: path.join(root, 'config.json'),
      EDGEVIEW_V1_DATA_DIR: path.join(root, 'runs'),
      EDGEVIEW_MONITORING_ENABLED: '0',
      EDGEVIEW_E2E_EGRESS_AUDIT: outboundAudit,
    },
    stdio: ['ignore', 'ignore', 'pipe'],
    windowsHide: true,
  });
  let stderr = '';
  child.stderr?.on('data', bytes => { stderr = (stderr + String(bytes)).slice(-2000); });
  try {
    let ready = false;
    for (const deadline = Date.now() + 45_000; Date.now() < deadline;) {
      assert.equal(child.exitCode, null, `isolated backend exited before readiness: ${stderr}`);
      try {
        const response = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(1000) });
        if (response.ok) {
          const health = await response.json();
          assert.equal(health.app?.pid, child.pid, 'refuse to mutate an unrelated listener');
          assert.equal(fs.realpathSync(health.app.project_root), fs.realpathSync(process.cwd()));
          ready = true;
          break;
        }
      } catch { /* bounded owned-process readiness */ }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.ok(ready, `isolated backend readiness timed out: ${stderr}`);

    const unavailable = await fetch(`${base}/api/enrich/company`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ company_name: 'Synthetic Contract Buyer', country: 'Kenya', forceFetch: false }),
      signal: AbortSignal.timeout(10_000),
    });
    assert.equal(unavailable.status, 503);
    const unavailableBody = await unavailable.json();
    assert.equal(unavailableBody.success, false);
    assert.equal(unavailableBody.code, 'CAPABILITY_UNAVAILABLE');
    assert.equal(unavailableBody.recoverable, true);
    assert.match(unavailableBody.remediation || '', /Serper/i);
    assert.equal(unavailableBody.capability?.available, false);
    assert.deepEqual(unavailableBody.capability?.dependencies, ['serper']);
    assert.equal(Object.hasOwn(unavailableBody, 'details'), false, 'retired details/raw-payload contract must not reappear');

    const invalid = await fetch(`${base}/api/enrich/company`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ company_name: 'Synthetic Contract Buyer', country: 'Kenya', forceFetch: 'yes' }),
      signal: AbortSignal.timeout(10_000),
    });
    assert.equal(invalid.status, 400);
    assert.deepEqual(await invalid.json(), { success: false, error: 'Invalid research mode.' });

    const runtime = await fetch(`${base}/api/runtime/state`, { signal: AbortSignal.timeout(5000) });
    assert.equal(runtime.status, 200);
    const runtimeBody = await runtime.json();
    assert.equal(runtimeBody.capabilities?.company_enrichment?.available, false);
    assert.equal(runtimeBody.capabilities?.company_enrichment?.dependencies?.includes('serper'), true);
    assert.equal(fs.existsSync(outboundAudit), false, 'provider or monitoring transport was attempted');
    console.log('PASS isolated current enrichment/capability response contracts; no live provider contacted and no payload logged');
  } finally {
    if (child.exitCode === null && child.signalCode === null) {
      const exited = once(child, 'exit', { signal: AbortSignal.timeout(15_000) });
      child.kill();
      await exited;
    }
    assert.equal(path.dirname(fs.realpathSync(root)), fs.realpathSync(os.tmpdir()));
    fs.rmSync(root, { recursive: true, force: true });
  }
}

runIsolatedVerification().catch(error => {
  console.error('Isolated fetch contract verification failed:', error instanceof Error ? error.message : 'unknown failure');
  process.exitCode = 1;
});
