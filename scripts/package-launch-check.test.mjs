import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { verifyPackage } from './verify-package.mjs';
import { systemTar } from './system-tar.mjs';

const root = path.resolve(process.argv[2] || '../../outputs/EdgeView-V1-Windows');
verifyPackage(root, { rejectUnexpected: true });
assert.ok(fs.existsSync(path.join(root,'server.ts')), 'source entrypoint must be available for future rebuilds');
assert.ok(fs.existsSync(path.join(root,'shared/v1_contact_contract.ts')));
assert.ok(fs.existsSync(path.join(root,'scripts/ensure-dependencies.mjs')), 'launcher dependency repair helper must ship');
const check = directory => {
  const checked = spawnSync(process.execPath, ['scripts/build-if-needed.mjs'], { cwd: directory, encoding: 'utf8', timeout: 15000 });
  assert.equal(checked.status, 0, checked.stderr);
  assert.match(checked.stdout, /up to date/, 'a fresh prebuilt package must not attempt a redundant rebuild');
  verifyPackage(directory, { rejectUnexpected: true });
};
check(root);
const extracted = fs.mkdtempSync(path.join(os.tmpdir(), 'edgeview-zip-launch-check-'));
try {
  const zip = path.join(path.dirname(root),'EdgeView-V1-Windows.zip');
  const extraction = spawnSync(systemTar(), ['-xf',zip,'-C',extracted], { encoding: 'utf8' });
  assert.equal(extraction.status, 0, extraction.stderr);
  const unpacked = path.join(extracted,'EdgeView-V1-Windows');
  verifyPackage(unpacked, { rejectUnexpected: true });
  check(unpacked);
} finally { fs.rmSync(extracted, { recursive: true, force: true }); }
console.log('PASS staged and ZIP-extracted packages retain build inputs and pass unchanged launch checks.');
