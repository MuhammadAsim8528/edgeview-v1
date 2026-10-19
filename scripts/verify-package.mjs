import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] || process.cwd());
const manifestPath = path.join(root, 'PACKAGE_MANIFEST.json');
if (!fs.existsSync(manifestPath)) throw new Error(`Package manifest not found at ${manifestPath}`);
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
if (manifest?.format !== 1 || !Array.isArray(manifest.files)) throw new Error('Unsupported package manifest format.');
for (const entry of manifest.files) {
  if (!entry || typeof entry.path !== 'string' || entry.path.includes('..') || path.isAbsolute(entry.path)) throw new Error('Unsafe package manifest path.');
  const file = path.resolve(root, entry.path);
  if (!file.startsWith(`${root}${path.sep}`) || !fs.existsSync(file)) throw new Error(`Missing package file: ${entry.path}`);
  const bytes = fs.readFileSync(file);
  const digest = crypto.createHash('sha256').update(bytes).digest('hex');
  if (bytes.length !== entry.bytes || digest !== entry.sha256) throw new Error(`Package integrity mismatch: ${entry.path}`);
}
console.log(JSON.stringify({ verified: true, root, files: manifest.files.length }));
