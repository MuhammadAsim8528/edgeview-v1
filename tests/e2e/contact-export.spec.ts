import { test, expect } from './fixtures';

test('contact scope, export overrides and saved selection agree in the rendered UI', async ({ page, context, runtime }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await context.route('**/*', route => new URL(route.request().url()).origin === runtime.baseURL ? route.continue() : route.abort('blockedbyclient'));
  await runtime.identity();
  try {
    await page.goto('/');
    const uploaded = page.waitForResponse(response => response.url().endsWith('/api/files/upload') && response.request().method() === 'POST');
    await page.locator('#file-upload-input').setInputFiles({ name: 'e2e-scope.csv', mimeType: 'text/csv', buffer: Buffer.from('Date,Importer,Country,Exporter,Item,TOT_FC\n2026-01-01,Scope Buyer,Kenya,Scope Supplier,Scope Product,10\n') });
    expect((await uploaded).status()).toBe(201);
    await page.locator('#nav-tab-contacts').click();
    await page.getByRole('button', { name: 'All exporters', exact: true }).click();
    const supplier = page.locator('tbody tr').filter({ hasText: 'Scope Supplier' });
    await expect(supplier).toBeVisible();
    await page.getByRole('button', { name: 'Export Report', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Exporter Suppliers & History', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'Importer Buyers & History', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Importer Buyers & History', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.getByRole('button', { name: 'Export Report', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Exporter Suppliers & History', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await supplier.getByRole('button').first().click();
    await expect(page.getByText('1 companies selected for batch action', { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByText('1 companies selected for batch action', { exact: true })).toBeVisible();
    await expect(page.locator('tbody tr').filter({ hasText: 'Scope Supplier' })).toBeVisible();
    await page.getByRole('button', { name: 'Export Selected', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Exporter Suppliers & History', exact: true })).toHaveAttribute('aria-pressed', 'true');
    const downloading = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Proceed / Export', exact: true }).click();
    const download = await downloading;
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const bytes of stream!) chunks.push(Buffer.from(bytes));
    expect(Buffer.concat(chunks).toString('utf8')).toContain('Scope Supplier');
    await expect(page.getByText('Export completed successfully!', { exact: true })).toBeHidden();
    await page.screenshot({ path: testInfo.outputPath('contact-selection.png'), fullPage: true });
    expect(errors).toEqual([]);
  } finally {
    await testInfo.attach('browser-errors.json', { body: JSON.stringify(errors), contentType: 'application/json' });
  }
});
