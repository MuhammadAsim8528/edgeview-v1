import os from 'node:os';
import fs from 'node:fs';
import { performance } from 'node:perf_hooks';

const finite = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
const safe = <T>(read: () => T): T | null => { try { return read(); } catch { return null; } };
type NumericMetric = 'cpuPercent' | 'rssBytes' | 'heapUsedBytes' | 'heapTotalBytes' | 'externalBytes' | 'arrayBufferBytes'
  | 'systemTotalBytes' | 'systemFreeBytes' | 'diskTotalBytes' | 'diskAvailableBytes' | 'uptimeSeconds'
  | 'handles' | 'threads' | 'childProcesses' | 'diskIoBytes' | 'gpu';
type ResourceSnapshot = Record<NumericMetric, number | null> & { status: 'PASS' | 'WARN'; sampledAt: string; cpuBasis: string; unsupported: string[] };

// Node platform APIs only. One cached snapshot and one CPU baseline, no timer,
// history, subprocess, credentials, environment values or payload references.
export function createResourceSampler(root: string, source = {
  clock: () => performance.now(),
  cpu: () => process.cpuUsage(),
  memory: () => process.memoryUsage(),
  system: () => ({ total: os.totalmem(), free: os.freemem() }),
  disk: () => fs.statfsSync(root),
  uptime: () => process.uptime(),
}) {
  let previous: { at: number; user: number; system: number } | null = null;
  let cached: ResourceSnapshot | null = null;
  let cachedAt = -Infinity;
  function sample(): ResourceSnapshot {
    const at = finite(safe(source.clock));
    if (at !== null && cached && at >= cachedAt && at - cachedAt < 1000) return cached;
    const cpu = safe(source.cpu);
    let cpuPercent: number | null = null;
    if (at !== null && cpu && finite(cpu.user) !== null && finite(cpu.system) !== null) {
      if (previous && at > previous.at && cpu.user >= previous.user && cpu.system >= previous.system) {
        cpuPercent = finite(((cpu.user - previous.user + cpu.system - previous.system) / ((at - previous.at) * 1000)) * 100);
      }
      previous = { at, user: cpu.user, system: cpu.system };
    } else previous = null;
    const memory = safe(source.memory);
    const system = safe(source.system);
    const disk = safe(source.disk);
    const bytes = (blocks: unknown, size: unknown) => typeof blocks === 'number' && typeof size === 'number' ? finite(blocks * size) : null;
    const snapshot: ResourceSnapshot = {
      status: cpuPercent !== null && memory && system && disk
        && [memory.rss, memory.heapUsed, memory.heapTotal, memory.external, memory.arrayBuffers, system.total, system.free, disk.blocks, disk.bavail, disk.bsize].every(value => finite(value) !== null) ? 'PASS' : 'WARN',
      sampledAt: new Date().toISOString(),
      cpuPercent, cpuBasis: '100 percent equals one logical CPU; first sample is unknown',
      rssBytes: finite(memory?.rss), heapUsedBytes: finite(memory?.heapUsed),
      heapTotalBytes: finite(memory?.heapTotal), externalBytes: finite(memory?.external),
      arrayBufferBytes: finite(memory?.arrayBuffers),
      systemTotalBytes: finite(system?.total), systemFreeBytes: finite(system?.free),
      diskTotalBytes: bytes(disk?.blocks, disk?.bsize), diskAvailableBytes: bytes(disk?.bavail, disk?.bsize),
      uptimeSeconds: finite(safe(source.uptime)),
      handles: null, threads: null, childProcesses: null, diskIoBytes: null, gpu: null,
      unsupported: ['handles', 'threads', 'childProcesses', 'diskIoBytes', 'gpu'],
    };
    cachedAt = at ?? -Infinity;
    cached = snapshot;
    return snapshot;
  }
  return sample;
}
