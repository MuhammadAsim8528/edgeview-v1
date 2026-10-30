import fs from 'node:fs';
import path from 'node:path';
import { copyLegacyRuntimeData } from '../legacy_data_migration';
const [source, destination, mode = 'kill'] = process.argv.slice(2);
const write = fs.writeSync;
const open = fs.openSync, descriptors = new Map<number, string>();
fs.openSync = ((file: any, ...args: any[]) => { const fd = (open as any)(file, ...args); descriptors.set(fd, String(file)); return fd; }) as typeof fs.openSync;
fs.writeSync = ((...args: any[]) => {
  const count = (write as any)(...args);
  if (mode === 'kill' && descriptors.get(args[0]) === path.join(destination, 'edgeview.db')) {
    fs.writeFileSync(path.join(source, 'test-copy-kill-stage'), 'copying');
    process.kill(process.pid, 'SIGKILL');
  }
  return count;
}) as typeof fs.writeSync;
void copyLegacyRuntimeData(source, destination).catch(() => { process.exitCode = 19; });
