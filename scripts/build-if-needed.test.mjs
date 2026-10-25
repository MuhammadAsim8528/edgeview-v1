import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { artifactDigest, buildId, sourceDigest } from '../shared/build_identity.mjs';

const launcher = path.resolve('scripts/build-if-needed.mjs').replace(/\\/g, '/');
const metadata = path.resolve('scripts/build-metadata.mjs').replace(/\\/g, '/');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'edgeview-build-needed-'));
let caseId = 0;

const write = (base, name, content) => {
  const target = path.join(base, name);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
};

// The package's own build command, replaced per case. It writes the two artifacts the identity
// requires, then certifies them, which is what `npm run build` does for a real EdgeView tree.
const BUILD_STEP = `node write-dist.cjs && node "${metadata}"`;
const buildScript = (name) => `node ${name}.cjs`;

function stage(label, build = BUILD_STEP) {
  const base = path.join(root, `${++caseId}-${label}`);
  fs.mkdirSync(base, { recursive: true });
  write(base, 'package.json', `${JSON.stringify({ name: 'edgeview', version: '1.0.0', scripts: { build } }, null, 2)}\n`);
  write(base, 'write-dist.cjs', "const fs=require('fs');fs.mkdirSync('dist',{recursive:true});fs.writeFileSync('dist/server.cjs','server artifact');fs.writeFileSync('dist/index.html','<html>ok</html>');\n");
  write(base, 'noop.cjs', 'require(\'fs\').writeFileSync(\'hollow-build-ran.txt\',\'the build command reported success\');process.exit(0);\n');
  write(base, 'fail.cjs', "process.exit(3);\n");
  write(base, 'write-new-dist.cjs', "const fs=require('fs');fs.mkdirSync('dist',{recursive:true});fs.writeFileSync('dist/server.cjs','rebuilt server');fs.writeFileSync('dist/index.html','<html>rebuilt</html>');fs.writeFileSync('dist/rogue.cjs','left behind by a build that failed after certifying');\n");
  write(base, 'index.html', '<html>shell</html>');
  write(base, 'server.ts', 'export const server = 1;');
  write(base, 'src/App.tsx', 'export const App = 1;');
  write(base, 'shared/contract.ts', 'export const contract = 1;');
  write(base, 'docs/notes.md', 'developer notes, not a build input');
  return base;
}

const setBuild = (base, name) => {
  const manifest = JSON.parse(fs.readFileSync(path.join(base, 'package.json'), 'utf8'));
  fs.writeFileSync(path.join(base, 'package.json'), JSON.stringify({ ...manifest, scripts: { build: buildScript(name) } }, null, 2));
};

const run = (base) => spawnSync(process.execPath, [launcher], { cwd: base, encoding: 'utf8', timeout: 120000 });
const leftovers = (base) => fs.readdirSync(base).filter(name => name.startsWith('.edgeview-build-backup-'));

function buildOnce(base) {
  const first = run(base);
  assert.equal(first.status, 0, `the first build must succeed: ${first.stdout}${first.stderr}`);
  assert.match(first.stdout, /rebuilding/, 'a tree with no build must rebuild');
  assert.match(first.stdout, /> node write-dist\.cjs/, 'the build output is streamed to whoever launched it, not swallowed');
  assert.equal(leftovers(base).length, 0, 'a successful rebuild must not leave a backup directory behind');
  const second = run(base);
  assert.equal(second.status, 0, second.stderr);
  assert.match(second.stdout, /up to date/, 'the tree just built is recognised as current');
  return base;
}

try {
  // 1. a complete, certified build is reused; the rebuild is only triggered by build inputs
  const reused = buildOnce(stage('reused'));
  assert.match(run(reused).stdout, /up to date/, 'a current build is reused repeatedly');

  // 2. every predicate that marks a build stale has to force a rebuild on its own
  const versionOnly = buildOnce(stage('version-predicate'));
  const infoFile = path.join(versionOnly, 'dist', 'build-info.json');
  const certified = JSON.parse(fs.readFileSync(infoFile, 'utf8'));
  fs.writeFileSync(infoFile, JSON.stringify({ ...certified, version: '9.9.9', buildId: buildId('9.9.9', certified.sourceHash, certified.artifactHash) }));
  assert.match(run(versionOnly).stdout, /rebuilding/, 'a build certified for another app version is stale');

  const artifactOnly = buildOnce(stage('artifact-predicate'));
  fs.writeFileSync(path.join(artifactOnly, 'dist', 'index.html'), '<html>edited by hand</html>');
  assert.match(run(artifactOnly).stdout, /rebuilding/, 'an artifact edited outside the build is stale');

  const missingOutput = buildOnce(stage('missing-output'));
  fs.rmSync(path.join(missingOutput, 'dist', 'server.cjs'));
  assert.match(run(missingOutput).stdout, /rebuilding/, 'a deleted artifact is stale even when the identity file is intact');

  const corruptIdentity = buildOnce(stage('corrupt-identity'));
  fs.writeFileSync(path.join(corruptIdentity, 'dist', 'build-info.json'), '{"format":1,"version":"1.0.0"');
  assert.match(run(corruptIdentity).stdout, /rebuilding/, 'an unreadable identity file must rebuild rather than crash');

  const sourceChanged = buildOnce(stage('source-predicate'));
  write(sourceChanged, 'shared/contract.ts', 'export const contract = 2;');
  fs.utimesSync(path.join(sourceChanged, 'shared', 'contract.ts'), new Date(0), new Date(0));
  assert.match(run(sourceChanged).stdout, /rebuilding/, 'staleness follows content, not modification times');

  // 3. paths the identity deliberately ignores must not burn a rebuild
  const ignored = buildOnce(stage('ignored-paths'));
  write(ignored, 'docs/notes.md', 'developer notes changed after the build');
  write(ignored, 'src/.env', 'SECRET=not-a-build-input');
  write(ignored, 'server/tests/contract.test.ts', 'export const test = 1;');
  const ignoredRun = run(ignored);
  assert.equal(ignoredRun.status, 0, ignoredRun.stderr);
  assert.match(ignoredRun.stdout, /up to date/, 'documents, env files and server tests are not build inputs');

  // 4. a build command that exits successfully but leaves the tree stale is a failure
  const hollow = buildOnce(stage('hollow-success'));
  setBuild(hollow, 'noop');
  fs.writeFileSync(path.join(hollow, 'dist', 'index.html'), '<html>the last good artifact</html>');
  const hollowBefore = fs.readFileSync(path.join(hollow, 'dist', 'server.cjs'), 'utf8');
  fs.rmSync(path.join(hollow, 'dist', 'build-info.json'));
  const hollowRun = run(hollow);
  assert.ok(fs.existsSync(path.join(hollow, 'hollow-build-ran.txt')), 'the hollow build command did run and reported success');
  assert.notEqual(hollowRun.status, 0, 'a build that does not produce a current tree must not report success');
  assert.match(hollowRun.stderr, /previous build was restored/, 'the operator keeps the last complete build');
  assert.equal(fs.readFileSync(path.join(hollow, 'dist', 'index.html'), 'utf8'), '<html>the last good artifact</html>');
  assert.equal(fs.readFileSync(path.join(hollow, 'dist', 'server.cjs'), 'utf8'), hollowBefore);
  assert.equal(leftovers(hollow).length, 0, 'the rollback must clean up its own backup directory');

  // 5. a failing build with nothing to roll back to still reports the build command's status
  const cold = stage('failing-cold');
  setBuild(cold, 'fail');
  const coldRun = run(cold);
  assert.equal(coldRun.status, 3, 'the build command status is passed through when there is no previous build');
  assert.equal(leftovers(cold).length, 0, 'no backup directory is created when dist did not exist');
  assert.doesNotMatch(`${coldRun.stdout}${coldRun.stderr}`, /ENOENT|EPERM|TypeError/, 'the no-previous-build path must not crash');

  // 6. an artifact deleted by hand and re-certified with matching hashes is still refused
  const recertified = buildOnce(stage('re-certified'));
  fs.rmSync(path.join(recertified, 'dist', 'index.html'));
  const forged = { format: 1, name: 'edgeview', version: '1.0.0', sourceHash: sourceDigest(recertified),
    artifactHash: artifactDigest(recertified), builtAt: new Date().toISOString(), gitCommit: null };
  forged.buildId = buildId(forged.version, forged.sourceHash, forged.artifactHash);
  fs.writeFileSync(path.join(recertified, 'dist', 'build-info.json'), JSON.stringify(forged));
  assert.match(run(recertified).stdout, /rebuilding/, 'a complete artifact set is required, not only a self-consistent identity');

  // 7. a build that certifies a new tree and then fails is still a failure worth rolling back
  const lateFailure = buildOnce(stage('certified-then-failed'));
  fs.writeFileSync(path.join(lateFailure, 'package.json'), JSON.stringify({ name: 'edgeview', version: '1.0.0',
    scripts: { build: `node write-new-dist.cjs && node "${metadata}" && node fail.cjs` } }, null, 2));
  const lateRun = run(lateFailure);
  assert.equal(lateRun.status, 3, `a build that fails after certifying must report the failure: ${lateRun.stdout}${lateRun.stderr}`);
  assert.match(lateRun.stderr, /previous build was restored/);
  assert.equal(fs.readFileSync(path.join(lateFailure, 'dist', 'index.html'), 'utf8'), '<html>ok</html>', 'the last good artifact wins over a failed build');
  assert.equal(fs.existsSync(path.join(lateFailure, 'dist', 'rogue.cjs')), false, 'the rollback removes files the failed build added');
  assert.equal(leftovers(lateFailure).length, 0, 'the rollback must clean up its own backup directory');

  // 8. a tree whose manifest cannot be parsed is never reported as current
  const brokenManifest = buildOnce(stage('broken-manifest'));
  fs.writeFileSync(path.join(brokenManifest, 'package.json'), '{"name":"edgeview","version"');
  const brokenRun = run(brokenManifest);
  assert.notEqual(brokenRun.status, 0, 'an unparseable manifest must not be treated as an up-to-date build');
  assert.match(brokenRun.stdout, /rebuilding/, 'the staleness check swallows the unreadable manifest and rebuilds instead of crashing');
  assert.equal(leftovers(brokenManifest).length, 0, 'a failed recovery must still clean up its backup');

  // 9. rebuilding a tree that already has a build must retire its own backup on success
  const incremental = buildOnce(stage('incremental'));
  write(incremental, 'src/App.tsx', 'export const App = 2;');
  const rebuild = run(incremental);
  assert.equal(rebuild.status, 0, `a rebuild over an existing build must succeed: ${rebuild.stdout}${rebuild.stderr}`);
  assert.match(rebuild.stdout, /rebuilding/, 'changed source over an existing build triggers the rebuild path');
  assert.equal(leftovers(incremental).length, 0, 'a successful rebuild over an existing build must retire its backup');
  assert.match(run(incremental).stdout, /up to date/, 'the rebuilt tree is current');

  console.log('PASS the launcher rebuilds for a stale version, tampered, missing or hand-recertified artifacts, an unreadable identity or manifest and changed build inputs; reuses a current build; ignores documents, env files and server tests; streams the build output; retires its backup on every success path; and rolls back any build that fails, including one that certifies a tree before failing');
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
