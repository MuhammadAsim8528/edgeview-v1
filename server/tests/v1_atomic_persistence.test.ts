import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'edgeview-v1-persist-'));
process.env.EDGEVIEW_V1_DATA_DIR = tempRoot;

try {
  const { listV1RunIdentityHeaders, persistV1Run } = await import('../v1_engine');

  // Initialize the derived identity cache so persistence must append its index
  // only after the final run file has been promoted.
  assert.deepEqual(listV1RunIdentityHeaders(), []);

  const run = {
    id: 'run-atomic-persistence-test',
    company_name: 'Atomic Test Company',
    country: 'Kenya',
    status: 'COMPLETED' as const,
    started_at: '2026-10-19T08:00:00.000Z',
    completed_at: '2026-10-19T08:00:01.000Z',
    queries: ['"Atomic Test Company" Kenya official website'],
    results: [],
    raw_records: [],
    timeline: [{
      at: '2026-10-19T08:00:01.000Z',
      stage: 'storage' as const,
      status: 'success' as const,
      message: 'test persistence',
    }],
    limits: { max_queries: 4, max_results_per_query: 8, max_scrapes: 8, timeout_ms: 120000 },
  };

  persistV1Run(run);

  const finalPath = path.join(tempRoot, `${run.id}.json`);
  assert.equal(fs.existsSync(finalPath), true, 'final run file must exist after persistence succeeds');
  assert.ok(fs.statSync(finalPath).size > 0, 'final run file must never be zero bytes');
  assert.deepEqual(JSON.parse(fs.readFileSync(finalPath, 'utf8')), run, 'final run must round-trip exactly');

  const leftovers = fs.readdirSync(tempRoot).filter(name => name.endsWith('.tmp'));
  assert.deepEqual(leftovers, [], 'no temporary persistence files may survive a successful promotion');

  const identityIndex = path.join(tempRoot, 'identity-index.jsonl');
  assert.equal(fs.existsSync(identityIndex), true, 'identity index should be updated after final run promotion');
  const indexLines = fs.readFileSync(identityIndex, 'utf8').trim().split(/\r?\n/).map(line => JSON.parse(line));
  assert.equal(indexLines.some(item => item.id === run.id), true, 'identity index must contain the persisted run');

  assert.throws(() => persistV1Run(run), /Immutable run already exists/);
  assert.deepEqual(JSON.parse(fs.readFileSync(finalPath, 'utf8')), run, 'duplicate identity cannot displace the original');
  const originalWrite = fs.writeFileSync;
  try {
    fs.writeFileSync = ((file: any, ...args: any[]) => {
      if (typeof file === 'number') {
        fs.writeSync(file, '{"interrupted":');
        const error = new Error('Controlled disk-full failure');
        (error as any).code = 'ENOSPC';
        throw error;
      }
      return (originalWrite as any)(file, ...args);
    }) as typeof fs.writeFileSync;
    assert.throws(() => persistV1Run({ ...run, id: 'run-interrupted-write' }), /disk-full/);
  } finally { fs.writeFileSync = originalWrite; }
  assert.equal(fs.existsSync(path.join(tempRoot, 'run-interrupted-write.json')), false);
  assert.equal(fs.readFileSync(identityIndex, 'utf8').includes('run-interrupted-write'), false);
  const originalRename = fs.renameSync;
  try {
    fs.renameSync = (() => { throw new Error('Controlled promotion failure'); }) as typeof fs.renameSync;
    assert.throws(() => persistV1Run({ ...run, id: 'run-interrupted-promotion' }), /promotion failure/);
  } finally { fs.renameSync = originalRename; }
  assert.equal(fs.existsSync(path.join(tempRoot, 'run-interrupted-promotion.json')), false);
  assert.equal(fs.readFileSync(identityIndex, 'utf8').includes('run-interrupted-promotion'), false);
  assert.deepEqual(fs.readdirSync(tempRoot).filter(name => name.endsWith('.tmp')), []);

  console.log('PASS V1 atomic immutable run persistence');
} finally {
  delete process.env.EDGEVIEW_V1_DATA_DIR;
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
