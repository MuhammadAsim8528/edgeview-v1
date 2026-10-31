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
console.log('PASS ordinary labelled office/warehouse paragraphs reach local evidence-backed addresses; other-entity/country/hidden/non-address blocks abstain');
