import fs from 'fs';
import path from 'path';
import { config as loadDotEnv } from 'dotenv';
import { getProjectRoot, isTestProcess } from './db_paths';
import { assertSafeHeaderValue } from './utils/header_encoder';
import { readProviderResponse, validateProviderEnvelope } from './provider_response';
import { CredentialStorageError, decodeCredentials, encodeCredentials } from './credential_store';

// Use the same validated, executable-first root as databases and health identity.
// An unrelated working directory must not supply credentials or receive saves.
const REPO_ROOT = getProjectRoot();

// Optionally load a local .env (AI Studio secrets / local dev). Never overrides
// already-exported environment variables and never breaks startup if absent.
try {
  if (!isTestProcess()) loadDotEnv({ path: path.join(REPO_ROOT, '.env'), quiet: true, override: false });
} catch {
  // .env is optional.
}

// Canonical write target for API-key config. Precedence:
//   1. EDGEVIEW_CONFIG env override (any mode; tests use this for isolation)
//   2. test processes -> .test-cache/config.json (NEVER the production file)
//   3. validated application-root config.json (stable across cwd).
export function getConfigPath(): string {
  const override = process.env.EDGEVIEW_CONFIG;
  if (override && override.trim()) {
    return path.resolve(override.trim());
  }
  if (isTestProcess()) {
    const dir = process.env.EDGEVIEW_TEST_DB_DIR || path.join(process.cwd(), '.test-cache');
    return path.join(dir, 'config.json');
  }
  return path.join(REPO_ROOT, 'config.json');
}

// Reads and writes share one canonical target. Missing files never fall through
// to an unrelated cwd or another installation's credentials.
function configReadPath(): string {
  return getConfigPath();
}

export interface AppSettings {
  serper_api_key: string;
  firecrawl_api_key: string;
  nvidia_api_key: string;
  nvidia_model: string;
  nvidia_temperature: number;
  nvidia_max_tokens: number;
  nvidia_fallback_model: string;
  nvidia_base_url: string;
  nvidia_reasoning_mode?: 'INSTRUCT' | 'THINKING';
  groq_api_key: string;
  groq_model: string;
  groq_temperature: number;
  groq_max_tokens: number;
  groq_fallback_model: string;
  gemini_api_key: string;
  gemini_model?: string;
  primary_ai_provider: 'NVIDIA' | 'GROQ' | 'GEMINI';
  api_timeout_seconds: number;
  
  // New Providers
  hunter_api_key: string;
  tavily_api_key: string;
  exa_api_key: string;
  linkup_api_key: string;
  apify_api_key: string;

  // Enable/Disable toggles
  serper_enabled: boolean;
  firecrawl_enabled: boolean;
  nvidia_enabled: boolean;
  groq_enabled: boolean;
  gemini_enabled: boolean;
  hunter_enabled: boolean;
  tavily_enabled: boolean;
  exa_enabled: boolean;
  linkup_enabled: boolean;
  apify_enabled: boolean;
}

export const DEFAULT_NVIDIA_MODEL = 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning';
const DEPRECATED_NVIDIA_MODELS = new Set([
  'nvidia/llama-3.1-nemotron-70b-instruct',
  'meta/llama-3.3-70b-instruct',
]);

const DEFAULT_SETTINGS: AppSettings = {
  serper_api_key: '',
  firecrawl_api_key: '',
  nvidia_api_key: '',
  nvidia_model: DEFAULT_NVIDIA_MODEL,
  nvidia_temperature: 0.7,
  nvidia_max_tokens: 1024,
  nvidia_fallback_model: DEFAULT_NVIDIA_MODEL,
  nvidia_base_url: '',
  nvidia_reasoning_mode: 'INSTRUCT',
  groq_api_key: '',
  groq_model: 'openai/gpt-oss-120b',
  groq_temperature: 0.7,
  groq_max_tokens: 1024,
  groq_fallback_model: 'openai/gpt-oss-20b',
  gemini_api_key: '',
  gemini_model: 'gemini-3.6-flash',
  primary_ai_provider: 'NVIDIA',
  api_timeout_seconds: 30,

  hunter_api_key: '',
  tavily_api_key: '',
  exa_api_key: '',
  linkup_api_key: '',
  apify_api_key: '',

  serper_enabled: true,
  firecrawl_enabled: false,
  nvidia_enabled: true,
  groq_enabled: true,
  gemini_enabled: false,
  hunter_enabled: true,
  tavily_enabled: false,
  exa_enabled: false,
  linkup_enabled: false,
  apify_enabled: false,
};

function migrateDeprecatedNvidiaModels(settings: AppSettings): AppSettings {
  const migrated = { ...settings };
  if (DEPRECATED_NVIDIA_MODELS.has(migrated.nvidia_model)) migrated.nvidia_model = DEFAULT_NVIDIA_MODEL;
  if (DEPRECATED_NVIDIA_MODELS.has(migrated.nvidia_fallback_model)) migrated.nvidia_fallback_model = DEFAULT_NVIDIA_MODEL;
  if (migrated.nvidia_reasoning_mode !== 'THINKING') migrated.nvidia_reasoning_mode = 'INSTRUCT';
  if (migrated.primary_ai_provider !== 'GROQ') migrated.primary_ai_provider = 'NVIDIA';
  return migrated;
}

export function getAppSettings(): AppSettings {
  try {
    const cfgPath = configReadPath();
    if (fs.existsSync(cfgPath)) {
      const raw = fs.readFileSync(cfgPath, 'utf-8');
      if (raw.trim()) {
        const parsed = decodeCredentials(JSON.parse(raw)) as Partial<AppSettings>;
        return migrateDeprecatedNvidiaModels({
          ...DEFAULT_SETTINGS,
          ...parsed,
          serper_api_key: parsed.serper_api_key ?? process.env.SERPER_API_KEY ?? '',
          firecrawl_api_key: parsed.firecrawl_api_key ?? process.env.FIRECRAWL_API_KEY ?? '',
          nvidia_api_key: parsed.nvidia_api_key ?? process.env.NVIDIA_API_KEY ?? '',
          groq_api_key: parsed.groq_api_key ?? process.env.GROQ_API_KEY ?? '',
          hunter_api_key: parsed.hunter_api_key ?? process.env.HUNTER_API_KEY ?? '',
          tavily_api_key: parsed.tavily_api_key ?? process.env.TAVILY_API_KEY ?? '',
          exa_api_key: parsed.exa_api_key ?? process.env.EXA_API_KEY ?? '',
          linkup_api_key: parsed.linkup_api_key ?? process.env.LINKUP_API_KEY ?? '',
          apify_api_key: parsed.apify_api_key ?? process.env.APIFY_API_KEY ?? '',
          gemini_api_key: parsed.gemini_api_key ?? process.env.GEMINI_API_KEY ?? '',
        });
      }
    }
  } catch (err) {
    if (err instanceof CredentialStorageError) throw err;
    // A damaged file must never fall back to environment keys and then be saved
    // over the only recoverable credential state.
    throw new CredentialStorageError();
  }

  return migrateDeprecatedNvidiaModels({
    ...DEFAULT_SETTINGS,
    serper_api_key: process.env.SERPER_API_KEY || '',
    firecrawl_api_key: process.env.FIRECRAWL_API_KEY || '',
    nvidia_api_key: process.env.NVIDIA_API_KEY || '',
    groq_api_key: process.env.GROQ_API_KEY || '',
    hunter_api_key: process.env.HUNTER_API_KEY || '',
    tavily_api_key: process.env.TAVILY_API_KEY || '',
    exa_api_key: process.env.EXA_API_KEY || '',
    linkup_api_key: process.env.LINKUP_API_KEY || '',
    apify_api_key: process.env.APIFY_API_KEY || '',
    gemini_api_key: process.env.GEMINI_API_KEY || '',
  });
}

/** Read a specific settings snapshot without changing the configured write target. */
export function getAppSettingsFromPath(filePath: string): AppSettings {
  const resolved = path.resolve(filePath);
  const raw = fs.readFileSync(resolved, 'utf-8');
  const parsed = (raw.trim() ? decodeCredentials(JSON.parse(raw)) : {}) as Partial<AppSettings>;
  return migrateDeprecatedNvidiaModels({
    ...DEFAULT_SETTINGS,
    ...parsed,
    serper_api_key: parsed.serper_api_key ?? process.env.SERPER_API_KEY ?? '',
    firecrawl_api_key: parsed.firecrawl_api_key ?? process.env.FIRECRAWL_API_KEY ?? '',
    nvidia_api_key: parsed.nvidia_api_key ?? process.env.NVIDIA_API_KEY ?? '',
    groq_api_key: parsed.groq_api_key ?? process.env.GROQ_API_KEY ?? '',
    hunter_api_key: parsed.hunter_api_key ?? process.env.HUNTER_API_KEY ?? '',
    tavily_api_key: parsed.tavily_api_key ?? process.env.TAVILY_API_KEY ?? '',
    exa_api_key: parsed.exa_api_key ?? process.env.EXA_API_KEY ?? '',
    linkup_api_key: parsed.linkup_api_key ?? process.env.LINKUP_API_KEY ?? '',
    apify_api_key: parsed.apify_api_key ?? process.env.APIFY_API_KEY ?? '',
    gemini_api_key: parsed.gemini_api_key ?? process.env.GEMINI_API_KEY ?? '',
  });
}

export function resolveApiKey(providedKey?: string, storedKey?: string): string {
  if (!providedKey || typeof providedKey !== 'string') {
    return storedKey ? storedKey.trim() : '';
  }
  const clean = providedKey.trim();
  if (!clean || clean.includes('•') || clean.includes('*')) {
    return storedKey ? storedKey.trim() : '';
  }
  return clean;
}

export function maskKey(key: string | undefined): string {
  if (!key || !key.trim()) return '';
  const trimmed = key.trim();
  if (trimmed.length <= 8) return '••••••••';
  return trimmed.substring(0, 4) + '••••••••' + trimmed.substring(trimmed.length - 4);
}

// Atomic write: fully write + fsync a temp file before promoting it over the
// target. A crash must never leave a partial API-key config as the final file.
function atomicWriteJson(filePath: string, data: unknown): void {
  const dir = path.dirname(filePath);
  if (dir && !fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmpPath = path.join(dir, `.config.${process.pid}.${Date.now()}.tmp`);
  let handle: number | undefined;
  try {
    handle = fs.openSync(tmpPath, 'wx');
    fs.writeFileSync(handle, JSON.stringify(data, null, 2), { encoding: 'utf8' });
    fs.fsyncSync(handle);
    fs.closeSync(handle);
    handle = undefined;
    fs.renameSync(tmpPath, filePath);
  } catch (err) {
    if (handle !== undefined) {
      try { fs.closeSync(handle); } catch { /* best-effort cleanup */ }
    }
    try { if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath); } catch { /* best-effort cleanup */ }
    throw err;
  }
}

// Reset is the only operation that intentionally keeps a recoverable previous
// credential state. Keep exactly one rolling copy beside the active config.
// Test configs never create backups, preventing secrets/fixtures from leaking
// into repo-local agent history.
function backupConfigForReset(): string | null {
  if (isTestProcess()) return null;
  const src = getConfigPath();
  if (!src || !fs.existsSync(src)) return null;
  const backupPath = path.join(path.dirname(src), 'config.prev.json');
  try {
    atomicWriteJson(backupPath, encodeCredentials(getAppSettingsFromPath(src)));
    try { fs.chmodSync(backupPath, 0o600); } catch { /* Windows may ignore POSIX modes */ }
    return backupPath;
  } catch (err) {
    throw new CredentialStorageError();
  }
}

export function saveAppSettings(settings: Partial<AppSettings>): AppSettings {
  const current = getAppSettings();
  
  const updatedKey = (newKey: string | undefined, oldKey: string): string => {
    if (newKey === undefined) return oldKey;
    const trimmed = newKey.trim();
    if (!trimmed) return oldKey; // Blank key: DO NOT overwrite existing secret
    if (trimmed.includes('•') || trimmed.includes('*')) return oldKey; // Masked key: DO NOT overwrite
    return trimmed;
  };

  const updated: AppSettings = migrateDeprecatedNvidiaModels({
    ...current,
    ...settings,
    serper_api_key: updatedKey(settings.serper_api_key, current.serper_api_key),
    firecrawl_api_key: updatedKey(settings.firecrawl_api_key, current.firecrawl_api_key),
    nvidia_api_key: updatedKey(settings.nvidia_api_key, current.nvidia_api_key),
    groq_api_key: updatedKey(settings.groq_api_key, current.groq_api_key),
    hunter_api_key: updatedKey(settings.hunter_api_key, current.hunter_api_key),
    tavily_api_key: updatedKey(settings.tavily_api_key, current.tavily_api_key),
    exa_api_key: updatedKey(settings.exa_api_key, current.exa_api_key),
    linkup_api_key: updatedKey(settings.linkup_api_key, current.linkup_api_key),
    apify_api_key: updatedKey(settings.apify_api_key, current.apify_api_key),
    gemini_api_key: updatedKey(settings.gemini_api_key, current.gemini_api_key),
  });

  try {
    atomicWriteJson(getConfigPath(), isTestProcess() ? updated : encodeCredentials(updated));
    // Runtime consumers reload the canonical settings; saved secrets must not
    // be copied into process.env and inherited by unrelated child processes.
  } catch (err) {
    console.error('Error saving config.json:', err);
    throw err;
  }

  return updated;
}

export function resetAppSettings(): AppSettings {
  try {
    backupConfigForReset();
    atomicWriteJson(getConfigPath(), DEFAULT_SETTINGS);
  } catch (err) {
    console.error('Error resetting config.json:', err);
    throw err;
  }
  return DEFAULT_SETTINGS;
}

/** Call only after exclusive backend ownership, never from a read or launcher. */
export function protectStoredCredentialsAtStartup(): void {
  if (isTestProcess()) return;
  const active = getConfigPath();
  for (const filePath of [active, path.join(path.dirname(active), 'config.prev.json')]) {
    if (!fs.existsSync(filePath)) continue;
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    // Validate existing protected snapshots too; never silently replace failures.
    decodeCredentials(raw);
    if (!Object.hasOwn(raw, '_edgeview_credentials')) {
      const settings = getAppSettingsFromPath(filePath);
      atomicWriteJson(filePath, encodeCredentials(settings));
    }
  }
}

export async function testHunterKey(key: string): Promise<{ success: boolean; message: string }> {
  if (!key || !key.trim()) return { success: false, message: 'Hunter API Key is empty' };
  try {
    const res = await fetch(`https://api.hunter.io/v2/domain-search?domain=example.com&api_key=${encodeURIComponent(key.trim())}`, {
      redirect: 'error', signal: AbortSignal.timeout(20_000),
    });
    if (res.status === 200) {
      const captured = await readProviderResponse(res, 256 * 1024);
      if (captured.failure) return { success: false, message: captured.failure.message };
      validateProviderEnvelope(captured.body, 'hunter');
      return { success: true, message: 'Hunter API key connection verified!' };
    } else if (res.status === 401 || res.status === 403) {
      return { success: false, message: 'Invalid Hunter API Key (Unauthorized)' };
    } else {
      const data = await res.json().catch(() => ({}));
      const detail = data.errors?.[0]?.details || `Hunter API returned status ${res.status}`;
      const message = res.status === 429 || /limit|quota|billing period/i.test(String(detail))
        ? `Hunter quota is exhausted. Disable Hunter until the billing quota resets; Serper enrichment remains available. (${detail})`
        : detail;
      return { success: false, message };
    }
  } catch (err: any) {
    return { success: false, message: err?.message || 'Failed to connect to Hunter API' };
  }
}

export async function testSerperKey(key: string): Promise<{ success: boolean; message: string }> {
  if (!key || !key.trim()) {
    return { success: false, message: 'Serper API Key is empty' };
  }

  try {
    const res = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(20_000),
      headers: {
        'X-API-KEY': assertSafeHeaderValue(key.trim(), 'Serper API key'),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ q: 'test' }),
    });

    if (res.status === 200) {
      const captured = await readProviderResponse(res, 256 * 1024);
      if (captured.failure) return { success: false, message: captured.failure.message };
      validateProviderEnvelope(captured.body, 'serper');
      return { success: true, message: 'Serper API key connection verified!' };
    } else if (res.status === 403 || res.status === 401) {
      return { success: false, message: 'Invalid Serper API Key (Unauthorized)' };
    } else {
      const data = await res.json().catch(() => ({}));
      return {
        success: false,
        message: data.message || `Serper API returned status ${res.status}`,
      };
    }
  } catch (err: any) {
    return { success: false, message: err?.message || 'Failed to connect to Serper API' };
  }
}

import { NvidiaProvider, GroqProvider } from './ai_providers';

export async function testNvidiaKey(key: string, model: string, baseUrl?: string): Promise<{ success: boolean; message: string }> {
  if (!key || !key.trim()) return { success: false, message: 'NVIDIA API Key is empty' };
  const res = await NvidiaProvider.testConnection(key, model, baseUrl);
  return { success: res.success, message: res.message };
}

export async function testGroqKey(key: string, model: string): Promise<{ success: boolean; message: string }> {
  if (!key || !key.trim()) return { success: false, message: 'Groq API Key is empty' };
  const res = await GroqProvider.testConnection(key, model);
  return { success: res.success, message: res.message };
}
