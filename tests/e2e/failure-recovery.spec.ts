import { test, expect } from './fixtures';

test('file and country failures remain visible and recover without injected success', async ({ page, context, runtime }, testInfo) => {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  await context.route('**/*', route => new URL(route.request().url()).origin === runtime.baseURL ? route.continue() : route.abort('blockedbyclient'));
  await runtime.identity();
  try {
    await page.goto('/');
    const csv = ['Date,Importer,Country,Exporter,Item,TOT_FC,QTY,UNT', ...Array.from({ length: 60 }, (_, index) =>
      `2026-01-01,Recovery Buyer ${index},Kenya,Recovery Supplier,Recovery Product ${index},10,1,KG`)].join('\n');
    const uploaded = page.waitForResponse(response => response.url().endsWith('/api/files/upload') && response.request().method() === 'POST');
    await page.locator('#file-upload-input').setInputFiles({ name: 'e2e-recovery.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
    expect((await uploaded).status()).toBe(201);
    await expect(page.getByRole('heading', { name: 'e2e-recovery.csv', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Group Shipments ON' }).click();
    await expect(page.getByText('Page 1 of 3 (60 rows)', { exact: true })).toBeVisible();
    const paging = '**/api/files/*/data?*';
    await page.route(paging, route => route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'SYNTHETIC_PRIVATE_ERROR_MUST_NOT_RENDER' }) }));
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(page.getByText('Could not load this page. Check that EdgeView is running and retry.', { exact: true })).toBeVisible();
    await expect(page.locator('tbody')).not.toContainText('Recovery Buyer');
    await expect(page.getByText('SYNTHETIC_PRIVATE_ERROR_MUST_NOT_RENDER')).toHaveCount(0);
    await expect(page.getByText('No matching shipment records found', { exact: true })).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath('file-failure.png'), fullPage: true });
    await page.unroute(paging);
    await page.route(paging, route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ rows: [], total_count: 60 }) }));
    await page.getByRole('button', { name: 'Retry page', exact: true }).click();
    await expect(page.getByText('EdgeView returned an incomplete or invalid page. Please retry.', { exact: true })).toBeVisible();
    await page.unroute(paging);
    await page.getByRole('button', { name: 'Retry page', exact: true }).click();
    await expect(page.getByText('Page 2 of 3 (60 rows)', { exact: true })).toBeVisible();
    await expect(page.locator('tbody tr').first()).toContainText('Recovery Buyer 25');

    await page.locator('#nav-tab-country').click();
    await expect(page.getByRole('button', { name: 'Expand Kenya', exact: true })).toBeVisible();
    const summary = '**/api/countries/Kenya/summary?*';
    await page.route(summary, route => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
    await page.getByRole('button', { name: 'Expand Kenya', exact: true }).click();
    await expect(page.getByText('Country details could not be loaded. Please retry.', { exact: true })).toBeVisible();
    await expect(page.getByText('No importers recorded for this country.', { exact: true })).toHaveCount(0);
    await page.unroute(summary);
    await page.getByRole('button', { name: 'Retry country details', exact: true }).click();
    await expect(page.getByText('Country Summary: Kenya', { exact: true })).toBeVisible();
    const detail = '**/api/countries/Kenya/Recovery%20Buyer%200/details?*';
    await page.route(detail, route => route.fulfill({ status: 200, contentType: 'application/json', body: '[{"exporter":null}]' }));
    await page.getByRole('button', { name: 'Expand importer Recovery Buyer 0', exact: true }).click();
    await expect(page.getByText('Importer details could not be loaded. Please retry.', { exact: true })).toBeVisible();
    await page.unroute(detail);
    await page.getByRole('button', { name: 'Retry importer details', exact: true }).click();
    await expect(page.getByRole('cell', { name: 'Recovery Supplier', exact: true })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('recovered-country.png'), fullPage: true });
    expect(pageErrors).toEqual([]);
    // HTTP failures are deliberate and must produce visible error UX above.
    // Retain all console records; do not reuse this relaxed check for happy paths.
    expect(consoleErrors.every(message => /Failed to load resource: the server responded with a status of (500|503)/.test(message))).toBe(true);
  } finally {
    await testInfo.attach('controlled-failure-errors.json', { body: JSON.stringify({ pageErrors, consoleErrors }), contentType: 'application/json' });
  }
});
