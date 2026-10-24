import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { verifySbomCurrency } from './verify-sbom-current.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = { name: 'edgeview', version: '1.0.0' };
const lock = { lockfileVersion: 3, name: 'edgeview', version: '1.0.0', packages: {
  '': {},
  'node_modules/a': { version: '1', license: 'MIT', resolved: 'https://user:secret@registry.test/a.tgz' },
  'node_modules/a/node_modules/b': { version: '2', license: 'MIT' },
  'node_modules/@scope/c': { version: '3', license: 'MIT' },
  'node_modules/tw': { version: '7', license: 'MIT' },
  'node_modules/holder/node_modules/tw': { version: '8', license: 'MIT' },
  'node_modules/tool': { version: '4', dev: true, license: 'MIT' },
  'node_modules/platform-only': { version: '5', optional: true, license: 'MIT' },
} };
const component = (name, version) => ({ name, version, purl: `pkg:npm/${name.replace('@', '%40')}@${version}` });
const bomFor = (components, application = { version: manifest.version }) => ({
  bomFormat: 'CycloneDX', specVersion: '1.5',
  metadata: { component: { type: 'application', name: 'edgeview', version: application.version, purl: application.purl ?? `pkg:npm/edgeview@${application.version}` } },
  components,
});
const full = () => bomFor([component('a', '1'), component('b', '2'), component('@scope/c', '3'), component('tw', '7'), component('tw', '8'), component('platform-only', '5')]);
const check = (bom, lockBytes = lock, app = manifest) => verifySbomCurrency(JSON.stringify(lockBytes), JSON.stringify(bom), JSON.stringify(app));

const pass = check(full());
assert.equal(pass.status, 'PASS');
assert.deepEqual(pass.drift, { applicationIdentity: false, absentFromLock: [], versionDrift: [] });
assert.equal(pass.lockSha256, crypto.createHash('sha256').update(JSON.stringify(lock)).digest('hex'));
assert.deepEqual(pass.counts, { sbomComponents: 6, lockNames: 5, lockEntries: 6 }, 'two locked versions of one name are one name');
assert.equal(pass.specVersion, '1.5');
assert.ok(!JSON.stringify(pass).includes('secret'), 'registry credentials must never enter the currency report');
assert.ok(!JSON.stringify(pass).includes('tool'), 'the report must not echo dev-only lock entries');

// npm prunes dev-only subtrees and emits one entry per identity, so a document
// holding fewer packages than the lock is normal, not drift.
const partial = check(bomFor([component('a', '1')]));
assert.equal(partial.status, 'PASS', 'under-representation is npm scope, not a stale document');
assert.deepEqual(partial.counts, { sbomComponents: 1, lockNames: 5, lockEntries: 6 }, 'component counts must describe the document, not the lock');
assert.ok(partial.counts.lockEntries > partial.counts.sbomComponents);
assert.deepEqual(partial.drift.versionDrift, []);

const versionMoved = check(bomFor([component('a', '1.0.1'), component('b', '2'), component('@scope/c', '3'), component('tw', '7'), component('tw', '8'), component('platform-only', '5')]));
assert.equal(versionMoved.status, 'STALE', 'a version the lock does not contain is drift');
assert.deepEqual(versionMoved.drift.versionDrift, [{ name: 'a', sbom: '1.0.1', lock: ['1'] }]);
assert.deepEqual(versionMoved.drift.absentFromLock, []);

// Both locked copies of a duplicated name are permitted; an unstamped third is not.
assert.equal(check(bomFor([component('tw', '8')])).status, 'PASS');
assert.deepEqual(check(bomFor([component('tw', '9')])).drift.versionDrift, [{ name: 'tw', sbom: '9', lock: ['7', '8'] }]);

const dropped = check(bomFor([component('a', '1'), component('b', '2'), component('tw', '7'), component('tw', '8'), component('platform-only', '5')]));
assert.deepEqual(dropped.drift.versionDrift, [], 'removing a component cannot create version drift');
assert.equal(dropped.status, 'PASS', 'scoped components may be absent without making the document stale');

const renamed = check(bomFor([component('a', '1'), component('gone', '9')]));
assert.equal(renamed.status, 'STALE', 'a component the lock no longer has must fail');
assert.deepEqual(renamed.drift.absentFromLock, ['gone@9']);
assert.deepEqual(renamed.drift.versionDrift, []);

const devOnly = check(bomFor([component('a', '1'), component('tool', '4')]));
assert.equal(devOnly.status, 'STALE', 'a dev-only package must never appear in a production document');
assert.deepEqual(devOnly.drift.absentFromLock, ['tool@4']);

const candidate = check(full(), lock, { ...manifest, version: '1.0.0-rc.2' });
assert.equal(candidate.status, 'STALE', 'an SBOM stamped 1.0.0 must not certify a 1.0.0-rc.2 release');
assert.equal(candidate.drift.applicationIdentity, true);
assert.equal(candidate.application.expectedPurl, 'pkg:npm/edgeview@1.0.0-rc.2');
assert.deepEqual(candidate.drift.versionDrift, [], 'identity drift is reported separately from component drift');

// The purl and the version field can disagree with each other; only the version
// comparison catches a document whose purl is right and whose stamp is wrong.
const inconsistent = check(bomFor([component('a', '1')], { version: '1.0.0', purl: 'pkg:npm/edgeview@1.0.0-rc.2' }), lock, { ...manifest, version: '1.0.0-rc.2' });
assert.equal(inconsistent.status, 'STALE', 'a declared version disagreeing with the manifest is drift even when the purl matches');
assert.equal(inconsistent.drift.applicationIdentity, true);
assert.equal(inconsistent.application.version, '1.0.0');
assert.equal(inconsistent.application.expectedVersion, '1.0.0-rc.2');
assert.deepEqual(inconsistent.drift.versionDrift, []);

const mismatchedPurl = check(bomFor([component('a', '1')], { version: '1.0.0', purl: 'pkg:npm/edgeview@9.9.9' }));
assert.equal(mismatchedPurl.status, 'STALE', 'a purl that disagrees with the manifest version is drift');
assert.equal(mismatchedPurl.drift.applicationIdentity, true);

const anonymous = check({ ...full(), metadata: {} });
assert.equal(anonymous.status, 'STALE');
assert.equal(anonymous.application.purl, null);
assert.equal(anonymous.drift.applicationIdentity, true);

assert.throws(() => check({ bomFormat: 'SPDX', components: [] }));
assert.throws(() => check({ bomFormat: 'CycloneDX' }));
assert.throws(() => check(bomFor([{ name: 'a' }])));
assert.throws(() => check(bomFor([{ version: '1' }])));
assert.throws(() => check(full(), { lockfileVersion: 2, packages: {} }));
assert.throws(() => check(full(), lock, { name: 'edgeview' }));

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'edgeview-sbom-currency-'));
try {
  const write = (name, value) => { const file = path.join(directory, name); fs.writeFileSync(file, value); return file; };
  const staleFile = write('stale.cdx.json', JSON.stringify(bomFor([component('a', '4'), component('b', '2'), component('@scope/c', '3'), component('tw', '7'), component('tw', '8'), component('platform-only', '5')])));
  const passFile = write('current.cdx.json', JSON.stringify(full()));
  const lockFile = write('package-lock.json', JSON.stringify(lock));
  const manifestFile = write('package.json', JSON.stringify(manifest));
  const cli = (args, expectStatus) => {
    const run = spawnSync(process.execPath, ['scripts/verify-sbom-current.mjs', ...args], { cwd: repoRoot, encoding: 'utf8' });
    if (expectStatus !== undefined) assert.equal(run.status, expectStatus, `${run.stdout}${run.stderr}`);
    return run;
  };
  const stale = cli([staleFile, '--lock', lockFile, '--manifest', manifestFile], 1);
  assert.match(stale.stdout, /"status": "STALE"/);
  assert.deepEqual(JSON.parse(stale.stdout).drift.versionDrift, [{ name: 'a', sbom: '4', lock: ['1'] }],
    'drift must name the component, the stale version and what the lock permits');
  cli([passFile, '--lock', lockFile, '--manifest', manifestFile], 0);
  const usage = cli([], 1);
  assert.match(usage.stderr, /Usage: node scripts\/verify-sbom-current\.mjs/);
  const missing = cli([path.join(directory, 'absent.cdx.json'), '--lock', lockFile, '--manifest', manifestFile], 1);
  assert.match(missing.stderr, /SBOM currency check rejected/);
  const linked = path.join(directory, 'linked.cdx.json');
  let linkMade = false;
  try { fs.symlinkSync(passFile, linked); linkMade = true; } catch { /* links need developer mode on Windows */ }
  if (linkMade) {
    const rejected = cli([linked, '--lock', lockFile, '--manifest', manifestFile], 1);
    assert.match(rejected.stderr, /must not be a link/, 'a linked SBOM is not release evidence');
  }
  const synthetic = cli([passFile], 1);
  assert.equal(JSON.parse(synthetic.stdout).status, 'STALE', 'a synthetic document must not pass against the repository lock');
  assert.ok(JSON.parse(synthetic.stdout).drift.absentFromLock.length > 0, 'the real-lock comparison must report components the lock does not permit');
} finally { fs.rmSync(directory, { recursive: true, force: true }); }
console.log('PASS SBOM currency check flags replaced/unknown/dev-only components and app-version drift, ignores npm scope, refuses links and never leaks registry credentials');
