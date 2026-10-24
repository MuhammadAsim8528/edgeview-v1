import { test, expect } from './fixtures';

test('stalled individual and aggregate provider checks unlock and can be retried', async ({ page, context, runtime }) => {
  test.setTimeout(120_000);
  await context.route('**/*', route => new URL(route.request().url()).origin === runtime.baseURL ? route.continue() : route.abort('blockedbyclient'));
  await runtime.identity();
  await page.route('**/api/settings/test', () => {});
  await page.route('**/api/system/health/test', () => {});
  await page.goto('/');
  await page.locator('#nav-tab-settings').click();
  const groq = page.locator('form section').filter({ hasText: 'AI fallback for query planning and extraction' });
  await groq.getByRole('button', { name: 'Test connection', exact: true }).click();
  await page.getByRole('button', { name: 'Test enabled providers', exact: true }).click();
  await expect(groq.getByText('Provider check timed out. You can retry.', { exact: true })).toBeVisible({ timeout: 70_000 });
  await expect(page.getByRole('alert').filter({ hasText: 'Provider checks timed out. You can retry.' })).toContainText('Previously loaded metrics remain visible.');
  await expect(groq.getByRole('button', { name: 'Test connection', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Test enabled providers', exact: true })).toBeEnabled();
  await page.unroute('**/api/settings/test');
  await page.unroute('**/api/system/health/test');
  await groq.getByRole('button', { name: 'Test connection', exact: true }).click();
  await expect(groq.getByText(/API Key is empty/i)).toBeVisible();
  await page.getByRole('button', { name: 'Test enabled providers', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Test enabled providers', exact: true })).toBeEnabled();
  await expect(page.getByRole('alert').filter({ hasText: 'Provider checks timed out. You can retry.' })).toHaveCount(0);
});

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
