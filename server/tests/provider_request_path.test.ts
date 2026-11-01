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
let onProviderResponse: ((options: any, body?: Buffer) => void) | undefined;
let aiFixture=false, delayedResolver=false, resolverResponseCount=0;
let failWireHost='';
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
  incoming.headers={'content-type':refusedProvider===options.servername&&!aiFixture?'application/problem+json':'application/json',...(mode==='redirect'?{location:'http://127.0.0.1/private'}:{})};
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
    else if(['api.groq.com','integrate.api.nvidia.com'].includes(options.servername)&&aiFixture){
      const sent=JSON.parse(body?.toString()||'{}'), request=JSON.parse(sent.messages[1].content);
      payload=JSON.stringify({choices:[{message:{content:JSON.stringify(request.chunks?{claims:[]}:
        [`${request.company_name} ${request.country} official`,`${request.company_name} ${request.country} contact`])}}]});
    }
    else{incoming.headers['content-type']='text/html';payload='<html><title>Scopeanchor Medical Kenya</title><p>Scopeanchor Medical Kenya office</p></html>';}
  }
  if(mode==='oversize')payload=JSON.stringify({organic:[],padding:'x'.repeat(300*1024)});
  if(mode==='eight'||mode==='over-eight')payload=JSON.stringify({padding:'x'.repeat(8*1024*1024-JSON.stringify({padding:''}).length+(mode==='over-eight'?1:0))});
  if(refusedProvider===options.servername)payload=JSON.stringify({error:'Synthetic account refusal'});
  onProviderResponse?.(options,body);
  if(failWireHost===options.servername){failWireHost='';incoming.destroy(new Error('socket synthetic old-request failure'));return;}
  if(!incoming.destroyed&&mode!=='stall'){
    if(delayedResolver&&options.path==='/resolve'&&++resolverResponseCount===2)setTimeout(()=>{if(!incoming.destroyed)incoming.end(payload);},80);
    else incoming.end(payload);
  }
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
 const {runV1Enrichment,resetV1ProviderFailureState,getV1Run}=await import('../v1_engine');
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
 const originalConfig=fs.readFileSync(process.env.EDGEVIEW_CONFIG,'utf8');
 try {
  largeFixture=false;let changed=false;const beforeChange=requests.length;
  onProviderResponse=options=>{if(!changed&&options.servername==='google.serper.dev'&&options.path==='/search'){
    changed=true;fs.writeFileSync(process.env.EDGEVIEW_CONFIG!,JSON.stringify({...JSON.parse(originalConfig),hunter_enabled:false}));
  }};
  const interrupted=await runV1Enrichment('Scopeanchor Medical','Kenya',{profile:'bulk'});
  assert.equal(changed,true,'configuration change must occur during a real mocked provider response');
  assert.equal(interrupted.status,'PARTIAL','changed configuration cannot be published as a completed compatible capture');
  assert.equal(requests.length-beforeChange,1,'no later request may use the changed provider selection');
  assert.ok(interrupted.timeline.some(event=>event.stage==='run'&&event.status==='failed'&&event.error?.includes('RESEARCH_CONFIGURATION_CHANGED')));
  assert.equal(getV1Run(interrupted.id)?.status,'PARTIAL','captured evidence and interruption must persist together');
 } finally { onProviderResponse=undefined;fs.writeFileSync(process.env.EDGEVIEW_CONFIG,originalConfig); }
 for(const scenario of ['key_rotation','model_change','resolver','hunter','query_generation','extraction','preference_only']){
  const baseConfig={...JSON.parse(originalConfig),...(scenario==='query_generation'||scenario==='extraction'?{groq_enabled:true,groq_api_key:'synthetic-ai-key',groq_model:'synthetic-model'}:{})};
  fs.writeFileSync(process.env.EDGEVIEW_CONFIG,JSON.stringify(baseConfig));
  aiFixture=scenario==='query_generation'||scenario==='extraction';delayedResolver=scenario==='resolver';resolverResponseCount=0;
  resetV1ProviderFailureState('groq');let changed=false;const before=requests.length;
  onProviderResponse=(options,body)=>{
    const isAi=options.servername==='api.groq.com';
    const extraction=isAi&&Boolean(JSON.parse(JSON.parse(body!.toString()).messages[1].content).chunks);
    const target=scenario==='resolver'?options.path==='/resolve':scenario==='hunter'?options.servername==='api.hunter.io'
      :scenario==='query_generation'?isAi&&!extraction:scenario==='extraction'?extraction:options.path==='/search';
    if(changed||!target)return;changed=true;
    const patch=scenario==='preference_only'?{monitoring_errors_enabled:true}:scenario==='key_rotation'?{serper_api_key:'synthetic-rotated-key'}
      :scenario==='model_change'||scenario==='extraction'?{groq_model:'synthetic-changed-model'}:scenario==='query_generation'?{groq_enabled:false}:{hunter_enabled:false};
    fs.writeFileSync(process.env.EDGEVIEW_CONFIG!,JSON.stringify({...baseConfig,...patch}));
  };
  try{
    const result=await runV1Enrichment('Scopeanchor Medical','Kenya',{profile:'bulk'});
    assert.equal(changed,true,`the ${scenario} response must actually be exercised`);
    const calls=requests.slice(before);
    if(scenario==='preference_only'){
      assert.equal(result.status,'COMPLETED','monitoring preference changes cannot interrupt research');
      assert.ok(!result.timeline.some(event=>event.error==='RESEARCH_CONFIGURATION_CHANGED'));
    }else{
      assert.equal(result.status,scenario==='query_generation'?'FAILED':'PARTIAL',scenario);
      assert.ok(result.timeline.some(event=>event.stage==='run'&&event.error==='RESEARCH_CONFIGURATION_CHANGED'),scenario);
      assert.equal(getV1Run(result.id)?.status,result.status,'interruption is durable');
      if(scenario==='key_rotation'||scenario==='model_change')assert.equal(calls.length,1,'no follow-on provider request');
      if(scenario==='query_generation')assert.equal(calls.length,1,'query configuration change stops before search');
      if(scenario==='resolver'){
        const resolving=calls.filter(call=>call.options.path==='/resolve');
        assert.ok(resolving.length>=1&&resolving.length<=2,'only the already-issued pair may finish');
        const returned=JSON.stringify(result), persisted=JSON.stringify(getV1Run(result.id));
        await new Promise(resolve=>setTimeout(resolve,120));
        assert.equal(JSON.stringify(result),returned,'resolver sibling cannot mutate the returned run after persistence');
        assert.equal(JSON.stringify(getV1Run(result.id)),persisted,'immutable bytes remain stable after worker drain');
        assert.ok(!calls.some(call=>call.options.servername==='api.hunter.io'));
      }
      if(scenario==='hunter')assert.ok(!calls.some(call=>call.options.servername==='scopeanchor.test'),'stop before public crawl');
      if(scenario==='extraction'){
        const aiCalls=calls.filter(call=>call.options.servername==='api.groq.com');
        assert.equal(aiCalls.length,2,'initial and extraction requests use one captured model');
        assert.ok(aiCalls.every(call=>JSON.parse(call.body!.toString()).model===baseConfig.groq_model),'actual wire model must match the recorded configuration');
      }
      assert.ok(!JSON.stringify(result).includes('synthetic-rotated-key')&&!JSON.stringify(result).includes('synthetic-ai-key'),'private settings snapshot must not serialize');
    }
    if(scenario==='key_rotation'){
      onProviderResponse=undefined;const retryStart=requests.length;
      const retried=await runV1Enrichment('Scopeanchor Medical','Kenya',{profile:'bulk'});
      assert.equal(retried.status,'COMPLETED');assert.notEqual(retried.id,result.id);
      assert.ok(requests.slice(retryStart).filter(call=>call.options.servername==='google.serper.dev').every(call=>call.options.headers['x-api-key']==='synthetic-rotated-key'),'fresh retry uses the new credential');
    }
  }finally{onProviderResponse=undefined;aiFixture=false;delayedResolver=false;fs.writeFileSync(process.env.EDGEVIEW_CONFIG,originalConfig);}
 }
 let concurrent:ReturnType<typeof runV1Enrichment>|undefined;
 try{
  let changed=false;const before=requests.length;
  onProviderResponse=options=>{if(!changed&&options.path==='/search'){
    changed=true;fs.writeFileSync(process.env.EDGEVIEW_CONFIG!,JSON.stringify({...JSON.parse(originalConfig),serper_api_key:'synthetic-concurrent-key'}));
    concurrent=runV1Enrichment('Scopeanchor Medical Limited','Kenya',{profile:'bulk'});
  }};
  const first=await runV1Enrichment('Scopeanchor Medical','Kenya',{profile:'bulk'});
  const second=await concurrent;
  assert.ok(second,'second operation must overlap the first response');
  assert.equal(first.status,'PARTIAL');assert.equal(second.status,'COMPLETED');assert.notEqual(first.id,second.id);
  const later=requests.slice(before).filter(call=>call.options.path==='/search'&&JSON.parse(call.body!.toString()).q.startsWith('Scopeanchor Medical Limited'));
  assert.ok(later.length>=2);assert.ok(later.every(call=>call.options.headers['x-api-key']==='synthetic-concurrent-key'),'concurrent run owns its own fresh settings snapshot');
 }finally{await concurrent?.catch(()=>{});onProviderResponse=undefined;fs.writeFileSync(process.env.EDGEVIEW_CONFIG,originalConfig);}
 for(const provider of ['serper','hunter','groq','nvidia'])for(const status of [401,403,429]){
  const host={serper:'google.serper.dev',hunter:'api.hunter.io',groq:'api.groq.com',nvidia:'integrate.api.nvidia.com'}[provider]!;
  const baseConfig={...JSON.parse(originalConfig),...(provider==='groq'?{groq_enabled:true,groq_api_key:'synthetic-old-ai-key',groq_model:'synthetic-model'}:
    provider==='nvidia'?{nvidia_enabled:true,nvidia_api_key:'synthetic-old-ai-key',nvidia_model:'synthetic-model',nvidia_base_url:'https://integrate.api.nvidia.com/v1'}:{})};
  fs.writeFileSync(process.env.EDGEVIEW_CONFIG,JSON.stringify(baseConfig));aiFixture=provider==='groq'||provider==='nvidia';
  resetV1ProviderFailureState(provider);refusedProvider=host;refusedStatus=status;
  let changed=false;
  onProviderResponse=options=>{if(!changed&&options.servername===host){
    changed=true;fs.writeFileSync(process.env.EDGEVIEW_CONFIG!,JSON.stringify({...baseConfig,[`${provider}_api_key`]:'synthetic-replacement-key'}));
    resetV1ProviderFailureState(provider);refusedProvider='';
  }};
  try{
    const obsolete=await runV1Enrichment('Scopeanchor Medical','Kenya',{profile:'bulk'});
    assert.equal(changed,true,provider);
    assert.ok(obsolete.raw_records.some(record=>record.provider===provider&&(record.http_status??record.failure?.status)===status&&record.failure),`old ${provider}/${status} credential refusal remains evidence`);
    onProviderResponse=undefined;const beforeRetry=requests.length;
    const fresh=await runV1Enrichment('Scopeanchor Medical','Kenya',{profile:'bulk'});
    assert.equal(fresh.status,'COMPLETED',`late old-key ${provider}/${status} must not suppress the newly configured account`);
    const freshCalls=requests.slice(beforeRetry).filter(call=>call.options.servername===host);
    assert.ok(freshCalls.length>=1);
    assert.ok(freshCalls.every(call=>provider==='serper'?call.options.headers['x-api-key']==='synthetic-replacement-key':provider==='hunter'
      ?new URL(call.options.path,'https://api.hunter.io').searchParams.get('api_key')==='synthetic-replacement-key'
      :(call.options.headers.authorization||call.options.headers.Authorization)==='Bearer synthetic-replacement-key'),'all replacement account requests use its new credential');
  }finally{onProviderResponse=undefined;refusedProvider='';aiFixture=false;resetV1ProviderFailureState(provider);fs.writeFileSync(process.env.EDGEVIEW_CONFIG,originalConfig);}
 }
 for(const provider of ['groq','nvidia'])for(const rotate of [false,true]){
  const host=provider==='groq'?'api.groq.com':'integrate.api.nvidia.com';
  const baseConfig={...JSON.parse(originalConfig),[`${provider}_enabled`]:true,[`${provider}_api_key`]:'synthetic-network-old-key',[`${provider}_model`]:'synthetic-model'};
  fs.writeFileSync(process.env.EDGEVIEW_CONFIG,JSON.stringify(baseConfig));aiFixture=true;failWireHost=host;resetV1ProviderFailureState(provider);
  onProviderResponse=options=>{if(rotate&&options.servername===host){
    fs.writeFileSync(process.env.EDGEVIEW_CONFIG!,JSON.stringify({...baseConfig,[`${provider}_api_key`]:'synthetic-network-new-key'}));resetV1ProviderFailureState(provider);
  }};
  try{
    const failed=await runV1Enrichment('Scopeanchor Medical','Kenya',{profile:'bulk'});
    assert.ok(failed.raw_records.some(record=>record.provider===provider&&record.failure?.message.includes('socket synthetic')));
    onProviderResponse=undefined;const before=requests.length;
    const retry=await runV1Enrichment('Scopeanchor Medical','Kenya',{profile:'bulk'});
    const aiCalls=requests.slice(before).filter(call=>call.options.servername===host);
    if(rotate){assert.equal(retry.status,'COMPLETED');assert.ok(aiCalls.length>=2,'obsolete network failure cannot cool down a replacement account');}
    else{assert.equal(aiCalls.length,0,'unchanged account must retain network cooldown');assert.ok(retry.timeline.some(event=>event.status==='skipped'&&event.message.includes('cooling down')));}
  }finally{onProviderResponse=undefined;failWireHost='';aiFixture=false;resetV1ProviderFailureState(provider);fs.writeFileSync(process.env.EDGEVIEW_CONFIG,originalConfig);}
 }
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
 console.log('PASS actual provider diagnostic/research private+mixed DNS, pinned HTTPS, no redirects/native-fetch, HTTP/body-failure status,3MiB Serper replay, request bounds and settings-change query/search/resolver/Hunter/extraction/key-rotation/drain/retry/preference controls; synthetic DNS/wire only');
}finally{dns.lookup=original.lookup;https.request=original.https;http.request=original.http;global.fetch=original.fetch;assert.equal(path.dirname(fs.realpathSync(root)),fs.realpathSync(os.tmpdir()));fs.rmSync(root,{recursive:true,force:true});}
