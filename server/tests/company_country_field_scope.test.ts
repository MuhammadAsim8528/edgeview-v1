import assert from 'node:assert/strict';
import { projectDeterministicContactFields } from '../job_manager';
import { contactFactScope } from '../contact_country_scope';
import { detectExplicitCountryNames } from '../../src/utils/countryNormalizer';

// Synthetic, never-issued contacts; no providers, operational dataset or live
// runtime. Correctness assertions intentionally attack domain-only admission.
const page = (id: string, text: string) => ({ id, provider: 'direct-http', status: 'success',
  url: `https://scopeanchor.test/${id}`, title: '', text, links: [], metadata: {}, rank: 1 });
const project = (country: string, results: ReturnType<typeof page>[]) => projectDeterministicContactFields({
  company_name: 'Scopeanchor Medical', country,
  identity_resolution: { official_domain: 'scopeanchor.test' } as any,
  results: results as any,
});

const fixtures = [
  { name: 'Kenyan branch must not inherit Pakistan parent mailbox', country: 'Kenya',
    pages: [page('kenya', 'Scopeanchor Medical Kenya office\nNairobi, Kenya\nkenya@scopeanchor.test'),
      page('parent', 'Scopeanchor Medical Pakistan headquarters\nKarachi, Pakistan\nparent@scopeanchor.test')],
    allowed: ['kenya@scopeanchor.test'], forbidden: ['parent@scopeanchor.test'] },
  { name: 'Sudan must not match South Sudan by substring', country: 'Sudan',
    pages: [page('south-sudan', 'Scopeanchor Medical South Sudan\nJuba, South Sudan\nsouth@scopeanchor.test')],
    allowed: [], forbidden: ['south@scopeanchor.test'] },
  { name: 'one global page must not merge offices', country: 'Kenya',
    pages: [page('offices', 'Scopeanchor Medical\nKenya office\nNairobi, Kenya\nkenya@scopeanchor.test\nPakistan office\nKarachi, Pakistan\nparent@scopeanchor.test')],
    allowed: ['kenya@scopeanchor.test'], forbidden: ['parent@scopeanchor.test'] },
  { name: 'distributor reference must not become entity contact', country: 'Kenya',
    pages: [page('partner', 'Scopeanchor Medical Kenya distributor: Other Partner Limited\nContact distributor: partner@scopeanchor.test')],
    allowed: [], forbidden: ['partner@scopeanchor.test'] },
  { name: 'country words in a mailbox cannot override foreign source context', country: 'Kenya',
    pages: [page('foreign-identifiers', 'Pakistan headquarters\nkenya@scopeanchor.test')],
    allowed: [], forbidden: ['kenya@scopeanchor.test'] },
  { name: 'repeated country label does not turn a distributor into the entity', country: 'Kenya',
    pages: [page('partner-repeat', 'Kenya distributor: Other Partner Limited\nKenya\npartner@scopeanchor.test')],
    allowed: [], forbidden: ['partner@scopeanchor.test'] },
  { name: 'unscoped header contact on a multi-country page remains ambiguous', country: 'Kenya',
    pages: [page('ambiguous', 'General desk: global@scopeanchor.test\nKenya office\nPakistan office')],
    allowed: [], forbidden: ['global@scopeanchor.test'] },
];
let failed = 0;
for (const fixture of fixtures) {
  try {
    const before = JSON.stringify(fixture.pages);
    const result = project(fixture.country, fixture.pages);
    for (const value of fixture.forbidden) assert.ok(!result.emails_list.includes(value), fixture.name);
    for (const value of fixture.allowed) assert.ok(result.emails_list.includes(value), `preserve local evidence: ${fixture.name}`);
    for (const value of fixture.allowed) assert.ok(result.evidence.some(item => item.value === value && item.scope === 'local' && item.source_result_id), 'accepted local facts keep result provenance');
    assert.equal(JSON.stringify(fixture.pages), before, 'projection must not rewrite raw provider results');
    assert.equal(fixture.pages.length, fixture.name.includes('parent mailbox') ? 2 : 1, 'raw fixture preserved');
    console.log(`PASS ${fixture.name}`);
  } catch {
    failed++;
    console.error(`FAIL ${fixture.name}`);
  }
}
assert.equal(failed, 0, `${failed} country/relationship admission regressions remain`);
assert.equal(contactFactScope({ ...page('html', 'Scopeanchor Kenya summary'),
  html: '<h2>Pakistan headquarters</h2><a href="mailto:parent@scopeanchor.test">Email</a>' },
  'parent@scopeanchor.test', 'Kenya').scope, 'foreign', 'summary cannot override the HTML carrying the contact');
assert.equal(contactFactScope({ ...page('json', 'Scopeanchor Kenya summary'),
  html: '<script type="application/ld+json">{"addressCountry":"Pakistan","name":"Foreign Leader"}</script>' },
  'Foreign Leader', 'Kenya').scope, 'foreign', 'structured evidence context remains subject to country scope');

const offices = page('claims', 'Kenya office\nJane Makori, Director\n22 Acacia Road, Nairobi, Kenya\nPhone: 020 4455667\nPakistan office\nForeign Leader, Director\n10 Parent Road, Karachi, Pakistan\nPhone: 021 4455667');
const fields = projectDeterministicContactFields({ company_name: 'Scopeanchor Medical', country: 'Kenya',
  identity_resolution: { official_domain: 'scopeanchor.test' } as any, results: [offices] as any,
  evidence_workspace: { chunks: [], rejected_claims: [], accepted_claims: [
    { field: 'leader', value: 'Jane Makori', role: 'Director', quote: 'Jane Makori, Director' },
    { field: 'leader', value: 'Foreign Leader', role: 'Director', quote: 'Foreign Leader, Director' },
    { field: 'address', value: '22 Acacia Road, Nairobi, Kenya', quote: '22 Acacia Road, Nairobi, Kenya' },
    { field: 'address', value: '10 Parent Road, Karachi, Pakistan', quote: '10 Parent Road, Karachi, Pakistan' },
  ].map(claim => ({ ...claim, source_result_id: offices.id, source_url: offices.url, source_type: 'official' })) } as any,
});
assert.deepEqual(fields.contact_persons.map(person => person.name), ['Jane Makori']);
assert.deepEqual(fields.addresses, ['22 Acacia Road, Nairobi, Kenya']);
assert.deepEqual(fields.phones_list, ['020 4455667'], 'unprefixed foreign-office phones cannot pass through country compatibility alone');
assert.ok(!fields.evidence.some(item => String(item.value).includes('Foreign Leader')));
assert.deepEqual(detectExplicitCountryNames('Contact us in South Sudan and Papua New Guinea'), ['South Sudan', 'Papua New Guinea']);
assert.equal(contactFactScope(page('unknown', 'Contact us for details'), 'details', 'Kenya').scope, 'unknown', 'missing evidence must never be labelled local');
const parentHostedLocal = projectDeterministicContactFields({ company_name: 'Scopeanchor Medical', country: 'Kenya',
  identity_resolution: { official_domain: 'scopeanchor.pk' } as any,
  results: [{ ...page('kenya-parent-hosted', 'Scopeanchor Medical Kenya office\nkenya@scopeanchor.pk'), url: 'https://scopeanchor.pk/kenya' }] as any,
});
assert.deepEqual(parentHostedLocal.emails_list, ['kenya@scopeanchor.pk'], 'valid local evidence on a foreign parent domain remains usable');
console.log('PASS HTML/structured carrier, field-level leader/address/local-phone scope, provenance and raw preservation');
