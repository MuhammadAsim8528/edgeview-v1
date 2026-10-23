import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { collectLicenseTexts } from './collect-license-texts.mjs';
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'edgeview-license-text-test-'));
const lock = { lockfileVersion: 3, name: 'edgeview', version: '1', packages: { '': {}, 'node_modules/fixture': { version: '1' }, 'node_modules/absent': { version: '2', optional: true } } };
const directory = path.join(root, 'node_modules', 'fixture');
try {
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, 'package.json'), JSON.stringify({ name: 'fixture', version: '1' }));
  fs.writeFileSync(path.join(directory, 'LICENSE.txt'), 'Synthetic legal text');
  fs.writeFileSync(path.join(directory, 'README.md'), 'NEVER_COPY_SOURCE_OR_SECRETS');
  const captured = collectLicenseTexts(lock, root, { includeText: true });
  assert.equal(captured.counts.textCaptured, 1); assert.equal(captured.counts.notInstalled, 1);
  assert.equal(captured.status, 'NOT VERIFIED');
  assert.equal(captured.components[0].files.length + captured.components[1].files.length, 1);
  assert.ok(!JSON.stringify(captured).includes('NEVER_COPY'));
  assert.ok(!JSON.stringify(collectLicenseTexts(lock, root)).includes('Synthetic legal text'), 'default output is hashes/metadata, not text');
  fs.writeFileSync(path.join(directory, 'package.json'), JSON.stringify({ name: 'fixture', version: '99' }));
  assert.equal(collectLicenseTexts(lock, root).counts.mismatch, 1);
  fs.writeFileSync(path.join(directory, 'package.json'), JSON.stringify({ name: 'fixture', version: '1' }));
  const malicious = { ...lock, packages: { '': {}, 'node_modules/../fixture': { version: '1' } } };
  assert.throws(() => collectLicenseTexts(malicious, root), /path/);
  fs.mkdirSync(path.join(root, 'other'));
  fs.symlinkSync(path.join(root, 'other'), path.join(directory, 'NOTICE'), process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(() => collectLicenseTexts(lock, root), /Linked/);
  console.log('PASS exact-version license collection excludes source, flags absence/mismatch, rejects traversal/junctions and never grants clearance');
} finally { fs.rmSync(root, { recursive: true, force: true }); }
