import assert from 'node:assert/strict';
import { projectDeterministicContactFields } from '../job_manager';
import { contactFactScope } from '../contact_country_scope';
import { visibleHtmlText } from '../html_evidence';

// Reproduced real-world shape: retired office markup remains inside comments,
// and older captures flattened those comments into their plain-text carrier.
const html = `<html><body><h2>Kenya contact details</h2>
<!-- <section><h3>Kenya retired office</h3><p>retired@scopeanchor.test</p>
<p>Telephone +254 20 333 7788</p><p>10 Retired Road, Nairobi, Kenya</p>
<script type="application/ld+json">{"@type":"Person","name":"Retired Fixture","jobTitle":"CEO","address":{"addressCountry":"KE"}}</script></section> -->
<section><h3>Kenya current office</h3><p>current@scopeanchor.test</p><p>Telephone +254 20 444 5566</p></section>
<script>const oldContact = 'template@scopeanchor.test';</script></body></html>`;
const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
const page = { id: 'visible-source', provider: 'direct-http', status: 'success', rank: 1,
  url: 'https://scopeanchor.test/contact', html, text, links: [], metadata: {} };
const run = { company_name: 'Scopeanchor Medical', country: 'Kenya',
  identity_resolution: { official_domain: 'scopeanchor.test' }, results: [page],
  evidence_workspace: { accepted_claims: [{ field: 'address', value: '10 Retired Road, Nairobi, Kenya',
    source_result_id: page.id, source_url: page.url, source_type: 'official', quote: '10 Retired Road, Nairobi, Kenya' }] } } as any;
const original = JSON.stringify(run);
const projected = projectDeterministicContactFields(run);
assert.deepEqual(projected.emails_list, ['current@scopeanchor.test'], 'hidden retired/template contacts cannot be promoted through old flattened text');
assert.deepEqual(projected.phones_list, ['+254 20 444 5566'], 'a country calling code does not make a hidden phone published evidence');
assert.deepEqual(projected.addresses, [], 'old accepted claim cannot override a present hidden-only carrier');
assert.equal(projected.contact_persons.length, 0, 'commented structured data is not a real current leader');
assert.equal(contactFactScope(page, 'retired@scopeanchor.test', 'Kenya', 'email').quote, '');
assert.equal(JSON.stringify(run), original, 'raw evidence remains unchanged');
assert.ok(!visibleHtmlText(html).includes('retired@scopeanchor.test'));
assert.ok(!visibleHtmlText(html).includes('template@scopeanchor.test'));
assert.ok(visibleHtmlText(html).includes('current@scopeanchor.test'));
assert.ok(visibleHtmlText('<script>const literal="<!--";</script><p>current@scopeanchor.test</p>').includes('current@scopeanchor.test'),
  'a JavaScript string must not swallow later visible HTML');
assert.ok(visibleHtmlText('<p title="<!--">current@scopeanchor.test</p>').includes('current@scopeanchor.test'),
  'a quoted attribute does not open an HTML comment');
const unterminated = { ...page, html: '<h2>Kenya</h2><!-- <p>retired@scopeanchor.test</p>', text: 'Kenya retired@scopeanchor.test' };
assert.deepEqual(projectDeterministicContactFields({ ...run, results: [unterminated], evidence_workspace: undefined }).emails_list, []);
const repeated = { ...page, html: html.replace('current@scopeanchor.test', 'retired@scopeanchor.test') };
assert.deepEqual(projectDeterministicContactFields({ ...run, results: [repeated], evidence_workspace: undefined }).emails_list,
  ['retired@scopeanchor.test'], 'a comment is not a global blacklist when the same value is genuinely published in a visible block');
console.log('PASS hidden/comment/script contacts and structured leaders cannot borrow stale flattened text; current visible contacts and raw evidence retained');
