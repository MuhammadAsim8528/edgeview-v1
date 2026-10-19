import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'edgeview-dotenv-isolation-'));
try {
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'edgeview', type: 'module' }));
  fs.writeFileSync(path.join(root, '.env'), 'EDGEVIEW_DOTENV_SENTINEL=synthetic-dotenv-value\nNVIDIA_API_KEY=synthetic-dotenv-key\n');
  const config = path.join(root, 'config.json');
  fs.writeFileSync(config, '{}');
  const env: NodeJS.ProcessEnv = { ...process.env, EDGEVIEW_TEST_MODE: '1', EDGEVIEW_CONFIG: config };
  delete env.NVIDIA_API_KEY;
  delete env.EDGEVIEW_DOTENV_SENTINEL;
  const moduleUrl = new URL('../settings.ts', import.meta.url).href;
  const code = `const { getAppSettings } = await import(${JSON.stringify(moduleUrl)}); if (process.env.EDGEVIEW_DOTENV_SENTINEL || getAppSettings().nvidia_api_key) throw new Error('Test process loaded a local dotenv credential'); console.log('isolated');`;
  const child = spawnSync(process.execPath, ['--import', import.meta.resolve('tsx'), '--input-type=module', '-e', code], { cwd: root, env, encoding: 'utf8', timeout: 10000 });
  assert.equal(child.status, 0, child.stderr);
  assert.equal(child.stdout.trim(), 'isolated');
  console.log('PASS test-mode settings do not load local dotenv credentials.');
} finally { fs.rmSync(root, { recursive: true, force: true }); }
