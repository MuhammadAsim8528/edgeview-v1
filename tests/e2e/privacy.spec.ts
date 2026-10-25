import { test, expect } from './fixtures';

test('privacy disclosure is keyboard accessible and distinguishes research from monitoring', async ({ page, context, runtime }) => {
  await context.route('**/*', route => new URL(route.request().url()).origin === runtime.baseURL ? route.continue() : route.abort('blockedbyclient'));
  await runtime.identity();
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.locator('#nav-tab-settings').click();
  const summary = page.locator('summary').filter({ hasText: 'Privacy and external services' });
  await expect(summary).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Research requests', exact: true })).not.toBeVisible();
  await summary.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Research requests', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Optional monitoring', exact: true })).toBeVisible();
  await expect(page.getByText(/Session replay is off\./)).toBeVisible();
  await expect(page.getByText(/An in-app on\/off switch is not yet available/)).toBeVisible();
  await expect(page.getByText(/Downloading does not upload/)).toBeVisible();
  await page.screenshot({ path: '.test-cache/e2e-artifacts/privacy-disclosure.png', fullPage: true });
  expect(errors).toEqual([]);
  await summary.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Research requests', exact: true })).not.toBeVisible();
});
