import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { acquireRuntimeMaintenance } from '../shared/runtime_maintenance.mjs';
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'edgeview-maintenance-'));
const lock = path.join(root, 'edgeview.db.lock');
const gate = `${lock}.maintenance`;
try {
  const release = acquireRuntimeMaintenance(lock);
  assert.equal(fs.existsSync(lock), false, 'maintenance must not replace backend ownership');
  assert.throws(() => acquireRuntimeMaintenance(lock), /RUNTIME_MAINTENANCE_BUSY/);
  release(); release();
  assert.equal(fs.existsSync(gate), false);
  fs.mkdirSync(gate); // Crash before marker creation: never infer it is stale.
  assert.throws(() => acquireRuntimeMaintenance(lock), /RUNTIME_MAINTENANCE_BUSY/);
  fs.rmdirSync(gate);
  const crashed = spawnSync(process.execPath, ['--input-type=module', '-e',
    `import { acquireRuntimeMaintenance } from ${JSON.stringify(new URL('../shared/runtime_maintenance.mjs', import.meta.url).href)};acquireRuntimeMaintenance(process.argv[1]);process.exit(17);`, lock],
  { encoding: 'utf8', timeout: 10000, windowsHide: true });
  assert.equal(crashed.status, 17, crashed.stderr);
  const interruptedOwner = fs.readFileSync(path.join(gate, 'owner.json'));
  assert.throws(() => acquireRuntimeMaintenance(lock), /RUNTIME_MAINTENANCE_BUSY/);
  assert.deepEqual(fs.readFileSync(path.join(gate, 'owner.json')), interruptedOwner,
    'a dead PID alone must not authorize deleting interrupted-operation state');
  fs.unlinkSync(path.join(gate, 'owner.json')); fs.rmdirSync(gate); // Owned synthetic recovery only.
  const changed = acquireRuntimeMaintenance(lock);
  const owner = path.join(gate, 'owner.json');
  const original = fs.readFileSync(owner);
  fs.writeFileSync(owner, '{"pid":1,"token":"different"}');
  assert.throws(changed, /RUNTIME_MAINTENANCE_OWNERSHIP_CHANGED/);
  assert.equal(fs.existsSync(owner), true, 'never delete an unknown owner marker');
  fs.writeFileSync(owner, original); changed();
  fs.writeFileSync(gate, 'not a directory');
  assert.throws(() => acquireRuntimeMaintenance(lock), /RUNTIME_MAINTENANCE_BUSY/);
  assert.equal(fs.readFileSync(gate, 'utf8'), 'not a directory');
  console.log('PASS atomic maintenance exclusion, conservative interrupted-state refusal and ownership-safe release');
} finally {
  assert.equal(path.dirname(fs.realpathSync(root)), fs.realpathSync(os.tmpdir()));
  fs.rmSync(root, { recursive: true, force: true });
}
