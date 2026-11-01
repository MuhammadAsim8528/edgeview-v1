import assert from 'node:assert/strict';
import { projectDeterministicContactFields } from '../job_manager';
import { visibleHtmlText } from '../html_evidence';

const html = `<nav>Kenya Pakistan</nav><section>
<strong>Head Office</strong><p>20 Fixture Road, Nairobi<br>Kenya.</p>
<strong>Warehouse Complex</strong><p>667 Supply Road, Industrial District<br>Kenya.</p>
<strong>Regional Office</strong><p>40 Parent Road, Karachi<br>Pakistan.</p>
<strong>Warehouse Complex</strong><p>We delivered 2026 successful orders.</p>
<strong>Warehouse Complex</strong><p>90 Unscoped Road, Somewhere</p>
<!-- <strong>Warehouse Complex</strong><p>30 Old Road, Nairobi, Kenya.</p> -->
<h3>Distributor: Different Company</h3><strong>Warehouse Complex</strong><p>50 Distributor Road, Nairobi, Kenya.</p>
</section>`;
const source = { id: 'offices', provider: 'direct-http', status: 'success', rank: 1,
  url: 'https://scopeanchor.test/contact-us.php', html, text: visibleHtmlText(html), links: [], metadata: {} };
const run = { company_name: 'Scopeanchor Medical', country: 'Kenya',
  identity_resolution: { official_domain: 'scopeanchor.test' }, results: [source],
  evidence_workspace: { accepted_claims: [{ field: 'address', value: '20 Fixture Road, Nairobi Kenya',
    source_result_id: source.id, source_url: source.url, source_type: 'official', quote: '20 Fixture Road, Nairobi Kenya.' }] } } as any;
const before = JSON.stringify(run);
const projected = projectDeterministicContactFields(run);
assert.deepEqual(projected.addresses, ['20 Fixture Road, Nairobi Kenya.', '667 Supply Road, Industrial District Kenya.'],
  'ordinary office labels must yield actual local addresses without foreign, distributor, unscoped, inventory or commented blocks');
assert.ok(projected.evidence.filter(item => item.field === 'address').every(item => item.source_result_id === source.id && item.scope === 'local'));
assert.equal(JSON.stringify(run), before);
const wrappedHtml = `<nav>Kenya Pakistan</nav><section>
<div><div><h3><a href="tel:+254204261000">Head Office</a></h3></div></div>
<p><span>25 Fixture Road, Nairobi, Kenya.</span></p>
<div><h3>Regulatory and Tender Office</h3></div><p>26 Fixture Road, Nairobi, Kenya.</p>
<h3>Corporate Office</h3><p>27 Fixture Gardens, Nairobi, Kenya.</p>
<h3>Head Office</h3></div><h3>Distributor: Different Company</h3><p>28 Foreign Road, Nairobi, Kenya.</p>
<h3>Branch Office</h3></div><div><p>29 Separated Road, Nairobi, Kenya.</p></div>
<h3>Regional Office</h3></div><p>30 Parent Road, Karachi, Pakistan.</p>
<h3>Head Office</h3></div></div></div></div><p>31 Overbound Road, Nairobi, Kenya.</p>
<h3>Head Office</h3></div><nav>Unrelated navigation</nav><p>32 Navigation Road, Nairobi, Kenya.</p>
<!-- <h3>Head Office</h3></div><p>33 Retired Road, Nairobi, Kenya.</p> -->
<h3>Regional Office</h3></div><p>34 Unscoped Road, Somewhere</p>
</section>`;
const wrappedRun = { ...run, evidence_workspace: undefined, results: [{ ...source, html: wrappedHtml, text: visibleHtmlText(wrappedHtml) }] };
const wrapped = projectDeterministicContactFields(wrappedRun);
assert.deepEqual(wrapped.addresses, ['25 Fixture Road, Nairobi, Kenya.', '26 Fixture Road, Nairobi, Kenya.', '27 Fixture Gardens, Nairobi, Kenya.'],
  'bounded closing layout wrappers preserve labelled offices but never cross a new heading/open container or foreign country');
assert.ok(wrapped.evidence.filter(item => item.field === 'address').every(item => item.scope === 'local' && item.source_result_id === source.id));
console.log('PASS ordinary labelled office/warehouse paragraphs reach local evidence-backed addresses; other-entity/country/hidden/non-address blocks abstain');
