import { test, expect } from './fixtures';

test('a stalled export unlocks the dialog and a real retry downloads the complete dataset', async ({ page, context, runtime }, testInfo) => {
  test.setTimeout(110_000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await context.route('**/*', route => new URL(route.request().url()).origin === runtime.baseURL ? route.continue() : route.abort('blockedbyclient'));
  await runtime.identity();
  try {
    await page.goto('/');
    const uploaded = page.waitForResponse(response => response.url().endsWith('/api/files/upload') && response.request().method() === 'POST');
    await page.locator('#file-upload-input').setInputFiles({ name: 'export-retry.csv', mimeType: 'text/csv',
      buffer: Buffer.from('Date,Importer,Country,Exporter,Item,TOT_FC\n2026-01-01,Retry Buyer,Kenya,Retry Supplier,Retry Product,10\n') });
    expect((await uploaded).status()).toBe(201);
    await page.getByRole('button', { name: 'Export Full', exact: true }).click();
    const endpoint = '**/api/export/**';
    await page.route(endpoint, () => { /* Deliberately leave the request unanswered. */ });
    const started = Date.now();
    await page.getByRole('button', { name: 'Proceed / Export', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Exporting...', exact: true })).toBeDisabled();
    await expect(page.getByRole('alert')).toContainText('The export took too long. Please retry.', { timeout: 65_000 });
    expect(Date.now() - started).toBeGreaterThanOrEqual(59_000);
    await expect(page.getByRole('button', { name: 'Cancel', exact: true })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Proceed / Export', exact: true })).toBeEnabled();
    await page.screenshot({ path: testInfo.outputPath('export-timeout.png'), fullPage: true });
    await page.unroute(endpoint);
    const downloading = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Proceed / Export', exact: true }).click();
    const stream = await (await downloading).createReadStream();
    const chunks: Buffer[] = [];
    for await (const bytes of stream!) chunks.push(Buffer.from(bytes));
    expect(Buffer.concat(chunks).toString('utf8')).toContain('Retry Buyer');
    await expect(page.getByRole('heading', { name: 'Export Data', exact: true })).toBeHidden();
    expect(errors).toEqual([]);
  } finally {
    await testInfo.attach('page-errors.json', { body: JSON.stringify(errors), contentType: 'application/json' });
  }
});
