import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { verifyPackage } from './verify-package.mjs';

const sha = (text) => crypto.createHash('sha256').update(text).digest('hex');
const manifestFor = (files) => ({ format: 1, files: Object.entries(files).map(([entryPath, content]) => ({ path: entryPath, bytes: Buffer.byteLength(content), sha256: sha(content) })) });
const writePair = (base, name, content) => { const target = path.join(base, name.replace(/[\\/]/g, path.sep)); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, content); };
const writeManifest = (base, listed) => fs.writeFileSync(path.join(base, 'PACKAGE_MANIFEST.json'), `${JSON.stringify(listed, null, 2)}\n`, 'utf8');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'edgeview-verify-package-'));
let caseId = 0;
const nextDir = (label) => path.join(root, `${++caseId}-${label}`);

// Creating a real file symlink needs developer mode, which the verifying host may not grant. When it is
// unavailable the guards that read lstat are still pinned by reporting the target as a link, so the
// assertion covers the verifier's decision; the real-symlink case below covers the filesystem path.
const stubLstat = (matcher, linkFlags, run) => {
  const real = fs.lstatSync;
  fs.lstatSync = (...args) => {
    const stats = real.apply(fs, args);
    if (!matcher(String(args[0]))) return stats;
    return new Proxy(stats, { get: (t, p) => (linkFlags[p] !== undefined ? () => linkFlags[p] : Reflect.get(t, p)) });
  };
  try { return run(); } finally { fs.lstatSync = real; }
};
const stubLink = (matcher, run) => stubLstat(matcher, { isSymbolicLink: true, isFile: false }, run);

// A package directory whose manifest honestly describes it, plus optional unlisted extras.
function stage(files, { manifest = undefined, extra = {} } = {}) {
  const base = nextDir('package');
  fs.mkdirSync(base, { recursive: true });
  for (const [name, content] of Object.entries(files)) writePair(base, name, content);
  writeManifest(base, manifest ?? manifestFor(files));
  for (const [name, content] of Object.entries(extra)) writePair(base, name, content);
  return base;
}

const sample = { 'package.json': '{"name":"edgeview"}', 'dist/server.cjs': 'console.log(1);', 'src/App.tsx': 'export const App = 1;' };
const win32 = process.platform === 'win32';
const linkProbe = { junction: false, file: false };
const tryLink = (target, link, kind) => { try { fs.symlinkSync(target, link, kind); linkProbe[kind] = true; return true; } catch { return false; } };

try {
  // 1. an honestly described package verifies in both modes
  const clean = stage(sample);
  assert.deepEqual(verifyPackage(clean), { verified: true, root: clean, files: 3 });
  assert.deepEqual(verifyPackage(clean, { rejectUnexpected: true }), { verified: true, root: clean, files: 3 });

  // 2. byte-level tampering is caught by the digest or the recorded length
  for (const [index, [label, mutate]] of [['appended byte', text => `${text}x`], ['truncated file', text => text.slice(0, -1)], ['flipped content', () => 'export const App = 2;']].entries()) {
    const key = index === 2 ? 'src/App.tsx' : 'dist/server.cjs';
    // The manifest still honestly describes the original bytes; only the file changed.
    const tampered = stage({ ...sample, [key]: mutate(sample[key]) }, { manifest: manifestFor(sample) });
    assert.throws(() => verifyPackage(tampered), /Package integrity mismatch: /, `a ${label} must fail integrity`);
    assert.throws(() => verifyPackage(tampered, { rejectUnexpected: true }), /Package integrity mismatch: /, `a ${label} must fail strict mode too`);
  }

  // 3. a listed file that is simply gone, and a manifest that honestly hashes but wrongly measures it
  assert.throws(() => verifyPackage(stage(sample, { manifest: { format: 1, files: [...manifestFor(sample).files, { path: 'dist/missing.cjs', bytes: 1, sha256: sha('x') }] } })), /Missing package file: dist\/missing\.cjs/);
  const wrongLength = { ...manifestFor(sample), files: manifestFor(sample).files.map(entry => entry.path === 'src/App.tsx' ? { ...entry, bytes: entry.bytes + 1 } : entry) };
  assert.throws(() => verifyPackage(stage(sample, { manifest: wrongLength })), /Package integrity mismatch: src\/App\.tsx/, 'a correct digest with a wrong byte count is still refused');

  // 4. unlisted content is tolerated by the runtime mode and refused by the strict mode
  const extraDirectory = stage(sample, { extra: { 'scratch/note.txt': 'left behind' } });
  assert.equal(verifyPackage(extraDirectory).verified, true, 'the runtime mode is content integrity only');
  assert.throws(() => verifyPackage(extraDirectory, { rejectUnexpected: true }), /Unexpected package directory: scratch/, 'strict mode refuses an unknown directory');
  const extraFile = stage(sample, { extra: { 'surprise.txt': 'surprise' } });
  assert.throws(() => verifyPackage(extraFile, { rejectUnexpected: true }), /Unexpected package file: surprise\.txt/);

  // 4b. the strict walk descends into listed directories, so an extra file cannot hide inside one
  const nestedFile = stage(sample, { extra: { 'dist/surprise.cjs': 'surprise' } });
  assert.equal(verifyPackage(nestedFile).verified, true, 'the runtime mode never looks for extras');
  assert.throws(() => verifyPackage(nestedFile, { rejectUnexpected: true }), /Unexpected package file: dist\/surprise\.cjs/, 'the walk reports the nested relative name');
  const nestedExtra = stage(sample, { extra: { 'dist/deep/surprise.cjs': 'surprise' } });
  assert.throws(() => verifyPackage(nestedExtra, { rejectUnexpected: true }), /Unexpected package directory: dist\/deep/, 'an unlisted directory below a listed one is refused at the first unknown node');

  // 4c. an unlisted directory only counts as known when a listed file lives under it, not merely beside it
  const prefixDirectory = stage(sample, {});
  fs.mkdirSync(path.join(prefixDirectory, 'dis'));
  assert.throws(() => verifyPackage(prefixDirectory, { rejectUnexpected: true }), /Unexpected package directory: dis/, 'an empty directory named as a prefix of a listed path is refused');

  // 5. hostile or malformed manifest paths are refused before anything is read
  const hostilePaths = ['../outside.txt', 'dist/../../escape.txt', '/etc/passwd', ...(win32 ? ['C:\\Windows\\win.ini', '\\\\server\\share\\x.txt'] : [])];
  for (const bad of hostilePaths) {
    const hostile = stage({ 'package.json': sample['package.json'] }, { manifest: { format: 1, files: [{ path: bad, bytes: 1, sha256: sha('x') }] } });
    assert.throws(() => verifyPackage(hostile), /Unsafe package manifest path/, `${bad} must be refused as a manifest path`);
  }
  // A path that is not a string never reaches the filesystem checks.
  for (const bad of [{ path: 42 }, { path: null }, {}, { path: ['dist', 'server.cjs'] }]) {
    const hostile = stage({ 'package.json': sample['package.json'] }, { manifest: { format: 1, files: [bad] } });
    assert.throws(() => verifyPackage(hostile), /Unsafe package manifest path/, `a non-string manifest path ${JSON.stringify(bad)} must be refused`);
  }
  // 5b. a self-referential entry resolves onto the package root, which the containment check refuses as absent
  for (const self of ['.', './', '']) {
    const selfEntry = stage({ 'package.json': sample['package.json'] }, { manifest: { format: 1, files: [{ path: self, bytes: 1, sha256: sha('x') }] } });
    assert.throws(() => verifyPackage(selfEntry), /Missing package file/, `a self-referential manifest entry ${JSON.stringify(self)} is refused as absent, not opened`);
  }
  for (const broken of [{ files: [{ path: 'package.json', bytes: 1, sha256: sha('x') }] }, { format: 2, files: [] }, { format: 1 }, { format: 1, files: 'nope' }]) {
    const malformed = stage({ 'package.json': sample['package.json'] }, { manifest: broken });
    assert.throws(() => verifyPackage(malformed), /Unsupported package manifest format/, `a malformed manifest ${JSON.stringify(broken).slice(0, 40)} must be refused`);
  }
  assert.throws(() => verifyPackage(stage({ 'package.json': sample['package.json'] }, { manifest: { format: 1, files: [null] } })), /Unsafe package manifest path/, 'a null entry must be refused');
  const noManifest = nextDir('no-manifest');
  fs.mkdirSync(noManifest, { recursive: true });
  assert.throws(() => verifyPackage(noManifest), /Package manifest not found/);

  // 6. digest equality is exact, so a re-cased manifest is not the generated manifest
  const upperCased = stage(sample, { manifest: { format: 1, files: Object.entries(sample).map(([p, c]) => ({ path: p, bytes: Buffer.byteLength(c), sha256: sha(c).toUpperCase() })) } });
  assert.throws(() => verifyPackage(upperCased), /Package integrity mismatch/, 'digest comparison stays byte-exact rather than case-folded');

  // 7. an empty file list verifies a manifest-only tree and still refuses extras
  const manifestOnly = stage({}, { manifest: { format: 1, files: [] } });
  assert.deepEqual(verifyPackage(manifestOnly, { rejectUnexpected: true }), { verified: true, root: manifestOnly, files: 0 });
  fs.writeFileSync(path.join(manifestOnly, 'extra.txt'), 'x');
  assert.throws(() => verifyPackage(manifestOnly, { rejectUnexpected: true }), /Unexpected package file: extra\.txt/, 'an empty list still refuses extra files');

  // 8. manifest separators are normalised, so a backslash entry is not double-reported (win32 only)
  if (win32) {
    const backslashManifest = stage(sample, { manifest: { format: 1, files: Object.entries(sample).map(([p, c]) => ({ path: p.replace(/\//g, '\\'), bytes: Buffer.byteLength(c), sha256: sha(c) })) } });
    assert.deepEqual(verifyPackage(backslashManifest, { rejectUnexpected: true }), { verified: true, root: backslashManifest, files: 3 }, 'manifest separators are normalised before the walk');
  }

  // 9. links are refused at the root, in the tree, for the manifest and for every entry
  const realPackage = stage(sample, {});
  if (tryLink(realPackage, path.join(root, 'root-junction'), 'junction')) {
    assert.throws(() => verifyPackage(path.join(root, 'root-junction')), /Package root must not be a link/);
  }
  const junctionDir = nextDir('junction');
  fs.mkdirSync(junctionDir, { recursive: true });
  writePair(junctionDir, 'package.json', sample['package.json']);
  writePair(junctionDir, 'src/App.tsx', sample['src/App.tsx']);
  writeManifest(junctionDir, manifestFor(sample));
  if (tryLink(path.join(realPackage, 'dist'), path.join(junctionDir, 'dist'), 'junction')) {
    assert.throws(() => verifyPackage(junctionDir, { rejectUnexpected: true }), /Unexpected package link: dist/, 'a junction inside the tree is refused in strict mode');
    assert.equal(verifyPackage(junctionDir).verified, true, 'without the strict walk a junctioned directory still digests clean');
  }
  const linkManifestDir = nextDir('link-manifest');
  fs.mkdirSync(linkManifestDir, { recursive: true });
  if (tryLink(path.join(realPackage, 'PACKAGE_MANIFEST.json'), path.join(linkManifestDir, 'PACKAGE_MANIFEST.json'), 'file')) {
    assert.throws(() => verifyPackage(linkManifestDir), /Package manifest must not be a link/);
  }
  const outside = path.join(root, 'outside-regular.txt');
  fs.writeFileSync(outside, 'console.log(1);');
  // A manifest that lists a directory instead of a file is refused without needing symlink privileges.
  const directoryEntry = stage(sample, { manifest: { format: 1, files: [{ path: 'dist', bytes: 1, sha256: sha('x') }] } });
  assert.throws(() => verifyPackage(directoryEntry), /Package entry must be a regular file: dist/, 'a directory cannot satisfy a manifest entry');
  const linkedFileDir = stage(sample, {});
  fs.rmSync(path.join(linkedFileDir, 'dist', 'server.cjs'));
  if (tryLink(outside, path.join(linkedFileDir, 'dist', 'server.cjs'), 'file')) {
    assert.throws(() => verifyPackage(linkedFileDir), /Package entry must be a regular file: dist\/server\.cjs/, 'a symlinked entry cannot impersonate a listed file');
  }
  // The same decision when the host will not let the test create a file symlink.
  assert.throws(() => stubLink(p => p.endsWith('PACKAGE_MANIFEST.json'), () => verifyPackage(clean)), /Package manifest must not be a link/, 'a manifest reported as a link is refused before it is parsed');
  assert.throws(() => stubLink(p => p.endsWith(path.join('dist', 'server.cjs')), () => verifyPackage(clean)), /Package entry must be a regular file: dist\/server\.cjs/, 'an entry reported as a link is refused even when its bytes would digest');
  // A reparse point can be flagged as a link and a regular file at once; the link flag alone must refuse it.
  assert.throws(() => stubLstat(p => p.endsWith(path.join('dist', 'server.cjs')), { isSymbolicLink: true, isFile: true }, () => verifyPackage(clean)), /Package entry must be a regular file: dist\/server\.cjs/, 'the isSymbolicLink clause alone still refuses a link that also looks like a file');
  assert.equal(stubLink(p => p.endsWith('nothing-here'), () => verifyPackage(clean)).verified, true, 'the stub is scoped: an untouched lstat still verifies');
  console.log(`link probe: junction=${linkProbe.junction} file-symlink=${linkProbe.file} platform=${process.platform}`);

  // 10. documented limit: a manifest is integrity, not authenticity. Rewriting a file and its digest
  // together verifies; only a signature over the manifest would detect that.
  const republished = stage({ ...sample, 'dist/server.cjs': 'console.log("backdoor");' });
  assert.equal(verifyPackage(republished, { rejectUnexpected: true }).verified, true, 'a self-consistent tampered manifest still verifies - signing is out of scope here');

  // 11. the command an operator runs
  const cli = spawnSync(process.execPath, [path.resolve('scripts/verify-package.mjs'), clean], { encoding: 'utf8' });
  assert.equal(cli.status, 0, cli.stderr);
  assert.ok(cli.stdout.trim().startsWith('{'), 'the CLI must print a JSON verdict on stdout');
  assert.deepEqual(JSON.parse(cli.stdout), { verified: true, root: clean, files: 3 });
  const cliStrict = spawnSync(process.execPath, [path.resolve('scripts/verify-package.mjs'), extraFile], { encoding: 'utf8' });
  assert.notEqual(cliStrict.status, 0, 'the CLI must run in strict mode');
  assert.match(cliStrict.stderr, /Unexpected package file: surprise\.txt/);
  const cliDefault = spawnSync(process.execPath, [path.resolve('scripts/verify-package.mjs')], { encoding: 'utf8', cwd: noManifest });
  assert.notEqual(cliDefault.status, 0, 'with no argument the CLI verifies the working directory and must fail there');
  assert.match(cliDefault.stderr, /Package manifest not found/);
  // A relative argument is resolved against the working directory and reported as an absolute root.
  const relativeRun = spawnSync(process.execPath, [path.resolve('scripts/verify-package.mjs'), path.relative(root, clean)], { encoding: 'utf8', cwd: root });
  assert.equal(relativeRun.status, 0, relativeRun.stderr);
  assert.equal(JSON.parse(relativeRun.stdout).verified, true, 'the CLI verifies a package addressed relatively');
  assert.equal(path.isAbsolute(JSON.parse(relativeRun.stdout).root), true, 'the verifier reports an absolute root even for a relative argument');

  console.log('PASS the shipped integrity verifier refuses byte tampering and wrong lengths, missing/linked/directory entries, hostile, non-string and malformed manifest paths, unlisted content at any depth in strict mode, and normalises separators; the CLI stays strict and resolves relative paths');
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
