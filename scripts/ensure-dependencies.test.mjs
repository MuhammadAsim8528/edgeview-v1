import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ensureDependencies } from './ensure-dependencies.mjs';
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'edgeview-install-recovery-'));
const marker = path.join(root, 'node_modules', '.edgeview-install.json');
let installs = 0;
const write = (name, value) => fs.writeFileSync(path.join(root, name), JSON.stringify(value));
const install = () => {
  installs++;
  fs.mkdirSync(path.join(root, 'node_modules', 'fixture'), { recursive: true });
  write('node_modules/fixture/package.json', { version: '1.0.0' });
  return { status: 0 };
};
try {
  write('package.json', { dependencies: { fixture: '1.0.0' } });
  write('package-lock.json', { packages: { 'node_modules/fixture': { version: '1.0.0' } } });
  fs.mkdirSync(path.join(root, 'node_modules'));
  assert.throws(() => ensureDependencies(root, () => ({ status: 1 })), /failed/);
  assert.equal(fs.existsSync(marker), false, 'failed installation cannot certify an existing node_modules folder');
  ensureDependencies(root, install);
  ensureDependencies(root, install);
  assert.equal(installs, 1, 'completed unchanged installation is reused');
  write('package.json', { dependencies: { fixture: '1.0.0' }, description: 'changed manifest' });
  assert.throws(() => ensureDependencies(root, () => ({ status: 1 })), /failed/);
  assert.equal(fs.existsSync(marker), false, 'stale success is withdrawn before a failed update');
  ensureDependencies(root, install);
  fs.unlinkSync(path.join(root, 'node_modules/fixture/package.json'));
  ensureDependencies(root, install);
  assert.equal(installs, 3, 'missing installed package is repaired even with matching marker');
  write('node_modules/fixture/package.json', { version: '9.9.9' });
  ensureDependencies(root, install);
  assert.equal(installs, 4, 'wrong installed version is repaired');
  console.log('PASS dependency installation retries partial/changed/corrupt installs and reuses verified completion');
} finally { fs.rmSync(root, { recursive: true, force: true }); }
