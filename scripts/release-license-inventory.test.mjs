import assert from 'node:assert/strict';
import { licenseInventory } from './release-license-inventory.mjs';
const lock = { lockfileVersion: 3, name: 'edgeview', version: '1.0.0', packages: {
  '': {}, 'node_modules/public': { version: '1', license: 'MIT', resolved: 'https://secret:token@example.test/a' },
  'node_modules/dev': { version: '2', dev: true, license: 'GPL-3.0-only' },
  'node_modules/@scope/optional': { version: '3', optional: true, license: 'MPL-2.0' },
  'node_modules/a/node_modules/b': { version: '4' },
  'node_modules/dual': { version: '5', license: '(MIT OR GPL-2.0-only)' },
} };
const report = licenseInventory(lock);
assert.deepEqual(report.counts, { components: 4, missing: 1, copyleftReview: 2 });
assert.equal(report.status, 'WARN');
assert.equal(report.components.find(item => item.version === '3').name, '@scope/optional');
assert.equal(report.components.find(item => item.version === '4').name, 'b');
assert.ok(!JSON.stringify(report).includes('secret:token'), 'registry URLs/credentials must not enter release inventory');
assert.equal(licenseInventory({ ...lock, packages: { '': {}, 'node_modules/a': { version: '1', license: 'MIT' } } }).status, 'NOT VERIFIED', 'metadata cannot confer clearance');
for (const invalid of [{}, { lockfileVersion: 2, packages: { '': {} } }, { ...lock, packages: { '': {}, 'node_modules/bad': {} } }]) assert.throws(() => licenseInventory(invalid));
console.log('PASS production license inventory excludes dev/URLs, retains optional/transitive entries, flags unknown/copyleft and never grants clearance');
