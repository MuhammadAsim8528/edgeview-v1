import assert from 'node:assert/strict';
import http from 'node:http';
let responseStatus=403;
const server=http.createServer((req,res)=>{req.resume();res.statusCode=responseStatus;res.end('{}');});
await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
const address=server.address();assert.ok(address&&typeof address==='object');
process.env.EDGEVIEW_MONITORING_ENABLED='1';process.env.EDGEVIEW_MONITORING_ALLOW_INSECURE_LOCAL='1';
process.env.EDGEVIEW_SENTRY_DSN=`http://public@127.0.0.1:${address.port}/1`;
process.env.EDGEVIEW_POSTHOG_KEY='phc_synthetic_rejection';process.env.EDGEVIEW_POSTHOG_HOST=`http://127.0.0.1:${address.port}`;
try {
 const {initMonitoring,captureMonitoringEvent,getMonitoringStatus}=await import('../monitoring');
 initMonitoring({version:'1.0.0-rc.2',build_id:'a'.repeat(64),channel:'beta',installation_id:'00000000-0000-4000-8000-000000000001'});
 const result=await captureMonitoringEvent('doctor_run',{stage:'diagnostics',outcome:'success'},true);
 assert.equal(result.sentry,false,'Sentry HTTP rejection must not be reported as delivery success');
 assert.equal(result.posthog,false,'PostHog HTTP rejection must not be reported as delivery success');
 const status=getMonitoringStatus();assert.equal(status.sentry.state,'ERROR');assert.equal(status.posthog.state,'ERROR');
 responseStatus=200;
 const recovered=await captureMonitoringEvent('doctor_run',{stage:'diagnostics',outcome:'success'},true);
 assert.equal(recovered.sentry,true,'Sentry recovers after endpoint repair');assert.equal(recovered.posthog,true,'PostHog recovers after endpoint repair');
 server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));
 const started=Date.now();const offline=await captureMonitoringEvent('doctor_run',{stage:'diagnostics',outcome:'success'},true);
 assert.equal(offline.sentry,false);assert.equal(offline.posthog,false);
 assert.ok(Date.now()-started<12000,'offline monitoring must have a bounded completion time');
 console.log('PASS rejected/offline ingestion reports failure, recovers after repair and completes within a bounded time.');
} finally {server.closeAllConnections();server.close();}
