import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import initSqlJs from 'sql.js';
import { applyHistoryRepair, recoverInterruptedHistoryRepair } from '../history_repair_transaction';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'edgeview-repair-transaction-'));
const SQL = await initSqlJs();
const db = new SQL.Database();
db.exec(`PRAGMA user_version=2;
 CREATE TABLE history_data(id INTEGER PRIMARY KEY AUTOINCREMENT,be_link TEXT,be_date TEXT,hs_code TEXT,
 item TEXT,importer TEXT,exporter TEXT,country TEXT,tot_fc REAL,qty REAL,unit TEXT,agent_name TEXT,
 file_name TEXT,source TEXT DEFAULT 'real',uploaded_at TEXT DEFAULT CURRENT_TIMESTAMP,file_id TEXT);
 INSERT INTO history_data(be_link,be_date,hs_code,item,importer,exporter,country,tot_fc,qty,unit,agent_name,file_name,source)
 VALUES('','','','Product','Buyer B','','Kenya',10,0,'','','same.csv','real');`);
const before = db.export(); db.close();
const primary = Buffer.from(JSON.stringify(['A', 'B'].map(id => ({ id, file_name: 'same.csv', file_hash: id,
  source: 'real', row_count: 1, file_data: { rows: [{ Importer: `Buyer ${id}`, Country: 'Kenya', Item: 'Product', TOT_FC: 10 }], columns: [] } }))));
function fixture(label: string) {
  const directory = path.join(root, label); fs.mkdirSync(directory);
  fs.writeFileSync(path.join(directory, 'edgeview.db'), before);
  fs.writeFileSync(path.join(directory, 'edgeview_db.json'), primary);
  return directory;
}
const child = (directory: string, mode: string) => spawnSync(process.execPath, ['--import', 'tsx',
  fileURLToPath(new URL('./history_repair_transaction_child.ts', import.meta.url)), directory, mode],
{ cwd: process.cwd(), encoding: 'utf8', timeout: 30000, windowsHide: true });
try {
  const success = fixture('success');
  assert.equal((await applyHistoryRepair(success, 'same.csv')).status, 'REPAIRED');
  const repaired = new SQL.Database(fs.readFileSync(path.join(success, 'edgeview.db')));
  assert.deepEqual(repaired.exec('SELECT importer,country,file_id FROM history_data ORDER BY file_id')[0].values,
    [['Buyer A', 'Kenya', 'A'], ['Buyer B', 'Kenya', 'B']]); repaired.close();
  assert.deepEqual(fs.readFileSync(path.join(success, 'edgeview_db.json')), primary);
  assert.equal((await applyHistoryRepair(success, 'same.csv')).status, 'CURRENT');
  assert.equal(fs.existsSync(path.join(success, 'edgeview.db.lock.maintenance')), false);
  for (const mode of ['kill-before', 'kill-after', 'throw-after']) {
    const directory = fixture(mode), result = child(directory, mode);
    assert.equal(result.status, mode === 'kill-before' ? 77 : mode === 'kill-after' ? 78 : 19, result.stderr);
    if (mode !== 'throw-after') {
      assert.equal(fs.existsSync(path.join(directory, 'edgeview.db.lock.maintenance')), true);
      await assert.rejects(applyHistoryRepair(directory, 'same.csv'), /MAINTENANCE_BUSY/);
      assert.equal(recoverInterruptedHistoryRepair(directory).status, 'ROLLED_BACK');
    }
    assert.deepEqual(fs.readFileSync(path.join(directory, 'edgeview.db')), Buffer.from(before), 'exact original DB restored');
    assert.deepEqual(fs.readFileSync(path.join(directory, 'edgeview_db.json')), primary);
    assert.equal(fs.existsSync(path.join(directory, 'edgeview.db.lock.maintenance')), false);
    assert.equal((await applyHistoryRepair(directory, 'same.csv')).status, 'REPAIRED', 'normal operation works after recovery');
  }
  const locked = fixture('locked'); fs.writeFileSync(path.join(locked, 'edgeview.db.lock'), '1');
  await assert.rejects(applyHistoryRepair(locked, 'same.csv'));
  assert.deepEqual(fs.readFileSync(path.join(locked, 'edgeview.db')), Buffer.from(before));
  const full = fixture('full'), writeFile = fs.writeFileSync;
  try {
    fs.writeFileSync = ((target: any, ...args: any[]) => {
      if (typeof target === 'number') throw Object.assign(new Error('Synthetic private disk failure'), { code: 'ENOSPC' });
      return (writeFile as any)(target, ...args);
    }) as typeof fs.writeFileSync;
    await assert.rejects(applyHistoryRepair(full, 'same.csv'), /HISTORY_REPAIR_REFUSED/);
  } finally { fs.writeFileSync = writeFile; }
  assert.deepEqual(fs.readFileSync(path.join(full, 'edgeview.db')), Buffer.from(before));
  assert.equal(fs.existsSync(path.join(full, 'edgeview.db.lock.maintenance')), false, 'controlled pre-replacement failure releases exclusion');
  const linked = path.join(root, 'linked');
  fs.symlinkSync(success, linked, process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(applyHistoryRepair(linked, 'same.csv'));
  const uncertain = fixture('uncertain'); assert.equal(child(uncertain, 'kill-after').status, 78);
  fs.writeFileSync(path.join(uncertain, 'edgeview_db.json'), '[]');
  assert.throws(() => recoverInterruptedHistoryRepair(uncertain), 'changed primary must not be overwritten by recovery');
  assert.equal(fs.existsSync(path.join(uncertain, 'edgeview.db.lock.maintenance')), true);
  const alive = fixture('alive'); assert.equal(child(alive, 'kill-after').status, 78);
  const ownerFile = path.join(alive, 'edgeview.db.lock.maintenance', 'owner.json');
  const owner = JSON.parse(fs.readFileSync(ownerFile, 'utf8')); owner.pid = process.pid;
  fs.writeFileSync(ownerFile, JSON.stringify(owner));
  const journalFile = path.join(alive, '.edgeview-history-repair', 'journal.json');
  const journal = JSON.parse(fs.readFileSync(journalFile, 'utf8')); journal.pid = process.pid;
  journal.ownerSha = createHash('sha256').update(fs.readFileSync(ownerFile)).digest('hex');
  fs.writeFileSync(journalFile, JSON.stringify(journal));
  assert.throws(() => recoverInterruptedHistoryRepair(alive), 'even a valid-hash journal cannot reclaim an existing PID');
  assert.equal(fs.existsSync(path.join(alive, 'edgeview.db.lock.maintenance')), true);
  console.log('PASS real SQLite repair, durable private preimages, stopped-owner/link refusal, child termination before/after replace, exact rollback, recovery/retry and changed-source refusal; isolated files only');
} finally {
  assert.equal(path.dirname(fs.realpathSync(root)), fs.realpathSync(os.tmpdir()));
  fs.rmSync(root, { recursive: true, force: true });
}
