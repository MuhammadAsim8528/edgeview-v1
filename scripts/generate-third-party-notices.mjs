import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { collectLicenseTexts } from './collect-license-texts.mjs';

const MAX_OUTPUT_BYTES = 32 * 1024 * 1024;
const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '../..');
const LIMITATION = 'Mechanical capture of installed license files only; not legal clearance, not a complete set of third-party terms.';
const CAPTURE_REASON = {
  'NO ROOT LICENSE TEXT': 'no license or notice file at the package root',
  'NOT INSTALLED': 'locked version absent from the installed tree',
  'VERSION/NAME MISMATCH': 'installed name or version differs from the lock',
};
const byCodePoint = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/** Deterministic notices document bound to one lock digest; captures text, never grants clearance. */
export function renderThirdPartyNotices(collection, { lockSha256, application } = {}) {
  if (collection?.format !== 1 || !Array.isArray(collection.components)) throw new Error('Expected a format-1 license capture.');
  if (!/^[0-9a-f]{64}$/.test(String(lockSha256))) throw new Error('Notices must be bound to a 64-hex lock digest.');
  if (!/^[^\u0000-\u001f@]+@[^\u0000-\u001f@]+$/.test(String(application))) throw new Error('Notices must name the application as name@version.');
  if (typeof collection.counts?.lockEntries !== 'number' || typeof collection.counts.bytes !== 'number') throw new Error('License capture counts are missing.');
  const captured = [], unresolved = [];
  for (const component of collection.components) {
    if (typeof component?.name !== 'string' || typeof component?.version !== 'string') throw new Error('Captured component is missing a name or version.');
    if (typeof component.capture !== 'string' || !component.capture) throw new Error('Captured component is missing a capture state.');
    if (!/^node_modules(?:\/[^\u0000-\u001f\\:*?"<>|]+)+$/u.test(component.location ?? '')) throw new Error('Captured component location is not a repository-relative package path.');
    if (typeof component.license !== 'string' && component.license !== null) throw new Error('Captured component license metadata is not printable.');
    if (component.capture !== 'TEXT CAPTURED') { unresolved.push(component); continue; }
    if (!Array.isArray(component.files) || !component.files.length) throw new Error('Captured component claims text without files.');
    for (const file of component.files) {
      if (typeof file?.name !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(file.name)) throw new Error('Captured license file needs a printable root-level name.');
      if (typeof file.text !== 'string' || !Number.isInteger(file.bytes) || file.bytes < 0 || !/^[0-9a-f]{64}$/.test(String(file.sha256))) throw new Error('Captured license file is missing text, size or digest.');
    }
    captured.push(component);
  }
  // One lock entry per install location, so an identical version can arrive repeatedly.
  const groups = new Map();
  for (const component of captured) {
    const files = [...component.files].sort((a, b) => byCodePoint(a.name, b.name));
    const key = `${component.name}@${component.version}|${files.map(file => `${file.name}:${file.sha256}`).sort(byCodePoint).join(',')}`;
    const group = groups.get(key) ?? { name: component.name, version: component.version, license: component.license, files, locations: [] };
    group.locations.push(component.location);
    groups.set(key, group);
  }
  const listed = [...groups.values()].sort((a, b) => byCodePoint(`${a.name}@${a.version}`, `${b.name}@${b.version}`));
  const missingMetadata = listed.filter(item => !item.license).map(item => `${item.name}@${item.version}`);
  const lines = [
    '# Third-party license notices',
    '',
    `Application: ${application}`,
    `package-lock.json SHA-256: ${lockSha256}`,
    `Locked production entries: ${collection.counts.lockEntries}`,
    `Distinct packages with full text: ${listed.length}`,
    `Captured install locations collapsed into them: ${captured.length}`,
    `Captured license/notice files: ${listed.reduce((sum, item) => sum + item.files.length, 0)}`,
    `Captured text bytes: ${collection.counts.bytes}`,
    `Install locations without text: ${collection.counts.notInstalled} absent, ${collection.counts.mismatch} mismatched, ${collection.counts.noRootText} without a root license file`,
    '',
    'Status: NOT VERIFIED',
    '',
    'This bundle is a mechanical capture of the license and notice files that were',
    'present in the installed package directories when it was built. It is not legal',
    'advice, not a compliance review and not an approval of any package or license.',
    'A captured file proves only that the file existed at the recorded location; it',
    "does not prove those terms govern the software, that the publisher's declared",
    'license was satisfied, or that nothing else inside the package carries further',
    'obligations. The counts above are incomplete captures, not a complete set of',
    'third-party terms.',
    '',
    'Digests are SHA-256 of the file bytes as recorded by the collector. The document',
    'is deterministic for identical inputs: it carries no build timestamp, no absolute',
    'host paths, no registry URLs and no credentials.',
    '',
  ];
  if (missingMetadata.length) {
    lines.push('## Captured text with no declared license metadata', '',
      'These packages declare no license string in their lock entry, so the captured',
      'text below is the only term evidence available and needs manual reading.',
      '', ...missingMetadata.map(name => `- ${name}`), '');
  }
  if (unresolved.length) {
    const reasons = new Map();
    for (const component of unresolved) {
      const reason = CAPTURE_REASON[component.capture] ?? `unrecognised capture state: ${component.capture}`;
      const entry = `${component.name}@${component.version} (${component.license || 'no declared license metadata'})`;
      if (!reasons.has(reason)) reasons.set(reason, new Set());
      reasons.get(reason).add(entry);
    }
    lines.push('## Not captured - terms not published here', '',
      'Every package below is in the production lock but has no license text in this',
      'bundle. The bundle is incomplete while this section is non-empty.',
      '');
    for (const reason of [...reasons.keys()].sort(byCodePoint)) {
      lines.push(`### ${reason}`, '', ...[...reasons.get(reason)].sort(byCodePoint).map(entry => `- ${entry}`), '');
    }
  }
  lines.push('## Captured license and notice texts', '');
  for (const item of listed) {
    lines.push(`### ${item.name}@${item.version}`, '',
      `Declared license metadata: ${item.license || 'NONE'}`,
      `Installed at: ${[...new Set(item.locations)].sort(byCodePoint).join(', ')}`,
      `Files: ${item.files.map(file => `${file.name} (${file.bytes} bytes, sha256 ${file.sha256})`).join('; ')}`,
      '');
    for (const file of item.files) {
      lines.push(`----- BEGIN ${item.name}@${item.version} ${file.name} -----`, file.text.trimEnd(), `----- END ${item.name}@${item.version} ${file.name} -----`, '');
    }
  }
  return `${lines.join('\n')}\n`;
}

/** Write atomically outside the repository tree so a generated bundle cannot go stale beside the source. */
export function writeNoticesBundle(destination, document, { repoRoot = REPO_ROOT } = {}) {
  if (typeof document !== 'string' || !document) throw new Error('Notices document is empty.');
  if (Buffer.byteLength(document) > MAX_OUTPUT_BYTES) throw new Error('Notices document exceeds the size bound.');
  if (typeof destination !== 'string' || !destination) throw new Error('An explicit destination is required.');
  const dest = path.resolve(destination);
  const parent = path.dirname(dest);
  if (!fs.existsSync(parent) || !fs.statSync(parent).isDirectory()) throw new Error('The destination directory must already exist.');
  if (fs.existsSync(dest) && fs.lstatSync(dest).isSymbolicLink()) throw new Error('The destination must not be a link.');
  const samePath = (a, b) => (process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b);
  if (!samePath(fs.realpathSync(parent), parent)) throw new Error('The destination path must not run through a link or junction.');
  const within = (child, container) => {
    const trim = value => (process.platform === 'win32' ? value.toLowerCase() : value).replace(/[\\/]+$/u, '');
    return trim(child) === trim(container) || trim(child).startsWith(`${trim(container)}${path.sep}`);
  };
  if (within(fs.realpathSync(parent), fs.realpathSync(repoRoot))) throw new Error('The destination must be outside the repository tree.');
  const temporary = path.join(parent, `.${path.basename(dest)}.${process.pid}.tmp`);
  if (fs.existsSync(temporary)) throw new Error('A concurrent notices write already holds this destination.');
  try {
    fs.writeFileSync(temporary, Buffer.from(document, 'utf8'));
    if (fs.statSync(temporary).size !== Buffer.byteLength(document)) throw new Error('Notices changed during write.');
    fs.renameSync(temporary, dest);
  } catch (error) {
    if (fs.existsSync(temporary)) fs.rmSync(temporary, { force: true });
    throw error;
  }
  return dest;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let written = null;
  try {
    const [installedRoot, ...flags] = process.argv.slice(2);
    const valueOf = (flag) => { const index = flags.indexOf(flag); if (index === -1) return null; const value = flags[index + 1]; if (!value || value.startsWith('--')) throw new Error(`${flag} needs a value.`); return value; };
    const destination = valueOf('--out');
    if (!installedRoot || installedRoot.startsWith('--') || !destination) throw new Error('Usage: node scripts/generate-third-party-notices.mjs <installed-root> --out <path> [--lock <package-lock.json>] [--manifest <package.json>].');
    const lockBytes = fs.readFileSync(valueOf('--lock') ?? path.join(REPO_ROOT, 'package-lock.json'));
    const lockSha256 = crypto.createHash('sha256').update(lockBytes).digest('hex');
    const manifest = JSON.parse(fs.readFileSync(valueOf('--manifest') ?? path.join(REPO_ROOT, 'package.json')));
    if (typeof manifest.name !== 'string' || typeof manifest.version !== 'string') throw new Error('Application identity is missing a name or version.');
    const collection = collectLicenseTexts(JSON.parse(lockBytes), installedRoot, { includeText: true });
    const document = renderThirdPartyNotices(collection, { lockSha256, application: `${manifest.name}@${manifest.version}` });
    written = writeNoticesBundle(destination, document);
    console.log(JSON.stringify({ status: collection.status, written, lockSha256, counts: collection.counts, limitation: LIMITATION }, null, 2));
  } catch (error) {
    if (!written) console.error(`Notices bundle not written (no third-party approval inferred): ${error?.message ?? error}`);
    process.exitCode = 1;
  }
}
