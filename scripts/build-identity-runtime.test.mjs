import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { writeBuildMetadata } from './build-metadata.mjs';
import { unusedTestPort } from './test-server-port.mjs';
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'edgeview-build-runtime-'));
const source = process.cwd();
const port = await unusedTestPort();
const base = `http://127.0.0.1:${port}`;
let child;
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/API_KEY|SECRET|TOKEN|PASSWORD|COOKIE|AUTH|^EDGEVIEW_/i.test(key)));
Object.assign(env, { NODE_ENV: 'test', PORT: String(port), NODE_PATH: path.join(source, 'node_modules'), EDGEVIEW_TEST_MODE: '1', EDGEVIEW_TEST_DB_DIR: root, EDGEVIEW_CONFIG: path.join(root, 'config.json'), EDGEVIEW_V1_DATA_DIR: path.join(root, 'runs') });
async function health() {
  const response = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(1500) });
  assert.equal(response.status, 200); const result = await response.json();
  assert.equal(result.app.pid, child.pid, 'wrong process: test must not mutate this port');
  return result;
}
async function start() {
  child = spawn(process.execPath, ['dist/server.cjs'], { cwd: root, env, stdio: 'ignore' });
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    assert.equal(child.exitCode, null, 'isolated backend exited early');
    try { return await health(); } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Isolated build-identity backend did not become healthy');
}
async function stop() {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  const exited = new Promise(resolve => child.once('exit', resolve)); child.kill('SIGTERM'); await exited;
}
try {
  fs.mkdirSync(path.join(root, 'dist'));
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'edgeview', version: '1.0.0', type: 'module' }));
  fs.writeFileSync(path.join(root, 'config.json'), JSON.stringify({ serper_enabled: false, hunter_enabled: false, nvidia_enabled: false, groq_enabled: false }));
  fs.copyFileSync(path.join(source, 'dist/server.cjs'), path.join(root, 'dist/server.cjs'));
  fs.writeFileSync(path.join(root, 'dist/index.html'), '<html>first</html>');
  const first = writeBuildMetadata(root);
  const firstHealth = await start();
  assert.equal(firstHealth.app.build.buildId, first.buildId);
  assert.equal(firstHealth.app.runtime_mode, 'production', 'static runtime mode is separate from NODE_ENV test');
  fs.writeFileSync(path.join(root, 'dist/index.html'), '<html>second</html>');
  const second = writeBuildMetadata(root);
  assert.notEqual(second.buildId, first.buildId);
  assert.equal((await health()).app.build.buildId, first.buildId, 'rebuilding disk cannot relabel an old running process');
  await stop(); assert.equal((await start()).app.build.buildId, second.buildId);
  await stop(); fs.writeFileSync(path.join(root, 'dist/build-info.json'), '{}');
  assert.equal((await start()).app.build.available, false, 'invalid metadata must be unknown, not an invented identity');
  console.log('PASS compiled backend startup identity, stale live process detection and restart adoption');
} finally { await stop(); fs.rmSync(root, { recursive: true, force: true }); }
