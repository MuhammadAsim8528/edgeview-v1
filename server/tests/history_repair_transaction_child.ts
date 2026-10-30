import fs from 'node:fs';
import path from 'node:path';
import { applyHistoryRepair, recoverInterruptedHistoryRepair } from '../history_repair_transaction';
const [root, mode, name = 'same.csv'] = process.argv.slice(2);
const rename = fs.renameSync;
const open = fs.openSync, writeFile = fs.writeFileSync;
function terminate() {
  writeFile(path.join(root, 'test-termination-stage'), mode);
  process.kill(process.pid, 'SIGKILL');
  throw new Error('Forced termination unexpectedly returned');
}
const descriptors = new Map<number, string>();
fs.openSync = ((file: any, ...args: any[]) => {
  const fd = (open as any)(file, ...args); descriptors.set(fd, String(file)); return fd;
}) as typeof fs.openSync;
fs.writeFileSync = ((file: any, ...args: any[]) => {
  const target = typeof file === 'number' ? descriptors.get(file) || '' : String(file);
  if ((mode === 'recover-kill-writing' && target.endsWith('rollback.pending'))
    || (mode === 'kill-copy' && target.endsWith('database.before'))) {
    writeFile(file, Buffer.from(args[0]).subarray(0, 17)); terminate();
  }
  return (writeFile as any)(file, ...args);
}) as typeof fs.writeFileSync;
fs.renameSync = ((from, to) => {
  if (mode === 'recover-kill-after' && String(from).endsWith('rollback.pending')) {
    rename(from, to); terminate();
  }
  if (mode === 'kill-archive' && String(from) === path.join(root, '.edgeview-history-repair')) {
    rename(from, to); terminate();
  }
  if (String(to) === path.join(root, 'edgeview.db') && String(from).endsWith('candidate.pending')) {
    if (mode === 'kill-before') terminate();
    rename(from, to);
    if (mode === 'kill-after') terminate();
    if (mode === 'throw-after') throw new Error('Controlled post-replacement failure');
    return;
  }
  return rename(from, to);
}) as typeof fs.renameSync;
async function main() {
try {
  if (mode === 'recover' || mode.startsWith('recover-')) recoverInterruptedHistoryRepair(root);
  else await applyHistoryRepair(root, name);
} catch { process.exitCode = 19; }
}
void main();
