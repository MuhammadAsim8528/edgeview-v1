import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';


const rootFiles = new Set(['edgeview.db', 'edgeview_db.json', 'pharma_db.json', 'config.json', 'config.prev.json']);
const rootDirectories = new Set(['data', 'uploads']);
const sha256 = /^[a-f0-9]{64}$/;
const manifestLimit = 16 * 1024 * 1024;
const entryLimit = 100_000;

function safePart(part) {
  return part && part !== '.' && part !== '..' && !/[\\:<>"|?*\x00-\x1f]|[ .]$/.test(part)
    && !/^(?:con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])(?:\.|$)/i.test(part);
}

function regularFile(file) {
  const info = fs.lstatSync(file);
  if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1) throw new Error('Backup contains a linked or non-regular file.');
  return info;
}

export async function inspectRuntimeBackup(directory, expectedManifestHash) {
  const root = path.resolve(directory);
  if (path.basename(root).startsWith('INCOMPLETE-')) throw new Error('Incomplete backup cannot be verified.');
  for (let dir = root; ; dir = path.dirname(dir)) {
    const info = fs.lstatSync(dir);
    if (!info.isDirectory() || info.isSymbolicLink()) throw new Error('Backup directory ancestry must be free of links.');
    if (path.dirname(dir) === dir) break;
  }
  const manifestFile = path.join(root, 'manifest.json');
  const manifestInfo = regularFile(manifestFile);
  if (manifestInfo.size > manifestLimit) throw new Error('Backup manifest exceeds size limit.');
  const raw = fs.readFileSync(manifestFile);
  const manifestSha256 = crypto.createHash('sha256').update(raw).digest('hex');
  if (expectedManifestHash !== undefined && (!sha256.test(expectedManifestHash) || manifestSha256 !== expectedManifestHash)) {
    throw new Error('Backup manifest hash mismatch.');
  }
  const manifest = JSON.parse(raw.toString('utf8'));
  if (manifest?.format !== 1 || !Array.isArray(manifest.files) || !manifest.files.length || manifest.files.length > entryLimit) {
    throw new Error('Invalid backup manifest.');
  }
  const remaining = new Map();
  const folded = new Set();
  for (const entry of manifest.files) {
    const parts = typeof entry?.path === 'string' ? entry.path.split('/') : [];
    const allowedRoot = parts.length === 1 ? rootFiles.has(parts[0]) : rootDirectories.has(parts[0]);
    if (!allowedRoot || parts.length > 64 || !parts.every(safePart) || !Number.isSafeInteger(entry.bytes) || entry.bytes < 0
      || typeof entry.sha256 !== 'string' || !sha256.test(entry.sha256) || folded.has(entry.path.toLowerCase())) {
      throw new Error('Unsafe or duplicate backup manifest entry.');
    }
    remaining.set(entry.path, entry);
    folded.add(entry.path.toLowerCase());
  }
  let visited = 0;
  let bytes = 0;
  async function walk(dir, prefix = '', depth = 0) {
    if (depth >= 64) throw new Error('Backup directory depth exceeds limit.');
    for await (const child of await fs.promises.opendir(dir)) {
      if (++visited > entryLimit || !safePart(child.name)) throw new Error('Backup inventory exceeds bounds or contains an unsafe name.');
      if (!prefix && child.name === 'manifest.json') continue;
      const relative = prefix + child.name;
      const file = path.join(dir, child.name);
      if (child.isSymbolicLink()) throw new Error('Backup contains a link.');
      if (child.isDirectory()) {
        if (!prefix && !rootDirectories.has(child.name)) throw new Error('Unexpected backup directory.');
        await walk(file, relative + '/', depth + 1);
        continue;
      }
      const entry = remaining.get(relative);
      if (!entry) throw new Error('Unexpected backup file.');
      if (regularFile(file).size !== entry.bytes) throw new Error('Backup file size mismatch.');
      const digest = crypto.createHash('sha256');
      let size = 0;
      for await (const chunk of fs.createReadStream(file)) {
        size += chunk.length;
        if (size > entry.bytes) throw new Error('Backup file changed during verification.');
        digest.update(chunk);
      }
      if (size !== entry.bytes || digest.digest('hex') !== entry.sha256) throw new Error('Backup file hash mismatch.');
      bytes += size;
      remaining.delete(relative);
    }
  }
  await walk(root);
  if (remaining.size) throw new Error('Backup is missing manifest files.');
  if (!fs.readFileSync(manifestFile).equals(raw)) throw new Error('Backup manifest changed during verification.');
  return { entries: manifest.files.map(({ path, bytes, sha256 }) => ({ path, bytes, sha256 })), bytes, manifestSha256 };
}

export async function verifyRuntimeBackup(directory, expectedManifestHash) {
  const { entries, bytes, manifestSha256 } = await inspectRuntimeBackup(directory, expectedManifestHash);
  return { files: entries.length, bytes, manifestSha256 };
}
