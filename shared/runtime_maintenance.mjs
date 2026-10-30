import fs from 'node:fs';
import { randomUUID } from 'node:crypto';

// Caller must already establish ownership/liveness and operation-specific
// recovery proof. Matching a PID alone is never enough to invoke this helper.
export function releaseOwnedRuntimeMaintenance(backendLockPath, expectedOwner) {
  const directory = `${backendLockPath}.maintenance`, ownerFile = `${directory}/owner.json`;
  const parsed = JSON.parse(expectedOwner);
  if (parsed.format !== 1 || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(parsed.token)
    || fs.lstatSync(directory).isSymbolicLink() || fs.lstatSync(ownerFile).isSymbolicLink()
    || fs.readFileSync(ownerFile, 'utf8') !== expectedOwner
    || fs.readdirSync(directory).join(',') !== 'owner.json') throw new Error('RUNTIME_MAINTENANCE_OWNERSHIP_CHANGED');
  const retired = `${directory}.released-${parsed.token}`;
  fs.renameSync(directory, retired);
  try { fs.unlinkSync(`${retired}/owner.json`); fs.rmdirSync(retired); }
  catch { /* preserve cleanup debris after atomic ownership release */ }
}

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
    // Publication of release is atomic: a crash cannot leave an ownerless active
    // gate between unlink(owner) and rmdir(gate). Retired debris is nonblocking.
    releaseOwnedRuntimeMaintenance(backendLockPath, owner);
    released = true;
  };
}
