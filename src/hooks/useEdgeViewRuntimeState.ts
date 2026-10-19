import { useState, useEffect, useCallback } from 'react';
import { safeFetchJson } from '../utils/safeFetch';

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
  logs: [],
};

// Global shared state to avoid duplicate HTTP requests across multiple mounted hooks
let globalState: RuntimeState = DEFAULT_STATE;
const listeners = new Set<(state: RuntimeState) => void>();
let pollingActive = false;
let pollTimer: NodeJS.Timeout | null = null;
let visibilityHandler: (() => void) | null = null;

async function fetchRuntimeState() {
  try {
    const { ok, data } = await safeFetchJson<any>('/api/runtime/state');
    if (ok && data && data.success) {
      globalState = {
        resources: data.resources,
        jobs: data.jobs,
        enrichment: data.enrichment,
        providers: data.providers,
        logs: data.logs,
      };
      // Trigger all registered hook listeners with the new snapshot
      listeners.forEach((fn) => fn(globalState));
    }
  } catch (err) {
    console.error('Error fetching runtime state:', err);
  }
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
