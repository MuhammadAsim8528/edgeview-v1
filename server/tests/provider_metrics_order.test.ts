import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { V1Run } from '../v1_engine';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'edgeview-metric-order-'));
process.env.EDGEVIEW_V1_DATA_DIR = root;
try {
  const { persistV1Run, getV1ProviderMetrics } = await import('../v1_engine');
  const save = (id: string, completedAt: string, failure?: { name: string; message: string; status: number }, httpStatus?: number) => {
    const run: V1Run = {
      id, company_name: 'Synthetic Metric Company', country: 'Kenya', status: failure ? 'FAILED' : 'COMPLETED',
      started_at: completedAt, completed_at: completedAt, queries: [], results: [], timeline: [],
      limits: { max_queries: 1, max_results_per_query: 1, max_scrapes: 1, timeout_ms: 1000 },
      raw_records: [{ id: `${id}-raw`, run_id: id, kind: 'search', provider: 'serper', request: { q: 'synthetic' },
        requested_at: completedAt, completed_at: completedAt, latency_ms: 100, sha256: 'synthetic', ...(httpStatus ? { http_status: httpStatus } : {}),
        ...(failure ? { failure } : { response: { organic: [] } }) }],
    };
    persistV1Run(run);
  };
  save('run-metric-failed', '2026-10-19T10:02:00.000Z', { name: 'Error', message: 'HTTP 503', status: 503 });
  assert.equal(getV1ProviderMetrics().serper.lastHttpStatus, 503);
  save('run-metric-recovered', '2026-10-19T10:03:00.000Z');
  assert.equal(getV1ProviderMetrics().serper.lastError, null, 'a newer success must clear the previous failure snapshot');
  save('run-metric-late-old', '2026-10-19T10:01:00.000Z', { name: 'Error', message: 'HTTP 401', status: 401 });
  save('run-metric-late-timeout', '2026-10-19T10:00:00.000Z', { name: 'Error', message: 'HTTP 408', status: 408 });
  const metric = getV1ProviderMetrics().serper;
  assert.equal(metric.requestCount, 4);
  assert.equal(metric.successCount, 1);
  assert.equal(metric.failureCount, 3);
  assert.equal(metric.timeoutCount, 1);
  assert.equal(metric.averageLatencyMs, 100);
  assert.equal(metric.lastCompletedAt, '2026-10-19T10:03:00.000Z');
  assert.equal(metric.lastError, null);
  assert.equal(metric.lastHttpStatus, null, 'no synthetic HTTP 200 should be invented for an unrecorded success status');
  save('run-metric-known-success', '2026-10-19T10:04:00.000Z', undefined, 201);
  assert.equal(getV1ProviderMetrics().serper.lastHttpStatus, 201, 'new recorded success status is exposed without guessing legacy statuses');
  console.log('PASS provider aggregates count every completed call while latest state follows completion time.');
} finally { delete process.env.EDGEVIEW_V1_DATA_DIR; fs.rmSync(root, { recursive: true, force: true }); }
