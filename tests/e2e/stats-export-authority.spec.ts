import { test, expect, EXPORT_ARTIFACT_TIMEOUT_MS } from './fixtures';

test('importer analytics download keeps stored file/country/product/value authority', async ({ page, context, request, runtime }) => {
  await context.route('**/*', route => new URL(route.request().url()).origin === runtime.baseURL ? route.continue() : route.abort('blockedbyclient'));
  await runtime.identity(); await page.goto('/');
  const uploaded = page.waitForResponse(r => r.url().endsWith('/api/files/upload') && r.request().method() === 'POST');
  await page.locator('#file-upload-input').setInputFiles({ name: 'stats-export-authority.csv', mimeType: 'text/csv', buffer: Buffer.from('Date,Importer,Country,Exporter,Item,TOT_FC\n2026-01-01,Shared Buyer,Kenya,Local Supplier,LOCALMED,50\n2026-01-02,Shared Buyer,Pakistan,Foreign Supplier,FOREIGNMED,900\n') });
  const response = await uploaded; expect(response.status()).toBe(201); const uploadedBody = await response.json(); const id = uploadedBody.data?.id || uploadedBody.id;
  const otherResponse = await request.post('/api/files/upload', { multipart: { file: { name: 'stats-other.csv', mimeType: 'text/csv', buffer: Buffer.from('Date,Importer,Country,Exporter,Item,TOT_FC\n2026-01-03,Shared Buyer,Kenya,Other Supplier,OTHERFILEMED,1000\n') } } });
  expect(otherResponse.status()).toBe(201); const otherBody = await otherResponse.json(); const otherId = otherBody.data?.id || otherBody.id;
  await page.locator('#nav-tab-stats').click();
  const country = page.locator('select').filter({ has: page.locator('option[value="Kenya"]') });
  await country.selectOption('Kenya');
  await expect(page.getByText('LOCALMED', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('FOREIGNMED', { exact: true })).toHaveCount(0);
  // Editing a pending date range must not silently change the scope of the
  // displayed results; Apply Range owns that transition.
  await page.getByRole('button', { name: 'Custom Range', exact: true }).click();
  await page.locator('input[type="date"]').first().fill('2027-01-01');
  await page.getByRole('button', { name: 'Export Full History & Invoices', exact: true }).click();
  const submitted = page.waitForRequest(r => r.url().endsWith('/api/export') && r.method() === 'POST');
  const downloading = page.waitForEvent('download', { timeout: EXPORT_ARTIFACT_TIMEOUT_MS });
  await page.getByRole('button', { name: 'Proceed / Export', exact: true }).click();
  const sent = (await submitted).postDataJSON();
  const stream = await (await downloading).createReadStream(); const parts: Buffer[] = []; for await (const part of stream!) parts.push(Buffer.from(part));
  const text = Buffer.concat(parts).toString('utf8');
  expect(text).toContain('LOCALMED'); expect(text).toContain('50.00'); expect(text).not.toContain('FOREIGNMED'); expect(text).not.toContain('OTHERFILEMED');
  expect(sent.source_file_ids).toEqual([id]); expect(sent).not.toHaveProperty('records');
  expect(sent.filters.startDate).toBe('');
  const combined = await request.post('/api/export', { data: { ...sent, source_file_ids: [id, otherId] } });
  expect(combined.status()).toBe(200); const combinedText = await combined.text(); expect(combinedText).toContain('OTHERFILEMED'); expect(combinedText).not.toContain('FOREIGNMED');
  const all = await request.post('/api/export', { data: { ...sent, filters: { ...sent.filters, country: 'ALL' } } });
  expect(all.status()).toBe(200); expect(await all.text()).toContain('FOREIGNMED');
  for (const patch of [{ source_file_ids: [] }, { source_file_ids: [id, 'missing'] }, { source_file_ids: [id, id] }, { records: [{ importer: 'FORGED' }] }, { selectedRows: [] }, { filters: { ...sent.filters, importer: '' } }, { filters: { ...sent.filters, country: ['Kenya'] } }, { filters: { ...sent.filters, unknown: 'x' } }, { filters: { ...sent.filters, startDate: '2026-02-30' } }]) {
    const bad = await request.post('/api/export', { data: { ...sent, ...patch } });
    expect(bad.status()).toBe(400); expect((await bad.json()).code).toBe('INVALID_EXPORT_REQUEST');
  }
  const noMatch = await request.post('/api/export', { data: { ...sent, filters: { ...sent.filters, startDate: '2027-01-01' } } });
  expect(noMatch.status()).toBe(400);
  const retired = await request.post('/api/export', { data: { dataset: 'outreach', format: 'csv', report_type: 'importer',
    records: [{ company_name: 'FORGED', country: 'Kenya', type: 'Importer', email: 'forged@example.test' }] } });
  expect(retired.status()).toBe(410); expect((await retired.json()).code).toBe('RETIRED_EXPORT_DATASET');
});
