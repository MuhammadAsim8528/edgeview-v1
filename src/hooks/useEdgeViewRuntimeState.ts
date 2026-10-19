import { useState, useEffect, useCallback } from 'react';
import { safeFetchJson } from '../utils/safeFetch';

export interface RuntimeCapability {
  id: string;
  available: boolean;
  status: 'READY' | 'DEGRADED' | 'UNAVAILABLE' | 'CHECKING';
  reason: string;
  dependencies: string[];
  remediation?: string;
}

export interface RuntimeState {
  resources: {
    serper: number;
    hunter: number;
    nvidia: number;
    groq: number;
    directHttp: number;
    pagesAnalyzed: number;
    cacheHits: number;
    cacheMisses: number;
  };
  jobs: {
    active: number;
    completed: number;
    failed: number;
    partial: number;
  };
  enrichment: {
    currentCompany: string | null;
    status: string;
    completedCompanies: number;
    totalCompanies: number;
    quality: {
      complete: number;
      partial: number;
      notFound: number;
      failed: number;
      pending: number;
    };
  };
  providers: {
    [provider: string]: { configured: boolean; reachable: boolean; status: string; message: string };
    nvidia: { configured: boolean; reachable: boolean; status: string; message: string };
    groq: { configured: boolean; reachable: boolean; status: string; message: string };
    serper: { configured: boolean; reachable: boolean; status: string; message: string };
    hunter: { configured: boolean; reachable: boolean; status: string; message: string };
  };
  capabilities: Record<string, RuntimeCapability>;
  logs: any[];
}

const DEFAULT_STATE: RuntimeState = {
  resources: { serper: 0, hunter: 0, nvidia: 0, groq: 0, directHttp: 0, pagesAnalyzed: 0, cacheHits: 0, cacheMisses: 0 },
  jobs: { active: 0, completed: 0, failed: 0, partial: 0 },
  enrichment: { currentCompany: null, status: 'IDLE', completedCompanies: 0, totalCompanies: 0, quality: { complete: 0, partial: 0, notFound: 0, failed: 0, pending: 0 } },
  providers: {
    nvidia: { configured: false, reachable: false, status: 'checking', message: 'checking...' },
    groq: { configured: false, reachable: false, status: 'checking', message: 'checking...' },
    serper: { configured: false, reachable: false, status: 'checking', message: 'checking...' },
    hunter: { configured: false, reachable: false, status: 'checking', message: 'checking...' },
  },
  capabilities: {
    company_enrichment: { id: 'company_enrichment', available: false, status: 'CHECKING', reason: 'Checking research capability...', dependencies: ['serper'] },
    batch_enrichment: { id: 'batch_enrichment', available: false, status: 'CHECKING', reason: 'Checking research capability...', dependencies: ['serper'] },
  },
  logs: [],
};

// Global shared state to avoid duplicate HTTP requests across multiple mounted hooks
let globalState: RuntimeState = DEFAULT_STATE;
const listeners = new Set<(state: RuntimeState) => void>();
let pollingActive = false;
let pollTimer: NodeJS.Timeout | null = null;
let visibilityHandler: (() => void) | null = null;
let runtimeRequest: AbortController | null = null;
let inFlight: Promise<RuntimeState> | null = null;

function validRuntimePayload(value: unknown): value is RuntimeState & { success: true } {
  if (!value || typeof value !== 'object') return false;
  const data = value as Record<string, unknown>;
  const counts = (candidate: unknown, template: object) => {
    if (!candidate || typeof candidate !== 'object') return false;
    const record = candidate as Record<string, unknown>;
    return Object.keys(template).every(key => typeof record[key] === 'number' && Number.isFinite(record[key]) && Number(record[key]) >= 0);
  };
  if (data.success !== true || !counts(data.resources, DEFAULT_STATE.resources) || !counts(data.jobs, DEFAULT_STATE.jobs)
    || !data.enrichment || typeof data.enrichment !== 'object' || !data.providers || typeof data.providers !== 'object'
    || !data.capabilities || typeof data.capabilities !== 'object' || !Array.isArray(data.logs)) return false;
  const enrichment = data.enrichment as Record<string, unknown>;
  if (!counts(enrichment.quality, DEFAULT_STATE.enrichment.quality) || typeof enrichment.status !== 'string'
    || !counts(enrichment, { completedCompanies: 0, totalCompanies: 0 })) return false;
  const providers = data.providers as Record<string, unknown>;
  if (!Object.keys(DEFAULT_STATE.providers).every(key => {
    const provider = providers[key] as Record<string, unknown> | undefined;
    return provider && typeof provider.configured === 'boolean' && typeof provider.reachable === 'boolean' && typeof provider.status === 'string';
  })) return false;
  const capabilities = data.capabilities as Record<string, unknown>;
  return ['company_enrichment','batch_enrichment'].every(key => {
    const capability = capabilities[key] as Record<string, unknown> | undefined;
    return capability && typeof capability.available === 'boolean' && typeof capability.reason === 'string'
      && ['READY','DEGRADED','UNAVAILABLE','CHECKING'].includes(String(capability.status));
  });
}

export function fetchRuntimeState(): Promise<RuntimeState> {
  if (inFlight) return inFlight;
  const controller = new AbortController();
  runtimeRequest = controller;
  let timedOut = false;
  const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, 15000);
  const operation = (async () => {
    try {
      const { ok, data, error } = await safeFetchJson<any>('/api/runtime/state', { signal: controller.signal });
      if (controller.signal.aborted && !timedOut) return globalState;
      if (ok && validRuntimePayload(data)) {
        globalState = {
          resources: data.resources, jobs: data.jobs, enrichment: data.enrichment, providers: data.providers,
          capabilities: data.capabilities || DEFAULT_STATE.capabilities, logs: data.logs || [],
        };
      } else {
        const reason = timedOut ? 'Backend status timed out. EdgeView will retry automatically.'
          : error || 'The backend returned incomplete runtime state. EdgeView will retry automatically.';
        // Preserve loaded data/counts while withdrawing capabilities that can
        // no longer be confirmed. A successful refresh restores backend truth.
        globalState = { ...globalState, capabilities: Object.fromEntries(Object.entries(globalState.capabilities).map(([id, capability]) => [id, {
          ...capability, available: false, status: 'UNAVAILABLE' as const, reason,
          remediation: 'Check that the EdgeView backend is running, then retry.',
        }])) };
      }
      listeners.forEach(fn => fn(globalState));
      return globalState;
    } finally {
      clearTimeout(timeout);
      if (runtimeRequest === controller) runtimeRequest = null;
    }
  })();
  const shared = operation.finally(() => { if (inFlight === shared) inFlight = null; });
  inFlight = shared;
  return shared;
}

function startGlobalPolling() {
  if (pollingActive) return;
  pollingActive = true;
  fetchRuntimeState();
  const schedule = () => {
    if (pollTimer) clearInterval(pollTimer);
    // Runtime state is operational telemetry, not animation state. Slower
    // polling avoids repeated DB/run scans and nearly eliminates background-tab
    // load during long enrichment jobs.
    const intervalMs = document.visibilityState === 'visible' ? 5000 : 30000;
    pollTimer = setInterval(fetchRuntimeState, intervalMs);
  };
  visibilityHandler = () => {
    schedule();
    if (document.visibilityState === 'visible') fetchRuntimeState();
  };
  document.addEventListener('visibilitychange', visibilityHandler);
  schedule();
}

function stopGlobalPolling() {
  if (!pollingActive) return;
  pollingActive = false;
  const activeRequest = runtimeRequest;
  runtimeRequest = null;
  inFlight = null;
  activeRequest?.abort();
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  if (visibilityHandler) {
    document.removeEventListener('visibilitychange', visibilityHandler);
    visibilityHandler = null;
  }
}

export function useEdgeViewRuntimeState() {
  const [state, setState] = useState<RuntimeState>(globalState);

  useEffect(() => {
    listeners.add(setState);
    startGlobalPolling();

    return () => {
      listeners.delete(setState);
      if (listeners.size === 0) {
        stopGlobalPolling();
      }
    };
  }, []);

  const refresh = useCallback(async () => {
    await fetchRuntimeState();
  }, []);

  return {
    state,
    refresh,
  };
}
