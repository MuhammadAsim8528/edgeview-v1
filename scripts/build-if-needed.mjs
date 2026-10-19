import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const outputs = [path.join(root, 'dist', 'server.cjs'), path.join(root, 'dist', 'index.html')];
const watchRoots = ['src', 'server', 'public', 'index.html', 'server.ts', 'package.json', 'vite.config.ts', 'tsconfig.json'];

function newestMtime(target) {
  if (!fs.existsSync(target)) return 0;
  const stat = fs.statSync(target);
  if (stat.isFile()) return stat.mtimeMs;
  let newest = stat.mtimeMs;
  for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'data') continue;
    newest = Math.max(newest, newestMtime(path.join(target, entry.name)));
  }
  return newest;
}

const outputTime = outputs.every(fs.existsSync)
  ? Math.min(...outputs.map(file => fs.statSync(file).mtimeMs))
  : 0;
const sourceTime = Math.max(...watchRoots.map(item => newestMtime(path.join(root, item))));

if (sourceTime <= outputTime) {
  console.log('EdgeView is up to date.');
  process.exit(0);
}

console.log('EdgeView source changed; rebuilding...');
// Vite clears dist before building. Keep the previous complete build recoverable
// if either the frontend or server build fails.
const dist = path.join(root, 'dist');
const backup = fs.existsSync(dist)
  ? fs.mkdtempSync(path.join(root, '.edgeview-build-backup-'))
  : null;
if (backup) fs.cpSync(dist, path.join(backup, 'dist'), { recursive: true });
const result = spawnSync('npm run build', { cwd: root, stdio: 'inherit', shell: true });
if (result.status !== 0 || !outputs.every(fs.existsSync)) {
  if (backup) {
    fs.rmSync(dist, { recursive: true, force: true });
    fs.cpSync(path.join(backup, 'dist'), dist, { recursive: true });
    fs.rmSync(backup, { recursive: true, force: true });
    console.error('Build failed. The previous build was restored; source changes still need repair.');
  }
  process.exit(result.status || 1);
}
if (backup) fs.rmSync(backup, { recursive: true, force: true });
process.exit(result.status ?? 1);
