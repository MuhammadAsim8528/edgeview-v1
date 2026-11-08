import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import initSqlJs from 'sql.js';
import { getDb, resetDbInstanceForTests, getOperationalDatabaseStatus, CURRENT_SCHEMA_VERSION } from '../sqlite';
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'edgeview-schema-safety-'));
process.env.EDGEVIEW_TEST_MODE = '1';
const SQL = await initSqlJs();
async function scenario(name: string, sql: string | null, succeeds: boolean) {
  const file = path.join(root, `${name}.db`);
  process.env.EDGEVIEW_SQLITE_DB = file;
  resetDbInstanceForTests();
  assert.equal(getOperationalDatabaseStatus().status, 'unknown');
  if (sql === null) fs.writeFileSync(file, name === 'empty' ? Buffer.alloc(0) : 'not a SQLite database');
  else { const db = new SQL.Database(); db.run(sql); fs.writeFileSync(file, db.export()); db.close(); }
  const before = fs.readFileSync(file);
  if (!succeeds) {
    await assert.rejects(getDb());
    assert.equal(getOperationalDatabaseStatus().status, 'degraded');
    assert.deepEqual(fs.readFileSync(file), before, `${name}: failed initialization must not rename/replace/partially overwrite the original`);
  } else {
    const db = await getDb();
    assert.equal(getOperationalDatabaseStatus().status, 'ok');
    assert.equal((await db.get('SELECT email FROM contact_cache WHERE company_name = ?', ['Synthetic Legacy Company'])).email, 'fixture@example.invalid');
    const reopened = new SQL.Database(fs.readFileSync(file));
    assert.equal(reopened.exec('PRAGMA integrity_check')[0].values[0][0], 'ok');
    assert.equal(reopened.exec('PRAGMA user_version')[0].values[0][0], CURRENT_SCHEMA_VERSION);
    reopened.close();
    const backups = fs.readdirSync(root).filter(entry => entry.startsWith(`${name}.db.pre-migration-`));
    assert.equal(backups.length, 1);
    assert.deepEqual(fs.readFileSync(path.join(root, backups[0])), before);
    resetDbInstanceForTests();
    await getDb();
    assert.equal(fs.readdirSync(root).filter(entry => entry.startsWith(`${name}.db.pre-migration-`)).length, 1, 'idempotent restart must not create another migration backup');
  }
}
try {
  await scenario('corrupt', null, false);
  await scenario('empty', null, false);
  await scenario('future', `PRAGMA user_version=${CURRENT_SCHEMA_VERSION + 1}; CREATE TABLE retained(value TEXT);`, false);
  await scenario('partial-schema-failure', 'CREATE TABLE research_campaigns (id TEXT);', false);
  await scenario('legacy', "CREATE TABLE contact_cache (id INTEGER PRIMARY KEY, company_name TEXT UNIQUE, email TEXT); INSERT INTO contact_cache VALUES (1, 'Synthetic Legacy Company', 'fixture@example.invalid');", true);
  console.log('PASS corrupt/future/failed-schema bytes retained; legacy rows, backup, integrity and idempotent reopen');
} finally { resetDbInstanceForTests(); fs.rmSync(root, { recursive: true, force: true }); }
