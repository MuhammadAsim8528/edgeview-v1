import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { buildSync } from 'esbuild';
import { unusedTestPort } from './test-server-port.mjs';

const repo = process.cwd(), root = fs.mkdtempSync(path.join(os.tmpdir(), 'edgeview-cached-http-'));
assert.ok(process.argv.length === 2 || (process.argv.length === 3 && process.argv[2] === '--browser'), 'Use optional --browser only');
const browserMode = process.argv[2] === '--browser';
const app = path.join(root, 'app'), state = path.join(root, 'state'); fs.mkdirSync(app); fs.mkdirSync(state);
fs.cpSync(path.join(repo, 'dist'), path.join(app, 'dist'), { recursive: true });
fs.copyFileSync(path.join(repo, 'packaging/windows/runtime-bootstrap.cjs'), path.join(app, 'runtime-bootstrap.cjs'));
fs.writeFileSync(path.join(app, 'package.json'), '{"name":"edgeview","version":"1.0.0-rc.2"}');
fs.writeFileSync(path.join(state, 'config.json'), '{}');
const denied = path.join(root, 'deny-egress.cjs'), egress = path.join(root, 'egress-attempted');
fs.writeFileSync(denied, `const fs=require('node:fs');const deny=()=>{fs.writeFileSync(${JSON.stringify(egress)},'attempted');throw Error('CACHED_TEST_EGRESS_DENIED');};for(const name of ['node:http','node:https']){require(name).request=deny;require(name).get=deny;}globalThis.fetch=deny;`);
const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => /^(PATH|SystemRoot|WINDIR|COMSPEC|USERPROFILE|TEMP|TMP|APPDATA|LOCALAPPDATA)$/i.test(name)));
const port = await unusedTestPort(), base = `http://127.0.0.1:${port}`;
Object.assign(env, { NODE_ENV: 'production', NODE_PATH: path.join(repo, 'node_modules'), EDGEVIEW_DATA_DIR: state,
  PORT: String(port), EDGEVIEW_MONITORING_ENABLED: '0' });
let child;
async function stop() {
  if (child && child.exitCode === null && child.signalCode === null) {
    const done = once(child, 'exit', { signal: AbortSignal.timeout(25000) }); child.stdin.end('shutdown\n'); assert.equal((await done)[0], 0);
  }
}
async function start() {
  child = spawn(process.execPath, ['-r', denied, path.join(app, 'runtime-bootstrap.cjs')], { cwd: app, env, stdio: ['pipe', 'ignore', 'ignore'] });
  child.stdin.on('error', () => {});
  for (const deadline = Date.now() + 45000; Date.now() < deadline;) {
    assert.equal(child.exitCode, null);
    try { const r = await fetch(base + '/api/health', { signal: AbortSignal.timeout(1000) }); if (r.ok && (await r.json()).app.pid === child.pid) return; }
    catch { /* bounded readiness */ }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Owned cache test runtime readiness timeout');
}
const request = (route, body) => fetch(base + route, { method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body), signal: AbortSignal.timeout(25000) });
const companies = () => fetch(base + '/api/companies', { signal: AbortSignal.timeout(10000) }).then(r => r.json());
async function verifyRenderedControls() {
  const { chromium, expect } = await import('@playwright/test');
  const artifactRoot = path.join(repo, '.test-cache', 'e2e-artifacts'); fs.mkdirSync(artifactRoot, { recursive: true });
  const output = fs.mkdtempSync(path.join(artifactRoot, 'cached-revalidation-'));
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, bypassCSP: false });
  const errors = [];
  await context.tracing.start({ screenshots: true, snapshots: true });
  await context.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort('blockedbyclient'));
  const page = await context.newPage(); page.setDefaultTimeout(15000);
  page.on('pageerror', error => { if (errors.length < 100) errors.push(error.message); });
  page.on('console', message => { if (message.type() === 'error' && errors.length < 100) errors.push(message.text()); });
  try {
    await page.addInitScript(() => localStorage.setItem('edgeview_contacts_view', 'table'));
    await page.goto(base); await page.locator('#nav-tab-contacts').click();
    const row = page.locator('tbody tr').filter({ hasText: 'Scopeanchor Medical' }).filter({ hasText: 'Kenya' });
    await expect(row).toBeVisible();
    await expect(row.getByRole('button', { name: 'Force Fetch', exact: true })).toBeDisabled();
    await expect(row.getByRole('button', { name: 'Fetch Details', exact: true })).toBeEnabled();
    const replay = page.waitForResponse(response => response.url().endsWith('/api/enrich/company') && response.request().method() === 'POST');
    await row.getByRole('button', { name: 'Fetch Details', exact: true }).click();
    const response = await replay; assert.equal(response.status(), 200); assert.equal((await response.json()).reused_evidence, true);
    await expect(row.getByText('office@scopeanchor.test', { exact: true })).toBeVisible();
    await page.reload(); await expect(row.getByText('office@scopeanchor.test', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Recheck Saved Evidence', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Review Saved Evidence', exact: true })).toBeVisible();
    await expect(page.getByText('Recheck retained sources for the same company and country. No provider calls.', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Close batch enrichment', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Review Saved Evidence', exact: true })).toHaveCount(0);
    await page.screenshot({ path: path.join(output, 'saved-evidence-controls.png'), fullPage: true });
    assert.deepEqual(errors, [], 'rendered workflow must not hide browser errors');
    console.log('PASS isolated rendered saved-evidence enable/force-disable/click/result/navigation/refresh/modal-close workflow; screenshot unreviewed');
  } finally {
    await page.screenshot({ path: path.join(output, 'final-state.png'), fullPage: true }).catch(() => {});
    await context.tracing.stop({ path: path.join(output, 'trace.zip') });
    fs.writeFileSync(path.join(output, 'browser-errors.json'), JSON.stringify(errors));
    await browser.close();
  }
}
try {
  await start();
  const form = new FormData(); form.set('file', new Blob(['Importer,Country,Exporter,Item\nScopeanchor Medical,Kenya,Synthetic Supplier,Product\nScopeanchor Medical,Uganda,Synthetic Supplier,Product\nUnresearched Buyer,Kenya,Synthetic Supplier,Product\nBatchanchor Medical,Kenya,Synthetic Supplier,Product']), 'synthetic-cached.csv');
  assert.equal((await fetch(base + '/api/files/upload', { method: 'POST', body: form })).status, 201);
  const initial = await companies();
  const local = initial.find(c => c.company_name === 'Scopeanchor Medical' && c.country === 'Kenya');
  const foreign = initial.find(c => c.company_name === 'Scopeanchor Medical' && c.country === 'Uganda');
  const fresh = initial.find(c => c.company_name === 'Unresearched Buyer');
  const batch = initial.find(c => c.company_name === 'Batchanchor Medical'); assert.ok(local && foreign && fresh && batch);
  await stop();
  // Explicit synthetic retained evidence fixture; no simulated real-company or
  // provider success. The actual HTTP route, SQL and immutable store remain real.
  const seed = path.join(root, 'seed.cjs');
  buildSync({ stdin: { contents: `import {persistV1Run} from ${JSON.stringify(path.join(repo, 'server/v1_engine.ts'))};
import {persistV1ContactOverlay} from ${JSON.stringify(path.join(repo, 'server/job_manager.ts'))};
import {getDb} from ${JSON.stringify(path.join(repo, 'server/sqlite.ts'))};
async function main(){const run={id:'run-synthetic-cached-local',company_name:'Scopeanchor Medical',country:'Kenya',status:'COMPLETED',started_at:'2026-01-01T00:00:00Z',queries:[],raw_records:[],timeline:[],limits:{max_queries:4,max_results_per_query:8,max_scrapes:8,timeout_ms:10000},identity_resolution:{official_domain:'scopeanchor.test',confidence:'high',candidates:[]},results:[{id:'local-page',run_id:'run-synthetic-cached-local',raw_record_id:'synthetic',provider:'direct-http',status:'success',rank:1,url:'https://scopeanchor.test/contact',title:'',snippet:'',text:'Kenya office office@scopeanchor.test',links:[],metadata:{}}]};persistV1Run(run as any);for(const id of ${JSON.stringify([local.id, foreign.id])})await persistV1ContactOverlay(id,run.id,{schema_version:28,entity_key:'obsolete-fixture',email:'old@scopeanchor.test',emails_list:['old@scopeanchor.test']} as any,true);const second={...run,id:'run-synthetic-cached-batch',company_name:'Batchanchor Medical',identity_resolution:{official_domain:'batchanchor.test',confidence:'high',candidates:[]},results:[{...run.results[0],id:'batch-page',run_id:'run-synthetic-cached-batch',url:'https://batchanchor.test/contact',text:'Kenya office batch@batchanchor.test'}]};persistV1Run(second as any);await persistV1ContactOverlay(${JSON.stringify(batch.id)},second.id,{schema_version:28,entity_key:'obsolete-fixture',emails_list:[]} as any,true);await(await getDb()).flush();}main().catch(()=>{process.exitCode=1;});`,
    resolveDir: repo, sourcefile: 'synthetic-cache-seed.ts', loader: 'ts' }, bundle: true, platform: 'node', format: 'cjs', packages: 'external', outfile: seed, logLevel: 'silent' });
  const seeded = spawnSync(process.execPath, ['-r', denied, seed], { cwd: app, env, encoding: 'utf8', timeout: 30000, windowsHide: true });
  assert.equal(seeded.status, 0, seeded.stderr);
  await start();
  assert.equal((await companies()).find(c => c.id === local.id).research_validation_status, 'needs_revalidation');
  assert.equal((await companies()).find(c => c.id === local.id).can_revalidate_evidence, true);
  assert.equal((await companies()).find(c => c.id === foreign.id).can_revalidate_evidence, false);
  assert.equal((await companies()).find(c => c.id === foreign.id).edgeview_v1_run_id, undefined,
    'known foreign raw evidence remains stored without masquerading as this entity research');
  if (browserMode) await verifyRenderedControls();
  const replay = await request('/api/enrich/company', { id: local.id, company_name: local.company_name, forceFetch: false });
  assert.equal(replay.status, 200, 'ordinary single-company action must revalidate retained evidence without configured providers');
  const replayed = await replay.json(); assert.equal(replayed.reused_evidence, true); assert.equal(replayed.run.id, 'run-synthetic-cached-local');
  const after = (await companies()).find(c => c.id === local.id);
  assert.equal(after.email, 'office@scopeanchor.test'); assert.equal(after.research_validation_status, 'current');
  assert.equal((await request('/api/enrich/company', { id: local.id, company_name: local.company_name, forceFetch: true })).status, 503,
    'force refresh still requires live-provider capability');
  assert.equal((await request('/api/enrich/company', { id: local.id, company_name: local.company_name, country: 'Uganda' })).status, 409,
    'a matching ID must not authorize a different country');
  assert.equal((await request('/api/enrich/company', { id: foreign.id, company_name: foreign.company_name })).status, 503,
    'retained Kenya run cannot satisfy Uganda evidence');
  assert.equal((await request('/api/enrich/company', { id: fresh.id, company_name: fresh.company_name })).status, 503);
  assert.equal((await request('/api/enrich/company', { id: fresh.id, company_name: fresh.company_name, reuseOnly: true })).status, 409);
  assert.equal((await request('/api/enrich/company', { id: local.id, company_name: local.company_name, forceFetch: 'false' })).status, 400);
  assert.equal((await request('/api/enrich/jobs', { company_ids: [local.id, fresh.id] })).status, 503, 'a mixed uncached selection cannot bypass provider requirements');
  assert.equal((await request('/api/enrich/jobs', { company_ids: [local.id, local.id] })).status, 400);
  const created = await request('/api/enrich/jobs', { company_ids: [batch.id], mode: 'importer', reuseOnly: true }); assert.equal(created.status, 200);
  const jobId = (await created.json()).jobId;
  assert.equal((await request(`/api/enrich/job/${jobId}/start`, { forceFetch: true })).status, 409);
  assert.equal((await request(`/api/enrich/job/${jobId}/start`, { forceFetch: false })).status, 200);
  let completed = false;
  for (const deadline = Date.now() + 20000; Date.now() < deadline;) {
    const snapshot = await (await fetch(base + `/api/enrich/job/${jobId}`, { signal: AbortSignal.timeout(5000) })).json();
    if (snapshot.job?.status === 'COMPLETED') { completed = true; assert.equal(snapshot.job.completed_companies, 1);
      assert.ok(snapshot.job.company_states[batch.id].durationMs > 0, 'actual cached work timing replaces placeholder zero'); break; }
    assert.notEqual(snapshot.job?.status, 'FAILED'); await new Promise(resolve => setTimeout(resolve, 50));
  }
  assert.equal(completed, true, 'ordinary batch revalidation must terminate');
  assert.equal((await companies()).find(c => c.id === batch.id).email, 'batch@batchanchor.test');
  const streamed = await request('/api/enrich/batch', { company_ids: [local.id], forceFetch: false });
  assert.equal(streamed.status, 200); const events = await streamed.text();
  assert.ok(events.includes('"reused_evidence":true')); assert.ok(events.includes('"quality":"PARTIAL"'), 'capture completion must not fabricate complete contact quality');
  const exported = await request('/api/export/blocks', { company_ids: [local.id] }); assert.equal(exported.status, 200);
  assert.ok((await exported.text()).includes('office@scopeanchor.test'));
  await stop(); await start(); assert.equal((await companies()).find(c => c.id === local.id).email, 'office@scopeanchor.test');
  assert.equal(fs.existsSync(egress), false, 'neither revalidation nor rejected refresh may make outbound requests');
  console.log('PASS actual cached HTTP revalidation, force/provider refusal, cross-country ID/run isolation, durable export/restart and zero outbound calls; synthetic evidence only');
} finally {
  await stop(); assert.equal(path.dirname(fs.realpathSync(root)), fs.realpathSync(os.tmpdir()));
  fs.rmSync(root, { recursive: true, force: true });
}
