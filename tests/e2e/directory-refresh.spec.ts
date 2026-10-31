import { test, expect } from './fixtures';

test('directory revisits request current contacts after enrichment rather than retaining a stale projection', async ({ page, context, runtime }) => {
  await context.route('**/*', route => new URL(route.request().url()).origin === runtime.baseURL ? route.continue() : route.abort('blockedbyclient'));
  await page.route('**/api/runtime/state', async route => {
    const response = await route.fetch(); const body = await response.json();
    body.capabilities.company_enrichment = { available: true, status: 'READY', reason: 'Synthetic test' };
    await route.fulfill({ response, json: body });
  });
  let updated = false;
  let unavailable = false;
  let directoryReads = 0;
  await page.route('**/api/international-importer-directory', async route => {
    directoryReads++;
    if (unavailable) { await route.fulfill({ status: 503, json: { error: 'Synthetic directory failure' } }); return; }
    const response = await route.fetch(); const body = await response.json();
    for (const section of body.countrySections) for (const row of section.importers) row.address = updated ? 'New synthetic Kenyan office' : 'Original synthetic Kenyan office';
    await route.fulfill({ response, json: body });
  });
  await page.route('**/api/enrich/company', async route => {
    updated = true;
    await route.fulfill({ json: { success: true, run: { id: 'synthetic-directory-run', status: 'COMPLETED' } } });
  });
  await runtime.identity();
  await page.goto('/');
  const upload = page.waitForResponse(r => r.url().endsWith('/api/files/upload') && r.request().method() === 'POST');
  await page.locator('#file-upload-input').setInputFiles({ name: 'directory-refresh.csv', mimeType: 'text/csv', buffer: Buffer.from('Date,Importer,Country,Exporter,Item,TOT_FC\n2026-01-01,Directory Buyer,Kenya,Supplier,Product,10\n') });
  expect((await upload).status()).toBe(201);
  await page.locator('#nav-tab-contacts').click();
  await page.getByRole('button', { name: 'Intl Directory', exact: true }).click();
  await expect(page.getByText('Original synthetic Kenyan office', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Full Table', exact: true }).click();
  await page.getByRole('button', { name: 'Importers', exact: true }).click();
  await page.locator('tbody tr').filter({ hasText: 'Directory Buyer' }).getByRole('button', { name: 'Fetch Details', exact: true }).click();
  await expect(page.getByText('V1 enrichment completed for Directory Buyer', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Intl Directory', exact: true }).click();
  await expect(page.getByText('New synthetic Kenyan office', { exact: true })).toBeVisible();
  await expect(page.getByText('Original synthetic Kenyan office', { exact: true })).toHaveCount(0);
  expect(directoryReads).toBeGreaterThanOrEqual(2);
  unavailable = true;
  await page.getByRole('button', { name: 'Full Table', exact: true }).click();
  await page.getByRole('button', { name: 'Intl Directory', exact: true }).click();
  await expect(page.getByText('Unable to load directory.', { exact: true })).toBeVisible();
  unavailable = false;
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.getByText('New synthetic Kenyan office', { exact: true })).toBeVisible();
});
