import { test, expect, EXPORT_ARTIFACT_TIMEOUT_MS } from './fixtures';
import JSZip from 'jszip';

test('an incomplete all-formats response is not downloaded as success and a real retry succeeds', async ({ page, context, request, runtime }) => {
  await context.route('**/*', route => new URL(route.request().url()).origin === runtime.baseURL ? route.continue() : route.abort('blockedbyclient'));
  const created = await request.post('/api/reports/upload', { data: { title: 'Synthetic retry', report_type: 'table', columns: ['Product'], rows: [{ Product: 'RETRY_SAVED_MARKER' }] } });
  expect(created.status()).toBe(201);
  const partial = new JSZip(); partial.file('Synthetic.csv', 'Product\nRETRY_SAVED_MARKER');
  const partialBytes = await partial.generateAsync({ type: 'nodebuffer' });
  let intercepted = 0;
  await page.route('**/api/export', async route => {
    if (intercepted++ === 0) {
      await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'SYNTHETIC_PRIVATE_STORAGE_PATH' }) });
    } else if (intercepted === 2) {
      await route.fulfill({ status: 200, headers: { 'Content-Type': 'application/zip', 'Content-Disposition': 'attachment; filename="Synthetic.zip"', 'X-Export-Failed-Formats': 'PDF' }, body: partialBytes });
    } else await route.continue();
  });
  let downloads = 0; page.on('download', () => downloads++);
  await page.goto('/'); await page.locator('#nav-tab-reports').click();
  await page.getByRole('button', { name: 'Export Report', exact: true }).click();
  await page.locator('input[name="export_format"][value="all"]').check();
  await page.getByRole('button', { name: 'Proceed / Export', exact: true }).click();
  await expect(page.getByText('Export Failed', { exact: true })).toBeVisible();
  await expect(page.getByText('Export server error (HTTP 500)', { exact: true })).toBeVisible();
  await expect(page.getByText('SYNTHETIC_PRIVATE_STORAGE_PATH')).toHaveCount(0);
  expect(downloads).toBe(0);
  await page.getByRole('button', { name: 'Proceed / Export', exact: true }).click();
  await expect(page.getByText('Export incomplete: one or more requested formats could not be generated. Retry, or export an individual format.', { exact: true })).toBeVisible();
  expect(downloads).toBe(0);
  await expect(page.getByText('Export completed successfully!', { exact: true })).not.toBeVisible();
  const download = page.waitForEvent('download', { timeout: EXPORT_ARTIFACT_TIMEOUT_MS });
  await page.getByRole('button', { name: 'Proceed / Export', exact: true }).click();
  const stream = await (await download).createReadStream(); const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const complete = await JSZip.loadAsync(Buffer.concat(chunks));
  for (const extension of ['csv', 'pdf', 'docx', 'xlsx']) expect(Object.keys(complete.files).some(name => name.endsWith('.' + extension))).toBe(true);
  expect(downloads).toBe(1);
  expect(runtime.outboundAttempts()).toBe(0);
});
