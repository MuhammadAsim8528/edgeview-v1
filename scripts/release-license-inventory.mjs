import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

/** Metadata inventory, not legal clearance or a substitute for license texts. */
export function licenseInventory(lock) {
  if (lock?.lockfileVersion !== 3 || !lock.packages || !lock.packages['']) throw new Error('Expected npm v3 lockfile with root package.');
  const components = Object.entries(lock.packages).filter(([location, item]) => location && !item.dev).map(([location, item]) => {
    if (!location.includes('node_modules/') || typeof item.version !== 'string') throw new Error('Invalid production lock entry.');
    const name = item.name || location.slice(location.lastIndexOf('node_modules/') + 'node_modules/'.length);
    const license = typeof item.license === 'string' && item.license.trim() ? item.license.trim() : null;
    const review = !license ? 'MISSING_METADATA' : /\b(?:AGPL|GPL|LGPL|MPL|EPL|CDDL)(?:-|\b)/i.test(license) ? 'COPYLEFT_REVIEW' : 'METADATA_ONLY';
    return { name, version: item.version, location, license, optional: item.optional === true, review };
  }).sort((a, b) => a.location.localeCompare(b.location));
  return {
    format: 1, package: { name: lock.name, version: lock.version },
    scope: 'npm production lock entries including optional/platform variants; not installed or bundled bytes',
    status: components.some(item => item.review !== 'METADATA_ONLY') ? 'WARN' : 'NOT VERIFIED',
    limitation: 'License strings are publisher metadata, not verified license texts, attribution, SPDX validation or legal approval. METADATA_ONLY is not PASS.',
    counts: { components: components.length, missing: components.filter(item => item.review === 'MISSING_METADATA').length, copyleftReview: components.filter(item => item.review === 'COPYLEFT_REVIEW').length },
    components,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const bytes = fs.readFileSync(new URL('../package-lock.json', import.meta.url));
  const report = { ...licenseInventory(JSON.parse(bytes)), lockSha256: crypto.createHash('sha256').update(bytes).digest('hex') };
  // stdout only; workflow/operator chooses an explicit non-customer destination.
  console.log(JSON.stringify(report, null, 2));
}
