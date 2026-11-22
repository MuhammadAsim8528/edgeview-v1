import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import https from 'node:https';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'edgeview-job-lifecycle-hardening-'));
Object.assign(process.env, {
  NODE_ENV: 'test', EDGEVIEW_TEST_MODE: '1', EDGEVIEW_TEST_DB_DIR: root,
  EDGEVIEW_JSON_DB: path.join(root, 'dataset.json'), EDGEVIEW_SQLITE_DB: path.join(root, 'operations.db'),
  EDGEVIEW_CONFIG: path.join(root, 'config.json'), EDGEVIEW_V1_DATA_DIR: path.join(root, 'runs'),
});
fs.writeFileSync(process.env.EDGEVIEW_CONFIG!, '{}');
const originalFetch = globalThis.fetch;
const originalHttpRequest = http.request;
const originalHttpsRequest = https.request;
const noProvider = () => { throw new Error('UNEXPECTED_PROVIDER_REQUEST_IN_JOB_FIXTURE'); };
(globalThis as any).fetch = noProvider;
(http as any).request = noProvider; (https as any).request = noProvider;
const releases: Array<() => void> = [];
let stopAllJobs: (() => Promise<void>) | undefined;
const pause = (ms = 40) => new Promise(resolve => setTimeout(resolve, ms));

try {
  const { db } = await import('../db');
  const { getDb, resetDbInstanceForTests } = await import('../sqlite');
  const { persistV1Run, createV1ResearchContext } = await import('../v1_engine');
  const {
    createJob, getJob, runJobLoop, stopJob, isJobActive, isJobDraining, updateJob, withContactPublication,
    getJobsCountByStatus, getLatestActiveJob, stopJobsForShutdown, persistV1ContactOverlay,
  } = await import('../job_manager');
  stopAllJobs = stopJobsForShutdown;
  db.files.clear(); db.contacts.clear(); db.rebuildIndexes();
  const database = await getDb();
  const addContact = (id: string, name: string, country = 'Kenya') => {
    const contact: any = { id, company_name: name, country, type: 'Importer', email: '', phone: '', last_updated: '' };
    db.contacts.set(id, contact); db.rebuildIndexes();
    return contact;
  };
  const retainFreshRun = (contact: any, runId: string) => {
    const completed = new Date().toISOString();
    const domain = `${runId}.test`;
    contact.edgeview_v1_run_id = runId;
    contact.research_validation_status = 'needs_revalidation';
    persistV1Run({
      id: runId, company_name: contact.company_name, country: contact.country, status: 'COMPLETED',
      started_at: new Date(Date.now() - 1000).toISOString(), completed_at: completed,
      research_context: createV1ResearchContext('bulk'), queries: [], raw_records: [], timeline: [],
      limits: { max_queries: 4, max_results_per_query: 8, max_scrapes: 8, timeout_ms: 1000 },
      identity_resolution: { official_domain: domain, confidence: 'high', candidates: [] },
      results: [{ id: `${runId}-page`, run_id: runId, raw_record_id: 'fixture', query: '', provider: 'direct-http', rank: 1,
        title: '', url: `https://${domain}/contact`, snippet: '', text: `Kenya office\n${runId}@${domain}`,
        links: [], metadata: {}, search_latency_ms: 0, status: 'success' }],
    });
  };
  const waitInactive = async (jobId: string) => {
    for (const deadline = Date.now() + 20_000; Date.now() < deadline;) {
      if (!isJobActive(jobId) && !isJobDraining(jobId)) return;
      await pause(20);
    }
    throw new Error(`job ${jobId} did not drain`);
  };

  // Resolved contact.id is the work/publication key, not caller-controlled case.
  const caseContact = addContact('CaseSensitiveContact', 'Case Contact');
  const caseJob = await createJob([caseContact.id.toUpperCase(), caseContact.id], 'importer');
  assert.equal((await getJob(caseJob))?.total_companies, 1, 'case variants cannot create duplicate job work');
  assert.deepEqual((await getJob(caseJob))?.company_ids, [caseContact.id]);
  await persistV1ContactOverlay(caseContact.id.toUpperCase(), 'run-case-contact', { emails_list: [] });
  assert.equal((await database.get('SELECT company_id FROM v1_contact_enrichment WHERE company_id = ?', [caseContact.id]))?.company_id,
    caseContact.id, 'overlay storage uses the resolved canonical contact ID');
  let releasePublication!: () => void;
  const publicationGate = new Promise<void>(resolve => { releasePublication = resolve; });
  releases.push(releasePublication);
  const publicationOrder: string[] = [];
  const firstPublication = withContactPublication(caseContact.id.toUpperCase(), async () => {
    publicationOrder.push('first'); await publicationGate;
  });
  await pause();
  const secondPublication = withContactPublication(caseContact.id, async () => { publicationOrder.push('second'); });
  await pause();
  assert.deepEqual(publicationOrder, ['first'], 'same resolved contact remains serialized across ID casing');
  releasePublication(); await Promise.all([firstPublication, secondPublication]);
  assert.deepEqual(publicationOrder, ['first', 'second']);

  // Placeholder countries fail before any live research can be admitted.
  const placeholder = addContact('placeholder-country', 'Placeholder Country Medical', 'Unknown');
  const placeholderJob = await createJob([placeholder.id], 'importer');
  assert.equal(await runJobLoop(placeholderJob), true); await waitInactive(placeholderJob);
  const placeholderState = (await getJob(placeholderJob))!.company_states[placeholder.id];
  assert.equal(placeholderState.status, 'failed');
  assert.match(placeholderState.error || '', /Exact country is required/);
  assert.ok(!Number.isNaN(Date.parse(placeholderState.completedAt || '')), 'failed work gets its own terminal timestamp');
  assert.equal(placeholder.edgeview_v1_run_id, undefined);

  // A stopped job's in-flight checkpoint remains STOPPED throughout the drain.
  const stoppedContact = addContact('stopped-contact', 'Stopped Contact');
  retainFreshRun(stoppedContact, 'run-stopped-contact');
  const stoppedJob = await createJob([stoppedContact.id], 'importer');
  const originalSave = database.saveContactOverlayDurably.bind(database);
  let releaseStopped!: () => void;
  const stoppedGate = new Promise<void>(resolve => { releaseStopped = resolve; });
  releases.push(releaseStopped);
  let stoppedEntered!: () => void;
  const stoppedStarted = new Promise<void>(resolve => { stoppedEntered = resolve; });
  database.saveContactOverlayDurably = async (...args) => {
    stoppedEntered(); await stoppedGate; return originalSave(...args);
  };
  assert.equal(await runJobLoop(stoppedJob), true); await stoppedStarted;
  const originalRun = database.run.bind(database);
  const statusesAfterStop: string[] = [];
  let stopObserved = false;
  database.run = async (sql: string, params: any[] = []) => {
    if (stopObserved && /UPDATE research_jobs/i.test(sql)) statusesAfterStop.push(String(params?.[0] || ''));
    return originalRun(sql, params);
  };
  await stopJob(stoppedJob); stopObserved = true; releaseStopped(); await waitInactive(stoppedJob);
  database.run = originalRun; database.saveContactOverlayDurably = originalSave;
  assert.equal((await getJob(stoppedJob))?.status, 'STOPPED');
  assert.ok(!statusesAfterStop.includes('DISCOVERING'), `STOPPED was overwritten by ${statusesAfterStop.join(',')}`);
  const stoppedState = (await getJob(stoppedJob))!.company_states[stoppedContact.id];
  assert.ok(!Number.isNaN(Date.parse(stoppedState.completedAt || '')),
    `cached terminal work records completedAt once: ${JSON.stringify(stoppedState)}`);

  // One rejected publication must not release ownership before its sibling drains.
  const rejectedContact = addContact('rejected-contact', 'Rejected Contact');
  const siblingContact = addContact('sibling-contact', 'Sibling Contact');
  retainFreshRun(rejectedContact, 'run-rejected-contact'); retainFreshRun(siblingContact, 'run-sibling-contact');
  const drainJob = await createJob([rejectedContact.id, siblingContact.id], 'importer');
  let releaseSibling!: () => void;
  const siblingGate = new Promise<void>(resolve => { releaseSibling = resolve; });
  releases.push(releaseSibling);
  let siblingEntered!: () => void;
  const siblingStarted = new Promise<void>(resolve => { siblingEntered = resolve; });
  let rejected = false;
  database.saveContactOverlayDurably = async (companyId, ...args) => {
    if (companyId === rejectedContact.id) {
      await siblingStarted; rejected = true; throw new Error('SYNTHETIC_SIBLING_REJECTION');
    }
    if (companyId === siblingContact.id) { siblingEntered(); await siblingGate; }
    return originalSave(companyId, ...args);
  };
  assert.equal(await runJobLoop(drainJob), true);
  for (const deadline = Date.now() + 5000; !rejected && Date.now() < deadline;) await pause(10);
  assert.equal(rejected, true, 'first sibling reached its injected rejection');
  await pause(100);
  assert.equal(isJobActive(drainJob), true, 'ownership is retained while the rejected worker sibling is still draining');
  releaseSibling(); await waitInactive(drainJob);
  database.saveContactOverlayDurably = originalSave;
  assert.equal((await getJob(drainJob))?.status, 'FAILED');
  const drainedStates = (await getJob(drainJob))!.company_states;
  assert.equal(drainedStates[siblingContact.id].status, 'completed', 'sibling publication completed before final failure');
  assert.ok(!Number.isNaN(Date.parse(drainedStates[siblingContact.id].completedAt || '')));
  assert.equal('completedAt' in drainedStates[rejectedContact.id], false, 'unfinished work has no terminal timestamp');

  // Force refresh durably resets terminal states before a crash can interrupt work.
  const refreshContact = addContact('refresh-contact', 'Refresh Contact');
  const refreshJob = await createJob([refreshContact.id], 'importer');
  const oldTerminal = (await getJob(refreshJob))!.company_states[refreshContact.id];
  oldTerminal.status = 'completed'; oldTerminal.stage = 'Previously complete'; oldTerminal.completedAt = '2025-01-01T00:00:00.000Z';
  await updateJob(refreshJob, { status: 'COMPLETED', completed_companies: 1, company_states: { [refreshContact.id]: oldTerminal } }, true);
  let injectedCrash = false;
  database.run = async (sql: string, params: any[] = []) => {
    if (!injectedCrash && /UPDATE research_jobs/i.test(sql) && params?.includes('Starting bounded V1 worker pool')) {
      injectedCrash = true; throw new Error('SYNTHETIC_POST_RESET_CRASH');
    }
    return originalRun(sql, params);
  };
  assert.equal(await runJobLoop(refreshJob, true), true); await waitInactive(refreshJob);
  database.run = originalRun;
  const recovered = (await getJob(refreshJob))!;
  assert.equal(injectedCrash, true);
  assert.equal(recovered.company_states[refreshContact.id].status, 'pending', 'crash recovery sees pending forced work, not old completion');
  assert.equal(recovered.company_states[refreshContact.id].force_live, true);
  assert.equal(recovered.completed_companies, 0);
  assert.equal('completedAt' in recovered.company_states[refreshContact.id], false);
  assert.equal(await runJobLoop(refreshJob), true); await waitInactive(refreshJob);
  const resumed = (await getJob(refreshJob))!.company_states[refreshContact.id];
  assert.notEqual(resumed.stage, 'Previously complete', 'ordinary resume performs the durable forced-live work');
  assert.match(resumed.stage, /V1/);
  assert.ok(resumed.completedAt && resumed.completedAt !== '2025-01-01T00:00:00.000Z');

  // Database failures remain truthful API errors, never zero counts or null jobs.
  const originalGet = database.get.bind(database);
  database.get = async () => { throw new Error('SYNTHETIC_JOB_DB_FAILURE'); };
  try {
    await assert.rejects(getJobsCountByStatus(), /SYNTHETIC_JOB_DB_FAILURE/);
    await assert.rejects(getLatestActiveJob(), /SYNTHETIC_JOB_DB_FAILURE/);
  } finally { database.get = originalGet; }

  await stopJobsForShutdown(); await database.flush(); resetDbInstanceForTests();
  console.log('PASS publication identity, placeholder refusal, stop/checkpoint, sibling drain, forced crash resume, terminal timestamps and DB errors');
} finally {
  for (const release of releases) release();
  try { await stopAllJobs?.(); } catch { /* the primary assertion reports a failed drain */ }
  (globalThis as any).fetch = originalFetch;
  (http as any).request = originalHttpRequest; (https as any).request = originalHttpsRequest;
  fs.rmSync(root, { recursive: true, force: true });
}
