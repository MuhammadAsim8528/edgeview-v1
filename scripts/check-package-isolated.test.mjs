import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { ownedPackagePaths, checkPackageIsolated } from './check-package-isolated.mjs';
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'edgeview-isolation-contract-'));
try {
  const locations = ownedPackagePaths(scratch);
  assert.equal(path.dirname(locations.output), path.resolve(scratch));
  assert.equal(path.resolve(locations.project, '..', '..', 'outputs'), locations.output, 'must match actual packager output calculation');
  assert.ok(locations.stage.startsWith(scratch + path.sep));
  assert.ok(locations.zip.startsWith(scratch + path.sep));
  fs.writeFileSync(path.join(scratch, 'unrelated-sentinel.txt'), 'preserve');
  assert.throws(() => checkPackageIsolated(scratch), /command failed/, 'non-repository cannot start a package operation');
  assert.equal(fs.readFileSync(path.join(scratch, 'unrelated-sentinel.txt'), 'utf8'), 'preserve');
  assert.deepEqual(fs.readdirSync(scratch), ['unrelated-sentinel.txt']);
  console.log('PASS isolated package paths match existing output rules and non-repository refusal leaves unrelated files unchanged');
} finally { fs.rmSync(scratch, { recursive: true, force: true }); }
