import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'edgeview-v1-blobs-'));
process.env.EDGEVIEW_V1_DATA_DIR = tempRoot;

try {
  const { getV1Run, persistV1Run } = await import('../v1_engine');
  const heavy = 'Evidence page body '.repeat(1800);
  const heavyHash = crypto.createHash('sha256').update(JSON.stringify(heavy)).digest('hex');
  const run = {
    id: 'run-blob-storage-test',
    company_name: 'Blob Storage Company',
    country: 'Kenya',
    status: 'COMPLETED' as const,
    started_at: '2026-10-19T09:00:00.000Z',
    completed_at: '2026-10-19T09:00:01.000Z',
    queries: ['"Blob Storage Company" Kenya'],
    results: [{
      id: 'result-1', run_id: 'run-blob-storage-test', raw_record_id: 'raw-1',
      query: '"Blob Storage Company" Kenya', provider: 'direct-http', rank: 1,
      title: 'Blob Storage Company', url: 'https://example.com', snippet: 'Example',
      text: heavy, markdown: heavy, html: '<html>' + heavy + '</html>', links: [], metadata: {},
      search_latency_ms: 1, scrape_latency_ms: 2, status: 'success' as const,
    }],
    raw_records: [{
      id: 'raw-1', run_id: 'run-blob-storage-test', kind: 'scrape' as const,
      provider: 'direct-http', request: { url: 'https://example.com' }, response: heavy,
      requested_at: '2026-10-19T09:00:00.000Z', completed_at: '2026-10-19T09:00:01.000Z',
      latency_ms: 3, sha256: heavyHash,
    }],
    timeline: [{ at: '2026-10-19T09:00:01.000Z', stage: 'storage' as const, status: 'success' as const, message: 'blob test' }],
    evidence_workspace: {
      chunks: [{ id: 'chunk-1', result_id: 'result-1', url: 'https://example.com', source_type: 'official' as const, text: heavy }],
      accepted_claims: [], rejected_claims: [],
    },
    limits: { max_queries: 4, max_results_per_query: 8, max_scrapes: 8, timeout_ms: 120000 },
  };

  persistV1Run(run);
  const runPath = path.join(tempRoot, `${run.id}.json`);
  const persisted = JSON.parse(fs.readFileSync(runPath, 'utf8'));
  assert.equal(persisted._edgeview_storage?.format, 2, 'heavy runs must use persisted storage format v2');
  assert.ok(persisted._edgeview_storage.externalized_values >= 4, 'heavy duplicate fields must be externalized');
  assert.ok(persisted.results[0].text.__edgeview_blob_ref__, 'result text should be a blob ref on disk');
  assert.ok(persisted.raw_records[0].response.__edgeview_blob_ref__, 'raw response should be a blob ref on disk');
  assert.equal(
    persisted.results[0].text.__edgeview_blob_ref__.sha256,
    persisted.raw_records[0].response.__edgeview_blob_ref__.sha256,
    'identical heavy values across raw/results must share one content address'
  );

  const blobFiles: string[] = [];
  const walk = (dir: string) => {
    for (const name of fs.readdirSync(dir)) {
      const target = path.join(dir, name);
      const stat = fs.statSync(target);
      if (stat.isDirectory()) walk(target);
      else if (name.endsWith('.json.gz')) blobFiles.push(target);
    }
  };
  walk(path.join(tempRoot, 'blobs'));
  assert.equal(blobFiles.length, 2, 'one shared text blob plus one distinct HTML blob should be stored');
  const inlineBytes = Buffer.byteLength(JSON.stringify(run), 'utf8');
  const persistedBytes = fs.statSync(runPath).size + blobFiles.reduce((sum, file) => sum + fs.statSync(file).size, 0);
  assert.ok(persistedBytes < inlineBytes / 2, 'gzip + dedup should materially reduce this repetitive fixture');

  assert.deepEqual(getV1Run(run.id), run, 'hydrated V2 run must exactly match the original in-memory V1Run');

  // Old plain JSON runs remain readable with no migration.
  const legacy = { ...run, id: 'run-legacy-blob-compat', results: [], raw_records: [], evidence_workspace: undefined };
  const legacySerialized = JSON.stringify(legacy, null, 2);
  fs.writeFileSync(path.join(tempRoot, `${legacy.id}.json`), legacySerialized, 'utf8');
  assert.deepEqual(getV1Run(legacy.id), JSON.parse(legacySerialized), 'legacy V1 JSON run must remain readable unchanged');

  // Content-addressed evidence is never silently trusted: corruption must be
  // visible instead of returning incomplete evidence.
  fs.writeFileSync(blobFiles[0], Buffer.from('not-a-valid-gzip'));
  assert.throws(
    () => getV1Run(run.id),
    (error: any) => ['V1_BLOB_INTEGRITY_ERROR', 'V1_BLOB_MISSING'].includes(String(error?.code || '')),
    'tampered evidence blob must fail closed with a visible integrity error'
  );

  console.log('PASS V1 content-addressed evidence storage round-trip and integrity checks');
} finally {
  delete process.env.EDGEVIEW_V1_DATA_DIR;
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
