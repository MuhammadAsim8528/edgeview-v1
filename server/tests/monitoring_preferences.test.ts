import assert from 'node:assert/strict';
import http from 'node:http';
import { gunzipSync } from 'node:zlib';

const requests: Array<{ url: string; body: string }> = [];
let pauseNext = false;
let onPaused = () => {};
let breakPaused = () => {};
const server = http.createServer((req, res) => {
  const chunks: Buffer[] = [];
  req.on('data', chunk => chunks.push(Buffer.from(chunk)));
  req.on('end', () => {
    const bytes = Buffer.concat(chunks);
    requests.push({ url: req.url || '', body: (req.headers['content-encoding'] === 'gzip' ? gunzipSync(bytes) : bytes).toString('utf8') });
    if (pauseNext) { pauseNext = false; breakPaused = () => req.socket.destroy(); onPaused(); return; }
    res.end('{}');
  });
});
await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
const address = server.address(); assert.ok(address && typeof address === 'object');
Object.assign(process.env, { EDGEVIEW_MONITORING_ENABLED: '1', EDGEVIEW_MONITORING_ALLOW_INSECURE_LOCAL: '1',
  EDGEVIEW_SENTRY_DSN: `http://public@127.0.0.1:${address.port}/1`, EDGEVIEW_POSTHOG_KEY: 'phc_synthetic_preferences', EDGEVIEW_POSTHOG_HOST: `http://127.0.0.1:${address.port}` });
try {
  const monitoring = await import('../monitoring');
  monitoring.initMonitoring({ version: '1.0.0-rc.2', build_id: 'c'.repeat(64), channel: 'beta', installation_id: '00000000-0000-4000-8000-000000000004' }, { errors: false, usage: false });
  assert.equal(monitoring.getMonitoringStatus().sentry.state, 'DISABLED');
  await monitoring.captureMonitoringEvent('doctor_run', {}, true);
  assert.equal(requests.length, 0, 'persisted startup opt-out must send nothing');
  await monitoring.applyMonitoringPreferences({ errors: false, usage: true });
  await monitoring.captureMonitoringEvent('doctor_run', {}, true);
  assert.equal(requests.length, 1); assert.ok(!requests[0].url.includes('/envelope'));

  // Queue without flushing, then turn off. This attacks the SDK queue rather
  // than merely asking capture() whether it would allow a new event.
  await monitoring.captureMonitoringEvent('export_started', {}, false);
  await monitoring.applyMonitoringPreferences({ errors: false, usage: false });
  await monitoring.shutdownMonitoring();
  assert.equal(requests.length, 1, 'unsent analytics must be drained without network transmission');
  await monitoring.captureMonitoringEvent('doctor_run', {}, true);
  assert.equal(requests.length, 1);
  await monitoring.applyMonitoringPreferences({ errors: true, usage: true });
  await monitoring.captureMonitoringEvent('doctor_run', {}, true);
  assert.equal(requests.filter(item => item.url.includes('/envelope')).length, 1);
  assert.equal(requests.filter(item => !item.url.includes('/envelope')).length, 2);
  assert.ok(!requests.some(item => item.body.includes('export_started')), 're-enable must not revive the discarded queue');
  await monitoring.applyMonitoringPreferences({ errors: true, usage: false });
  await monitoring.captureMonitoringEvent('runtime_error', { error_code: 'UNEXPECTED_ERROR' }, true);
  assert.equal(requests.length, 4, 'errors remain available independently of analytics');
  await monitoring.applyMonitoringPreferences({ errors: false, usage: false });
  await monitoring.shutdownMonitoring();
  assert.equal(requests.length, 4);
  await monitoring.applyMonitoringPreferences({ errors: false, usage: true });
  pauseNext = true;
  const paused = new Promise<void>(resolve => { onPaused = resolve; });
  const pending = monitoring.captureMonitoringEvent('export_failed', { outcome: 'failed' }, true);
  await paused;
  const disabled = monitoring.applyMonitoringPreferences({ errors: false, usage: false });
  breakPaused(); await pending; await disabled;
  const afterFailure = requests.length;
  await monitoring.applyMonitoringPreferences({ errors: false, usage: true });
  await monitoring.captureMonitoringEvent('doctor_run', {}, true);
  assert.ok(!requests.slice(afterFailure).some(item => item.body.includes('export_failed')), 'a network-failed in-flight batch must not survive opt-out and re-enable');
  await monitoring.applyMonitoringPreferences({ errors: false, usage: false });
  console.log('PASS actual monitoring startup opt-out, independent consent, queued-event suppression and re-enable');
} finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
