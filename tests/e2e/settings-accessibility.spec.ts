import { test, expect } from './fixtures';

test('provider credentials have accessible names and primary radios support arrow keys', async ({ page, context, runtime }) => {
  await context.route('**/*', route => new URL(route.request().url()).origin === runtime.baseURL ? route.continue() : route.abort('blockedbyclient'));
  await runtime.identity();
  await page.goto('/');
  await page.locator('#nav-tab-settings').click();
  for (const name of ['Serper', 'Hunter', 'NVIDIA NIM', 'Groq']) {
    await expect(page.getByLabel(`${name} API key`, { exact: true })).toBeVisible();
    await expect(page.getByLabel(`${name} API key`, { exact: true })).toHaveAttribute('type', 'password');
  }
  const nvidia = page.getByRole('radio', { name: 'NVIDIA NIM', exact: true });
  const groq = page.getByRole('radio', { name: 'Groq', exact: true });
  await expect(nvidia).toBeChecked();
  await nvidia.focus();
  await page.keyboard.press('ArrowRight');
  await expect(groq).toBeChecked();
  await page.keyboard.press('ArrowLeft');
  await expect(nvidia).toBeChecked();
});
