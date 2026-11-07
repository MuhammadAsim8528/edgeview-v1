import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { build } from 'esbuild';
import initSqlJs from 'sql.js';
import { unusedTestPort } from './test-server-port.mjs';

// Real HTTP/job loop/sql.js and immutable store. Only the provider operation is
// replaced by a deterministic barrier; no provider/customer credentials or egress.
const repo = process.cwd();
const root = fs.mkdtempSync(path.join(repo,'.test-cache','batch-lifecycle-'));
const engine = path.join(repo,'server/v1_engine.ts');
const children = new Set();
const sleep = ms => new Promise(resolve => setTimeout(resolve,ms));
async function until(check, label, timeoutMs = 30000) {
  for (const end = Date.now()+timeoutMs; Date.now()<end;) { if (await check()) return; await sleep(40); }
  throw new Error(typeof label === 'function' ? label() : label);
}
const noEgress = path.join(root,'deny-egress.cjs');
fs.writeFileSync(noEgress, `const deny=()=>{throw new Error('BATCH_FIXTURE_EGRESS_DISABLED')}; for(const name of ['node:http','node:https']) { const m=require(name);m.request=deny;m.get=deny; } globalThis.fetch=deny;
const fs=require('node:fs');
let previousWork=0, maximumWork=0;
const timer=setInterval(()=>{
  if(process.env.FIXTURE_SCENARIO==='retained-cpu' && fs.existsSync(process.env.FIXTURE_CALLS)) {
    const work=fs.readFileSync(process.env.FIXTURE_CALLS,'utf8').trim().split(String.fromCharCode(10)).filter(Boolean).length;
    maximumWork=Math.max(maximumWork,work-previousWork);previousWork=work;
    fs.writeFileSync(process.env.FIXTURE_TICKS,String(maximumWork));
  }
  if(process.env.FIXTURE_SHUTDOWN&&fs.existsSync(process.env.FIXTURE_SHUTDOWN)){
    clearInterval(timer);process.emit('SIGTERM');fs.writeFileSync(process.env.FIXTURE_SHUTDOWN_ACK,'handled');
  }
},20);timer.unref();`);
try {
  await build({entryPoints:['server.ts'],outfile:path.join(root,'server.cjs'),bundle:true,platform:'node',format:'cjs',packages:'external',logLevel:'silent',plugins:[{
    name:'batch-provider-barrier',setup(plugin) {
      plugin.onLoad({filter:/job_manager\.ts$/},args => {
        let source=fs.readFileSync(args.path,'utf8');
        if (process.argv.includes('--replay-completed-mutant')) {
          const original="return status === 'pending' || status === 'processing';";
          assert.ok(source.includes(original),'mutant must target the real resume selection');
          source = source.replace(original, 'return true;');
        }
        if (process.argv.includes('--no-yield-mutant')) {
          const original = 'await yieldToEventLoop();';
          assert.ok(source.includes(original), 'mutant must target the real worker yield');
          source = source.replace(original, '');
        }
        if (process.argv.includes('--parallel-retained-mutant')) {
          const original = 'const workerLimit = permittedIds.every(id => job.company_states[id]?.reuse_only) ? 1 : 5;';
          assert.ok(source.includes(original), 'mutant must target retained worker scheduling');
          source = source.replace(original, 'const workerLimit = 5;');
        }
        const projection = 'export async function persistV1ContactOverlay(companyId: string, runId: string, overlay: unknown, durable = false) {';
        assert.ok(source.includes(projection), 'retained fixture must instrument the actual persistence boundary');
        source = source.replace(projection, projection + `
          if (process.env.FIXTURE_SCENARIO === 'retained-cpu' && require('node:fs').existsSync(process.env.FIXTURE_CPU_READY)) {
            require('node:fs').appendFileSync(process.env.FIXTURE_CALLS, JSON.stringify({company_name:companyId}) + String.fromCharCode(10));
            Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
          }
        `);
        return {contents:source,loader:'ts',resolveDir:path.dirname(args.path)};
      });
      plugin.onResolve({filter:/^(?:\.\/server\/|\.\/)(v1_engine)$/},args => {
        if ([path.join(repo,'server.ts'),path.join(repo,'server/job_manager.ts')].includes(path.resolve(args.importer))) return {path:'engine',namespace:'fixture'};
      });
      plugin.onLoad({filter:/.*/,namespace:'fixture'},()=>({loader:'ts',resolveDir:repo,contents:`
        export * from ${JSON.stringify(engine)};
        import {persistV1Run} from ${JSON.stringify(engine)};
        import fs from 'node:fs'; import crypto from 'node:crypto';
        let ordinal=0;
        export async function runV1Enrichment(company_name,country) {
          const position=++ordinal;
          fs.appendFileSync(process.env.FIXTURE_CALLS,JSON.stringify({company_name,position})+'\\n');
          const cpuScenario = process.env.FIXTURE_SCENARIO === 'cpu';
          if (cpuScenario) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
          const held=!cpuScenario && (process.env.FIXTURE_SCENARIO!=='crash' || position>5);
          const end=Date.now()+25000;
          while(held&&!fs.existsSync(process.env.FIXTURE_RELEASE)) {
            if(Date.now()>end) throw new Error('Synthetic provider barrier expired');
            await new Promise(resolve=>setTimeout(resolve,20));
          }
          const run={id:'run-fixture-'+crypto.randomUUID(),company_name,country,status:'PARTIAL',started_at:new Date().toISOString(),completed_at:new Date().toISOString(),queries:[],timeline:[],raw_records:[],results:[],limits:{},identity_resolution:{official_domain:null,confidence:'low',candidates:[]}};
          persistV1Run(run); return run;
        }
      `}));
    }
  }]});
  const SQL=await initSqlJs();
  const scenarios = process.argv.includes('--retained-responsiveness-only') ? ['retained-cpu']
    : process.argv.includes('--responsiveness-only') ? ['cpu'] : ['stop','graceful','crash','cpu','retained-cpu'];
  for(const scenario of scenarios) {
    const state=path.join(root,scenario);fs.mkdirSync(state);fs.writeFileSync(path.join(state,'data.json'),'[]');
    const port=await unusedTestPort();const base=`http://127.0.0.1:${port}`;
    const env=Object.fromEntries(['SystemRoot','WINDIR','PATH','TEMP','TMP','USERPROFILE','APPDATA','LOCALAPPDATA'].filter(key=>process.env[key]).map(key=>[key,process.env[key]]));
    Object.assign(env,{PORT:String(port),NODE_ENV:'test',EDGEVIEW_TEST_MODE:'1',EDGEVIEW_TEST_DB_DIR:state,EDGEVIEW_JSON_DB:path.join(state,'data.json'),EDGEVIEW_SQLITE_DB:path.join(state,'operations.db'),EDGEVIEW_CONFIG:path.join(state,'config.json'),EDGEVIEW_V1_DATA_DIR:path.join(state,'runs'),EDGEVIEW_MONITORING_ENABLED:'0',SERPER_API_KEY:'fixture_not_real',FIXTURE_SHUTDOWN:path.join(state,'shutdown'),FIXTURE_SHUTDOWN_ACK:path.join(state,'shutdown-ack'),FIXTURE_SCENARIO:scenario,FIXTURE_CALLS:path.join(state,'calls.jsonl'),FIXTURE_RELEASE:path.join(state,'release')});
    Object.assign(env, { FIXTURE_CPU_READY: path.join(state, 'cpu-ready'), FIXTURE_TICKS: path.join(state, 'maximum-work-per-tick') });
    let child,output='';
    async function launch() {
      output='';let healthObservation='unobserved';child=spawn(process.execPath,['-r',noEgress,path.join(root,'server.cjs')],{cwd:repo,env,stdio:['ignore','pipe','pipe']});children.add(child);
      const collect=chunk=>{output=(output+chunk.toString()).slice(-2500)};child.stdout.on('data',collect);child.stderr.on('data',collect);
      await until(async()=>{assert.equal(child.exitCode,null,`owned child exited: ${output}`);try { const res=await fetch(base+'/api/health',{signal:AbortSignal.timeout(2000)});healthObservation='HTTP '+res.status;const data=await res.json();assert.equal(data.app.pid,child.pid,'refuse another listener');return res.ok;}catch(error){if(error.code==='ERR_ASSERTION')throw error;healthObservation=String(error.cause?.code||error.name);return false;}},()=>`owned server readiness: ${scenario}; last ${healthObservation}; bounded fixture output: ${output}`);
    }
    async function terminate(signal='SIGTERM') { child.kill(signal);await until(()=>child.exitCode!==null||child.signalCode!==null,'owned child termination');children.delete(child); }
    const calls=()=>fs.existsSync(env.FIXTURE_CALLS)?fs.readFileSync(env.FIXTURE_CALLS,'utf8').trim().split('\n').filter(Boolean).map(line=>JSON.parse(line)):[];
    const post=async(url,data={})=>{const response=await fetch(base+url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});assert.equal(response.status,200,`${url} status`);return response.json();};
    await launch();
    const companyCount = scenario.endsWith('cpu') ? 64 : 8;
    const form=new FormData();form.append('file',new Blob(['Date,Importer,Country,Exporter,Item,TOT_FC\n'+Array.from({length:companyCount},(_,i)=>`2026-01-01,Queueanchor ${i+1},Kenya,Synthetic Supplier,Synthetic Product,10`).join('\n')]),'synthetic.csv');
    assert.equal((await fetch(base+'/api/files/upload',{method:'POST',body:form})).status,201);
    const contacts=await fetch(base+'/api/companies').then(response=>response.json());const ids=contacts.filter(contact=>contact.company_name.startsWith('Queueanchor ')).map(contact=>contact.id);assert.equal(ids.length,companyCount);
    if (scenario === 'retained-cpu') {
      await terminate();
      fs.mkdirSync(env.EDGEVIEW_V1_DATA_DIR, { recursive: true });
      const database = new SQL.Database(fs.readFileSync(env.EDGEVIEW_SQLITE_DB));
      const headers = [];
      try {
        for (const [index, id] of ids.entries()) {
          const contact = contacts.find(item => item.id === id);
          const run = { id: `run-retained-cpu-${index}`, company_name: contact.company_name, country: contact.country,
            status: 'PARTIAL', started_at: '2026-01-01T00:00:00.000Z', queries: [], results: [], raw_records: [], timeline: [], limits: {},
            identity_resolution: { official_domain: null, confidence: 'low', candidates: [] } };
          fs.writeFileSync(path.join(env.EDGEVIEW_V1_DATA_DIR, run.id + '.json'), JSON.stringify(run));
          headers.push({ id: run.id, company_name: run.company_name, country: run.country, status: run.status, started_at: run.started_at, query_count: 0 });
          database.run('INSERT INTO v1_contact_enrichment (company_id,run_id,overlay_json,updated_at) VALUES (?,?,?,?)',
            [id, run.id, JSON.stringify({ schema_version: 28, entity_key: 'old-synthetic-policy', emails_list: [] }), run.started_at]);
        }
        fs.writeFileSync(env.EDGEVIEW_SQLITE_DB, database.export());
        fs.writeFileSync(path.join(env.EDGEVIEW_V1_DATA_DIR, 'identity-index.jsonl'), headers.map(item => JSON.stringify(item)).join('\n') + '\n');
      } finally { database.close(); }
      await launch();
    }
    const {jobId}=await post('/api/enrich/jobs',{company_ids:ids,mode:'importer', ...(scenario === 'retained-cpu' ? { reuseOnly: true } : {})});
    const readJob=async()=>{const response=await fetch(base+`/api/enrich/job/${jobId}`);assert.equal(response.status,200);return (await response.json()).job;};
    if (scenario.endsWith('cpu')) {
      // Bounded synthetic synchronous work exposes starvation without a timing
      // assertion. Health must be served while some selected work remains.
      fs.writeFileSync(env.FIXTURE_CPU_READY, 'ready');
      const starting = post(`/api/enrich/job/${jobId}/start`);
      void starting.catch(() => {});
      await until(() => calls().length > 0, 'CPU fixture must begin actual worker dispatch');
      const health = await fetch(base + '/api/health', { signal: AbortSignal.timeout(15000) }).catch(error => {
        throw new Error(`CPU responsiveness health request failed: ${error.name}`);
      });
      assert.equal((await health.json()).app.pid, child.pid);
      assert.ok(calls().length < companyCount, 'batch must serve health before exhausting synchronous work');
      await starting;
      let snapshot;
      // The 15s health budget and before-completion assertion above are the
      // responsiveness gate. This deliberately blocking workload has a separate
      // bounded completion budget, including its real durable file writes.
      await until(async () => {
        snapshot = await readJob();
        assert.notEqual(snapshot.status, 'FAILED');
        return snapshot.status === 'COMPLETED';
      }, () => `CPU batch completion: ${snapshot?.status}, ${snapshot?.completed_companies}/${companyCount}`, 120000);
      assert.equal((await readJob()).completed_companies, companyCount);
      assert.equal(calls().length, companyCount, 'yielding must not skip or duplicate work');
      if (scenario === 'retained-cpu') {
        await until(() => fs.existsSync(env.FIXTURE_TICKS), 'retained CPU timer observation');
        assert.equal(Number(fs.readFileSync(env.FIXTURE_TICKS, 'utf8')), 1, 'retained projection must service control ticks between individual companies');
      }
      await terminate();
      continue;
    }
    await post(`/api/enrich/job/${jobId}/start`);
    await until(()=>calls().length===(scenario==='crash'?8:5),'expected bounded initial provider calls');
    if(scenario!=='crash') {
      if(scenario==='stop') await post(`/api/enrich/job/${jobId}/stop`);
      else {
        // Invoke the real registered shutdown handler inside the owned process.
        // Windows child.kill(SIGTERM) is forcible, so it cannot prove a clean drain.
        fs.writeFileSync(env.FIXTURE_SHUTDOWN,'shutdown');
        await until(()=>fs.existsSync(env.FIXTURE_SHUTDOWN_ACK),'shutdown handler begins draining');
      }
      fs.writeFileSync(env.FIXTURE_RELEASE,'release');
      if(scenario==='graceful') {
        await until(()=>child.exitCode!==null||child.signalCode!==null,'graceful child termination');
        assert.equal(child.exitCode,0,'real shutdown controller must report successful drain/flush');children.delete(child);
        fs.unlinkSync(env.FIXTURE_SHUTDOWN);fs.unlinkSync(env.FIXTURE_SHUTDOWN_ACK);await launch();
      }
      await until(async()=>{const job=await readJob();return job.status==='STOPPED'&&job.completed_companies===5;},'stopped checkpoint after five in-flight companies');
      const stopped=await readJob();assert.equal(Object.values(stopped.company_states).filter(item=>item.status==='pending').length,3,'unstarted companies remain queued');
      assert.equal(calls().length,5,'stop must not dispatch queued companies');
      if(scenario==='stop') {await terminate();await launch();} const recovered=await readJob();assert.equal(recovered.status,'STOPPED');assert.equal(recovered.completed_companies,5);
    } else {
      // Observe the actual durable database image, not only the in-memory API.
      await until(()=>{let database;try {database=new SQL.Database(fs.readFileSync(env.EDGEVIEW_SQLITE_DB));const rows=database.exec('SELECT completed_companies FROM research_jobs');return rows[0]?.values[0]?.[0]===5;}catch{return false;}finally{database?.close();}},'five-company checkpoint must reach disk before forced interruption');
      await terminate('SIGKILL');fs.writeFileSync(env.FIXTURE_RELEASE,'release');await launch();
      const recovered=await readJob();assert.equal(recovered.status,'PAUSED','interrupted active job becomes visibly paused');assert.equal(recovered.completed_companies,5);assert.equal(Object.values(recovered.company_states).filter(item=>item.status==='pending').length,3,'only incomplete companies reset to pending');
    }
    await post(`/api/enrich/job/${jobId}/start`);
    await until(async()=>{const job=await readJob();assert.ok(job.completed_companies<=8,'count must never exceed selection');return job.status==='COMPLETED'&&job.completed_companies===8;},'resume completes remaining companies');
    const recorded=calls();const firstFive=new Set(recorded.slice(0,5).map(item=>item.company_name));
    for(const name of firstFive) assert.equal(recorded.filter(item=>item.company_name===name).length,1,'durably completed company must not call the provider again');
    assert.equal(recorded.length,scenario==='crash'?11:8,'only interrupted in-flight work may be retried');
    const completed=await readJob();assert.equal(Object.values(completed.company_states).filter(item=>item.status==='completed').length,8);
    await terminate();await launch();const final=await readJob();assert.equal(final.status,'COMPLETED');assert.equal(final.completed_companies,8);assert.equal(calls().length,recorded.length,'startup does not silently start provider work');await terminate();
  }
  console.log('PASS batch scenarios: ' + scenarios.join(', ') + '; responsive controls and exact terminal dispatch');
} finally {
  for(const child of children)child.kill();await Promise.all([...children].map(child=>until(()=>child.exitCode!==null||child.signalCode!==null,'cleanup child')));
  if(path.dirname(root)!==path.resolve(repo,'.test-cache'))throw new Error('Unsafe fixture cleanup boundary');fs.rmSync(root,{recursive:true,force:true});
}
