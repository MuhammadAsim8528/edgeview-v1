import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import initSqlJs from 'sql.js';
import { pruneMigrationBackups } from '../migration_backup_retention';
import { getDb, resetDbInstanceForTests } from '../sqlite';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'edgeview-migration-retention-'));
process.env.EDGEVIEW_TEST_MODE = '1';
const SQL = await initSqlJs();
function backup(file: string, version: number, timestamp: number) {
  const name = `${file}.pre-migration-v${version}-${timestamp}.bak`;
  fs.writeFileSync(name, `synthetic recovery ${version} ${timestamp}`);
  return name;
}
function snapshot(directory: string) {
  return fs.readdirSync(directory).filter(name => fs.lstatSync(path.join(directory, name)).isFile())
    .map(name => [name, fs.readFileSync(path.join(directory, name)).toString('base64')]);
}
try {
  const unit = path.join(root, 'unit'); fs.mkdirSync(unit);
  const file = path.join(unit, '[operations].db');
  const files = Array.from({ length: 5 }, (_, index) => backup(file, 0, 1700000000000 + index));
  // Protect immediate recovery even if its clock timestamp is older.
  const protectedFile = files[0];
  const unrelated = [backup(path.join(unit, 'other.db'), 0, 1700000000000), `${file}.pre-migration-v0-1700000000000extra.bak`, `${file}.pre-migration-vx-1700000000000.bak`];
  for (const name of unrelated.slice(1)) fs.writeFileSync(name, 'unrelated');
  const hardlinked = backup(file, 0, 1600000000000);
  fs.linkSync(hardlinked, path.join(unit, 'hardlink-target'));
  const directoryBackup = `${file}.pre-migration-v0-1500000000000.bak`;
  fs.mkdirSync(directoryBackup);
  const first = pruneMigrationBackups(file, protectedFile);
  assert.equal(first.removed, 2);
  assert.ok(fs.existsSync(protectedFile));
  assert.ok(fs.existsSync(files[3]) && fs.existsSync(files[4]));
  for (const name of [...unrelated, hardlinked, directoryBackup]) assert.ok(fs.existsSync(name), name);
  const stable = snapshot(unit);
  assert.equal(pruneMigrationBackups(file, path.join(unit, 'not-a-recovery.bak')).removed, 0);
  assert.deepEqual(snapshot(unit), stable);

  // Equal timestamps use a deterministic name order, not filesystem enumeration.
  const ties = path.join(root, 'ties'); fs.mkdirSync(ties);
  const tieDb = path.join(ties, 'data.db');
  const tieFiles = [0, 1, 2, 3, 4].map(version => backup(tieDb, version, 1700000000000));
  assert.equal(pruneMigrationBackups(tieDb, tieFiles[0]).removed, 2);
  assert.deepEqual(fs.readdirSync(ties).sort(), [tieFiles[0], tieFiles[3], tieFiles[4]].map(name => path.basename(name)).sort());

  const linkParent = path.join(root, 'linked-parent');
  fs.symlinkSync(unit, linkParent, process.platform === 'win32' ? 'junction' : 'dir');
  assert.equal(pruneMigrationBackups(path.join(linkParent, path.basename(file)), path.join(linkParent, path.basename(protectedFile))).removed, 0);
  assert.deepEqual(snapshot(unit), stable, 'ancestor link must disable deletion');
  fs.unlinkSync(linkParent);

  // A failed deletion is observable and does not stop other eligible cleanup.
  const failures = path.join(root, 'deletion'); fs.mkdirSync(failures);
  const failureDb = path.join(failures, 'custom.db');
  const failureFiles = [0, 1, 2, 3, 4].map(index => backup(failureDb, 0, 1700000000000 + index));
  const originalUnlink = fs.unlinkSync;
  fs.unlinkSync = ((target: fs.PathLike) => {
    if (String(target) === failureFiles[1]) throw Object.assign(new Error('synthetic permission denial'), { code: 'EACCES' });
    return originalUnlink(target);
  }) as typeof fs.unlinkSync;
  try {
    const result = pruneMigrationBackups(failureDb, failureFiles[4]);
    assert.equal(result.errors, 1); assert.equal(result.removed, 1);
    assert.ok(fs.existsSync(failureFiles[1]));
  } finally { fs.unlinkSync = originalUnlink; }

  for (const mode of ['schema-failure', 'write-failure', 'reopen-failure', 'success'] as const) {
    const directory = path.join(root, mode); fs.mkdirSync(directory);
    const dbFile = path.join(directory, 'alternate[db].sqlite');
    process.env.EDGEVIEW_SQLITE_DB = dbFile;
    resetDbInstanceForTests();
    const legacy = new SQL.Database();
    legacy.run(mode === 'schema-failure' ? 'CREATE TABLE research_campaigns (id TEXT);'
      : "CREATE TABLE retained(value TEXT); INSERT INTO retained VALUES ('synthetic retained row');");
    const original = Buffer.from(legacy.export()); legacy.close();
    fs.writeFileSync(dbFile, original);
    const oldBackups = [0, 1, 2, 3, 4].map(index => backup(dbFile, 0, 1700000000000 + index));
    const oldBytes = oldBackups.map(name => fs.readFileSync(name));
    const originalRename = fs.renameSync;
    const originalRead = fs.readFileSync;
    let databaseReads = 0;
    if (mode === 'reopen-failure') fs.readFileSync = ((target: fs.PathOrFileDescriptor, ...args: any[]) => {
      if (String(target) === dbFile && ++databaseReads === 2) throw Object.assign(new Error('synthetic reopen permission denial'), { code: 'EACCES' });
      return (originalRead as any)(target, ...args);
    }) as typeof fs.readFileSync;
    if (mode === 'write-failure') fs.renameSync = ((from: fs.PathLike, to: fs.PathLike) => {
      if (String(to) === dbFile) throw Object.assign(new Error('synthetic disk write failure'), { code: 'ENOSPC' });
      return originalRename(from, to);
    }) as typeof fs.renameSync;
    try {
      if (mode !== 'success') {
        await assert.rejects(getDb());
        if (mode !== 'reopen-failure') assert.deepEqual(fs.readFileSync(dbFile), original);
        oldBackups.forEach((name, index) => assert.deepEqual(fs.readFileSync(name), oldBytes[index]));
        const backups = fs.readdirSync(directory).filter(name => name.endsWith('.bak'));
        assert.equal(backups.length, 6, 'failed migration must retain every recovery image');
      } else {
        const migrated = await getDb();
        assert.equal((await migrated.get('SELECT value FROM retained')).value, 'synthetic retained row');
        const backups = fs.readdirSync(directory).filter(name => name.endsWith('.bak'));
        assert.equal(backups.length, 3);
        assert.ok(backups.some(name => fs.readFileSync(path.join(directory, name)).equals(original)), 'immediate original bytes retained');
        const disk = new SQL.Database(fs.readFileSync(dbFile));
        assert.equal(disk.exec('PRAGMA integrity_check')[0].values[0][0], 'ok');
        assert.equal(disk.exec('PRAGMA user_version')[0].values[0][0], 2); disk.close();
        // Current-version restart must not prune manually retained extra images.
        backup(dbFile, 0, 1600000000000);
        resetDbInstanceForTests();
        assert.equal((await (await getDb()).get('SELECT value FROM retained')).value, 'synthetic retained row');
        assert.equal(fs.readdirSync(directory).filter(name => name.endsWith('.bak')).length, 4);
      }
    } finally { fs.renameSync = originalRename; fs.readFileSync = originalRead; resetDbInstanceForTests(); }
  }
  console.log('PASS post-success migration retention, failed-upgrade preservation, exact basename, links and reopen');
} finally { resetDbInstanceForTests(); fs.rmSync(root, { recursive: true, force: true }); }
