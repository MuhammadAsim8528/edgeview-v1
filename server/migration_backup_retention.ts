import fs from 'node:fs';
import path from 'node:path';

const RETAIN = 3;
function unlinkedDirectory(directory: string): boolean {
  for (let current = directory; ;) {
    const entry = fs.lstatSync(current);
    if (!entry.isDirectory() || entry.isSymbolicLink()) return false;
    const parent = path.dirname(current);
    if (parent === current) return true;
    current = parent;
  }
}

/** Only call after a successful durable migration and on-disk reopen check.
 * Keep its immediate recovery image plus the newest two other exact backups.
 * Links, malformed names and unrelated database basenames are never deleted.
 */
export function pruneMigrationBackups(databasePath: string, recoveryPath: string) {
  const result = { removed: 0, errors: 0, skipped: 0 };
  const database = path.resolve(databasePath);
  const directory = path.dirname(database);
  const recovery = path.resolve(recoveryPath);
  const escaped = path.basename(database).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`^${escaped}\\.pre-migration-v(\\d+)-(\\d+)\\.bak$`);
  try {
    if (path.dirname(recovery) !== directory || !pattern.test(path.basename(recovery)) || !unlinkedDirectory(directory)) {
      result.skipped += 1;
      return result;
    }
    const candidates = fs.readdirSync(directory).flatMap(name => {
      const match = pattern.exec(name);
      if (!match || !Number.isSafeInteger(Number(match[2]))) return [];
      const file = path.join(directory, name);
      try {
        const stat = fs.lstatSync(file);
        if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1) { result.skipped += 1; return []; }
        return [{ file, name, timestamp: Number(match[2]), stat }];
      } catch { result.errors += 1; return []; }
    });
    if (!candidates.some(candidate => candidate.file === recovery)) { result.skipped += 1; return result; }
    candidates.sort((a, b) => b.timestamp - a.timestamp || b.name.localeCompare(a.name));
    const retained = new Set([recovery, ...candidates.filter(candidate => candidate.file !== recovery).slice(0, RETAIN - 1).map(candidate => candidate.file)]);
    for (const candidate of candidates) {
      if (retained.has(candidate.file)) continue;
      try {
        if (!unlinkedDirectory(directory)) { result.skipped += 1; break; }
        const current = fs.lstatSync(candidate.file);
        if (!current.isFile() || current.isSymbolicLink() || current.nlink !== 1 || current.ino !== candidate.stat.ino || current.dev !== candidate.stat.dev) { result.skipped += 1; continue; }
        fs.unlinkSync(candidate.file);
        result.removed += 1;
      } catch { result.errors += 1; }
    }
  } catch { result.errors += 1; }
  return result;
}
