import assert from 'node:assert/strict';
import { normalizeV1ContactOverlay } from '../../shared/v1_contact_contract';

const fact = { field: 'email', value: 'published@fixture.test', source_result_id: 'run-1-source',
  source_url: 'https://fixture.test/contact', quote: 'Contact published@fixture.test',
  scope: 'unknown', reason: 'COUNTRY_SCOPE_UNPROVEN', target_country: 'Kenya' };
// Repeated historical crawls change result IDs without creating a new fact/source.
// Repetition must not occupy the display budget and hide later distinct evidence.
const input = { unscoped_facts: [
  ...Array.from({ length: 250 }, (_, index) => ({ ...fact, source_result_id: `run-${index}-source` })),
  { ...fact, value: 'later@fixture.test', quote: 'Later published contact' },
  { ...fact, source_url: 'https://fixture.test/other-office' },
  { ...fact, target_country: 'South Sudan' },
  { ...fact, field: 'person' },
  { ...fact, quote: 'A changed source passage' },
] };
const original = JSON.stringify(input);
const result = normalizeV1ContactOverlay(input);
assert.equal(result.unscoped_facts.length, 6, 'repeat crawls collapse, distinct value/source/country/field/quote survive');
assert.equal(result.unscoped_facts[0].source_result_id, 'run-0-source', 'first immutable evidence reference remains');
assert.ok(result.unscoped_facts.some(item => item.value === 'later@fixture.test'), 'duplicates cannot starve later evidence');
assert.deepEqual(result.emails_list, [], 'withheld facts never become trusted local contacts');
assert.equal(JSON.stringify(input), original, 'normalization cannot change original evidence');
assert.deepEqual(normalizeV1ContactOverlay(JSON.parse(JSON.stringify(result))), result, 'persistence round-trip is idempotent');
const bounded = normalizeV1ContactOverlay({ unscoped_facts: Array.from({ length: 1000 }, (_, index) => ({ ...fact, value: `item-${index}` })) });
assert.equal(bounded.unscoped_facts.length, 200, 'unique display projection remains bounded');
console.log('PASS historical unscoped-fact deduplication, source distinctions, budget, round-trip and no promotion');

// Exercise the real historical projection over two immutable synthetic runs,
// not just the normalizer called in isolation.
const fs = await import('node:fs');
const os = await import('node:os');
const path = await import('node:path');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'edgeview-unscoped-history-'));
Object.assign(process.env, { EDGEVIEW_CONFIG: path.join(root, 'config.json'),
  EDGEVIEW_V1_DATA_DIR: path.join(root, 'runs'), EDGEVIEW_TEST_DB_DIR: root,
  EDGEVIEW_JSON_DB: path.join(root, 'dataset.json'), EDGEVIEW_SQLITE_DB: path.join(root, 'operational.db') });
fs.writeFileSync(process.env.EDGEVIEW_CONFIG!, '{}');
try {
  const { persistV1Run, getV1Run } = await import('../v1_engine');
  const { projectHistoricalContactFields } = await import('../job_manager');
  const runs = ['run-first', 'run-second'].map(id => ({ id, company_name: 'Scope Fixture Limited', country: 'Kenya', status: 'COMPLETED',
    started_at: '2026-01-01T00:00:00Z', queries: [], timeline: [], raw_records: [],
    limits: { max_queries: 4, max_results_per_query: 8, max_scrapes: 8, timeout_ms: 10000 },
    identity_resolution: { official_domain: 'fixture.test', confidence: 'high', candidates: [] },
    results: [{ id: `${id}-page`, run_id: id, raw_record_id: 'synthetic', query: '', provider: 'direct-http', rank: 1,
      title: '', url: fact.source_url, snippet: '', text: fact.quote, links: [], metadata: {}, search_latency_ms: 0, status: 'success' }] }));
  for (const run of runs) persistV1Run(run as any);
  const before = runs.map(run => JSON.stringify(getV1Run(run.id)));
  const historical = projectHistoricalContactFields(getV1Run('run-second')!);
  assert.equal(historical.unscoped_facts.filter(item => item.value === fact.value).length, 1, 'actual history does not repeat identical unscoped source facts');
  assert.equal(historical.email, '', 'actual history still abstains on the local mailbox');
  assert.deepEqual(runs.map(run => JSON.stringify(getV1Run(run.id))), before, 'both immutable historical captures remain unchanged');
  console.log('PASS real immutable history projection deduplicates without local-contact promotion or raw changes');
} finally { fs.rmSync(root, { recursive: true, force: true }); }
