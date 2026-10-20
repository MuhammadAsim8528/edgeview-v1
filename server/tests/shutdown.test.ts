import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import initSqlJs from 'sql.js';
import { createShutdownController } from '../shutdown';
import { flushInitializedDatabase, getDb } from '../sqlite';
// This must not create a DB during shutdown of an uninitialized installation.
await flushInitializedDatabase();
for (const mode of ['normal', 'drain-failure', 'flush-failure', 'timeout']) {
  const events: string[] = [];
  let resolveDrain: (() => void) | undefined;
  const shutdown = createShutdownController({
    stopIntake: () => { events.push('stop'); },
    drain: () => {
      events.push('drain');
      if (mode === 'drain-failure') return Promise.reject(new Error('synthetic'));
      if (mode === 'timeout') return new Promise<void>(resolve => { resolveDrain = resolve; });
      return Promise.resolve();
    },
    flush: async () => { events.push('flush'); if (mode === 'flush-failure') throw new Error('synthetic'); },
    finish: code => { events.push(`exit-${code}`); },
    report: () => { events.push('warning'); }, drainMs: 10, deadlineMs: 1000,
  });
  const first = shutdown();
  assert.equal(shutdown(), first, 'signals must share one shutdown');
  await first;
  resolveDrain?.();
  assert.deepEqual(events.filter(e => e !== 'warning'), ['stop', 'drain', 'flush', mode === 'normal' ? 'exit-0' : 'exit-1']);
}
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'edgeview-shutdown-flush-'));
process.env.EDGEVIEW_TEST_MODE = '1';
process.env.EDGEVIEW_SQLITE_DB = path.join(root, 'operational.db');
try {
  const db = await getDb();
  await db.exec('CREATE TABLE shutdown_fixture (value TEXT)');
  await db.run("INSERT INTO shutdown_fixture VALUES ('retained')");
  await flushInitializedDatabase();
  const SQL = await initSqlJs();
  const reopened = new SQL.Database(fs.readFileSync(process.env.EDGEVIEW_SQLITE_DB));
  assert.equal(reopened.exec('SELECT value FROM shutdown_fixture')[0].values[0][0], 'retained');
  assert.equal(reopened.exec('PRAGMA integrity_check')[0].values[0][0], 'ok');
  reopened.close();
} finally { fs.rmSync(root, { recursive: true, force: true }); }
const { stopJobsForShutdown, createJob, runJobLoop } = await import('../job_manager');
await stopJobsForShutdown();
await assert.rejects(createJob([], 'importer'), /shutting down/);
assert.equal(await runJobLoop('not-started'), false);
console.log('PASS normal shutdown ordering, idempotence, drain deadline, persistence failure and uninitialized DB');
