import assert from 'node:assert/strict';
import { projectDeterministicContactFields } from '../job_manager';

const card = (name: string, role: string, bio: string) => `<article><div class="elementor-team-name">${name}</div><div class="elementor-team-job">${role}</div><p>${bio}</p></article>`;
const html = `<html><head><title>Corporate Management – Scopeanchor Pharmaceuticals Ltd</title></head><body>
<header>10 Fixture Road, Colombo, Sri Lanka</header>
${card('Alice Anchor', 'Chairman', 'Alice studied at a university in Australia.')}
${card('Sam Local', 'Managing Director', 'Previously based in Australia. Sam completed a degree in the United Kingdom.')}
${card('Casey Local', 'Director (Scopeanchor Pharmaceuticals Ltd)', 'Serves this company.')}
${card('Taylor Local', 'Director (Human Resources)', 'Leads the internal department.')}
${card('Related Fixture', 'Chief Executive Officer (Scopeanchor Healthcare)', 'Leads the related healthcare business.')}
${card('Other Employer', 'Chief Executive Officer (Different Holdings Ltd)', 'Leads a separately named legal entity.')}
${card('Remote Fixture', 'Director', 'Previously based in Australia and currently based in Pakistan.')}
<footer><h3>Head Office</h3><p>10 Fixture Road, Colombo, Sri Lanka</p></footer></body></html>`;
const source = { id: 'formal-team', provider: 'direct-http', status: 'success', rank: 1, url: 'https://scopeanchor.test/corporate-management',
  title: 'Corporate Management – Scopeanchor Pharmaceuticals Ltd', html, text: html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '), links: [], metadata: {} };
const run = { company_name: 'Scopeanchor Pharmaceuticals Pvt Ltd', country: 'Sri Lanka', identity_resolution: { official_domain: 'scopeanchor.test' }, results: [source] } as any;
const before = JSON.stringify(run);
const projected = projectDeterministicContactFields(run);
assert.deepEqual(projected.contact_persons.map(person => person.name), ['Alice Anchor', 'Sam Local', 'Casey Local', 'Taylor Local'], 'education abroad must not erase the next local-company management card; own-company/department qualifiers stay valid while related company and explicit foreign location remain excluded');
assert.ok(projected.evidence.some(item => item.field === 'leader' && item.value === 'Sam Local' && item.scope_basis === 'local_head_office_management'
  && item.organization_country_source_result_id === source.id && item.organization_country_quote), 'inferred company affiliation must retain both person and headquarters evidence');
assert.equal(JSON.stringify(run), before, 'no mutation of source evidence');

const projectWith = (nextHtml: string, extra: any[] = []) => projectDeterministicContactFields({ ...run, results: [{ ...source, html: nextHtml, text: nextHtml.replace(/<[^>]+>/g, ' ') }, ...extra] });
const noHeadquarters = html.replace('<h3>Head Office</h3>', '<h3>Office hours</h3>');
assert.ok(!projectWith(noHeadquarters).contact_persons.some(person => person.name === 'Sam Local'), 'ordinary page country presence cannot replace headquarters evidence');
const foreignHeadquarters = html.replace('<h3>Head Office</h3><p>10 Fixture Road, Colombo, Sri Lanka</p>', '<h3>Head Office</h3><p>20 Parent Road, Karachi, Pakistan</p>');
assert.ok(!projectWith(foreignHeadquarters).contact_persons.some(person => person.name === 'Sam Local'), 'foreign parent headquarters cannot authorize local branch leadership');
const wrongPublisher = html.replace('Corporate Management – Scopeanchor Pharmaceuticals Ltd', 'Corporate Management – Different Pharmaceuticals Ltd');
assert.ok(!projectDeterministicContactFields({ ...run, results: [{ ...source, title: 'Different Pharmaceuticals Ltd', html: wrongPublisher }] }).contact_persons.some(person => person.name === 'Sam Local'), 'same domain alone does not establish the management page employer');
const contradictory = { ...source, id: 'other-headquarters', url: 'https://scopeanchor.test/contact', html: '<h3>Registered office</h3><p>20 Parent Road, Karachi, Pakistan</p>', text: 'Registered office\n20 Parent Road, Karachi, Pakistan' };
assert.ok(!projectWith(html, [contradictory]).contact_persons.some(person => person.name === 'Sam Local'), 'conflicting headquarters blocks implicit affiliation');
const typedForeign = html.replace('</body>', '<script type="application/ld+json">{"@type":"Person","name":"Sam Local","address":{"addressCountry":"PK"}}</script></body>');
assert.ok(!projectWith(typedForeign).contact_persons.some(person => person.name === 'Sam Local'), 'explicit person location cannot be overridden by headquarters inference');
const otherLayout = { ...source, html: '<header>Sri Lanka office</header><h3>Other Layout</h3><p>Director</p><script type="application/ld+json">{"@type":"Person","name":"Other Layout","jobTitle":"Director","address":{"addressCountry":"PK"}}</script><footer>Sri Lanka</footer>',
  text: 'Sri Lanka office\nOther Layout\nDirector\nSri Lanka' };
assert.ok(!projectDeterministicContactFields({ ...run, results: [otherLayout] }).contact_persons.some(person => person.name === 'Other Layout'), 'typed foreign person evidence must also protect layouts without the recognized team-card classes');
const templateHtml = `<title>Scopeanchor Pharmaceuticals Ltd</title><header>Sri Lanka office</header><script>const example = '${card('Script Template', 'Director', '')}';</script><!--${card('Comment Template', 'Director', '')}--><footer><h3>Head Office</h3><p>10 Fixture Road, Colombo, Sri Lanka</p></footer>`;
const templateSource = { ...source, html: templateHtml, text: 'Sri Lanka office\nHead Office\n10 Fixture Road, Colombo, Sri Lanka' };
const templates = projectDeterministicContactFields({ ...run, results: [templateSource], evidence_workspace: { accepted_claims: [{field:'leader', value:'Script Template',role:'Director',source_type:'official',source_result_id:source.id,source_url:source.url,quote:'Script Template Director'}] } });
assert.deepEqual(templates.contact_persons, [], 'script/comment template markup and uncarried model claims are not published team cards');
const foreignSectionHtml = `<title>Scopeanchor Pharmaceuticals Ltd</title><h1>Corporate Management</h1><h2>Pakistan Office</h2><h3>Management</h3>${card('Branch Fixture','Director','Leads this regional office.')}<footer><h3>Head Office</h3><p>10 Fixture Road, Colombo, Sri Lanka</p></footer>`;
assert.deepEqual(projectWith(foreignSectionHtml).contact_persons, [], 'local company headquarters cannot overwrite an explicit foreign-office heading around the person');
const countryNameHeading = `<title>Scopeanchor Pharmaceuticals Ltd</title><h1>Corporate Management</h1><h3 class="elementor-team-name">Jordan Fixture</h3><div class="elementor-team-job">Director</div><p>Education in Australia</p><footer><h3>Head Office</h3><p>10 Fixture Road, Colombo, Sri Lanka</p></footer>`;
assert.deepEqual(projectWith(countryNameHeading).contact_persons.map(person => person.name), ['Jordan Fixture'], 'a country-shaped personal name in its own heading is not a foreign office');
console.log('PASS formal management affiliation, historical biography geography, related employer, foreign/current/typed location and HQ conflict controls');
