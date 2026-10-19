import { NvidiaProvider } from './ai_providers';
import {
  buildAIExecutionPlan,
  executeAIPlan,
  resolveNvidiaRequestProfile,
  sanitizeProviderError,
  type AIExecutionPlan,
  type NvidiaRequestProfile,
} from './ai_execution_plan';
import type { AppSettings } from './settings';
import { getModelContextTokens } from './evidence_packaging';

export interface NvidiaDiagnosticStage {
  stage: 'CATALOG' | 'MINIMAL_INFERENCE' | 'PROFILE_INFERENCE' | 'EXACT_PRODUCTION_PAYLOAD';
  status: 'PASS' | 'FAIL' | 'SKIPPED';
  model?: string;
  profile?: NvidiaRequestProfile;
  latency_ms: number;
  model_count?: number;
  configured_model_available?: boolean;
  error_class?: 'AUTH' | 'REQUEST_CONFIGURATION' | 'RATE_LIMIT' | 'UPSTREAM' | 'NETWORK' | 'UNKNOWN';
  message?: string;
}

export interface NvidiaDiagnosticReport {
  enabled: boolean;
  configured: boolean;
  model: string;
  profile: NvidiaRequestProfile;
  stages: NvidiaDiagnosticStage[];
}

function errorClass(error: unknown): NvidiaDiagnosticStage['error_class'] {
  const message = String((error as any)?.message || error || '');
  const status = Number((error as any)?.status || message.match(/\b([45]\d\d)\b/)?.[1] || 0);
  if (status === 401 || status === 403) return 'AUTH';
  if (status === 400 || status === 404 || status === 422) return 'REQUEST_CONFIGURATION';
  if (status === 429) return 'RATE_LIMIT';
  if (status >= 500) return 'UPSTREAM';
  if (/fetch|network|socket|dns|abort|timeout/i.test(message)) return 'NETWORK';
  return 'UNKNOWN';
}

function diagnosticPlan(
  settings: AppSettings,
  profile: NvidiaRequestProfile,
  maxTokens: number,
  temperature: number,
): AIExecutionPlan {
  return {
    provider: 'nvidia',
    model: settings.nvidia_model,
    enabled: true,
    contextWindow: getModelContextTokens('nvidia', settings.nvidia_model),
    maxTokens,
    temperature,
    timeoutMs: Math.max(1, settings.api_timeout_seconds || 30) * 1000,
    retryPolicy: { maxRetries: 1, baseDelayMs: 0 },
    requestProfile: profile,
  };
}

async function inferenceStage(
  stage: NvidiaDiagnosticStage['stage'],
  plan: AIExecutionPlan,
  settings: AppSettings,
): Promise<NvidiaDiagnosticStage> {
  const started = Date.now();
  try {
    await executeAIPlan(plan, 'Reply exactly OK.', settings, `NVIDIA diagnostic ${stage}`);
    return { stage, status: 'PASS', model: plan.model, profile: plan.requestProfile, latency_ms: Date.now() - started };
  } catch (error) {
    return {
      stage,
      status: 'FAIL',
      model: plan.model,
      profile: plan.requestProfile,
      latency_ms: Date.now() - started,
      error_class: errorClass(error),
      message: sanitizeProviderError((error as any)?.message || error),
    };
  }
}

export async function runNvidiaDiagnostics(settings: AppSettings): Promise<NvidiaDiagnosticReport> {
  const profile = resolveNvidiaRequestProfile(settings.nvidia_model, settings.nvidia_reasoning_mode);
  const report: NvidiaDiagnosticReport = {
    enabled: settings.nvidia_enabled !== false,
    configured: Boolean(settings.nvidia_api_key?.trim()),
    model: settings.nvidia_model,
    profile,
    stages: [],
  };
  if (!report.enabled || !report.configured) {
    const reason = !report.enabled ? 'NVIDIA is disabled; no outbound diagnostic calls were made.' : 'NVIDIA is not configured.';
    for (const stage of ['CATALOG', 'MINIMAL_INFERENCE', 'PROFILE_INFERENCE', 'EXACT_PRODUCTION_PAYLOAD'] as const) {
      report.stages.push({ stage, status: 'SKIPPED', latency_ms: 0, message: reason });
    }
    return report;
  }

  const catalogStarted = Date.now();
  try {
    const models = await NvidiaProvider.listModels(settings.nvidia_api_key, settings.nvidia_base_url);
    report.stages.push({
      stage: 'CATALOG', status: 'PASS', latency_ms: Date.now() - catalogStarted,
      model_count: models.length, configured_model_available: models.some((item) => item.id === settings.nvidia_model),
    });
  } catch (error) {
    report.stages.push({
      stage: 'CATALOG', status: 'FAIL', latency_ms: Date.now() - catalogStarted,
      error_class: errorClass(error), message: sanitizeProviderError((error as any)?.message || error),
    });
  }

  report.stages.push(await inferenceStage('MINIMAL_INFERENCE', diagnosticPlan(settings, 'STANDARD', 16, 0), settings));
  report.stages.push(await inferenceStage('PROFILE_INFERENCE', diagnosticPlan(settings, profile, 32, 0), settings));

  try {
    const productionPlan = buildAIExecutionPlan(settings, { preferredProvider: 'nvidia' });
    if (productionPlan.provider !== 'nvidia') throw new Error('NVIDIA could not be selected by the production execution plan');
    report.stages.push(await inferenceStage('EXACT_PRODUCTION_PAYLOAD', { ...productionPlan, fallbackPlan: undefined, retryPolicy: { maxRetries: 1, baseDelayMs: 0 } }, settings));
  } catch (error) {
    report.stages.push({
      stage: 'EXACT_PRODUCTION_PAYLOAD', status: 'FAIL', latency_ms: 0,
      model: settings.nvidia_model, profile, error_class: errorClass(error),
      message: sanitizeProviderError((error as any)?.message || error),
    });
  }
  return report;
}
