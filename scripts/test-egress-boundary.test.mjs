import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

// This shared fixture lives in an existing QA input directory, so the same
// contract executes inside Docker as well as Windows and browser test jobs.
const helper = path.resolve('scripts/test-no-egress.cjs');
assert.ok(fs.lstatSync(helper).isFile() && !fs.lstatSync(helper).isSymbolicLink());
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'edgeview-egress-fixture-'));
const audit = path.join(root, 'attempts.txt');
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
  /^(PATH|SYSTEMROOT|WINDIR|TEMP|TMP|COMSPEC|PATHEXT|APPDATA|LOCALAPPDATA|USERPROFILE)$/i.test(key)));
try {
  const result = spawnSync(process.execPath, ['--require', helper, '--eval', `
    const assert=require('node:assert/strict');
    assert.throws(()=>fetch('https://no-network.example.test/'),/E2E_BACKEND_OUTBOUND_DISABLED/);
    assert.throws(()=>require('node:http').request('http://no-network.example.test/'),/E2E_BACKEND_OUTBOUND_DISABLED/);
    assert.throws(()=>require('node:https').request('https://no-network.example.test/'),/E2E_BACKEND_OUTBOUND_DISABLED/);
    assert.equal(typeof require('node:http').createServer,'function');
    console.log('test-egress-denied');
  `], { env: { ...env, EDGEVIEW_E2E_EGRESS_AUDIT: audit }, encoding: 'utf8', timeout: 30000, windowsHide: true });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /test-egress-denied/);
  assert.equal(fs.readFileSync(audit, 'utf8'), 'attempt\nattempt\nattempt\n');
  console.log('PASS shared QA preload: fetch/http/https denied before egress, auditable attempts, inbound server primitive retained');
} finally {
  assert.equal(fs.realpathSync(path.dirname(root)), fs.realpathSync(os.tmpdir()));
  fs.rmSync(root, { recursive: true, force: true });
}
