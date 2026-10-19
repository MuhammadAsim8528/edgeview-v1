import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.NODE_ENV = 'test';
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'edgeview-provider-settings-'));
process.env.EDGEVIEW_CONFIG = path.join(dir, 'config.json');
fs.writeFileSync(process.env.EDGEVIEW_CONFIG, '{}', 'utf8');

const { getAppSettings, saveAppSettings } = await import('../settings');
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
assert.equal(process.env.GROQ_API_KEY, 'test-groq-key');
assert.equal(process.env.NVIDIA_API_KEY, 'test-nvidia-key');

fs.rmSync(dir, { recursive: true, force: true });
console.log('provider_settings_runtime_sync.test.ts: PASS');
