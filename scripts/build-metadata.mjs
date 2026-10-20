import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { artifactDigest, buildId, sourceDigest } from '../shared/build_identity.mjs';

export function writeBuildMetadata(root, commit = null) {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  if (manifest.name !== 'edgeview' || typeof manifest.version !== 'string'
    || !['dist/server.cjs', 'dist/index.html'].every(file => fs.existsSync(path.join(root, file)))) throw new Error('Expected complete EdgeView build.');
  const sourceHash = sourceDigest(root), artifactHash = artifactDigest(root);
  const metadata = { format: 1, name: 'edgeview', version: manifest.version, sourceHash, artifactHash,
    buildId: buildId(manifest.version, sourceHash, artifactHash), builtAt: new Date().toISOString(),
    gitCommit: typeof commit === 'string' && /^[a-f0-9]{40,64}$/.test(commit) ? commit : null };
  const destination = path.join(root, 'dist', 'build-info.json');
  const temp = `${destination}.${process.pid}.tmp`;
  const fd = fs.openSync(temp, 'wx');
  let open = true;
  try {
    fs.writeFileSync(fd, JSON.stringify(metadata, null, 2) + '\n'); fs.closeSync(fd); open = false;
    fs.renameSync(temp, destination);
  } finally { if (open) { try { fs.closeSync(fd); } catch {} } fs.rmSync(temp, { force: true }); }
  return metadata;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const root = process.cwd();
    const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => /^(PATH|SystemRoot|WINDIR|HOME|USERPROFILE|TEMP|TMP)$/i.test(key)));
    const result = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, env, encoding: 'utf8', timeout: 3000, maxBuffer: 4096, windowsHide: true });
    const metadata = writeBuildMetadata(root, result.status === 0 ? result.stdout.trim() : null);
    console.log(JSON.stringify({ buildId: metadata.buildId }));
  } catch { console.error('Build identity generation failed; build is not certified current.'); process.exitCode = 1; }
}
