import { ResourceGovernor } from '../../../server/resource_governor';
import { ProviderCapabilityRegistry } from './registry';
import { AppSettings } from '../../../server/settings';

export interface ProviderHealth {
  provider: string;
  configured: boolean;
  status: 'healthy' | 'unhealthy' | 'not_configured' | 'rate_limited';
  circuitBreakerState: 'CLOSED' | 'OPEN' | 'HALF-OPEN';
  requestCount: number;
  successCount: number;
  failureCount: number;
  timeoutCount: number;
  rateLimitCount: number;
  retryCount: number;
  cacheHits: number;
  cacheMisses: number;
  averageLatencyMs: number;
  lastError: string;
}

export class ProviderHealthManager {
  /**
   * Retrieves the comprehensive health & telemetry report for all integrated services.
   */
  public static getReport(settings: AppSettings): Record<string, ProviderHealth> {
    const providers = ['serper', 'tavily', 'exa', 'linkup', 'hunter', 'firecrawl', 'apify', 'gemini', 'nvidia', 'groq'];
    const report: Record<string, ProviderHealth> = {};

    for (const p of providers) {
      const isConfigured = ProviderCapabilityRegistry.isConfigured(p, settings);
      const metrics = ResourceGovernor.getProviderMetrics(p as any);
      const circuit = ResourceGovernor.getCircuitStates()[p as any] || { status: 'healthy', consecutiveFailures: 0, lastFailureTime: 0, lastFailureMessage: '' };

      let status: ProviderHealth['status'] = 'healthy';
      if (!isConfigured) {
        status = 'not_configured';
      } else if (circuit.status === 'unhealthy') {
        status = 'unhealthy';
      } else if (metrics.rateLimitCount > 5 && metrics.successCount === 0) {
        status = 'rate_limited';
      }

      report[p] = {
        provider: p,
        configured: isConfigured,
        status,
        circuitBreakerState: metrics.circuitState,
        requestCount: metrics.requestCount,
        successCount: metrics.successCount,
        failureCount: metrics.failureCount,
        timeoutCount: metrics.timeoutCount,
        rateLimitCount: metrics.rateLimitCount,
        retryCount: metrics.retryCount,
        cacheHits: metrics.cacheHits,
        cacheMisses: metrics.cacheMisses,
        averageLatencyMs: metrics.averageLatencyMs,
        lastError: circuit.lastFailureMessage || ''
      };
    }

    return report;
  }

  /**
   * Safe check if a provider is fully functional (configured and healthy).
   */
  public static isOperational(provider: string, settings: AppSettings): boolean {
    return ProviderCapabilityRegistry.isConfigured(provider, settings) && ProviderCapabilityRegistry.isHealthy(provider);
  }
}
