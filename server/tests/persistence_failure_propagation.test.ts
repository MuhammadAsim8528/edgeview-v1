import fs from 'fs';
import path from 'path';
import { saveFileToDb, PersistenceWriteError } from '../sqlite_persistence';
import { getDb, resetDbInstanceForTests } from '../sqlite';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Persistence failure propagation test failed: ${message}`);
}

async function run() {
  const originalJson = process.env.EDGEVIEW_JSON_DB;
  const originalSqlite = process.env.EDGEVIEW_SQLITE_DB;
  const originalTestMode = process.env.EDGEVIEW_TEST_MODE;
  process.env.EDGEVIEW_TEST_MODE = '1';

  const root = path.resolve('.test-cache', `persistence-failure-${process.pid}-${Date.now()}`);
  fs.mkdirSync(root, { recursive: true });
  const blocker = path.join(root, 'not-a-directory');
  fs.writeFileSync(blocker, 'block child creation', 'utf8');

  try {
    // JSON persistence: parent component is a regular file, so durable write
    // must fail and the public save API must reject instead of returning success.
    process.env.EDGEVIEW_JSON_DB = path.join(blocker, 'edgeview_db.json');
    let jsonRejected = false;
    try {
      await saveFileToDb({
        id: 'durability-json-test',
        name: 'durability-json-test.csv',
        file_type: 'CSV',
        size: 10,
        upload_time: new Date().toISOString(),
        columns: ['Importer'],
        rows: [{ Importer: 'Example Co' }],
        summary: {} as any,
      } as any, 'durability-json-test-hash', 'test');
    } catch (error) {
      jsonRejected = error instanceof PersistenceWriteError || ['DISK_FULL', 'PERSISTENCE_WRITE_FAILED'].includes(String((error as any)?.code || ''));
    }
    assert(jsonRejected, 'saveFileToDb must reject when its durable JSON write fails');

    // sql.js persistence: initialization performs schema writes. With an
    // impossible path, getDb itself must reject rather than silently continue
    // with an in-memory database that callers believe is durable.
    process.env.EDGEVIEW_SQLITE_DB = path.join(blocker, 'edgeview.db');
    resetDbInstanceForTests();
    let sqliteRejected = false;
    try {
      await getDb();
    } catch (error) {
      sqliteRejected = ['DISK_FULL', 'PERSISTENCE_WRITE_FAILED'].includes(String((error as any)?.code || ''))
        || /persist|storage|disk/i.test(String((error as any)?.message || error));
    }
    assert(sqliteRejected, 'getDb must reject when the operational DB cannot be durably written');

    // Explicit durability barriers must surface a later write failure, and a
    // repaired storage path must recover without restarting the process.
    const recoverDir = path.join(root, 'recoverable-sqlite');
    const recoverDbPath = path.join(recoverDir, 'edgeview.db');
    fs.mkdirSync(recoverDir, { recursive: true });
    process.env.EDGEVIEW_SQLITE_DB = recoverDbPath;
    resetDbInstanceForTests();
    const recoverDb = await getDb();
    await recoverDb.run('CREATE TABLE IF NOT EXISTS durability_probe (value TEXT)');
    await recoverDb.flush();

    fs.rmSync(recoverDbPath, { force: true });
    fs.rmdirSync(recoverDir);
    fs.writeFileSync(recoverDir, 'temporarily blocks database directory', 'utf8');
    await recoverDb.run('INSERT INTO durability_probe (value) VALUES (?)', ['must-survive']);
    let flushError: any = null;
    try { await recoverDb.flush(); } catch (error) { flushError = error; }
    assert(
      ['DISK_FULL', 'PERSISTENCE_WRITE_FAILED'].includes(String(flushError?.code || '')),
      'flush must reject with a durability code when a previously valid persistence path becomes unwritable'
    );

    fs.rmSync(recoverDir, { force: true });
    fs.mkdirSync(recoverDir, { recursive: true });
    await recoverDb.flush();
    const recoveredRow = await recoverDb.get('SELECT value FROM durability_probe LIMIT 1');
    assert(recoveredRow?.value === 'must-survive', 'retry after storage repair must persist the in-memory mutation without restart');

    console.log('PASS durable persistence failures propagate and recover after storage repair');
  } finally {
    resetDbInstanceForTests();
    if (originalJson === undefined) delete process.env.EDGEVIEW_JSON_DB; else process.env.EDGEVIEW_JSON_DB = originalJson;
    if (originalSqlite === undefined) delete process.env.EDGEVIEW_SQLITE_DB; else process.env.EDGEVIEW_SQLITE_DB = originalSqlite;
    if (originalTestMode === undefined) delete process.env.EDGEVIEW_TEST_MODE; else process.env.EDGEVIEW_TEST_MODE = originalTestMode;
    try { fs.rmSync(root, { recursive: true, force: true }); } catch {}
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
