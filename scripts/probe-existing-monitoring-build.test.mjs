import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// These controls must fail before reading configuration, launching a runtime or
// contacting vendors. Never require real monitoring credentials for this test.
const script = fileURLToPath(new URL('./probe-existing-monitoring-build.mjs', import.meta.url));
const marker = 'PRIVATE_CONFIGURATION_MUST_NOT_APPEAR';
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
  /^(PATH|SystemRoot|WINDIR|COMSPEC|USERPROFILE|TEMP|TMP|APPDATA|LOCALAPPDATA)$/i.test(key)));
for (const args of [[], ['--root', marker], ['--root', marker, '--send'],
  ['--root', marker, '--send-real', 'extra']]) {
  const result = spawnSync(process.execPath, [script, ...args], {
    env, encoding: 'utf8', timeout: 10_000, maxBuffer: 16 * 1024, windowsHide: true,
  });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 2, 'inexact real-send opt-in must fail closed');
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /^Usage:/);
  assert.ok(!result.stderr.includes(marker));
}
const failed = spawnSync(process.execPath, [script, '--root', marker, '--send-real'], {
  env, encoding: 'utf8', timeout: 10_000, maxBuffer: 16 * 1024, windowsHide: true,
});
assert.equal(failed.error, undefined);
assert.equal(failed.status, 1);
assert.equal(failed.stdout, '');
assert.match(failed.stderr, /^Monitoring QA could not complete;/);
assert.ok(!failed.stderr.includes(marker), 'failure must not echo private paths/configuration');
console.log('PASS explicit monitoring opt-in and sanitized early failures; no real event sent');
