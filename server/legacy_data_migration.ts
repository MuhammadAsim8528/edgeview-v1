import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import initSqlJs from 'sql.js';
import { acquireRuntimeMaintenance, releaseOwnedRuntimeMaintenance } from '../shared/runtime_maintenance.mjs';
import { resolveRuntimeDataRootPath } from '../shared/runtime_paths.mjs';
import { decodePersistenceRecords } from './sqlite_persistence';
import { CREDENTIAL_FIELDS } from './credential_store';
import { CURRENT_SCHEMA_VERSION } from './sqlite';
import { inspectRuntimeBackup } from '../shared/runtime_backup.mjs';

const ALLOWED = ['edgeview.db', 'edgeview_db.json', 'pharma_db.json', 'config.json', 'config.prev.json', 'data', 'uploads'];
const MAX_FILES = 50000, MAX_BYTES = 4 * 1024 ** 3, MAX_FILE = 64 * 1024 ** 2;
type Entry = { path: string; bytes: number; sha256: string };
const fail = () => new Error('LEGACY_MIGRATION_REFUSED: Original storage was retained; this copy is not accepted for activation.');
const digest = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
function missing(file: string) {
  try { fs.lstatSync(file); return false; }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; return true; }
}
function directory(root: string) {
  if (!path.isAbsolute(root) || path.resolve(root) !== root || /[\x00-\x1f]/.test(root)) throw fail();
  for (let current = root;; current = path.dirname(current)) {
    const stat = fs.lstatSync(current);
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw fail();
    if (current === path.dirname(current)) return;
  }
}
function stopped(root: string) { if (!missing(path.join(root, 'edgeview.db.lock'))) throw fail(); }
function inventory(root: string): string[] {
  const files: string[] = []; let nodes = 0, bytes = 0, metadataBytes = 0;
  function visit(relative: string, depth: number) {
    if (++nodes > MAX_FILES * 2 || depth > 32 || relative.length > 1024) throw fail();
    const file = path.join(root, relative), stat = fs.lstatSync(file);
    if (stat.isSymbolicLink()) throw fail();
    if (stat.isDirectory()) {
      const handle = fs.opendirSync(file), names: string[] = []; let nameBytes = 0;
      try {
        for (let entry = handle.readSync(); entry; entry = handle.readSync()) {
          nameBytes += Buffer.byteLength(entry.name);
          if (names.length >= MAX_FILES || nameBytes > 8 * 1024 ** 2) throw fail();
          names.push(entry.name);
        }
      } finally { handle.closeSync(); }
      for (const name of names.sort()) visit(path.join(relative, name), depth + 1);
    } else {
      if (!stat.isFile() || stat.nlink !== 1 || stat.size > MAX_FILE || files.length >= MAX_FILES) throw fail();
      bytes += stat.size; metadataBytes += Buffer.byteLength(relative);
      if (bytes > MAX_BYTES || metadataBytes > 8 * 1024 ** 2) throw fail();
      files.push(relative);
    }
  }
  for (const name of ALLOWED) if (!missing(path.join(root, name))) visit(name, 0);
  return files;
}
function transfer(from: string, to?: string) {
  const before = fs.lstatSync(from);
  if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1 || before.size > MAX_FILE) throw fail();
  const input = fs.openSync(from, 'r'); let output: number | undefined;
  try {
    const opened = fs.fstatSync(input);
    if (opened.dev !== before.dev || opened.ino !== before.ino || opened.size !== before.size) throw fail();
    if (to) { fs.mkdirSync(path.dirname(to), { recursive: true }); output = fs.openSync(to, 'wx', 0o600); }
    const hash = createHash('sha256'), chunk = Buffer.alloc(64 * 1024); let total = 0;
    for (;;) {
      const count = fs.readSync(input, chunk, 0, chunk.length, null);
      if (!count) break;
      total += count; if (total > MAX_FILE || total > opened.size) throw fail();
      hash.update(chunk.subarray(0, count));
      if (output !== undefined) {
        let offset = 0;
        while (offset < count) { const written = fs.writeSync(output, chunk, offset, count - offset); if (!written) throw fail(); offset += written; }
      }
    }
    if (total !== opened.size || fs.fstatSync(input).size !== opened.size) throw fail();
    if (output !== undefined) fs.fsyncSync(output);
    return { bytes: total, sha256: hash.digest('hex') };
  } finally { fs.closeSync(input); if (output !== undefined) fs.closeSync(output); }
}
function inspectSmall(file: string, limit: number) {
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || stat.size > limit) throw fail();
  const fd = fs.openSync(file, 'r');
  try {
    const opened = fs.fstatSync(fd);
    if (opened.size !== stat.size || opened.ino !== stat.ino || opened.dev !== stat.dev) throw fail();
    const bytes = Buffer.alloc(opened.size); let offset = 0;
    while (offset < bytes.length) {
      const count = fs.readSync(fd, bytes, offset, bytes.length - offset, offset);
      if (!count) throw fail(); offset += count;
    }
    if (fs.readSync(fd, Buffer.alloc(1), 0, 1, offset) || fs.fstatSync(fd).size !== opened.size) throw fail();
    return bytes;
  } finally { fs.closeSync(fd); }
}
function writeJson(file: string, value: unknown) {
  const fd = fs.openSync(file, 'wx', 0o600);
  try { fs.writeFileSync(fd, JSON.stringify(value)); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
}
const lockPath = (root: string) => path.join(root, 'edgeview.db.lock');
const ownerBytes = (root: string) => {
  const gate = `${lockPath(root)}.maintenance`; directory(gate);
  return inspectSmall(path.join(gate, 'owner.json'), 4096);
};
async function validateCopiedState(root: string) {
  const primary = ['edgeview_db.json', 'pharma_db.json'].find(name => !missing(path.join(root, name)));
  if (!primary) throw fail();
  decodePersistenceRecords(inspectSmall(path.join(root, primary), MAX_FILE), false);
  const SQL = await initSqlJs(), db = new SQL.Database(inspectSmall(path.join(root, 'edgeview.db'), MAX_FILE));
  let schema: number;
  try {
    schema = Number(db.exec('PRAGMA user_version')[0]?.values[0]?.[0]);
    if (db.exec('PRAGMA integrity_check')[0]?.values[0]?.[0] !== 'ok'
      || !Number.isSafeInteger(schema) || schema < 0 || schema > CURRENT_SCHEMA_VERSION) throw fail();
  } finally { db.close(); }
  for (const name of ['config.json', 'config.prev.json']) {
    const file = path.join(root, name); if (missing(file)) continue;
    const config = JSON.parse(inspectSmall(file, 1024 * 1024).toString('utf8'));
    if (!config || typeof config !== 'object' || Array.isArray(config)
      || CREDENTIAL_FIELDS.some(key => config[key] !== undefined && config[key] !== '')) throw fail();
    if (config._edgeview_credentials !== undefined) {
      const envelope = config._edgeview_credentials;
      if (CREDENTIAL_FIELDS.some(key => Object.hasOwn(config, key)) || !envelope || envelope.version !== 1
        || envelope.kind !== 'windows-dpapi-current-user' || typeof envelope.ciphertext !== 'string'
        || !/^[A-Za-z0-9+/]+={0,2}$/.test(envelope.ciphertext)) throw fail();
    }
  }
  const identity = path.join(root, 'data', 'installation.json');
  if (!missing(identity)) {
    const parsed = JSON.parse(inspectSmall(identity, 4096).toString('utf8'));
    if (!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(parsed.installation_id)) throw fail();
  }
  return schema;
}

/** Internal same-user private migration copy only. Never overlays a destination,
 * deletes the source, changes launcher selection, opens DPAPI secrets or accepts
 * installed updates. Retained source is the rollback authority until activation
 * and a separate verified backup/application compatibility gate succeed. */
export async function copyLegacyRuntimeData(source: string, destination: string, backup?: { manifestSha256: string; schema: number }) {
  directory(source); directory(path.dirname(destination));
  if (resolveRuntimeDataRootPath(source, destination) !== destination
    || !missing(destination) || !missing(path.join(source, '.env'))) throw fail();
  for (const [key, expected] of Object.entries({ EDGEVIEW_CONFIG: path.join(source, 'config.json'),
    EDGEVIEW_SQLITE_DB: path.join(source, 'edgeview.db'), EDGEVIEW_JSON_DB: path.join(source, 'edgeview_db.json'),
    EDGEVIEW_V1_DATA_DIR: path.join(source, 'data', 'v1-runs') })) {
    if (process.env[key]?.trim() && path.resolve(process.env[key]!.trim()) !== expected) throw fail();
  }
  stopped(source);
  if (backup && (!/^[a-f0-9]{64}$/.test(backup.manifestSha256) || !Number.isSafeInteger(backup.schema) || backup.schema < 0)) throw fail();
  const snapshot = backup ? await inspectRuntimeBackup(source, backup.manifestSha256) : null;
  const releaseSource = acquireRuntimeMaintenance(path.join(source, 'edgeview.db.lock'));
  let releaseDestination: (() => void) | undefined;
  let created = false;
  try {
    stopped(source); if (!missing(destination)) throw fail();
    const names = inventory(source);
    const sourceSchema = await validateCopiedState(source); // Reject plaintext/invalid data before copying it.
    const expected = names.map(relative => ({ path: relative.replace(/\\/g, '/'), ...transfer(path.join(source, relative)) }));
    if (snapshot && backup) {
      const listed = new Map<string, Entry>(snapshot.entries.map((entry: Entry) => [entry.path, entry]));
      if (sourceSchema !== backup.schema || listed.size !== expected.length || expected.some(entry => {
        const approved = listed.get(entry.path);
        return !approved || approved.sha256 !== entry.sha256 || approved.bytes !== entry.bytes;
      })) throw fail();
    }
    const sourceOwner = ownerBytes(source);
    fs.mkdirSync(destination, { mode: 0o700 }); created = true;
    releaseDestination = acquireRuntimeMaintenance(path.join(destination, 'edgeview.db.lock'));
    stopped(destination);
    const journal = path.join(destination, 'migration.json');
    writeJson(journal, { format: 1, status: 'INCOMPLETE', pid: process.pid,
      sourceRootSha256: digest(Buffer.from(source)), sourceOwnerSha256: digest(sourceOwner),
      destinationOwnerSha256: digest(ownerBytes(destination)), files: expected });
    const entries: Entry[] = [];
    for (const [index, relative] of names.entries()) {
      const copied = transfer(path.join(source, relative), path.join(destination, relative));
      if (copied.sha256 !== expected[index].sha256 || copied.bytes !== expected[index].bytes
        || transfer(path.join(destination, relative)).sha256 !== copied.sha256) throw fail();
      entries.push({ path: relative.replace(/\\/g, '/'), ...copied });
    }
    const schema = await validateCopiedState(destination);
    if (JSON.stringify(inventory(source)) !== JSON.stringify(names)) throw fail();
    for (const entry of entries) if (transfer(path.join(source, entry.path)).sha256 !== entry.sha256) throw fail();
    stopped(source); stopped(destination);
    const completed = path.join(destination, 'migration.complete.json');
    writeJson(completed, { format: 1, status: 'COPIED_NOT_ACTIVATED', sourceSchema: schema,
      ...(snapshot ? { backupManifestSha256: snapshot.manifestSha256 } : {}),
      createdAt: new Date().toISOString(), files: entries });
    writeJson(path.join(destination, 'migration.ready.json'), { format: 1, status: 'COPIED_NOT_ACTIVATED',
      manifestSha256: transfer(completed).sha256 });
    releaseDestination(); releaseDestination = undefined;
    return { status: 'COPIED_NOT_ACTIVATED' as const, files: entries.length, bytes: entries.reduce((sum, entry) => sum + entry.bytes, 0), sourceSchema: schema };
  } catch {
    // Controlled failure retains the private partial copy, never overlays it on
    // retry. Actual process termination keeps both gates for explicit recovery.
    if (created && releaseDestination) {
      releaseDestination();
      const token = JSON.parse(ownerBytes(source).toString('utf8')).token;
      fs.renameSync(destination, `${destination}.migration-incomplete-${token}`);
    }
    throw fail();
  } finally { releaseSource(); }
}

/** Retry a completely recorded interrupted copy; no in-place overlay or source
 * deletion. Current source must match every captured entry. Unknown/active owner,
 * changed source, missing journal or accepted destination remains fail-closed. */
export async function retryInterruptedLegacyMigration(source: string, destination: string) {
  directory(source); directory(path.dirname(destination));
  if (resolveRuntimeDataRootPath(source, destination) !== destination) throw fail();
  stopped(source);
  const sourceOwner = ownerBytes(source), owner = JSON.parse(sourceOwner.toString('utf8'));
  if (owner.format !== 1 || !Number.isSafeInteger(owner.pid) || owner.pid < 1
    || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(owner.token)) throw fail();
  try { process.kill(owner.pid, 0); throw fail(); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw fail(); }
  const retained = `${destination}.migration-incomplete-${owner.token}`;
  const work = missing(destination) ? retained : destination; directory(work); stopped(work);
  if (!missing(path.join(work, 'migration.complete.json'))) throw fail();
  const journal = JSON.parse(inspectSmall(path.join(work, 'migration.json'), 16 * 1024 ** 2).toString('utf8'));
  if (Object.keys(journal).sort().join(',') !== 'destinationOwnerSha256,files,format,pid,sourceOwnerSha256,sourceRootSha256,status'
    || journal.format !== 1 || journal.status !== 'INCOMPLETE' || journal.pid !== owner.pid
    || journal.sourceRootSha256 !== digest(Buffer.from(source)) || journal.sourceOwnerSha256 !== digest(sourceOwner)
    || journal.destinationOwnerSha256 !== digest(ownerBytes(work)) || !Array.isArray(journal.files)) throw fail();
  const actual = inventory(source).map(relative => ({ path: relative.replace(/\\/g, '/'), ...transfer(path.join(source, relative)) }));
  if (JSON.stringify(actual) !== JSON.stringify(journal.files)) throw fail();
  if (work !== retained) fs.renameSync(work, retained);
  releaseOwnedRuntimeMaintenance(lockPath(source), sourceOwner.toString('utf8'));
  return copyLegacyRuntimeData(source, destination);
}
