import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function verifyPackage(directory, { rejectUnexpected = false } = {}) {
const root = path.resolve(directory);
if (fs.lstatSync(root).isSymbolicLink()) throw new Error('Package root must not be a link.');
const manifestPath = path.join(root, 'PACKAGE_MANIFEST.json');
if (!fs.existsSync(manifestPath)) throw new Error(`Package manifest not found at ${manifestPath}`);
if (fs.lstatSync(manifestPath).isSymbolicLink()) throw new Error('Package manifest must not be a link.');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
if (manifest?.format !== 1 || !Array.isArray(manifest.files)) throw new Error('Unsupported package manifest format.');
const expected = new Set(['PACKAGE_MANIFEST.json']);
for (const entry of manifest.files) {
  if (!entry || typeof entry.path !== 'string' || entry.path.includes('..') || path.isAbsolute(entry.path)) throw new Error('Unsafe package manifest path.');
  const file = path.resolve(root, entry.path);
  if (!file.startsWith(`${root}${path.sep}`) || !fs.existsSync(file)) throw new Error(`Missing package file: ${entry.path}`);
  if (!fs.lstatSync(file).isFile() || fs.lstatSync(file).isSymbolicLink()) throw new Error(`Package entry must be a regular file: ${entry.path}`);
  expected.add(entry.path.replace(/\\/g,'/'));
  const bytes = fs.readFileSync(file);
  const digest = crypto.createHash('sha256').update(bytes).digest('hex');
  if (bytes.length !== entry.bytes || digest !== entry.sha256) throw new Error(`Package integrity mismatch: ${entry.path}`);
}
if (rejectUnexpected) {
  const walk = (directory, relative = '') => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const name = relative ? `${relative}/${entry.name}` : entry.name;
      if (entry.isSymbolicLink()) throw new Error(`Unexpected package link: ${name}`);
      if (entry.isDirectory()) {
        if (![...expected].some(file => file.startsWith(`${name}/`))) throw new Error(`Unexpected package directory: ${name}. Preserve this runnable folder before rebuilding.`);
        walk(path.join(directory, entry.name), name);
      }
      else if (!expected.has(name)) throw new Error(`Unexpected package file: ${name}. Preserve this runnable folder before rebuilding.`);
    }
  };
  walk(root);
}
return { verified: true, root, files: manifest.files.length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(verifyPackage(process.argv[2] || process.cwd(), { rejectUnexpected: true })));
}
