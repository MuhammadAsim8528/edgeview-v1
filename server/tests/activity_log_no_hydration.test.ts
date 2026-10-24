import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'edgeview-log-projection-'));
process.env.EDGEVIEW_V1_DATA_DIR = root;
const originalRead = fs.readFileSync;
try {
  const { persistV1Run, listV1ActivityEvents, getV1Run, listV1RunIdentityHeaders } = await import('../v1_engine');
  const body = 'RAW_BODY_MUST_NOT_APPEAR_IN_LOGS '.repeat(100_000);
  for (let index = 0; index < 25; index++) {
    persistV1Run({ id: `run-log-${index}`, company_name: `Synthetic Company ${index}`, country: 'Kenya', status: 'FAILED',
      started_at: new Date(Date.UTC(2026, 0, index + 1)).toISOString(), completed_at: new Date(Date.UTC(2026, 0, index + 1, 1)).toISOString(),
      queries: [], results: [], limits: { max_queries: 1, max_results_per_query: 1, max_scrapes: 0, timeout_ms: 1000 },
      raw_records: [{ id: `raw-${index}`, run_id: `run-log-${index}`, kind: 'search', provider: 'serper', request: {}, response: body,
        requested_at: '2026-01-01T00:00:00Z', completed_at: '2026-01-01T00:00:00Z', latency_ms: 1, sha256: 'synthetic' }],
      timeline: Array.from({ length: 60 }, (_, event) => ({ at: new Date(Date.UTC(2026, 0, index + 1, 0, 0, event)).toISOString(), stage: 'search', status: 'failed', message: `Run ${index} event ${event}`, provider: 'serper', latency_ms: event })),
    } as any);
  }
  // Old-format fixture keeps raw bodies inline; activity must remain compatible
  // without returning those bodies or rewriting/migrating historical evidence.
  const legacyPath = path.join(root, 'run-log-24.json');
  const legacy = JSON.parse(originalRead(legacyPath, 'utf8'));
  delete legacy._edgeview_storage;
  legacy.raw_records[0].response = body;
  fs.writeFileSync(legacyPath, JSON.stringify(legacy));
  const hash = () => crypto.createHash('sha256').update(originalRead(legacyPath)).digest('hex');
  const before = hash();
  let blobReads = 0;
  (fs as any).readFileSync = (file: any, ...args: any[]) => {
    if (String(file).endsWith('.json.gz')) { blobReads++; throw new Error('Probe blocks evidence hydration'); }
    return (originalRead as any)(file, ...args);
  };
  assert.throws(() => getV1Run('run-log-23'), (error: any) => error.code === 'V1_BLOB_INTEGRITY_ERROR' && error.cause?.message === 'Probe blocks evidence hydration', 'positive control proves full reader would touch evidence blobs');
  assert.ok(blobReads > 0);
  blobReads = 0;
  const events = listV1ActivityEvents(500);
  assert.equal(blobReads, 0, 'activity-only reads must not touch evidence blobs');
  assert.equal(events.length, 500);
  assert.equal(events[0].message, 'Run 24 event 59');
  assert.ok(events.every(event => Number(event.run_id.split('-').at(-1)) >= 5), 'activity scope is latest 20 runs');
  assert.doesNotMatch(JSON.stringify(events), /RAW_BODY_MUST_NOT_APPEAR_IN_LOGS/);
  for (const [limit, count] of [[0, 1], [-1, 1], [2, 2], [100_000, 1000], [NaN, 500]]) assert.equal(listV1ActivityEvents(limit).length, count);
  for (let iteration = 0; iteration < 25; iteration++) assert.equal(listV1ActivityEvents(2).length, 2);
  assert.equal(blobReads, 0);
  assert.equal(listV1RunIdentityHeaders().length, 25, 'bounded activity must not truncate historical discovery');
  assert.equal(hash(), before, 'log reads must not rewrite immutable runs');
  fs.writeFileSync(path.join(root, 'run-log-24.json'), '{malformed-owned-test-fixture');
  const failure = listV1ActivityEvents(2);
  assert.ok(failure.some(event => event.run_id === 'run-log-24' && event.error === 'RUN_TIMELINE_READ_FAILED'));
  assert.equal(blobReads, 0);
  console.log('PASS bounded activity projection: no evidence hydration (positive full-read control), latest events, immutable/history preservation and visible read failure');
} finally { fs.readFileSync = originalRead; fs.rmSync(root, { recursive: true, force: true }); }
