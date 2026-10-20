import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
const probe = new URL('./local-load-smoke.mjs', import.meta.url).href;
for (const scenario of ['healthy', 'missing-rss', 'changed-pid', 'rate-limit', 'oversized', 'redirect-options']) {
  const code = `
    import assert from 'node:assert/strict';
    let calls = 0;
    globalThis.fetch = async (_url, options) => {
      calls++;
      assert.ok(options.signal instanceof AbortSignal);
      assert.equal(options.redirect, 'error');
      const scenario = ${JSON.stringify(scenario)};
      if (scenario === 'oversized') return new Response('x'.repeat(1024 * 1024 + 1));
      return new Response(JSON.stringify({ app: { pid: scenario === 'changed-pid' && calls === 102 ? 2 : 1 }, memory: scenario === 'missing-rss' ? {} : {rss_mb: 100} }), {status: scenario === 'rate-limit' && calls === 2 ? 429 : 200});
    };
    await import(${JSON.stringify(probe)});
  `;
  const result = spawnSync(process.execPath, ['--input-type=module', '--eval', code], {
    encoding: 'utf8', timeout: 15000, maxBuffer: 128 * 1024,
    env: { ...process.env, EDGEVIEW_URL: 'http://127.0.0.1:3901' },
  });
  assert.ifError(result.error);
  assert.equal(result.status === 0, ['healthy', 'redirect-options'].includes(scenario), scenario);
  if (scenario === 'missing-rss') assert.match(result.stderr, /Health RSS unavailable/);
  if (scenario === 'changed-pid') assert.match(result.stderr, /Backend changed/);
  if (scenario === 'rate-limit') assert.match(result.stderr, /requests failed/);
  if (scenario === 'oversized') assert.match(result.stderr, /byte limit/);
}
console.log('PASS load probe bounds, request signal/redirect policy, missing metrics, restart and quota failures');
