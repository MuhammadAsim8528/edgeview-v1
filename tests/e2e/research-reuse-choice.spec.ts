import { test, expect } from './fixtures';

test('research choices send saved-only or explicit live intent and never retain live mode on reopen', async ({ page, context, runtime }) => {
  await context.route('**/*', route => new URL(route.request().url()).origin === runtime.baseURL ? route.continue() : route.abort('blockedbyclient'));
  await page.addInitScript(() => { localStorage.setItem('edgeview_contacts_view', 'table'); localStorage.setItem('edgeview_contacts_filter', 'ALL'); });
  await page.route('**/api/runtime/state', async route => {
    const response = await route.fetch(), body = await response.json();
    body.capabilities.company_enrichment.available = true;
    body.capabilities.evidence_revalidation.available = true;
    await route.fulfill({ response, json: body });
  });
  await page.route('**/api/companies', async route => {
    const response = await route.fetch(), contacts = await response.json();
    await route.fulfill({ response, json: contacts.map(contact => ({ ...contact, can_revalidate_evidence: contact.company_name === 'Synthetic Choice Buyer' })) });
  });
  const single: Array<{ forceFetch: boolean; reuseOnly: boolean }> = [];
  await page.route('**/api/enrich/company', route => {
    const body = route.request().postDataJSON(); single.push(body);
    return route.fulfill({ json: { success: true, reused_evidence: body.reuseOnly, reuse_assessment: { captured_at: null, compatibility: 'unverified', freshness: 'not_live_verified' }, run: { id: 'run-choice-synthetic', status: 'COMPLETED' } } });
  });
  const batches: Array<{ forceFetch: boolean; reuseOnly: boolean }> = [];
  await page.route('**/api/enrich/jobs', route => {
    if (route.request().method() !== 'POST') return route.continue();
    batches.push(route.request().postDataJSON());
    return route.fulfill({ status: 503, json: { success: false, message: 'Synthetic creation refusal; no job started.' } });
  });
  page.on('dialog', dialog => dialog.accept());
  await page.goto('/');
  const uploaded = page.waitForResponse(response => response.url().endsWith('/api/files/upload') && response.request().method() === 'POST');
  await page.locator('#file-upload-input').setInputFiles({ name: 'choice.csv', mimeType: 'text/csv', buffer: Buffer.from('Date,Importer,Country,Exporter,Item,TOT_FC\n2026-10-01,Synthetic Choice Buyer,Kenya,Synthetic Supplier,Product,1\n') });
  expect((await uploaded).status()).toBe(201);
  await page.locator('#nav-tab-contacts').click(); await page.getByRole('button', { name: 'Importers', exact: true }).click();
  const row = page.locator('tbody tr').filter({ hasText: 'Synthetic Choice Buyer' });
  await row.getByRole('button', { name: 'Recheck Saved', exact: true }).click();
  await expect.poll(() => single.length).toBe(1); expect(single[0].reuseOnly).toBe(true); expect(single[0].forceFetch).toBe(false);
  await expect(page.getByText(/saved evidence rechecked; capture date unknown; not checked live/)).toBeVisible();
  await row.getByRole('button', { name: 'Force Fetch', exact: true }).click();
  await expect.poll(() => single.length).toBe(2); expect(single[1].forceFetch).toBe(true); expect(single[1].reuseOnly).toBe(false);
  await page.getByRole('button', { name: 'Research Companies', exact: true }).click();
  const mode = page.getByRole('combobox', { name: 'Research mode', exact: true });
  await expect(mode).toHaveValue('recent');
  for (const value of ['recent', 'saved', 'live']) {
    await mode.selectOption(value);
    await expect(page.getByRole('button', { name: 'Enrich Selection (0)', exact: true })).toBeDisabled();
    await page.getByRole('button', { name: /^Single Company/ }).click();
    const created = page.waitForResponse(response => response.url().endsWith('/api/enrich/jobs') && response.request().method() === 'POST');
    await page.getByRole('button', { name: 'Enrich Selection (1)', exact: true }).click();
    expect((await created).status()).toBe(503);
    const sent = batches[batches.length - 1]; expect(sent.reuseOnly).toBe(value === 'saved'); expect(sent.forceFetch).toBe(value === 'live');
  }
  await page.getByRole('button', { name: 'Close batch enrichment', exact: true }).click();
  await page.getByRole('button', { name: 'Research Companies', exact: true }).click();
  await expect(mode).toHaveValue('recent');
  expect(runtime.outboundAttempts()).toBe(0);
});

test('restored live intent stays visible before resume', async ({ page, context, runtime }) => {
  await context.route('**/*', route => new URL(route.request().url()).origin === runtime.baseURL ? route.continue() : route.abort('blockedbyclient'));
  await page.route('**/api/runtime/state', async route => { const response = await route.fetch(), body = await response.json(); body.capabilities.company_enrichment.available = true; await route.fulfill({ response, json: body }); });
  const job = { id: 'synthetic-live-resume', status: 'STOPPED', importer_exporter_mode: 'importer', total_companies: 1, completed_companies: 0,
    current_company: '', current_stage: 'Queued', company_ids: ['synthetic'], company_states: { synthetic: { id: 'synthetic', name: 'Synthetic Buyer', status: 'pending', stage: 'Queued', force_live: true, reuse_policy_version: 1, resourceUsage: {} } }, resource_usage: {} };
  await page.route('**/api/enrich/job/active', route => route.fulfill({ json: { success: true, job } }));
  await page.route('**/api/enrich/job/synthetic-live-resume', route => route.fulfill({ json: { success: true, job } }));
  await page.route('**/api/enrich/job/synthetic-live-resume/progress', route => route.fulfill({ json: { success: true, progress: { ...job, recent_results: [] } } }));
  let resumeRequests = 0;
  await page.route('**/api/enrich/job/synthetic-live-resume/start', route => { resumeRequests++; expect(route.request().postDataJSON().forceFetch).toBe(false); return route.fulfill({ status: 503, json: { success: false, error: 'Synthetic resume refusal' } }); });
  await page.goto('/'); await page.locator('#nav-tab-contacts').click(); await page.getByRole('button', { name: 'Research Companies', exact: true }).click();
  await expect(page.getByText('Live refresh was requested. Resuming may use provider quota.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Resume from Checkpoint', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Could not resume research.');
  expect(resumeRequests).toBe(1);
  await expect(page.getByText('Live refresh was requested. Resuming may use provider quota.', { exact: true })).toBeVisible();
  expect(runtime.outboundAttempts()).toBe(0);
});
