import fs from 'node:fs';
import path from 'node:path';

// Launcher-owned opt-in. No migration, creation, secret reads or cwd fallback.
// Legacy installations retain app-root state until explicitly migrated.
export function resolveRuntimeDataRoot(appRoot, env = process.env) {
  const app = path.resolve(appRoot);
  const configured = env.EDGEVIEW_DATA_DIR;
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
