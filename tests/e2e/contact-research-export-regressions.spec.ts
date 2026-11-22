import { test, expect, EXPORT_ARTIFACT_TIMEOUT_MS } from './fixtures';
import type { Page } from '@playwright/test';

const company = (id: string, name: string, type = 'Importer', runId?: string) => ({
  id, company_name: name, type, country: 'Kenya', quality_status: 'COMPLETE',
  email: `${id}@example.test`, emails_list: [`${id}@example.test`], phones_list: [],
  contact_persons: [], socials: [], sources: [], evidence: [],
  can_revalidate_evidence: false, ...(runId ? { edgeview_v1_run_id: runId } : {}),
});

async function openSyntheticContacts(page: Page, contacts: any[]) {
  await page.addInitScript(() => {
    localStorage.setItem('edgeview_contacts_filter', 'ALL');
    localStorage.setItem('edgeview_contacts_view', 'table');
  });
  await page.route('**/api/companies', route => route.fulfill({ json: contacts }));
  await page.route('**/api/runtime/state', async route => {
    const response = await route.fetch();
    const body = await response.json();
    body.capabilities.company_enrichment.available = true;
    await route.fulfill({ response, json: body });
  });
  await page.goto('/');
  await page.locator('#nav-tab-contacts').click();
  await expect(page.getByRole('button', { name: 'All companies', exact: true })).toBeVisible();
}

function boundedProgress(job: any, recentResults: any[] = []) {
  return {
    id: job.id, status: job.status, importer_exporter_mode: job.importer_exporter_mode,
    total_companies: job.total_companies, completed_companies: job.completed_companies,
    current_company: job.current_company, current_stage: job.current_stage,
    resource_usage: job.resource_usage, recent_results: recentResults,
  };
}

test.beforeEach(async ({ context, runtime }) => {
  await context.route('**/*', route => new URL(route.request().url()).origin === runtime.baseURL ? route.continue() : route.abort('blockedbyclient'));
});

test('M15 selected contact export retains selected IDs hidden by the current filter', async ({ page }) => {
  const contacts = [company('buyer-id', 'Visible Buyer'), company('supplier-id', 'Hidden Supplier', 'Exporter')];
  await openSyntheticContacts(page, contacts);
  for (const name of ['Visible Buyer', 'Hidden Supplier']) {
    await page.locator('tbody tr').filter({ hasText: name }).getByRole('button').first().click();
  }
  await page.getByPlaceholder('Search company, CEO, email...').fill('Visible Buyer');
  await expect(page.locator('tbody tr').filter({ hasText: 'Hidden Supplier' })).toHaveCount(0);
  await expect(page.getByText('2 companies selected for batch action', { exact: true })).toBeVisible();
  let exportedIds: string[] = [];
  await page.route('**/api/export', route => {
    const body = route.request().postDataJSON();
    exportedIds = body.records.map((record: { id: string }) => record.id);
    return route.fulfill({ status: 200, headers: { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="selected.csv"' }, body: 'Company\nVisible Buyer\nHidden Supplier' });
  });
  await page.getByRole('button', { name: 'Export Selected', exact: true }).click();
  await expect(page.getByText('Selected Records:', { exact: true })).toBeVisible();
  const downloading = page.waitForEvent('download', { timeout: EXPORT_ARTIFACT_TIMEOUT_MS });
  await page.getByRole('button', { name: 'Proceed / Export', exact: true }).click();
  await downloading;
  expect(new Set(exportedIds)).toEqual(new Set(['buyer-id', 'supplier-id']));
  expect(exportedIds).toHaveLength(2);
});

test('M18 batch hydration keeps duplicate names on their own IDs and switching jobs clears prior rows', async ({ page }) => {
  await openSyntheticContacts(page, [company('contact-a', 'Configuration Buyer')]);
  const state = (id: string, name: string, status: string, emailsFound: number) => ({
    id, name, status, stage: status === 'completed' ? 'Done' : 'Queued', resourceUsage: {},
    metrics: { emailsFound, phonesFound: 0, socialsFound: 0, leadershipFound: false, websiteFound: false },
  });
  const jobA = { id: 'job-a', status: 'DISCOVERING', importer_exporter_mode: 'importer', total_companies: 2, completed_companies: 1,
    current_company: 'Same Company', current_stage: 'Researching', company_ids: ['a-1', 'a-2'], resource_usage: {},
    company_states: { 'a-1': state('a-1', 'Same Company', 'pending', 1), 'a-2': state('a-2', 'Same Company', 'completed', 2) } };
  const jobB = { id: 'job-b', status: 'COMPLETED', importer_exporter_mode: 'importer', total_companies: 1, completed_companies: 1,
    current_company: 'Job B Company', current_stage: 'Done', company_ids: ['b-1'], resource_usage: {},
    company_states: { 'b-1': state('b-1', 'Job B Company', 'completed', 3) } };
  await page.route('**/api/enrich/job/active', route => route.fulfill({ json: { success: true, job: null } }));
  await page.route('**/api/enrich/jobs', route => route.request().method() === 'GET'
    ? route.fulfill({ json: { success: true, jobs: [jobA, jobB] } }) : route.continue());
  await page.route('**/api/enrich/job/job-a', route => route.fulfill({ json: { success: true, job: jobA } }));
  await page.route('**/api/enrich/job/job-a/progress', route => route.fulfill({ json: { success: true,
    progress: boundedProgress(jobA, [{ name: 'Same Company', status: 'completed', stage: 'Done', metrics: { emailsFound: 2 }, resourceUsage: {} }]) } }));
  let releaseB: () => void = () => {};
  const bWaiting = new Promise<void>(resolve => { releaseB = resolve; });
  await page.route('**/api/enrich/job/job-b/progress', async route => {
    await bWaiting;
    await route.fulfill({ json: { success: true, progress: boundedProgress(jobB) } });
  });
  await page.route('**/api/enrich/job/job-b', route => route.fulfill({ json: { success: true, job: jobB } }));
  await page.getByRole('button', { name: 'Research Companies', exact: true }).click();
  await page.getByRole('button', { name: /RESEARCH JOB HISTORIES/ }).click();
  await page.getByText('job-a', { exact: true }).click();
  const duplicateRows = page.locator('tbody tr').filter({ hasText: 'Same Company' });
  await expect(duplicateRows).toHaveCount(2);
  await expect(duplicateRows.nth(0)).toContainText('PENDING');
  await expect(duplicateRows.nth(0)).toContainText('📧 1');
  await expect(duplicateRows.nth(1)).toContainText('COMPLETED');
  await expect(duplicateRows.nth(1)).toContainText('📧 2');
  await page.getByText('job-b', { exact: true }).click();
  await expect(page.getByText('Same Company', { exact: true })).toHaveCount(0);
  releaseB();
  await expect(page.getByText('Job B Company', { exact: true })).toBeVisible();
  await expect(page.getByText('Same Company', { exact: true })).toHaveCount(0);
});

test('M19 a late captured run A cannot replace run B', async ({ page }) => {
  await openSyntheticContacts(page, [company('contact-a', 'Company A', 'Importer', 'run-a'), company('contact-b', 'Company B', 'Importer', 'run-b')]);
  await page.evaluate(() => {
    const original = window.fetch.bind(window);
    (window as any).__resolveRunA = () => {};
    window.fetch = (input, init) => {
      const url = new URL(input instanceof Request ? input.url : String(input), window.location.href);
      if (url.pathname === '/api/v1/runs/run-a') {
        return new Promise<Response>(resolve => {
          (window as any).__resolveRunA = () => resolve(Response.json({ run: { id: 'run-a', results: [{ id: 'a-result', raw_record_id: 'a-raw', provider: 'Synthetic', rank: 1,
            title: 'RUN_A_ONLY', url: '', snippet: 'Late A', status: 'captured' }], raw_records: [] } }));
        });
      }
      if (url.pathname === '/api/v1/runs/run-b') {
        return Promise.resolve(Response.json({ run: { id: 'run-b', results: [{ id: 'b-result', raw_record_id: 'b-raw', provider: 'Synthetic', rank: 1,
          title: 'RUN_B_ONLY', url: '', snippet: 'Current B', status: 'captured' }], raw_records: [] } }));
      }
      return original(input, init);
    };
  });
  await page.locator('tbody tr').filter({ hasText: 'Company A' }).getByRole('button', { name: 'View Intelligence', exact: true }).click();
  await page.getByRole('button', { name: 'All Captured Results', exact: true }).click();
  await expect(page.getByText('Loading the complete retained run…', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Close research hub', exact: true }).click();
  await page.locator('tbody tr').filter({ hasText: 'Company B' }).getByRole('button', { name: 'View Intelligence', exact: true }).click();
  await page.getByRole('button', { name: 'All Captured Results', exact: true }).click();
  await expect(page.getByText('RUN_B_ONLY', { exact: true })).toBeVisible();
  await page.evaluate(async () => {
    (window as any).__resolveRunA();
    await new Promise(requestAnimationFrame);
    await new Promise(requestAnimationFrame);
  });
  await expect(page.getByText('RUN_B_ONLY', { exact: true })).toBeVisible();
  await expect(page.getByText('RUN_A_ONLY', { exact: true })).toHaveCount(0);
});

test('M23 export cancellation aborts immediately and a late response cannot download or close a retry', async ({ page }) => {
  await openSyntheticContacts(page, [company('buyer-id', 'Export Buyer')]);
  await page.evaluate(() => {
    const original = window.fetch.bind(window);
    const probe = { calls: 0, aborted: 0, resolvers: [] as Array<() => void> };
    (window as any).__exportProbe = probe;
    window.fetch = (input, init) => {
      const url = new URL(input instanceof Request ? input.url : String(input), window.location.href);
      if (url.pathname !== '/api/export') return original(input, init);
      probe.calls += 1;
      return new Promise<Response>(resolve => {
        probe.resolvers.push(() => resolve(new Response('Company\nExport Buyer', { status: 200,
          headers: { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="export.csv"' } })));
        init?.signal?.addEventListener('abort', () => { probe.aborted += 1; }, { once: true });
      });
    };
  });
  let downloads = 0;
  page.on('download', () => { downloads += 1; });
  await page.getByRole('button', { name: 'Export Report', exact: true }).click();
  await page.getByRole('button', { name: 'Proceed / Export', exact: true }).click();
  await page.getByRole('button', { name: 'Cancel Export', exact: true }).click();
  await expect(page.getByText('Export cancelled. No download was saved. You can adjust the export options or retry.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Proceed / Export', exact: true })).toBeEnabled();
  expect(await page.evaluate(() => (window as any).__exportProbe.aborted)).toBe(1);
  await page.getByRole('button', { name: 'Proceed / Export', exact: true }).click();
  await expect(page.getByText('Exporting...', { exact: true })).toBeVisible();
  await page.evaluate(async () => {
    (window as any).__exportProbe.resolvers[0]();
    await new Promise(requestAnimationFrame);
    await new Promise(requestAnimationFrame);
  });
  expect(downloads).toBe(0);
  await expect(page.getByText('Exporting...', { exact: true })).toBeVisible();
  const downloading = page.waitForEvent('download', { timeout: EXPORT_ARTIFACT_TIMEOUT_MS });
  await page.evaluate(() => (window as any).__exportProbe.resolvers[1]());
  await downloading;
  expect(downloads).toBe(1);
});

test('M23 export deadline releases controls even when the aborted transport never settles', async ({ page }) => {
  await page.clock.install();
  await openSyntheticContacts(page, [company('buyer-id', 'Deadline Buyer')]);
  await page.evaluate(() => {
    const original = window.fetch.bind(window);
    (window as any).__exportDeadlineAborted = false;
    window.fetch = (input, init) => {
      const url = new URL(input instanceof Request ? input.url : String(input), window.location.href);
      if (url.pathname !== '/api/export') return original(input, init);
      return new Promise<Response>(() => {
        init?.signal?.addEventListener('abort', () => { (window as any).__exportDeadlineAborted = true; }, { once: true });
      });
    };
  });
  await page.getByRole('button', { name: 'Export Report', exact: true }).click();
  await page.getByRole('button', { name: 'Proceed / Export', exact: true }).click();
  await page.clock.fastForward(120_100);
  await expect(page.getByText('Export timed out after 2 minutes. No download was saved. Try a smaller selection or a single format.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Proceed / Export', exact: true })).toBeEnabled();
  expect(await page.evaluate(() => (window as any).__exportDeadlineAborted)).toBe(true);
});

test('L09 checked-only presets never turn an empty selection into every company', async ({ page }) => {
  await openSyntheticContacts(page, [company('buyer-id', 'Preset Buyer'), company('supplier-id', 'Preset Supplier', 'Exporter')]);
  await page.route('**/api/enrich/job/active', route => route.fulfill({ json: { success: true, job: null } }));
  await page.getByRole('button', { name: 'Research Companies', exact: true }).click();
  for (const preset of ['Selected Importers', 'Selected Exporters']) {
    await page.getByRole('button', { name: new RegExp('^' + preset) }).click();
    await expect(page.getByRole('button', { name: 'Enrich Selection (0)', exact: true })).toBeDisabled();
    await expect(page.getByText('Selected: 0', { exact: true })).toBeVisible();
  }
});

test('L07 backend loss replaces the running claim with truthful offline status', async ({ page, request, runtime }) => {
  const response = await request.get(`${runtime.baseURL}/api/runtime/state`);
  const state = await response.json();
  state.enrichment = { ...state.enrichment, status: 'DISCOVERING', currentCompany: 'Offline Buyer', completedCompanies: 2, totalCompanies: 4 };
  await page.clock.install();
  await page.addInitScript(({ state }) => {
    const original = window.fetch.bind(window);
    let runtimeCalls = 0;
    window.fetch = (input, init) => {
      const url = new URL(input instanceof Request ? input.url : String(input), window.location.href);
      if (url.pathname !== '/api/runtime/state') return original(input, init);
      runtimeCalls += 1;
      if (runtimeCalls === 1) return Promise.resolve(Response.json(state));
      return new Promise<Response>(() => {});
    };
  }, { state });
  await page.goto('/');
  await expect(page.getByText('Company Research Running', { exact: true })).toBeVisible();
  await page.clock.fastForward(20_100);
  await expect(page.getByText('Research Status Unavailable', { exact: true })).toBeVisible();
  await expect(page.getByText('Company Research Running', { exact: true })).toHaveCount(0);
  await expect(page.getByText('OFFLINE', { exact: true })).toBeVisible();
  await expect(page.getByText(/Counts above are the last confirmed snapshot, not live running status/)).toBeVisible();
});
