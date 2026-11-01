import { test, expect, EXPORT_ARTIFACT_TIMEOUT_MS } from './fixtures';

test.use({ historyFaultInjection: true });

test('a real history-read failure refuses partial export, hides private details and recovers on retry', async ({ page, context, runtime }) => {
  await context.route('**/*', route => new URL(route.request().url()).origin === runtime.baseURL ? route.continue() : route.abort('blockedbyclient'));
  let downloads = 0; page.on('download', () => downloads++);
  await page.goto('/');
  const uploaded = page.waitForResponse(r => r.url().endsWith('/api/files/upload') && r.request().method() === 'POST');
  await page.locator('#file-upload-input').setInputFiles({ name: 'synthetic-history-failure.csv', mimeType: 'text/csv', buffer: Buffer.from('Date,Importer,Country,Exporter,Item,TOT_FC\n2026-01-01,Synthetic History Buyer Δ,Kenya,Synthetic Supplier,PRODUCT_A,1\n2026-01-02,Synthetic History Buyer Δ,Kenya,Synthetic Supplier,PRODUCT_B,2\n') });
  expect((await uploaded).status()).toBe(201);
  await page.locator('#nav-tab-contacts').click();
  await page.getByRole('button', { name: 'Importers', exact: true }).click();
  await expect(page.locator('tbody tr').filter({ hasText: 'Synthetic History Buyer Δ' })).toBeVisible();
  await page.getByRole('button', { name: 'Export Report', exact: true }).click();
  runtime.historyReadFailure(true);
  const failure = page.waitForResponse(r => new URL(r.url()).pathname === '/api/export' && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Proceed / Export', exact: true }).click();
  const response = await failure;
  expect(response.status()).toBe(500);
  const body = await response.json();
  expect(body.code).toBe('EXPORT_FAILED');
  expect(JSON.stringify(body)).not.toContain('SYNTHETIC_PRIVATE_HISTORY_FAILURE');
  await expect(page.getByText('Export Failed', { exact: true })).toBeVisible();
  await expect(page.getByText('Export server error (HTTP 500)', { exact: true })).toBeVisible();
  expect(downloads).toBe(0);
  runtime.historyReadFailure(false);
  const download = page.waitForEvent('download', { timeout: EXPORT_ARTIFACT_TIMEOUT_MS });
  await page.getByRole('button', { name: 'Proceed / Export', exact: true }).click();
  const stream = await (await download).createReadStream(); const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const csv = Buffer.concat(chunks).toString('utf8');
  for (const value of ['Synthetic History Buyer Δ', 'PRODUCT_A', 'PRODUCT_B', '2 shp']) expect(csv).toContain(value);
  expect(downloads).toBe(1);
  expect(runtime.outboundAttempts()).toBe(0);
});
