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
console.log('PASS attributable target-domain emails from search snippets are admitted while unrelated third-party emails remain excluded.');
