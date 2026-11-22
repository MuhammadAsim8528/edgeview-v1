import { test, expect } from './fixtures';

test('directory revisits use the real refreshed backend projection rather than a stale or mocked success', async ({ page, context, runtime }) => {
  await context.route('**/*', route => new URL(route.request().url()).origin === runtime.baseURL ? route.continue() : route.abort('blockedbyclient'));
  await page.route('**/api/runtime/state', async route => {
    const response = await route.fetch(); const body = await response.json();
    body.capabilities.company_enrichment = { available: true, status: 'READY', reason: 'Synthetic test' };
    await route.fulfill({ response, json: body });
  });
  let unavailable = false;
  let directoryReads = 0;
  await page.route(url => url.pathname === '/api/international-importer-directory', async route => {
    directoryReads++;
    if (unavailable) { await route.fulfill({ status: 503, json: { error: 'Synthetic directory failure' } }); return; }
    await route.continue();
  });
  await page.route('**/api/enrich/company', async route => {
    await route.fulfill({ json: { success: true, run: { id: 'synthetic-directory-run', status: 'COMPLETED' } } });
  });
  const directoryResponse = () => page.waitForResponse(response => new URL(response.url()).pathname === '/api/international-importer-directory' && response.request().method() === 'GET');
  await runtime.identity();
  await page.goto('/');
  const upload = page.waitForResponse(r => r.url().endsWith('/api/files/upload') && r.request().method() === 'POST');
  await page.locator('#file-upload-input').setInputFiles({ name: 'directory-refresh.csv', mimeType: 'text/csv', buffer: Buffer.from('Date,Importer,Country,Exporter,Item,TOT_FC\n2026-01-01,Directory Buyer,Kenya,First Supplier,First Product,10\n') });
  expect((await upload).status()).toBe(201);
  await page.locator('#nav-tab-contacts').click();
  const initialResponse = directoryResponse();
  await page.getByRole('button', { name: 'Intl Directory', exact: true }).click();
  expect((await initialResponse).status()).toBe(200);
  const initialBody = await (await initialResponse).json();
  expect(JSON.stringify(initialBody)).toContain('First Supplier');
  expect(JSON.stringify(initialBody)).toContain('First Product');
  expect(JSON.stringify(initialBody)).not.toContain('Second Supplier');
  await expect(page.getByText('First Supplier', { exact: false }).first()).toBeVisible();

  await page.getByRole('button', { name: 'Full Table', exact: true }).click();
  await page.getByRole('button', { name: 'Importers', exact: true }).click();
  await page.locator('tbody tr').filter({ hasText: 'Directory Buyer' }).getByRole('button', { name: 'Fetch Details', exact: true }).click();
  await expect(page.getByText('V1 enrichment completed for Directory Buyer', { exact: true })).toBeVisible();

  // Change the real stored trade relationship. The following directory response
  // must prove the backend rebuilt it; no response-body rewriting is permitted.
  const secondUpload = page.waitForResponse(r => r.url().endsWith('/api/files/upload') && r.request().method() === 'POST');
  await page.locator('#file-upload-input').setInputFiles({ name: 'directory-refresh-second.csv', mimeType: 'text/csv', buffer: Buffer.from('Date,Importer,Country,Exporter,Item,TOT_FC\n2026-01-02,Directory Buyer,Kenya,Second Supplier,Second Product,20\n') });
  expect((await secondUpload).status()).toBe(201);
  const refreshedResponse = directoryResponse();
  await page.getByRole('button', { name: 'Intl Directory', exact: true }).click();
  expect((await refreshedResponse).status()).toBe(200);
  const refreshedBody = await (await refreshedResponse).json();
  for (const marker of ['First Supplier', 'First Product', 'Second Supplier', 'Second Product']) expect(JSON.stringify(refreshedBody)).toContain(marker);
  await expect(page.getByText('Second Supplier', { exact: false }).first()).toBeVisible();
  expect(directoryReads).toBeGreaterThanOrEqual(2);

  unavailable = true;
  await page.getByRole('button', { name: 'Full Table', exact: true }).click();
  await page.getByRole('button', { name: 'Intl Directory', exact: true }).click();
  await expect(page.getByText('Unable to load directory.', { exact: true })).toBeVisible();
  unavailable = false;
  const retryResponse = directoryResponse();
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  expect((await retryResponse).status()).toBe(200);
  await expect(page.getByText('Second Supplier', { exact: false }).first()).toBeVisible();
});
