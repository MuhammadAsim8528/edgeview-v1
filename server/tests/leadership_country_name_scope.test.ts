import assert from 'node:assert/strict';
import { projectDeterministicContactFields } from '../job_manager';

function project(person: string, location: string) {
 const source = {id:'profile',provider:'direct-http',status:'success',rank:1,
   url:'https://www.linkedin.com/in/synthetic-name', title:`${person} - Country Manager at Scopeanchor Medical`,
   snippet:`${person} works at Scopeanchor Medical in ${location}.`,text:`${person} works at Scopeanchor Medical in ${location}.`,links:[],metadata:{}};
 return projectDeterministicContactFields({company_name:'Scopeanchor Medical',country:'Kenya',
   identity_resolution:{official_domain:'scopeanchor.test'} as any,results:[source] as any});
}
for(const person of ['Jordan Fixture','Chad Fixture','Georgia Fixture']) {
 assert.deepEqual(project(person,'Kenya').contact_persons.map(item=>item.name),[person], 'a personal name is not a foreign-country assertion');
 assert.equal(project(person,'unknown location').contact_persons.length,0,'a personal name alone cannot establish a local country');
 assert.equal(project(person,'Pakistan').contact_persons.length,0,'masking a name must not erase actual foreign location evidence');
}
assert.equal(project('Alice Fixture','Jordan').contact_persons.length,0,'Jordan as explicit office location remains foreign');
console.log('PASS country-shaped personal names do not override actual local/foreign profile locations');
