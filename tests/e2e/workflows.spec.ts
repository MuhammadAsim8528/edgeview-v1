import { test, expect } from './fixtures';

test('synthetic upload, paging, full CSV, country keyboard drill-down and restart', async ({ page, context, runtime }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const consoleErrors: string[] = [];
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  try {
  await context.route('**/*', route => new URL(route.request().url()).origin === runtime.baseURL ? route.continue() : route.abort('blockedbyclient'));
  const health = await runtime.identity();
  expect(health.app.runtime_mode).toBe('production');
  expect(health.app.build.available).toBe(true);
  expect(health.app.build.buildId).toMatch(/^[a-f0-9]{64}$/);
  expect(health.app.build.gitCommit).toMatch(/^[a-f0-9]{40}$/);
  for (const provider of Object.values(health.providers) as Array<{ configured: boolean }>) expect(provider.configured).toBe(false);
  await testInfo.attach('build-health.json', { body: JSON.stringify({ pid: health.app.pid, buildId: health.app.build?.buildId, gitCommit: health.app.build?.gitCommit }), contentType: 'application/json' });
  await page.goto('/');
  await expect(page.getByText('No File Loaded in File Viewer')).toBeVisible();
  const csv = ['Date,Importer,Country,Exporter,Item,TOT_FC,QTY,UNT', ...Array.from({ length: 60 }, (_, index) =>
    `2026-01-01,Synthetic Buyer ${index},Kenya,Synthetic Supplier,Synthetic Product ${index},10,1,KG`)].join('\n');
  const uploaded = page.waitForResponse(response => response.url().endsWith('/api/files/upload') && response.request().method() === 'POST');
  await page.locator('#file-upload-input').setInputFiles({ name: 'e2e-owned.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
  expect((await uploaded).status()).toBe(201);
  await expect(page.getByRole('heading', { name: 'e2e-owned.csv', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Group Shipments ON' }).click();
  await expect(page.getByText('Page 1 of 3 (60 rows)', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByText('Page 2 of 3 (60 rows)', { exact: true })).toBeVisible();
  await expect(page.locator('tbody tr').first()).toContainText('Synthetic Buyer 25');
  await page.getByRole('button', { name: 'Export Full', exact: true }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Proceed / Export', exact: true }).click();
  const file = await download;
  const stream = await file.createReadStream();
  const chunks: Buffer[] = [];
  for await (const bytes of stream!) chunks.push(Buffer.from(bytes));
  const exported = Buffer.concat(chunks).toString('utf8');
  expect(exported.trim().split('\n')).toHaveLength(61);
  expect(exported).toContain('Synthetic Buyer 59');
  await expect(page.getByText('Export completed successfully!')).toBeHidden();
  await page.getByRole('button', { name: 'Country View', exact: true }).click();
  const country = page.getByRole('button', { name: 'Expand Kenya', exact: true });
  await country.focus(); await page.keyboard.press('Enter');
  await expect(page.getByText('Country Summary: Kenya', { exact: true })).toBeVisible();
  const importer = page.getByRole('button', { name: 'Expand importer Synthetic Buyer 0', exact: true });
  await importer.focus(); await page.keyboard.press('Space');
  await expect(page.getByRole('cell', { name: 'Synthetic Supplier', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: /Country Trade Analytics/ })).toBeVisible();
  // Close the UI before a normal backend restart. Offline-while-open UX is a
  // separate failure scenario, not an error to silently whitelist here.
  await page.goto('about:blank');
  await runtime.restart();
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Expand Kenya', exact: true })).toBeVisible();
  await page.locator('#nav-tab-files').click();
  await expect(page.getByRole('heading', { name: 'e2e-owned.csv', exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('workflow.png'), fullPage: true });
  expect(errors).toEqual([]);
  expect(consoleErrors).toEqual([]);
  } finally {
    await testInfo.attach('browser-errors.json', { body: JSON.stringify({ errors, consoleErrors }), contentType: 'application/json' });
  }
});
