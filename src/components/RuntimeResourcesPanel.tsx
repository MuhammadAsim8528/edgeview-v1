import React, { useCallback, useEffect, useRef, useState } from 'react';
import { safeFetchJson } from '../utils/safeFetch';

const FIELDS = ['cpuPercent', 'rssBytes', 'heapUsedBytes', 'heapTotalBytes', 'externalBytes', 'systemFreeBytes', 'systemTotalBytes', 'diskAvailableBytes', 'uptimeSeconds'] as const;
type Resources = Record<typeof FIELDS[number], number | null> & { sampledAt: string; status: 'PASS' | 'WARN' };
type BuildSummary = { version: string; buildId: string; builtAt: string; gitCommit: string | null };
export function parseBuildSummary(value: unknown): BuildSummary | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  if (record.available !== true || typeof record.version !== 'string' || record.version.length > 80
    || typeof record.buildId !== 'string' || !/^[a-f0-9]{64}$/.test(record.buildId)
    || typeof record.builtAt !== 'string' || !Number.isFinite(Date.parse(record.builtAt))
    || !(record.gitCommit === null || (typeof record.gitCommit === 'string' && /^[a-f0-9]{40,64}$/.test(record.gitCommit)))) return null;
  return { version: record.version, buildId: record.buildId, builtAt: record.builtAt, gitCommit: record.gitCommit as string | null };
}
export function BuildIdentityDetails({ build }: { build: BuildSummary | null }) {
  return <details className="text-xs text-gray-400 border-t border-gray-700 pt-2">
    <summary className="cursor-pointer text-gray-200">Build identity</summary>
    {build ? <dl className="space-y-1 pt-2 break-all">
      <div><dt>Version</dt><dd>{build.version}</dd></div>
      <div><dt>Build ID</dt><dd className="font-mono">{build.buildId}</dd></div>
      <div><dt>Build date</dt><dd>{build.builtAt}</dd></div>
      <div><dt>Checkout commit at build time</dt><dd>{build.gitCommit || 'Unknown — Git unavailable during build'}</dd></div>
    </dl> : <p className="pt-2">Unknown — this backend has no recorded build identity.</p>}
    <p className="pt-2">Recorded when the backend starts. The commit is not a clean-checkout guarantee; Build ID covers the source bytes. Doctor compares source, build files and running identity.</p>
  </details>;
}
function valid(value: unknown): value is Resources {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return ['PASS', 'WARN'].includes(String(record.status)) && typeof record.sampledAt === 'string'
    && FIELDS.every(field => record[field] === null || (typeof record[field] === 'number' && Number.isFinite(record[field]) && Number(record[field]) >= 0));
}
const mib = (value: number | null) => value === null ? 'Unknown' : `${(value / 1024 / 1024).toFixed(1)} MiB`;

export function RuntimeResourcesPanel() {
  const [resources, setResources] = useState<Resources | null>(null);
  const [build, setBuild] = useState<BuildSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const active = useRef<AbortController | null>(null);
  const refresh = useCallback(async () => {
    if (active.current) return;
    const controller = new AbortController(); active.current = controller;
    setLoading(true);
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const result = await safeFetchJson<{ resources?: unknown; app?: { build?: unknown } }>('/api/health', { signal: controller.signal });
      if (active.current !== controller) return;
      if (result.ok && valid(result.data?.resources)) { setResources(result.data.resources); setBuild(parseBuildSummary(result.data?.app?.build)); setError(null); }
      else setError('Resource measurements are unavailable. Previously loaded measurements may be stale.');
    } catch {
      if (active.current === controller) setError('Resource measurements could not be refreshed.');
    } finally {
      clearTimeout(timeout);
      if (active.current === controller) { active.current = null; setLoading(false); }
    }
  }, []);
  useEffect(() => {
    void refresh();
    return () => { const controller = active.current; active.current = null; controller?.abort(); };
  }, [refresh]);
  const rows = resources ? [
    ['Process CPU', resources.cpuPercent === null ? 'Unknown — refresh after one second' : `${resources.cpuPercent.toFixed(1)}%`],
    ['Process RAM (RSS)', mib(resources.rssBytes)], ['Heap used / total', `${mib(resources.heapUsedBytes)} / ${mib(resources.heapTotalBytes)}`],
    ['External memory', mib(resources.externalBytes)], ['System free / total RAM', `${mib(resources.systemFreeBytes)} / ${mib(resources.systemTotalBytes)}`],
    ['Available disk', mib(resources.diskAvailableBytes)], ['Uptime', resources.uptimeSeconds === null ? 'Unknown' : `${Math.floor(resources.uptimeSeconds)} seconds`],
  ] : [];
  return <section aria-label="Runtime resources" className="rounded-lg border border-[#333333] bg-[#1a1a1a] p-4 space-y-3">
    <div className="flex items-center justify-between gap-3">
      <h4 className="text-sm font-semibold text-white">Runtime resources</h4>
      <button type="button" onClick={() => void refresh()} disabled={loading} className="rounded border border-gray-600 px-3 py-1 text-xs text-white disabled:opacity-50">{loading ? 'Refreshing…' : 'Refresh resources'}</button>
    </div>
    {error ? <p role="alert" className="text-xs text-amber-300">{error}</p> : null}
    {!resources && !error ? <p role="status" className="text-xs text-gray-400">Loading measurements…</p> : null}
    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">{rows.map(([label, value]) => <div key={label} className="flex justify-between gap-3"><dt className="text-gray-400">{label}</dt><dd className="text-gray-100 text-right">{value}</dd></div>)}</dl>
    {resources ? <p className="text-xs text-gray-400">{resources.status} · Sample: {resources.sampledAt}. CPU: 100% equals one logical core.</p> : null}
    <p className="text-xs text-gray-500">Handles, threads, child-process count, disk I/O and GPU: unsupported. This view does not measure browser memory. No provider checks or external monitoring calls are made.</p>
    <BuildIdentityDetails build={build} />
  </section>;
}
