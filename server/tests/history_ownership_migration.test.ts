import { CURRENT_SCHEMA_VERSION } from '../sqlite';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import initSqlJs from 'sql.js';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'edgeview-history-migration-'));
Object.assign(process.env, { EDGEVIEW_TEST_MODE: '1', EDGEVIEW_TEST_DB_DIR: root });
const { getDb, resetDbInstanceForTests } = await import('../sqlite');
const { hasUnattributedHistory } = await import('../history_ownership');
const SQL = await initSqlJs();
const legacyDDL = `PRAGMA user_version=1;
 CREATE TABLE history_data(id INTEGER PRIMARY KEY AUTOINCREMENT, be_link TEXT, be_date TEXT,
 hs_code TEXT,item TEXT,importer TEXT,exporter TEXT,country TEXT,tot_fc REAL,qty REAL,
 unit TEXT,agent_name TEXT,file_name TEXT,source TEXT DEFAULT 'real',uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP);
 INSERT INTO history_data(id,importer,country,file_name) VALUES(7,'Synthetic Legacy Buyer','Kenya','same.csv');`;
try {
  for (const failWrite of [true, false]) {
    const file = path.join(root, failWrite ? 'failed.db' : 'successful.db');
    process.env.EDGEVIEW_SQLITE_DB = file;
    const legacy = new SQL.Database(); legacy.exec(legacyDDL); fs.writeFileSync(file, legacy.export()); legacy.close();
    const original = fs.readFileSync(file); resetDbInstanceForTests();
    const rename = fs.renameSync;
    try {
      if (failWrite) fs.renameSync = ((from, to) => {
        if (String(to) === file) throw Object.assign(new Error('Controlled migration persistence failure'), { code: 'ENOSPC' });
        return rename(from, to);
      }) as typeof fs.renameSync;
      if (failWrite) {
        await assert.rejects(getDb(), /DISK_FULL/);
        assert.deepEqual(fs.readFileSync(file), original, 'failed v1 upgrade must retain original bytes');
      } else {
        const db = await getDb();
        assert.deepEqual(await db.get('SELECT id, importer, country, file_name, file_id FROM history_data WHERE id=7'),
          { id: 7, importer: 'Synthetic Legacy Buyer', country: 'Kenya', file_name: 'same.csv', file_id: null },
          'migration must preserve the row and never invent ownership from a filename');
        assert.equal(await hasUnattributedHistory('same.csv'), true);
        const reopened = new SQL.Database(fs.readFileSync(file));
        assert.equal(reopened.exec('PRAGMA user_version')[0].values[0][0], CURRENT_SCHEMA_VERSION);
        assert.equal(reopened.exec('PRAGMA integrity_check')[0].values[0][0], 'ok'); reopened.close();
        resetDbInstanceForTests();
        assert.equal((await (await getDb()).get('SELECT COUNT(*) AS count FROM history_data')).count, 1);
      }
    } finally { fs.renameSync = rename; resetDbInstanceForTests(); }
    const backups = fs.readdirSync(root).filter(name => name.startsWith(path.basename(file) + '.pre-migration-v1-'));
    assert.equal(backups.length, 1, 'both success and failure preserve the pre-upgrade recovery image');
    assert.deepEqual(fs.readFileSync(path.join(root, backups[0])), original);
  }
  console.log('PASS legacy history preservation through current schema, unknown ownership, exact recovery bytes, failed write and integrity/reopen');
} finally {
  resetDbInstanceForTests();
  assert.equal(path.dirname(fs.realpathSync(root)), fs.realpathSync(os.tmpdir()));
  fs.rmSync(root, { recursive: true, force: true });
}
