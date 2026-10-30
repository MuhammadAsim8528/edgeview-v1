import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { unusedTestPort } from './test-server-port.mjs';
const source = process.cwd(), root = fs.mkdtempSync(path.join(os.tmpdir(), 'edgeview-json-runtime-'));
const app = path.join(root, 'app'), state = path.join(root, 'state'); fs.mkdirSync(app); fs.mkdirSync(state);
fs.cpSync(path.join(source, 'dist'), path.join(app, 'dist'), { recursive: true });
fs.copyFileSync(path.join(source, 'packaging/windows/runtime-bootstrap.cjs'), path.join(app, 'runtime-bootstrap.cjs'));
fs.writeFileSync(path.join(app, 'package.json'), '{"name":"edgeview","version":"1.0.0-rc.2"}');
fs.writeFileSync(path.join(state, 'config.json'), '{}');
const authority = path.join(state, 'edgeview_db.json'), legacy = path.join(state, 'pharma_db.json');
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => /^(PATH|SystemRoot|WINDIR|COMSPEC|USERPROFILE|TEMP|TMP|APPDATA|LOCALAPPDATA)$/i.test(key)));
const port = await unusedTestPort(), base = `http://127.0.0.1:${port}`;
Object.assign(env, { NODE_ENV: 'production', NODE_PATH: path.join(source, 'node_modules'), EDGEVIEW_DATA_DIR: state, PORT: String(port), EDGEVIEW_MONITORING_ENABLED: '0' });
let child, stderr = '';
function launch() {
  stderr = '';
  child = spawn(process.execPath, [path.join(app, 'runtime-bootstrap.cjs')], { cwd: app, env, stdio: ['pipe', 'ignore', 'pipe'] });
  child.stdin.on('error', () => {}); child.stderr.on('data', bytes => { stderr = (stderr + String(bytes)).slice(-8000); });
}
async function stop() {
  if (child && child.exitCode === null && child.signalCode === null) {
    const ended = once(child, 'exit', { signal: AbortSignal.timeout(25000) });
    child.stdin.end('shutdown\n'); assert.equal((await ended)[0], 0);
  }
}
async function ready() {
  launch();
  for (const deadline = Date.now() + 45000; Date.now() < deadline;) {
    assert.equal(child.exitCode, null, 'owned runtime must remain alive');
    try { const response = await fetch(base + '/api/health', { signal: AbortSignal.timeout(1000) });
      if (response.ok && (await response.json()).app.pid === child.pid) return;
    } catch { /* bounded owned readiness */ }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Owned JSON runtime readiness timed out');
}
async function upload(label) {
  const form = new FormData(); form.set('file', new Blob([`Importer,Country,Item\n${label},Kenya,Product\n`]), 'synthetic.csv');
  return fetch(base + '/api/files/upload', { method: 'POST', body: form, signal: AbortSignal.timeout(10000) });
}
try {
  fs.writeFileSync(legacy, '[]');
  for (const raw of ['', '{}', '{"PRIVATE_CUSTOMER_RECORD":']) {
    fs.writeFileSync(authority, raw); launch();
    const [code] = await once(child, 'exit', { signal: AbortSignal.timeout(20000) });
    assert.notEqual(code, 0, 'invalid existing authority must abort startup');
    assert.match(stderr, /DATASET_UNAVAILABLE/); assert.doesNotMatch(stderr, /PRIVATE_CUSTOMER_RECORD/);
    assert.equal(fs.readFileSync(authority, 'utf8'), raw); assert.equal(fs.readFileSync(legacy, 'utf8'), '[]');
    assert.ok(!fs.readdirSync(state).some(name => name.includes('.corrupt.')), 'failed read must not move original data');
  }
  fs.writeFileSync(authority, '[]'); await ready();
  assert.equal((await upload('Synthetic Retained Buyer')).status, 201);
  const saved = fs.readFileSync(authority);
  const files = await fetch(base + '/api/files').then(response => response.json()); assert.equal(files.length, 1);
  fs.writeFileSync(authority, '{"PRIVATE_AFTER_START":');
  const rejected = await upload('Synthetic Refused Buyer'); assert.equal(rejected.status, 503);
  const body = await rejected.json(); assert.equal(body.code, 'DATASET_UNAVAILABLE');
  assert.ok(!JSON.stringify(body).includes('PRIVATE_AFTER_START'));
  assert.equal(fs.readFileSync(authority, 'utf8'), '{"PRIVATE_AFTER_START":');
  assert.equal((await fetch(base + '/api/files').then(response => response.json())).length, 1, 'failed save cannot publish a new in-memory file');
  await stop(); fs.writeFileSync(authority, saved); // Repair only this owned fixture.
  await ready();
  assert.equal((await fetch(base + '/api/files').then(response => response.json()))[0].id, files[0].id);
  await stop();
  console.log('PASS compiled startup refuses invalid primary despite valid legacy; runtime upload503 retains source and memory; repaired fixture restarts with original dataset');
} finally {
  await stop(); assert.equal(path.dirname(fs.realpathSync(root)), fs.realpathSync(os.tmpdir()));
  fs.rmSync(root, { recursive: true, force: true });
}
