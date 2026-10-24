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
  retryCount: number | null;
  cacheHits: number | null;
  cacheMisses: number | null;
  averageLatencyMs: number | null;
  lastDiagnosticLatencyMs?: number | null;
  lastError: string | null;
}

export const HEALTH_PROVIDER_IDS = ['serper', 'hunter', 'nvidia', 'groq'] as const;
const statuses = new Set(['healthy', 'unconfigured', 'auth_failed', 'rate_limited', 'degraded', 'timeout', 'disabled', 'unknown']);
const routes = new Set(['available', 'cooldown', 'suppressed', 'disabled', 'unconfigured']);
const count = (value: unknown) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const latency = (value: unknown) => value === null || (typeof value === 'number' && Number.isFinite(value) && value >= 0);

/** Validate the four-provider API contract before React renders any metric. */
export function isProviderHealthReport(value: unknown): value is Record<string, ProviderHealth> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const report = value as Record<string, any>;
  return Object.keys(report).length === HEALTH_PROVIDER_IDS.length && HEALTH_PROVIDER_IDS.every(id => {
    const item = report[id];
    return item && typeof item === 'object' && !Array.isArray(item)
      && item.provider === id && typeof item.configured === 'boolean'
      && statuses.has(item.status) && routes.has(item.routingState)
      && ['requestCount', 'successCount', 'failureCount', 'timeoutCount', 'rateLimitCount'].every(key => count(item[key]))
      && item.successCount <= item.requestCount && item.failureCount <= item.requestCount
      && item.timeoutCount <= item.failureCount && item.rateLimitCount <= item.failureCount
      && ['retryCount', 'cacheHits', 'cacheMisses'].every(key => item[key] === null || count(item[key]))
      && latency(item.averageLatencyMs) && (item.lastDiagnosticLatencyMs === undefined || latency(item.lastDiagnosticLatencyMs))
      && (item.lastError === null || typeof item.lastError === 'string');
  });
}
