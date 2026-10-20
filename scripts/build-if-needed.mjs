import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { sourceDigest, artifactDigest, readBuildIdentity } from '../shared/build_identity.mjs';

const root = process.cwd();
const outputs = ['server.cjs', 'index.html', 'build-info.json'].map(file => path.join(root, 'dist', file));
function currentBuild() {
  try {
    const identity = readBuildIdentity(root);
    const version = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
    return outputs.every(fs.existsSync) && identity.available && identity.version === version
      && identity.sourceHash === sourceDigest(root) && identity.artifactHash === artifactDigest(root);
  } catch { return false; }
}
if (currentBuild()) {
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
if (result.status !== 0 || !currentBuild()) {
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
