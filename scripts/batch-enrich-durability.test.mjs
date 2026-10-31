import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {build} from 'esbuild';
import {unusedTestPort} from './test-server-port.mjs';

// Synthetic provider seam and controlled SQLite write/flush failures. The real
// job worker, projection, Express endpoints and SQLite persistence stay in use.
const repo=process.cwd(), root=fs.mkdtempSync(path.join(os.tmpdir(),'edgeview-batch-durable-'));
assert.ok(process.argv.length===2||(process.argv.length===3&&process.argv[2]==='--mutant-no-durable'));
const mutant=process.argv[2]==='--mutant-no-durable';
const engine=path.join(repo,'server/v1_engine.ts'), sqlite=path.join(repo,'server/sqlite.ts');
const denied=path.join(root,'deny.cjs');
fs.mkdirSync(path.join(root,'dist'));
fs.copyFileSync(path.join(repo,'packaging/windows/runtime-bootstrap.cjs'),path.join(root,'runtime-bootstrap.cjs'));
fs.writeFileSync(denied,`const deny=()=>{throw Error('SYNTHETIC_TEST_EGRESS_DENIED');};for(const n of ['node:http','node:https']){require(n).request=deny;require(n).get=deny;}globalThis.fetch=deny;`);
let child;
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(check,message){for(const end=Date.now()+25000;Date.now()<end;){if(await check())return;await delay(30);}throw Error(message);}
async function stop(){if(child&&child.exitCode===null&&child.signalCode===null){const done=once(child,'exit',{signal:AbortSignal.timeout(25000)});child.stdin.end('shutdown\n');assert.equal((await done)[0],0);}child=null;}
try{
 await build({entryPoints:['server.ts'],outfile:path.join(root,'dist','server.cjs'),bundle:true,platform:'node',format:'cjs',packages:'external',logLevel:'silent',plugins:[{name:'batch-durability-seams',setup(plugin){
  if(mutant)plugin.onLoad({filter:/job_manager\.ts$/},args=>{
   assert.equal(path.resolve(args.path),path.join(repo,'server/job_manager.ts'));
   const source=fs.readFileSync(args.path,'utf8'),target='await persistV1ContactOverlay(companyId, run.id, projected, true);';
   assert.equal(source.split(target).length,2,'mutation must affect exactly the fresh-worker save');
   return{contents:source.replace(target,'await persistV1ContactOverlay(companyId, run.id, projected, false);'),loader:'ts'};
  });
  plugin.onResolve({filter:/^(\.\/server\/v1_engine|\.\/v1_engine|\.\/sqlite)$/},args=>{
   if(args.path.endsWith('v1_engine')&&[path.join(repo,'server.ts'),path.join(repo,'server/job_manager.ts')].includes(path.resolve(args.importer)))return{path:'engine',namespace:'fixture'};
   if(args.path==='./sqlite'&&path.resolve(args.importer)===path.join(repo,'server/job_manager.ts'))return{path:'sqlite',namespace:'fixture'};
  });
  plugin.onLoad({filter:/.*/,namespace:'fixture'},args=>({loader:'ts',resolveDir:repo,contents:args.path==='engine'?`
   export * from ${JSON.stringify(engine)};
   import {persistV1Run} from ${JSON.stringify(engine)};
   export async function runV1Enrichment(company_name,country){const run={id:'run-synthetic-batch-durable',company_name,country,status:'COMPLETED',started_at:new Date().toISOString(),queries:[],timeline:[],raw_records:[],limits:{},identity_resolution:{official_domain:'scopeanchor.test',confidence:'high',candidates:[]},results:[{id:'local',run_id:'run-synthetic-batch-durable',raw_record_id:'fixture',provider:'direct-http',rank:1,title:'',url:'https://scopeanchor.test/kenya',snippet:'',text:'Kenya office kenya@scopeanchor.test',links:[],metadata:{},status:'success'}]};persistV1Run(run);return run;}
  `:`
   export * from ${JSON.stringify(sqlite)};
   import {getDb as realGetDb} from ${JSON.stringify(sqlite)};
   import fs from 'node:fs';
   let wrapped;
   export async function getDb(){const db=await realGetDb();if(wrapped)return wrapped;let armed=false;
    wrapped={...db,run:async(sql,...args)=>{
     if(/INSERT INTO v1_contact_enrichment/i.test(sql)){
      fs.writeFileSync(process.env.FIXTURE_READY,'ready');
      for(const end=Date.now()+20000;!fs.existsSync(process.env.FIXTURE_RELEASE);){if(Date.now()>end)throw Error('fixture release timeout');await new Promise(r=>setTimeout(r,20));}
      armed=true;
     }return db.run(sql,...args);
    },flush:async()=>{if(armed){armed=false;fs.writeFileSync(process.env.FIXTURE_FLUSHED,'called');for(const end=Date.now()+20000;!fs.existsSync(process.env.FIXTURE_FLUSH_RELEASE);){if(Date.now()>end)throw Error('fixture flush timeout');await new Promise(r=>setTimeout(r,20));}if(process.env.FIXTURE_FAIL==='1')throw Object.assign(Error('Synthetic disk refusal'),{code:'PERSISTENCE_WRITE_FAILED'});}return db.flush();}};return wrapped;
   }
  `}));
 }}]});
 for(const fail of [true,false]){
  const state=path.join(root,fail?'failure':'success');fs.mkdirSync(state);fs.writeFileSync(path.join(state,'data.json'),'[]');
  const port=await unusedTestPort(),base=`http://127.0.0.1:${port}`;
  const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>/^(PATH|SystemRoot|WINDIR|COMSPEC|USERPROFILE|TEMP|TMP|APPDATA|LOCALAPPDATA)$/i.test(key)));
  Object.assign(env,{NODE_PATH:path.join(repo,'node_modules'),NODE_ENV:'test',EDGEVIEW_TEST_MODE:'1',EDGEVIEW_TEST_DB_DIR:state,EDGEVIEW_JSON_DB:path.join(state,'data.json'),EDGEVIEW_SQLITE_DB:path.join(state,'operations.db'),EDGEVIEW_CONFIG:path.join(state,'config.json'),EDGEVIEW_V1_DATA_DIR:path.join(state,'runs'),EDGEVIEW_MONITORING_ENABLED:'0',SERPER_API_KEY:'synthetic_not_real',PORT:String(port),FIXTURE_READY:path.join(state,'ready'),FIXTURE_RELEASE:path.join(state,'release'),FIXTURE_FLUSHED:path.join(state,'flushed'),FIXTURE_FLUSH_RELEASE:path.join(state,'flush-release'),FIXTURE_FAIL:fail?'1':'0'});
  async function start(){child=spawn(process.execPath,['-r',denied,path.join(root,'runtime-bootstrap.cjs')],{cwd:repo,env,stdio:['pipe','ignore','ignore']});child.stdin.on('error',()=>{});await until(async()=>{assert.equal(child.exitCode,null);try{const r=await fetch(base+'/api/health',{signal:AbortSignal.timeout(1000)});return r.ok&&(await r.json()).app.pid===child.pid;}catch{return false;}},'owned runtime readiness timeout');}
  const request=(route,body)=>fetch(base+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(10000)});
  const companies=()=>fetch(base+'/api/companies',{signal:AbortSignal.timeout(5000)}).then(r=>r.json());
  await start();const form=new FormData();form.set('file',new Blob(['Importer,Country,Exporter,Item\nScopeanchor Medical,Kenya,Synthetic Supplier,Product']),'synthetic-batch.csv');assert.equal((await fetch(base+'/api/files/upload',{method:'POST',body:form})).status,201);
  const before=(await companies()).find(c=>c.company_name==='Scopeanchor Medical');assert.ok(before);
  const created=await request('/api/enrich/jobs',{company_ids:[before.id],mode:'importer'});assert.equal(created.status,200);const {jobId}=await created.json();assert.equal((await request(`/api/enrich/job/${jobId}/start`,{forceFetch:true})).status,200);
  await until(()=>fs.existsSync(env.FIXTURE_READY),'real worker did not reach overlay persistence');
  assert.deepEqual((await companies()).find(c=>c.id===before.id),before,'pending batch save must not publish contact fields');
  fs.writeFileSync(env.FIXTURE_RELEASE,'release');
  await until(()=>fs.existsSync(env.FIXTURE_FLUSHED),'worker did not request durable flush');
  assert.deepEqual((await companies()).find(c=>c.id===before.id),before,'pending disk flush must not publish contact fields');
  fs.writeFileSync(env.FIXTURE_FLUSH_RELEASE,'release');let job;
  await until(async()=>{job=(await fetch(base+`/api/enrich/job/${jobId}`).then(r=>r.json())).job;return ['COMPLETED','FAILED'].includes(job?.status);},'batch did not terminate');
  assert.ok(fs.existsSync(env.FIXTURE_FLUSHED),'worker must await explicit durable overlay flush');
  const after=(await companies()).find(c=>c.id===before.id);
  if(fail){assert.deepEqual(after,before,'rejected durable batch save must not publish contact');assert.equal(job.company_states[before.id].status,'failed');}
  else{assert.ok(after.emails_list.includes('kenya@scopeanchor.test'));assert.equal(job.company_states[before.id].status,'completed');}
  assert.equal((await fetch(base+'/api/v1/runs/run-synthetic-batch-durable')).status,200,'raw evidence remains discoverable');
  await stop();if(!fail){await start();assert.ok((await companies()).find(c=>c.id===before.id).emails_list.includes('kenya@scopeanchor.test'));await stop();}
 }
 console.log('PASS fresh batch pending/rejected durability boundary, explicit flush, raw evidence and successful restart; synthetic transport only');
}finally{for(const name of ['failure','success']){const directory=path.join(root,name);if(fs.existsSync(directory))for(const marker of ['release','flush-release'])fs.writeFileSync(path.join(directory,marker),'cleanup');}await stop();assert.equal(path.dirname(fs.realpathSync(root)),fs.realpathSync(os.tmpdir()));fs.rmSync(root,{recursive:true,force:true});}
