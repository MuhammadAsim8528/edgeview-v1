import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const sha = value => crypto.createHash('sha256').update(value).digest('hex');
function digestTree(root, entries, exclude = () => false) {
  const hash = crypto.createHash('sha256');
  function visit(relative) {
    if (exclude(relative)) return;
    const absolute = path.join(root, relative);
    let stat;
    try { stat = fs.lstatSync(absolute); } catch (error) { if (error.code === 'ENOENT') return; throw error; }
    if (stat.isSymbolicLink()) throw new Error('Build inputs cannot be symbolic links.');
    if (stat.isDirectory()) {
      for (const child of fs.readdirSync(absolute).sort()) visit(`${relative}/${child}`);
    } else if (stat.isFile()) {
      // Hash file names and digests with unambiguous separators, not timestamps.
      hash.update(relative).update('\0').update(sha(fs.readFileSync(absolute))).update('\0');
    }
  }
  for (const entry of [...entries].sort()) visit(entry);
  return hash.digest('hex');
}
export function sourceDigest(root) {
  return digestTree(root, ['src', 'server', 'shared', 'public', 'server.ts', 'index.html', 'package.json', 'package-lock.json', 'vite.config.ts', 'tsconfig.json', 'scripts/build-metadata.mjs'],
    file => file === 'server/tests' || /(^|\/)\.env(?:\.|$)/i.test(file));
}
export function artifactDigest(root) {
  return digestTree(root, ['dist'], file => /^dist\/build-info\.json(?:\.|$)/.test(file) || ['dist/server-proof.cjs', 'dist/server-meta.json'].includes(file));
}
export function buildId(version, sourceHash, artifactHash) { return sha(JSON.stringify([version, sourceHash, artifactHash])); }
export function readBuildIdentity(root) {
  try {
    const file = path.join(root, 'dist', 'build-info.json');
    if (fs.statSync(file).size > 16384 || fs.lstatSync(file).isSymbolicLink()) throw new Error();
    const value = JSON.parse(fs.readFileSync(file, 'utf8'));
    const hex = candidate => typeof candidate === 'string' && /^[a-f0-9]{64}$/.test(candidate);
    if (value.format !== 1 || value.name !== 'edgeview' || typeof value.version !== 'string' || value.version.length > 80
      || !hex(value.sourceHash) || !hex(value.artifactHash) || !hex(value.buildId)
      || value.buildId !== buildId(value.version, value.sourceHash, value.artifactHash)
      || typeof value.builtAt !== 'string' || !Number.isFinite(Date.parse(value.builtAt))
      || !(value.gitCommit === null || /^[a-f0-9]{40,64}$/.test(value.gitCommit))) throw new Error();
    return { available: true, format: 1, version: value.version, buildId: value.buildId, sourceHash: value.sourceHash,
      artifactHash: value.artifactHash, builtAt: value.builtAt, gitCommit: value.gitCommit };
  } catch { return { available: false }; }
}
