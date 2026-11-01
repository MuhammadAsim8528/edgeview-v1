import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { build } from 'esbuild';
import { unusedTestPort } from './test-server-port.mjs';

// Real HTTP routes, job persistence, immutable runs and projections. Only the
// live engine operation is a synthetic seam; no provider/DNS claims from this test.
const repo = process.cwd(), root = fs.mkdtempSync(path.join(os.tmpdir(), 'edgeview-reuse-policy-'));
const state = path.join(root, 'state'), app = path.join(root, 'app'), calls = path.join(root, 'operations.jsonl');
fs.mkdirSync(state); fs.mkdirSync(path.join(app, 'dist'), { recursive: true });
fs.writeFileSync(path.join(app, 'package.json'), '{"name":"edgeview","version":"1.0.0-rc.2","type":"commonjs"}');
fs.copyFileSync(path.join(repo, 'packaging/windows/runtime-bootstrap.cjs'), path.join(app, 'runtime-bootstrap.cjs'));
const configuration = { serper_enabled: true, serper_api_key: 'synthetic-no-network-key', nvidia_enabled: false, groq_enabled: false, hunter_enabled: false };
const configFile = path.join(state, 'config.json'); fs.writeFileSync(configFile, JSON.stringify(configuration));
const denied = path.join(root, 'deny.cjs'), audit = path.join(root, 'egress.txt');
fs.writeFileSync(denied, `const deny=()=>{require('node:fs').appendFileSync(${JSON.stringify(audit)},'attempt'+String.fromCharCode(10));throw Error('SYNTHETIC_EGRESS_DENIED');};for(const name of ['node:http','node:https']){require(name).request=deny;require(name).get=deny;}globalThis.fetch=deny;`);
const port = await unusedTestPort(), base = `http://127.0.0.1:${port}`;
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => /^(PATH|SystemRoot|WINDIR|COMSPEC|USERPROFILE|TEMP|TMP|APPDATA|LOCALAPPDATA)$/i.test(key)));
Object.assign(env, { NODE_PATH: path.join(repo, 'node_modules'), NODE_ENV: 'test', EDGEVIEW_TEST_MODE: '1', EDGEVIEW_DATA_DIR: state, EDGEVIEW_CONFIG: configFile,
  EDGEVIEW_SQLITE_DB: path.join(state, 'operational.db'), EDGEVIEW_JSON_DB: path.join(state, 'rows.json'), EDGEVIEW_V1_DATA_DIR: path.join(state, 'runs'), EDGEVIEW_MONITORING_ENABLED: '0', PORT: String(port) });
const engine = path.join(repo, 'server/v1_engine.ts'), manager = path.join(repo, 'server/job_manager.ts');
let child, stderr = '';
const operationCount = () => fs.existsSync(calls) ? fs.readFileSync(calls, 'utf8').trim().split('\n').filter(Boolean).length : 0;
const request = (url, body) => fetch(base + url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(15000) });
async function start() {
  stderr = '';
  child = spawn(process.execPath, ['-r', denied, path.join(app, 'runtime-bootstrap.cjs')], { cwd: app, env, stdio: ['pipe', 'ignore', 'pipe'], windowsHide: true });
  child.stdin.on('error', () => {}); child.stderr.on('data', bytes => { stderr = (stderr + bytes).slice(-4000); });
  for (const deadline = Date.now() + 30000; Date.now() < deadline;) {
    if (child.exitCode !== null) throw Error('Owned policy fixture exited: ' + stderr);
    try { const response = await fetch(base + '/api/health', { signal: AbortSignal.timeout(2000) }); if (response.ok) { assert.equal((await response.json()).app.pid, child.pid); return; } } catch { /* bounded startup */ }
    await new Promise(resolve => setTimeout(resolve, 40));
  }
  throw Error('Owned policy fixture readiness failed: ' + stderr);
}
async function stop() {
  if (child && child.exitCode === null && child.signalCode === null) { const done = once(child, 'exit', { signal: AbortSignal.timeout(20000) }); child.stdin.end('shutdown\n'); assert.equal((await done)[0], 0); }
  child = null;
}
async function complete(id) {
  for (const deadline = Date.now() + 20000; Date.now() < deadline;) {
    const body = await (await fetch(base + `/api/enrich/job/${id}`, { signal: AbortSignal.timeout(2000) })).json();
    if (body.job.status === 'COMPLETED') { assert.equal(body.job.completed_companies, body.job.total_companies); assert.ok(Object.values(body.job.company_states).every(item => item.status === 'completed')); return body.job; }
    assert.notEqual(body.job.status, 'FAILED', JSON.stringify(body.job)); await new Promise(resolve => setTimeout(resolve, 40));
  }
  throw Error('Policy job did not complete');
}
try {
  await build({ entryPoints: ['server.ts'], outfile: path.join(app, 'dist/server.cjs'), bundle: true, platform: 'node', format: 'cjs', packages: 'external', logLevel: 'silent', plugins: [{ name: 'only-live-operation-seam', setup(plugin) {
    plugin.onResolve({ filter: /^(\.\/server\/v1_engine|\.\/v1_engine)$/ }, args => [path.join(repo, 'server.ts'), manager].includes(path.resolve(args.importer)) ? { path: 'engine', namespace: 'fixture' } : undefined);
    plugin.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ loader: 'ts', resolveDir: repo, contents: `
      export * from ${JSON.stringify(engine)};
      import {persistV1Run,createV1ResearchContext} from ${JSON.stringify(engine)};
      import fs from 'node:fs'; import crypto from 'node:crypto';
      export async function runV1Enrichment(company_name,country,options={}) {
        fs.appendFileSync(${JSON.stringify(calls)},JSON.stringify({company_name,country,profile:options.profile||'interactive'})+String.fromCharCode(10));
        const run={id:'run-'+crypto.randomUUID(),company_name,country,status:'COMPLETED',started_at:new Date().toISOString(),completed_at:new Date().toISOString(),research_context:createV1ResearchContext(options.profile||'interactive'),queries:[],results:[],raw_records:[],timeline:[],limits:{}};
        persistV1Run(run); return run;
      }` }));
  } }] });
  await start();
  const form = new FormData(); form.set('file', new Blob(['Date,Importer,Country,Exporter,Item,TOT_FC\n' + ['Recent', 'Old', 'Partial', 'Legacy', 'Bulk'].map(name => `2026-10-01,Synthetic ${name} Buyer,Kenya,Synthetic Supplier,Product,1`).join('\n')]), 'policy.csv');
  assert.equal((await fetch(base + '/api/files/upload', { method: 'POST', body: form })).status, 201);
  const contacts = await (await fetch(base + '/api/companies')).json();
  const ids = Object.fromEntries(['Recent', 'Old', 'Partial', 'Legacy', 'Bulk'].map(name => [name, contacts.find(contact => contact.company_name === `Synthetic ${name} Buyer`).id]));
  await stop();
  const seed = path.join(root, 'seed.cjs');
  await build({ stdin: { contents: `import {persistV1Run,createV1ResearchContext} from ${JSON.stringify(engine)}; import {persistV1ContactOverlay,projectHistoricalContactFields} from ${JSON.stringify(manager)};
    async function main(){for(const [name,id] of Object.entries(${JSON.stringify(ids)})) {
      const age=name==='Old'?8*86400000:60000;
      const run={id:'run-policy-'+name.toLowerCase(),company_name:'Synthetic '+name+' Buyer',country:'Kenya',status:name==='Partial'?'PARTIAL':'COMPLETED',started_at:new Date(Date.now()-age-1000).toISOString(),completed_at:new Date(Date.now()-age).toISOString(),...(name==='Legacy'?{}:{research_context:createV1ResearchContext(name==='Bulk'?'bulk':'interactive')}),queries:[],results:[],raw_records:[],timeline:[],limits:{}};
      persistV1Run(run as any);await persistV1ContactOverlay(id as string,run.id,projectHistoricalContactFields(run as any),true);
    }}main().catch(error=>{console.error(error);process.exitCode=1;});`, resolveDir: repo, loader: 'ts' }, outfile: seed, bundle: true, platform: 'node', format: 'cjs', packages: 'external', logLevel: 'silent' });
  const seeded = spawnSync(process.execPath, ['-r', denied, seed], { cwd: app, env, encoding: 'utf8', windowsHide: true, timeout: 30000 }); assert.equal(seeded.status, 0, seeded.stderr);
  const originalOld = fs.readFileSync(path.join(state, 'runs/run-policy-old.json'));
  await start();
  const payload = name => ({ id: ids[name], company_name: `Synthetic ${name} Buyer` });
  const recent = await request('/api/enrich/company', payload('Recent')); assert.equal(recent.status, 200); assert.equal((await recent.json()).reused_evidence, true);
  for (const name of ['Old', 'Partial', 'Legacy', 'Bulk']) { const response = await request('/api/enrich/company', payload(name)); assert.equal(response.status, 409, name); assert.equal((await response.json()).code, 'SAVED_EVIDENCE_NEEDS_CHOICE'); }
  for (const endpoint of ['/api/enrich/batch', '/api/enrich/jobs']) { const response = await request(endpoint, { company_ids: [ids.Old] }); assert.equal(response.status, 409); assert.equal((await response.json()).code, 'SAVED_EVIDENCE_NEEDS_CHOICE'); }
  assert.equal(operationCount(), 0, 'refused cache modes must never fall through to live operation');
  const saved = await request('/api/enrich/company', { ...payload('Old'), reuseOnly: true }); assert.equal(saved.status, 200); assert.equal((await saved.json()).run.id, 'run-policy-old');
  const streamSaved = await request('/api/enrich/batch', { company_ids: [ids.Partial], reuseOnly: true }); assert.equal(streamSaved.status, 200); assert.ok((await streamSaved.text()).includes('"reused_evidence":true'));
  assert.equal(operationCount(), 0);
  const refreshed = await request('/api/enrich/company', { ...payload('Old'), forceFetch: true }); assert.equal(refreshed.status, 200); assert.notEqual((await refreshed.json()).run.id, 'run-policy-old'); assert.equal(operationCount(), 1);
  const streamLive = await request('/api/enrich/batch', { company_ids: [ids.Partial], forceFetch: true }); assert.equal(streamLive.status, 200); await streamLive.text(); assert.equal(operationCount(), 2);
  const cachedJob = await request('/api/enrich/jobs', { company_ids: [ids.Bulk] }); assert.equal(cachedJob.status, 200); const cachedId = (await cachedJob.json()).jobId;
  assert.equal((await request(`/api/enrich/job/${cachedId}/start`, { forceFetch: false })).status, 200); await complete(cachedId); assert.equal(operationCount(), 2);
  const liveJob = await request('/api/enrich/jobs', { company_ids: [ids.Legacy], forceFetch: true }); assert.equal(liveJob.status, 200); const liveId = (await liveJob.json()).jobId;
  await stop(); await start();
  const restored = (await (await fetch(base + `/api/enrich/job/${liveId}`)).json()).job; assert.equal(restored.company_states[ids.Legacy].force_live, true, 'explicit live intent must survive restart');
  fs.writeFileSync(configFile, '{}'); assert.equal((await request(`/api/enrich/job/${liveId}/start`, { forceFetch: false })).status, 503); assert.equal(operationCount(), 2);
  fs.writeFileSync(configFile, JSON.stringify(configuration)); assert.equal((await request(`/api/enrich/job/${liveId}/start`, { forceFetch: false })).status, 200); await complete(liveId); assert.equal(operationCount(), 3);
  const savedJob = await request('/api/enrich/jobs', { company_ids: [ids.Recent], reuseOnly: true }); assert.equal(savedJob.status, 200); const savedId = (await savedJob.json()).jobId;
  assert.equal((await request(`/api/enrich/job/${savedId}/start`, { forceFetch: true })).status, 409);
  assert.equal((await request(`/api/enrich/job/${savedId}/start`, { forceFetch: false })).status, 200); await complete(savedId); assert.equal(operationCount(), 3);
  const pending = await request('/api/enrich/jobs', { company_ids: [ids.Bulk] }); assert.equal(pending.status, 200); const pendingId = (await pending.json()).jobId;
  assert.equal((await request('/api/enrich/company', { ...payload('Bulk'), forceFetch: true })).status, 200); assert.equal(operationCount(), 4);
  assert.equal((await request(`/api/enrich/job/${pendingId}/start`, { forceFetch: false })).status, 409, 'changed profile after creation must not bypass start preflight');
  assert.equal((await request('/api/enrich/jobs', { company_ids: [ids.Old], reuseOnly: true, forceFetch: true })).status, 400);
  assert.deepEqual(fs.readFileSync(path.join(state, 'runs/run-policy-old.json')), originalOld, 'live refresh must not rewrite old evidence');
  assert.equal((await fetch(base + '/api/v1/runs/run-policy-old')).status, 200);
  assert.equal(fs.existsSync(audit), false, 'all actual network transports remain denied and unused');
  console.log('PASS actual single/SSE/job reuse gates: recent versus stale/partial/legacy/profile mismatch, no fallthrough, explicit historical/live, durable live intent, offline refusal, saved-only protection, changed-context start refusal and immutable old history. Live-operation body synthetic; providers/clean Windows NOT VERIFIED.');
} finally {
  await stop(); assert.equal(path.dirname(fs.realpathSync(root)), fs.realpathSync(os.tmpdir())); fs.rmSync(root, { recursive: true, force: true });
}
