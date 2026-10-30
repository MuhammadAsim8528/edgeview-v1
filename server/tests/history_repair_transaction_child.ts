import fs from 'node:fs';
import path from 'node:path';
import { applyHistoryRepair } from '../history_repair_transaction';
const [root, mode] = process.argv.slice(2);
const rename = fs.renameSync;
fs.renameSync = ((from, to) => {
  if (String(to) === path.join(root, 'edgeview.db') && String(from).endsWith('candidate.pending')) {
    if (mode === 'kill-before') process.exit(77);
    rename(from, to);
    if (mode === 'kill-after') process.exit(78);
    if (mode === 'throw-after') throw new Error('Controlled post-replacement failure');
    return;
  }
  return rename(from, to);
}) as typeof fs.renameSync;
try {
  await applyHistoryRepair(root, 'same.csv');
} catch { process.exitCode = 19; }
