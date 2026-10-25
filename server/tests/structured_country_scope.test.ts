import assert from 'node:assert/strict';
import { contactFactScope } from '../contact_country_scope';
import { projectDeterministicContactFields } from '../job_manager';

const organization = (country: unknown, email: string, leader: string, city: string, street: string) => ({
  '@type': 'Organization', name: 'Scopeanchor Medical', email,
  address: { '@type': 'PostalAddress', streetAddress: street, addressLocality: city, addressCountry: country },
  employee: { '@type': 'Person', name: leader, jobTitle: 'Country Manager' },
});
const foreign = organization('PK', 'parent@scopeanchor.test', 'Foreign Fixture', 'Karachi', '10 Parent Road');
const local = organization({ '@type': 'Country', name: 'KEN' }, 'branch@scopeanchor.test', 'Local Fixture', 'Nairobi', '20 Branch Road');
const source = { id: 'structured-offices', provider: 'direct-http', status: 'success', url: 'https://scopeanchor.test/contact', rank: 1,
  title: '', snippet: '', text: 'Scopeanchor Medical Kenya offices',
  html: `<nav>Kenya</nav><script type="application/ld+json">${JSON.stringify({ '@graph': [foreign, local] })}</script>`, links: [], metadata: {} };
const run = { company_name: 'Scopeanchor Medical', country: 'Kenya', identity_resolution: { official_domain: 'scopeanchor.test' }, results: [source] } as any;
const before = JSON.stringify(run);
const fields = projectDeterministicContactFields(run);
assert.deepEqual(fields.emails_list, ['branch@scopeanchor.test'], 'country-code structured parent mailbox must not inherit Kenyan navigation');
assert.deepEqual(fields.addresses, ['20 Branch Road, Nairobi, KEN'], 'each structured address must keep its own country');
assert.deepEqual(fields.contact_persons.map(person => person.name), ['Local Fixture'], 'nested people inherit their own organization country, not a graph sibling');
assert.equal(contactFactScope(source, 'parent@scopeanchor.test', 'Kenya', 'email').scope, 'foreign');
assert.equal(contactFactScope(source, 'branch@scopeanchor.test', 'Kenya', 'email').scope, 'local');
assert.equal(JSON.stringify(run), before, 'structured scope must not rewrite provider evidence');

const noLocation = { ...source, html: '<nav>Kenya</nav><script type="application/ld+json">{"@type":"Person","name":"Unscoped Fixture","jobTitle":"Global CEO","nationality":"KE"}</script>' };
assert.equal(contactFactScope(noLocation, 'Unscoped Fixture', 'Kenya', 'leader').scope, 'unknown', 'nationality and page navigation do not prove employment location');
const malformed = { ...source, html: '<nav>Kenya</nav><script type="application/ld+json">{"name":"Broken Fixture", bad-json}</script>' };
assert.equal(contactFactScope(malformed, 'Broken Fixture', 'Kenya', 'leader').scope, 'unknown', 'malformed structured carrier cannot borrow visible navigation scope');
const localOnly = { ...source, text: '', html: `<script type="application/ld+json">${JSON.stringify(local)}</script>` };
assert.equal(contactFactScope(localOnly, 'branch@scopeanchor.test', 'Kenya', 'email').scope, 'local', 'explicit ISO country in structured address works without visible English country words');
assert.equal(contactFactScope({ ...source, html: '', text: 'Contact us in our office\nunscoped@scopeanchor.test' }, 'unscoped@scopeanchor.test', 'United States', 'email').scope, 'unknown', 'ordinary prose is never interpreted as an ISO code');
const overBudget = { ...source, html: `<nav>Kenya</nav><script type="application/ld+json">${JSON.stringify({ padding: 'x'.repeat(262145), ...foreign })}</script>` };
const bounded = projectDeterministicContactFields({ ...run, results: [overBudget] });
assert.deepEqual(bounded.emails_list, [], 'structured budget exhaustion must not reopen navigation-based scope');
assert.deepEqual(bounded.addresses, [], 'a reconstructed address that is not contiguous raw text must also abstain after structured budget exhaustion');
assert.ok(fields.evidence.every(item => item.scope === 'local' && item.source_result_id === source.id), 'each retained field has scoped source provenance');
for (const relation of ['distributor', 'partner', 'parentOrganization']) {
  const related = { ...local, [relation]: organization('KE', 'other@scopeanchor.test', 'Related Fixture', 'Nairobi', '30 Other Road') };
  const relatedSource = { ...source, html: `<script type="application/ld+json">${JSON.stringify(related)}</script>` };
  assert.equal(contactFactScope(relatedSource, 'other@scopeanchor.test', 'Kenya', 'email').scope, 'related_entity', `${relation} remains another entity even in the same country/domain`);
  const projected = projectDeterministicContactFields({ ...run, results: [relatedSource] });
  assert.deepEqual(projected.emails_list, ['branch@scopeanchor.test'], 'reject related contact without discarding the actual local office');
}
const south = { ...source, text: '', html: `<script type="application/ld+json">${JSON.stringify(organization('SS', 'south@scopeanchor.test', 'South Fixture', 'Juba', '40 Fixture Road'))}</script>` };
assert.equal(contactFactScope(south, 'south@scopeanchor.test', 'Sudan', 'email').scope, 'foreign', 'SS is South Sudan, not Sudan');
assert.equal(contactFactScope(south, 'south@scopeanchor.test', 'South Sudan', 'email').scope, 'local');
const stringAddress = { ...local, address: '20 Branch Road, Nairobi, Kenya' };
const stringSource = { ...source, text: '', html: `<script type="application/ld+json">${JSON.stringify(stringAddress)}</script>` };
assert.equal(contactFactScope(stringSource, 'branch@scopeanchor.test', 'Kenya', 'email').scope, 'local', 'a fully specified textual structured address remains usable');
const personLocation = { ...local, employee: { '@type': 'Person', name: 'Remote Fixture', jobTitle: 'Country Manager', address: { addressCountry: 'PK' } } };
const personSource = { ...source, html: `<script type="application/ld+json">${JSON.stringify(personLocation)}</script>` };
assert.equal(contactFactScope(personSource, 'Remote Fixture', 'Kenya', 'leader').scope, 'foreign', 'person-specific location cannot be overwritten by organization inheritance');
console.log('PASS structured ISO office isolation, inherited organization scope, unknown/malformed abstention and raw preservation');
