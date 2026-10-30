import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { acquireRuntimeMaintenance } from '../shared/runtime_maintenance.mjs';
import { buildHistoryRepairCandidate } from './history_repair_candidate';

const LIMIT = 64 * 1024 * 1024;
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const refusal = () => new Error('HISTORY_REPAIR_REFUSED: Stored data was not accepted for this recovery operation.');
function ordinaryDirectory(root: string) {
  if (!path.isAbsolute(root) || path.resolve(root) !== root || /[\x00-\x1f]/.test(root)) throw refusal();
  for (let current = root;; current = path.dirname(current)) {
    const stat = fs.lstatSync(current);
    if (stat.isSymbolicLink() || !stat.isDirectory()) throw refusal();
    if (path.dirname(current) === current) return;
  }
}
function read(file: string, limit = LIMIT) {
  const stat = fs.lstatSync(file);
  if (stat.isSymbolicLink() || !stat.isFile() || stat.size > limit || stat.nlink !== 1) throw refusal();
  const fd = fs.openSync(file, 'r');
  try {
    const opened = fs.fstatSync(fd);
    if (opened.dev !== stat.dev || opened.ino !== stat.ino || opened.size !== stat.size) throw refusal();
    const bytes = Buffer.alloc(opened.size);
    let offset = 0;
    while (offset < bytes.length) {
      const count = fs.readSync(fd, bytes, offset, bytes.length - offset, offset);
      if (!count) throw refusal();
      offset += count;
    }
    if (fs.readSync(fd, Buffer.alloc(1), 0, 1, offset) || fs.fstatSync(fd).size !== opened.size) throw refusal();
    return bytes;
  } finally { fs.closeSync(fd); }
}
function write(file: string, bytes: Uint8Array | string) {
  const fd = fs.openSync(file, 'wx', 0o600);
  try { fs.writeFileSync(fd, bytes); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
}
function stopped(root: string) {
  try { fs.lstatSync(path.join(root, 'edgeview.db.lock')); throw refusal(); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
}
const locations = (root: string) => ({
  database: path.join(root, 'edgeview.db'), primary: path.join(root, 'edgeview_db.json'),
  gate: path.join(root, 'edgeview.db.lock.maintenance'), work: path.join(root, '.edgeview-history-repair'),
});
function ownerAt(gate: string) {
  ordinaryDirectory(gate);
  const bytes = read(path.join(gate, 'owner.json'), 4096);
  const owner = JSON.parse(bytes.toString('utf8'));
  if (owner.format !== 1 || !Number.isSafeInteger(owner.pid) || owner.pid < 1
    || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(owner.token)) throw refusal();
  return { bytes, owner };
}
function transactionLocations(root: string) {
  const p = locations(root), { bytes, owner } = ownerAt(p.gate);
  const retained = path.join(root, `.edgeview-history-repair-retained-${owner.token}`);
  try { fs.lstatSync(p.work); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; p.work = retained; }
  ordinaryDirectory(p.work);
  return { p, bytes, owner, retained };
}
function checkJournal(root: string, allowUnchangedIncomplete = false) {
  ordinaryDirectory(root); stopped(root);
  const { p, bytes: owner } = transactionLocations(root);
  const journal = JSON.parse(read(path.join(p.work, 'journal.json'), 4096).toString('utf8'));
  if (Object.keys(journal).sort().join(',') !== 'candidateSha,format,originalSha,ownerSha,pid,primarySha'
    || journal.format !== 1 || !Number.isSafeInteger(journal.pid) || journal.pid < 1
    || !['originalSha', 'candidateSha', 'primarySha', 'ownerSha'].every(key => /^[a-f0-9]{64}$/.test(journal[key]))) throw refusal();
  if (hash(owner) !== journal.ownerSha || JSON.parse(owner.toString('utf8')).pid !== journal.pid
    || hash(read(p.primary)) !== journal.primarySha) throw refusal();
  const current = hash(read(p.database));
  if (current !== journal.originalSha && current !== journal.candidateSha) throw refusal();
  for (const [file, expected] of [['database.before', journal.originalSha], ['primary.before', journal.primarySha]]) {
    try {
      if (hash(read(path.join(p.work, file))) !== expected
        && !(allowUnchangedIncomplete && current === journal.originalSha)) throw refusal();
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT'
        || !allowUnchangedIncomplete || current !== journal.originalSha) throw error;
    }
  }
  return { p, journal, current };
}
function rollback(root: string) {
  const { p, journal, current } = checkJournal(root, true);
  if (current !== journal.originalSha) {
    const pending = path.join(p.work, 'rollback.pending');
    // An interrupted rollback can be resumed only from an exact original image.
    try {
      if (hash(read(pending)) !== journal.originalSha) {
        // Preserve an interrupted partial copy; never treat it as the preimage.
        fs.renameSync(pending, `${pending}.incomplete-${randomUUID()}`);
        write(pending, read(path.join(p.work, 'database.before')));
      }
    }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      write(pending, read(path.join(p.work, 'database.before'))); }
    fs.renameSync(pending, p.database);
  }
  if (hash(read(p.database)) !== journal.originalSha) throw refusal();
}
function archive(root: string) {
  const { p, retained } = transactionLocations(root);
  if (p.work !== retained) fs.renameSync(p.work, retained);
}

function requireAbsentOwner(pid: number) {
  try { process.kill(pid, 0); throw refusal(); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw refusal(); }
}
function releaseDirectory(directory: string, bytes: Buffer, token: string) {
  ordinaryDirectory(directory);
  if (!read(path.join(directory, 'owner.json'), 4096).equals(bytes)
    || fs.readdirSync(directory).join(',') !== 'owner.json') throw refusal();
  const retired = `${directory}.released-${token}`;
  fs.renameSync(directory, retired);
  try { fs.unlinkSync(path.join(retired, 'owner.json')); fs.rmdirSync(retired); }
  catch { /* ownership release is complete; never remove unknown retained files */ }
}

/** Internal maintenance operation only. Fixed primary/DB paths, never a generic
 * restore manifest, HTTP route or exposed operator control. No legacy fallback.
 * Retained preimages are private customer data, not diagnostic exports. */
export async function applyHistoryRepair(root: string, name: string) {
  ordinaryDirectory(root); stopped(root);
  const p = locations(root);
  const release = acquireRuntimeMaintenance(path.join(root, 'edgeview.db.lock'));
  let prepared = false, created = false;
  try {
    stopped(root);
    const primary = read(p.primary), before = read(p.database);
    const candidate = await buildHistoryRepairCandidate(primary, before, name);
    if (candidate.status === 'BLOCKED') throw refusal();
    if (candidate.status === 'CURRENT') { release(); return { status: 'CURRENT' as const }; }
    fs.mkdirSync(p.work, { mode: 0o700 }); created = true;
    const owner = read(path.join(p.gate, 'owner.json'), 4096);
    write(path.join(p.work, 'journal.json'), JSON.stringify({ format: 1, pid: process.pid,
      ownerSha: hash(owner), originalSha: candidate.databaseSha256,
      candidateSha: candidate.candidateSha256, primarySha: candidate.primarySha256 }));
    write(path.join(p.work, 'database.before'), before);
    write(path.join(p.work, 'primary.before'), primary);
    write(path.join(p.work, 'candidate.pending'), candidate.candidate);
    prepared = true;
    checkJournal(root); // Recheck unchanged source and exact preimages before replace.
    if (hash(read(path.join(p.work, 'candidate.pending'))) !== candidate.candidateSha256) throw refusal();
    fs.renameSync(path.join(p.work, 'candidate.pending'), p.database);
    const verified = checkJournal(root);
    if (verified.current !== candidate.candidateSha256) throw refusal();
    archive(root); release();
    return { status: 'REPAIRED' as const, insertedRows: candidate.insertedRows };
  } catch {
    // Never release startup exclusion while an uncertain replacement may exist.
    if (prepared) { rollback(root); archive(root); release(); }
    else if (created) { archive(root); release(); }
    else release();
    throw refusal();
  }
}

/** Explicit rollback of a prepared interrupted transaction. Require exact gate
 * ownership, intact preimages/source/current bytes, definitely absent old owner,
 * and a separate atomic recovery gate. PID alone never authorizes removal. */
export function recoverInterruptedHistoryRepair(root: string) {
  const first = checkJournal(root, true);
  requireAbsentOwner(first.journal.pid);
  // Scope the recovery lease to this transaction, so debris after a completed
  // release cannot block recovery of a later, unrelated transaction.
  const recovery = `${first.p.gate}.recovery-${ownerAt(first.p.gate).owner.token}`;
  const journalSha = hash(Buffer.from(JSON.stringify(first.journal)));
  // Reclaim only a complete dead recovery lease bound to this exact immutable
  // transaction. A PID, missing marker or malformed lease alone is insufficient.
  try {
    fs.lstatSync(recovery);
    const previous = ownerAt(recovery);
    if (previous.owner.ownerSha !== first.journal.ownerSha || previous.owner.journalSha !== journalSha
      || fs.readdirSync(recovery).join(',') !== 'owner.json') throw refusal();
    requireAbsentOwner(previous.owner.pid);
    fs.renameSync(recovery, `${recovery}.interrupted-${previous.owner.token}`);
  } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  fs.mkdirSync(recovery, { mode: 0o700 });
  const token = randomUUID();
  const recoveryOwner = Buffer.from(JSON.stringify({ format: 1, pid: process.pid, token,
    ownerSha: first.journal.ownerSha, journalSha }));
  write(path.join(recovery, 'owner.json'), recoveryOwner);
  try {
    const again = checkJournal(root, true);
    if (JSON.stringify(again.journal) !== JSON.stringify(first.journal)) throw refusal();
    rollback(root); archive(root);
    const mainOwner = ownerAt(first.p.gate);
    if (hash(mainOwner.bytes) !== first.journal.ownerSha) throw refusal();
    releaseDirectory(first.p.gate, mainOwner.bytes, mainOwner.owner.token);
    return { status: 'ROLLED_BACK' as const };
  } finally { releaseDirectory(recovery, recoveryOwner, token); }
}
