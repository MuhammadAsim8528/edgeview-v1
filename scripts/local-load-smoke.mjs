import assert from 'node:assert/strict';

const base = process.env.EDGEVIEW_URL || 'http://127.0.0.1:3901';
const origin = new URL(base);
assert.ok(origin.protocol === 'http:' && origin.hostname === '127.0.0.1' && !origin.username && !origin.password && origin.pathname === '/' && !origin.search && !origin.hash, 'Load probe requires a loopback HTTP origin');
const request = route => fetch(`${origin.origin}${route}`, { signal: AbortSignal.timeout(10000), redirect: 'error' });
async function consume(response, limit, json = false) {
  const reader = response.body?.getReader();
  const chunks = [];
  let size = 0;
  if (reader) {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        assert.ok(size <= limit, 'Load response exceeds byte limit');
        if (json) chunks.push(Buffer.from(value));
      }
    } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  }
  return json ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : null;
}
async function health() {
  const response = await request('/api/health');
  assert.equal(response.status, 200);
  const value = await consume(response, 1024 * 1024, true);
  assert.ok(Number.isSafeInteger(value.app?.pid) && value.app.pid > 0, 'Health process identity unavailable');
  assert.ok(Number.isFinite(value.memory?.rss_mb) && value.memory.rss_mb >= 0, 'Health RSS unavailable');
  return value;
}
// Stay below the production local-client limit (120 requests/minute). This is
// a latency/memory smoke test, not an attempt to disable or defeat rate limiting.
const total = 100;
const concurrency = 12;
const timings = [];
let failures = 0;
const before = await health();

let cursor = 0;
async function worker() {
  while (true) {
    const index = cursor++;
    if (index >= total) return;
    const route = index % 20 === 0 ? '/api/companies' : index % 3 === 0 ? '/api/runtime/state' : '/api/health';
    const started = performance.now();
    try {
      const response = await request(route);
      await consume(response, 16 * 1024 * 1024);
      if (!response.ok) failures += 1;
    } catch {
      failures += 1;
    }
    timings.push(performance.now() - started);
  }
}

await Promise.all(Array.from({ length: concurrency }, worker));
timings.sort((a, b) => a - b);
const percentile = p => timings[Math.min(timings.length - 1, Math.floor(timings.length * p))];
const after = await health();
assert.equal(after.app.pid, before.app.pid, 'Backend changed during load probe');
assert.equal(failures, 0, `${failures} load-smoke requests failed`);
assert.ok(percentile(0.95) < 5000, `p95 latency was ${Math.round(percentile(0.95))}ms`);
assert.ok(after.memory.rss_mb < before.memory.rss_mb + 300, `RSS grew from ${before.memory.rss_mb}MB to ${after.memory.rss_mb}MB`);
console.log(JSON.stringify({ target: base, app_pid: before.app?.pid ?? null, project_root: before.app?.project_root ?? null, requests: total, concurrency, failures, p50_ms: Math.round(percentile(0.5)), p95_ms: Math.round(percentile(0.95)), max_ms: Math.round(timings.at(-1)), rss_before_mb: before.memory.rss_mb, rss_after_mb: after.memory.rss_mb }));
