import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { unusedTestPort } from './test-server-port.mjs';
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
 const first=await start();const identity=first.app.installation_id;assert.equal(path.resolve(first.app.data_root),data);
 assert.equal((await fetch(url+'/api/companies').then(r=>r.json())).length,0,'fresh customer storage must not expose demo contacts');
 assert.equal((await fetch(url+'/api/files').then(r=>r.json())).length,0,'fresh customer storage must not expose demo files');
 assert.ok(fs.existsSync(path.join(data,'edgeview.db')));assert.ok(fs.existsSync(path.join(data,'data/installation.json')));
 const form=new FormData();form.set('file',new Blob(['Date,Importer,Country,Exporter,Item,TOT_FC,QTY,UNT\n2026-01-01,Retained Buyer,Kenya,Retained Supplier,Product,10,1,KG']),'retained.csv');
 const uploaded=await fetch(url+'/api/files/upload',{method:'POST',body:form});assert.equal(uploaded.status,201);
 await stop();
 const bytes=fs.readFileSync(path.join(data,'edgeview_db.json'));assert.ok(bytes.includes(Buffer.from('Retained Buyer')));
 const second=await start();assert.equal(second.app.installation_id,identity);await stop();
 assert.deepEqual(fs.readFileSync(path.join(data,'edgeview_db.json')),bytes,'restart preserves dataset authority');
 for(const item of ['edgeview.db','edgeview_db.json','config.json','data','logs','uploads'])assert.ok(!fs.existsSync(path.join(app,item)),'installed code root must not receive '+item);
 const result=spawnSync(process.execPath,[path.join(source,'scripts/backup-runtime.mjs')],{cwd:app,env,encoding:'utf8',timeout:15000});assert.equal(result.status,0,result.stderr);
 const backup=JSON.parse(result.stdout);assert.ok(backup.backup.startsWith(path.join(data,'backups')+path.sep));
 assert.deepEqual(fs.readFileSync(path.join(backup.backup,'edgeview_db.json')),bytes);
 console.log('PASS production-mode separate state: real upload, restart identity/data, no app-root writes and correct backup authority.');
}finally{await stop();fs.rmSync(base,{recursive:true,force:true});}
