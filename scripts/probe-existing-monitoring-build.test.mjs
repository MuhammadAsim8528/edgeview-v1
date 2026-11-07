import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { artifactDigest, buildId } from '../shared/build_identity.mjs';

// These controls must fail before reading configuration, launching a runtime or
// contacting vendors. Never require real monitoring credentials for this test.
const script = fileURLToPath(new URL('./probe-existing-monitoring-build.mjs', import.meta.url));
const marker = 'PRIVATE_CONFIGURATION_MUST_NOT_APPEAR';
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
  /^(PATH|SystemRoot|WINDIR|COMSPEC|USERPROFILE|TEMP|TMP|APPDATA|LOCALAPPDATA)$/i.test(key)));
for (const args of [[], ['--root', marker], ['--root', marker, '--send'],
  ['--root', marker, '--send-real', 'extra']]) {
  const result = spawnSync(process.execPath, [script, ...args], {
    env, encoding: 'utf8', timeout: 10_000, maxBuffer: 16 * 1024, windowsHide: true,
  });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 2, 'inexact real-send opt-in must fail closed');
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /^Usage:/);
  assert.ok(!result.stderr.includes(marker));
}
const failed = spawnSync(process.execPath, [script, '--root', marker, '--send-real'], {
  env, encoding: 'utf8', timeout: 10_000, maxBuffer: 16 * 1024, windowsHide: true,
});
assert.equal(failed.error, undefined);
assert.equal(failed.status, 1);
assert.equal(failed.stdout, '');
assert.match(failed.stderr, /^Monitoring QA could not complete;/);
assert.ok(!failed.stderr.includes(marker), 'failure must not echo private paths/configuration');
console.log('PASS explicit monitoring opt-in and sanitized early failures; no real event sent');

// Exercise the operator probe against an owned loopback-only fake runtime.
// Its HTTPS-shaped configuration is synthetic; this fixture has no vendor client.
for (const scenario of ['delayed', 'stale', 'rejected']) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'edgeview-probe-contract-'));
  try {
    fs.mkdirSync(path.join(root, 'dist'));
    fs.writeFileSync(path.join(root, '.env'), [
      'EDGEVIEW_MONITORING_ENABLED=1',
      `EDGEVIEW_SENTRY_DSN=https://${'a'.repeat(32)}@example.ingest.sentry.io/123`,
      'EDGEVIEW_POSTHOG_KEY=phc_SYNTHETIC',
      'EDGEVIEW_POSTHOG_HOST=https://us.i.posthog.com',
    ].join('\n'));
    fs.writeFileSync(path.join(root, 'dist/server.cjs'), `
      const http = require('node:http'), fs = require('node:fs'), path = require('node:path');
      const build = JSON.parse(fs.readFileSync(path.join(__dirname,'build-info.json')));
      let polls = 0;
      http.createServer((req,res) => {
        res.setHeader('Content-Type','application/json');
        const initial = { state:'TRANSPORT_OK', last_transport_success_at:'2026-01-01T00:00:00.000Z' };
        let body;
        if(req.url === '/api/health') body = {app:{pid:process.pid,build,installation_id:'00000000-0000-4000-8000-000000000001'},providers:{}};
        else if(req.url === '/api/monitoring/test') body = {delivery:{projected:true,sentry:true,posthog:true},monitoring:{sentry:initial,posthog:initial}};
        else if(req.url === '/api/monitoring/frontend-error') {res.statusCode=202;body={delivery:'NOT_CONFIRMED'};}
        else if(req.url === '/api/monitoring/status') {
          polls++; fs.writeFileSync(path.join(__dirname,'../poll-count'),String(polls));
          const state = ${JSON.stringify(scenario)} === 'rejected' ? {state:'ERROR'}
            : ${JSON.stringify(scenario)} === 'stale' ? initial
            : polls < 3 ? {state:'CONFIGURED_UNVERIFIED'} : {state:'TRANSPORT_OK',last_transport_success_at:'2026-01-01T00:00:01.000Z'};
          body={monitoring:{sentry:state}};
        } else {res.statusCode=404;body={};}
        req.resume();res.end(JSON.stringify(body));
      }).listen(Number(process.env.PORT),'127.0.0.1');
    `);
    const version='1.0.0-rc.2', sourceHash='b'.repeat(64), artifactHash=artifactDigest(root);
    fs.writeFileSync(path.join(root,'dist/build-info.json'),JSON.stringify({format:1,name:'edgeview',version,sourceHash,artifactHash,
      buildId:buildId(version,sourceHash,artifactHash),builtAt:'2026-01-01T00:00:00Z',gitCommit:'c'.repeat(40)}));
    const result=spawnSync(process.execPath,[script,'--root',root,'--send-real'],{env,encoding:'utf8',timeout:35000,maxBuffer:16384,windowsHide:true});
    assert.equal(result.error,undefined,`${scenario}: owned probe must terminate within its bound`);
    assert.equal(result.status,scenario==='delayed'?0:1);
    if(scenario==='delayed') {
      assert.equal(JSON.parse(result.stdout).frontendTransportConfirmed,true);
      assert.ok(Number(fs.readFileSync(path.join(root,'poll-count'),'utf8'))>=3,'wait for a new transport success');
    } else {
      assert.equal(result.stdout,'','stale or failed transport must not claim success');
      assert.match(result.stderr,/^Monitoring QA could not complete;/);
    }
    assert.ok(!result.stderr.includes(root),'failure output must omit private paths');
  } finally { fs.rmSync(root,{recursive:true,force:true}); }
}
console.log('PASS delayed frontend transport, stale-success refusal and rejected transport; loopback fixtures only');
