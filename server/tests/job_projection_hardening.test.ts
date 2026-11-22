import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'edgeview-projection-hardening-'));
Object.assign(process.env, {
  EDGEVIEW_TEST_MODE: '1', EDGEVIEW_TEST_DB_DIR: root,
  EDGEVIEW_V1_DATA_DIR: path.join(root, 'runs'),
  EDGEVIEW_JSON_DB: path.join(root, 'dataset.json'),
  EDGEVIEW_SQLITE_DB: path.join(root, 'operations.db'),
  EDGEVIEW_CONFIG: path.join(root, 'config.json'),
});
fs.writeFileSync(process.env.EDGEVIEW_CONFIG!, '{}');

try {
  const { projectDeterministicContactFields, projectHistoricalContactFields } = await import('../job_manager');
  const { persistV1Run } = await import('../v1_engine');
  const { mergeContacts, normalizeContactInfo } = await import('../contact_report_model');
  const { computeTopProducts, getInternationalImporterDirectory } = await import('../international_importer_directory');

  const source = {
    id: 'quoted-role', run_id: 'quoted-role-run', raw_record_id: 'fixture', query: '', provider: 'direct-http', rank: 1,
    title: '', url: 'https://quote-scope.test/team', snippet: '', text: 'Kenya office\n张 伟, Managing Director',
    links: [], metadata: {}, search_latency_ms: 0, status: 'success' as const,
  };
  const forged = projectDeterministicContactFields({
    company_name: 'Quote Scope Medical', country: 'Kenya', results: [source],
    identity_resolution: { official_domain: 'quote-scope.test' } as any,
    evidence_workspace: { chunks: [], rejected_claims: [], accepted_claims: [{
      field: 'leader', value: '张 伟', role: 'Chief Executive Officer', source_result_id: source.id,
      source_url: source.url, source_type: 'official', quote: '张 伟, Managing Director',
    }] },
  } as any);
  assert.deepEqual(forged.contact_persons, [], 'an accepted claim cannot promote a role absent from its quote');
  const mismatchedQuote = projectDeterministicContactFields({
    company_name: 'Quote Scope Medical', country: 'Kenya',
    results: [{ ...source, text: 'Kenya office\n张 伟, Managing Director' }],
    identity_resolution: { official_domain: 'quote-scope.test' } as any,
    evidence_workspace: { chunks: [], rejected_claims: [], accepted_claims: [{
      field: 'leader', value: '张 伟', role: 'Managing Director', source_result_id: source.id,
      source_url: source.url, source_type: 'official', quote: 'Another Person, Managing Director',
    }] },
  } as any);
  assert.deepEqual(mismatchedQuote.contact_persons, [], 'accepted status cannot bypass exact value/quote validation');

  const oldPeople = [{ '@type': 'Person', name: '张 伟', jobTitle: 'Managing Director', address: { addressCountry: 'Kenya' } }];
  const oldRun: any = {
    id: 'run-projection-old', company_name: 'Cap History Medical', country: 'Kenya', status: 'COMPLETED',
    started_at: '2025-01-01T00:00:00.000Z', completed_at: '2025-01-01T00:00:01.000Z', queries: [], raw_records: [], timeline: [],
    limits: { max_queries: 4, max_results_per_query: 8, max_scrapes: 8, timeout_ms: 1000 },
    identity_resolution: { official_domain: 'cap-history.test', confidence: 'high', candidates: [] },
    results: [{ ...source, id: 'old-page', run_id: 'run-projection-old', url: 'https://cap-history.test/contact',
      text: 'Kenya office\ntrusted@cap-history.test', html: `<a href="mailto:trusted@cap-history.test">Email</a><script type="application/ld+json">${JSON.stringify(oldPeople)}</script>` }],
  };
  const currentEmails = Array.from({ length: 50 }, (_, index) => `current-${index}@cap-history.test`);
  const currentPeople = Array.from({ length: 50 }, (_, index) => ({
    '@type': 'Person', name: `Current Leader ${index + 1}`, jobTitle: 'Managing Director', address: { addressCountry: 'Kenya' },
  }));
  const currentRun: any = {
    ...oldRun, id: 'run-projection-current', started_at: '2026-01-01T00:00:00.000Z', completed_at: '2026-01-01T00:00:01.000Z',
    results: [{ ...source, id: 'current-page', run_id: 'run-projection-current', url: 'https://cap-history.test/contact',
      text: `Kenya office\n${currentEmails.join('\n')}`,
      html: `${currentEmails.map(email => `<a href="mailto:${email}">Email</a>`).join('')}<script type="application/ld+json">${JSON.stringify(currentPeople)}</script>` }],
  };
  persistV1Run(oldRun); persistV1Run(currentRun);
  const historical = await projectHistoricalContactFields(currentRun);
  assert.equal(historical.emails_list[0], 'trusted@cap-history.test', 'older trusted email survives a current 50-value cap');
  assert.equal(historical.contact_persons[0]?.name, '张 伟', 'older non-Latin leadership survives current-first cap pressure');
  assert.ok(historical.contact_persons.some(person => person.name === '张 伟'), 'Unicode leader keys are not erased');
  assert.equal(historical.contact_persons.length, 50);

  const unscoped = mergeContacts([
    { id: 'unknown-a', company_name: 'Unproven Medical', country: 'Unknown', email: 'a@unproven.test', contact_persons: [{ name: 'Alice Example' }] },
    { id: 'unknown-b', company_name: 'Unproven Medical', country: '', email: 'b@unproven.test', contact_persons: [{ name: 'Bob Example' }] },
  ] as any);
  assert.equal(unscoped.length, 2, 'missing/placeholder country cannot merge name-identical companies');
  assert.equal(unscoped[0].email, 'a@unproven.test');
  assert.equal(unscoped[1].email, 'b@unproven.test');
  const scoped = mergeContacts([
    { id: 'known-a', company_name: 'Proven Medical', country: 'Kenya', email: 'a@proven.test' },
    { id: 'known-b', company_name: 'PROVEN MEDICAL.', country: 'KE', phone: '+254204261000' },
  ] as any);
  assert.equal(scoped.length, 1, 'formatting aliases still merge only inside a proven country');

  const recurrence = computeTopProducts([
    { itemDescription: 'alpha product', shipmentCount: 2 },
    { itemDescription: 'beta product', shipmentCount: 6 },
  ]).split('\n');
  assert.deepEqual(recurrence, ['• beta product', '• alpha product'], 'Top Products uses shipment recurrence, not unique-description presence');

  const titled = normalizeContactInfo({ id: 'titled', company_name: 'Titled Sources', country: 'Kenya', sources: [
    { url: ' https://evidence.test/report ', title: ' Actual Evidence Title ' },
    { url: '', title: 'Title-only evidence' },
    { url: 'https://evidence.test/fallback' },
  ] } as any);
  assert.deepEqual(titled.sources, [
    { url: 'https://evidence.test/report', title: 'Actual Evidence Title' },
    { url: '', title: 'Title-only evidence' },
    { url: 'https://evidence.test/fallback' },
  ], 'real evidence titles survive without dropping URL/title fallbacks');
  const titledDirectory = await getInternationalImporterDirectory([
    { id: 'titled', company_name: 'Titled Sources', country: 'Kenya', sources: titled.sources },
  ] as any, { importedFrom: new Map(), suppliedTo: new Map() });
  assert.equal(titledDirectory.countrySections[0].importers[0].sources,
    'Sources: Actual Evidence Title — https://evidence.test/report; Title-only evidence; https://evidence.test/fallback');

  console.log('PASS quoted role/value defense, historical cap preservation, Unicode leaders, unscoped company abstention, product recurrence and source titles');
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
