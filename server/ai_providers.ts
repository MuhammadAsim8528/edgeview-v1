import { getAppSettings, resolveApiKey } from './settings';
import { assertSafeHeaderValue } from './utils/header_encoder';
import { assertSafeOutboundUrl, isSafeExternalUrl } from './url_safety';

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
}

export interface AIProvider {
  name: 'NVIDIA' | 'GROQ';
  listModels(apiKey: string, baseUrl?: string): Promise<AIModelInfo[]>;
  testConnection(apiKey: string, selectedModel?: string, baseUrl?: string): Promise<ProviderTestResult>;
}

// In-memory cache for models
interface CacheEntry {
  models: AIModelInfo[];
  timestamp: number;
}
const modelCache: Record<string, CacheEntry> = {};
const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes cache

export const NvidiaProvider: AIProvider = {
  name: 'NVIDIA',
  async listModels(apiKey: string, baseUrl?: string): Promise<AIModelInfo[]> {
    if (!apiKey || !apiKey.trim()) {
      throw new Error('NVIDIA API Key is missing or empty');
    }
    const cleanKey = apiKey.trim();
    assertSafeHeaderValue(`Bearer ${cleanKey}`, 'NVIDIA API key');

    const endpoint = (baseUrl?.trim() || 'https://integrate.api.nvidia.com/v1').replace(/\/+$/, '');
    if (!isSafeExternalUrl(endpoint)) {
      throw new Error('Blocked: NVIDIA base URL is not a safe external http(s) address (SSRF guard)');
    }

    const res = await fetch(`${endpoint}/models`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${cleanKey}`,
        'Accept': 'application/json',
      },
    });

    if (res.status === 401 || res.status === 403) {
      throw new Error('Invalid NVIDIA API Key (Unauthorized)');
    }
    if (res.status === 429) {
      throw new Error('NVIDIA API rate limit exceeded');
    }
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      const msg = errJson.message || errJson.error?.message || `NVIDIA API error (Status ${res.status})`;
      throw new Error(msg);
    }

    const data = await res.json();
    const rawList = Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []);

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
    try {
      const models = await this.listModels(apiKey, baseUrl);
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
      };
    } catch (err: any) {
      return {
        success: false,
        message: err?.message || 'Failed to connect to NVIDIA NIM endpoint',
        modelAvailable: false,
      };
    }
  },
};

export const GroqProvider: AIProvider = {
  name: 'GROQ',
  async listModels(apiKey: string): Promise<AIModelInfo[]> {
    if (!apiKey || !apiKey.trim()) {
      throw new Error('Groq API Key is missing or empty');
    }
    const cleanKey = apiKey.trim();
    assertSafeHeaderValue(`Bearer ${cleanKey}`, 'Groq API key');
    const endpoint = 'https://api.groq.com/openai/v1/models';

    const res = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${cleanKey}`,
        'Accept': 'application/json',
      },
    });

    if (res.status === 401 || res.status === 403) {
      throw new Error('Invalid Groq API Key (Unauthorized)');
    }
    if (res.status === 429) {
      throw new Error('Groq API rate limit exceeded');
    }
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      const msg = errJson.error?.message || errJson.message || `Groq API error (Status ${res.status})`;
      throw new Error(msg);
    }

    const data = await res.json();
    const rawList = Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []);

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
    try {
      const models = await this.listModels(apiKey);
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
      };
    } catch (err: any) {
      return {
        success: false,
        message: err?.message || 'Failed to connect to Groq endpoint',
        modelAvailable: false,
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

  if (provider.name === 'NVIDIA' && effectiveBaseUrl?.trim()) {
    await assertSafeOutboundUrl(effectiveBaseUrl.trim());
  }

  if (!effectiveKey || !effectiveKey.trim()) {
    throw new Error(`${provider.name} API Key is not configured. Please enter a valid API key.`);
  }

  const cacheKey = `${provider.name}:${effectiveKey.trim().slice(-6)}:${(effectiveBaseUrl || '').trim()}`;
  const now = Date.now();

  if (!bypassCache && modelCache[cacheKey] && now - modelCache[cacheKey].timestamp < CACHE_TTL_MS) {
    return {
      models: modelCache[cacheKey].models,
      cached: true,
      lastUpdated: new Date(modelCache[cacheKey].timestamp).toISOString(),
    };
  }

  const models = await provider.listModels(effectiveKey, effectiveBaseUrl);
  modelCache[cacheKey] = {
    models,
    timestamp: now,
  };

  return {
    models,
    cached: false,
    lastUpdated: new Date(now).toISOString(),
  };
}
