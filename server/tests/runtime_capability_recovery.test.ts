import assert from 'node:assert/strict';
import { fetchRuntimeState } from '../../src/hooks/useEdgeViewRuntimeState';

const originalFetch = globalThis.fetch;
const disabledVendor = {
  configured: false, enabled: false, state: 'DISABLED', last_attempt_at: null,
  last_transport_success_at: null, dashboard_verified: false, error_code: null,
};
const snapshot = {
  monitoring: { enabled: false, privacy_boundary: 'strict_allowlist_projection', replay: 'OFF', sentry: { ...disabledVendor }, posthog: { ...disabledVendor } },
  usageScope: 'persisted_completed_provider_calls',
  success: true, resources: { serper: 42, hunter: 0, nvidia: 0, groq: 0, directHttp: 0, pagesAnalyzed: 0, cacheHits: 0, cacheMisses: 0 },
  jobs: { active: 0, completed: 0, failed: 0, partial: 0 },
  enrichment: { status: 'IDLE', currentCompany: null, completedCompanies: 0, totalCompanies: 0, quality: { complete: 0, partial: 0, notFound: 0, failed: 0, pending: 0 } },
  providers: Object.fromEntries(['serper','hunter','nvidia','groq'].map(provider => [provider, { configured: true, reachable: false, status: 'unknown', message: 'Synthetic' }])), logs: [],
  capabilities: Object.fromEntries(['company_enrichment','batch_enrichment'].map(id => [id, { id, available: true, status: 'READY', reason: 'Configured', dependencies: ['serper'] }])),
};
try {
  let calls = 0;
  let finish: (response: Response) => void = () => {};
  globalThis.fetch = (() => { calls += 1; return new Promise<Response>(resolve => { finish = resolve; }); }) as typeof fetch;
  const first = fetchRuntimeState();
  const second = fetchRuntimeState();
  assert.equal(calls, 1, 'concurrent refreshes must share one request');
  finish(new Response(JSON.stringify(snapshot)));
  const [initial, duplicate] = await Promise.all([first, second]);
  assert.equal(initial, duplicate);
  assert.equal(initial.capabilities.company_enrichment.available, true);
  assert.equal(initial.usageScope, 'persisted_completed_provider_calls', 'validated scope must reach the UI state');
  globalThis.fetch = (async () => { throw new Error('Controlled offline fixture'); }) as typeof fetch;
  const offline = await fetchRuntimeState();
  assert.equal(offline.capabilities.company_enrichment.available, false);
  assert.equal(offline.capabilities.company_enrichment.status, 'UNAVAILABLE');
  assert.match(offline.capabilities.company_enrichment.reason, /Cannot reach/);
  assert.equal(offline.resources.serper, 42, 'offline status must not erase previously loaded data');
  assert.equal(offline.usageScope, 'persisted_completed_provider_calls');
  globalThis.fetch = (async () => new Response(JSON.stringify({ success: true }))) as typeof fetch;
  const malformed = await fetchRuntimeState();
  assert.equal(malformed.capabilities.company_enrichment.available, false);
  assert.match(malformed.capabilities.company_enrichment.reason, /incomplete runtime state/);
  globalThis.fetch = (async () => new Response(JSON.stringify({ ...snapshot, resources: {} }))) as typeof fetch;
  assert.equal((await fetchRuntimeState()).capabilities.company_enrichment.available, false, 'malformed nested counters must not reach the UI');
  globalThis.fetch = (async () => new Response(JSON.stringify(snapshot))) as typeof fetch;
  const recovered = await fetchRuntimeState();
  assert.equal(recovered.capabilities.company_enrichment.available, true, 'next valid response must restore actions without reloading');
  assert.equal(recovered.resources.serper, 42);
  globalThis.fetch = (async () => Response.json({ ...snapshot, resources: { ...snapshot.resources, cacheHits: null, cacheMisses: null } })) as typeof fetch;
  const unknownCache = await fetchRuntimeState();
  assert.equal(unknownCache.capabilities.company_enrichment.available, true, 'unmeasured cache fields must not invalidate the runtime response');
  assert.equal(unknownCache.resources.cacheHits, null);
  globalThis.fetch = (async () => Response.json({ ...snapshot, resources: { ...snapshot.resources, serper: 'invalid' } })) as typeof fetch;
  assert.equal((await fetchRuntimeState()).capabilities.company_enrichment.available, false, 'invalid measurements must be rejected, not coerced');
  for (const monitoring of [undefined, {}, { ...snapshot.monitoring, sentry: { ...disabledVendor, state: 'CONNECTED' } }, { ...snapshot.monitoring, posthog: { ...disabledVendor, dashboard_verified: 'yes' } }]) {
    globalThis.fetch = (async () => Response.json({ ...snapshot, monitoring })) as typeof fetch;
    const invalidMonitoring = await fetchRuntimeState();
    assert.equal(invalidMonitoring.capabilities.company_enrichment.available, false, 'missing or malformed monitoring must fail closed');
    assert.equal(invalidMonitoring.resources.serper, 42, 'invalid monitoring must preserve loaded counters');
  }
  globalThis.fetch = (async () => Response.json(snapshot)) as typeof fetch;
  assert.equal((await fetchRuntimeState()).capabilities.company_enrichment.available, true, 'valid monitoring restores runtime capability');
  let observedAbort = false;
  globalThis.fetch = ((_input, options) => new Promise<Response>((_resolve, reject) => {
    options?.signal?.addEventListener('abort', () => { observedAbort = true; reject(new DOMException('Controlled abort', 'AbortError')); }, { once: true });
  })) as typeof fetch;
  const timeout = await fetchRuntimeState();
  assert.equal(observedAbort, true, 'a stalled status request must be aborted');
  assert.match(timeout.capabilities.company_enrichment.reason, /timed out/);
  assert.equal(timeout.resources.serper, 42);
  console.log('PASS shared runtime refresh coalescing, visible offline capability state, data retention and automatic recovery.');
} finally { globalThis.fetch = originalFetch; }
