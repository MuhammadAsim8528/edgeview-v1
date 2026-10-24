import assert from 'node:assert/strict';
import { isProviderHealthReport } from '../../src/utils/providerHealth';

const report = () => Object.fromEntries(['serper', 'hunter', 'nvidia', 'groq'].map(provider => [provider, {
  provider, configured: false, status: 'unconfigured', routingState: 'unconfigured',
  requestCount: 0, successCount: 0, failureCount: 0, timeoutCount: 0, rateLimitCount: 0,
  retryCount: null, cacheHits: null, cacheMisses: null, averageLatencyMs: null, lastError: null,
}]));
assert.equal(isProviderHealthReport(report()), true, 'zero real calls with unknown latency is valid');
for (const malformed of [null, [], {}, { serper: null }, { ...report(), exa: {} }]) {
  assert.equal(isProviderHealthReport(malformed), false);
}
for (const patch of [
  { configured: 'false' }, { provider: 'hunter' }, { status: 'excellent' }, { routingState: null },
  { requestCount: -1 }, { requestCount: Infinity }, { requestCount: 1.5 }, { successCount: 1 },
  { failureCount: 1 }, { timeoutCount: 1 }, { rateLimitCount: 1 }, { cacheHits: '0' },
  { averageLatencyMs: -1 }, { averageLatencyMs: NaN }, { lastDiagnosticLatencyMs: Infinity }, { lastError: {} },
]) {
  const value = report();
  Object.assign(value.serper, patch);
  assert.equal(isProviderHealthReport(value), false, JSON.stringify(patch));
}
for (const status of ['healthy', 'auth_failed', 'rate_limited', 'degraded', 'timeout', 'disabled', 'unknown']) {
  const value = report();
  Object.assign(value.serper, { configured: true, status, routingState: 'available', requestCount: 3,
    successCount: 1, failureCount: 2, timeoutCount: 1, rateLimitCount: 1, averageLatencyMs: 123.5,
    lastDiagnosticLatencyMs: 0, lastError: status === 'healthy' ? null : 'Provider check failed' });
  assert.equal(isProviderHealthReport(value), true);
}
console.log('PASS provider metrics reject malformed and impossible values without fabricating health');
