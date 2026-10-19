import assert from 'node:assert/strict';

const base = process.env.EDGEVIEW_URL || 'http://127.0.0.1:3901';
// Stay below the production local-client limit (120 requests/minute). This is
// a latency/memory smoke test, not an attempt to disable or defeat rate limiting.
const total = 100;
const concurrency = 12;
const timings = [];
let failures = 0;
const before = await (await fetch(`${base}/api/health`)).json();

let cursor = 0;
async function worker() {
  while (true) {
    const index = cursor++;
    if (index >= total) return;
    const route = index % 20 === 0 ? '/api/companies' : index % 3 === 0 ? '/api/runtime/state' : '/api/health';
    const started = performance.now();
    try {
      const response = await fetch(`${base}${route}`);
      await response.arrayBuffer();
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
const after = await (await fetch(`${base}/api/health`)).json();
assert.equal(failures, 0, `${failures} load-smoke requests failed`);
assert.ok(percentile(0.95) < 5000, `p95 latency was ${Math.round(percentile(0.95))}ms`);
assert.ok(after.memory.rss_mb < before.memory.rss_mb + 300, `RSS grew from ${before.memory.rss_mb}MB to ${after.memory.rss_mb}MB`);
console.log(JSON.stringify({ requests: total, concurrency, failures, p50_ms: Math.round(percentile(0.5)), p95_ms: Math.round(percentile(0.95)), max_ms: Math.round(timings.at(-1)), rss_before_mb: before.memory.rss_mb, rss_after_mb: after.memory.rss_mb }));
