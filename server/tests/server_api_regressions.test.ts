import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';
import { unusedTestPort } from '../../scripts/test-server-port.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'edgeview-server-api-regressions-'));
const port = await unusedTestPort();
const base = `http://127.0.0.1:${port}`;
const directoryFailure = path.join(root, 'fail-directory');
const runtimeFailure = path.join(root, 'fail-runtime');
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => /^(PATH|SystemRoot|WINDIR|COMSPEC|USERPROFILE|TEMP|TMP|APPDATA|LOCALAPPDATA)$/i.test(key)));

const childScript = `
  const fs = await import('node:fs');
  // Force two report uploads into the same millisecond.
  Date.now = () => 1770000000000;
  const { db } = await import('./server/db.ts');
  const syntheticFile = {
    id: 'api-regression-file', name: 'api-regression.csv', file_type: 'CSV', size: 100,
    upload_time: '2026-01-01T00:00:00.000Z', columns: ['Country', 'Importer', 'Exporter'],
    rows: [{ Country: 'Kenya', Importer: 'Synthetic API Buyer', Exporter: 'Synthetic API Supplier' }], summary: {},
  };
  const { computeSummary } = await import('./server/summary.ts');
  syntheticFile.summary = computeSummary(syntheticFile.columns, syntheticFile.rows);
  const { saveFileToDb } = await import('./server/sqlite_persistence.ts');
  await saveFileToDb(syntheticFile, 'api-regression-unique-hash', 'test');
  db.files.set(syntheticFile.id, syntheticFile);
  db.syncCompaniesFromFiles();
  db.pruneOrphanedContacts();
  db.rebuildIndexes();

  const { getDb } = await import('./server/sqlite.ts');
  const sql = await getDb();
  const states = {
    old: { id: 'old', name: 'Oldest but slowest', status: 'completed', stage: 'done', durationMs: 90000, completedAt: '2026-01-01T00:00:00.000Z', resourceUsage: {} },
    newest: { id: 'newest', name: 'Newest but fastest', status: 'completed', stage: 'done', durationMs: 1, completedAt: '2026-02-01T00:00:00.000Z', resourceUsage: {} },
    legacyFirst: { id: 'legacyFirst', name: 'Legacy first', status: 'failed', stage: 'failed', durationMs: 80000, resourceUsage: {} },
    legacySecond: { id: 'legacySecond', name: 'Legacy second', status: 'failed', stage: 'failed', durationMs: 1, resourceUsage: {} },
    rechecked: { id: 'rechecked', name: 'Recently rechecked saved evidence', status: 'completed', stage: 'done', durationMs: 2, completedAt: '2025-12-01T00:00:00.000Z', updatedAt: '2026-03-01T00:00:00.000Z', resourceUsage: {} },
  };
  await sql.run(\`INSERT INTO research_jobs (
    id, status, importer_exporter_mode, total_companies, completed_companies,
    current_company, current_stage, company_ids, company_states, resource_usage, error_message,
    is_pilot, pilot_authorized
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)\`, [
    'job-recent-regression', 'COMPLETED', 'importer', 5, 5, '', 'done',
    JSON.stringify(Object.keys(states)), JSON.stringify(states), '{}', '', 0, 0,
  ]);
  await sql.flush();

  const sqlGet = sql.get;
  sql.get = async (query, params = []) => {
    if (fs.existsSync(process.env.RUNTIME_FAILURE) && query.includes('SELECT COUNT(*) as count FROM research_jobs')) {
      throw new Error('Controlled job count database failure');
    }
    return sqlGet(query, params);
  };
  const { TradeRelationshipResolver } = await import('./server/trade_relationship_resolver.ts');
  TradeRelationshipResolver.buildTradeIndex = async () => {
    if (fs.existsSync(process.env.DIRECTORY_FAILURE)) throw new Error('Controlled directory database failure');
    return { importedFrom: new Map(), suppliedTo: new Map() };
  };
  await import('./server.ts');
`;

const child = spawn(process.execPath, ['--import', 'tsx', '--input-type=module', '--eval', childScript], {
  cwd: projectRoot,
  env: {
    ...env, NODE_ENV: 'test', PORT: String(port), EDGEVIEW_TEST_MODE: '1', EDGEVIEW_TEST_DB_DIR: root,
    EDGEVIEW_JSON_DB: path.join(root, 'rows.json'), EDGEVIEW_SQLITE_DB: path.join(root, 'operational.db'),
    EDGEVIEW_CONFIG: path.join(root, 'config.json'), EDGEVIEW_V1_DATA_DIR: path.join(root, 'runs'),
    DIRECTORY_FAILURE: directoryFailure, RUNTIME_FAILURE: runtimeFailure,
  },
  stdio: ['ignore', 'ignore', 'pipe'],
});
let stderr = '';
child.stderr?.on('data', bytes => { stderr = (stderr + String(bytes)).slice(-5000); });
const request = (route: string, options: RequestInit = {}) => fetch(`${base}${route}`, { ...options, signal: AbortSignal.timeout(20000) });
const postJson = (route: string, body: unknown) => request(route, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});

try {
  let ready = false;
  for (const deadline = Date.now() + 45000; Date.now() < deadline;) {
    assert.equal(child.exitCode, null, stderr);
    try {
      const health = await (await request('/api/health')).json();
      assert.equal(health.app.pid, child.pid);
      ready = true;
      break;
    } catch {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  assert.ok(ready, stderr);

  const duplicate = await postJson('/api/enrich/jobs', {
    company_ids: ['comp-abc123', 'COMP-ABC123'], mode: 'importer', reuseOnly: true,
  });
  assert.equal(duplicate.status, 400, 'case-only aliases of one canonical ID are rejected before job creation');
  const jobsAfterDuplicate = await (await request('/api/enrich/jobs')).json();
  assert.equal(jobsAfterDuplicate.jobs.length, 1, 'the rejected aliases did not create a second job');

  const firstReport = await (await postJson('/api/reports/upload', { title: 'First', report_type: 'text' })).json();
  const secondReport = await (await postJson('/api/reports/upload', { title: 'Second', report_type: 'text' })).json();
  assert.notEqual(firstReport.report.id, secondReport.report.id, 'same-millisecond report IDs remain unique');
  const reports = await (await request('/api/reports')).json();
  assert.ok(reports.some((report: any) => report.id === firstReport.report.id));
  assert.ok(reports.some((report: any) => report.id === secondReport.report.id));

  const progress = await (await request('/api/enrich/job/job-recent-regression/progress')).json();
  assert.deepEqual(progress.progress.recent_results.map((result: any) => result.name), [
    'Recently rechecked saved evidence', 'Newest but fastest', 'Oldest but slowest', 'Legacy first', 'Legacy second',
  ], 'recent results use updatedAt/completedAt, then original queue order, never duration');

  for (const format of ['csv', 'xlsx']) {
    const response = await postJson('/api/export/report', { format, report_type: 'both' });
    assert.equal(response.status, 200, stderr);
    assert.equal(response.headers.get('content-type'), 'application/zip');
    const zip = await JSZip.loadAsync(Buffer.from(await response.arrayBuffer()));
    const importer = zip.file(`EdgeView_Importer_Report.${format}`);
    const exporter = zip.file(`EdgeView_Exporter_Report.${format}`);
    assert.ok(importer && exporter, `report_type=both includes importer and exporter ${format.toUpperCase()} files`);
    if (format === 'csv') {
      assert.ok((await importer!.async('string')).includes('Importer Name'));
      assert.ok((await exporter!.async('string')).includes('Exporter Name'));
    }
  }

  fs.writeFileSync(directoryFailure, 'controlled failure');
  const directory = await request('/api/international-importer-directory');
  assert.equal(directory.status, 500);
  assert.equal((await directory.json()).success, false);
  assert.equal((await request('/api/health')).status, 200, 'directory rejection is contained and the process stays alive');
  assert.equal(child.exitCode, null);
  fs.rmSync(directoryFailure);
  assert.equal((await request('/api/international-importer-directory')).status, 200);

  fs.writeFileSync(runtimeFailure, 'controlled failure');
  const runtime = await request('/api/runtime/state');
  const runtimeBody = await runtime.json();
  assert.equal(runtime.status, 503);
  assert.equal(runtimeBody.success, false);
  assert.equal(runtimeBody.code, 'JOB_STATE_UNAVAILABLE');
  assert.ok(!JSON.stringify(runtimeBody).includes('IDLE'), 'database failure cannot masquerade as an idle runtime');
  fs.rmSync(runtimeFailure);
  const recoveredRuntime = await request('/api/runtime/state');
  assert.equal(recoveredRuntime.status, 200);
  assert.equal((await recoveredRuntime.json()).success, true);

  console.log('PASS server API duplicate IDs, report IDs, recent ordering, both exports, async containment, and runtime errors');
} finally {
  if (child.exitCode === null) {
    const exited = once(child, 'exit', { signal: AbortSignal.timeout(15000) });
    child.kill();
    await exited;
  }
  assert.equal(path.dirname(fs.realpathSync(root)), fs.realpathSync(os.tmpdir()));
  fs.rmSync(root, { recursive: true, force: true });
}
