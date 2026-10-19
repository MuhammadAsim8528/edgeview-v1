import { GoogleGenAI } from '@google/genai';
import { AppSettings } from './settings';
import { ResourceGovernor } from './resource_governor';
import { isSafeExternalUrl } from './url_safety';
import { assertSafeHeaderValue } from './utils/header_encoder';
import { getModelContextTokens } from './evidence_packaging';
import { failureContextFingerprint, PersistentProviderFailureMemory } from './provider_failure_memory';

export type AIProviderName = 'nvidia' | 'groq' | 'gemini';
export type NvidiaRequestProfile = 'STANDARD' | 'NANO_OMNI_INSTRUCT' | 'NANO_OMNI_THINKING' | 'NEMOTRON_3_5_LIGHTNING';

export interface AIExecutionPlan {
  provider: AIProviderName;
  model: string;
  enabled: boolean;
  contextWindow: number;
  maxTokens: number;
  temperature: number;
  timeoutMs: number;
  retryPolicy: { maxRetries: number; baseDelayMs: number };
  requestProfile?: NvidiaRequestProfile;
  fallbackPlan?: AIExecutionPlan;
}

export interface AIExecutionResult {
  content: string;
  executedProvider: AIProviderName;
  executedModel: string;
  attempts: number;
  latencyMs: number;
}

/**
 * Builds a single canonical AIExecutionPlan based on settings, provider circuits, and available credentials.
 */
export function buildAIExecutionPlan(
  settings: AppSettings,
  options?: {
    maxTokens?: number;
    temperature?: number;
    preferredProvider?: AIProviderName;
  }
): AIExecutionPlan {
  const timeoutMs = (settings.api_timeout_seconds || 30) * 1000;
  const hasNvidia = Boolean(settings.nvidia_api_key?.trim()) && settings.nvidia_enabled !== false;
  const hasGroq = Boolean(settings.groq_api_key?.trim()) && settings.groq_enabled !== false;
  const hasGemini = Boolean(process.env.GEMINI_API_KEY?.trim()) && settings.gemini_enabled !== false;

  const nvidiaCircuit = ResourceGovernor.getCircuitStateName('nvidia');
  const groqCircuit = ResourceGovernor.getCircuitStateName('groq');
  const geminiCircuit = ResourceGovernor.getCircuitStateName('gemini');

  const nvidiaHealthy = hasNvidia && (nvidiaCircuit === 'CLOSED' || nvidiaCircuit === 'HALF-OPEN');
  const groqHealthy = hasGroq && (groqCircuit === 'CLOSED' || groqCircuit === 'HALF-OPEN');
  const geminiHealthy = hasGemini && (geminiCircuit === 'CLOSED' || geminiCircuit === 'HALF-OPEN');

  const primarySetting = (options?.preferredProvider || settings.primary_ai_provider || 'NVIDIA').toUpperCase();

  const createPlan = (
    provider: AIProviderName,
    model: string,
    fallback?: AIExecutionPlan
  ): AIExecutionPlan => {
    const providerMaxTokens = provider === 'nvidia'
      ? settings.nvidia_max_tokens
      : provider === 'groq' ? settings.groq_max_tokens : 2048;
    const providerTemperature = provider === 'nvidia'
      ? settings.nvidia_temperature
      : provider === 'groq' ? settings.groq_temperature : 0.3;
    return {
      provider,
      model,
      enabled: true,
      contextWindow: getModelContextTokens(provider, model),
      maxTokens: options?.maxTokens ?? providerMaxTokens ?? 2048,
      temperature: options?.temperature ?? providerTemperature ?? 0.3,
      timeoutMs,
      retryPolicy: { maxRetries: 2, baseDelayMs: 1500 },
      requestProfile: provider === 'nvidia' ? resolveNvidiaRequestProfile(model, settings.nvidia_reasoning_mode) : undefined,
      fallbackPlan: fallback,
    };
  };

  const nvidiaModel = settings.nvidia_model || 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning';
  const nvidiaFallbackModel = settings.nvidia_fallback_model || nvidiaModel;
  const groqModel = settings.groq_model || 'openai/gpt-oss-120b';
  const groqFallbackModel = settings.groq_fallback_model || 'openai/gpt-oss-20b';
  const geminiModel = settings.gemini_model || 'gemini-2.5-flash';

  const linkFallbacks = (plans: AIExecutionPlan[]): AIExecutionPlan | undefined => {
    if (plans.length === 0) return undefined;
    const [head, ...tail] = plans;
    return { ...head, fallbackPlan: linkFallbacks(tail) };
  };

  if (primarySetting === 'GROQ' && groqHealthy) {
    const fallbacks: AIExecutionPlan[] = [];
    if (groqFallbackModel && groqFallbackModel !== groqModel) {
      fallbacks.push(createPlan('groq', groqFallbackModel));
    }
    if (nvidiaHealthy) {
      fallbacks.push(createPlan('nvidia', nvidiaModel));
    }
    if (geminiHealthy) {
      fallbacks.push(createPlan('gemini', geminiModel));
    }
    return createPlan('groq', groqModel, linkFallbacks(fallbacks));
  }

  if (primarySetting === 'GEMINI' && geminiHealthy) {
    const fallbacks: AIExecutionPlan[] = [];
    if (nvidiaHealthy) {
      fallbacks.push(createPlan('nvidia', nvidiaModel));
    }
    if (groqHealthy) {
      fallbacks.push(createPlan('groq', groqModel));
    }
    return createPlan('gemini', geminiModel, linkFallbacks(fallbacks));
  }

  // Default to NVIDIA primary
  if (nvidiaHealthy) {
    const fallbacks: AIExecutionPlan[] = [];
    if (nvidiaFallbackModel && nvidiaFallbackModel !== nvidiaModel) {
      fallbacks.push(createPlan('nvidia', nvidiaFallbackModel));
    }
    if (groqHealthy) {
      fallbacks.push(createPlan('groq', groqModel));
    }
    if (geminiHealthy) {
      fallbacks.push(createPlan('gemini', geminiModel));
    }
    return createPlan('nvidia', nvidiaModel, linkFallbacks(fallbacks));
  }

  // If NVIDIA is not healthy, fallback to Groq or Gemini
  if (groqHealthy) {
    const fallbacks: AIExecutionPlan[] = [];
    if (geminiHealthy) {
      fallbacks.push(createPlan('gemini', geminiModel));
    }
    return createPlan('groq', groqModel, linkFallbacks(fallbacks));
  }

  if (geminiHealthy) {
    return createPlan('gemini', geminiModel);
  }

  throw new Error('No enabled AI provider has both credentials and an available circuit');
}

export function resolveNvidiaRequestProfile(
  model: string,
  mode: 'INSTRUCT' | 'THINKING' = 'INSTRUCT',
): NvidiaRequestProfile {
  const normalized = String(model || '').toLowerCase();
  if (normalized.includes('nemotron-3.5') && normalized.includes('lightning')) return 'NEMOTRON_3_5_LIGHTNING';
  if (normalized.includes('nano-omni') || normalized.includes('nano_omni')) {
    return mode === 'THINKING' ? 'NANO_OMNI_THINKING' : 'NANO_OMNI_INSTRUCT';
  }
  return 'STANDARD';
}

export function buildNvidiaChatPayload(plan: AIExecutionPlan, prompt: string): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    model: plan.model,
    messages: [{ role: 'user', content: prompt }],
    temperature: plan.temperature,
    max_tokens: plan.maxTokens,
  };
  if (plan.requestProfile === 'NANO_OMNI_INSTRUCT' || plan.requestProfile === 'NANO_OMNI_THINKING') {
    payload.top_k = 1;
    payload.chat_template_kwargs = { enable_thinking: plan.requestProfile === 'NANO_OMNI_THINKING' };
  }
  return payload;
}

export function sanitizeProviderError(value: unknown): string {
  return String(value || '')
    .replace(/Bearer\s+[^\s"']+/gi, 'Bearer [REDACTED]')
    .replace(/\b(?:nvapi|gsk|AIza)[-_A-Za-z0-9]+\b/g, '[REDACTED]')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 300);
}

/**
 * Executes a single AI provider attempt without nesting retry policies.
 */
async function executeProviderAttempt(
  provider: AIProviderName,
  model: string,
  prompt: string,
  plan: AIExecutionPlan,
  settings: AppSettings
): Promise<string> {
  const timeoutMs = plan.timeoutMs;

  if (provider === 'gemini') {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) throw new Error('Missing Gemini API Key');
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: model || 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text || '';
  }

  if (provider === 'nvidia') {
    const apiKey = settings.nvidia_api_key?.trim();
    if (!apiKey) throw new Error('Missing NVIDIA API Key');
    const endpoint = (settings.nvidia_base_url?.trim() || 'https://integrate.api.nvidia.com/v1').replace(/\/+$/, '');
    if (!isSafeExternalUrl(endpoint)) throw new Error('Blocked: NVIDIA base URL is not a safe external http(s) address (SSRF guard)');

    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`${endpoint}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${assertSafeHeaderValue(apiKey, 'NVIDIA API key')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(buildNvidiaChatPayload(plan, prompt)),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errorText = sanitizeProviderError(await res.text().catch(() => ''));
        throw { status: res.status, message: `NVIDIA API Error: ${res.status}${errorText ? ` - ${errorText}` : ''}` };
      }
      const data = await res.json();
      return data.choices?.[0]?.message?.content || '';
    } finally {
      clearTimeout(id);
    }
  }

  if (provider === 'groq') {
    const apiKey = settings.groq_api_key?.trim();
    if (!apiKey) throw new Error('Missing Groq API Key');

    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${assertSafeHeaderValue(apiKey, 'Groq API key')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: prompt }],
          temperature: plan.temperature,
          max_tokens: plan.maxTokens,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errorText = sanitizeProviderError(await res.text().catch(() => ''));
        throw { status: res.status, message: `Groq API Error: ${res.status}${errorText ? ` - ${errorText}` : ''}` };
      }
      const data = await res.json();
      return data.choices?.[0]?.message?.content || '';
    } finally {
      clearTimeout(id);
    }
  }

  throw new Error(`Unsupported provider: ${provider}`);
}

/**
 * Canonical AI Execution Engine.
 * Executes the plan with provider-local retries, fast-fails unrecoverable client errors (400, 401, 403),
 * handles rate-limits with jittered backoff, and falls back to subsequent plans if exhausted.
 */
export async function executeAIPlan(
  plan: AIExecutionPlan,
  prompt: string,
  settings: AppSettings,
  logLabel = 'AI Request'
): Promise<AIExecutionResult> {
  // Test mock support - mirrors callAi mock behavior
  if ((globalThis as any).__mockExecuteAIPlan) {
    return await (globalThis as any).__mockExecuteAIPlan(plan, prompt, settings, logLabel);
  }

  const startTime = Date.now();
  let currentPlan: AIExecutionPlan | undefined = plan;
  let lastError: any = null;
  let totalAttempts = 0;

  while (currentPlan) {
    const provider = currentPlan.provider;
    const model = currentPlan.model;
    const maxRetries = currentPlan.retryPolicy.maxRetries;
    const failureAction = `ai:${model}`;
    const contextFingerprint = failureContextFingerprint({ model, prompt });
    if (await PersistentProviderFailureMemory.shouldSuppress(provider, failureAction, contextFingerprint)) {
      lastError = new Error(`PERSISTENT_PROVIDER_SUPPRESSION:${provider}/${model}`);
      currentPlan = currentPlan.fallbackPlan;
      continue;
    }
    let planError: any = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      totalAttempts++;
      try {
        const content = await ResourceGovernor.executeWithRetry(
          provider,
          `${logLabel} [${provider}/${model}]`,
          async () => {
            return await executeProviderAttempt(provider, model, prompt, currentPlan!, settings);
          },
          1 // ResourceGovernor handles concurrency & circuit tracking without inner retry multiplication
        );

        await PersistentProviderFailureMemory.clear(provider, failureAction, contextFingerprint);
        return {
          content,
          executedProvider: provider,
          executedModel: model,
          attempts: totalAttempts,
          latencyMs: Date.now() - startTime,
        };
      } catch (err: any) {
        lastError = err;
        planError = err;
        const status = Number(err?.status || err?.statusCode || (String(err?.message || '').match(/\b([45]\d\d)\b/)?.[1] ?? 0));
        const msg = String(err?.message || '').toLowerCase();

        // 400, 401, 403: Fail fast for this provider configuration immediately without repeating identical requests
        if (status === 400 || status === 401 || status === 403 || msg.includes('unauthorized') || msg.includes('forbidden') || msg.includes('invalid api key')) {
          console.warn(`[AIExecutionPlan] ${provider}/${model} failed fast on client error (status ${status}). Trying fallback...`);
          break;
        }

        const isRateLimit = status === 429 || msg.includes('429') || msg.includes('quota') || msg.includes('rate limit');
        const isTransient = isRateLimit || status >= 500 || status === 408 || msg.includes('timeout');

        if (isTransient && attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * (isRateLimit ? 2500 : 1000) + Math.random() * 500;
          console.warn(`[AIExecutionPlan] ${provider}/${model} attempt ${attempt}/${maxRetries} failed (${status || msg}). Retrying in ${Math.round(delay)}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        } else {
          break;
        }
      }
    }

    if (planError) {
      await PersistentProviderFailureMemory.remember(provider, failureAction, contextFingerprint, planError);
    }

    currentPlan = currentPlan.fallbackPlan;
  }

  throw new Error(`All AI execution plans exhausted (${totalAttempts} attempts). Last error: ${lastError?.message || lastError}`);
}
