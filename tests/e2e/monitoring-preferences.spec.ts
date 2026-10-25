import { test, expect } from './fixtures';

test('monitoring choices persist through real save and restart without enabling launch-disabled reporting', async ({ page, context, runtime }) => {
  await context.route('**/*', route => new URL(route.request().url()).origin === runtime.baseURL ? route.continue() : route.abort('blockedbyclient'));
  await runtime.identity();
  await page.goto('/');
  await page.locator('#nav-tab-settings').click();
  const errors = page.getByRole('checkbox', { name: 'Allow sanitized error reports to Sentry', exact: true });
  const usage = page.getByRole('checkbox', { name: 'Allow minimal usage analytics to PostHog', exact: true });
  await expect(errors).toBeChecked(); await expect(usage).toBeChecked();
  await errors.focus(); await page.keyboard.press('Space'); await usage.uncheck();
  await page.getByRole('button', { name: 'Save monitoring preferences', exact: true }).click();
  await expect(page.getByText('Monitoring preferences saved.', { exact: true })).toBeVisible();
  const status = await (await page.request.get('/api/monitoring/status')).json();
  expect(status.monitoring.preferences).toEqual({ errors: false, usage: false });
  expect(status.monitoring.enabled).toBe(false);
  expect(status.monitoring.sentry.state).toBe('DISABLED');
  expect(status.monitoring.posthog.state).toBe('DISABLED');
  expect((await page.request.post('/api/settings/reset', { data: { confirm: 'RESET_SETTINGS' } })).ok()).toBe(true);
  expect((await (await page.request.get('/api/monitoring/status')).json()).monitoring.preferences).toEqual({ errors: false, usage: false });
  for (const body of [{ errors: 'false', usage: false }, { errors: false }, { errors: false, usage: false, key: 'synthetic-only' }, []]) {
    expect((await page.request.post('/api/monitoring/preferences', { data: body })).status()).toBe(400);
  }
  await runtime.restart(); await page.reload();
  await page.locator('#nav-tab-settings').click();
  await expect(errors).not.toBeChecked(); await expect(usage).not.toBeChecked();
  await errors.check();
  await page.getByRole('button', { name: 'Save monitoring preferences', exact: true }).click();
  await expect(page.getByText('Monitoring preferences saved.', { exact: true })).toBeVisible();
  expect((await (await page.request.get('/api/monitoring/status')).json()).monitoring.preferences).toEqual({ errors: true, usage: false });
  await expect(page.getByText(/Saving these choices cannot enable it/)).toBeVisible();
  await page.screenshot({ path: '.test-cache/e2e-artifacts/monitoring-preferences.png', fullPage: true });
});

test('monitoring preference failure is visible and does not invent a saved state', async ({ page, context, runtime }) => {
  await context.route('**/*', route => new URL(route.request().url()).origin === runtime.baseURL ? route.continue() : route.abort('blockedbyclient'));
  await runtime.identity();
  await page.goto('/'); await page.locator('#nav-tab-settings').click();
  const errors = page.getByRole('checkbox', { name: 'Allow sanitized error reports to Sentry', exact: true });
  await expect(errors).toBeVisible(); await errors.uncheck();
  await page.route('**/api/monitoring/preferences', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{"success":false}' }));
  await page.getByRole('button', { name: 'Save monitoring preferences', exact: true }).click();
  await expect(page.getByText('Save could not be confirmed. Reload preferences before retrying.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Reload monitoring preferences', exact: true }).click();
  await expect(errors).toBeChecked();
});
