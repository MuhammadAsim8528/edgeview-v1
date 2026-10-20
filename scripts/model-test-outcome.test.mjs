import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
for (const provider of ['nvidia', 'groq']) {
  const result = spawnSync(process.execPath, ['--import', 'tsx', 'server/tests/provider_model_discovery_e2e.test.ts'], {
    cwd: process.cwd(), encoding: 'utf8', timeout: 15000, maxBuffer: 128 * 1024,
    env: { ...process.env, EDGEVIEW_LIVE_PROVIDER_TESTS: '0', EDGEVIEW_TEST_MODEL_FAILURE: provider },
  });
  assert.ifError(result.error);
  assert.equal(result.status, 1, `${provider} catalog failure must fail the test process`);
  assert.match(result.stderr, /FAIL model-discovery verification/);
  assert.doesNotMatch(result.stdout, /PASS isolated masked-key routing|ALL.*PASSED/);
}
console.log('PASS each catalog failure produces a failing exit without a false overall-success claim');
