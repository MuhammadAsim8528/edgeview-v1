import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { resolveRuntimeDataRoot } from '../shared/runtime_paths.mjs';
const appRoot = process.cwd();
if (JSON.parse(fs.readFileSync(path.join(appRoot, 'package.json'), 'utf8')).name !== 'edgeview') throw new Error('Expected EdgeView installation.');
const root = resolveRuntimeDataRoot(appRoot);
// A completed fixed-layout snapshot must never imply that externally located
// active configuration/evidence or test databases were protected. Until backup
// has a reviewed multi-root manifest/restore contract, refuse those layouts.
const expectedPaths = {
  EDGEVIEW_CONFIG: path.join(root, 'config.json'),
  EDGEVIEW_V1_DATA_DIR: path.join(root, 'data', 'v1-runs'),
  EDGEVIEW_SQLITE_DB: path.join(root, 'edgeview.db'),
  EDGEVIEW_JSON_DB: path.join(root, 'edgeview_db.json'),
};
for (const [key, expected] of Object.entries(expectedPaths)) {
  const override = process.env[key];
  if (override?.trim() && path.resolve(override.trim()) !== path.resolve(expected)) {
    throw new Error(`BACKUP_PATH_OVERRIDE_UNSUPPORTED: ${key}. No backup was created; use a reviewed backup of the actual active storage layout.`);
  }
}
if (process.env.NODE_ENV === 'test' || ['1', 'true'].includes(process.env.EDGEVIEW_TEST_MODE)) {
  throw new Error('BACKUP_TEST_LAYOUT_UNSUPPORTED: operational backup does not resolve test-only storage paths.');
}
const requireStopped = () => {
  if (fs.existsSync(path.join(root, 'edgeview.db.lock'))) throw new Error('Stop EdgeView normally before backup. Backup never removes an existing backend lock.');
};
requireStopped();
const stamp = `${new Date().toISOString().replace(/[:.]/g, '-')}-${crypto.randomUUID()}`;
const destination = path.join(root, 'backups', `EdgeView-${stamp}`);
const staging = path.join(root, 'backups', `INCOMPLETE-EdgeView-${stamp}`);
const included = ['edgeview.db', 'edgeview_db.json', 'pharma_db.json', 'config.json', 'config.prev.json', 'data', 'uploads'];
const manifest = { format: 1, created_at: new Date().toISOString(), files: [] };

async function sha256File(file) {
  const hash = crypto.createHash('sha256');
  for await (const chunk of fs.createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}

async function copyTree(source, target, relative) {
  const stat = fs.lstatSync(source);
  if (stat.isSymbolicLink()) throw new Error('Runtime links are not supported in backups.');
  if (stat.isDirectory()) {
    fs.mkdirSync(target, { recursive: true });
    for (const entry of fs.readdirSync(source)) await copyTree(path.join(source, entry), path.join(target, entry), `${relative}/${entry}`);
    return;
  }
  if (!stat.isFile()) throw new Error('Unsupported runtime file type.');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target, fs.constants.COPYFILE_EXCL);
  const digest = await sha256File(target);
  if (fs.statSync(source).size !== stat.size || fs.statSync(target).size !== stat.size || await sha256File(source) !== digest) throw new Error('Runtime file changed during backup.');
  manifest.files.push({ path: relative.replace(/\\/g, '/'), bytes: stat.size, sha256: digest });
}

const parent = path.dirname(destination);
if (fs.existsSync(parent) && fs.lstatSync(parent).isSymbolicLink()) throw new Error('Backup destination links are not supported.');
fs.mkdirSync(parent, { recursive: true });
fs.mkdirSync(staging, { recursive: false });
for (const item of included) {
  const source = path.join(root, item);
  if (fs.existsSync(source)) await copyTree(source, path.join(staging, item), item);
}
if (!manifest.files.length) throw new Error('No EdgeView runtime files were found to back up.');
requireStopped();
fs.writeFileSync(path.join(staging, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
fs.renameSync(staging, destination);
console.log(JSON.stringify({ backup: destination, files: manifest.files.length, bytes: manifest.files.reduce((sum, file) => sum + file.bytes, 0) }));
