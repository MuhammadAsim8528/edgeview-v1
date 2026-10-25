// Developer QA only: explicit real-vendor delivery from an existing compiled build.
// Does not observe, restart or replace the owner's live app or its browser page.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { parse } from 'dotenv';
import { artifactDigest, readBuildIdentity } from '../shared/build_identity.mjs';
import { unusedTestPort } from './test-server-port.mjs';

try {
const args = process.argv.slice(2);
if (args.length !== 3 || args[0] !== '--root' || args[2] !== '--send-real') {
  console.error('Usage: node scripts/probe-existing-monitoring-build.mjs --root <existing build root> --send-real');
  process.exit(2);
}
const root = fs.realpathSync(args[1]);
const build = readBuildIdentity(root);
if (!build.available || !build.gitCommit || artifactDigest(root) !== build.artifactHash) throw new Error('Compiled build identity/integrity must be available.');
const envFile = path.join(root, '.env');
if (fs.statSync(envFile).size > 64 * 1024) throw new Error('Developer monitoring configuration exceeds bound.');
const configured = parse(fs.readFileSync(envFile));
const monitoring = Object.fromEntries(['EDGEVIEW_MONITORING_ENABLED', 'EDGEVIEW_SENTRY_DSN', 'EDGEVIEW_POSTHOG_KEY', 'EDGEVIEW_POSTHOG_HOST']
  .map(key => [key, configured[key] || '']));
const dsn = new URL(monitoring.EDGEVIEW_SENTRY_DSN);
if (monitoring.EDGEVIEW_MONITORING_ENABLED !== '1' || dsn.protocol !== 'https:' || dsn.password
  || !/^[a-f0-9]{32}$/i.test(dsn.username) || !/^\/[0-9]+$/.test(dsn.pathname) || dsn.search || dsn.hash
  || !/^[a-z0-9-]+\.ingest(?:\.[a-z]+)?\.sentry\.io$/.test(dsn.hostname)
  || monitoring.EDGEVIEW_POSTHOG_HOST !== 'https://us.i.posthog.com'
  || !/^phc_[a-zA-Z0-9]+$/.test(monitoring.EDGEVIEW_POSTHOG_KEY)) throw new Error('Expected configured official monitoring destinations.');
const temporary = fs.realpathSync(os.tmpdir());
const scratch = fs.mkdtempSync(path.join(temporary, 'edgeview-monitoring-proof-'));
if (path.dirname(fs.realpathSync(scratch)) !== temporary) throw new Error('Temporary state boundary failed.');
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => /^(PATH|SystemRoot|WINDIR|COMSPEC|USERPROFILE|TEMP|TMP|APPDATA|LOCALAPPDATA)$/i.test(key)));
const port = await unusedTestPort();
const base = `http://127.0.0.1:${port}`;
fs.writeFileSync(path.join(scratch, 'rows.json'), '[]', { flag: 'wx' });
fs.writeFileSync(path.join(scratch, 'config.json'), '{}', { flag: 'wx' });
let child;
try {
  child = spawn(process.execPath, [path.join(root, 'dist', 'server.cjs')], {
    cwd: root, windowsHide: true, stdio: 'ignore', env: { ...env, ...monitoring, NODE_ENV: 'test',
      PORT: String(port), EDGEVIEW_TEST_MODE: '1', EDGEVIEW_TEST_DB_DIR: scratch,
      EDGEVIEW_JSON_DB: path.join(scratch, 'rows.json'), EDGEVIEW_SQLITE_DB: path.join(scratch, 'operational.db'),
      EDGEVIEW_CONFIG: path.join(scratch, 'config.json'), EDGEVIEW_V1_DATA_DIR: path.join(scratch, 'runs') },
  });
  let health;
  for (const deadline = Date.now() + 60_000; Date.now() < deadline;) {
    if (child.exitCode !== null) throw new Error('Owned monitoring runtime exited before readiness.');
    try {
      const response = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(2000) });
      const candidate = await response.json();
      if (!response.ok || candidate.app?.pid !== child.pid || candidate.app?.build?.buildId !== build.buildId) throw new Error();
      health = candidate; break;
    } catch { await new Promise(resolve => setTimeout(resolve, 100)); }
  }
  if (!health) throw new Error('Owned monitoring runtime did not pass identity readiness.');
  if (!Object.values(health.providers).every(provider => provider.configured === false)) throw new Error('Provider credentials must remain absent.');
  const startedAt = new Date().toISOString();
  const response = await fetch(`${base}/api/monitoring/test`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: '{}', signal: AbortSignal.timeout(15_000) });
  const result = await response.json();
  if (!response.ok || result.delivery?.projected !== true || result.delivery?.sentry !== true || result.delivery?.posthog !== true
    || result.monitoring?.sentry?.state !== 'TRANSPORT_OK' || result.monitoring?.posthog?.state !== 'TRANSPORT_OK') throw new Error('Controlled monitoring transport did not confirm delivery.');
  const frontend = await fetch(`${base}/api/monitoring/frontend-error`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: 'REACT_RENDER_FAILED' }), signal: AbortSignal.timeout(5000) });
  const frontendResult = await frontend.json();
  if (frontend.status !== 202 || frontendResult.delivery !== 'NOT_CONFIRMED') throw new Error('Controlled frontend-report boundary failed.');
  console.log(JSON.stringify({ qaOnly: true, artifactCommit: build.gitCommit, buildId: build.buildId,
    version: build.version, installationId: health.app.installation_id, startedAt,
    delivery: { sentry: true, posthog: true }, frontendReportAccepted: true, dashboardVerified: false,
    limitation: 'Controlled temporary compiled runtime and synthetic frontend-report API; not live app/browser, actual React crash, dashboard receipt or whole privacy acceptance.' }, null, 2));
} finally {
  if (child && child.exitCode === null && child.signalCode === null) {
    const stopped = once(child, 'exit', { signal: AbortSignal.timeout(15_000) });
    child.kill(); await stopped;
  }
  if (path.dirname(fs.realpathSync(scratch)) !== temporary) throw new Error('Refusing cleanup outside owned temporary parent.');
  fs.rmSync(scratch, { recursive: true, force: true });
  if (artifactDigest(root) !== build.artifactHash) throw new Error('Source artifact changed during the probe; result is not stable.');
}
} catch {
  console.error('Monitoring QA could not complete; credentials and child output were not emitted.');
  process.exitCode = 1;
}
