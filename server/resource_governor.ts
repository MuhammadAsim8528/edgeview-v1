import { getAppSettings } from './settings';
import { recordUsage } from './enrichment';

export interface GovernorLimits {
  serperMax: number;
  firecrawlMax: number;
  nvidiaMax: number;
  groqMax: number;
  geminiMax: number;
  hunterMax: number;
  tavilyMax: number;
  exaMax: number;
  linkupMax: number;
  apifyMax: number;
}

export interface GovernorUsage {
  serper: number;
  firecrawl: number;
  nvidia: number;
  groq: number;
  gemini: number;
  hunter: number;
  tavily: number;
  exa: number;
  linkup: number;
  apify: number;
}

export interface ProviderCircuitState {
  status: 'healthy' | 'unhealthy' | 'not_configured';
  consecutiveFailures: number;
  lastFailureTime: number;
  lastFailureMessage: string;
}

export interface ProviderStats {
  // Logical accounting
  logicalRequests: number;      // Number of logical requests initiated
  physicalAttempts: number;     // Total physical attempts (including retries)
  retries: number;              // Number of retry attempts
  
  // Outcome accounting
  successes: number;            // Successful logical requests
  failures: number;             // Failed logical requests (after all retries exhausted)
  timeoutCount: number;
  rateLimitCount: number;
  
  // Cache accounting
  cacheHits: number;
  cacheMisses: number;
  
  // Performance
  totalLatencyMs: number;
  averageLatencyMs: number;
  circuitState: 'CLOSED' | 'OPEN' | 'HALF-OPEN';
  
  // Legacy fields for backward compatibility
  requestCount: number;         // = logicalRequests (deprecated)
  successCount: number;         // = successes (deprecated)
  failureCount: number;         // = failures (deprecated)
  retryCount: number;           // = retries (deprecated)
}

class ResourceGovernorClass {
  private limits: GovernorLimits = {
    serperMax: 500,
    firecrawlMax: 200,
    nvidiaMax: 1000,
    groqMax: 1000,
    geminiMax: 1000,
    hunterMax: 500,
    tavilyMax: 500,
    exaMax: 500,
    linkupMax: 500,
    apifyMax: 100,
  };

  private usage: GovernorUsage = {
    serper: 0,
    firecrawl: 0,
    nvidia: 0,
    groq: 0,
    gemini: 0,
    hunter: 0,
    tavily: 0,
    exa: 0,
    linkup: 0,
    apify: 0,
  };

  private activeCount = {
    serper: 0,
    firecrawl: 0,
    nvidia: 0,
    groq: 0,
    gemini: 0,
    hunter: 0,
    tavily: 0,
    exa: 0,
    linkup: 0,
    apify: 0,
  };

  private maxConcurrency: Record<keyof GovernorUsage, number> = {
    serper: 5,
    firecrawl: 4,
    nvidia: 3,
    groq: 5,
    gemini: 5,
    hunter: 3,
    tavily: 4,
    exa: 4,
    linkup: 3,
    apify: 2,
  };

  private waitQueues: Record<keyof GovernorUsage, Array<() => void>> = {
    serper: [],
    firecrawl: [],
    nvidia: [],
    groq: [],
    gemini: [],
    hunter: [],
    tavily: [],
    exa: [],
    linkup: [],
    apify: [],
  };

  private async acquireConcurrencyToken(type: keyof GovernorUsage): Promise<void> {
    const max = this.maxConcurrency[type] || 5;
    if (this.activeCount[type] < max) {
      this.activeCount[type]++;
      return;
    }
    await new Promise<void>((resolve) => {
      this.waitQueues[type].push(() => {
        this.activeCount[type]++;
        resolve();
      });
    });
  }

  private releaseConcurrencyToken(type: keyof GovernorUsage): void {
    this.activeCount[type] = Math.max(0, this.activeCount[type] - 1);
    const next = this.waitQueues[type].shift();
    if (next) {
      next();
    }
  }

  private circuitStates: Record<keyof GovernorUsage, ProviderCircuitState> = {
    serper: { status: 'healthy', consecutiveFailures: 0, lastFailureTime: 0, lastFailureMessage: '' },
    firecrawl: { status: 'healthy', consecutiveFailures: 0, lastFailureTime: 0, lastFailureMessage: '' },
    nvidia: { status: 'healthy', consecutiveFailures: 0, lastFailureTime: 0, lastFailureMessage: '' },
    groq: { status: 'healthy', consecutiveFailures: 0, lastFailureTime: 0, lastFailureMessage: '' },
    gemini: { status: 'healthy', consecutiveFailures: 0, lastFailureTime: 0, lastFailureMessage: '' },
    hunter: { status: 'healthy', consecutiveFailures: 0, lastFailureTime: 0, lastFailureMessage: '' },
    tavily: { status: 'healthy', consecutiveFailures: 0, lastFailureTime: 0, lastFailureMessage: '' },
    exa: { status: 'healthy', consecutiveFailures: 0, lastFailureTime: 0, lastFailureMessage: '' },
    linkup: { status: 'healthy', consecutiveFailures: 0, lastFailureTime: 0, lastFailureMessage: '' },
    apify: { status: 'healthy', consecutiveFailures: 0, lastFailureTime: 0, lastFailureMessage: '' },
  };

  private providerStats: Record<keyof GovernorUsage, ProviderStats> = {
    serper: { logicalRequests: 0, physicalAttempts: 0, retries: 0, successes: 0, failures: 0, timeoutCount: 0, rateLimitCount: 0, cacheHits: 0, cacheMisses: 0, totalLatencyMs: 0, averageLatencyMs: 0, circuitState: 'CLOSED', requestCount: 0, successCount: 0, failureCount: 0, retryCount: 0 },
    firecrawl: { logicalRequests: 0, physicalAttempts: 0, retries: 0, successes: 0, failures: 0, timeoutCount: 0, rateLimitCount: 0, cacheHits: 0, cacheMisses: 0, totalLatencyMs: 0, averageLatencyMs: 0, circuitState: 'CLOSED', requestCount: 0, successCount: 0, failureCount: 0, retryCount: 0 },
    nvidia: { logicalRequests: 0, physicalAttempts: 0, retries: 0, successes: 0, failures: 0, timeoutCount: 0, rateLimitCount: 0, cacheHits: 0, cacheMisses: 0, totalLatencyMs: 0, averageLatencyMs: 0, circuitState: 'CLOSED', requestCount: 0, successCount: 0, failureCount: 0, retryCount: 0 },
    groq: { logicalRequests: 0, physicalAttempts: 0, retries: 0, successes: 0, failures: 0, timeoutCount: 0, rateLimitCount: 0, cacheHits: 0, cacheMisses: 0, totalLatencyMs: 0, averageLatencyMs: 0, circuitState: 'CLOSED', requestCount: 0, successCount: 0, failureCount: 0, retryCount: 0 },
    gemini: { logicalRequests: 0, physicalAttempts: 0, retries: 0, successes: 0, failures: 0, timeoutCount: 0, rateLimitCount: 0, cacheHits: 0, cacheMisses: 0, totalLatencyMs: 0, averageLatencyMs: 0, circuitState: 'CLOSED', requestCount: 0, successCount: 0, failureCount: 0, retryCount: 0 },
    hunter: { logicalRequests: 0, physicalAttempts: 0, retries: 0, successes: 0, failures: 0, timeoutCount: 0, rateLimitCount: 0, cacheHits: 0, cacheMisses: 0, totalLatencyMs: 0, averageLatencyMs: 0, circuitState: 'CLOSED', requestCount: 0, successCount: 0, failureCount: 0, retryCount: 0 },
    tavily: { logicalRequests: 0, physicalAttempts: 0, retries: 0, successes: 0, failures: 0, timeoutCount: 0, rateLimitCount: 0, cacheHits: 0, cacheMisses: 0, totalLatencyMs: 0, averageLatencyMs: 0, circuitState: 'CLOSED', requestCount: 0, successCount: 0, failureCount: 0, retryCount: 0 },
    exa: { logicalRequests: 0, physicalAttempts: 0, retries: 0, successes: 0, failures: 0, timeoutCount: 0, rateLimitCount: 0, cacheHits: 0, cacheMisses: 0, totalLatencyMs: 0, averageLatencyMs: 0, circuitState: 'CLOSED', requestCount: 0, successCount: 0, failureCount: 0, retryCount: 0 },
    linkup: { logicalRequests: 0, physicalAttempts: 0, retries: 0, successes: 0, failures: 0, timeoutCount: 0, rateLimitCount: 0, cacheHits: 0, cacheMisses: 0, totalLatencyMs: 0, averageLatencyMs: 0, circuitState: 'CLOSED', requestCount: 0, successCount: 0, failureCount: 0, retryCount: 0 },
    apify: { logicalRequests: 0, physicalAttempts: 0, retries: 0, successes: 0, failures: 0, timeoutCount: 0, rateLimitCount: 0, cacheHits: 0, cacheMisses: 0, totalLatencyMs: 0, averageLatencyMs: 0, circuitState: 'CLOSED', requestCount: 0, successCount: 0, failureCount: 0, retryCount: 0 },
  };

  private COOLDOWN_MS = 30000; // 30 seconds cooldown for circuit reset attempt

  constructor() {
    this.resetStats();
  }

  public getCircuitStates(): Record<keyof GovernorUsage, ProviderCircuitState> {
    return this.circuitStates;
  }

  public getCircuitStateName(type: keyof GovernorUsage): 'CLOSED' | 'OPEN' | 'HALF-OPEN' {
    const state = this.circuitStates[type];
    if (state.status === 'unhealthy') {
      const now = Date.now();
      if (now - state.lastFailureTime > this.COOLDOWN_MS) {
        return 'HALF-OPEN';
      }
      return 'OPEN';
    }
    return 'CLOSED';
  }

  public getCircuitState(type: keyof GovernorUsage) {
    const state = this.circuitStates[type];
    if (state.status === 'unhealthy') {
      const now = Date.now();
      if (now - state.lastFailureTime > this.COOLDOWN_MS) {
        return { tripped: false, isCooldown: false, message: 'Cooldown elapsed, testing connection' };
      }
      return { 
        tripped: true, 
        isCooldown: true, 
        message: `Circuit is tripped due to 3+ consecutive failures. Cooldown remaining: ${Math.ceil((this.COOLDOWN_MS - (now - state.lastFailureTime)) / 1000)}s. Error: ${state.lastFailureMessage}` 
      };
    }
    return { tripped: false, isCooldown: false, message: '' };
  }

  public recordCircuitFailure(type: keyof GovernorUsage, message: string) {
    const state = this.circuitStates[type];
    state.consecutiveFailures++;
    state.lastFailureTime = Date.now();
    state.lastFailureMessage = message;
    if (state.consecutiveFailures >= 3) {
      state.status = 'unhealthy';
    }
  }

  public resetCircuit(type: keyof GovernorUsage) {
    const state = this.circuitStates[type];
    state.consecutiveFailures = 0;
    state.status = 'healthy';
    state.lastFailureTime = 0;
    state.lastFailureMessage = '';
  }

  public setLimits(newLimits: Partial<GovernorLimits>) {
    this.limits = { ...this.limits, ...newLimits };
  }

  public getLimits(): GovernorLimits {
    return this.limits;
  }

  public resetStats() {
    this.usage = {
      serper: 0,
      firecrawl: 0,
      nvidia: 0,
      groq: 0,
      gemini: 0,
      hunter: 0,
      tavily: 0,
      exa: 0,
      linkup: 0,
      apify: 0,
    };
  }

  public getStats(): GovernorUsage {
    return this.usage;
  }

  public recordCacheHit(type: keyof GovernorUsage) {
    if (this.providerStats[type]) {
      this.providerStats[type].cacheHits++;
    }
  }

  public recordCacheMiss(type: keyof GovernorUsage) {
    if (this.providerStats[type]) {
      this.providerStats[type].cacheMisses++;
    }
  }

  public getProviderMetrics(type: keyof GovernorUsage): ProviderStats {
    const stats = this.providerStats[type];
    return {
      ...stats,
      circuitState: this.getCircuitStateName(type)
    };
  }

  public getAllProviderMetrics(): Record<keyof GovernorUsage, ProviderStats> {
    const result = {} as Record<keyof GovernorUsage, ProviderStats>;
    for (const key of Object.keys(this.providerStats) as (keyof GovernorUsage)[]) {
      result[key] = this.getProviderMetrics(key);
    }
    return result;
  }

  public checkBudget(type: keyof GovernorUsage): { allowed: boolean; isSoftLimit: boolean; message?: string } {
    const current = this.usage[type];
    const max = this.limits[`${type}Max` as keyof GovernorLimits];

    if (current >= max) {
      return { allowed: false, isSoftLimit: false, message: `Hard limit of ${max} reached for ${type}` };
    }

    const softThreshold = max * 0.8;
    if (current >= softThreshold) {
      return { allowed: true, isSoftLimit: true, message: `Soft limit warning: ${type} usage is at ${current}/${max} (${Math.round((current / max) * 100)}%)` };
    }

    return { allowed: true, isSoftLimit: false };
  }

  public incrementUsage(type: keyof GovernorUsage) {
    this.usage[type]++;
    // Keep in sync with legacy enrichment metrics
    if (type === 'serper') recordUsage('search_requests', 1);
    else if (type === 'firecrawl') recordUsage('scraper_requests', 1);
    else if (type === 'nvidia') recordUsage('nvidia_calls', 1);
    else if (type === 'groq') recordUsage('groq_calls', 1);
    else if (type === 'gemini') recordUsage('gemini_calls', 1);
    else if (type === 'apify') recordUsage('scraper_requests', 1);
  }

  public async executeWithRetry<T>(
    type: keyof GovernorUsage,
    operationName: string,
    operation: () => Promise<T>,
    maxRetries = 3
  ): Promise<T> {
    const startTime = Date.now();
    this.providerStats[type].requestCount++;

    const circuit = this.getCircuitState(type);
    if (circuit.tripped) {
      this.providerStats[type].failureCount++;
      throw new Error(`CIRCUIT_TRIPPED:${type.toUpperCase()} - ${circuit.message}`);
    }

    const budgetCheck = this.checkBudget(type);
    if (!budgetCheck.allowed) {
      this.providerStats[type].failureCount++;
      throw new Error(`RESOURCE_LIMIT_EXCEEDED:${type.toUpperCase()}`);
    }
    if (budgetCheck.isSoftLimit && budgetCheck.message) {
      console.warn(budgetCheck.message);
    }

    await this.acquireConcurrencyToken(type);
    try {
      let lastError: any = null;
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        if (attempt > 1) {
          this.providerStats[type].retryCount++;
          const reCheck = this.checkBudget(type);
          if (!reCheck.allowed) {
            this.providerStats[type].failureCount++;
            throw new Error(`RESOURCE_LIMIT_EXCEEDED:${type.toUpperCase()}`);
          }
        }

        try {
          this.incrementUsage(type);
          const result = await operation();
          
          // Successful call: reset consecutive failures
          this.resetCircuit(type);
          
          const latency = Date.now() - startTime;
          this.providerStats[type].successCount++;
          this.providerStats[type].totalLatencyMs += latency;
          this.providerStats[type].averageLatencyMs = Math.round(this.providerStats[type].totalLatencyMs / this.providerStats[type].successCount);
          
          return result;
        } catch (err: any) {
          lastError = err;
          const status = err.status || err.statusCode || (err.message && err.message.match(/\d+/)?.[0]);
          const msg = (err.message || '').toLowerCase();
          const isRateLimit = status === 429 || String(status) === '429' || msg.includes('429') || msg.includes('resource_exhausted') || msg.includes('quota') || msg.includes('rate limit') || msg.includes('rate_limit');
          const isTimeout = status === 408 || String(status) === '408' || (err.message && err.message.includes('timeout'));
          const isServerError = status >= 500 || (err.message && (err.message.includes('500') || err.message.includes('502') || err.message.includes('503')));
          
          if (isRateLimit) this.providerStats[type].rateLimitCount++;
          if (isTimeout) this.providerStats[type].timeoutCount++;

          const shouldRetry = (isRateLimit || isTimeout || isServerError) && attempt < maxRetries;
          
          if (!shouldRetry) {
            this.recordCircuitFailure(type, err?.message || 'Operation failed');
            this.providerStats[type].failureCount++;
            const latency = Date.now() - startTime;
            this.providerStats[type].totalLatencyMs += latency;
            this.providerStats[type].averageLatencyMs = Math.round(this.providerStats[type].totalLatencyMs / (this.providerStats[type].successCount || 1));
            throw err;
          }

          const baseDelay = isRateLimit ? 3000 : 1500;
          const jitter = Math.random() * 1000;
          const delay = Math.pow(2, attempt) * baseDelay + jitter;
          console.warn(`[Governor] ${operationName} failed (status ${status}). Attempt ${attempt}/${maxRetries}. Retrying in ${Math.round(delay)}ms... Error: ${err.message}`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
      this.recordCircuitFailure(type, lastError?.message || 'Operation failed');
      this.providerStats[type].failureCount++;
      const latency = Date.now() - startTime;
      this.providerStats[type].totalLatencyMs += latency;
      this.providerStats[type].averageLatencyMs = Math.round(this.providerStats[type].totalLatencyMs / (this.providerStats[type].successCount || 1));
      throw lastError || new Error(`${operationName} failed after ${maxRetries} attempts`);
    } finally {
      this.releaseConcurrencyToken(type);
    }
  }
}

export const ResourceGovernor = new ResourceGovernorClass();

