import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { V1Run, V1Result } from '../v1_engine';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'edgeview-history-preservation-'));
process.env.EDGEVIEW_V1_DATA_DIR = root;
try {
  const { persistV1Run } = await import('../v1_engine');
  const { projectHistoricalContactFields, projectDeterministicContactFields } = await import('../job_manager');
  const base: V1Run = {
    id: 'run-trusted-history', company_name: 'Trustanchor Medical Limited', country: 'Kenya', status: 'COMPLETED',
    started_at: '2025-01-01T00:00:00.000Z', queries: [], results: [], raw_records: [], timeline: [],
    limits: { max_queries: 3, max_results_per_query: 8, max_scrapes: 8, timeout_ms: 10000 },
  };
  const result: V1Result = {
    id: 'trusted-result', run_id: base.id, raw_record_id: 'synthetic-fixture', query: 'Trustanchor Medical Limited Kenya',
    provider: 'serper', rank: 1, title: 'Trustanchor Medical Limited Kenya Official Website',
    url: 'https://trustanchor.co.ke/contact', snippet: 'Trustanchor Medical Limited Kenya official contact',
    links: [], metadata: {}, search_latency_ms: 1, status: 'success',
  };
  const html = '<a href="mailto:info@trustanchor.co.ke">Email</a><a href="tel:+254207658432">Call</a>'
    + '<script type="application/ld+json">{"@type":"Organization","address":{"streetAddress":"22 Acacia Road","addressLocality":"Nairobi","addressCountry":"Kenya"},"employee":{"@type":"Person","name":"Jane Makori","jobTitle":"Managing Director"}}</script>';
  base.results = [result, { ...result, id: 'official-page', provider: 'direct-http', html,
    text: 'Trustanchor Medical Limited Kenya Phone: +254207658432 Email: info@trustanchor.co.ke',
    links: ['https://www.linkedin.com/company/trustanchor-medical/'] }];
  const strong = projectDeterministicContactFields(base);
  assert.equal(strong.website, 'https://trustanchor.co.ke');
  assert.ok(strong.addresses.length && strong.contact_persons.length && strong.social_links.length);
  persistV1Run(base);
  for (let i = 0; i < 25; i += 1) persistV1Run({ ...base, id: `run-weak-history-${i}`, started_at: `2026-01-${String(i + 1).padStart(2,'0')}T00:00:00.000Z`, status: 'FAILED', results: [] });
  persistV1Run({ ...base, id: 'run-other-country', country: 'Uganda', results: [] });
  const projected = projectHistoricalContactFields({ ...base, id: 'run-current-weak', status: 'FAILED', started_at: '2026-10-19T00:00:00.000Z', results: [] });
  assert.equal(projected.website, strong.website, '25 later weak runs must not erase a trusted official site');
  assert.deepEqual(projected.emails_list, strong.emails_list);
  assert.deepEqual(projected.phones_list, strong.phones_list);
  assert.equal(projected.addresses[0].address, strong.addresses[0]);
  assert.equal(projected.contact_persons[0].name, 'Jane Makori');
  assert.ok(projected.socials.some(item => /linkedin/.test(item.url)));
  const otherCountry = projectHistoricalContactFields({ ...base, id: 'run-uganda-weak', country: 'Uganda', results: [] });
  assert.equal(otherCountry.emails_list.length, 0, 'historical evidence must remain country-isolated');
  console.log('PASS historical website, email, phone, address, leadership and social evidence survives 25 weak refreshes with country isolation.');
} finally { delete process.env.EDGEVIEW_V1_DATA_DIR; fs.rmSync(root, { recursive: true, force: true }); }
