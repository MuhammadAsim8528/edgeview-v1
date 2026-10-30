import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { unusedTestPort } from './test-server-port.mjs';
import { acquireRuntimeMaintenance } from '../shared/runtime_maintenance.mjs';
import { setTimeout as pause } from 'node:timers/promises';
import { randomUUID } from 'node:crypto';
const args = process.argv.slice(2);
const soakCycles = args.length === 0 ? 0 : Number(args[1]);
assert.ok(args.length === 0 || (args.length === 2 && args[0] === '--soak-cycles'
 && /^\d+$/.test(args[1]) && Number.isSafeInteger(soakCycles) && soakCycles >= 1 && soakCycles <= 120),
 'Usage: separate-data-runtime.test.mjs [--soak-cycles 1..120] (30 seconds per cycle)');
const source=process.cwd(),base=fs.mkdtempSync(path.join(os.tmpdir(),'edgeview-installed-data-'));
const app=path.join(base,'app'),data=path.join(base,'state');fs.mkdirSync(app);fs.mkdirSync(data);
fs.cpSync(path.join(source,'dist'),path.join(app,'dist'),{recursive:true});
fs.copyFileSync(path.join(source,'packaging/windows/runtime-bootstrap.cjs'),path.join(app,'runtime-bootstrap.cjs'));
fs.writeFileSync(path.join(app,'package.json'),JSON.stringify({name:'edgeview',version:'1.0.0-rc.2'}));
fs.writeFileSync(path.join(data,'config.json'),JSON.stringify({serper_enabled:false,hunter_enabled:false,nvidia_enabled:false,groq_enabled:false}));
// Do not precreate an empty dataset: that masked first-boot demo seeding.
const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>/^(PATH|SystemRoot|WINDIR|COMSPEC|USERPROFILE|TEMP|TMP|APPDATA|LOCALAPPDATA)$/i.test(k)));
const port=await unusedTestPort(),url=`http://127.0.0.1:${port}`;
Object.assign(env,{NODE_ENV:'production',NODE_PATH:path.join(source,'node_modules'),EDGEVIEW_DATA_DIR:data,PORT:String(port)});
let child;
async function stop(){if(child&&child.exitCode===null&&child.signalCode===null){const done=once(child,'exit',{signal:AbortSignal.timeout(20000)});child.stdin.end('shutdown\n');const [code]=await done;assert.equal(code,0,'normal customer close must finish its durable shutdown');}}
async function start(){
 child=spawn(process.execPath,[path.join(app,'runtime-bootstrap.cjs')],{cwd:app,env,stdio:['pipe','ignore','pipe']});let err='';child.stderr.on('data',b=>{err=(err+String(b)).slice(-2000);});child.stdin.on('error',()=>{});
 for(const until=Date.now()+45000;Date.now()<until;){
  if(child.exitCode!==null)throw new Error('Owned server exited: '+err);
  try{const r=await fetch(url+'/api/health',{signal:AbortSignal.timeout(1500)});const h=await r.json();if(h.app?.pid===child.pid){assert.equal(path.resolve(h.app.project_root),app);return h;}}catch{}
  await new Promise(r=>setTimeout(r,100));
 }throw new Error('Owned separate-data runtime not ready: '+err);
}
try{
 // A live unrelated PID must not authorize deletion of a legacy numeric lock.
 const lock=path.join(data,'edgeview.db.lock'),owner=lock+'.owner.json';
 const releaseMaintenance=acquireRuntimeMaintenance(lock);
 try {
  const gateOwner=fs.readFileSync(lock+'.maintenance/owner.json','utf8');
  const duringBackup=spawnSync(process.execPath,[path.join(app,'runtime-bootstrap.cjs')],{cwd:app,env,encoding:'utf8',input:'',timeout:15000});
  assert.equal(duringBackup.error,undefined,'blocked startup must terminate promptly');
  assert.notEqual(duringBackup.status,0);assert.match(duringBackup.stderr,/RUNTIME_MAINTENANCE_BUSY/);
  assert.equal(fs.readFileSync(lock+'.maintenance/owner.json','utf8'),gateOwner,'refused startup cannot remove another operation gate');
  assert.equal(fs.existsSync(lock),false);assert.equal(fs.existsSync(path.join(data,'edgeview.db')),false);
 } finally { releaseMaintenance(); }
 fs.writeFileSync(lock,String(process.pid));
 const refused=spawnSync(process.execPath,[path.join(app,'runtime-bootstrap.cjs')],{cwd:app,env,encoding:'utf8',input:'',timeout:15000});
 assert.notEqual(refused.status,0,'legacy alive owner remains conservative');
 assert.match(refused.stderr,/Another EdgeView backend owns/);
 assert.equal(fs.readFileSync(lock,'utf8'),String(process.pid));
 assert.ok(!fs.existsSync(path.join(data,'edgeview.db')),'refused startup must not initialize the database');
 // Reproduce a PID reused by an unrelated process: same live PID, different birth.
 const oldBirth=process.platform==='win32'?'windows:100000000000':'linux:00000000-0000-0000-0000-000000000000:1';
 fs.writeFileSync(owner,JSON.stringify({pid:process.pid,birth:oldBirth}));
 const first=await start();const identity=first.app.installation_id;assert.equal(path.resolve(first.app.data_root),data);
 const ownedLock=fs.readFileSync(lock,'utf8'),ownedMetadata=fs.readFileSync(owner,'utf8');
 assert.equal(ownedLock,String(child.pid));
 const duplicate=spawnSync(process.execPath,[path.join(app,'runtime-bootstrap.cjs')],{cwd:app,env,encoding:'utf8',input:'',timeout:15000});
 assert.notEqual(duplicate.status,0,'actual alive backend must refuse a duplicate');
 assert.match(duplicate.stderr,/Another EdgeView backend owns/);
 assert.equal(fs.readFileSync(lock,'utf8'),ownedLock);
 assert.equal(fs.readFileSync(owner,'utf8'),ownedMetadata);
 assert.equal((await fetch(url+'/api/health').then(r=>r.json())).app.pid,child.pid);
 assert.equal((await fetch(url+'/api/companies').then(r=>r.json())).length,0,'fresh customer storage must not expose demo contacts');
 assert.equal((await fetch(url+'/api/files').then(r=>r.json())).length,0,'fresh customer storage must not expose demo files');
 assert.ok(fs.existsSync(path.join(data,'edgeview.db')));assert.ok(fs.existsSync(path.join(data,'data/installation.json')));
 const form=new FormData();form.set('file',new Blob(['Date,Importer,Country,Exporter,Item,TOT_FC,QTY,UNT\n2026-01-01,Retained Buyer,Kenya,Retained Supplier,Product,10,1,KG']),'retained.csv');
 const uploaded=await fetch(url+'/api/files/upload',{method:'POST',body:form});assert.equal(uploaded.status,201);
 if(soakCycles){
  const reportFile=path.join(source,'.test-cache',`isolated-soak-${randomUUID()}.json`);
  const controller=new AbortController();const cancel=()=>controller.abort();
  process.once('SIGINT',cancel);process.once('SIGTERM',cancel);
  const report={format:1,status:'RUNNING',scope:'synthetic import/read/export/delete; providers disabled; not browser, large-data or leak-free acceptance',
   build:first.app.build,startedAt:new Date().toISOString(),requestedCycles:soakCycles,intervalMs:30000,samples:[]};
  fs.mkdirSync(path.dirname(reportFile),{recursive:true});
  const save=()=>fs.writeFileSync(reportFile,JSON.stringify(report,null,2));
  console.log(JSON.stringify({stage:'soak_started',reportFile,cycles:soakCycles}));save();
  const bounded=async(response,json=false)=>{
   assert.ok(response.ok,'soak request must succeed');const chunks=[];let size=0;
   if(response.body)for await(const chunk of response.body){size+=chunk.length;assert.ok(size<=16*1024*1024,'bounded soak response');if(json)chunks.push(Buffer.from(chunk));}
   return json?JSON.parse(Buffer.concat(chunks).toString('utf8')):null;
  };
  const request=(route,options={})=>fetch(url+route,{...options,redirect:'error',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(10000)])});
  try{
   for(let cycle=0;cycle<soakCycles;cycle++){
    controller.signal.throwIfAborted();const started=performance.now();
    const health=await bounded(await request('/api/health'),true);assert.equal(health.app.pid,child.pid);
    for(const key of ['rss_mb','heap_used_mb'])assert.ok(Number.isFinite(health.memory?.[key]),'actual memory measurement required');
    const rows=Array.from({length:100},(_,i)=>`2026-01-01,Soak Buyer ${i%10},${i%2?'Kenya':'Pakistan'},Soak Supplier,Product ${cycle}-${i},10`);
    const cycleForm=new FormData();cycleForm.set('file',new Blob(['Date,Importer,Country,Exporter,Item,TOT_FC\n'+rows.join('\n')]),`synthetic-soak-${cycle}.csv`);
    await bounded(await request('/api/files/upload',{method:'POST',body:cycleForm}));
    const directory=await bounded(await request('/api/companies'),true);assert.ok(Array.isArray(directory));
    await bounded(await request('/api/export/blocks',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({company_ids:directory.map(item=>item.id)})}));
    const files=await bounded(await request('/api/files'),true);const active=files.find(item=>item.name===`synthetic-soak-${cycle}.csv`);assert.ok(active);
    await bounded(await request('/api/files/'+encodeURIComponent(active.id),{method:'DELETE'}));
    report.samples.push({cycle:cycle+1,at:new Date().toISOString(),rssMb:health.memory.rss_mb,heapUsedMb:health.memory.heap_used_mb,
     workflowMs:performance.now()-started,companies:directory.length});save();
    console.log(JSON.stringify({stage:'soak_sample',...report.samples.at(-1)}));
    await pause(30000,undefined,{signal:controller.signal});
   }
   report.status='COMPLETED';report.completedAt=new Date().toISOString();save();
  }catch(error){report.status=controller.signal.aborted?'INTERRUPTED':'FAILED';save();throw error;}
  finally{process.removeListener('SIGINT',cancel);process.removeListener('SIGTERM',cancel);}
 }
 await stop();
 assert.equal(fs.existsSync(lock),false);assert.equal(fs.existsSync(owner),false);
 const bytes=fs.readFileSync(path.join(data,'edgeview_db.json'));assert.ok(bytes.includes(Buffer.from('Retained Buyer')));
 const second=await start();assert.equal(second.app.installation_id,identity);await stop();
 assert.deepEqual(fs.readFileSync(path.join(data,'edgeview_db.json')),bytes,'restart preserves dataset authority');
 for(const item of ['edgeview.db','edgeview_db.json','config.json','data','logs','uploads'])assert.ok(!fs.existsSync(path.join(app,item)),'installed code root must not receive '+item);
 const result=spawnSync(process.execPath,[path.join(source,'scripts/backup-runtime.mjs')],{cwd:app,env,encoding:'utf8',timeout:15000});assert.equal(result.status,0,result.stderr);
 const backup=JSON.parse(result.stdout);assert.ok(backup.backup.startsWith(path.join(data,'backups')+path.sep));
 assert.deepEqual(fs.readFileSync(path.join(backup.backup,'edgeview_db.json')),bytes);
 console.log('PASS production-mode separate state: real upload, restart identity/data, no app-root writes and correct backup authority.');
}finally{await stop();fs.rmSync(base,{recursive:true,force:true});}
