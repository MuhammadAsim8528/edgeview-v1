import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { licenseInventory } from './release-license-inventory.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MAX_BYTES = 32 * 1024 * 1024;

function readBoundedRegularFile(file, label) {
  if (fs.lstatSync(file).isSymbolicLink()) throw new Error(`${label} must not be a link.`);
  const bytes = fs.readFileSync(file);
  if (bytes.length > MAX_BYTES) throw new Error(`${label} exceeds the size bound.`);
  return bytes;
}

/**
 * Compares a published SBOM against what the current lockfile allows. npm emits
 * one component per package identity and prunes dev-only subtrees, while a lock
 * has one entry per install location including platform variants, so a document
 * holding fewer entries than the lock is not drift. Only a component the lock no
 * longer permits, or a version the lock does not contain, makes it stale.
 */
export function verifySbomCurrency(lockBytes, bomBytes, manifestBytes) {
  const lock = JSON.parse(lockBytes);
  const bom = JSON.parse(bomBytes);
  const manifest = JSON.parse(manifestBytes);
  if (typeof manifest.name !== 'string' || typeof manifest.version !== 'string') throw new Error('Package manifest needs a name and version.');
  if (bom.bomFormat !== 'CycloneDX' || !Array.isArray(bom.components)) throw new Error('Expected a CycloneDX JSON document with a components array.');
  const inventory = licenseInventory(lock);
  const allowed = new Map();
  for (const component of inventory.components) {
    if (!allowed.has(component.name)) allowed.set(component.name, new Set());
    allowed.get(component.name).add(component.version);
  }
  const absentFromLock = [];
  const versionDrift = [];
  for (const component of bom.components) {
    if (typeof component?.name !== 'string' || typeof component?.version !== 'string') throw new Error('SBOM component is missing a name or version.');
    const versions = allowed.get(component.name);
    if (!versions) { absentFromLock.push(`${component.name}@${component.version}`); continue; }
    if (!versions.has(component.version)) versionDrift.push({ name: component.name, sbom: component.version, lock: [...versions].sort() });
  }
  const declared = bom.metadata?.component ?? {};
  const application = {
    purl: declared.purl ?? null,
    expectedPurl: `pkg:npm/${manifest.name}@${manifest.version}`,
    version: declared.version ?? null,
    expectedVersion: manifest.version,
  };
  const applicationIdentity = application.purl !== application.expectedPurl || application.version !== application.expectedVersion;
  const stale = applicationIdentity || absentFromLock.length > 0 || versionDrift.length > 0;
  return {
    format: 1,
    status: stale ? 'STALE' : 'PASS',
    specVersion: bom.specVersion ?? null,
    lockSha256: crypto.createHash('sha256').update(lockBytes).digest('hex'),
    counts: { sbomComponents: bom.components.length, lockNames: allowed.size, lockEntries: licenseInventory(lock).components.length },
    application,
    drift: { applicationIdentity, absentFromLock: absentFromLock.sort(), versionDrift: versionDrift.sort((a, b) => a.name.localeCompare(b.name)) },
    limitation: 'Checks that every documented component is still permitted by the current lock bytes and that the document names this version. It does not prove the document is complete, that it was produced by a trusted runner, that it describes installed or bundled bytes, or that any release may proceed.',
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const sbomPath = process.argv[2];
    if (!sbomPath) throw new Error('Usage: node scripts/verify-sbom-current.mjs <sbom.cdx.json> [--lock <package-lock.json>] [--manifest <package.json>]');
    const named = name => { const at = process.argv.indexOf(name); return at > 0 ? process.argv[at + 1] : null; };
    const report = verifySbomCurrency(
      readBoundedRegularFile(path.resolve(named('--lock') || path.join(root, 'package-lock.json')), 'Lockfile'),
      readBoundedRegularFile(path.resolve(sbomPath), 'SBOM'),
      readBoundedRegularFile(path.resolve(named('--manifest') || path.join(root, 'package.json')), 'Package manifest'),
    );
    console.log(JSON.stringify(report, null, 2));
    if (report.status !== 'PASS') process.exitCode = 1;
  } catch (error) {
    console.error(`SBOM currency check rejected: ${error.message || 'invalid document'}`);
    process.exitCode = 1;
  }
}
