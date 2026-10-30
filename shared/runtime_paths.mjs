import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

// Launcher-owned opt-in. No migration, creation, secret reads or cwd fallback.
// Legacy installations retain app-root state until explicitly migrated.
export function resolveRuntimeDataRoot(appRoot, env = process.env) {
  const root = resolveRuntimeDataRootPath(appRoot, env.EDGEVIEW_DATA_DIR);
  assertMigrationCopyReady(root);
  return root;
}

// Path policy shared with offline migration; this alone never accepts copied data.
export function resolveRuntimeDataRootPath(appRoot, configured) {
  const app = path.resolve(appRoot);
  if (configured === undefined || configured === '') return app;
  if (typeof configured !== 'string' || !path.isAbsolute(configured) || configured.trim() !== configured || /[\x00-\x1f]/.test(configured)) throw new Error('EDGEVIEW_DATA_DIR must be an absolute normal path.');
  const root = path.resolve(configured);
  const inside = (parent, child) => { const relative = path.relative(parent, child); return relative === '' || (!relative.startsWith('..'+path.sep) && relative !== '..' && !path.isAbsolute(relative)); };
  if (inside(app, root) || inside(root, app)) throw new Error('Installed code and writable data roots must be disjoint.');
  for (let current = root;; current = path.dirname(current)) {
    try { const stat = fs.lstatSync(current); if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error('Runtime data ancestors must be ordinary directories.'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (path.dirname(current) === current) break;
  }
  return root;
}

export function assertMigrationCopyReady(root) {
  const present = file => {
    try { return fs.lstatSync(file); }
    catch (error) { if (error.code !== 'ENOENT') throw error; return null; }
  };
  const marker = present(path.join(root, 'migration.json'));
  const readyFile = path.join(root, 'migration.ready.json'), ready = present(readyFile);
  if (!marker && !ready) return;
  const refused = () => new Error('LEGACY_MIGRATION_INCOMPLETE: This data copy has not passed preparation. Original storage was retained.');
  if (!marker || !ready || marker.isSymbolicLink() || ready.isSymbolicLink()
    || !marker.isFile() || marker.nlink !== 1 || marker.size > 16 * 1024 * 1024
    || !ready.isFile() || ready.size > 4096 || ready.nlink !== 1) throw refused();
  const fd = fs.openSync(readyFile, 'r');
  try {
    const bytes = Buffer.alloc(4097), count = fs.readSync(fd, bytes, 0, bytes.length, 0);
    if (count > 4096 || count !== ready.size) throw refused();
    const value = JSON.parse(bytes.subarray(0, count).toString('utf8'));
    if (value.format !== 1 || value.status !== 'COPIED_NOT_ACTIVATED'
      || !/^[a-f0-9]{64}$/.test(value.manifestSha256)) throw refused();
    const manifestFile = path.join(root, 'migration.complete.json'), manifest = fs.lstatSync(manifestFile);
    if (!manifest.isFile() || manifest.isSymbolicLink() || manifest.nlink !== 1 || manifest.size > 16 * 1024 * 1024) throw refused();
    const input = fs.openSync(manifestFile, 'r');
    try {
      const chunk = Buffer.alloc(64 * 1024), hash = createHash('sha256'); let total = 0;
      for (;;) {
        const read = fs.readSync(input, chunk, 0, chunk.length, null); if (!read) break;
        total += read; if (total > manifest.size) throw refused(); hash.update(chunk.subarray(0, read));
      }
      if (total !== manifest.size || hash.digest('hex') !== value.manifestSha256) throw refused();
    } finally { fs.closeSync(input); }
  } catch { throw refused(); } finally { fs.closeSync(fd); }
}
