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
