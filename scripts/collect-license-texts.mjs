import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { licenseInventory } from './release-license-inventory.mjs';
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const legalName = /^(?:licen[cs]e|copying|notice)(?:[._-][a-z0-9._-]+)?$/i;
function safeFile(root, relative) {
  if (typeof relative !== 'string' || /[\\:\u0000-\u001f]/u.test(relative) || relative.split('/').some(item => !item || item === '..' || item === '.')) throw new Error('Invalid package path.');
  let current = root;
  for (const item of relative.split('/')) {
    current = path.join(current, item);
    if (!fs.existsSync(current)) return null;
    if (fs.lstatSync(current).isSymbolicLink()) throw new Error('Linked package files require separate review.');
  }
  return current;
}
/** Capture installed license texts only for exact locked package versions. */
export function collectLicenseTexts(lock, installedRoot, { includeText = false } = {}) {
  const inventory = licenseInventory(lock);
  const root = fs.realpathSync(installedRoot);
  let total = 0;
  const components = inventory.components.map(component => {
    if (!component.location.startsWith('node_modules/')) throw new Error('Invalid dependency location.');
    const manifest = safeFile(root, `${component.location}/package.json`);
    if (!manifest) return { ...component, capture: 'NOT INSTALLED', files: [] };
    if (fs.statSync(manifest).size > 1024 * 1024) throw new Error('Package metadata exceeds bound.');
    const metadata = fs.readFileSync(manifest);
    const installed = JSON.parse(metadata);
    if (installed.version !== component.version || installed.name !== component.name) return { ...component, capture: 'VERSION/NAME MISMATCH', files: [] };
    const directory = path.dirname(manifest);
    const files = fs.readdirSync(directory, { withFileTypes: true }).filter(item => legalName.test(item.name)).map(item => {
      const target = safeFile(root, `${component.location}/${item.name}`);
      if (!target || !fs.statSync(target).isFile()) throw new Error('Unsupported license entry.');
      const size = fs.statSync(target).size;
      if (size > 1024 * 1024 || total + size > 8 * 1024 * 1024) throw new Error('License text collection exceeds bound.');
      const bytes = fs.readFileSync(target); total += bytes.length;
      if (bytes.length !== size) throw new Error('License changed during capture.');
      return { name: item.name, bytes: bytes.length, sha256: digest(bytes), ...(includeText ? { text: bytes.toString('utf8') } : {}) };
    });
    if (!fs.readFileSync(manifest).equals(metadata)) throw new Error('Package changed during capture.');
    return { ...component, capture: files.length ? 'TEXT CAPTURED' : 'NO ROOT LICENSE TEXT', packageManifestSha256: digest(metadata), files };
  });
  return { format: 1, status: 'NOT VERIFIED', scope: 'Exact-version installed root license/notice files only; not legal clearance or bundled-runtime inventory',
    counts: { lockEntries: components.length, textCaptured: components.filter(item => item.capture === 'TEXT CAPTURED').length, notInstalled: components.filter(item => item.capture === 'NOT INSTALLED').length, mismatch: components.filter(item => item.capture === 'VERSION/NAME MISMATCH').length, noRootText: components.filter(item => item.capture === 'NO ROOT LICENSE TEXT').length, bytes: total }, components };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (!process.argv[2]) throw new Error('Installed root required.');
    const lockBytes = fs.readFileSync(new URL('../package-lock.json', import.meta.url));
    const report = collectLicenseTexts(JSON.parse(lockBytes), process.argv[2], { includeText: process.argv.includes('--texts') });
    console.log(JSON.stringify({ ...report, lockSha256: digest(lockBytes) }, null, 2));
  } catch {
    console.error('License collection unavailable: unsafe/missing/changing files or invalid metadata. No license approval inferred.');
    process.exitCode = 1;
  }
}
