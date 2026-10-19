import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

process.env.NODE_ENV = 'test';
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'edgeview-provider-settings-'));
process.env.EDGEVIEW_CONFIG = path.join(dir, 'config.json');
fs.writeFileSync(process.env.EDGEVIEW_CONFIG, '{}', 'utf8');

process.env.GROQ_API_KEY = 'startup-env-groq';
process.env.NVIDIA_API_KEY = 'startup-env-nvidia';
const { getAppSettings, getAppSettingsFromPath, saveAppSettings, resetAppSettings } = await import('../settings');
const defaults = getAppSettings();
assert.equal(defaults.groq_model, 'openai/gpt-oss-120b');
assert.equal(defaults.groq_fallback_model, 'openai/gpt-oss-20b');

saveAppSettings({
  groq_api_key: 'test-groq-key',
  nvidia_api_key: 'test-nvidia-key',
  groq_model: 'user-selected-model',
  gemini_model: 'user-selected-gemini-model',
});
const reloaded = getAppSettings();
assert.equal(reloaded.groq_model, 'user-selected-model');
assert.equal(reloaded.gemini_model, 'user-selected-gemini-model');
assert.equal(reloaded.groq_api_key, 'test-groq-key');
assert.equal(reloaded.nvidia_api_key, 'test-nvidia-key');
assert.equal(process.env.GROQ_API_KEY, 'startup-env-groq');
assert.equal(process.env.NVIDIA_API_KEY, 'startup-env-nvidia');
const inherited = spawnSync(process.execPath, ['-p', 'process.env.NVIDIA_API_KEY'], { encoding: 'utf8' });
assert.equal(inherited.stdout.trim(), 'startup-env-nvidia', 'saving a key must not export it to child processes');
resetAppSettings();
assert.equal(getAppSettings().groq_api_key, '', 'reset must not resurrect a startup environment key');
assert.equal(getAppSettings().nvidia_api_key, '');
assert.equal(getAppSettingsFromPath(process.env.EDGEVIEW_CONFIG).nvidia_api_key, '', 'snapshot adapter must honor explicit empty credentials');
assert.equal(process.env.NVIDIA_API_KEY, 'startup-env-nvidia', 'settings must not mutate the startup environment');

fs.rmSync(dir, { recursive: true, force: true });
console.log('provider_settings_runtime_sync.test.ts: PASS');
