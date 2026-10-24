import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { unusedTestPort } from '../../scripts/test-server-port.mjs';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'edgeview-log-http-'));
const port = await unusedTestPort();
const base = `http://127.0.0.1:${port}`;
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => /^(PATH|SystemRoot|WINDIR|COMSPEC|USERPROFILE|TEMP|TMP|APPDATA|LOCALAPPDATA)$/i.test(key)));
const child = spawn(process.execPath, ['--import', 'tsx', '--input-type=module', '--eval', `
  const fs = await import('node:fs');
  const path = await import('node:path');
  const { persistV1Run } = await import('./server/v1_engine.ts');
  const root = process.env.EDGEVIEW_V1_DATA_DIR;
  persistV1Run({id:'run-activity-http',company_name:'Synthetic HTTP Company',country:'Kenya',status:'FAILED',started_at:'2026-01-01T00:00:00Z',completed_at:'2026-01-01T00:01:00Z',queries:[],results:[],limits:{max_queries:1,max_results_per_query:1,max_scrapes:0,timeout_ms:1000},
    raw_records:[{id:'raw-fixture',run_id:'run-activity-http',kind:'search',provider:'serper',request:{},response:'HEAVY_RAW_SENTINEL '.repeat(200000),failure:{name:'FixtureFailure',message:'Synthetic failure'},requested_at:'2026-01-01T00:00:00Z',completed_at:'2026-01-01T00:01:00Z',latency_ms:1,sha256:'fixture'}],
    timeline:Array.from({length:20},(_,i)=>({at:new Date(Date.UTC(2026,0,1,0,0,i)).toISOString(),stage:'search',status:'failed',message:'Event '+i}))});
  const stored=JSON.parse(fs.readFileSync(path.join(root,'run-activity-http.json'),'utf8'));
  const sha=stored.raw_records[0].response.__edgeview_blob_ref__.sha256;
  fs.writeFileSync(path.join(root,'blobs','sha256',sha.slice(0,2),sha+'.json.gz'),'corrupt-owned-synthetic-blob');
  await import('./server.ts');
`], { cwd: process.cwd(), env: { ...env, NODE_ENV: 'test', PORT: String(port), EDGEVIEW_TEST_MODE: '1', EDGEVIEW_TEST_DB_DIR: root,
  EDGEVIEW_JSON_DB: path.join(root, 'rows.json'), EDGEVIEW_SQLITE_DB: path.join(root, 'operational.db'), EDGEVIEW_CONFIG: path.join(root, 'config.json'), EDGEVIEW_V1_DATA_DIR: root }, stdio: ['ignore', 'ignore', 'pipe'] });
let stderr = '';
child.stderr?.on('data', bytes => { stderr = (stderr + String(bytes)).slice(-3000); });
try {
  let ready = false;
  for (const deadline = Date.now() + 45_000; Date.now() < deadline;) {
    assert.equal(child.exitCode, null, stderr);
    try {
      const health = await (await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(1000) })).json();
      assert.equal(health.app.pid, child.pid); ready = true; break;
    } catch { await new Promise(resolve => setTimeout(resolve, 100)); }
  }
  assert.ok(ready, stderr);
  assert.equal((await fetch(`${base}/api/v1/runs/run-activity-http`)).status, 500, 'full evidence reader still rejects corrupt blobs');
  for (const route of ['/api/logs/enrichment', '/api/enrich/activity-log']) {
    const response = await fetch(`${base}${route}?tail=2`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('x-edgeview-log-scope'), 'latest-20-runs');
    const events = await response.json();
    assert.equal(events.length, 2);
    assert.equal(events[0].message, 'Event 19');
    assert.equal(events[1].message, 'Event 18');
    assert.doesNotMatch(JSON.stringify(events), /HEAVY_RAW_SENTINEL|raw_records|response/);
  }
  fs.writeFileSync(path.join(root, 'run-activity-http.json'), '{corrupt-owned-timeline');
  const events = await (await fetch(`${base}/api/logs/enrichment?tail=1`)).json();
  assert.equal(events[0].error, 'RUN_TIMELINE_READ_FAILED');
  assert.equal(events[0].status, 'failed');
  assert.equal((await fetch(`${base}/api/health`)).status, 200);
  console.log('PASS actual activity aliases: bounded timeline survives unavailable raw blob, full evidence integrity still fails closed, corrupt timeline is observable');
} finally {
  if (child.exitCode === null) { const exited = once(child, 'exit', { signal: AbortSignal.timeout(15_000) }); child.kill(); await exited; }
  fs.rmSync(root, { recursive: true, force: true });
}
