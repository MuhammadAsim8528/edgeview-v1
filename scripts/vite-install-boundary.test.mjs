import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = name => JSON.parse(fs.readFileSync(new URL(`../${name}`, import.meta.url), 'utf8'));
const manifest = read('package.json');
const lock = read('package-lock.json');
const installed = read('node_modules/vite/package.json');
assert.equal(manifest.dependencies.vite, '^6.4.4', 'minimum must exclude the vulnerable Vite 6 releases');
assert.equal(lock.packages[''].dependencies.vite, manifest.dependencies.vite);
assert.equal(installed.version, lock.packages['node_modules/vite'].version, 'npm metadata alone is not installed-byte version evidence');
const [major, minor, patch] = installed.version.split('.').map(Number);
assert.ok(major === 6 && (minor > 4 || (minor === 4 && patch >= 4)), 'installed Vite must include the upstream security patch within Vite 6');
console.log(`PASS manifest, lock and installed Vite ${installed.version} security baseline agree (not an exploit execution test)`);
