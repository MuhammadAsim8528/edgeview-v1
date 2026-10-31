import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {isSerperGoogleRedirect,serperLinkSubstitutions} from '../serper_links';
import {installAiTransportFixture} from './fixtures/ai_transport';

const opaque='https://www.google.com/goto?url=opaque-synthetic-token';
assert.ok(isSerperGoogleRedirect(opaque));
assert.ok(!isSerperGoogleRedirect('https://attacker.test/google.com/goto?url=opaque'));
const original={organic:[{position:1,title:'Original',snippet:'Original snippet',link:'https://ke.linkedin.com/in/alice-fixture'},{position:4,title:'Lower result',snippet:'Scoped evidence',link:opaque}]};
assert.deepEqual([...serperLinkSubstitutions(original,{organic:[{...original.organic[0],link:'https://attacker.test/rewritten'}, {...original.organic[1],link:'https://ke.linkedin.com/in/bob-fixture'}]})],[[1,'https://ke.linkedin.com/in/bob-fixture']]);
for(const bad of ['javascript:alert(1)','https://user:secret@public.test/x','http://127.0.0.1/private',opaque])assert.equal(serperLinkSubstitutions(original,{organic:[original.organic[0],{...original.organic[1],link:bad}]}).size,0);
assert.throws(()=>serperLinkSubstitutions(original,{organic:[]}),/changed.*shape/);
assert.throws(()=>serperLinkSubstitutions(original,{organic:[original.organic[0],{...original.organic[1],position:8}]}),/changed.*identity/);
for(const altered of [{title:'Different Holdings Pakistan'}, {snippet:'Different employer'}, {position:undefined}])assert.throws(()=>serperLinkSubstitutions(original,{organic:[original.organic[0],{...original.organic[1],...altered,link:'https://different-holdings.test/contact'}]}),/changed.*identity/,'a resolved URL cannot borrow facts from a different organic record');

const root=fs.mkdtempSync(path.join(os.tmpdir(),'edgeview-serper-resolve-'));
process.env.EDGEVIEW_TEST_MODE='1';process.env.EDGEVIEW_CONFIG=path.join(root,'config.json');process.env.EDGEVIEW_V1_DATA_DIR=path.join(root,'runs');
fs.writeFileSync(process.env.EDGEVIEW_CONFIG,JSON.stringify({serper_enabled:true,serper_api_key:'synthetic_resolver_key_not_real',hunter_enabled:false,nvidia_enabled:false,groq_enabled:false}));
const nativeFetch=global.fetch;
const restoreTransport=installAiTransportFixture(['google.serper.dev']);
try{
 const {runV1Enrichment,getV1Run,getV1EngineDiagnostics}=await import('../v1_engine');
 const {projectHistoricalContactFields}=await import('../job_manager');
 for(const mode of ['success','mixed-malformed','already-real','partial','quota','malformed','unsafe','opaque-only','opaque-only-fail']){
  let searches=0,resolves=0,inFlight=0,peak=0;
  const response={organic:Array.from({length:4},(_,index)=>({position:index+1,title:'Scopeanchor Medical Kenya profile',snippet:'Scopeanchor Medical Kenya public profile',link:(index===3&&mode!=='already-real')||mode.startsWith('opaque-only')?opaque:`https://ke.linkedin.com/in/synthetic-${index}`})),searchParameters:{q:'synthetic'}};
  if(mode==='mixed-malformed')(response.organic as any[]).unshift(null);
  const originalJson=JSON.stringify(response);
  global.fetch=(async(input:any,init:any)=>{
   const url=String(input);
   assert.equal(new Headers(init.headers).get('x-api-key'),'synthetic_resolver_key_not_real');
   if(url==='https://google.serper.dev/search'){searches++;return Response.json(response);}
   assert.equal(url,'https://google.serper.dev/resolve','only the fixed provider endpoint receives the key');
   assert.equal(searches,4,'all searches start before link resolution waits');
   assert.equal(init.redirect,'error','credentials never follow provider redirects');
   assert.deepEqual(JSON.parse(init.body),response,'send the documented original complete search response');
   resolves++;peak=Math.max(peak,++inFlight);await new Promise(resolve=>setTimeout(resolve,15));inFlight--;
   if(mode==='quota')return Response.json({message:'Synthetic resolver quota'},{status:429});
   if(mode==='malformed')return Response.json({organic:[]});
   return Response.json({organic:response.organic.map(item=>item&&({...item,link:isSerperGoogleRedirect(item.link)
    ?mode==='partial'||mode==='opaque-only-fail'?opaque:mode==='unsafe'?'http://127.0.0.1/private':'https://ke.linkedin.com/in/resolved-lower-result':item.link})),...(mode==='partial'?{retryAfter:30}:{})});
  }) as typeof fetch;
  const run=await runV1Enrichment('Scopeanchor Medical','Kenya',{profile:'bulk'});
  assert.equal(searches,4);assert.equal(resolves,mode==='already-real'?0:4);assert.ok(peak<=2);
  assert.equal(JSON.stringify(response),originalJson,'original search capture remains immutable');
  assert.ok(!JSON.stringify(run).includes('synthetic_resolver_key_not_real'));
  if(mode==='success'||mode==='opaque-only'||mode==='mixed-malformed'){
   assert.ok(run.results.some(result=>result.url==='https://ke.linkedin.com/in/resolved-lower-result'&&result.status==='success'));
   assert.ok(run.results.filter(result=>result.metadata.original_google_link).every(result=>result.raw_record_id.split(',').length===2));
   assert.equal(run.raw_records.filter(record=>record.provider==='serper-resolve'&&!record.failure).length,4);
   if(mode==='mixed-malformed')assert.ok(run.raw_records.filter(record=>record.provider==='serper').every(record=>record.failure),'original partial-schema warning must remain observable');
  }else if(mode!=='already-real'){
   assert.ok(run.results.filter(result=>isSerperGoogleRedirect(result.url)).every(result=>result.status==='failed'&&result.error==='SERPER_LINK_UNRESOLVED'));
   assert.ok(run.raw_records.filter(record=>record.provider==='serper-resolve').every(record=>record.failure));
   assert.ok(!getV1EngineDiagnostics().suppressed_providers.some(item=>item.provider==='serper'),'independent resolver quota must not disable search');
   if(mode==='partial')assert.ok(run.raw_records.some(record=>(record.response as any)?.retryAfter===30));
   if(mode==='opaque-only-fail'){assert.equal(run.status,'FAILED','unusable opaque links are not successful empty search');assert.equal(projectHistoricalContactFields(run).quality_status,'FAILED','transport failure cannot certify absence of a company');}
  }
  assert.deepEqual(getV1Run(run.id),JSON.parse(JSON.stringify(run)),'original/resolved captures survive actual immutable storage');
 }
 console.log('PASS actual V1 Serper deferred fixed-endpoint resolution, two-worker bound, provenance, no-key capture, real-link preservation, quota/malformed/private/partial abstention and storage; synthetic provider responses');
}finally{restoreTransport();global.fetch=nativeFetch;assert.equal(path.dirname(fs.realpathSync(root)),fs.realpathSync(os.tmpdir()));fs.rmSync(root,{recursive:true,force:true});}
