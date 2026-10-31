import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import dns from 'node:dns/promises';
import https from 'node:https';
import http from 'node:http';
import {EventEmitter} from 'node:events';
import {PassThrough} from 'node:stream';

const root=fs.mkdtempSync(path.join(os.tmpdir(),'edgeview-provider-path-'));
process.env.EDGEVIEW_TEST_MODE='1';process.env.EDGEVIEW_TEST_DB_DIR=root;
process.env.EDGEVIEW_CONFIG=path.join(root,'config.json');process.env.EDGEVIEW_V1_DATA_DIR=path.join(root,'runs');
fs.writeFileSync(process.env.EDGEVIEW_CONFIG,JSON.stringify({serper_enabled:true,serper_api_key:'synthetic-search-key',hunter_enabled:true,hunter_api_key:'synthetic-hunter-key',nvidia_enabled:false,groq_enabled:false}));
const original={lookup:dns.lookup,https:https.request,http:http.request,fetch:global.fetch};
let mode='private',nativeCalls=0,engineFixture=false,largeFixture=true;
let refusedProvider='',refusedStatus=429;
const requests:Array<{options:any;body?:Buffer}>=[];
let lookups=0;
dns.lookup=(async()=>{lookups++;return mode==='mixed'?[{address:'93.184.216.34',family:4},{address:'10.0.0.1',family:4}]:[{address:mode==='private'?'127.0.0.1':'93.184.216.34',family:4}];}) as unknown as typeof dns.lookup;
http.request=(()=>{throw Error('Synthetic test forbids plaintext/private network connections');}) as typeof http.request;
global.fetch=(async(input:any)=>{nativeCalls++;return Response.json(String(input).includes('hunter.io')?{data:{emails:[]}}:{organic:[]});}) as typeof fetch;
https.request=((options:any,callback:(incoming:any)=>void)=>{
 const request=new EventEmitter() as any;let incoming:any,destroyed=false;
 const abort=()=>request.destroy(options.signal.reason);
 request.setTimeout=()=>request;
 request.destroy=(error:Error)=>{if(!destroyed){destroyed=true;incoming?.destroy();options.signal.removeEventListener('abort',abort);request.emit('error',error);}return request;};
 request.end=(body?:Buffer)=>{requests.push({options,body});queueMicrotask(()=>{
  if(options.signal.aborted)return abort();
  options.signal.addEventListener('abort',abort,{once:true});
  incoming=new PassThrough();incoming.statusCode=refusedProvider===options.servername?refusedStatus:mode==='redirect'?302:200;
  incoming.headers={'content-type':refusedProvider===options.servername?'application/problem+json':'application/json',...(mode==='redirect'?{location:'http://127.0.0.1/private'}:{})};
  incoming.once('close',()=>options.signal.removeEventListener('abort',abort));
  callback(incoming);
  let payload=options.servername==='api.hunter.io'?JSON.stringify({data:{emails:[]}}):JSON.stringify({organic:[]});
  if(engineFixture){
    if(options.servername==='google.serper.dev'){
      const sent=JSON.parse(body?.toString()||'{}');
      payload=JSON.stringify(options.path==='/resolve'?{...sent,organic:sent.organic.map((item:any)=>({...item,link:item.position===4?'https://scopeanchor.test/kenya':item.link}))}
        :{organic:[{position:1,title:'Scopeanchor Medical Kenya official',snippet:'Scopeanchor Medical Kenya official office',link:'https://scopeanchor.test/'},
          {position:4,title:'Scopeanchor Medical Kenya office',snippet:'Scopeanchor Medical Kenya official office',link:'https://www.google.com/goto?url=synthetic'}],padding:'x'.repeat(largeFixture?3*1024*1024:32)});
    }else if(options.servername==='api.hunter.io')payload=JSON.stringify({data:{domain:'scopeanchor.test',emails:[]}});
    else{incoming.headers['content-type']='text/html';payload='<html><title>Scopeanchor Medical Kenya</title><p>Scopeanchor Medical Kenya office</p></html>';}
  }
  if(mode==='oversize')payload=JSON.stringify({organic:[],padding:'x'.repeat(300*1024)});
  if(mode==='eight'||mode==='over-eight')payload=JSON.stringify({padding:'x'.repeat(8*1024*1024-JSON.stringify({padding:''}).length+(mode==='over-eight'?1:0))});
  if(refusedProvider===options.servername)payload=JSON.stringify({error:'Synthetic account refusal'});
  if(!incoming.destroyed&&mode!=='stall')incoming.end(payload);
 });return request;};return request;
}) as typeof https.request;
try{
 const {testSerperKey,testHunterKey}=await import('../settings');
 for(const dnsMode of ['private','mixed'])for(const test of [testSerperKey,testHunterKey]){
  mode=dnsMode;const result=await test('synthetic-diagnostic-key');
  assert.equal(result.success,false,'actual provider diagnostic must reject every private DNS answer before sending a key');
 }
 assert.equal(requests.length,0);assert.equal(nativeCalls,0,'credentialed calls must not reach generic fetch');assert.ok(lookups>=4);
 mode='public';
 for(const test of [testSerperKey,testHunterKey])assert.equal((await test('synthetic-diagnostic-key')).success,true);
 assert.equal(requests.length,2);
 for(const {options}of requests){assert.equal(options.hostname,'93.184.216.34');assert.ok(['google.serper.dev','api.hunter.io'].includes(options.servername));assert.equal(options.headers.host,options.servername);}
 mode='redirect';
 for(const test of [testSerperKey,testHunterKey]){const result=await test('synthetic-diagnostic-key');assert.equal(result.success,false);assert.equal(result.httpStatus,302,'received redirect status must remain observable');}
 assert.equal(requests.length,4,'redirects must not trigger a second destination request');assert.equal(nativeCalls,0);
 mode='oversize';
 for(const test of [testSerperKey,testHunterKey]){const result=await test('synthetic-diagnostic-key');assert.equal(result.success,false);assert.equal(result.httpStatus,200,'body refusal must preserve observed HTTP status');assert.match(result.message,/BODY_LIMIT/);}
 const {runV1Enrichment,resetV1ProviderFailureState}=await import('../v1_engine');
 mode='private';engineFixture=true;const beforePrivate=requests.length;
 const denied=await runV1Enrichment('Scopeanchor Medical','Kenya',{profile:'bulk'});
 assert.equal(requests.length,beforePrivate,'actual research must reject private provider DNS before sending keys');
 assert.ok(denied.raw_records.filter(record=>record.provider==='serper').every(record=>record.failure&&record.http_status===undefined));
 mode='public';const beforePublic=requests.length;
 const allowed=await runV1Enrichment('Scopeanchor Medical','Kenya',{profile:'bulk'});
 const providerCalls=requests.slice(beforePublic).filter(call=>['google.serper.dev','api.hunter.io'].includes(call.options.servername));
 assert.ok(providerCalls.some(call=>call.options.servername==='api.hunter.io'),'actual Hunter research traverses the pinned transport');
 for(const call of providerCalls){
  if(call.options.servername==='api.hunter.io')assert.equal(new URL(call.options.path,'https://api.hunter.io').searchParams.get('api_key'),'synthetic-hunter-key','Hunter query credential must remain intact at the authorized origin');
  else assert.equal(call.options.headers['x-api-key'],'synthetic-search-key','Serper header credential must remain intact at the authorized origin');
 }
 for(const call of requests.slice(beforePublic).filter(call=>call.options.servername==='scopeanchor.test'))assert.ok(!call.options.headers['x-api-key']&&!call.options.path.includes('synthetic-hunter-key'),'provider credentials must not reach public source capture');
 const resolves=providerCalls.filter(call=>call.options.path==='/resolve');assert.equal(resolves.length,4);
 for(const call of resolves){assert.ok(call.body&&call.body.length>2*1024*1024&&call.body.length<8*1024*1024,'complete large Serper envelope must not be truncated to the old2MiB provider request cap');assert.equal(call.options.headers['x-api-key'],'synthetic-search-key');}
 assert.ok(allowed.raw_records.some(record=>record.provider==='serper'&&JSON.stringify(record.response).length>2*1024*1024&&!record.failure),'original8MiB response contract remains usable');
 assert.ok(!JSON.stringify(allowed).includes('synthetic-search-key')&&!JSON.stringify(allowed).includes('synthetic-hunter-key'),'raw evidence must not retain credentials');
 assert.equal(allowed.identity_resolution?.official_domain,'scopeanchor.test');
 mode='redirect';const rejected=await runV1Enrichment('Scopeanchor Medical','Kenya',{profile:'bulk'});
 assert.ok(rejected.raw_records.filter(record=>record.provider==='serper').every(record=>record.http_status===302&&record.failure),'research retains actual rejected-redirect status');
 const {safeFetchProviderRequest}=await import('../url_safety');
 mode='stall';await assert.rejects(safeFetchProviderRequest('https://google.serper.dev/search',{method:'POST',body:'{}',timeoutMs:30}),error=>
  error instanceof Error&&error.name==='ProviderBodyTimeout'&&(error as any).httpStatus===200,'whole-operation body deadline preserves the observed response status');
 mode='public';const beforeBounds=requests.length;
 await assert.rejects(safeFetchProviderRequest('https://google.serper.dev/resolve',{method:'POST',body:'x'.repeat(2*1024*1024+1)}),/request body limit/);
 await assert.rejects(safeFetchProviderRequest('https://google.serper.dev/resolve',{method:'POST',body:'{}',maxRequestBytes:9*1024*1024}),/Invalid.*bound/);
 assert.equal(requests.length,beforeBounds,'request budgets reject before the key can reach a transport');
 largeFixture=false;
 for(const provider of ['serper','hunter'])for(const status of [401,403,429]){
  resetV1ProviderFailureState('serper');resetV1ProviderFailureState('hunter');
  refusedProvider=provider==='serper'?'google.serper.dev':'api.hunter.io';refusedStatus=status;
  const beforeFailure=requests.length;
  const failed=await runV1Enrichment('Scopeanchor Medical','Kenya',{profile:'bulk'});
  assert.equal(requests.slice(beforeFailure).filter(call=>call.options.servername===refusedProvider).length,1,'known account refusal must stop repeated calls even when the hardened transport rejects the body');
  assert.ok(failed.raw_records.some(record=>record.provider===provider&&record.http_status===status&&record.failure),'account HTTP status remains in immutable evidence');
  const beforeRetry=requests.length;await runV1Enrichment('Scopeanchor Medical','Kenya',{profile:'bulk'});
  assert.equal(requests.slice(beforeRetry).filter(call=>call.options.servername===refusedProvider).length,0,'later runs must retain the actual account suppression/cooldown');
 }
 refusedProvider='';
 mode='eight';
 const maximumBody=JSON.stringify({padding:'x'.repeat(8*1024*1024-JSON.stringify({padding:''}).length)});
 const maximumResponse=await safeFetchProviderRequest('https://google.serper.dev/search',{method:'POST',body:maximumBody,maxBytes:8*1024*1024,maxRequestBytes:8*1024*1024});
 assert.equal((await maximumResponse.arrayBuffer()).byteLength,8*1024*1024,'inclusive8MiB response ceiling remains intact');
 assert.equal(requests.at(-1)?.body?.byteLength,8*1024*1024,'inclusive explicit8MiB request ceiling remains intact');
 mode='over-eight';
 await assert.rejects(safeFetchProviderRequest('https://google.serper.dev/search',{maxBytes:8*1024*1024}),error=>error instanceof Error&&error.name==='ProviderBodyLimit'&&(error as any).httpStatus===200,'streamed bytes over8MiB fail with actual response status');
 const beforeOversizeRequest=requests.length;
 await assert.rejects(safeFetchProviderRequest('https://google.serper.dev/resolve',{method:'POST',body:maximumBody+' ',maxRequestBytes:8*1024*1024}),/request body limit/);
 assert.equal(requests.length,beforeOversizeRequest);
 assert.equal(nativeCalls,0);
 console.log('PASS actual provider diagnostic/research private+mixed DNS, pinned HTTPS, no redirects/native-fetch, HTTP/body-failure status,3MiB Serper replay and request bounds; synthetic DNS/wire only');
}finally{dns.lookup=original.lookup;https.request=original.https;http.request=original.http;global.fetch=original.fetch;assert.equal(path.dirname(fs.realpathSync(root)),fs.realpathSync(os.tmpdir()));fs.rmSync(root,{recursive:true,force:true});}
