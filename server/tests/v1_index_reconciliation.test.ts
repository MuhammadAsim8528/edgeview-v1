import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const reopen = process.argv[2] === '--reopen';
const root = reopen ? process.env.EDGEVIEW_V1_DATA_DIR! : fs.mkdtempSync(path.join(os.tmpdir(), 'edgeview-index-recovery-'));
process.env.EDGEVIEW_TEST_MODE = '1';
process.env.EDGEVIEW_V1_DATA_DIR = root;

try {
  const engine = await import('../v1_engine');
  if (reopen) {
    const headers = engine.listV1RunIdentityHeaders();
    assert.ok(headers.some(header => header.id === 'run-promoted-before-index-failure'), 'cold start reconciles an existing but incomplete index against immutable run files');
    assert.equal((await engine.getV1Run('run-promoted-before-index-failure'))?.company_name, 'Promoted Run Company');
    const index = fs.readFileSync(path.join(root, 'identity-index.jsonl'), 'utf8');
    assert.ok(index.includes('run-promoted-before-index-failure'), 'recovered headers are written back to the derived index');
    console.log('PASS fresh-process identity-index reconciliation after promotion/index failure');
  } else {
    assert.deepEqual(engine.listV1RunIdentityHeaders(), []);
    fs.writeFileSync(path.join(root, 'identity-index.jsonl'), '', 'utf8');
    const run = {
      id: 'run-promoted-before-index-failure', company_name: 'Promoted Run Company', country: 'Kenya', status: 'COMPLETED' as const,
      started_at: '2026-11-01T00:00:00.000Z', completed_at: '2026-11-01T00:00:01.000Z', queries: [], results: [], raw_records: [],
      timeline: [{ at: '2026-11-01T00:00:01.000Z', stage: 'storage' as const, status: 'success' as const, message: 'synthetic persistence test' }],
      limits: { max_queries: 4, max_results_per_query: 8, max_scrapes: 8, timeout_ms: 120_000 },
    };
    const originalAppend = fs.appendFileSync;
    try {
      fs.appendFileSync = ((file: any, ...args: any[]) => {
        if (String(file).endsWith('identity-index.jsonl')) throw new Error('Controlled identity-index publication failure');
        return (originalAppend as any)(file, ...args);
      }) as typeof fs.appendFileSync;
      assert.throws(() => engine.persistV1Run(run), /identity-index publication failure/, 'derived-index failure is not reported as a successful write');
    } finally { fs.appendFileSync = originalAppend; }
    const durable = path.join(root, `${run.id}.json`);
    assert.ok(fs.existsSync(durable), 'the immutable run was promoted before the derived index failed');
    assert.equal((await engine.getV1Run(run.id))?.company_name, run.company_name, 'the durable run remains directly readable');
    assert.ok(!fs.readFileSync(path.join(root, 'identity-index.jsonl'), 'utf8').includes(run.id), 'fixture proves the index is incomplete before restart');
    const child = spawnSync(process.execPath, ['--import', 'tsx', path.resolve('server/tests/v1_index_reconciliation.test.ts'), '--reopen'], {
      env: { ...process.env, EDGEVIEW_V1_DATA_DIR: root }, encoding: 'utf8', timeout: 30_000, windowsHide: true,
    });
    assert.equal(child.status, 0, child.stdout + child.stderr);
    console.log('PASS M35 truthful index failure and durable-run recovery after restart');
  }
} finally {
  if (!reopen) {
    assert.equal(path.dirname(fs.realpathSync(root)), fs.realpathSync(os.tmpdir()));
    fs.rmSync(root, { recursive: true, force: true });
  }
}
