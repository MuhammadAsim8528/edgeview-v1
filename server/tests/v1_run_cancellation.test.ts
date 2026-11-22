import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'edgeview-run-cancel-'));
process.env.EDGEVIEW_TEST_MODE = '1';
process.env.EDGEVIEW_V1_DATA_DIR = path.join(root, 'runs');
process.env.EDGEVIEW_CONFIG = path.join(root, 'config.json');
fs.writeFileSync(process.env.EDGEVIEW_CONFIG, JSON.stringify({
  groq_enabled: true,
  groq_api_key: 'gsk_test_fixture',
  groq_model: 'llama-3.3-70b-versatile',
}));
const originalFetch = globalThis.fetch;
try {
  globalThis.fetch = ((_url: any, opts: any) => new Promise((_, reject) => {
    if (opts?.signal?.aborted) return reject(opts.signal.reason);
    opts?.signal?.addEventListener('abort', () => reject(opts.signal.reason));
  })) as typeof fetch;
  const { runV1Enrichment, getV1EngineDiagnostics } = await import('../v1_engine');
  const alreadyCancelled = new AbortController();
  alreadyCancelled.abort(new Error('TEST_CANCELLED_BEFORE_DISPATCH'));
  await assert.rejects(runV1Enrichment('Cancellation Fixture Pharma', 'Kenya', { signal: alreadyCancelled.signal }), /TEST_CANCELLED_BEFORE_DISPATCH/);
  assert.equal(fs.existsSync(process.env.EDGEVIEW_V1_DATA_DIR), false, 'pre-dispatch cancellation persists no evidence');

  const controller = new AbortController();
  const task = runV1Enrichment('Cancellation Fixture Pharma', 'Kenya', { signal: controller.signal, timeoutMs: 30_000 });
  await new Promise(resolve => setTimeout(resolve, 20));
  controller.abort(new Error('TEST_CANCELLED_LIVE_RUN'));
  const run = await task;
  assert.equal(run.status, 'FAILED');
  assert.equal(getV1EngineDiagnostics().active_runs, 0, 'settled cancelled run must not remain active');
  assert.ok(run.timeline.some(event => event.error?.includes('TEST_CANCELLED_LIVE_RUN')));
  assert.ok(fs.existsSync(path.join(process.env.EDGEVIEW_V1_DATA_DIR, `${run.id}.json`)), 'started run retains its cancellation evidence');
  console.log('PASS caller cancellation and active-run cleanup');
} finally {
  globalThis.fetch = originalFetch;
  fs.rmSync(root, { recursive: true, force: true });
}
