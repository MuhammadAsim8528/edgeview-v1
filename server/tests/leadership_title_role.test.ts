import assert from 'node:assert/strict';
import { projectDeterministicContactFields } from '../job_manager';

for (const separator of ['-', '–', '|']) {
 const page = { id: 'profile', provider: 'direct-http', status: 'success', rank: 1,
   url: 'https://ke.linkedin.com/in/alice-fixture', title: `Alice Fixture ${separator} Country Manager at Scopeanchor Medical`,
   snippet: 'Alice Fixture works at Scopeanchor Medical in Kenya.', text: 'Alice Fixture works at Scopeanchor Medical in Kenya.', links: [], metadata: {} };
 const projected = projectDeterministicContactFields({company_name:'Scopeanchor Medical',country:'Kenya',
   identity_resolution:{official_domain:'scopeanchor.test'} as any,results:[page] as any});
 assert.equal(projected.contact_persons.length,1,'valid attributable leadership remains available');
 assert.equal(projected.contact_persons[0].name,'Alice Fixture');
 assert.equal(projected.contact_persons[0].designation,'Country Manager','person name is not part of a job role');
 const foreign = projectDeterministicContactFields({company_name:'Scopeanchor Medical',country:'Kenya',
   identity_resolution:{official_domain:'scopeanchor.test'} as any,results:[{...page,text:page.text.replace('Kenya','Pakistan'),snippet:page.snippet.replace('Kenya','Pakistan')}] as any});
 assert.equal(foreign.contact_persons.length,0,'title cleanup never overrides foreign field evidence');
}
console.log('PASS leadership roles omit repeated person names while preserving identity/country checks');
for (const role of ['Corporate Management', 'Professor Country Manager']) {
 const page={id:'profile',provider:'direct-http',status:'success',rank:1,url:'https://www.linkedin.com/in/alice-fixture',
 title:`Alice Fixture - ${role} at Scopeanchor Medical`,snippet:'Alice Fixture works at Scopeanchor Medical in Kenya.',
 text:'Alice Fixture works at Scopeanchor Medical in Kenya.',links:[],metadata:{}};
 const result=projectDeterministicContactFields({company_name:'Scopeanchor Medical',country:'Kenya',identity_resolution:{official_domain:'scopeanchor.test'} as any,results:[page] as any});
 assert.equal(result.contact_persons.length,0,'generic headings and rejected institutional roles cannot be laundered by title cleanup');
}

const multiEmployer = {id:'multi',provider:'direct-http',status:'success',rank:1,url:'https://ke.linkedin.com/in/alice-fixture',
 title:'Alice Fixture - Chief Executive Officer at Different Holdings',
 snippet:'Director Exports at Scopeanchor Medical in Kenya.',
 text:'Alice Fixture is Chief Executive Officer at Different Holdings. Director Exports at Scopeanchor Medical in Kenya.',links:[],metadata:{}};
const projectProfile=(source:any)=>projectDeterministicContactFields({company_name:'Scopeanchor Medical',country:'Kenya',identity_resolution:{official_domain:'scopeanchor.test'} as any,results:[source] as any});
assert.deepEqual(projectProfile(multiEmployer).contact_persons.map(p=>p.designation),['Director Exports'],
 'a target-company mention cannot authorize a different employer role from the same profile');
for(const suffix of ['Healthcare','Distributors']){
 const other={...multiEmployer,title:`Alice Fixture - CEO at Scopeanchor ${suffix}`,snippet:'Scopeanchor Medical Kenya partner profile.',text:`Alice Fixture CEO at Scopeanchor ${suffix}. Scopeanchor Medical Kenya partner profile.`};
 assert.deepEqual(projectProfile(other).contact_persons,[],'shared brand/partner mention is not an exact employer');
}
const former={...multiEmployer,title:'Alice Fixture - Former CEO at Scopeanchor Medical',snippet:'Former CEO at Scopeanchor Medical in Kenya.',text:'Alice Fixture was formerly CEO at Scopeanchor Medical in Kenya.'};
assert.deepEqual(projectProfile(former).contact_persons,[],'explicit former employment cannot be presented as current leadership');
const unboundClaim={field:'leader',value:'Alice Fixture',role:'CEO',source_type:'linkedin',source_result_id:former.id,source_url:former.url,quote:former.text};
const claimed=projectDeterministicContactFields({company_name:'Scopeanchor Medical',country:'Kenya',identity_resolution:{official_domain:'scopeanchor.test'} as any,results:[former] as any,evidence_workspace:{accepted_claims:[unboundClaim]} as any});
assert.deepEqual(claimed.contact_persons,[],'an already-admitted model claim cannot bypass deterministic employer/current-role checks');
for(const altered of [{...multiEmployer,status:'error'},{...multiEmployer,url:'https://attacker.test/linkedin.com/in/alice-fixture'}])assert.deepEqual(projectProfile(altered).contact_persons,[],'failed or lookalike profile URLs do not establish employment');
console.log('PASS LinkedIn role-to-employer binding, shared-brand collisions and explicit former role abstention');
