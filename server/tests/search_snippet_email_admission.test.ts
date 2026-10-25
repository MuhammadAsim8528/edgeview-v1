import assert from 'node:assert/strict';
import type { V1Run, V1Result } from '../v1_engine';
import { projectDeterministicContactFields } from '../job_manager';

const base: V1Run = {
  id: 'run-search-snippet-email',
  company_name: 'Trustanchor Medical Limited',
  country: 'Kenya',
  status: 'COMPLETED',
  started_at: '2026-10-23T00:00:00.000Z',
  queries: [],
  results: [],
  raw_records: [],
  timeline: [],
  limits: { max_queries: 4, max_results_per_query: 8, max_scrapes: 8, timeout_ms: 10000 },
};

const result = (overrides: Partial<V1Result>): V1Result => ({
  id: 'result-default',
  run_id: base.id,
  raw_record_id: 'raw-default',
  query: 'Trustanchor Medical Limited Kenya contact information',
  provider: 'serper',
  rank: 1,
  title: 'Trustanchor Medical Limited Kenya Official Website',
  url: 'https://trustanchor.co.ke/contact',
  snippet: 'Trustanchor Medical Limited Kenya official contact information',
  links: [],
  metadata: {},
  search_latency_ms: 1,
  status: 'success',
  ...overrides,
});

base.results = [
  result({ id: 'official-search-result' }),
  result({
    id: 'partner-search-result',
    rank: 2,
    title: 'Partner directory - Trustanchor Medical Limited',
    url: 'https://partner.example/trustanchor-medical',
    snippet: 'Trustanchor Medical Limited Kenya contact: sales@trustanchor.co.ke. Partner desk: partner@partner.example.',
  }),
];

const projected = projectDeterministicContactFields(base);
assert.equal(projected.website, 'https://trustanchor.co.ke');
assert.ok(projected.emails_list.includes('sales@trustanchor.co.ke'), 'target-domain email found in a third-party search snippet should be retained');
assert.ok(!projected.emails_list.includes('partner@partner.example'), 'third-party-domain email from the same snippet must not contaminate the target company');

const official = base.results[0];
const projectSnippet = (snippet: string, overrides: Partial<V1Result> = {}) => projectDeterministicContactFields({
  ...base,
  results: [official, result({ id: 'probe', url: 'https://partner.example/profile', snippet, ...overrides })],
});
for (const status of ['failed', 'pending', 'skipped'] as const) {
  assert.deepEqual(projectSnippet('invalid@trustanchor.co.ke', { status }).emails_list, [], `${status} result is not contact evidence`);
}
assert.deepEqual(projectSnippet('Third-party help: unrelated.person@gmail.com').emails_list, [], 'a free-mail address on an arbitrary search page is not attributable to the target');
assert.deepEqual(projectSnippet('sales@trustanchor.co.ke.attacker.example').emails_list, [], 'suffix extension is not the official domain');
assert.deepEqual(projectSnippet('sales@nottrustanchor.co.ke').emails_list, [], 'substring domain is not ownership');
assert.deepEqual(projectSnippet('sales@trustanchor.co.ke', { status: undefined as any }).emails_list, [], 'unknown status must not become success');
assert.deepEqual(projectSnippet('sales@trustanchor.co.ke', { status: 'error' as any }).emails_list, [], 'malformed/legacy error status must not become success');
assert.deepEqual(projectSnippet('sales@trustanchor.co.ke', { status: 'timeout' as any }).emails_list, [], 'noncanonical timeout status must not become success');
const accepted = projectSnippet('SALES@TRUSTANCHOR.CO.KE sales@trustanchor.co.ke regional@sales.trustanchor.co.ke');
assert.deepEqual(accepted.emails_list, ['sales@trustanchor.co.ke', 'regional@sales.trustanchor.co.ke'], 'case, duplicates and legitimate company subdomains work');
const failedDomain = projectDeterministicContactFields({ ...base, results: [
  { ...official, status: 'failed' },
  result({ url: 'https://partner.example/profile', title: 'Partner directory', snippet: 'sales@trustanchor.co.ke' }),
] });
assert.equal(failedDomain.website, '', 'failed result cannot establish official-domain ownership');
assert.deepEqual(failedDomain.emails_list, [], 'successful snippet cannot borrow domain authority from a failed result');

const officialFreeMail = projectDeterministicContactFields({ ...base, results: [official, result({
  provider: 'direct-http', url: 'https://trustanchor.co.ke/contact', snippet: '', text: 'Kenya office contact: published.company@gmail.com',
})] });
assert.ok(officialFreeMail.emails_list.includes('published.company@gmail.com'), 'explicitly published official-site free-mail contact remains supported');
const unscopedFreeMail = projectDeterministicContactFields({ ...base, results: [official, result({
  provider: 'direct-http', url: 'https://trustanchor.co.ke/contact', snippet: '', text: 'Contact us: published.company@gmail.com',
})] });
assert.deepEqual(unscopedFreeMail.emails_list, [], 'local-domain ownership does not replace missing field-country evidence');
assert.ok(unscopedFreeMail.unscoped_facts.some(fact => fact.value === 'published.company@gmail.com'));
assert.equal(base.results.length, 2, 'projection does not erase raw result history');
console.log('PASS snippet admission: successful company-domain evidence only; failed/unknown results, unrelated free-mail and lookalike domains rejected; official-page free-mail preserved');
