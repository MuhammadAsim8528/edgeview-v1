import { test, expect } from './fixtures';

test('stalled provider metrics stop loading and recover on a real refresh', async ({ page, context, runtime }, testInfo) => {
  await context.route('**/*', route => new URL(route.request().url()).origin === runtime.baseURL ? route.continue() : route.abort('blockedbyclient'));
  await runtime.identity();
  await page.route('**/api/governor/provider-metrics', () => {});
  await page.goto('/');
  await page.locator('#nav-tab-settings').click();
  await expect(page.getByText('Establishing telemetry links...', { exact: true })).toBeVisible();
  await expect(page.getByText('Provider metrics timed out. Retry the provider check or wait for refresh.', { exact: true })).toBeVisible({ timeout: 40_000 });
  await expect(page.getByText('Establishing telemetry links...', { exact: true })).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('provider-metrics-timeout.png'), fullPage: true });
  await page.unroute('**/api/governor/provider-metrics');
  await page.getByRole('button', { name: 'Test enabled providers', exact: true }).click();
  await expect(page.locator('#health-card-serper').getByText('Not Configured', { exact: true })).toBeVisible();
});

test('malformed provider metrics are unavailable, not healthy, and recover from the real API', async ({ page, context, runtime }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await context.route('**/*', route => new URL(route.request().url()).origin === runtime.baseURL ? route.continue() : route.abort('blockedbyclient'));
  await runtime.identity();
  await page.route('**/api/governor/provider-metrics', route => route.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true,"report":{"serper":null}}' }));
  await page.goto('/');
  await page.locator('#nav-tab-settings').click();
  await expect(page.getByText('Provider metrics are unavailable. Retry the provider check or wait for refresh.', { exact: true })).toBeVisible();
  await expect(page.getByText('Establishing telemetry links...', { exact: true })).toHaveCount(0);
  await page.unroute('**/api/governor/provider-metrics');
  await page.getByRole('button', { name: 'Test enabled providers', exact: true }).click();
  for (const id of ['serper', 'hunter', 'nvidia', 'groq']) {
    await expect(page.locator(`#health-card-${id}`).getByText('Not Configured', { exact: true })).toBeVisible();
  }
  await expect(page.getByText('Provider metrics are unavailable. Retry the provider check or wait for refresh.', { exact: true })).toHaveCount(0);
  expect(errors).toEqual([]);
});
