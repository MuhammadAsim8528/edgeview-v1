import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { collectLicenseTexts } from './collect-license-texts.mjs';
import { renderThirdPartyNotices, writeNoticesBundle } from './generate-third-party-notices.mjs';

const script = fileURLToPath(new URL('./generate-third-party-notices.mjs', import.meta.url));
const DIGEST = crypto.createHash('sha256').update('seed').digest('hex');
const OTHER = crypto.createHash('sha256').update('other').digest('hex');
const OPTIONS = { lockSha256: DIGEST, application: 'edgeview@1.0.0' };
const file = (name, text, sha256 = DIGEST) => ({ name, bytes: Buffer.byteLength(text), sha256, text });
const entry = (name, version, capture, files = [], license = 'MIT', location = `node_modules/${name}`) => ({ name, version, location, license, optional: false, review: 'METADATA_ONLY', capture, files });
const captureOf = (components, counts = {}) => ({ format: 1, status: 'NOT VERIFIED', counts: { lockEntries: components.length, textCaptured: 0, notInstalled: 0, mismatch: 0, noRootText: 0, bytes: 0, ...counts }, components });
const render = (collection, options = OPTIONS) => renderThirdPartyNotices(collection, options);
const headings = document => [...document.matchAll(/^### (.+)$/gm)].map(match => match[1]);

const baseline = render(captureOf([
  entry('zeta', '2', 'TEXT CAPTURED', [file('NOTICE.md', 'zeta notice'), file('LICENSE', 'zeta license')]),
  entry('alpha', '1', 'TEXT CAPTURED', [file('LICENSE', 'alpha license')], null),
  entry('gone', '3', 'NOT INSTALLED', [], 'Apache-2.0'),
  entry('bare', '4', 'NO ROOT LICENSE TEXT', [], 'BSD-3-Clause'),
  entry('moved', '5', 'VERSION/NAME MISMATCH', [], 'GPL-3.0-only'),
], { lockEntries: 5, textCaptured: 2, notInstalled: 1, noRootText: 1, mismatch: 1, bytes: 40 }));
assert.deepEqual(headings(baseline), ['installed name or version differs from the lock', 'locked version absent from the installed tree', 'no license or notice file at the package root', 'alpha@1', 'zeta@2']);
assert.deepEqual([...baseline.matchAll(/^- ([a-z]+@\d+)/gm)].map(match => match[1]).sort(), ['alpha@1', 'bare@4', 'gone@3', 'moved@5'], 'every package without published text is listed exactly once');
assert.ok(baseline.includes('Status: NOT VERIFIED'));
assert.ok(baseline.includes('Locked production entries: 5') && baseline.includes('Captured text bytes: 40'));
assert.ok(baseline.includes('Captured license/notice files: 3'), 'file counts sum across packages');
assert.ok(baseline.includes('- alpha@1'), 'undeclared license metadata is listed for manual reading');
assert.ok(baseline.includes('Declared license metadata: NONE'), 'an undeclared license is never rendered as a guess');
assert.ok(baseline.includes('----- BEGIN zeta@2 LICENSE -----\nzeta license\n----- END zeta@2 LICENSE -----'), 'full text is emitted verbatim between markers');
assert.ok(baseline.includes('gone@3 (Apache-2.0)') && baseline.includes('bare@4 (BSD-3-Clause)') && baseline.includes('moved@5 (GPL-3.0-only)'));
assert.ok(!/legal clearance granted|approved for release|fully compliant/i.test(baseline), 'the bundle cannot read as clearance');
assert.ok(!/\b(?:cleared|approved|certified|warranted)\b/i.test(baseline), 'no clearance vocabulary may enter the bundle');
assert.ok(render(captureOf([entry('a', '1', 'TEXT CAPTURED', [file('LICENSE', 'x')], 'MIT')]), { lockSha256: DIGEST, application: 'edgeview@1.0.0-rc.2' }).includes('Status: NOT VERIFIED'), 'an upstream PASS must not be echoed as clearance');
assert.ok(render(captureOf([entry('u', '1', 'TELEPORTED')])).includes('unrecognised capture state: TELEPORTED'), 'an unknown capture state is surfaced, not dropped');

const duplicated = render(captureOf([
  entry('dup', '1', 'TEXT CAPTURED', [file('LICENSE', 'dup text')], 'MIT', 'node_modules/dup'),
  entry('dup', '1', 'TEXT CAPTURED', [file('LICENSE', 'dup text')], 'MIT', 'node_modules/a/node_modules/dup'),
  entry('forked', '2', 'TEXT CAPTURED', [file('LICENSE', 'variant one', DIGEST)], 'ISC', 'node_modules/forked'),
  entry('forked', '2', 'TEXT CAPTURED', [file('LICENSE', 'variant two', OTHER)], 'ISC', 'node_modules/b/node_modules/forked'),
], { lockEntries: 4, textCaptured: 4, bytes: 36 }));
assert.equal(headings(duplicated).filter(heading => heading === 'dup@1').length, 1, 'identical installs collapse to one notice');
assert.ok(duplicated.includes('Installed at: node_modules/a/node_modules/dup, node_modules/dup'), 'collapsed installs list every location');
assert.ok(duplicated.includes('Captured install locations collapsed into them: 4') && duplicated.includes('Distinct packages with full text: 3'));
assert.equal(headings(duplicated).filter(heading => heading === 'forked@2').length, 2, 'differing texts for one version are never merged');
assert.ok(duplicated.includes('variant one') && duplicated.includes('variant two'));

const twoVersions = render(captureOf([
  entry('same', '1.0', 'TEXT CAPTURED', [file('LICENSE', 'shared text')], 'MIT', 'node_modules/same'),
  entry('same', '2.0', 'TEXT CAPTURED', [file('LICENSE', 'shared text')], 'MIT', 'node_modules/host/node_modules/same'),
], { lockEntries: 2, textCaptured: 2, bytes: 22 }));
assert.deepEqual(headings(twoVersions), ['same@1.0', 'same@2.0'], 'distinct versions of one name are never merged');
assert.ok(twoVersions.includes('Distinct packages with full text: 2') && twoVersions.includes('Captured install locations collapsed into them: 2'));

const repeatedAbsence = render(captureOf([entry('x', '1', 'NOT INSTALLED', [], null), entry('x', '1', 'NOT INSTALLED', [], null)], { lockEntries: 2, notInstalled: 2 }));
assert.equal(repeatedAbsence.split('- x@1 (no declared license metadata)').length - 1, 1, 'absences are deduplicated');
assert.ok(render(captureOf([])).includes('Distinct packages with full text: 0'), 'an empty capture renders an explicit empty bundle');
const unsorted = render(captureOf([entry('zulu', '1', 'TEXT CAPTURED', [file('LICENSE', 'z')]), entry('Alpha', '1', 'TEXT CAPTURED', [file('LICENSE', 'a')]), entry('alpha', '1', 'TEXT CAPTURED', [file('LICENSE', 'b')])]));
assert.deepEqual(headings(unsorted), ['Alpha@1', 'alpha@1', 'zulu@1'], 'ordering is code-point, so a rebuild cannot reorder');
const fileOrder = render(captureOf([entry('multi', '1', 'TEXT CAPTURED', [file('NOTICE.txt', 'notice body'), file('LICENSE', 'license body'), file('COPYING', 'copying body')])]));
assert.deepEqual([...fileOrder.matchAll(/----- BEGIN multi@1 (\S+) -----/g)].map(match => match[1]), ['COPYING', 'LICENSE', 'NOTICE.txt'], 'files are emitted in code-point order whatever the capture order');
assert.ok(fileOrder.includes('Files: COPYING (12 bytes, sha256 ' + DIGEST + '); LICENSE (12 bytes, sha256 ' + DIGEST + '); NOTICE.txt (11 bytes, sha256 ' + DIGEST + ')'));
const trailing = render(captureOf([entry('tail', '1', 'TEXT CAPTURED', [file('LICENSE', 'text ending in blank lines\n\n')])]));
assert.ok(trailing.includes('----- BEGIN tail@1 LICENSE -----\ntext ending in blank lines\n----- END tail@1 LICENSE -----'), 'captured text keeps its body and gains no blank line before the end marker');

assert.throws(() => render({}, OPTIONS), /format-1 license capture/);
assert.throws(() => render({ format: 1 }, OPTIONS), /format-1 license capture/);
assert.throws(() => render({ format: 2, components: [], counts: { lockEntries: 0, bytes: 0 } }, OPTIONS), /format-1 license capture/);
assert.throws(() => render(captureOf([]), { lockSha256: OPTIONS.application }), /lock digest/);
assert.throws(() => render(captureOf([]), { lockSha256: 'f'.repeat(63), application: 'edgeview@1' }), /lock digest/);
assert.throws(() => render(captureOf([]), { lockSha256: DIGEST.toUpperCase(), application: 'edgeview@1' }), /lock digest/, 'uppercase digests are not bound');
assert.throws(() => render(captureOf([]), { lockSha256: DIGEST }), /name@version/);
assert.throws(() => render(captureOf([]), { lockSha256: DIGEST, application: 'edgeview' }), /name@version/);
assert.throws(() => render(captureOf([]), { lockSha256: DIGEST, application: 'edgeview@1\nStatus: PASS' }), /name@version/, 'a forged identity line cannot be injected');
assert.throws(() => render({ format: 1, components: [], counts: {} }, OPTIONS), /counts are missing/);
assert.throws(() => render(captureOf([{ version: '1', capture: 'TEXT CAPTURED', files: [] }]), OPTIONS), /name or version/);
assert.throws(() => render(captureOf([{ name: 'a', version: '1', files: [] }]), OPTIONS), /capture state/);
assert.throws(() => render(captureOf([entry('a', '1', 'TEXT CAPTURED', [])]), OPTIONS), /without files/);
assert.throws(() => render(captureOf([entry('a', '1', 'TEXT CAPTURED', [{ name: 'LICENSE', bytes: 4 }])]), OPTIONS), /text, size or digest/);
assert.throws(() => render(captureOf([entry('a', '1', 'TEXT CAPTURED', [{ name: 'LICENSE', bytes: 4, text: 'xxxxx', sha256: 'nope' }])]), OPTIONS), /text, size or digest/);
assert.throws(() => render(captureOf([entry('a', '1', 'TEXT CAPTURED', [{ name: 'LICENSE', bytes: 'four', text: 'x', sha256: DIGEST }])]), OPTIONS), /text, size or digest/);
assert.throws(() => render(captureOf([entry('a', '1', 'TEXT CAPTURED', [{ name: '../LICENSE', bytes: 1, text: 'x', sha256: DIGEST }])]), OPTIONS), /root-level name/);
assert.throws(() => render(captureOf([entry('a', '1', 'TEXT CAPTURED', [file('LICENSE', 'x')], 'MIT', 'C:\\Users\\victim\\node_modules\\a')]), OPTIONS), /location/);
assert.throws(() => render(captureOf([entry('a', '1', 'NOT INSTALLED', [], 'MIT', 'packages/a')]), OPTIONS), /location/);
assert.throws(() => render(captureOf([entry('a', '1', 'NOT INSTALLED', [], 'MIT', 'node_modules/a\u0000')]), OPTIONS), /location/);
assert.throws(() => render(captureOf([{ name: 'a', version: '1', location: 'node_modules/a', license: 7, capture: 'NOT INSTALLED' }]), OPTIONS), /license/);
assert.throws(() => render(captureOf([{ name: 'a', version: '1', location: 'node_modules/a', capture: 'NOT INSTALLED' }]), OPTIONS), /license/);

const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'edgeview-notices-test-')));
const out = path.join(root, 'out');
try {
  const lock = { lockfileVersion: 3, name: 'edgeview', version: '1.0.0', packages: {
    '': {},
    'node_modules/alpha': { version: '1', license: 'MIT', resolved: 'https://buyer:sekretT0ken@registry.test/alpha.tgz' },
    'node_modules/dup': { version: '2', license: 'BSD-2-Clause' },
    'node_modules/host/node_modules/dup': { version: '2', license: 'BSD-2-Clause' },
    'node_modules/nometadata': { version: '3' },
    'node_modules/silent': { version: '4', license: 'ISC' },
    'node_modules/platform-only': { version: '5', optional: true, license: 'Apache-2.0' },
    'node_modules/tool': { version: '6', dev: true, license: 'GPL-2.0-only' },
  } };
  const install = (relative, name, version, files = {}) => {
    const directory = path.join(root, 'node_modules', relative);
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, 'package.json'), JSON.stringify({ name, version }));
    fs.writeFileSync(path.join(directory, 'README.md'), 'NEVER_COPY_README_BODY');
    for (const [fileName, content] of Object.entries(files)) fs.writeFileSync(path.join(directory, fileName), content);
  };
  install('alpha', 'alpha', '1', { LICENSE: 'The MIT License (MIT)\n\nCopyright (c) 2020 Someone\n', NOTICE: 'Alpha attribution notice' });
  install('dup', 'dup', '2', { LICENSE: 'BSD dual clause text\n' });
  install('nometadata', 'nometadata', '3', { LICENSE: 'Creative Commons Attribution 4.0 legal code\n' });
  install('silent', 'silent', '4');
  install('host', 'host', '0');
  install('host/node_modules/dup', 'dup', '2', { LICENSE: 'BSD dual clause text\n' });

  const lockFile = path.join(root, 'package-lock.json');
  const manifestFile = path.join(root, 'package.json');
  fs.writeFileSync(lockFile, JSON.stringify(lock, null, 2));
  fs.writeFileSync(manifestFile, JSON.stringify({ name: 'edgeview', version: '1.0.0-rc.2' }));
  const lockSha256 = crypto.createHash('sha256').update(fs.readFileSync(lockFile)).digest('hex');

  const collected = collectLicenseTexts(lock, root, { includeText: true });
  const once = render(collected, { lockSha256, application: 'edgeview@1.0.0-rc.2' });
  assert.equal(collected.counts.lockEntries, 6);
  assert.equal(collected.counts.mismatch, 0, 'a nested install must be recorded under its own package name');
  assert.deepEqual([collected.counts.textCaptured, collected.counts.notInstalled, collected.counts.noRootText], [4, 1, 1]);
  assert.ok(once.includes('Captured install locations collapsed into them: 4') && once.includes('Distinct packages with full text: 3'), 'real nested duplicates collapse once');
  assert.equal(once, render(collectLicenseTexts(lock, root, { includeText: true }), { lockSha256, application: 'edgeview@1.0.0-rc.2' }), 'no clock or readdir order enters the bundle');
  assert.ok(once.includes('Copyright (c) 2020 Someone'), 'license text is published for attribution');
  assert.ok(once.includes('Alpha attribution notice'), 'NOTICE files are published beside the license');
  assert.ok(!once.includes('NEVER_COPY_README_BODY'), 'only license-shaped files are captured');
  assert.ok(!once.includes('sekretT0ken') && !once.includes('registry.test') && !once.includes('resolved'), 'registry URLs and credentials never enter the bundle');
  assert.ok(!once.includes(root) && !once.includes('Users'), 'the build machine path never enters the bundle');
  assert.ok(!once.includes('tool@6'), 'dev-only packages stay out of the production bundle');
  assert.ok(once.includes('platform-only@5 (Apache-2.0)'), 'optional platform variants are listed as uncaptured');
  assert.equal(headings(once).filter(heading => heading === 'dup@2').length, 1);
  assert.ok(once.includes('Installed at: node_modules/dup, node_modules/host/node_modules/dup'));
  assert.ok(once.includes('- nometadata@3') && once.includes('Declared license metadata: NONE'));
  assert.ok(once.includes('silent@4 (ISC)'));
  assert.ok(once.includes('package-lock.json SHA-256: ' + lockSha256), 'the bundle names the lock bytes it describes');
  assert.throws(() => render(collectLicenseTexts(lock, root), { lockSha256, application: 'edgeview@1' }), /text, size or digest/, 'a metadata-only capture cannot pass as a notices bundle');

  fs.mkdirSync(out);
  const written = writeNoticesBundle(path.join(out, 'THIRD_PARTY_NOTICES.md'), once);
  assert.equal(fs.readFileSync(written, 'utf8'), once);
  assert.deepEqual(fs.readdirSync(out), ['THIRD_PARTY_NOTICES.md'], 'no temporary file survives a successful write');
  assert.equal(writeNoticesBundle(path.join(out, 'THIRD_PARTY_NOTICES.md'), 'replacement'), path.join(out, 'THIRD_PARTY_NOTICES.md'), 'an existing bundle is replaced atomically');
  assert.equal(fs.readFileSync(path.join(out, 'THIRD_PARTY_NOTICES.md'), 'utf8'), 'replacement');
  assert.throws(() => writeNoticesBundle(path.join(out, 'THIRD_PARTY_NOTICES.md'), once, { repoRoot: root }), /outside the repository/);
  assert.throws(() => writeNoticesBundle(path.join(out, 'THIRD_PARTY_NOTICES.md'), ''), /empty/);
  assert.throws(() => writeNoticesBundle('', once), /explicit destination/);
  assert.throws(() => writeNoticesBundle(path.join(root, 'missing', 'N.md'), once), /already exist/);
  assert.throws(() => writeNoticesBundle(path.join(out, 'huge.md'), 'x'.repeat(33 * 1024 * 1024)), /size bound/);
  assert.ok(!fs.existsSync(path.join(out, 'huge.md')), 'an over-bound document is never written');
  fs.writeFileSync(path.join(out, `.huge.md.${process.pid}.tmp`), 'held');
  assert.throws(() => writeNoticesBundle(path.join(out, 'huge.md'), once), /concurrent/);
  assert.equal(fs.readFileSync(path.join(out, `.huge.md.${process.pid}.tmp`), 'utf8'), 'held', 'a foreign temporary file is left alone');
  assert.equal(fs.readdirSync(out).filter(name => name.endsWith('.tmp')).length, 1, 'a refused write leaves no extra temporary file');
  fs.rmSync(path.join(out, `.huge.md.${process.pid}.tmp`));
  const real = path.join(out, 'real');
  fs.mkdirSync(real);
  let junction = false;
  try { fs.symlinkSync(real, path.join(out, 'junction'), process.platform === 'win32' ? 'junction' : 'dir'); junction = true; } catch { junction = false; }
  if (junction) {
    assert.throws(() => writeNoticesBundle(path.join(out, 'junction', 'N.md'), once), /through a link/);
    assert.deepEqual(fs.readdirSync(real), [], 'a junction destination is never written through');
  }
  let linked = false;
  try { fs.symlinkSync(path.join(out, 'target.md'), path.join(out, 'link.md'), 'file'); linked = true; } catch { linked = false; }
  if (linked) {
    fs.writeFileSync(path.join(out, 'target.md'), 'held');
    assert.throws(() => writeNoticesBundle(path.join(out, 'link.md'), once), /must not be a link/);
    assert.equal(fs.readFileSync(path.join(out, 'target.md'), 'utf8'), 'held', 'a linked destination is never followed');
  }
  console.log(`destination link probe: junction=${junction} file-symlink=${linked}`);

  const cli = path.join(root, 'cli-out.md');
  const run = spawnSync(process.execPath, [script, root, '--lock', lockFile, '--manifest', manifestFile, '--out', cli], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  const summary = JSON.parse(run.stdout);
  assert.equal(summary.status, 'NOT VERIFIED');
  assert.equal(summary.lockSha256, lockSha256);
  assert.equal(summary.written, cli);
  assert.ok(!run.stdout.includes('MIT License'), 'stdout stays a summary; the texts go to the file');
  assert.equal(fs.readFileSync(cli, 'utf8'), once);
  const inside = path.join(path.resolve(import.meta.dirname), 'THIRD_PARTY_NOTICES.md');
  const refused = spawnSync(process.execPath, [script, root, '--lock', lockFile, '--manifest', manifestFile, '--out', inside], { encoding: 'utf8' });
  assert.equal(refused.status, 1, 'a repository destination is refused');
  assert.ok(!fs.existsSync(inside), 'the refused run leaves no file behind');
  for (const args of [[], ['--out'], [root], [root, '--out'], [root, '--out', path.join(root, 'missing', 'x.md')]]) {
    const bad = spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' });
    assert.equal(bad.status, 1, `${args.join(' ')} must fail closed`);
    assert.ok(/Usage|needs a value|not written/.test(bad.stderr), `${args.join(' ')}: ${bad.stderr}`);
    assert.ok(!bad.stdout.includes('MIT License'), 'a failed run prints no license body');
  }
  const wrongLock = path.join(root, 'broken-lock.json');
  fs.writeFileSync(wrongLock, JSON.stringify({ lockfileVersion: 2, packages: {} }));
  const broken = spawnSync(process.execPath, [script, root, '--lock', wrongLock, '--manifest', manifestFile, '--out', path.join(root, 'never.md')], { encoding: 'utf8' });
  assert.equal(broken.status, 1, 'an unparseable lock fails closed');
  assert.ok(broken.stderr.includes('not written') && !fs.existsSync(path.join(root, 'never.md')));
  console.log('PASS third-party notices bind to lock bytes, collapse installs without merging differing texts, publish only license-shaped text, list every uncaptured package, refuse clearance language, write atomically outside the repository and fail closed');
} finally { fs.rmSync(root, { recursive: true, force: true }); }
