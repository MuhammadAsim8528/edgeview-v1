import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import initSqlJs from 'sql.js';
import { unusedTestPort } from './test-server-port.mjs';

const source = process.cwd(), root = fs.mkdtempSync(path.join(os.tmpdir(), 'edgeview-history-runtime-'));
const app = path.join(root, 'app'), state = path.join(root, 'state');
fs.mkdirSync(app); fs.mkdirSync(state);
fs.cpSync(path.join(source, 'dist'), path.join(app, 'dist'), { recursive: true });
fs.copyFileSync(path.join(source, 'packaging/windows/runtime-bootstrap.cjs'), path.join(app, 'runtime-bootstrap.cjs'));
fs.writeFileSync(path.join(app, 'package.json'), '{"name":"edgeview","version":"1.0.0-rc.2"}');
fs.writeFileSync(path.join(state, 'config.json'), '{}');
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => /^(PATH|SystemRoot|WINDIR|COMSPEC|USERPROFILE|TEMP|TMP|APPDATA|LOCALAPPDATA)$/i.test(key)));
const port = await unusedTestPort(), base = `http://127.0.0.1:${port}`;
Object.assign(env, { NODE_ENV: 'production', NODE_PATH: path.join(source, 'node_modules'), EDGEVIEW_DATA_DIR: state, PORT: String(port), EDGEVIEW_MONITORING_ENABLED: '0' });
let child;
async function stop() {
  if (child && child.exitCode === null && child.signalCode === null) {
    const closed = once(child, 'exit', { signal: AbortSignal.timeout(25000) });
    child.stdin.end('shutdown\n'); assert.equal((await closed)[0], 0);
  }
}
async function start() {
  child = spawn(process.execPath, [path.join(app, 'runtime-bootstrap.cjs')], { cwd: app, env, stdio: ['pipe', 'ignore', 'ignore'] });
  child.stdin.on('error', () => {});
  for (const deadline = Date.now() + 45000; Date.now() < deadline;) {
    assert.equal(child.exitCode, null, 'owned runtime must remain alive');
    try { const r = await fetch(base + '/api/health', { signal: AbortSignal.timeout(1000) });
      if (r.ok && (await r.json()).app.pid === child.pid) return;
    } catch { /* bounded startup readiness */ }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Owned history runtime readiness timeout');
}
async function upload(buyer) {
  const form = new FormData(); form.set('file', new Blob([`Date,Importer,Country,Exporter,Item,TOT_FC\n2026-01-01,${buyer},Kenya,Synthetic Supplier,Product,10\n`]), 'shared.csv');
  const r = await fetch(base + '/api/files/upload', { method: 'POST', body: form, signal: AbortSignal.timeout(10000) });
  assert.equal(r.status, 201); const body = await r.json(); return body.id || body.data.id;
}
const SQL = await initSqlJs();
function history() {
  const db = new SQL.Database(fs.readFileSync(path.join(state, 'edgeview.db')));
  try {
    assert.equal(db.exec('PRAGMA integrity_check')[0].values[0][0], 'ok');
    assert.equal(db.exec('PRAGMA user_version')[0].values[0][0], 2);
    return db.exec('SELECT importer, file_id FROM history_data ORDER BY importer')[0]?.values || [];
  } finally { db.close(); }
}
const remove = id => fetch(base + '/api/files/' + encodeURIComponent(id), { method: 'DELETE', signal: AbortSignal.timeout(10000) });
try {
  await start(); const a = await upload('Synthetic A'), b = await upload('Synthetic B'); await stop();
  assert.deepEqual(history(), [['Synthetic A', a], ['Synthetic B', b]]);
  await start(); assert.equal((await remove(a)).status, 200); await stop();
  assert.deepEqual(history(), [['Synthetic B', b]], 'primary delete alias preserves same-name sibling on disk');
  await start(); const c = await upload('Synthetic C');
  const deleted = await fetch(base + '/api/stats/history-files/' + encodeURIComponent(b), { method: 'DELETE', signal: AbortSignal.timeout(10000) });
  assert.equal(deleted.status, 200); await stop(); assert.deepEqual(history(), [['Synthetic C', c]]);
  // Seed unattributed legacy data only while this synthetic runtime is stopped.
  const dbFile = path.join(state, 'edgeview.db'); const legacy = new SQL.Database(fs.readFileSync(dbFile));
  legacy.run("INSERT INTO history_data(importer,file_name) VALUES('Synthetic Legacy','shared.csv')");
  fs.writeFileSync(dbFile, legacy.export()); legacy.close();
  const retained = fs.readFileSync(path.join(state, 'edgeview_db.json'));
  await start();
  for (const route of ['/api/files/', '/api/stats/history-files/']) {
    const refused = await fetch(base + route + encodeURIComponent(c), { method: 'DELETE', signal: AbortSignal.timeout(10000) });
    assert.equal(refused.status, 409); assert.equal((await refused.json()).code, 'LEGACY_HISTORY_RECONCILIATION_REQUIRED');
    assert.deepEqual(fs.readFileSync(path.join(state, 'edgeview_db.json')), retained);
  }
  await stop(); assert.deepEqual(history(), [['Synthetic C', c], ['Synthetic Legacy', null]]);
  console.log('PASS compiled production same-name upload, both delete aliases, durable sibling history, restart and pre-mutation legacy refusal');
} finally {
  await stop();
  assert.equal(path.dirname(fs.realpathSync(root)), fs.realpathSync(os.tmpdir()));
  fs.rmSync(root, { recursive: true, force: true });
}
