import fs from 'node:fs';
import path from 'node:path';

// GNU tar ahead of tar.exe on a bash-flavoured PATH reads C:\... as a remote share and can write a
// non-ZIP archive behind a .zip name, so Windows builds must use the system archiver when it exists.
export function systemTar() {
  const candidate = path.join(process.env.SystemRoot ?? '', 'System32', 'tar.exe');
  return process.platform === 'win32' && fs.existsSync(candidate) ? candidate : 'tar';
}
