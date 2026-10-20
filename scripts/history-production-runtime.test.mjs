import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { unusedTestPort } from './test-server-port.mjs';

// A real production-mode backend, but only in this test's own installation root.
const source = process.cwd();
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'edgeview-history-production-'));
const app = path.join(root, 'application');
const port = await unusedTestPort();
const base = `http://127.0.0.1:${port}`;
let child;
let output = '';
fs.mkdirSync(path.join(app, 'dist'), { recursive: true });
fs.writeFileSync(path.join(app, 'package.json'), JSON.stringify({ name: 'edgeview', type: 'module' }));
fs.copyFileSync(path.join(source, 'dist/server.cjs'), path.join(app, 'dist/server.cjs'));
const syntheticKeys = Object.fromEntries(['serper','hunter','nvidia','groq','gemini','firecrawl','tavily','exa','linkup','apify'].map(provider => [`${provider}_api_key`, process.platform === 'win32' ? `synthetic-local-test-${provider}-not-real` : '']));
const syntheticConfig = { ...syntheticKeys, serper_enabled: false, hunter_enabled: false, nvidia_enabled: false, groq_enabled: false };
fs.writeFileSync(path.join(app, 'config.json'), JSON.stringify(syntheticConfig));
fs.writeFileSync(path.join(app, 'config.prev.json'), JSON.stringify(syntheticConfig));
const env = { ...process.env, NODE_ENV: 'production', PORT: String(port), HOST: '127.0.0.1',
  NODE_PATH: path.join(source, 'node_modules'), EDGEVIEW_CONFIG: path.join(app, 'config.json'), EDGEVIEW_V1_DATA_DIR: path.join(app, 'data/runs'),
  SERPER_API_KEY: '', HUNTER_API_KEY: '', NVIDIA_API_KEY: '', GROQ_API_KEY: '' };
for (const key of ['EDGEVIEW_TEST_MODE','EDGEVIEW_TEST_DB_DIR','EDGEVIEW_JSON_DB','EDGEVIEW_SQLITE_DB','EDGEVIEW_DEV_SERVER','EDGEVIEW_ENABLE_SAMPLE_DATA']) delete env[key];

async function start() {
  output = '';
  child = spawn(process.execPath, ['--import', pathToFileURL(path.join(source, 'scripts/test-fixtures/normal-shutdown.mjs')).href, 'dist/server.cjs'], { cwd: app, env, stdio: ['ignore','pipe','pipe','ipc'] });
  const collect = chunk => { output = (output + chunk).slice(-8000); };
  child.stdout.on('data', collect); child.stderr.on('data', collect);
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error('Isolated production history server exited before readiness');
    let response;
    try { response = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(1000) }); } catch {}
    if (response?.ok) {
      const health = await response.json();
      assert.equal(health.app.pid, child.pid, 'wrong process: mutations prohibited');
      assert.equal(fs.realpathSync(health.app.project_root), fs.realpathSync(app), 'wrong installation root: mutations prohibited');
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Isolated production history server did not become ready');
}
async function stop(expectedExit = 0) {
  if (child && child.exitCode === null && child.signalCode === null) {
    const exiting = child;
    let timeout;
    const exited = new Promise((resolve, reject) => {
      exiting.once('exit', code => { clearTimeout(timeout); code === expectedExit ? resolve() : reject(new Error('Normal shutdown returned an unexpected exit code')); });
      timeout = setTimeout(() => { exiting.kill('SIGTERM'); reject(new Error('Normal shutdown exceeded test deadline')); }, 20000);
    });
    exiting.send('edgeview-test-normal-shutdown');
    await exited;
    assert.equal(fs.existsSync(path.join(app, 'edgeview.db.lock')), false, 'normal exit retains no owned backend lock');
  }
}
const json = async route => {
  const response = await fetch(`${base}${route}`); assert.equal(response.status, 200, route); return response.json();
};
try {
  const corruptPath = path.join(app, 'edgeview.db');
  const corruptBytes = Buffer.from('synthetic corrupt database retained unchanged');
  fs.writeFileSync(corruptPath, corruptBytes);
  await start();
  const degraded = await json('/api/health');
  assert.equal(degraded.database.status, 'degraded', 'dataset projection alone cannot certify the operational DB');
  assert.equal(degraded.database.operational.status, 'degraded');
  assert.deepEqual(fs.readFileSync(corruptPath), corruptBytes);
  const unavailable = await json('/api/capabilities');
  assert.equal(unavailable.capabilities.company_enrichment.available, false);
  assert.match(unavailable.capabilities.company_enrichment.reason, /storage/);
  for (const route of ['/api/enrich/company', '/api/files/upload', '/api/stats/save-to-history']) {
    const response = await fetch(`${base}${route}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    assert.equal(response.status, 503);
    assert.equal((await response.json()).code, 'OPERATIONAL_DATABASE_UNAVAILABLE');
  }
  assert.equal((await fetch(`${base}/api/settings`)).status, 200, 'recovery settings remain accessible');
  await stop(1); // failed operational initialization cannot claim a clean flush
  assert.deepEqual(fs.readFileSync(corruptPath), corruptBytes);
  // Remove only this explicitly created disposable fixture, never user data.
  fs.unlinkSync(corruptPath);
  await start();
  assert.equal((await json('/api/health')).database.operational.status, 'ok');
  if (process.platform === 'win32') {
    for (const file of ['config.json', 'config.prev.json']) {
      const disk = fs.readFileSync(path.join(app, file), 'utf8');
      assert.ok(JSON.parse(disk)._edgeview_credentials, 'startup must protect active and reset snapshots');
      for (const secret of Object.values(syntheticKeys)) assert.equal(disk.includes(secret), false);
    }
  }
  const ids = [];
  for (const [index, name] of ['latest.csv','sample-customer.csv'].entries()) {
    const form = new FormData();
    form.append('file', new Blob([`Importer,Exporter,Country,Item,TOT_FC\nCustomer ${index},Supplier,Kenya,Product,100\n`]), name);
    const response = await fetch(`${base}/api/files/upload`, { method: 'POST', body: form });
    assert.equal(response.status, 201);
    const body = await response.json(); const id = body.data?.id || body.id; assert.ok(id); ids.push(id);
    const save = await fetch(`${base}/api/files/${id}/save-to-history`, { method: 'POST' });
    assert.equal(save.status, 200); assert.equal((await save.json()).data.source, 'real');
  }
  const persisted = JSON.parse(fs.readFileSync(path.join(app, 'edgeview_db.json'), 'utf8'));
  assert.equal(persisted.length, 2);
  assert.ok(persisted.every(record => record.source === 'real' && record.provenance_version === 1));
  const history = await json('/api/stats/history-files');
  assert.deepEqual(history.data.map(record => record.id).sort(), ids.sort());
  assert.ok(fs.existsSync(path.join(app, 'edgeview.db')), 'database must belong to temporary production installation');
  await stop(); await start();
  const restored = await json('/api/stats/history-files');
  assert.deepEqual(restored.data.map(record => record.id).sort(), ids.sort(), 'real uploads remain visible after process restart');
  for (const id of ids) {
    const data = await json(`/api/files/${id}/data`); assert.equal(data.total_count, 1);
  }
  if (process.platform === 'win32') {
    await stop();
    const previous = JSON.parse(fs.readFileSync(path.join(app, 'config.prev.json'), 'utf8'));
    previous._edgeview_credentials.ciphertext = 'AAAA';
    fs.writeFileSync(path.join(app, 'config.prev.json'), JSON.stringify(previous));
    await assert.rejects(start(), /exited before readiness/, 'unreadable snapshot must abort, never serve an empty installation');
    const intact = JSON.parse(fs.readFileSync(path.join(app, 'edgeview_db.json'), 'utf8'));
    assert.equal(intact.length, 2, 'credential failure must not erase saved records');
  }
  console.log('PASS production-mode upload/history provenance survives restart without touching live installation');
} finally {
  await stop();
  fs.rmSync(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
}
