import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'edgeview-publication-queue-'));
process.env.EDGEVIEW_V1_DATA_DIR = root;
try {
  const { withContactPublication, createJob, persistV1ContactOverlay, runJobLoop } = await import('../job_manager');
  const { runV1Enrichment } = await import('../v1_engine');
  const { withCompanyIdentityChange } = await import('../company_identity_work');
  const busy = { code: 'COMPANY_IDENTITY_BUSY' };
  await withCompanyIdentityChange(async () => {
    await assert.rejects(runV1Enrichment('Synthetic Medical', 'Kenya'), busy);
    await assert.rejects(createJob([], 'importer'), busy);
    await assert.rejects(persistV1ContactOverlay('synthetic', 'synthetic', {}, true), busy);
    await assert.rejects(runJobLoop('synthetic'), busy);
    await assert.rejects(withContactPublication('synthetic', async () => assert.fail('publication admitted')), busy);
  });
  const refusedChange = () => withCompanyIdentityChange(() => assert.fail('change admitted during work'));
  let release!: () => void;
  let entered!: () => void;
  const started = new Promise<void>(resolve => { entered = resolve; });
  const gate = new Promise<void>(resolve => { release = resolve; });
  const order: string[] = [];
  const first = withContactPublication('same-contact', async () => {
    order.push('first'); entered(); await gate;
    throw Object.assign(new Error('Synthetic storage refusal'), { code: 'PERSISTENCE_WRITE_FAILED' });
  });
  const rejected = assert.rejects(first, { code: 'PERSISTENCE_WRITE_FAILED' });
  await started;
  const second = withContactPublication('same-contact', async () => { order.push('second'); return 42; });
  const separate = await withContactPublication('other-contact', async () => { order.push('other'); return 7; });
  assert.equal(separate, 7);
  assert.deepEqual(order, ['first', 'other'], 'same-contact waits while different contact remains parallel');
  await assert.rejects(refusedChange(), busy);
  release(); await rejected;
  assert.equal(await second, 42, 'failed publication must not poison the next operation');
  assert.deepEqual(order, ['first', 'other', 'second']);
  assert.equal(await withContactPublication('same-contact', async () => 99), 99, 'subsequent publication remains usable');
  await assert.rejects(withCompanyIdentityChange(() => { throw new Error('synthetic change failure'); }), /synthetic change failure/);
  assert.equal(await withCompanyIdentityChange(() => 7), 7);
  console.log('PASS per-contact queue serializes same contact, preserves different-contact parallelism and recovers after failed save');
} finally { fs.rmSync(root, { recursive: true, force: true }); }
