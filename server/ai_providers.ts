import { getAppSettings, resolveApiKey } from './settings';
import { assertSafeHeaderValue } from './utils/header_encoder';
import { assertSafeOutboundUrl, isSafeExternalUrl } from './url_safety';
import { createHash } from 'node:crypto';
import { readProviderResponse, providerSchemaError } from './provider_response';

export interface AIModelInfo {
  id: string;
  name: string;
  owned_by?: string;
  context_length?: number;
  active?: boolean;
}

export interface ProviderTestResult {
  success: boolean;
  message: string;
  modelsCount?: number;
  modelAvailable?: boolean;
  lastUpdated?: string;
  httpStatus?: number | null;
}

export interface AIProvider {
  name: 'NVIDIA' | 'GROQ';
  listModels(apiKey: string, baseUrl?: string, observeStatus?: (status: number) => void): Promise<AIModelInfo[]>;
  testConnection(apiKey: string, selectedModel?: string, baseUrl?: string): Promise<ProviderTestResult>;
}

// In-memory cache for models
interface CacheEntry {
  models: AIModelInfo[];
  timestamp: number;
}
const modelCache = new Map<string, CacheEntry>();
const MAX_MODEL_CACHE_ENTRIES = 32;
const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes cache

async function readModelList(response: Response): Promise<any[]> {
  const captured = await readProviderResponse(response, 1024 * 1024, 20_000, true);
  if (captured.failure) throw providerSchemaError(captured.failure.message);
  const body = captured.body as any;
  if (body.error || (Array.isArray(body.errors) && body.errors.length)) throw providerSchemaError('Model endpoint returned an error payload');
  const models = Array.isArray(body) ? body : body.data;
  if (!Array.isArray(models) || models.some(model => typeof model !== 'string' && (!model || typeof model !== 'object' || typeof (model.id || model.name) !== 'string'))) throw providerSchemaError('Model endpoint returned an invalid model list');
  return models;
}

function assertSavedCredentialOrigin(key: string, baseUrl?: string): void {
  const settings = getAppSettings();
  if (!key || key.trim() !== settings.nvidia_api_key?.trim()) return;
  const configured = new URL(settings.nvidia_base_url?.trim() || 'https://integrate.api.nvidia.com/v1');
  const requested = new URL(baseUrl?.trim() || configured.href);
  if (requested.origin !== configured.origin) {
    throw new Error('Saved NVIDIA credentials can only be used with the configured provider origin.');
  }
}

export const NvidiaProvider: AIProvider = {
  name: 'NVIDIA',
  async listModels(apiKey: string, baseUrl?: string, observeStatus?: (status: number) => void): Promise<AIModelInfo[]> {
    if (!apiKey || !apiKey.trim()) {
      throw new Error('NVIDIA API Key is missing or empty');
    }
    const cleanKey = apiKey.trim();
    assertSavedCredentialOrigin(cleanKey, baseUrl);
    assertSafeHeaderValue(`Bearer ${cleanKey}`, 'NVIDIA API key');

    const endpoint = (baseUrl?.trim() || 'https://integrate.api.nvidia.com/v1').replace(/\/+$/, '');
    if (!isSafeExternalUrl(endpoint)) {
      throw new Error('Blocked: NVIDIA base URL is not a safe external http(s) address (SSRF guard)');
    }
    await assertSafeOutboundUrl(endpoint);

    const res = await fetch(`${endpoint}/models`, {
      method: 'GET',
      redirect: 'error',
      signal: AbortSignal.timeout(20_000),
      headers: {
        'Authorization': `Bearer ${cleanKey}`,
        'Accept': 'application/json',
      },
    });

    observeStatus?.(res.status);
    if (res.status === 401 || res.status === 403) {
      throw new Error('Invalid NVIDIA API Key (Unauthorized)');
    }
    if (res.status === 429) {
      throw new Error('NVIDIA API rate limit exceeded');
    }
    if (!res.ok) {
      const captured = await readProviderResponse(res, 256 * 1024);
      const errJson = (captured.body && typeof captured.body === 'object' ? captured.body : {}) as any;
      const msg = errJson.message || errJson.error?.message || `NVIDIA API error (Status ${res.status})`;
      throw new Error(msg);
    }

    const rawList = await readModelList(res);

    const models: AIModelInfo[] = rawList
      .map((m: any) => {
        const id = typeof m === 'string' ? m : (m.id || m.name || '');
        const name = m.id || id;
        const ownedBy = m.owned_by || m.publisher || m.org || 'nvidia';
        const contextLength = m.context_length || m.context_window || m.max_context_length || undefined;
        return {
          id,
          name,
          owned_by: ownedBy,
          context_length: typeof contextLength === 'number' ? contextLength : undefined,
          active: true,
        };
      })
      .filter((m) => Boolean(m.id));

    models.sort((a, b) => a.id.localeCompare(b.id));

    return models;
  },

  async testConnection(apiKey: string, selectedModel?: string, baseUrl?: string): Promise<ProviderTestResult> {
    if (!apiKey || !apiKey.trim()) {
      return { success: false, message: 'NVIDIA API Key not configured' };
    }
    let httpStatus: number | null = null;
    try {
      const models = await this.listModels(apiKey, baseUrl, status => { httpStatus = status; });
      let modelMsg = '';
      let modelAvailable = true;

      if (selectedModel) {
        const found = models.some((m) => m.id === selectedModel);
        if (found) {
          modelMsg = ` (Selected model '${selectedModel}' available)`;
          modelAvailable = true;
        } else {
          modelMsg = ` (Warning: Selected model '${selectedModel}' not in current model list)`;
          modelAvailable = false;
        }
      }

      return {
        success: true,
        message: `NVIDIA NIM connection successful. ${models.length} model${models.length === 1 ? '' : 's'} available.${modelMsg}`,
        modelsCount: models.length,
        modelAvailable,
        lastUpdated: new Date().toISOString(),
        httpStatus,
      };
    } catch (err: any) {
      return {
        success: false,
        message: err?.message || 'Failed to connect to NVIDIA NIM endpoint',
        modelAvailable: false,
        httpStatus,
      };
    }
  },
};

export const GroqProvider: AIProvider = {
  name: 'GROQ',
  async listModels(apiKey: string, _baseUrl?: string, observeStatus?: (status: number) => void): Promise<AIModelInfo[]> {
    if (!apiKey || !apiKey.trim()) {
      throw new Error('Groq API Key is missing or empty');
    }
    const cleanKey = apiKey.trim();
    assertSafeHeaderValue(`Bearer ${cleanKey}`, 'Groq API key');
    const endpoint = 'https://api.groq.com/openai/v1/models';

    const res = await fetch(endpoint, {
      method: 'GET',
      redirect: 'error',
      signal: AbortSignal.timeout(20_000),
      headers: {
        'Authorization': `Bearer ${cleanKey}`,
        'Accept': 'application/json',
      },
    });

    observeStatus?.(res.status);
    if (res.status === 401 || res.status === 403) {
      throw new Error('Invalid Groq API Key (Unauthorized)');
    }
    if (res.status === 429) {
      throw new Error('Groq API rate limit exceeded');
    }
    if (!res.ok) {
      const captured = await readProviderResponse(res, 256 * 1024);
      const errJson = (captured.body && typeof captured.body === 'object' ? captured.body : {}) as any;
      const msg = errJson.error?.message || errJson.message || `Groq API error (Status ${res.status})`;
      throw new Error(msg);
    }

    const rawList = await readModelList(res);

    const models: AIModelInfo[] = rawList
      .filter((m: any) => m.active !== false)
      .map((m: any) => {
        const id = typeof m === 'string' ? m : (m.id || m.name || '');
        const name = m.id || id;
        const ownedBy = m.owned_by || m.publisher || 'Groq';
        const contextLength = m.context_window || m.context_length || undefined;
        return {
          id,
          name,
          owned_by: ownedBy,
          context_length: typeof contextLength === 'number' ? contextLength : undefined,
          active: m.active !== false,
        };
      })
      .filter((m) => Boolean(m.id));

    models.sort((a, b) => a.id.localeCompare(b.id));

    return models;
  },

  async testConnection(apiKey: string, selectedModel?: string): Promise<ProviderTestResult> {
    if (!apiKey || !apiKey.trim()) {
      return { success: false, message: 'Groq API Key not configured' };
    }
    let httpStatus: number | null = null;
    try {
      const models = await this.listModels(apiKey, undefined, status => { httpStatus = status; });
      let modelMsg = '';
      let modelAvailable = true;

      if (selectedModel) {
        const found = models.some((m) => m.id === selectedModel);
        if (found) {
          modelMsg = ` (Selected model '${selectedModel}' available)`;
          modelAvailable = true;
        } else {
          modelMsg = ` (Warning: Selected model '${selectedModel}' not in current model list)`;
          modelAvailable = false;
        }
      }

      return {
        success: true,
        message: `Groq connection successful. ${models.length} model${models.length === 1 ? '' : 's'} available.${modelMsg}`,
        modelsCount: models.length,
        modelAvailable,
        lastUpdated: new Date().toISOString(),
        httpStatus,
      };
    } catch (err: any) {
      return {
        success: false,
        message: err?.message || 'Failed to connect to Groq endpoint',
        modelAvailable: false,
        httpStatus,
      };
    }
  },
};

export function getProvider(providerName: string): AIProvider {
  const norm = (providerName || '').toUpperCase();
  if (norm === 'GROQ') return GroqProvider;
  return NvidiaProvider;
}

export async function fetchProviderModels(
  providerName: string,
  apiKey?: string,
  baseUrl?: string,
  bypassCache: boolean = false
): Promise<{ models: AIModelInfo[]; cached: boolean; lastUpdated: string }> {
  const provider = getProvider(providerName);
  const settings = getAppSettings();
  const storedKey = provider.name === 'GROQ' ? settings.groq_api_key : settings.nvidia_api_key;
  const effectiveKey = resolveApiKey(apiKey, storedKey);
  const effectiveBaseUrl =
    baseUrl !== undefined && baseUrl !== '' ? baseUrl : settings.nvidia_base_url;

  // A request may not redirect a saved credential to a different public host.
  // SSRF checks alone cannot protect a credential from an attacker-owned host.
  if (provider.name === 'NVIDIA' && effectiveKey && effectiveKey === storedKey?.trim()) {
    assertSavedCredentialOrigin(effectiveKey, effectiveBaseUrl);
  }

  if (provider.name === 'NVIDIA' && effectiveBaseUrl?.trim()) {
    await assertSafeOutboundUrl(effectiveBaseUrl.trim());
  }

  if (!effectiveKey || !effectiveKey.trim()) {
    throw new Error(`${provider.name} API Key is not configured. Please enter a valid API key.`);
  }

  const keyDigest = createHash('sha256').update(effectiveKey.trim()).digest('hex');
  const cacheKey = `${provider.name}:${keyDigest}:${(effectiveBaseUrl || '').trim()}`;
  const now = Date.now();

  const cached = modelCache.get(cacheKey);
  if (!bypassCache && cached && now - cached.timestamp < CACHE_TTL_MS) {
    return {
      models: cached.models,
      cached: true,
      lastUpdated: new Date(cached.timestamp).toISOString(),
    };
  }

  const models = await provider.listModels(effectiveKey, effectiveBaseUrl);
  if (modelCache.size >= MAX_MODEL_CACHE_ENTRIES) modelCache.delete(modelCache.keys().next().value!);
  modelCache.set(cacheKey, {
    models,
    timestamp: now,
  });

  return {
    models,
    cached: false,
    lastUpdated: new Date(now).toISOString(),
  };
}
