import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { buildSync } from 'esbuild';
import initSqlJs from 'sql.js';
import { unusedTestPort } from './test-server-port.mjs';
import { verifyRuntimeBackup } from '../shared/runtime_backup.mjs';

const source = process.cwd(), root = fs.mkdtempSync(path.join(os.tmpdir(), 'edgeview-migration-runtime-'));
const app = path.join(root, 'app'), data = path.join(root, 'stable-data');
fs.mkdirSync(app);
fs.cpSync(path.join(source, 'dist'), path.join(app, 'dist'), { recursive: true });
fs.copyFileSync(path.join(source, 'packaging/windows/runtime-bootstrap.cjs'), path.join(app, 'runtime-bootstrap.cjs'));
fs.writeFileSync(path.join(app, 'package.json'), '{"name":"edgeview","version":"1.0.0-rc.2"}');
fs.writeFileSync(path.join(app, 'config.json'), '{}');
const tool = path.join(root, 'migration-helper.cjs');
buildSync({ entryPoints: [path.join(source, 'server/tests/legacy_data_migration_child.ts')], bundle: true,
  platform: 'node', format: 'cjs', packages: 'external', outfile: tool, logLevel: 'silent' });
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => /^(PATH|SystemRoot|WINDIR|COMSPEC|USERPROFILE|TEMP|TMP|APPDATA|LOCALAPPDATA)$/i.test(key)));
const port = await unusedTestPort(), base = `http://127.0.0.1:${port}`;
Object.assign(env, { NODE_ENV: 'production', NODE_PATH: path.join(source, 'node_modules'), PORT: String(port), EDGEVIEW_MONITORING_ENABLED: '0' });
let child;
async function stop() {
  if (child && child.exitCode === null && child.signalCode === null) {
    const done = once(child, 'exit', { signal: AbortSignal.timeout(25000) }); child.stdin.end('shutdown\n');
    assert.equal((await done)[0], 0);
  }
}
async function start() {
  child = spawn(process.execPath, [path.join(app, 'runtime-bootstrap.cjs')], { cwd: app, env, stdio: ['pipe', 'ignore', 'ignore'] });
  child.stdin.on('error', () => {});
  for (const until = Date.now() + 45000; Date.now() < until;) {
    assert.equal(child.exitCode, null, 'runtime must remain alive');
    try {
      const response = await fetch(base + '/api/health', { signal: AbortSignal.timeout(1000) });
      const health = await response.json(); if (response.ok && health.app.pid === child.pid) return health;
    } catch { /* bounded readiness only */ }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Owned migration runtime readiness timeout');
}
async function upload(name) {
  const form = new FormData(); form.set('file', new Blob([`Importer,Country,Exporter,Item,TOT_FC\nSynthetic Local Buyer,Kenya,Synthetic Supplier,Product ${name},10`]), name);
  const response = await fetch(base + '/api/files/upload', { method: 'POST', body: form, signal: AbortSignal.timeout(10000) });
  assert.equal(response.status, 201); const body = await response.json(); return body.id || body.data.id;
}
const SQL = await initSqlJs();
try {
  const first = await start(), installation = first.app.installation_id;
  assert.equal(path.resolve(first.app.data_root), app, 'fixture initially uses actual legacy app-root storage');
  const id = await upload('legacy-preserved.csv'); await stop();
  // Create the historical schema1 condition only in this stopped disposable app.
  const legacyDbFile = path.join(app, 'edgeview.db'), legacy = new SQL.Database(fs.readFileSync(legacyDbFile));
  legacy.exec('DROP INDEX idx_history_file_id; ALTER TABLE history_data DROP COLUMN file_id; PRAGMA user_version=1;');
  fs.writeFileSync(legacyDbFile, legacy.export()); legacy.close();
  const originalDatabase = fs.readFileSync(legacyDbFile), originalPrimary = fs.readFileSync(path.join(app, 'edgeview_db.json'));
  const copied = spawnSync(process.execPath, [tool, app, data, 'normal'], { cwd: app, env, encoding: 'utf8', timeout: 30000, windowsHide: true });
  assert.equal(copied.error, undefined); assert.equal(copied.status, 0, copied.stderr);
  assert.deepEqual(fs.readFileSync(path.join(data, 'edgeview.db')), originalDatabase, 'copy must not silently migrate schema');
  env.EDGEVIEW_DATA_DIR = data;
  const ready = fs.readFileSync(path.join(data, 'migration.ready.json')); fs.unlinkSync(path.join(data, 'migration.ready.json'));
  const refused = spawnSync(process.execPath, [path.join(app, 'runtime-bootstrap.cjs')], { cwd: app, env, encoding: 'utf8', timeout: 20000, windowsHide: true, input: '' });
  assert.equal(refused.error, undefined); assert.notEqual(refused.status, 0); assert.match(refused.stderr, /LEGACY_MIGRATION_INCOMPLETE/);
  assert.deepEqual(fs.readFileSync(path.join(data, 'edgeview.db')), originalDatabase);
  fs.writeFileSync(path.join(data, 'migration.ready.json'), ready);
  const migrated = await start(); assert.equal(migrated.app.installation_id, installation);
  assert.equal(path.resolve(migrated.app.data_root), data);
  const files = await (await fetch(base + '/api/files', { signal: AbortSignal.timeout(10000) })).json();
  assert.ok(JSON.stringify(files).includes(id), 'saved dataset must be discoverable after explicit root activation');
  const companies = await (await fetch(base + '/api/companies', { signal: AbortSignal.timeout(10000) })).json();
  assert.ok(companies.some(company => company.company_name === 'Synthetic Local Buyer' && company.country === 'Kenya'));
  await upload('new-root-only.csv'); await stop();
  const upgraded = new SQL.Database(fs.readFileSync(path.join(data, 'edgeview.db')));
  assert.equal(upgraded.exec('PRAGMA user_version')[0].values[0][0], 3);
  assert.equal(upgraded.exec('PRAGMA integrity_check')[0].values[0][0], 'ok'); upgraded.close();
  const backups = fs.readdirSync(data).filter(name => name.startsWith('edgeview.db.pre-migration-v1-'));
  assert.equal(backups.length, 1); assert.deepEqual(fs.readFileSync(path.join(data, backups[0])), originalDatabase);
  assert.deepEqual(fs.readFileSync(legacyDbFile), originalDatabase, 'legacy original remains matched schema1 recovery image');
  assert.deepEqual(fs.readFileSync(path.join(app, 'edgeview_db.json')), originalPrimary, 'new root writes never change retained original authority');
  const restarted = await start(); assert.equal(restarted.app.installation_id, installation); await stop();
  const backup = spawnSync(process.execPath, [path.join(source, 'scripts/backup-runtime.mjs')], { cwd: app, env, encoding: 'utf8', timeout: 30000, windowsHide: true });
  assert.equal(backup.error, undefined); assert.equal(backup.status, 0, backup.stderr);
  const snapshot = JSON.parse(backup.stdout).backup;
  const { manifestSha256 } = await verifyRuntimeBackup(snapshot);
  const recoveredData = path.join(root, 'recovered-data');
  const prepare = (destination, hash, schema) => spawnSync(process.execPath, ['--import', 'tsx', path.join(source, 'scripts/prepare-runtime-recovery.ts'), snapshot, destination, hash, schema],
    { cwd: source, env, encoding: 'utf8', timeout: 30000, windowsHide: true });
  for (const [hash, schema] of [['0'.repeat(64), '3'], [manifestSha256, '1'], [manifestSha256, '2']]) {
    const mismatch = prepare(recoveredData, hash, schema);
    assert.equal(mismatch.error, undefined); assert.equal(mismatch.status, 1, mismatch.stderr);
    assert.match(mismatch.stderr, /RECOVERY_COPY_REFUSED/);
    assert.equal(fs.existsSync(recoveredData), false);
  }
  const refusal = prepare(data, manifestSha256, '3');
  assert.equal(refusal.status, 1); assert.match(refusal.stderr, /RECOVERY_COPY_REFUSED/);
  await start();
  const laterId = await upload('after-recovery-checkpoint.csv'); await stop();
  const activeBytes = fs.readFileSync(path.join(data, 'edgeview_db.json'));
  const prepared = prepare(recoveredData, manifestSha256, '3');
  assert.equal(prepared.error, undefined); assert.equal(prepared.status, 0, prepared.stderr);
  assert.equal(JSON.parse(prepared.stdout).status, 'COPIED_NOT_ACTIVATED');
  const receipt = JSON.parse(fs.readFileSync(path.join(recoveredData, 'migration.complete.json'), 'utf8'));
  assert.equal(receipt.backupManifestSha256, manifestSha256); assert.equal(receipt.sourceSchema, 3);
  env.EDGEVIEW_DATA_DIR = recoveredData;
  for (let boot = 0; boot < 2; boot++) {
    const recovery = await start(); assert.equal(recovery.app.installation_id, installation);
    assert.equal(path.resolve(recovery.app.data_root), recoveredData);
    const saved = await (await fetch(base + '/api/files', { signal: AbortSignal.timeout(10000) })).json();
    assert.ok(JSON.stringify(saved).includes(id)); assert.ok(!JSON.stringify(saved).includes(laterId));
    await stop();
  }
  assert.deepEqual(fs.readFileSync(path.join(data, 'edgeview_db.json')), activeBytes);
  await verifyRuntimeBackup(snapshot, manifestSha256);
  console.log('PASS verified backup to fresh recovery root, mismatch and overlay refusal, compiled restart and original post-backup writes preserved');
  console.log('PASS compiled legacy-app-root→separate-data copy, incomplete-copy startup refusal, explicit activation, UUID/dataset/country discovery, schema1→3 backup/integrity, isolated writes and restart; installer/update/power-loss NOT VERIFIED');
} finally {
  await stop(); assert.equal(path.dirname(fs.realpathSync(root)), fs.realpathSync(os.tmpdir()));
  fs.rmSync(root, { recursive: true, force: true });
}
