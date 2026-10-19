import React, { useState, useEffect, useRef } from 'react';
import { 
  RefreshCw, 
  Server, 
  AlertCircle, 
  CheckCircle2, 
  Activity, 
  BarChart3, 
  ShieldAlert, 
  Zap, 
  HelpCircle 
} from 'lucide-react';
import { useEdgeViewRuntimeState } from '../hooks/useEdgeViewRuntimeState';
import { safeFetchJson } from '../utils/safeFetch';
import { formatObservedLatency, formatObservedRate } from '../utils/telemetryFormat';

export interface ProviderHealth {
  provider: string;
  configured: boolean;
  status: 'healthy' | 'unconfigured' | 'auth_failed' | 'rate_limited' | 'degraded' | 'timeout' | 'disabled' | 'unknown';
  routingState: 'available' | 'cooldown' | 'suppressed' | 'disabled' | 'unconfigured';
  requestCount: number;
  successCount: number;
  failureCount: number;
  timeoutCount: number;
  rateLimitCount: number;
  retryCount: number;
  cacheHits: number;
  cacheMisses: number;
  averageLatencyMs: number | null;
  lastDiagnosticLatencyMs?: number | null;
  lastError: string;
}

export const SystemHealthPanel: React.FC = () => {
  const v1Providers = ['serper', 'hunter', 'nvidia', 'groq'];
  const { state: runtimeState, refresh } = useEdgeViewRuntimeState();
  const [isTesting, setIsTesting] = useState(false);
  const [healthReport, setHealthReport] = useState<Record<string, ProviderHealth>>({});
  const [healthError, setHealthError] = useState<string | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const healthRequest = useRef<AbortController | null>(null);
  const testRequest = useRef<AbortController | null>(null);

  const fetchHealthReport = async () => {
    if (healthRequest.current) return;
    const controller = new AbortController();
    healthRequest.current = controller;
    try {
      const { ok, data, error } = await safeFetchJson<any>('/api/governor/provider-metrics', { signal: controller.signal });
      if (controller.signal.aborted) return;
      if (ok && data && data.success && data.report) {
        setHealthReport(data.report);
        setHealthError(null);
      } else {
        setHealthError(error || 'Telemetry is unavailable. Check that EdgeView is running.');
      }
    } catch (err) {
      if (!controller.signal.aborted) setHealthError('Telemetry could not be refreshed.');
    } finally {
      if (healthRequest.current === controller) healthRequest.current = null;
    }
  };

  useEffect(() => {
    fetchHealthReport();
    const interval = setInterval(() => { if (document.visibilityState === 'visible') void fetchHealthReport(); }, 10000);
    return () => {
      clearInterval(interval);
      const activeHealth = healthRequest.current;
      const activeTest = testRequest.current;
      healthRequest.current = null;
      testRequest.current = null;
      activeHealth?.abort(); activeTest?.abort();
    };
  }, []);

  const testConnections = async () => {
    setIsTesting(true);
    setTestError(null);
    const controller = new AbortController();
    testRequest.current = controller;
    try {
      const { ok, data, error } = await safeFetchJson<any>('/api/system/health/test', { method: 'POST', signal: controller.signal });
      if (controller.signal.aborted) return;
      if (!ok || !data?.success) {
        setTestError(error || 'Provider checks could not run. Try again after checking the backend.');
        return;
      }
      await fetchHealthReport();
      await refresh();
    } catch (err) {
      if (!controller.signal.aborted) setTestError('Provider checks could not be completed.');
    } finally {
      if (testRequest.current === controller) testRequest.current = null;
      if (!controller.signal.aborted) setIsTesting(false);
    }
  };

  const renderHealthCard = (key: string, providerData: ProviderHealth) => {
    const isConfigured = providerData.configured;
    const status = providerData.status;
    const routingState = providerData.routingState || 'available';

    let statusLabel = 'Offline';
    let statusColor = 'bg-gray-800 text-gray-400 border-gray-700';

    if (isConfigured) {
      if (status === 'healthy') {
        statusLabel = 'Healthy';
        statusColor = 'bg-emerald-950/60 text-[#10b981] border-emerald-800/40';
      } else if (status === 'rate_limited') {
        statusLabel = 'Rate Limited';
        statusColor = 'bg-amber-950/60 text-amber-400 border-amber-800/40';
      } else if (status === 'auth_failed') {
        statusLabel = 'Authentication Failed';
        statusColor = 'bg-rose-950/60 text-rose-400 border-rose-800/40';
      } else if (status === 'degraded' || status === 'timeout') {
        statusLabel = status === 'timeout' ? 'Timed Out' : 'Degraded';
        statusColor = 'bg-rose-950/60 text-rose-400 border-rose-800/40';
      } else if (status === 'disabled') {
        statusLabel = 'Disabled';
        statusColor = 'bg-gray-800 text-gray-400 border-gray-700';
      } else {
      statusLabel = 'Unknown';
        statusColor = 'bg-sky-950/60 text-sky-400 border-sky-800/40';
      }
    } else {
      statusLabel = 'Not Configured';
      statusColor = 'bg-gray-800 text-gray-400 border-gray-700';
    }

    const providerDisplayNames: Record<string, string> = {
      serper: 'Serper Search',
      hunter: 'Hunter Email API',
      nvidia: 'NVIDIA NIM AI',
      groq: 'Groq LPU'
    };

    return (
      <div 
        key={key} 
        id={`health-card-${key}`} 
        className="p-3.5 bg-[#1a1a1a] rounded-xl border border-[#333333] flex flex-col justify-between space-y-3.5 hover:border-gray-700 transition-all duration-200"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 min-w-0">
            <Server className={`w-3.5 h-3.5 ${isConfigured ? 'text-sky-400' : 'text-gray-500'} shrink-0`} />
            <span className="text-[12px] font-bold text-white truncate">
              {providerDisplayNames[key] || key.toUpperCase()}
            </span>
          </div>
          <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wider border ${statusColor}`}>
            {status === 'healthy' ? (
              <CheckCircle2 className="w-2.5 h-2.5 shrink-0" />
            ) : (
              <AlertCircle className="w-2.5 h-2.5 shrink-0" />
            )}
            <span>{statusLabel}</span>
          </span>
        </div>

        {/* Live Metrics mini table */}
        <div className="space-y-1.5 text-[11px] font-mono text-gray-400">
          <div className="flex justify-between">
            <span>Requests:</span>
            <span className="text-white font-semibold">{providerData.requestCount || 0}</span>
          </div>
          <div className="flex justify-between">
            <span>Success rate:</span>
            <span className={providerData.requestCount > 0 ? 'text-emerald-400 font-semibold' : 'text-gray-500'}>
              {formatObservedRate(providerData.successCount, providerData.requestCount)}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Routing guard:</span>
            <span className={`font-semibold ${routingState === 'suppressed' ? 'text-rose-400' : routingState === 'cooldown' ? 'text-amber-400' : routingState === 'available' ? 'text-emerald-500' : 'text-gray-400'}`}>
              {routingState.toUpperCase()}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Avg Latency:</span>
            <span className="text-white font-semibold">{formatObservedLatency(providerData.averageLatencyMs)}</span>
          </div>
          <div className="flex justify-between"><span>Last diagnostic:</span><span>{formatObservedLatency(providerData.lastDiagnosticLatencyMs)}</span></div>
        </div>

        {/* Error string if failed */}
        {providerData.lastError && (
          <div className="text-[10px] bg-rose-950/40 border border-rose-900/40 text-rose-300 p-2 rounded leading-normal flex items-start space-x-1 font-sans">
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
            <p className="line-clamp-2">{providerData.lastError}</p>
          </div>
        )}

        <div className="pt-2 border-t border-[#262626] flex items-center justify-between text-[10px] text-gray-500 font-mono">
          <span>Key: {isConfigured ? 'Loaded' : 'None'}</span>
          <span>Hits: {providerData.cacheHits || 0}</span>
        </div>
      </div>
    );
  };

  const totalQueries = (runtimeState.resources.cacheHits || 0) + (runtimeState.resources.cacheMisses || 0);
  const cacheHitRate = formatObservedRate(runtimeState.resources.cacheHits || 0, totalQueries);

  return (
    <div className="bg-[#262626] rounded-xl border border-[#333333] p-5 space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#333333]">
        <div>
          <div className="flex items-center space-x-2">
            <Activity className="w-5 h-5 text-[#10b981]" />
            <h3 className="text-sm font-bold text-white">Provider health</h3>
          </div>
          <p className="text-xs text-[#9ca3af] mt-0.5">
            Recorded provider calls, routing guards and explicit connection checks
          </p>
        </div>

        <button
          onClick={testConnections}
          disabled={isTesting}
          className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold text-xs transition-colors shadow-xs cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-white ${isTesting ? 'animate-spin' : ''}`} />
          <span>{isTesting ? 'Testing...' : 'Test enabled providers'}</span>
        </button>
      </div>

      {(testError || healthError) && <div role="alert" className="rounded border border-rose-800 bg-rose-950/40 p-3 text-xs text-rose-200">{testError || healthError}{Object.keys(healthReport).length > 0 ? ' Previously loaded metrics remain visible.' : ''}</div>}

      {/* The V1 critical path intentionally exposes only approved providers. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {Object.keys(healthReport).length > 0 ? (
          Object.entries(healthReport)
            .filter(([key]) => v1Providers.includes(key.toLowerCase()))
            .map(([k, v]) => renderHealthCard(k, v))
        ) : (
          <div className="col-span-full py-8 text-center text-xs text-gray-400 flex items-center justify-center space-x-2">
            <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
            <span>Establishing telemetry links...</span>
          </div>
        )}
      </div>

      {/* Usage Metrics Section */}
      <div className="pt-3 border-t border-[#333333] space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-xs font-semibold text-white flex items-center space-x-1.5">
            <BarChart3 className="w-4 h-4 text-amber-400" />
            <span>System Cache Efficiency Summary</span>
          </h4>
          <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
            Cache hit rate: {cacheHitRate}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="p-3 bg-[#1a1a1a] border border-[#333333] rounded-lg">
            <span className="text-[10px] text-[#9ca3af] block uppercase font-mono">Serper</span>
            <span className="text-sm font-bold text-white font-mono mt-0.5 block">{runtimeState.resources.serper}</span>
          </div>

          <div className="p-3 bg-[#1a1a1a] border border-[#333333] rounded-lg">
            <span className="text-[10px] text-[#9ca3af] block uppercase font-mono">Hunter</span>
            <span className="text-sm font-bold text-white font-mono mt-0.5 block">{healthReport.hunter?.requestCount || 0}</span>
          </div>

          <div className="p-3 bg-[#1a1a1a] border border-[#333333] rounded-lg">
            <span className="text-[10px] text-[#9ca3af] block uppercase font-mono">NVIDIA NIM</span>
            <span className="text-sm font-bold text-sky-400 font-mono mt-0.5 block">{runtimeState.resources.nvidia}</span>
          </div>

          <div className="p-3 bg-[#1a1a1a] border border-[#333333] rounded-lg">
            <span className="text-[10px] text-[#9ca3af] block uppercase font-mono">Groq AI</span>
            <span className="text-sm font-bold text-orange-400 font-mono mt-0.5 block">{runtimeState.resources.groq}</span>
          </div>

          <div className="p-3 bg-[#1a1a1a] border border-emerald-500/20 rounded-lg">
            <span className="text-[10px] text-emerald-400 block uppercase font-mono">Cache Hits</span>
            <span className="text-sm font-bold text-emerald-400 font-mono mt-0.5 block">{runtimeState.resources.cacheHits || 0}</span>
          </div>

          <div className="p-3 bg-[#1a1a1a] border border-rose-500/20 rounded-lg">
            <span className="text-[10px] text-rose-400 block uppercase font-mono">Cache Misses</span>
            <span className="text-sm font-bold text-rose-400 font-mono mt-0.5 block">{runtimeState.resources.cacheMisses || 0}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
