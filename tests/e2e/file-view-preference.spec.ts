import { test, expect } from './fixtures';

test('shipment grouping choice survives navigation and browser refresh', async ({ page, context, runtime }) => {
  await context.route('**/*', route => new URL(route.request().url()).origin === runtime.baseURL ? route.continue() : route.abort('blockedbyclient'));
  await runtime.identity();
  await page.goto('/');
  const csv = ['Date,Importer,Country,Exporter,Item,TOT_FC', ...Array.from({ length: 60 }, (_, i) => `2026-01-01,Preference Buyer ${i},Kenya,Preference Supplier,Product ${i},10`)].join('\n');
  const uploaded = page.waitForResponse(response => response.url().endsWith('/api/files/upload') && response.request().method() === 'POST');
  await page.locator('#file-upload-input').setInputFiles({ name: 'preference.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
  expect((await uploaded).status()).toBe(201);
  await page.getByRole('button', { name: 'Group Shipments ON', exact: true }).click();
  await expect(page.getByText('Page 1 of 3 (60 rows)', { exact: true })).toBeVisible();
  await page.locator('#nav-tab-settings').click();
  await expect(page.getByRole('button', { name: 'Save configuration', exact: true })).toBeVisible();
  await page.locator('#nav-tab-files').click();
  await expect(page.getByRole('button', { name: 'Group Shipments OFF', exact: true })).toBeVisible();
  await expect(page.getByText('Page 1 of 3 (60 rows)', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Group Shipments OFF', exact: true })).toBeVisible();
  await expect(page.getByText('Page 1 of 3 (60 rows)', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByText('Page 2 of 3 (60 rows)', { exact: true })).toBeVisible();
  // A mount-time debounce must not silently undo a later pagination action.
  await page.waitForTimeout(600);
  await expect(page.getByText('Page 2 of 3 (60 rows)', { exact: true })).toBeVisible();
});
