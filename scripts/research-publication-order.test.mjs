import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { build } from 'esbuild';
import { unusedTestPort } from './test-server-port.mjs';

// Test-only transport/persistence seams; the real Express route, projection,
// dataset import, immutable store and SQLite implementation remain in use.
// No production test hook and no provider/customer credentials are loaded.
const repo = process.cwd();
const root = fs.mkdtempSync(path.join(repo, '.test-cache', 'research-ordering-'));
const noEgress = path.join(root, 'deny-egress.cjs');
// Keep this fixture self-contained: Docker QA intentionally does not copy the
// separate browser-test tree. Missing that tree must never enable networking.
fs.writeFileSync(noEgress, `
  const deny = () => { throw new Error('DURABILITY_TEST_OUTBOUND_DISABLED'); };
  for (const name of ['node:http', 'node:https']) {
    const transport = require(name); transport.request = deny; transport.get = deny;
  }
  globalThis.fetch = deny;
`);
const engine = path.join(repo, 'server/v1_engine.ts');
const jobs = path.join(repo, 'server/job_manager.ts');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const children = new Set();
async function until(check, message) {
  const end = Date.now() + 30_000;
  while (Date.now() < end) { if (await check()) return; await sleep(50); }
  throw new Error(message);
}
try {
  await build({
    stdin: { resolveDir: repo, loader: 'ts', contents: `
      import './server.ts';
      import {withCompanyIdentityChange} from './server/company_identity_work';
      let release;
      process.on('message', action => {
        if (action === 'release') { release(); return; }
        void withCompanyIdentityChange(() => new Promise(resolve => {
          release = resolve;
          process.send('exclusive');
        })).then(() => process.send('released'), error => process.send(error.code));
      });
    ` }, outfile: path.join(root, 'server.cjs'), bundle: true,
    platform: 'node', format: 'cjs', packages: 'external', logLevel: 'silent',
    plugins: [{ name: 'isolated-enrichment-seams', setup(plugin) {
      plugin.onResolve({ filter: /^(?:\.\/server\/|\.\/)(v1_engine|job_manager)$/ }, args => {
        if ([path.join(repo, 'server.ts'), jobs].includes(path.resolve(args.importer))) return { path: args.path.endsWith('job_manager') ? 'job_manager' : 'v1_engine', namespace: 'fixture' };
      });
      plugin.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({
        loader: 'ts', resolveDir: repo,
        contents: args.path.endsWith('job_manager') ? `
          export * from ${JSON.stringify(jobs)};
          import {withContactPublication as realPublication, persistV1ContactOverlay as realPersist} from ${JSON.stringify(jobs)};
          import fs from 'node:fs';
          export const withContactPublication = (id, operation) => process.env.FIXTURE_UNSERIALIZED === '1' ? operation() : realPublication(id, operation);
          let saves = 0;
          export async function persistV1ContactOverlay(...args) {
            if (++saves > 1) return realPersist(...args);
            fs.writeFileSync(process.env.FIXTURE_READY, 'ready');
            const end = Date.now() + 15000;
            while (!fs.existsSync(process.env.FIXTURE_RELEASE)) {
              if (Date.now() > end) throw new Error('fixture release timeout');
              await new Promise(resolve => setTimeout(resolve, 20));
            }
            if (process.env.FIXTURE_FAIL === '1') throw Object.assign(new Error('Synthetic storage refusal'), {code:'PERSISTENCE_WRITE_FAILED'});
            return realPersist(...args);
          }
        ` : `
          export * from ${JSON.stringify(engine)};
          import {persistV1Run} from ${JSON.stringify(engine)};
          import fs from 'node:fs';
          let calls = 0;
          export async function runV1Enrichment(company_name, country) {
            const index = ++calls;
            const run = {id:'run-synthetic-http-'+index,company_name,country,status:'COMPLETED',
              started_at:new Date().toISOString(),completed_at:new Date().toISOString(),
              queries:[],timeline:[],raw_records:[],limits:{},
              identity_resolution:{official_domain:'scopeanchor.test',confidence:'high',candidates:[]},
              results:[{id:'local-contact',run_id:'run-synthetic-http-'+index,raw_record_id:'fixture',query:'',
                provider:'direct-http',rank:1,title:'Scopeanchor Medical Kenya',url:'https://scopeanchor.test/kenya',
                snippet:'',text:'Kenya office\\ncontact'+index+'@scopeanchor.test',links:[],metadata:{},search_latency_ms:0,status:'success'}]};
            persistV1Run(run); if (index === 2) fs.writeFileSync(process.env.FIXTURE_SECOND, 'captured'); return run;
          }
        `,
      }));
    }}],
  });
  for (const secondKind of ['interactive', 'batch', 'batch-stop']) {
    const fail = false;
    const state = path.join(root, secondKind);
    fs.mkdirSync(state);
    fs.writeFileSync(path.join(state, 'data.json'), '[]');
    const port = await unusedTestPort();
    const base = `http://127.0.0.1:${port}`;
    const env = Object.fromEntries(['SystemRoot','WINDIR','PATH','TEMP','TMP','USERPROFILE','APPDATA','LOCALAPPDATA'].filter(key => process.env[key]).map(key => [key,process.env[key]]));
    Object.assign(env, {
      PORT:String(port), NODE_ENV:'test', EDGEVIEW_TEST_MODE:'1', EDGEVIEW_TEST_DB_DIR:state,
      EDGEVIEW_JSON_DB:path.join(state,'data.json'), EDGEVIEW_SQLITE_DB:path.join(state,'operations.db'),
      EDGEVIEW_CONFIG:path.join(state,'config.json'), EDGEVIEW_V1_DATA_DIR:path.join(state,'runs'),
      EDGEVIEW_MONITORING_ENABLED:'0', SERPER_API_KEY:'fixture_not_real',
      FIXTURE_UNSERIALIZED:process.argv.includes('--unserialized-mutant')?'1':'0', FIXTURE_SECOND:path.join(state,'second-ready'), FIXTURE_READY:path.join(state,'ready'), FIXTURE_RELEASE:path.join(state,'release'), FIXTURE_FAIL:fail?'1':'0',
    });
    const child = spawn(process.execPath, ['-r',noEgress,path.join(root,'server.cjs')], {cwd:repo,env,stdio:['ignore','pipe','pipe','ipc']});
    children.add(child);
    let output = '';
    const collect = chunk => { output = (output + chunk.toString()).slice(-3000); };
    child.stdout.on('data',collect); child.stderr.on('data',collect);
    await until(async () => {
      assert.equal(child.exitCode,null,`owned server exited: ${output}`);
      try { const response = await fetch(`${base}/api/health`); const health=await response.json();
        assert.equal(health.app?.pid,child.pid,'Refuse to mutate a different server'); return response.ok;
      } catch (error) { if (error.code === 'ERR_ASSERTION') throw error; return false; }
    }, 'owned server readiness timeout');
    const exchange = action => new Promise((resolve, reject) => {
      const timer = setTimeout(() => { child.off('message', receive); reject(new Error('identity fixture IPC timeout')); }, 5000);
      function receive(message) { clearTimeout(timer); resolve(message); }
      child.once('message', receive);
      child.send(action);
    });
    const form = new FormData();
    form.append('file',new Blob(['Date,Importer,Country,Exporter,Item,TOT_FC\n2026-01-01,Scopeanchor Medical,Kenya,Synthetic Supplier,Synthetic Product,10\n'],{type:'text/csv'}),'synthetic.csv');
    assert.equal(await exchange('acquire'),'exclusive');
    for (const [route, method, body] of [
      ['/api/files/upload','POST',form], ['/api/files/unused','DELETE'],
      ['/api/files/unused/save-to-history','POST'], ['/api/stats/save-to-history','POST'],
      ['/api/sample-data/seed','POST'], ['/api/enrich/company','POST'],
      ['/api/enrich/batch','POST'], ['/api/enrich/jobs','POST'], ['/api/enrich/job/unused/start','POST'],
    ]) {
      const response = await fetch(base + route, {method, body});
      assert.equal(response.status,409,route);
      assert.equal((await response.json()).code,'COMPANY_IDENTITY_BUSY',route);
    }
    assert.equal((await fetch(base + '/api/health')).status,200);
    assert.equal(await exchange('release'),'released');
    assert.equal((await fetch(`${base}/api/files/upload`,{method:'POST',body:form})).status,201);
    const companies = () => fetch(`${base}/api/companies`).then(response => response.json());
    const before = (await companies()).find(company => company.company_name === 'Scopeanchor Medical');
    assert.ok(before,'synthetic uploaded company exists');
    const abort = new AbortController();
    const pending = fetch(`${base}/api/enrich/company`,{method:'POST',signal:abort.signal,headers:{'Content-Type':'application/json'},body:JSON.stringify({id:before.id,company_name:before.company_name,country:'Kenya'})});
    void pending.catch(() => {}); // Cleanup may terminate a request after a failed assertion.
    await until(() => fs.existsSync(env.FIXTURE_READY), 'route did not reach persistence barrier');
    if (secondKind === 'interactive') {
      abort.abort();
      await assert.rejects(pending,{name:'AbortError'});
    }
    assert.equal(await exchange('acquire'),'COMPANY_IDENTITY_BUSY');
    let batchJobId;
    const second = secondKind === 'interactive'
      ? fetch(`${base}/api/enrich/company`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:before.id,company_name:before.company_name,country:'Kenya',forceFetch:true})})
      : (async () => {
          const created = await fetch(`${base}/api/enrich/jobs`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({company_ids:[before.id],mode:'importer'})});
          assert.equal(created.status,200);
          const {jobId} = await created.json(); batchJobId = jobId;
          const started = await fetch(`${base}/api/enrich/job/${jobId}/start`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({forceFetch:true})});
          assert.equal(started.status,200);
          await until(async () => {
            const response = await fetch(`${base}/api/enrich/job/${jobId}`); const body = await response.json();
            assert.notEqual(body.job.status,'FAILED','batch must not hide an exception');
            return body.job.status === (secondKind === 'batch-stop' ? 'STOPPED' : 'COMPLETED') && body.job.completed_companies === 1;
          },'batch completion timeout');
          return started;
        })();
    void second.catch(() => {});
    await until(() => fs.existsSync(env.FIXTURE_SECOND), 'second research must capture evidence while the first publication is held');
    if (secondKind === 'batch-stop') {
      const stopped = await fetch(`${base}/api/enrich/job/${batchJobId}/stop`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
      assert.equal(stopped.status,200);
      assert.equal(await exchange('acquire'),'COMPANY_IDENTITY_BUSY');
      const restartedEarly = await fetch(`${base}/api/enrich/job/${batchJobId}/start`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
      assert.equal(restartedEarly.status,409,'stop must not release worker ownership until the in-flight publication drains');
      assert.equal((await restartedEarly.json()).code,'JOB_DRAINING','refusal must explain the draining state');
    }
    // Old code lets the second response finish here; serialized publication waits
    // for the first save. Release after completion or a bounded observation.
    await Promise.race([second, sleep(300)]);
    fs.writeFileSync(env.FIXTURE_RELEASE,'release');
    if (secondKind !== 'interactive') assert.equal((await pending).status,200);
    assert.equal((await second).status,200);
    if (secondKind === 'batch-stop') {
      await until(async () => {
        const resumed = await fetch(`${base}/api/enrich/job/${batchJobId}/start`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
        assert.ok([200,409].includes(resumed.status));
        return resumed.status === 200;
      },'drained stopped job must become resumable');
      await until(async () => {
        const body = await fetch(`${base}/api/enrich/job/${batchJobId}`).then(response => response.json());
        assert.equal(body.job.completed_companies,1,'resume must not count completed work twice');
        return body.job.status === 'COMPLETED';
      },'drained resume completion timeout');
    }
    await until(async () => {
      const status = await exchange('acquire');
      if (status === 'COMPANY_IDENTITY_BUSY') return false;
      assert.equal(status,'exclusive');
      assert.equal(await exchange('release'),'released');
      return true;
    }, 'identity lease did not clear after publication');
    const after = (await companies()).find(company => company.id === before.id);
    assert.ok(JSON.stringify(after).includes('contact2@scopeanchor.test'),'late first publication must not erase newer completed evidence');
    assert.ok(JSON.stringify(after).includes('contact1@scopeanchor.test'),'both immutable captures remain projected');
    child.kill();
    await until(() => child.exitCode !== null || child.signalCode !== null,'owned child termination timeout');
    children.delete(child);
    if (!fail) {
      const restarted = spawn(process.execPath, ['-r',noEgress,path.join(root,'server.cjs')], {cwd:repo,env,stdio:['ignore','pipe','pipe']});
      children.add(restarted);
      restarted.stdout.on('data',collect); restarted.stderr.on('data',collect);
      await until(async () => {
        assert.equal(restarted.exitCode,null,`restart exited: ${output}`);
        try {
          const health = await fetch(`${base}/api/health`).then(response => response.json());
          assert.equal(health.app?.pid,restarted.pid,'restart must belong to owned process');
          return true;
        } catch (error) { if (error.code === 'ERR_ASSERTION') throw error; return false; }
      },'restart readiness timeout');
      const recovered = (await companies()).find(company => company.id === before.id);
      assert.ok(recovered.edgeview_v1_run_id,'saved overlay survives process restart');
      assert.ok(JSON.stringify(recovered).includes('contact2@scopeanchor.test'),'newer contact survives restart');
      restarted.kill();
      await until(() => restarted.exitCode !== null || restarted.signalCode !== null,'restart cleanup timeout');
      children.delete(restarted);
    }
  }
  console.log('PASS overlap preserves completed evidence/restart; stopped background worker refuses restart until publication drains');
} finally {
  for (const child of children) child.kill();
  await Promise.all([...children].map(child => until(() => child.exitCode !== null || child.signalCode !== null,'child cleanup timeout')));
  const boundary = path.resolve(repo,'.test-cache') + path.sep;
  if (!path.resolve(root).startsWith(boundary)) throw new Error('Refuse unsafe test cleanup');
  fs.rmSync(root,{recursive:true,force:true});
}
