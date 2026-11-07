import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { build } from 'esbuild';
import { reportFatalIsolated } from '../fatal_reporting';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'edgeview-fatal-report-'));
const identity = { version: '1.0.0-rc.2', build_id: 'a'.repeat(64), channel: 'beta' as const,
  installation_id: '00000000-0000-4000-8000-000000000001' };
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
  /^(PATH|SystemRoot|WINDIR|COMSPEC|USERPROFILE|TEMP|TMP|APPDATA|LOCALAPPDATA)$/i.test(key)));
try {
  fs.mkdirSync(path.join(root, 'dist'));
  const reporter = path.join(root, 'dist', 'fatal-reporter.cjs');
  const receipt = path.join(root, 'receipt.json');
  const previous = process.env.PROVIDER_SECRET_TEST;
  process.env.PROVIDER_SECRET_TEST = 'PRIVATE_SENTINEL';
  try {
    fs.writeFileSync(reporter, `const fs=require('node:fs');let text='';process.stdin.on('data',x=>text+=x);process.stdin.on('end',()=>{
      const input=JSON.parse(text); if(process.env.PROVIDER_SECRET_TEST || process.env.EDGEVIEW_POSTHOG_KEY) process.exit(2);
      fs.writeFileSync(${JSON.stringify(receipt)},JSON.stringify(input));});`);
    assert.equal(reportFatalIsolated(root, { ...identity, hidden: 'PRIVATE_SENTINEL' } as typeof identity, 'uncaught exception'), true);
    const value = JSON.parse(fs.readFileSync(receipt, 'utf8'));
    assert.deepEqual(value, { identity, kind: 'uncaught exception' });
    assert.equal(fs.readFileSync(receipt,'utf8').includes('PRIVATE_SENTINEL'),false);
    fs.writeFileSync(reporter, 'process.exit(1)');
    assert.equal(reportFatalIsolated(root,identity,'unhandled rejection'),false);
    fs.writeFileSync(reporter, 'setInterval(()=>{},1000)');
    const start=Date.now();
    assert.equal(reportFatalIsolated(root,identity,'uncaught exception'),false);
    assert.ok(Date.now()-start<6000,'hung reporter must not delay termination without a bound');
    fs.unlinkSync(reporter);
    assert.equal(reportFatalIsolated(root,identity,'uncaught exception'),false);
  } finally {
    if(previous===undefined) delete process.env.PROVIDER_SECRET_TEST;
    else process.env.PROVIDER_SECRET_TEST=previous;
  }

  // Compile the real entrypoint with only its existing adapter replaced. The
  // privacy projection remains real; no vendor or database is contacted.
  await build({ entryPoints:['server/fatal_reporter.ts'],outfile:reporter,bundle:true,platform:'node',format:'cjs',
    logLevel:'silent',plugins:[{name:'owned-monitoring-contract',setup(plugin){
      plugin.onResolve({filter:/^\.\/monitoring$/},()=>({path:'monitoring',namespace:'fixture'}));
      plugin.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:`
        export function initMonitoring(identity,prefs){if(prefs.errors!==true||prefs.usage!==false)throw Error();}
        export async function captureMonitoringEvent(name,props,flush){
          if(process.env.FATAL_FIXTURE_STALL==='1')return new Promise(()=>{});
          if(name!=='runtime_error'||props.stage!=='shutdown'||props.outcome!=='failed'||flush!==true)throw Error();
          if(!['PROCESS_UNCAUGHT_EXCEPTION','PROCESS_UNHANDLED_REJECTION'].includes(props.error_code))throw Error();
          return {sentry:true};
        }` }));
    }}] });
  for (const kind of ['uncaught exception','unhandled rejection']) {
    const result=spawnSync(process.execPath,[reporter],{env,input:JSON.stringify({identity,kind}),encoding:'utf8',timeout:5000});
    assert.equal(result.status,0); assert.equal(result.stdout,'');assert.equal(result.stderr,'');
  }
  const stalled=spawnSync(process.execPath,[reporter],{env:{...env,FATAL_FIXTURE_STALL:'1'},
    input:JSON.stringify({identity,kind:'uncaught exception'}),encoding:'utf8',timeout:5000});
  assert.equal(stalled.error,undefined);assert.equal(stalled.status,1);
  assert.equal(stalled.stdout,'');assert.equal(stalled.stderr,'');
  for (const input of ['bad JSON','x'.repeat(2049),JSON.stringify({identity,kind:'PRIVATE_SENTINEL'}),
    JSON.stringify({identity:{...identity,installation_id:'invalid'},kind:'uncaught exception'}),
    JSON.stringify({identity,kind:'uncaught exception',exception:'PRIVATE_SENTINEL'})]) {
    const result=spawnSync(process.execPath,[reporter],{env,input,encoding:'utf8',timeout:5000});
    assert.equal(result.status,2);assert.equal(result.stdout,'');assert.equal(result.stderr,'');
  }
  console.log('PASS isolated fatal reporting: fixed codes, identity projection, no inherited provider secrets, timeout, failures and bounded input');
} finally { fs.rmSync(root,{recursive:true,force:true}); }
