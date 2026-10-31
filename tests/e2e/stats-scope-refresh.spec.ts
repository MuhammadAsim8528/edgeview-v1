import { test, expect } from './fixtures';

test('changing country refreshes the same importer in rendered analytics', async ({ page, context, request, runtime }) => {
  await context.route('**/*', route => new URL(route.request().url()).origin === runtime.baseURL ? route.continue() : route.abort('blockedbyclient'));
  await runtime.identity(); await page.goto('/');
  const uploaded = page.waitForResponse(r => r.url().endsWith('/api/files/upload') && r.request().method() === 'POST');
  await page.locator('#file-upload-input').setInputFiles({ name: 'stats-country-scope.csv', mimeType: 'text/csv', buffer: Buffer.from('Date,Importer,Country,Exporter,Item,TOT_FC\n2026-01-01,Shared Buyer,Kenya,Local Supplier,LOCALMED,50\n2026-01-02,Shared Buyer,Pakistan,Foreign Supplier,FOREIGNMED,900\n') });
  const uploadResponse = await uploaded; expect(uploadResponse.status()).toBe(201);
  const uploadBody = await uploadResponse.json(); const fileId = uploadBody.data?.id || uploadBody.id;
  const summary = await (await request.get(`/api/stats/importers/Shared%20Buyer/summary?file_id=${fileId}`)).json();
  expect(summary.total_export_value).toBe(950);
  expect(summary.country).toBe('All Countries');
  await page.locator('#nav-tab-stats').click();
  await expect(page.getByText('FOREIGNMED', { exact: true }).first()).toBeVisible();
  const country = page.locator('select').filter({ has: page.locator('option[value="Kenya"]') });
  await country.selectOption('Kenya');
  await expect(country).toHaveValue('Kenya');
  await expect(page.getByText('FOREIGNMED', { exact: true })).toHaveCount(0);
  await expect(page.getByText('LOCALMED', { exact: true }).first()).toBeVisible();
  let fail = true;
  await page.route('**/api/stats/importers/*/*', route => new URL(route.request().url()).searchParams.get('country') === 'Pakistan' && fail
    ? route.fulfill({ status: 503, json: { error: 'Synthetic analytics failure' } }) : route.fallback());
  await country.selectOption('Pakistan');
  await expect(page.getByRole('alert')).toContainText('Could not load this analytics scope');
  await expect(page.getByText('LOCALMED', { exact: true })).toHaveCount(0);
  await expect(page.getByText('FOREIGNMED', { exact: true })).toHaveCount(0);
  fail = false;
  await page.getByRole('button', { name: 'Retry analytics', exact: true }).click();
  await expect(page.getByText('FOREIGNMED', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('LOCALMED', { exact: true })).toHaveCount(0);

  // Hold the actual browser requests without replying: exercise the real15s
  // deadline rather than merely substituting a rejected promise or HTTP error.
  let held = 0;
  await page.route('**/api/stats/importers/*/*', route => {
    if (new URL(route.request().url()).searchParams.get('country') === 'Kenya') { held++; return; }
    return route.fallback();
  });
  await country.selectOption('Kenya');
  await expect(page.getByRole('status')).toContainText('Loading selected analytics scope');
  await expect(page.getByRole('alert')).toContainText('Analytics loading timed out', { timeout: 20000 });
  expect(held).toBe(4);
  await expect(page.getByText('FOREIGNMED', { exact: true })).toHaveCount(0);
  await expect(page.getByText('LOCALMED', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Retry analytics', exact: true })).toBeEnabled();

});
