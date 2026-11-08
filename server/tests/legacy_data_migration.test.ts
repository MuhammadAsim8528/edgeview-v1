import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildSync } from 'esbuild';
import initSqlJs from 'sql.js';
import { CURRENT_SCHEMA_VERSION } from '../sqlite';
import { copyLegacyRuntimeData, retryInterruptedLegacyMigration } from '../legacy_data_migration';
import { resolveRuntimeDataRoot } from '../../shared/runtime_paths.mjs';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'edgeview-legacy-migration-'));
const SQL = await initSqlJs();
const db = new SQL.Database(); db.exec('PRAGMA user_version=1; CREATE TABLE preserved(id INTEGER PRIMARY KEY, value TEXT); INSERT INTO preserved VALUES(1,\'Synthetic state\')');
const originalDb = db.export(); db.close();
const identity = '{"installation_id":"550e8400-e29b-41d4-a716-446655440000"}';
function fixture(name: string) {
  const source = path.join(root, name), destination = `${source}-data`;
  fs.mkdirSync(path.join(source, 'data', 'v1-runs'), { recursive: true });
  fs.mkdirSync(path.join(source, 'uploads'));
  fs.writeFileSync(path.join(source, 'edgeview.db'), originalDb);
  fs.writeFileSync(path.join(source, 'edgeview_db.json'), '[]');
  fs.writeFileSync(path.join(source, 'config.json'), '{}');
  fs.writeFileSync(path.join(source, 'data', 'installation.json'), identity);
  fs.writeFileSync(path.join(source, 'data', 'v1-runs', 'synthetic.json'), '{"evidence":"synthetic only"}');
  fs.writeFileSync(path.join(source, 'uploads', 'synthetic.csv'), 'Importer,Country\nSynthetic Buyer,Kenya');
  fs.writeFileSync(path.join(source, 'README.md'), 'Developer source must not be migrated');
  return { source, destination };
}
const childFile = path.join(root, 'migration-child.cjs');
try {
  buildSync({ entryPoints: [fileURLToPath(new URL('./legacy_data_migration_child.ts', import.meta.url))],
    bundle: true, platform: 'node', format: 'cjs', packages: 'external', outfile: childFile, logLevel: 'silent' });
  const success = fixture('success');
  const copied = await copyLegacyRuntimeData(success.source, success.destination);
  assert.equal(copied.status, 'COPIED_NOT_ACTIVATED'); assert.equal(copied.sourceSchema, 1);
  for (const name of ['edgeview.db', 'edgeview_db.json', 'config.json', 'data/installation.json', 'data/v1-runs/synthetic.json', 'uploads/synthetic.csv']) {
    assert.deepEqual(fs.readFileSync(path.join(success.source, name)), fs.readFileSync(path.join(success.destination, name)));
  }
  assert.equal(fs.existsSync(path.join(success.destination, 'README.md')), false);
  assert.equal(resolveRuntimeDataRoot(success.source, { EDGEVIEW_DATA_DIR: success.destination }), success.destination);
  assert.equal(fs.existsSync(path.join(success.source, 'edgeview.db.lock.maintenance')), false);
  assert.equal(fs.existsSync(path.join(success.destination, 'edgeview.db.lock.maintenance')), false);
  await assert.rejects(copyLegacyRuntimeData(success.source, success.destination), 'never overlay existing accepted or stale data');
  const plaintext = fixture('plaintext');
  fs.writeFileSync(path.join(plaintext.source, 'config.json'), '{"serper_api_key":"PRIVATE_SYNTHETIC_SECRET"}');
  await assert.rejects(copyLegacyRuntimeData(plaintext.source, plaintext.destination));
  assert.equal(fs.existsSync(plaintext.destination), false, 'plaintext credentials rejected before destination creation');
  const dotenv = fixture('dotenv'); fs.writeFileSync(path.join(dotenv.source, '.env'), 'SYNTHETIC=value');
  await assert.rejects(copyLegacyRuntimeData(dotenv.source, dotenv.destination));
  const locked = fixture('locked'); fs.writeFileSync(path.join(locked.source, 'edgeview.db.lock'), '1');
  await assert.rejects(copyLegacyRuntimeData(locked.source, locked.destination));
  const links = fixture('links');
  fs.symlinkSync(success.source, path.join(links.source, 'data', 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(copyLegacyRuntimeData(links.source, links.destination));
  assert.equal(fs.existsSync(links.destination), false);
  const oversized = fixture('oversized');
  const sparse = fs.openSync(path.join(oversized.source, 'uploads', 'oversized.bin'), 'wx');
  fs.ftruncateSync(sparse, 64 * 1024 ** 2 + 1); fs.closeSync(sparse);
  await assert.rejects(copyLegacyRuntimeData(oversized.source, oversized.destination));
  assert.equal(fs.existsSync(oversized.destination), false, 'size limit refuses before allocation/copy');
  const future = fixture('future');
  const newer = new SQL.Database(originalDb); newer.exec(`PRAGMA user_version=${CURRENT_SCHEMA_VERSION + 1}`);
  fs.writeFileSync(path.join(future.source, 'edgeview.db'), newer.export()); newer.close();
  await assert.rejects(copyLegacyRuntimeData(future.source, future.destination));
  assert.equal(fs.existsSync(future.destination), false);
  const override = fixture('override'), oldOverride = process.env.EDGEVIEW_CONFIG;
  try {
    process.env.EDGEVIEW_CONFIG = path.join(root, 'different-config.json');
    await assert.rejects(copyLegacyRuntimeData(override.source, override.destination));
  } finally { if (oldOverride === undefined) delete process.env.EDGEVIEW_CONFIG; else process.env.EDGEVIEW_CONFIG = oldOverride; }
  const disk = fixture('disk'), write = fs.writeSync, open = fs.openSync;
  const descriptors = new Map<number, string>();
  try {
    fs.openSync = ((file: any, ...args: any[]) => { const fd = (open as any)(file, ...args); descriptors.set(fd, String(file)); return fd; }) as typeof fs.openSync;
    fs.writeSync = ((...args: any[]) => {
      if (descriptors.get(args[0]) === path.join(disk.destination, 'edgeview.db')) throw Object.assign(new Error('Controlled copy failure'), { code: 'ENOSPC' });
      return (write as any)(...args);
    }) as typeof fs.writeSync;
    await assert.rejects(copyLegacyRuntimeData(disk.source, disk.destination));
  } finally { fs.writeSync = write; fs.openSync = open; }
  assert.equal(fs.existsSync(disk.destination), false, 'failed partial copy is archived, never treated as active destination');
  assert.deepEqual(fs.readFileSync(path.join(disk.source, 'edgeview.db')), Buffer.from(originalDb));
  assert.equal(fs.existsSync(path.join(disk.source, 'edgeview.db.lock.maintenance')), false);
  const childEnv = Object.fromEntries(Object.entries(process.env).filter(([name]) => /^(PATH|SystemRoot|WINDIR|TEMP|TMP)$/i.test(name)));
  Object.assign(childEnv, { NODE_ENV: 'test', EDGEVIEW_TEST_MODE: '1', NODE_PATH: path.join(process.cwd(), 'node_modules') });
  function interrupt(source: string, destination: string) {
    const result = spawnSync(process.execPath, [childFile, source, destination], { env: childEnv, cwd: process.cwd(), timeout: 30000, encoding: 'utf8', windowsHide: true });
    assert.equal(result.error, undefined);
    assert.equal(fs.readFileSync(path.join(source, 'test-copy-kill-stage'), 'utf8'), 'copying');
    if (process.platform === 'win32') assert.equal(result.status, 1, result.stderr);
    else assert.equal(result.signal, 'SIGKILL', result.stderr);
  }
  const interrupted = fixture('interrupted'); interrupt(interrupted.source, interrupted.destination);
  assert.throws(() => resolveRuntimeDataRoot(interrupted.source, { EDGEVIEW_DATA_DIR: interrupted.destination }), /MIGRATION_INCOMPLETE/);
  const resumed = await retryInterruptedLegacyMigration(interrupted.source, interrupted.destination);
  assert.equal(resumed.status, 'COPIED_NOT_ACTIVATED');
  assert.deepEqual(fs.readFileSync(path.join(interrupted.destination, 'edgeview.db')), Buffer.from(originalDb));
  assert.equal(fs.readFileSync(path.join(interrupted.destination, 'data', 'installation.json'), 'utf8'), identity);
  assert.equal(fs.existsSync(path.join(interrupted.source, 'edgeview.db.lock.maintenance')), false);
  const changed = fixture('changed'); interrupt(changed.source, changed.destination);
  fs.writeFileSync(path.join(changed.source, 'uploads', 'synthetic.csv'), 'Changed source after interruption');
  await assert.rejects(retryInterruptedLegacyMigration(changed.source, changed.destination));
  assert.equal(fs.existsSync(path.join(changed.source, 'edgeview.db.lock.maintenance')), true);
  assert.deepEqual(fs.readFileSync(path.join(changed.source, 'edgeview.db')), Buffer.from(originalDb));
  console.log('PASS private allowlisted same-user migration copy, schema/identity/evidence preservation, no overlay/source deletion, plaintext/env/lock/link refusal, disk failure, SIGKILL retry and changed-source refusal; activation/update NOT VERIFIED');
} finally {
  assert.equal(path.dirname(fs.realpathSync(root)), fs.realpathSync(os.tmpdir()));
  fs.rmSync(root, { recursive: true, force: true });
}
