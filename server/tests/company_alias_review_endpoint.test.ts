import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import initSqlJs from 'sql.js';
import { unusedTestPort } from '../../scripts/test-server-port.mjs';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'edgeview-alias-review-http-'));
const port = await unusedTestPort(), base = `http://127.0.0.1:${port}`;
const runs = path.join(root, 'runs'), audit = path.join(root, 'outbound.txt');
const inherited = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
  /^(PATH|SYSTEMROOT|WINDIR|TEMP|TMP|COMSPEC|PATHEXT|APPDATA|LOCALAPPDATA|USERPROFILE)$/i.test(key)));
const env = { ...inherited, NODE_ENV: 'test', PORT: String(port), EDGEVIEW_TEST_MODE: '1', EDGEVIEW_TEST_DB_DIR: root,
  EDGEVIEW_JSON_DB: path.join(root, 'rows.json'), EDGEVIEW_SQLITE_DB: path.join(root, 'operational.db'),
  EDGEVIEW_CONFIG: path.join(root, 'config.json'), EDGEVIEW_V1_DATA_DIR: runs, EDGEVIEW_E2E_EGRESS_AUDIT: audit };
fs.writeFileSync(env.EDGEVIEW_JSON_DB, '[]'); fs.writeFileSync(env.EDGEVIEW_CONFIG, '{}');
let child: ChildProcess | undefined, stderr = '';
async function start() {
  let readinessFailure = 'not checked';
  child = spawn(process.execPath, ['--require', path.resolve('tests/e2e/no-egress.cjs'), '--import', 'tsx', '--input-type=module', '--eval', `
    import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto';
    import {persistV1Run} from './server/v1_engine.ts';
    const response={status:200,body:'\\n'.repeat(6000)+'<p>Global Pharma Ltd is also known as Global Pharma in Kenya.</p>',
      provenance:{finalUrl:'https://global.example.test/legal',redirectCount:1}};
    const run={id:'run-alias-review',company_name:'Global Pharma',country:'Kenya',status:'COMPLETED',
      started_at:'2026-11-08T01:00:00.000Z',completed_at:'2026-11-08T01:00:01.000Z',queries:[],results:[],timeline:[],
      identity_resolution:{official_domain:'global.example.test',confidence:'high',candidates:[{domain:'global.example.test',accepted:true,score:100,reasons:[],evidence_urls:[]}]},
      raw_records:[{id:'raw-alias-review',run_id:'run-alias-review',kind:'scrape',provider:'direct-http',request:{url:'https://global.example.test/start'},response,
        sha256:crypto.createHash('sha256').update(JSON.stringify(response)).digest('hex'),requested_at:'2026-11-08T01:00:00.000Z',completed_at:'2026-11-08T01:00:01.000Z',latency_ms:1}],
      limits:{max_queries:4,max_results_per_query:8,max_scrapes:8,timeout_ms:120000}};
    if(!fs.existsSync(path.join(process.env.EDGEVIEW_V1_DATA_DIR,run.id+'.json')))persistV1Run(run);
    await import('./server.ts');
  `], { cwd: process.cwd(), env, stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true });
  child.stderr?.on('data', bytes => { stderr = (stderr + String(bytes)).slice(-3000); });
  for (const deadline = Date.now() + 45000; Date.now() < deadline;) {
    assert.equal(child.exitCode, null, stderr);
    try {
      const response = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(1000) });
      assert.equal((await response.json()).app.pid, child.pid); return;
    } catch (error) {
      readinessFailure = error instanceof Error ? error.message : 'Unknown readiness failure';
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  throw new Error(`Owned alias-review runtime did not become ready: ${readinessFailure}; ${stderr}`);
}
async function stop() {
  if (child && child.exitCode === null && child.signalCode === null) {
    const ended = once(child, 'exit', { signal: AbortSignal.timeout(15000) }); child.kill(); await ended;
  }
}
const post = (id: string, body: unknown) => fetch(`${base}/api/companies/${id}/alias-review`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(10000),
});
const sha = (file: string) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
try {
  await start();
  const form = new FormData(); form.set('file', new Blob([
    'Importer,Country,Exporter,Item,TOT_FC\nGlobal Pharma,Kenya,Synthetic Supplier,Product,10\nGlobal Pharma Ltd,Kenya,Synthetic Supplier,Product,20\nGlobal Pharma Ltd,Pakistan,Synthetic Supplier,Product,30\nGlobal Pharma,Sudan,Synthetic Supplier,Product,40\nGlobal Pharma Ltd,South Sudan,Synthetic Supplier,Product,50',
  ]), 'synthetic-alias-review.csv');
  const uploaded = await fetch(`${base}/api/files/upload`, { method: 'POST', body: form }); assert.equal(uploaded.status, 201);
  const uploadedBody = await uploaded.json(), fileId = uploadedBody.id || uploadedBody.data?.id;
  assert.equal(typeof fileId, 'string');
  const contacts = await (await fetch(`${base}/api/companies`)).json();
  const find = (name: string, country: string) => {
    const contact = contacts.find((item: any) => item.company_name === name && item.country === country);
    assert.ok(contact); return contact;
  };
  const alias = find('Global Pharma', 'Kenya'), canonical = find('Global Pharma Ltd', 'Kenya');
  const request = { canonical_id: canonical.id, run_id: 'run-alias-review', raw_record_id: 'raw-alias-review' };
  const preimage = { primary: sha(env.EDGEVIEW_JSON_DB), sqlite: sha(env.EDGEVIEW_SQLITE_DB), run: sha(path.join(runs, 'run-alias-review.json')) };
  const response = await post(alias.id, request); assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const review = await response.json();
  assert.equal(review.review_only, true); assert.equal(review.admitted, false); assert.equal(review.publication, 'NOT_APPLIED');
  assert.deepEqual(review.registration, { status: 'unlinked' });
  assert.equal(review.alias_id, alias.id); assert.equal(review.canonical_id, canonical.id);
  assert.equal(review.proof.source_url, 'https://global.example.test/legal');
  assert.ok(JSON.stringify(review).length < 8192, 'review returns bounded proof, not the full raw payload');
  for (const body of [
    { ...request, company_name: 'Injected Company' }, { ...request, country: 'Pakistan' },
    { ...request, canonical: canonical }, { ...request, raw_records: [] },
    { ...request, canonical_id: canonical }, { ...request, run_id: '../run-alias-review' },
    [], null, { canonical_id: canonical.id, run_id: request.run_id },
  ]) assert.equal((await post(alias.id, body)).status, 400);
  assert.equal((await post('missing-id', request)).status, 404);
  assert.equal((await post(alias.id, { ...request, canonical_id: 'missing-id' })).status, 404);
  assert.equal((await post(alias.id, { ...request, run_id: 'run-missing' })).status, 404);
  assert.equal((await post(alias.id, { ...request, raw_record_id: 'raw-missing' })).status, 409);
  assert.equal((await post(alias.id, { ...request, canonical_id: alias.id })).status, 409);
  assert.equal((await post(alias.id, { ...request, canonical_id: find('Global Pharma Ltd', 'Pakistan').id })).status, 409);
  assert.equal((await post(find('Global Pharma', 'Sudan').id, { ...request,
    canonical_id: find('Global Pharma Ltd', 'South Sudan').id })).status, 409);
  assert.deepEqual(await (await fetch(`${base}/api/companies`)).json(), contacts, 'review does not group or alter existing records');
  assert.deepEqual({ primary: sha(env.EDGEVIEW_JSON_DB), sqlite: sha(env.EDGEVIEW_SQLITE_DB), run: sha(path.join(runs, 'run-alias-review.json')) }, preimage);
  const SQL = await initSqlJs(), sql = new SQL.Database(fs.readFileSync(env.EDGEVIEW_SQLITE_DB));
  assert.equal(sql.exec('SELECT count(*) FROM company_aliases')[0].values[0][0], 0); sql.close();
  await stop();
  // Seed only the stopped, owned fixture through the real durable boundary.
  // No admission route is exposed and no second process writes a live DB.
  const seeded = spawnSync(process.execPath, ['--require', path.resolve('tests/e2e/no-egress.cjs'), '--import', 'tsx', '--input-type=module', '--eval', `
    import {getV1Run} from './server/v1_engine.ts';
    import {prepareCompanyAliasAdmission,persistCompanyAliasAdmission} from './server/company_alias_registry.ts';
    const plan=prepareCompanyAliasAdmission(${JSON.stringify(alias)},${JSON.stringify(canonical)},getV1Run('run-alias-review'),'raw-alias-review');
    await persistCompanyAliasAdmission(plan,plan.confirmation_sha256);
  `], { cwd: process.cwd(), env, encoding: 'utf8', timeout: 30000, windowsHide: true });
  assert.equal(seeded.status, 0, 'fixture seed must pass the actual durable registry boundary');
  await start();
  const afterRestart = await post(alias.id, request); assert.equal(afterRestart.status, 200);
  const registeredReview = await afterRestart.json();
  assert.equal(registeredReview.confirmation_sha256, review.confirmation_sha256);
  assert.deepEqual(registeredReview.registration, { status: 'verified', alias_id: alias.id, canonical_id: canonical.id, country: 'kenya' });
  assert.equal(registeredReview.admitted, false, 'reading an existing registration is not a new admission or publication');
  // Raw contact reconstruction stamps a new last_updated at startup. Keep all
  // identity, membership and fact comparisons; exclude only that lifecycle field.
  const withoutRebuildTime = (items: any[]) => items.map(item => {
    const copy = { ...item }; delete copy.last_updated; return copy;
  });
  assert.deepEqual(withoutRebuildTime(await (await fetch(`${base}/api/companies`)).json()), withoutRebuildTime(contacts),
    'readback does not activate grouping or change facts');
  const conflict = await post(alias.id, { ...request, canonical_id: find('Global Pharma Ltd', 'Pakistan').id });
  assert.equal(conflict.status, 409); assert.equal((await conflict.json()).code, 'ALIAS_MAPPING_CONFLICT');
  await stop();
  const registryImage = fs.readFileSync(env.EDGEVIEW_SQLITE_DB);
  const imageHash = crypto.createHash('sha256').update(registryImage).digest('hex');
  // sql.js may own and mutate its input buffer. Keep the recovery preimage
  // separate from the deliberately modified fixture database.
  const changed = new SQL.Database(Uint8Array.from(registryImage));
  changed.run('UPDATE company_aliases SET proof_json=? WHERE alias_id=?', ['{"policy_version":999}', alias.id]);
  fs.writeFileSync(env.EDGEVIEW_SQLITE_DB, changed.export()); changed.close();
  assert.equal(crypto.createHash('sha256').update(registryImage).digest('hex'), imageHash);
  await start();
  const invalid = await post(alias.id, request); assert.equal(invalid.status, 409);
  assert.equal((await invalid.json()).code, 'ALIAS_REGISTRATION_REVIEW_REQUIRED');
  await stop(); fs.writeFileSync(env.EDGEVIEW_SQLITE_DB, registryImage); await start();
  assert.equal((await post(alias.id, request)).status, 200, 'restored fixture retains its original valid registration');
  const envelope = JSON.parse(fs.readFileSync(path.join(runs, 'run-alias-review.json'), 'utf8'));
  const hash = envelope.raw_records[0].response.__edgeview_blob_ref__.sha256;
  fs.writeFileSync(path.join(runs, 'blobs', 'sha256', hash.slice(0, 2), `${hash}.json.gz`), 'PRIVATE_SYNTHETIC_CORRUPTION');
  const corrupt = await post(alias.id, request); assert.equal(corrupt.status, 503);
  assert.deepEqual(await corrupt.json(), { success: false, code: 'ALIAS_EVIDENCE_UNREADABLE',
    message: 'Saved evidence could not be read. Inspect the research history or diagnostics.' });
  assert.equal((await fetch(`${base}/api/health`)).status, 200);
  assert.equal((await fetch(`${base}/api/files/${encodeURIComponent(fileId)}`, { method: 'DELETE' })).status, 200);
  assert.equal((await post(alias.id, request)).status, 404,
    'retained proof cannot resurrect companies removed with their source file');
  assert.equal(fs.existsSync(audit), false, 'opening/reviewing saved evidence never invokes any provider');
  console.log('PASS stored-ID alias review HTTP: actual upload identities, input tamper refusal, country isolation, immutable/no-write proof, restart, corruption and zero egress');
} finally {
  await stop(); assert.equal(fs.realpathSync(path.dirname(root)), fs.realpathSync(os.tmpdir()));
  fs.rmSync(root, { recursive: true, force: true });
}
