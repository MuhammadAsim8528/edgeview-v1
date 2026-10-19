import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'edgeview-package-preservation-'));
const project = path.join(root,'project','work'); fs.mkdirSync(project, { recursive: true });
const outputs = path.join(root,'outputs');
const stage = path.join(outputs,'EdgeView-V1-Windows'); fs.mkdirSync(stage, { recursive: true });
const zip = path.join(outputs,'EdgeView-V1-Windows.zip');
const original = 'prior release';
fs.writeFileSync(path.join(stage,'README.md'), original);
fs.writeFileSync(path.join(stage,'PACKAGE_MANIFEST.json'), JSON.stringify({ format: 1, files: [{ path: 'README.md', bytes: Buffer.byteLength(original), sha256: crypto.createHash('sha256').update(original).digest('hex') }] }));
fs.writeFileSync(zip, original);
const script = path.resolve('scripts/package-windows.mjs');
try {
  const run = () => spawnSync(process.execPath, [script], { cwd: project, encoding: 'utf8' });
  fs.writeFileSync(path.join(stage,'config.json'), '{"synthetic_private_data":true}');
  const withData = run();
  assert.notEqual(withData.status, 0); assert.match(withData.stderr, /Unexpected package file/);
  assert.ok(fs.existsSync(path.join(stage,'config.json')));
  assert.equal(fs.readFileSync(zip,'utf8'), original);
  fs.unlinkSync(path.join(stage,'config.json'));
  fs.writeFileSync(path.join(stage,'README.md'), 'operator edited this file');
  const edited = run();
  assert.notEqual(edited.status, 0); assert.match(edited.stderr, /integrity mismatch/);
  assert.equal(fs.readFileSync(path.join(stage,'README.md'),'utf8'), 'operator edited this file');
  fs.writeFileSync(path.join(stage,'README.md'), original);
  const failedBuild = run(); // This fixture intentionally has no source/assets.
  assert.notEqual(failedBuild.status, 0);
  assert.equal(fs.readFileSync(path.join(stage,'README.md'),'utf8'), original);
  assert.equal(fs.readFileSync(zip,'utf8'), original, 'copy/archive failure must preserve the previous ZIP');
  assert.equal(fs.readdirSync(outputs).some(name => name.startsWith('.edgeview-package-')), false);
  console.log('PASS packaging preserves runtime data, operator edits and previous artifacts on build failure.');
} finally { fs.rmSync(root, { recursive: true, force: true }); }
