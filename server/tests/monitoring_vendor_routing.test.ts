import assert from 'node:assert/strict';
import http from 'node:http';
import { gunzipSync } from 'node:zlib';
const requests: Array<{url:string;body:Buffer;gzip:boolean}> = [];
const server=http.createServer((req,res)=>{const chunks:Buffer[]=[];req.on('data',chunk=>chunks.push(Buffer.from(chunk)));req.on('end',()=>{requests.push({url:req.url||'',body:Buffer.concat(chunks),gzip:req.headers['content-encoding']==='gzip'});res.end('{}');});});
await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
const address=server.address();assert.ok(address&&typeof address==='object');
Object.assign(process.env,{EDGEVIEW_MONITORING_ENABLED:'1',EDGEVIEW_MONITORING_ALLOW_INSECURE_LOCAL:'1',EDGEVIEW_SENTRY_DSN:`http://public@127.0.0.1:${address.port}/1`,EDGEVIEW_POSTHOG_KEY:'phc_synthetic_route',EDGEVIEW_POSTHOG_HOST:`http://127.0.0.1:${address.port}`});
try {
 const {initMonitoring,captureMonitoringEvent,shutdownMonitoring}=await import('../monitoring');
 const identity={version:'1.0.0-rc.2',build_id:'b'.repeat(64),channel:'beta' as const,installation_id:'00000000-0000-4000-8000-000000000003'};
 initMonitoring(identity);
 const started=await captureMonitoringEvent('app_started',{stage:'startup',outcome:'success'},true);
 assert.equal(started.sentry,false,'ordinary product analytics must not create Sentry issues');
 assert.equal(started.posthog,true);
 const sample=await captureMonitoringEvent('resource_sample',{rss_bytes:123450000,cpu_percent:8},true);
 assert.equal(sample.sentry,false,'resource heartbeat is context, not a standalone issue');assert.equal(sample.posthog,false);
 const failed=await captureMonitoringEvent('runtime_error',{stage:'run',outcome:'failed',error_code:'PROVIDER_TIMEOUT'},true);
 assert.equal(failed.sentry,true);assert.equal(failed.posthog,false,'PostHog must not duplicate Sentry error tracking');
 const diagnostic=await captureMonitoringEvent('doctor_run',{stage:'diagnostics',outcome:'success'},true);
 assert.equal(diagnostic.sentry,true);assert.equal(diagnostic.posthog,true,'explicit diagnostic test exercises both transports');
 const originalNow=Object.getOwnPropertyDescriptor(performance,'now');
 const later=performance.now()+360001;
 try {
   Object.defineProperty(performance,'now',{configurable:true,value:()=>later});
   await captureMonitoringEvent('runtime_error',{stage:'run',outcome:'failed',error_code:'UNEXPECTED_ERROR'},true);
 } finally {if(originalNow)Object.defineProperty(performance,'now',originalNow);else delete (performance as any).now;}
 await shutdownMonitoring();
 const sentry=requests.filter(r=>r.url.includes('/envelope')).flatMap(r=>(r.gzip?gunzipSync(r.body):r.body).toString('utf8').split('\n').flatMap(line=>{try{return [JSON.parse(line)];}catch{return [];}})).filter(item=>item.tags?.event);
 assert.deepEqual(sentry.map(item=>item.tags.event).sort(),['doctor_run','runtime_error','runtime_error']);
 for(const event of sentry){assert.equal(event.release,`edgeview@${identity.version}+${identity.build_id}`);assert.equal(event.environment,'beta');}
 assert.equal(sentry.find(item=>item.tags.event==='runtime_error').extra.rss_bytes,123450000,'latest bounded resource sample accompanies a real error');
 const expired=sentry.find(item=>item.tags.error_code==='UNEXPECTED_ERROR');
 assert.equal(expired.extra.rss_bytes,undefined,'expired resource samples are not presented as current');
 assert.equal(expired.extra.resource_sample_age_ms,undefined);
 const analytics=requests.filter(r=>!r.url.includes('/envelope')).map(r=>(r.gzip?gunzipSync(r.body):r.body).toString('utf8')).join('\n');
 assert.ok(analytics.includes('app_started'));assert.ok(!analytics.includes('runtime_error'));assert.ok(!analytics.includes('resource_sample'));
 console.log('PASS actual vendor routing, full build/release identity and bounded resource context without heartbeat issues');
} finally {server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));}
