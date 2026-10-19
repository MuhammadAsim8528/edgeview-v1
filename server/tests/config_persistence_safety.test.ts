import assert from 'assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  getConfigPath,
  getAppSettings,
  saveAppSettings,
  resetAppSettings,
} from '../settings';
import { isTestProcess } from '../db_paths';

console.log('--- RUNNING API CONFIG PERSISTENCE & SAFETY TESTS ---');

const ENV_KEYS = ['EDGEVIEW_CONFIG', 'NVIDIA_API_KEY', 'GROQ_API_KEY', 'SERPER_API_KEY'] as const;
const savedEnv: Record<string, string | undefined> = {};

function snapshotEnv() {
  for (const k of ENV_KEYS) savedEnv[k] = process.env[k];
}
function restoreEnv() {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
}

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const AGENT_BACKUP_DIR = path.join(REPO_ROOT, '.agent', 'backups');

let tempDir = '';

function newTempDir(): string {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edgeview-cfg-test-'));
  return tempDir;
}

function tempConfigPath(): string {
  return path.join(tempDir, 'config.json');
}

function backupCount(): number {
  try {
    if (!fs.existsSync(AGENT_BACKUP_DIR)) return 0;
    return fs.readdirSync(AGENT_BACKUP_DIR).filter((f) => f.startsWith('config.backup.')).length;
  } catch {
    return 0;
  }
}

async function run() {
  snapshotEnv();

  // Guard: this suite must only run under a test process.
  assert.strictEqual(isTestProcess(), true, 'Suite must run in a test process');

  // [1] EDGEVIEW_CONFIG override is honored (write target follows it).
  newTempDir();
  const cfg = tempConfigPath();
  process.env.EDGEVIEW_CONFIG = cfg;
  assert.strictEqual(getConfigPath(), cfg, 'EDGEVIEW_CONFIG override must be honored');
  console.log('✅ Test 1: EDGEVIEW_CONFIG override drives config path');

  // [2] Without an override, a test process must never resolve to the production
  //     config.json (repo-root or cwd) — it must isolate under .test-cache.
  delete process.env.EDGEVIEW_CONFIG;
  const isolated = getConfigPath();
  assert.strictEqual(path.basename(isolated), 'config.json', 'Isolated config must be named config.json');
  assert.ok(path.dirname(isolated).endsWith('.test-cache'), `Test config must live under .test-cache, got ${isolated}`);
  console.log('✅ Test 2: Test process resolves config under .test-cache (never production)');
  process.env.EDGEVIEW_CONFIG = cfg;

  // [2b] A missing isolated test config must not fall back to production.
  delete process.env.NVIDIA_API_KEY;
  delete process.env.GROQ_API_KEY;
  delete process.env.SERPER_API_KEY;
  assert.strictEqual(getAppSettings().nvidia_api_key, '', 'Missing test config must not read production NVIDIA key');
  assert.strictEqual(getAppSettings().groq_api_key, '', 'Missing test config must not read production Groq key');
  assert.strictEqual(getAppSettings().serper_api_key, '', 'Missing test config must not read production Serper key');
  console.log('✅ Test 2b: Missing isolated config cannot fall back to production credentials');

  // [3] With an empty isolated config present, getAppSettings must NOT read the
  //     production config: all keys resolve empty (no secret leakage into tests).
  fs.writeFileSync(cfg, '{}', 'utf-8');
  const defaults = getAppSettings();
  assert.strictEqual(defaults.nvidia_api_key, '', 'nvidia key must be empty under isolated config');
  assert.strictEqual(defaults.groq_api_key, '', 'groq key must be empty under isolated config');
  assert.strictEqual(defaults.serper_api_key, '', 'serper key must be empty under isolated config');
  console.log('✅ Test 3: Isolated config read — no production keys surface in tests');

  // [4] Environment fallback works for NVIDIA/GROQ when config value is absent.
  process.env.NVIDIA_API_KEY = 'env-nvidia-test-key';
  process.env.GROQ_API_KEY = 'env-groq-test-key';
  const envSettings = getAppSettings();
  assert.strictEqual(envSettings.nvidia_api_key, 'env-nvidia-test-key', 'NVIDIA env fallback must apply');
  assert.strictEqual(envSettings.groq_api_key, 'env-groq-test-key', 'Groq env fallback must apply');
  delete process.env.NVIDIA_API_KEY;
  delete process.env.GROQ_API_KEY;
  console.log('✅ Test 4: NVIDIA/GROQ environment fallback honored (config.json > env > .env)');

  // [5] saveAppSettings persists to the override path and keeps a real key.
  saveAppSettings({ serper_api_key: 'real-serper-key-123' });
  assert.strictEqual(getAppSettings().serper_api_key, 'real-serper-key-123', 'Saved key must round-trip');
  assert.ok(fs.existsSync(cfg), 'Config file must be written to EDGEVIEW_CONFIG path');
  const writtenRaw = JSON.parse(fs.readFileSync(cfg, 'utf-8'));
  assert.strictEqual(writtenRaw.serper_api_key, 'real-serper-key-123', 'Persisted JSON must contain the key');
  process.env.SERPER_API_KEY = 'test-env-serper-key';
  assert.strictEqual(getAppSettings().serper_api_key, 'real-serper-key-123', 'Config value must win over env');
  delete process.env.SERPER_API_KEY;
  console.log('✅ Test 5: saveAppSettings writes to isolated path and persists keys (config > env)');

  // [5b] A new UI save with blank key fields must preserve every existing key.
  saveAppSettings({ serper_api_key: '', nvidia_api_key: '', groq_api_key: '' });
  assert.strictEqual(getAppSettings().serper_api_key, 'real-serper-key-123', 'UI blank key must preserve stored Serper key');
  console.log('✅ Test 5b: UI-style blank secret fields preserve stored credentials');

  // [6] Masked input must NEVER overwrite the stored secret (nor be persisted).
  saveAppSettings({ serper_api_key: 'abcd••••••••wxyz' });
  assert.strictEqual(getAppSettings().serper_api_key, 'real-serper-key-123', 'Masked key must be preserved, not replaced');
  const afterMasked = JSON.parse(fs.readFileSync(cfg, 'utf-8'));
  assert.strictEqual(afterMasked.serper_api_key, 'real-serper-key-123', 'Masked string must never be written to disk');
  assert.ok(!afterMasked.serper_api_key.includes('•'), 'No bullet characters may reach config.json');
  console.log('✅ Test 6: Masked key input preserves stored secret (nothing written)');

  // [7] Blank / undefined input must also preserve the stored secret.
  saveAppSettings({ serper_api_key: '   ' });
  assert.strictEqual(getAppSettings().serper_api_key, 'real-serper-key-123', 'Blank key must be preserved');
  saveAppSettings({ nvidia_api_key: 'real-nvidia-key-456' });
  assert.strictEqual(getAppSettings().nvidia_api_key, 'real-nvidia-key-456', 'Saved nvidia key must round-trip');
  saveAppSettings({ nvidia_api_key: undefined });
  assert.strictEqual(getAppSettings().nvidia_api_key, 'real-nvidia-key-456', 'Undefined must preserve existing key');
  console.log('✅ Test 7: Blank/undefined inputs preserve stored secrets');

  // [8] A genuinely new unmasked key replaces the stored key.
  saveAppSettings({ serper_api_key: 'new-serper-key-789' });
  assert.strictEqual(getAppSettings().serper_api_key, 'new-serper-key-789', 'New unmasked key must replace');
  console.log('✅ Test 8: New unmasked key replaces stored key');

  // [9] resetAppSettings backs up the config first and then clears keys.
  const beforeReset = backupCount();
  resetAppSettings();
  const afterReset = backupCount();
  assert.ok(afterReset > beforeReset, 'reset must create a timestamped backup before clearing');
  assert.strictEqual(getAppSettings().serper_api_key, '', 'reset must clear keys');
  assert.strictEqual(getAppSettings().nvidia_api_key, '', 'reset must clear nvidia key');
  console.log('✅ Test 9: reset backs up config then clears keys');

  console.log('🎉 ALL API CONFIG PERSISTENCE & SAFETY TESTS PASSED 100%');
}

run()
  .then(() => {
    if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true });
    restoreEnv();
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ API CONFIG PERSISTENCE & SAFETY TEST FAILED:', err);
    if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true });
    restoreEnv();
    process.exit(1);
  });
