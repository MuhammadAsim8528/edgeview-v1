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
const root = fs.mkdtempSync(path.join(repo, '.test-cache', 'interactive-durability-'));
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
    entryPoints: ['server.ts'], outfile: path.join(root, 'server.cjs'), bundle: true,
    platform: 'node', format: 'cjs', packages: 'external', logLevel: 'silent',
    plugins: [{ name: 'isolated-enrichment-seams', setup(plugin) {
      plugin.onResolve({ filter: /^\.\/server\/(v1_engine|job_manager)$/ }, args => {
        if (path.resolve(args.importer) === path.join(repo, 'server.ts')) return { path: args.path, namespace: 'fixture' };
      });
      plugin.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({
        loader: 'ts', resolveDir: repo,
        contents: args.path.endsWith('job_manager') ? `
          export * from ${JSON.stringify(jobs)};
          import {persistV1ContactOverlay as realPersist} from ${JSON.stringify(jobs)};
          import fs from 'node:fs';
          export async function persistV1ContactOverlay(...args) {
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
          export async function runV1Enrichment(company_name, country) {
            const run = {id:'run-synthetic-http',company_name,country,status:'COMPLETED',
              started_at:new Date().toISOString(),completed_at:new Date().toISOString(),
              queries:[],timeline:[],raw_records:[],limits:{},
              identity_resolution:{official_domain:'scopeanchor.test',confidence:'high',candidates:[]},
              results:[{id:'local-contact',run_id:'run-synthetic-http',raw_record_id:'fixture',query:'',
                provider:'direct-http',rank:1,title:'Scopeanchor Medical Kenya',url:'https://scopeanchor.test/kenya',
                snippet:'',text:'Kenya office\\nkenya@scopeanchor.test',links:[],metadata:{},search_latency_ms:0,status:'success'}]};
            persistV1Run(run); return run;
          }
        `,
      }));
    }}],
  });
  for (const fail of [true, false]) {
    const state = path.join(root, fail ? 'failure' : 'success');
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
      FIXTURE_READY:path.join(state,'ready'), FIXTURE_RELEASE:path.join(state,'release'), FIXTURE_FAIL:fail?'1':'0',
    });
    const child = spawn(process.execPath, ['-r',noEgress,path.join(root,'server.cjs')], {cwd:repo,env,stdio:['ignore','pipe','pipe']});
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
    const form = new FormData();
    form.append('file',new Blob(['Date,Importer,Country,Exporter,Item,TOT_FC\n2026-01-01,Scopeanchor Medical,Kenya,Synthetic Supplier,Synthetic Product,10\n'],{type:'text/csv'}),'synthetic.csv');
    assert.equal((await fetch(`${base}/api/files/upload`,{method:'POST',body:form})).status,201);
    const companies = () => fetch(`${base}/api/companies`).then(response => response.json());
    const before = (await companies()).find(company => company.company_name === 'Scopeanchor Medical');
    assert.ok(before,'synthetic uploaded company exists');
    const pending = fetch(`${base}/api/enrich/company`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:before.id,company_name:before.company_name,country:'Kenya'})});
    void pending.catch(() => {}); // Cleanup may terminate a request after a failed assertion.
    await until(() => fs.existsSync(env.FIXTURE_READY), 'route did not reach persistence barrier');
    const during = (await companies()).find(company => company.id === before.id);
    // This assertion fails on the previous route: it exposed the new contact
    // before persistence resolved, even when persistence later rejected.
    assert.deepEqual(during,before,'pending durable save must not publish any contact fields');
    fs.writeFileSync(env.FIXTURE_RELEASE,'release');
    const response = await pending;
    const after = (await companies()).find(company => company.id === before.id);
    if (fail) {
      assert.equal(response.ok,false,'storage refusal must not return success');
      assert.deepEqual(after,before,'storage refusal must retain the previous visible contact');
    } else {
      assert.equal(response.status,200);
      assert.equal(after.edgeview_v1_run_id,'run-synthetic-http');
      assert.ok(JSON.stringify(after).includes('kenya@scopeanchor.test'),'successful durable save publishes projected contact');
    }
    assert.equal((await fetch(`${base}/api/v1/runs/run-synthetic-http`)).status,200,'immutable run remains discoverable');
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
      assert.equal(recovered.edgeview_v1_run_id,'run-synthetic-http','saved overlay survives process restart');
      assert.ok(JSON.stringify(recovered).includes('kenya@scopeanchor.test'),'saved contact survives restart');
      restarted.kill();
      await until(() => restarted.exitCode !== null || restarted.signalCode !== null,'restart cleanup timeout');
      children.delete(restarted);
    }
  }
  console.log('PASS interactive HTTP enrichment: pending/rejected saves unpublished; successful save survives restart; raw run discoverable');
} finally {
  for (const child of children) child.kill();
  await Promise.all([...children].map(child => until(() => child.exitCode !== null || child.signalCode !== null,'child cleanup timeout')));
  const boundary = path.resolve(repo,'.test-cache') + path.sep;
  if (!path.resolve(root).startsWith(boundary)) throw new Error('Refuse unsafe test cleanup');
  fs.rmSync(root,{recursive:true,force:true});
}
