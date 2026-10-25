import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import https from 'node:https';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'edgeview-batch-revalidate-'));
Object.assign(process.env, { NODE_ENV: 'test', EDGEVIEW_TEST_DB_DIR: root,
  EDGEVIEW_JSON_DB: path.join(root, 'dataset.json'), EDGEVIEW_SQLITE_DB: path.join(root, 'operational.db'),
  EDGEVIEW_CONFIG: path.join(root, 'config.json'), EDGEVIEW_V1_DATA_DIR: path.join(root, 'runs') });
fs.writeFileSync(process.env.EDGEVIEW_CONFIG!, '{}');
const originalHttp = http.request; const originalHttps = https.request; const originalFetch = globalThis.fetch;
let requests = 0;
const refuse = () => { requests++; throw new Error('unexpected-network-request-in-offline-revalidation'); };
(http as any).request = refuse; (https as any).request = refuse; globalThis.fetch = refuse as any;
try {
  const { db } = await import('../db');
  const { getDb, resetDbInstanceForTests } = await import('../sqlite');
  const { persistV1Run } = await import('../v1_engine');
  const { createJob, runJobLoop, getJob, isJobActive, stopJobsForShutdown } = await import('../job_manager');
  const { canonicalEntityIdentityKey } = await import('../company_identity');
  const contact = { id: 'synthetic-cached-branch', company_name: 'Scopeanchor Medical', country: 'Kenya', type: 'Importer',
    email: '', phone: '', edgeview_v1_run_id: 'run-revalidate', research_validation_status: 'needs_revalidation' } as any;
  db.contacts.clear(); db.contacts.set(contact.id, contact); db.rebuildIndexes();
  persistV1Run({ id: 'run-revalidate', company_name: contact.company_name, country: 'Kenya', status: 'COMPLETED',
    started_at: '2026-01-01T00:00:00Z', queries: [], timeline: [], raw_records: [],
    limits: { max_queries: 4, max_results_per_query: 8, max_scrapes: 8, timeout_ms: 10000 },
    identity_resolution: { official_domain: 'scopeanchor.test', confidence: 'high', candidates: [] },
    results: [{ id: 'local-contact', run_id: 'run-revalidate', raw_record_id: 'fixture', query: '', provider: 'direct-http', rank: 1,
      title: '', url: 'https://scopeanchor.test/kenya', snippet: '', text: 'Kenya office\nkenya@scopeanchor.test',
      links: [], metadata: {}, search_latency_ms: 0, status: 'success' }] });
  const jobId = await createJob([contact.id], 'importer');
  assert.equal(await runJobLoop(jobId), true);
  const deadline = Date.now() + 10_000;
  while (isJobActive(jobId) && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(isJobActive(jobId), false, 'offline revalidation must terminate');
  const job = await getJob(jobId);
  assert.equal(job?.status, 'COMPLETED');
  assert.equal(contact.email, 'kenya@scopeanchor.test', 'ordinary reuse must actually reproject the withheld cache');
  assert.equal(contact.research_validation_status, 'current');
  assert.equal(requests, 0, 'stored evidence revalidation must not consume provider/network calls');
  const database = await getDb();
  const row = await database.get('SELECT overlay_json FROM v1_contact_enrichment WHERE company_id = ?', [contact.id]);
  assert.equal(JSON.parse(row.overlay_json).entity_key, canonicalEntityIdentityKey(contact.company_name, contact.country));
  const originalRun = database.run.bind(database);
  contact.research_validation_status = 'needs_revalidation';
  contact.email = 'dataset-seed@scopeanchor.test';
  database.run = async (sql: string, params?: any[]) => {
    if (sql.includes('INSERT INTO v1_contact_enrichment')) throw new Error('synthetic ENOSPC during overlay revalidation');
    return originalRun(sql, params);
  };
  try {
    const failedId = await createJob([contact.id], 'importer');
    await runJobLoop(failedId);
    const failedDeadline = Date.now() + 10_000;
    while (isJobActive(failedId) && Date.now() < failedDeadline) await new Promise(resolve => setTimeout(resolve, 20));
    assert.equal((await getJob(failedId))?.status, 'FAILED', 'storage failure cannot be reported as completed revalidation');
    assert.equal(contact.email, 'dataset-seed@scopeanchor.test', 'failed durable write cannot replace the prior contact projection');
    assert.equal(contact.research_validation_status, 'needs_revalidation');
    assert.equal(requests, 0);
  } finally { database.run = originalRun; }
  await stopJobsForShutdown(); await database.flush(); resetDbInstanceForTests();
  console.log('PASS actual offline batch revalidation, durable entity binding, zero network and failed-write preservation');
} finally {
  http.request = originalHttp; https.request = originalHttps; globalThis.fetch = originalFetch;
  assert.equal(path.dirname(fs.realpathSync(root)), fs.realpathSync(os.tmpdir()));
  fs.rmSync(root, { recursive: true, force: true });
}
