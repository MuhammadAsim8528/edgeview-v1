import { test, expect } from './fixtures';

test('a late upload completion preserves the tab the user chose while waiting', async ({ page, context, runtime }) => {
  await context.route('**/*', route => new URL(route.request().url()).origin === runtime.baseURL ? route.continue() : route.abort('blockedbyclient'));
  await runtime.identity();
  let release!: () => void;
  let processed!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  const ready = new Promise<void>(resolve => { processed = resolve; });
  await page.route('**/api/files/upload', async route => {
    const response = await route.fetch(); // Real owned backend parses/persists; delay only its response delivery.
    expect(response.status()).toBe(201);
    processed();
    await held;
    await route.fulfill({ response });
  });
  try {
    await page.goto('/');
    await page.locator('#file-upload-input').setInputFiles({ name: 'late-owned.csv', mimeType: 'text/csv',
      buffer: Buffer.from('Date,Importer,Country,Exporter,Item,TOT_FC\n2026-01-01,Synthetic Late Buyer,Kenya,Synthetic Late Supplier,Product,10') });
    await ready;
    await page.locator('#nav-tab-contacts').click();
    await expect(page.getByRole('button', { name: 'All exporters', exact: true })).toBeVisible();
    release();
    await expect(page.getByText('Successfully uploaded late-owned.csv', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'All exporters', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'All companies', exact: true }).click();
    await expect(page.locator('tbody tr').filter({ hasText: 'Synthetic Late Buyer' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('button', { name: 'All exporters', exact: true })).toBeVisible();
  } finally {
    release();
    await page.unrouteAll({ behavior: 'wait' });
  }
});
