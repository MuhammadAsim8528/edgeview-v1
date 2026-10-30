import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import initSqlJs from 'sql.js';
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'edgeview-backup-'));
const script = process.argv[2] ? path.resolve(process.argv[2]) : fileURLToPath(new URL('./backup-runtime.mjs', import.meta.url));
const run = (...args) => spawnSync(process.execPath, [...args, script], { cwd: root, env: { ...process.env, EDGEVIEW_DATA_DIR: '' }, encoding: 'utf8', timeout: 15000, maxBuffer: 1024 * 1024 });
const withEnv = overrides => spawnSync(process.execPath, [script], { cwd: root, env: { ...process.env, EDGEVIEW_DATA_DIR: '', ...overrides }, encoding: 'utf8', timeout: 15000, maxBuffer: 1024 * 1024 });
try {
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'not-edgeview' }));
  assert.notEqual(run().status, 0, 'wrong working directory must not be backed up');
  assert.equal(fs.existsSync(path.join(root, 'backups')), false);
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'edgeview' }));
  for (const key of ['EDGEVIEW_CONFIG', 'EDGEVIEW_V1_DATA_DIR', 'EDGEVIEW_SQLITE_DB', 'EDGEVIEW_JSON_DB']) {
    const rejected = withEnv({ [key]: path.join(root, 'elsewhere', 'active') });
    assert.notEqual(rejected.status, 0, `override must not silently escape backup: ${key}`);
    assert.match(rejected.stderr, /BACKUP_PATH_OVERRIDE_UNSUPPORTED/);
    assert.equal(fs.existsSync(path.join(root, 'backups')), false, 'layout refusal must precede staging');
  }
  for (const testMode of [{ NODE_ENV: 'test' }, { EDGEVIEW_TEST_MODE: '1' }]) {
    assert.match(withEnv(testMode).stderr, /BACKUP_TEST_LAYOUT_UNSUPPORTED/);
    assert.equal(fs.existsSync(path.join(root, 'backups')), false);
  }
  fs.writeFileSync(path.join(root, 'edgeview.db.lock'), String(process.pid));
  assert.notEqual(run().status, 0);
  assert.equal(fs.existsSync(path.join(root, 'backups')), false, 'live-lock refusal precedes writes');
  fs.unlinkSync(path.join(root, 'edgeview.db.lock'));
  assert.notEqual(run().status, 0, 'empty snapshot must fail');
  assert.ok(fs.readdirSync(path.join(root, 'backups')).every(name => name.startsWith('INCOMPLETE-')));
  const SQL = await initSqlJs(); const db = new SQL.Database();
  db.run("CREATE TABLE fixture(value TEXT); INSERT INTO fixture VALUES ('retained');");
  fs.writeFileSync(path.join(root, 'edgeview.db'), db.export()); db.close();
  fs.writeFileSync(path.join(root, 'edgeview_db.json'), JSON.stringify({ rows: [{ importer: 'Synthetic Importer' }] }));
  fs.mkdirSync(path.join(root, 'data', 'v1-runs'), { recursive: true });
  fs.writeFileSync(path.join(root, 'data', 'v1-runs', 'fixture.json'), '{"immutable":"evidence"}');
  fs.writeFileSync(path.join(root, 'config.json'), '{"synthetic":"local-only"}');
  fs.writeFileSync(path.join(root, 'config.prev.json'), '{"synthetic":"previous-local-only"}');
  fs.writeFileSync(path.join(root, 'pharma_db.json'), '{"synthetic":"legacy-authority"}');
  const fixture = new URL('./test-fixtures/backup-copy-failure.mjs', import.meta.url).href;
  const failed = run('--import', fixture);
  assert.notEqual(failed.status, 0);
  assert.match(failed.stderr, /Controlled backup copy failure/);
  assert.ok(fs.readdirSync(path.join(root, 'backups')).every(name => name.startsWith('INCOMPLETE-')), 'partial copy cannot publish a completed backup');
  assert.equal(fs.existsSync(path.join(root, 'edgeview.db.lock.maintenance')), false, 'controlled failure releases maintenance gate');
  const concurrent = run('--import', new URL('./test-fixtures/backup-concurrent-attempt.mjs', import.meta.url).href);
  assert.equal(concurrent.status, 0, `outer backup must complete while a competing attempt is refused: ${concurrent.stderr}`);
  assert.equal(fs.existsSync(path.join(root, 'edgeview.db.lock.maintenance')), false, 'successful backup releases maintenance gate');
  const completed = run(); assert.equal(completed.status, 0, completed.stderr);
  const ordinaryOverrides = withEnv({ EDGEVIEW_CONFIG: path.join(root, 'config.json'),
    EDGEVIEW_V1_DATA_DIR: path.join(root, 'data', 'v1-runs'),
    EDGEVIEW_SQLITE_DB: path.join(root, 'edgeview.db'), EDGEVIEW_JSON_DB: path.join(root, 'edgeview_db.json') });
  assert.equal(ordinaryOverrides.status, 0, 'explicit canonical paths must remain supported: ' + ordinaryOverrides.stderr);
  const result = JSON.parse(completed.stdout);
  assert.ok(!path.basename(result.backup).startsWith('INCOMPLETE-'));
  const manifest = JSON.parse(fs.readFileSync(path.join(result.backup, 'manifest.json')));
  const restore = path.join(root, 'isolated-restore'); fs.mkdirSync(restore);
  for (const entry of manifest.files) {
    const bytes = fs.readFileSync(path.join(result.backup, entry.path));
    assert.equal(bytes.length, entry.bytes);
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), entry.sha256);
    const target = path.join(restore, entry.path); fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, bytes, { flag: 'wx' });
  }
  const restored = new SQL.Database(fs.readFileSync(path.join(restore, 'edgeview.db')));
  assert.equal(restored.exec('PRAGMA integrity_check')[0].values[0][0], 'ok');
  assert.equal(restored.exec('SELECT value FROM fixture')[0].values[0][0], 'retained'); restored.close();
  assert.equal(JSON.parse(fs.readFileSync(path.join(restore, 'edgeview_db.json'))).rows[0].importer, 'Synthetic Importer');
  assert.equal(fs.readFileSync(path.join(restore, 'data/v1-runs/fixture.json'), 'utf8'), '{"immutable":"evidence"}');
  assert.equal(fs.readFileSync(path.join(restore, 'config.json'), 'utf8'), '{"synthetic":"local-only"}');
  assert.equal(fs.readFileSync(path.join(restore, 'config.prev.json'), 'utf8'), '{"synthetic":"previous-local-only"}');
  assert.equal(fs.readFileSync(path.join(restore, 'pharma_db.json'), 'utf8'), '{"synthetic":"legacy-authority"}');
  const priorManifest = fs.readFileSync(path.join(result.backup, 'manifest.json'));
  const outside = path.join(root, 'linked-fixture'); fs.mkdirSync(outside);
  fs.writeFileSync(path.join(outside, 'must-not-copy.txt'), 'not a supported runtime tree');
  fs.symlinkSync(outside, path.join(root, 'uploads'), 'junction');
  const linked = run();
  assert.notEqual(linked.status, 0); assert.match(linked.stderr, /links are not supported/);
  assert.deepEqual(fs.readFileSync(path.join(result.backup, 'manifest.json')), priorManifest, 'later failure must not alter a completed backup');
  console.log('PASS override/test-layout refusal before staging, canonical overrides, previous config/legacy state, lock/incomplete/hash controls and isolated SQLite/JSON/evidence recovery');
} finally { fs.rmSync(root, { recursive: true, force: true }); }
