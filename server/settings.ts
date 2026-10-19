import fs from 'fs';
import path from 'path';
import { config as loadDotEnv } from 'dotenv';
import { isTestProcess } from './db_paths';
import { assertSafeHeaderValue } from './utils/header_encoder';

// Project root resolved from this module's own location so the canonical
// config.json is found even when the server/UI is launched from a different
// working directory (previously keys appeared "lost" because the path was
// derived from process.cwd() only).
function findRepoRoot(): string {
  const starts = [process.cwd(), process.argv[1] ? path.dirname(path.resolve(process.argv[1])) : ''].filter(Boolean);
  for (const start of starts) {
    let current = path.resolve(start);
    while (true) {
      if (fs.existsSync(path.join(current, 'package.json'))) return current;
      const parent = path.dirname(current);
      if (parent === current) break;
      current = parent;
    }
  }
  return process.cwd();
}

const REPO_ROOT = findRepoRoot();

// Optionally load a local .env (AI Studio secrets / local dev). Never overrides
// already-exported environment variables and never breaks startup if absent.
try {
  loadDotEnv({ path: path.join(REPO_ROOT, '.env'), quiet: true, override: false });
} catch {
  // .env is optional.
}

// Canonical write target for API-key config. Precedence:
//   1. EDGEVIEW_CONFIG env override (any mode; tests use this for isolation)
//   2. test processes -> .test-cache/config.json (NEVER the production file)
//   3. repo-root config.json (stable across cwd), falling back to cwd for
//      existing deployments, then repo-root as the create target.
export function getConfigPath(): string {
  const override = process.env.EDGEVIEW_CONFIG;
  if (override && override.trim()) {
    return path.resolve(override.trim());
  }
  if (isTestProcess()) {
    const dir = process.env.EDGEVIEW_TEST_DB_DIR || path.join(process.cwd(), '.test-cache');
    return path.join(dir, 'config.json');
  }
  const rootConfig = path.join(REPO_ROOT, 'config.json');
  if (fs.existsSync(rootConfig)) return rootConfig;
  const cwdConfig = path.join(process.cwd(), 'config.json');
  if (fs.existsSync(cwdConfig)) return cwdConfig;
  return rootConfig;
}

// Read target: prefer the resolved config; if it does not exist yet, fall back
// to an existing production config so existing behavior (and existing test
// suites that rely on configured provider keys) keeps working. Writes ALWAYS
// go through getConfigPath(), so a test process can never write production.
function configReadPath(): string {
  const primary = getConfigPath();
  if (fs.existsSync(primary)) return primary;
  // Test processes must never fall through to a production config merely
  // because their isolated config has not been created yet. Environment-only
  // test configuration remains available through getAppSettings().
  if (isTestProcess()) return primary;
  const rootConfig = path.join(REPO_ROOT, 'config.json');
  if (rootConfig !== primary && fs.existsSync(rootConfig)) return rootConfig;
  const cwdConfig = path.join(process.cwd(), 'config.json');
  if (cwdConfig !== primary && fs.existsSync(cwdConfig)) return cwdConfig;
  return primary;
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
        const parsed = JSON.parse(raw);
        return migrateDeprecatedNvidiaModels({
          ...DEFAULT_SETTINGS,
          ...parsed,
          serper_api_key: parsed.serper_api_key || process.env.SERPER_API_KEY || '',
          firecrawl_api_key: parsed.firecrawl_api_key || process.env.FIRECRAWL_API_KEY || '',
          nvidia_api_key: parsed.nvidia_api_key || process.env.NVIDIA_API_KEY || '',
          groq_api_key: parsed.groq_api_key || process.env.GROQ_API_KEY || '',
          hunter_api_key: parsed.hunter_api_key || process.env.HUNTER_API_KEY || '',
          tavily_api_key: parsed.tavily_api_key || process.env.TAVILY_API_KEY || '',
          exa_api_key: parsed.exa_api_key || process.env.EXA_API_KEY || '',
          linkup_api_key: parsed.linkup_api_key || process.env.LINKUP_API_KEY || '',
          apify_api_key: parsed.apify_api_key || process.env.APIFY_API_KEY || '',
          gemini_api_key: parsed.gemini_api_key || process.env.GEMINI_API_KEY || '',
        });
      }
    }
  } catch (err) {
    console.error('Error reading config.json:', err);
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
  const parsed = raw.trim() ? JSON.parse(raw) : {};
  return migrateDeprecatedNvidiaModels({
    ...DEFAULT_SETTINGS,
    ...parsed,
    serper_api_key: parsed.serper_api_key || process.env.SERPER_API_KEY || '',
    firecrawl_api_key: parsed.firecrawl_api_key || process.env.FIRECRAWL_API_KEY || '',
    nvidia_api_key: parsed.nvidia_api_key || process.env.NVIDIA_API_KEY || '',
    groq_api_key: parsed.groq_api_key || process.env.GROQ_API_KEY || '',
    hunter_api_key: parsed.hunter_api_key || process.env.HUNTER_API_KEY || '',
    tavily_api_key: parsed.tavily_api_key || process.env.TAVILY_API_KEY || '',
    exa_api_key: parsed.exa_api_key || process.env.EXA_API_KEY || '',
    linkup_api_key: parsed.linkup_api_key || process.env.LINKUP_API_KEY || '',
    apify_api_key: parsed.apify_api_key || process.env.APIFY_API_KEY || '',
    gemini_api_key: parsed.gemini_api_key || process.env.GEMINI_API_KEY || '',
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
    fs.copyFileSync(src, backupPath);
    try { fs.chmodSync(backupPath, 0o600); } catch { /* Windows may ignore POSIX modes */ }
    return backupPath;
  } catch (err) {
    console.error('Failed to preserve config before reset:', err);
    return null;
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
    atomicWriteJson(getConfigPath(), updated);
    // Sync with environment variables
    process.env.SERPER_API_KEY = updated.serper_api_key;
    process.env.FIRECRAWL_API_KEY = updated.firecrawl_api_key;
    process.env.NVIDIA_API_KEY = updated.nvidia_api_key;
    process.env.GROQ_API_KEY = updated.groq_api_key;
    process.env.HUNTER_API_KEY = updated.hunter_api_key;
    process.env.TAVILY_API_KEY = updated.tavily_api_key;
    process.env.EXA_API_KEY = updated.exa_api_key;
    process.env.LINKUP_API_KEY = updated.linkup_api_key;
    process.env.APIFY_API_KEY = updated.apify_api_key;
    process.env.GEMINI_API_KEY = updated.gemini_api_key;
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
    process.env.SERPER_API_KEY = DEFAULT_SETTINGS.serper_api_key;
    process.env.FIRECRAWL_API_KEY = DEFAULT_SETTINGS.firecrawl_api_key;
    process.env.NVIDIA_API_KEY = DEFAULT_SETTINGS.nvidia_api_key;
    process.env.GROQ_API_KEY = DEFAULT_SETTINGS.groq_api_key;
    process.env.HUNTER_API_KEY = DEFAULT_SETTINGS.hunter_api_key;
    process.env.TAVILY_API_KEY = DEFAULT_SETTINGS.tavily_api_key;
    process.env.EXA_API_KEY = DEFAULT_SETTINGS.exa_api_key;
    process.env.LINKUP_API_KEY = DEFAULT_SETTINGS.linkup_api_key;
    process.env.APIFY_API_KEY = DEFAULT_SETTINGS.apify_api_key;
    process.env.GEMINI_API_KEY = DEFAULT_SETTINGS.gemini_api_key;
  } catch (err) {
    console.error('Error resetting config.json:', err);
    throw err;
  }
  return DEFAULT_SETTINGS;
}

export async function testHunterKey(key: string): Promise<{ success: boolean; message: string }> {
  if (!key || !key.trim()) return { success: false, message: 'Hunter API Key is empty' };
  try {
    const res = await fetch(`https://api.hunter.io/v2/domain-search?domain=example.com&api_key=${key.trim()}`);
    if (res.status === 200) {
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

export async function testTavilyKey(key: string): Promise<{ success: boolean; message: string }> {
  if (!key || !key.trim()) return { success: false, message: 'Tavily API Key is empty' };
  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: key.trim(), query: 'test', max_results: 1 })
    });
    if (res.status === 200) {
      return { success: true, message: 'Tavily API key connection verified!' };
    } else if (res.status === 401 || res.status === 403) {
      return { success: false, message: 'Invalid Tavily API Key (Unauthorized)' };
    } else {
      const data = await res.json().catch(() => ({}));
      return { success: false, message: data.detail || `Tavily API returned status ${res.status}` };
    }
  } catch (err: any) {
    return { success: false, message: err?.message || 'Failed to connect to Tavily API' };
  }
}

export async function testExaKey(key: string): Promise<{ success: boolean; message: string }> {
  if (!key || !key.trim()) return { success: false, message: 'Exa API Key is empty' };
  try {
    const res = await fetch('https://api.exa.ai/search', {
      method: 'POST',
      headers: {
        'x-api-key': assertSafeHeaderValue(key.trim(), 'Exa API key'),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query: 'test', numResults: 1 })
    });
    if (res.status === 200) {
      return { success: true, message: 'Exa API key connection verified!' };
    } else if (res.status === 401 || res.status === 403) {
      return { success: false, message: 'Invalid Exa API Key (Unauthorized)' };
    } else {
      const data = await res.json().catch(() => ({}));
      return { success: false, message: data.error || `Exa API returned status ${res.status}` };
    }
  } catch (err: any) {
    return { success: false, message: err?.message || 'Failed to connect to Exa API' };
  }
}

export async function testLinkupKey(key: string): Promise<{ success: boolean; message: string }> {
  if (!key || !key.trim()) return { success: false, message: 'Linkup API Key is empty' };
  try {
    const res = await fetch('https://api.linkup.so/v1/search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${assertSafeHeaderValue(key.trim(), 'Linkup API key')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ q: 'test', depth: 'fast', outputType: 'searchResults' })
    });
    if (res.status === 200) {
      return { success: true, message: 'Linkup API key connection verified!' };
    } else if (res.status === 401 || res.status === 403) {
      return { success: false, message: 'Invalid Linkup API Key (Unauthorized)' };
    } else {
      const data = await res.json().catch(() => ({}));
      return { success: false, message: data.message || `Linkup API returned status ${res.status}` };
    }
  } catch (err: any) {
    return { success: false, message: err?.message || 'Failed to connect to Linkup API' };
  }
}

export async function testSerperKey(key: string): Promise<{ success: boolean; message: string }> {
  if (!key || !key.trim()) {
    return { success: false, message: 'Serper API Key is empty' };
  }

  try {
    const res = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': assertSafeHeaderValue(key.trim(), 'Serper API key'),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ q: 'test' }),
    });

    if (res.status === 200) {
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

export async function testFirecrawlKey(key: string): Promise<{ success: boolean; message: string }> {
  if (!key || !key.trim()) {
    return { success: false, message: 'Firecrawl API Key is empty' };
  }

  try {
    const res = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${assertSafeHeaderValue(key.trim(), 'Firecrawl API key')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url: 'https://example.com' }),
    });

    if (res.status === 200) {
      return { success: true, message: 'Firecrawl API key connection verified!' };
    } else if (res.status === 401 || res.status === 403) {
      return { success: false, message: 'Invalid Firecrawl API Key (Unauthorized)' };
    } else {
      const data = await res.json().catch(() => ({}));
      if (res.status === 402) {
        return { success: true, message: 'Firecrawl API key valid (out of credits or tier limit)' };
      }
      return {
        success: false,
        message: data.error || `Firecrawl API returned status ${res.status}`,
      };
    }
  } catch (err: any) {
    return { success: false, message: err?.message || 'Failed to connect to Firecrawl API' };
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

import { ApifyProvider } from './apify';

export async function testApifyKey(key: string): Promise<{ success: boolean; message: string }> {
  if (!key || !key.trim()) return { success: false, message: 'Apify API token is empty' };
  const res = await ApifyProvider.testConnection(key);
  return { success: res.success, message: res.message };
}
