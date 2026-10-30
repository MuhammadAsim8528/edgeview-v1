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
function checkJournal(root: string) {
  ordinaryDirectory(root); stopped(root);
  const p = locations(root); ordinaryDirectory(p.work); ordinaryDirectory(p.gate);
  const journal = JSON.parse(read(path.join(p.work, 'journal.json'), 4096).toString('utf8'));
  if (journal.format !== 1 || !Number.isSafeInteger(journal.pid) || journal.pid < 1
    || !['originalSha', 'candidateSha', 'primarySha', 'ownerSha'].every(key => /^[a-f0-9]{64}$/.test(journal[key]))) throw refusal();
  const owner = read(path.join(p.gate, 'owner.json'), 4096);
  if (hash(owner) !== journal.ownerSha || JSON.parse(owner.toString('utf8')).pid !== journal.pid
    || hash(read(p.primary)) !== journal.primarySha
    || hash(read(path.join(p.work, 'database.before'))) !== journal.originalSha
    || hash(read(path.join(p.work, 'primary.before'))) !== journal.primarySha) throw refusal();
  const current = hash(read(p.database));
  if (current !== journal.originalSha && current !== journal.candidateSha) throw refusal();
  return { p, journal, current };
}
function rollback(root: string) {
  const { p, journal, current } = checkJournal(root);
  if (current !== journal.originalSha) {
    const pending = path.join(p.work, 'rollback.pending');
    // An interrupted rollback can be resumed only from an exact original image.
    try { if (hash(read(pending)) !== journal.originalSha) throw refusal(); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      write(pending, read(path.join(p.work, 'database.before'))); }
    fs.renameSync(pending, p.database);
  }
  if (hash(read(p.database)) !== journal.originalSha) throw refusal();
}
function archive(root: string) {
  const p = locations(root);
  fs.renameSync(p.work, path.join(root, `.edgeview-history-repair-retained-${randomUUID()}`));
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
    write(path.join(p.work, 'database.before'), before);
    write(path.join(p.work, 'primary.before'), primary);
    write(path.join(p.work, 'candidate.pending'), candidate.candidate);
    const owner = read(path.join(p.gate, 'owner.json'), 4096);
    write(path.join(p.work, 'journal.json'), JSON.stringify({ format: 1, pid: process.pid,
      ownerSha: hash(owner), originalSha: candidate.databaseSha256,
      candidateSha: candidate.candidateSha256, primarySha: candidate.primarySha256 }));
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
  const first = checkJournal(root);
  try { process.kill(first.journal.pid, 0); throw refusal(); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw refusal(); }
  const recovery = `${first.p.gate}.recovery`;
  fs.mkdirSync(recovery, { mode: 0o700 });
  try {
    const again = checkJournal(root);
    if (JSON.stringify(again.journal) !== JSON.stringify(first.journal)) throw refusal();
    rollback(root); archive(root);
    fs.unlinkSync(path.join(first.p.gate, 'owner.json')); fs.rmdirSync(first.p.gate);
    return { status: 'ROLLED_BACK' as const };
  } finally { fs.rmdirSync(recovery); }
}
