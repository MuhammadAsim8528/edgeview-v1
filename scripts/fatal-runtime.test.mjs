import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { artifactDigest, buildId } from '../shared/build_identity.mjs';
import { unusedTestPort } from './test-server-port.mjs';

// Actual compiled backend and consent/wiring, isolated synthetic storage. Only
// the separate reporter is replaced by a local receipt sink; no vendor calls.
fs.mkdirSync(path.join(process.cwd(), '.test-cache'), { recursive: true });
const root = fs.mkdtempSync(path.join(process.cwd(), '.test-cache', 'fatal-runtime-'));
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
  /^(PATH|SystemRoot|WINDIR|COMSPEC|USERPROFILE|TEMP|TMP|APPDATA|LOCALAPPDATA)$/i.test(key)));
try {
  const app=path.join(root,'app');fs.mkdirSync(path.join(app,'dist'),{recursive:true});
  fs.writeFileSync(path.join(app,'package.json'),JSON.stringify({name:'edgeview',version:'1.0.0-rc.2'}));
  fs.copyFileSync('dist/server.cjs',path.join(app,'dist/server.cjs'));
  const receipt=path.join(root,'receipt.json'),unsafe=path.join(root,'unsafe-continuation');
  fs.writeFileSync(path.join(app,'dist/fatal-reporter.cjs'),`
    const fs=require('node:fs'); let input='';
    if(process.env.PROVIDER_SECRET_TEST || process.env.EDGEVIEW_POSTHOG_KEY)process.exit(2);
    process.stdin.on('data',chunk=>input+=chunk);
    process.stdin.once('end',()=>fs.writeFileSync(${JSON.stringify(receipt)},input));
  `);
  const version='1.0.0-rc.2',sourceHash='a'.repeat(64),artifactHash=artifactDigest(app);
  fs.writeFileSync(path.join(app,'dist/build-info.json'),JSON.stringify({format:1,name:'edgeview',version,sourceHash,artifactHash,
    buildId:buildId(version,sourceHash,artifactHash),gitCommit:'b'.repeat(40),builtAt:new Date().toISOString()}));
  for(const [kind,enabled,consent] of [['exception',true,true],['rejection',true,true],['exception',false,true],['rejection',true,false]]) {
    for(const file of [receipt,unsafe])if(fs.existsSync(file))fs.unlinkSync(file);
    const state=path.join(root,crypto.randomUUID());fs.mkdirSync(state);
    fs.writeFileSync(path.join(state,'config.json'),JSON.stringify({monitoring_errors_enabled:consent,monitoring_usage_enabled:false}));
    const hook=path.join(root,'trigger.cjs');
    fs.writeFileSync(hook,`
      const http=require('node:http'),https=require('node:https'),fs=require('node:fs');
      // A synthetic DSN is configured only to exercise the runtime consent gate.
      // No network request can leave this test backend.
      https.request=()=>{throw Error('OUTBOUND_FORBIDDEN');};
      global.fetch=()=>Promise.reject(Error('OUTBOUND_FORBIDDEN'));
      const listen=http.Server.prototype.listen;
      http.Server.prototype.listen=function(...args){
        this.once('listening',()=>setTimeout(()=>{
          setTimeout(()=>fs.writeFileSync(${JSON.stringify(unsafe)},'unsafe'),10);
          ${kind==='exception' ? "throw new Error('PRIVATE_CRASH_SENTINEL')" : "Promise.reject(new Error('PRIVATE_CRASH_SENTINEL'))"};
        },100));return listen.apply(this,args);
      };
    `);
    const start=Date.now();
    const result=spawnSync(process.execPath,['--require',hook,path.join(app,'dist/server.cjs')],{
      cwd:app,env:{...env,NODE_ENV:'production',PORT:String(await unusedTestPort()),EDGEVIEW_DATA_DIR:state,
        EDGEVIEW_MONITORING_ENABLED:enabled?'1':'0',EDGEVIEW_SENTRY_DSN:`https://${'a'.repeat(32)}@example.ingest.sentry.io/123`,
        PROVIDER_SECRET_TEST:'PRIVATE_PROVIDER_SENTINEL'},encoding:'utf8',timeout:30000,maxBuffer:1024*1024,windowsHide:true,
    });
    assert.equal(result.error,undefined,'owned backend must terminate within its startup/failure budget');
    assert.equal(result.status,1,'fatal backend must retain failure exit status');
    assert.match(result.stderr,/restart required/,'must reach the actual fatal handler');
    assert.equal(fs.existsSync(unsafe),false,'no application timer may resume after the fatal handler');
    assert.equal(fs.existsSync(receipt),enabled&&consent,'current monitoring opt-out must prevent reporter launch');
    if(enabled&&consent){
      const text=fs.readFileSync(receipt,'utf8'),value=JSON.parse(text);
      assert.equal(value.kind,kind==='exception'?'uncaught exception':'unhandled rejection');
      assert.deepEqual(Object.keys(value.identity).sort(),['version','build_id','channel','installation_id'].sort());
      assert.equal(value.identity.build_id,buildId(version,sourceHash,artifactHash));
      assert.ok(!/PRIVATE_|exception_text|stack|company|path/.test(text));
    }
    assert.ok(Date.now()-start<30000);
  }
  console.log('PASS actual compiled fatal wiring: exception/rejection, monitoring disabled, errors opted out, no unsafe continuation, no private reporter payload');
} finally {
  assert.equal(path.dirname(fs.realpathSync(root)),fs.realpathSync(path.join(process.cwd(),'.test-cache')));
  fs.rmSync(root,{recursive:true,force:true});
}
