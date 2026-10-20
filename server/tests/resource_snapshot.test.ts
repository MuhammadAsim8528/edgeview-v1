import assert from 'node:assert/strict';
import { createResourceSampler } from '../resource_snapshot.ts';

let at = 0, user = 100, calls = 0;
const source = {
  clock: () => at,
  cpu: () => { calls++; return { user, system: 0 }; },
  memory: () => ({ rss: 100, heapUsed: 20, heapTotal: 40, external: 3, arrayBuffers: 1 }),
  system: () => ({ total: 1000, free: 400 }),
  disk: () => ({ blocks: 200, bavail: 50, bsize: 4096 }) as any,
  uptime: () => 12,
};
const sample = createResourceSampler('unused-fixture-root', source);
const first = sample();
assert.equal(first.cpuPercent, null);
at = 200; assert.equal(sample(), first); assert.equal(calls, 1);
at = 1000; user += 500000;
assert.equal(sample().cpuPercent, 50);
assert.equal(sample().diskAvailableBytes, 204800);
at = 2000; user += 2000000;
assert.equal(sample().cpuPercent, 200, 'multi-core process CPU is not capped at one core');
at = 3000; user = 0; assert.equal(sample().cpuPercent, null, 'counter reset cannot yield negative usage');
const failure = () => { throw new Error('sensitive-provider-token-must-not-escape'); };
const unavailable = createResourceSampler('unused', { clock: () => 0, cpu: failure, memory: failure, system: failure, disk: failure, uptime: failure })();
assert.equal(unavailable.status, 'WARN');
assert.equal(unavailable.rssBytes, null); assert.equal(unavailable.diskAvailableBytes, null);
assert.equal(unavailable.childProcesses, null);
assert.ok(!JSON.stringify(unavailable).includes('sensitive'));
const invalid = createResourceSampler('unused', { ...source, memory: () => ({ rss: NaN, heapUsed: -1, heapTotal: Infinity, external: 0, arrayBuffers: 0 }) })();
assert.equal(invalid.rssBytes, null); assert.equal(invalid.heapUsedBytes, null);
assert.equal(invalid.status, 'WARN');
assert.doesNotThrow(() => JSON.stringify(invalid));
const live = createResourceSampler(process.cwd())();
assert.ok(live.rssBytes !== null && live.rssBytes > 0);
console.log('PASS bounded resource sampling, CPU basis, cache, reset, permission failures and safe serialization');
