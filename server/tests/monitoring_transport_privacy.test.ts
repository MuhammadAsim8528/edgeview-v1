import assert from 'node:assert/strict';
import http from 'node:http';
import * as Sentry from '@sentry/node';
import { gunzipSync } from 'node:zlib';

const requests: Array<{ url: string; body: Buffer; headers: http.IncomingHttpHeaders }> = [];
const server = http.createServer((req, res) => {
  const chunks: Buffer[] = [];
  req.on('data', chunk => chunks.push(Buffer.from(chunk)));
  req.on('end', () => {
    requests.push({ url: req.url || '', body: Buffer.concat(chunks), headers: req.headers });
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end('{}');
  });
});
await new Promise<void>((resolve, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', () => resolve());
});
const address = server.address();
assert.ok(address && typeof address === 'object');
const base = `http://127.0.0.1:${address.port}`;

process.env.EDGEVIEW_MONITORING_ENABLED = '1';
process.env.EDGEVIEW_MONITORING_ALLOW_INSECURE_LOCAL = '1';
process.env.EDGEVIEW_SENTRY_DSN = `http://public@127.0.0.1:${address.port}/1`;
process.env.EDGEVIEW_POSTHOG_KEY = 'phc_synthetic_monitoring_test';
process.env.EDGEVIEW_POSTHOG_HOST = base;

const { initMonitoring, captureMonitoringEvent, shutdownMonitoring, getMonitoringStatus } = await import('../monitoring');
const identity = {
  version: '1.0.0-rc.2',
  build_id: 'a'.repeat(64),
  channel: 'beta' as const,
  installation_id: 'a5ac169c-5820-4f77-b50d-678e2f243237',
};
initMonitoring(identity);
assert.deepEqual(Sentry.getClient()?.getOptions().dataCollection, {
  userInfo: false, cookies: false, httpHeaders: false, httpBodies: [], urlQueryParams: false,
  genAI: { inputs: false, outputs: false }, mcp: { inputs: false, outputs: false },
  graphQL: { document: false, variables: false }, databaseQueryData: false,
  queues: false, stackFrameVariables: false, frameContextLines: 0,
}, 'the locked SDK must receive explicit collection restrictions, not a removed privacy option');

const markers = [
  'SYNTHETIC_PRIVATE_COMPANY', 'private-contact@example.test', '+254700000000',
  'SYNTHETIC_PRIVATE_EVIDENCE', 'SYNTHETIC_PRIVATE_PROMPT', 'synthetic-user',
  `nvapi-${'Q'.repeat(64)}`, `gsk_${'R'.repeat(64)}`,
];
const secret = markers.join(' ');
// Accidental direct SDK calls do not bypass EdgeView's final projection.
Sentry.captureException(new Error(secret));
Sentry.captureEvent({ message: secret, logger: secret, transaction: secret, tags: { event: 'runtime_error', company: secret }, extra: { evidence: secret }, request: { url: secret } });
const delivery = await captureMonitoringEvent('runtime_error', {
  provider: 'serper', stage: 'search', outcome: 'failed', error_code: 'PROVIDER_RATE_LIMITED',
  duration_ms: 321, http_status: 429, rss_bytes: 123456789,
  company: secret, email: secret, phone: secret, prompt: secret, evidence: secret,
  request: { url: `https://example.test/?company=${secret}`, headers: { authorization: secret } },
  exception: new Error(secret),
  path: `C:\\Users\\synthetic-user\\private\\file.ts`,
}, true);
assert.equal(delivery.projected, true);
assert.equal(delivery.sentry, true);
assert.equal(delivery.posthog, false, 'errors use Sentry; analytics does not duplicate error tracking');

for (const error_code of ['PROCESS_UNCAUGHT_EXCEPTION', 'PROCESS_UNHANDLED_REJECTION']) {
  const fatal = await captureMonitoringEvent('runtime_error', {
    stage: 'shutdown', outcome: 'failed', error_code, exception: secret, stack: secret, company: secret,
  }, true);
  assert.equal(fatal.sentry, true);
  assert.equal(fatal.posthog, false);
}

await captureMonitoringEvent('research_completed', {
  stage: 'resolution', outcome: 'success', duration_ms: 456,
  company_name: secret, contacts: [secret], raw_provider_body: secret,
}, true);
await new Promise(resolve => setTimeout(resolve, 150));
await shutdownMonitoring();
await new Promise(resolve => setTimeout(resolve, 100));
server.close();

assert.ok(requests.length >= 2, `expected both vendor transports, got ${requests.length}`);
const combined = requests.map(entry => {
  const body = entry.headers['content-encoding'] === 'gzip' ? gunzipSync(entry.body).toString('utf8') : entry.body.toString('utf8');
  return `${entry.url}\n${JSON.stringify(entry.headers)}\n${body}`;
}).join('\n');
for (const marker of markers) assert.ok(!combined.includes(marker), `private marker escaped monitoring boundary: ${marker.slice(0, 24)}`);
assert.ok(!combined.includes('C:\\Users\\'), 'local filesystem path escaped monitoring boundary');
assert.ok(combined.includes(identity.installation_id), 'pseudonymous installation id should support correlation');
assert.ok(combined.includes(identity.build_id), 'build id should support release correlation');
assert.ok(combined.includes('PROVIDER_RATE_LIMITED'), 'approved error class should survive');
assert.ok(combined.includes('Provider request rate limited'), 'fixed safe error message should survive');
assert.ok(requests.some(entry => entry.url.includes('/api/1/envelope')), 'Sentry envelope transport was not exercised');
assert.ok(requests.some(entry => !entry.url.includes('/api/1/envelope')), 'PostHog transport was not exercised');
const posthogBodies = requests.filter(entry => !entry.url.includes('/api/1/envelope')).map(entry =>
  entry.headers['content-encoding'] === 'gzip' ? gunzipSync(entry.body).toString('utf8') : entry.body.toString('utf8')
).join('\n');
assert.ok(posthogBodies.includes('$geoip_disable'), 'PostHog transport must disable server-side GeoIP enrichment');
for (const code of ['PROCESS_UNCAUGHT_EXCEPTION', 'PROCESS_UNHANDLED_REJECTION']) {
  assert.ok(combined.includes(code), 'fixed fatal code must survive the real SDK transport');
  assert.ok(!posthogBodies.includes(code), 'PostHog must not duplicate fatal error events');
}

const status = getMonitoringStatus();
assert.equal(status.sentry.state, 'TRANSPORT_OK');
assert.equal(status.posthog.state, 'TRANSPORT_OK');
assert.equal(status.sentry.dashboard_verified, false);
assert.equal(status.posthog.dashboard_verified, false);
console.log(`PASS actual Sentry/PostHog transports emitted ${requests.length} requests with no synthetic private markers`);
