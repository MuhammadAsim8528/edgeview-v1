import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { isTerminalJobStatus, mergeJobProgress, nextPollDelay } from '../../src/utils/jobPolling';
import { normalizeBatchJobSnapshot } from '../../src/utils/batchSnapshot';
import { createDeadlineSignal, waitForAbort } from '../operation_control';
import { parseDBFBuffer } from '../parsers';
import { hydrateV1RunFromStorage } from '../v1_blob_store';

for (const status of ['PAUSED', 'COMPLETED', 'FAILED', 'STOPPED', 'RESOURCE_LIMITED', 'AWAITING_AUTHORIZATION']) {
  assert.equal(isTerminalJobStatus(status), true, `${status} must stop polling`);
}
assert.equal(isTerminalJobStatus('DISCOVERING'), false);
assert.ok(nextPollDelay(5) <= 30_000);

const job = normalizeBatchJobSnapshot({ id: 'job-regression', status: 'PAUSED', importer_exporter_mode: 'importer',
  total_companies: 2, completed_companies: 0, company_ids: ['same-name-a', 'same-name-b'],
  company_states: {
    'same-name-a': { id: 'same-name-a', name: 'Same Company', status: 'pending', stage: '', resourceUsage: {} },
    'same-name-b': { id: 'same-name-b', name: 'Same Company', status: 'pending', stage: '', resourceUsage: {} },
  },
})!;
const merged = mergeJobProgress(job, { id: job.id, status: 'PAUSED', importer_exporter_mode: 'importer', total_companies: 2,
  completed_companies: 1, recent_results: [{ id: 'same-name-b', name: 'Same Company', status: 'completed', completedAt: '2026-01-01T00:00:00Z' }] });
assert.equal(merged?.company_states['same-name-b'].status, 'completed');
assert.equal(merged?.company_states['same-name-a'].status, 'pending', 'same-name records must merge by stable ID');

const deadline = createDeadlineSignal(undefined, 15, 'TEST_DEADLINE');
await assert.rejects(deadline.timeout, /TEST_DEADLINE/);
assert.equal(deadline.signal.aborted, true);
deadline.cleanup();
const controller = new AbortController();
const waiting = waitForAbort(controller.signal, 60_000);
controller.abort(new Error('STOP_REQUESTED'));
await assert.rejects(waiting, /STOP_REQUESTED/);

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'edgeview-audit-regressions-'));
try {
  const blob = gzipSync(Buffer.alloc(1024 * 1024, 1));
  const file = path.join(root, 'bomb.json.gz');
  fs.writeFileSync(file, blob);
  const originalRead = fs.createReadStream;
  let streamReads = 0;
  (fs as any).createReadStream = (...args: any[]) => { streamReads++; return (originalRead as any)(...args); };
  try {
    await assert.rejects(hydrateV1RunFromStorage({ _edgeview_storage: { format: 2 },
      raw_records: [{ response: { __edgeview_blob_ref__: { format: 1, sha256: '0'.repeat(64), encoding: 'gzip-json', uncompressed_bytes: 1024 * 1024 * 1024 } } }] } as any, root), /safe decompression limit/);
    assert.equal(streamReads, 0, 'oversize declared output must be refused before decompression');
  } finally { (fs as any).createReadStream = originalRead; }

  const validDbf = Buffer.alloc(32 + 32 + 1 + 7, 0);
  validDbf.writeUInt32LE(1, 4); validDbf.writeUInt16LE(65, 8); validDbf.writeUInt16LE(7, 10);
  validDbf.write('ITEM', 32, 'ascii'); validDbf[43] = 67; validDbf[48] = 5; validDbf[64] = 0x0d;
  validDbf.write(' abc ', 65, 'latin1');
  assert.deepEqual(parseDBFBuffer(validDbf).rows, [{ ITEM: 'abc' }]);
  validDbf.writeUInt32LE(0, 4);
  assert.deepEqual(parseDBFBuffer(validDbf).rows, [], 'zero records must not fall back to all physical rows');
  validDbf.writeUInt32LE(1, 4); validDbf[64] = 0;
  assert.deepEqual(parseDBFBuffer(validDbf).rows, [], 'missing DBF terminator must be rejected');
} finally { fs.rmSync(root, { recursive: true, force: true }); }
console.log('PASS polling terminal states/identity/backoff, abort deadlines, bounded blob refusal and DBF validation');
