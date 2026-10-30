import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
const copy = fs.copyFileSync;
let attempted = false;
fs.copyFileSync = (source, destination, ...options) => {
  if (!attempted) {
    attempted = true;
    const result = spawnSync(process.execPath, [process.argv[1]], {
      cwd: process.cwd(), env: process.env, encoding: 'utf8', timeout: 10000,
    });
    assert.equal(result.error, undefined, 'competing backup must terminate promptly');
    assert.notEqual(result.status, 0, 'a second backup must not enter the active maintenance operation');
    assert.match(result.stderr, /RUNTIME_MAINTENANCE_BUSY/);
  }
  return copy(source, destination, ...options);
};
