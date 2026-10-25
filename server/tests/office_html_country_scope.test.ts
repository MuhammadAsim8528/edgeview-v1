import assert from 'node:assert/strict';
import { projectDeterministicContactFields } from '../job_manager';
import { contactFactScope } from '../contact_country_scope';

// Real-world shape: a global office accordion with a flattened provider text
// carrier and full HTML retaining the actual office blocks. Entirely synthetic.
const html = `<html><body><nav>Kenya Pakistan</nav>
<section><h2>Pakistan</h2><div><span>Address:</span>10 Parent Road, Karachi, Pakistan</div>
<div><span>Tel:</span>+92 21 111 222 333</div><p>parent@scopeanchor.test</p></section>
<section><h2>Kenya</h2><div><span>Address:</span>20 Fixture Road,
Nairobi, Kenya</div><div><span>Tel:</span>+254 20 444 5555</div><p>branch@scopeanchor.test</p></section>
<footer><p>Pakistan headquarters</p><p>parent@scopeanchor.test</p></footer></body></html>`;
const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
const source = { id: 'office-source', provider: 'direct-http', status: 'success', url: 'https://scopeanchor.test/contact',
 title: '', snippet: '', text, html, links: [], metadata: {}, rank: 1 };
const run = { company_name: 'Scopeanchor Medical', country: 'Kenya',
 identity_resolution: { official_domain: 'scopeanchor.test' }, results: [source] } as any;
const projected = projectDeterministicContactFields(run);
assert.deepEqual(projected.emails_list, ['branch@scopeanchor.test'], 'flattening must not erase local office attribution');
assert.deepEqual(projected.phones_list, ['+254 20 444 5555'], 'local phone survives and foreign parent phone cannot mix');
assert.deepEqual(projected.addresses, ['20 Fixture Road, Nairobi, Kenya'], 'labelled HTML office address reaches scoped projection');
assert.equal(contactFactScope(source, 'parent@scopeanchor.test', 'Kenya').scope, 'foreign');
assert.ok(projected.evidence.some(item => item.field === 'phone' && item.scope === 'local' && item.source_result_id === source.id));
const raw = JSON.stringify(run);
projectDeterministicContactFields(run);
assert.equal(JSON.stringify(run), raw, 'country projection never modifies raw evidence');
console.log('PASS accordion office boundaries survive flattened text; local email/phone/address and foreign parent separation');
