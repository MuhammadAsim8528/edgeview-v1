import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const reopened = process.argv[2] === '--reopen';
const root = reopened ? process.env.EDGEVIEW_V1_DATA_DIR! : fs.mkdtempSync(path.join(os.tmpdir(), 'edgeview-history-pages-'));
process.env.EDGEVIEW_V1_DATA_DIR = root;
globalThis.fetch = () => { throw new Error('HISTORY_MUST_NOT_CALL_PROVIDERS'); };
try {
  const engine = await import('../v1_engine');
  const page = (engine as any).listV1RunPage;
  assert.equal(typeof page, 'function', 'saved history needs bounded cursor pages');
  if (!reopened) {
    // Actual immutable records, including same timestamp ties and a legacy run.
    for (let i = 0; i < 1005; i++) engine.persistV1Run({
      id: `run-history-${String(i).padStart(4, '0')}`, company_name: `Synthetic Buyer ${i}`,
      country: i % 2 ? 'Sudan' : 'South Sudan', status: 'COMPLETED',
      started_at: '2026-10-01T00:00:00.000Z', completed_at: '2026-10-01T00:00:01.000Z',
      queries: [], results: [], raw_records: [], timeline: [],
      limits: { max_queries: 4, max_results_per_query: 8, max_scrapes: 8, timeout_ms: 120000 },
    });
  }
  const first = page(50);
  assert.equal(first.runs.length, 50);
  assert.ok(first.next_cursor);
  assert.equal(first.limit, 50);
  if (!reopened) assert.deepEqual(first.runs.map((run: any) => run.id), Array.from({ length: 50 }, (_, i) => `run-history-${String(1004 - i).padStart(4, '0')}`), 'equal timestamps require a stable ID tie-breaker');
  if (!reopened) {
    // An arrival after the first page must not shift the older-page boundary.
    const template = engine.getV1Run('run-history-0000')!;
    engine.persistV1Run({ ...template, id: 'run-new-arrival', started_at: '2026-10-31T00:00:00.000Z' });
  }
  const ids = first.runs.map((run: any) => run.id);
  let cursor = first.next_cursor;
  for (let requests = 0; cursor; requests++) {
    assert.ok(requests < 30, 'history cursor must make progress');
    const next = page(50, cursor);
    assert.ok(next.runs.length <= 50);
    ids.push(...next.runs.map((run: any) => run.id));
    cursor = next.next_cursor;
  }
  assert.equal(new Set(ids).size, ids.length, 'ties/concurrent arrival cannot duplicate records');
  assert.equal(ids.length, reopened ? 1006 : 1005);
  assert.ok(ids.includes('run-history-0000') && ids.includes('run-history-1004'), 'history beyond old UI cap stays discoverable');
  assert.equal(engine.getV1Run('run-history-0001')!.country, 'Sudan');
  assert.equal(engine.getV1Run('run-history-0000')!.country, 'South Sudan');
  for (const limit of [0, -1, 201, 0.5, NaN, Infinity]) assert.throws(() => page(limit), /HISTORY_PAGE_INVALID/);
  for (const value of ['../escape', 'A'.repeat(2049), 'e30', [], 4, '']) {
    if (value !== '') assert.throws(() => page(50, value), /HISTORY_PAGE_INVALID/);
  }
  for (const anchor of [{}, [], { started_at: 'not-a-date', id: 'run-history-0000' }, { started_at: '2026-10-01', id: '../escape' }, { started_at: '2026-10-01', id: 'run-history-0000', extra: true }]) {
    assert.throws(() => page(50, Buffer.from(JSON.stringify(anchor)).toString('base64url')), /HISTORY_PAGE_INVALID/);
  }
  assert.equal(fs.readdirSync(root).filter(name => /^run-.*\.json$/.test(name)).length, 1006, 'paging does not remove immutable evidence');
  if (!reopened) {
    const result = spawnSync(process.execPath, ['--import', 'tsx', path.resolve('server/tests/research_history_page.test.ts'), '--reopen'], {
      env: { ...process.env, EDGEVIEW_V1_DATA_DIR: root }, encoding: 'utf8', timeout: 30000, windowsHide: true,
    });
    assert.equal(result.status, 0, result.stdout + result.stderr);
  }
  console.log('PASS bounded immutable history: >1000 records, timestamp ties, concurrent arrival, exact countries, no provider calls and restart');
} finally {
  if (!reopened) {
    assert.equal(path.dirname(fs.realpathSync(root)), fs.realpathSync(os.tmpdir()));
    fs.rmSync(root, { recursive: true, force: true });
  }
}
