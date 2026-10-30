import fs from 'node:fs';
import { randomUUID } from 'node:crypto';

// A short startup gate, held for the whole offline backup. The backend's
// existing lifetime database lock remains the database ownership authority.
// No PID-only stale reclamation: interrupted maintenance requires recovery.
export function acquireRuntimeMaintenance(backendLockPath) {
  const directory = `${backendLockPath}.maintenance`;
  try { fs.mkdirSync(directory, { mode: 0o700 }); }
  catch (cause) {
    throw new Error('RUNTIME_MAINTENANCE_BUSY: Backup or startup is already active, or interrupted maintenance requires recovery. No data was changed.', { cause });
  }
  const ownerFile = `${directory}/owner.json`;
  const token = randomUUID();
  const owner = JSON.stringify({ format: 1, pid: process.pid, token });
  try { fs.writeFileSync(ownerFile, owner, { flag: 'wx', mode: 0o600 }); }
  catch (cause) {
    // Never recursively remove unknown entries, including a partially written
    // marker. Preserve uncertainty for explicit recovery.
    try { fs.rmdirSync(directory); } catch { /* retain interrupted gate */ }
    throw new Error('RUNTIME_MAINTENANCE_INITIALIZATION_FAILED', { cause });
  }
  let released = false;
  return () => {
    if (released) return;
    if (fs.lstatSync(directory).isSymbolicLink() || fs.lstatSync(ownerFile).isSymbolicLink()
      || fs.readFileSync(ownerFile, 'utf8') !== owner
      || fs.readdirSync(directory).join(',') !== 'owner.json') throw new Error('RUNTIME_MAINTENANCE_OWNERSHIP_CHANGED');
    // Publication of release is atomic: a crash cannot leave an ownerless active
    // gate between unlink(owner) and rmdir(gate). Retired debris is nonblocking.
    const retired = `${directory}.released-${token}`;
    fs.renameSync(directory, retired);
    released = true;
    try { fs.unlinkSync(`${retired}/owner.json`); fs.rmdirSync(retired); }
    catch { /* preserve cleanup debris; ownership was already safely released */ }
  };
}
