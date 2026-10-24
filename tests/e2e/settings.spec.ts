import { test, expect } from './fixtures';

test('a stalled settings load ends in a retry state rather than an indefinite spinner', async ({ page, context, runtime }) => {
  await context.route('**/*', route => new URL(route.request().url()).origin === runtime.baseURL ? route.continue() : route.abort('blockedbyclient'));
  await runtime.identity();
  // Keep only this request pending; the real compiled UI owns its 30s deadline.
  await page.route('**/api/settings', () => {});
  await page.goto('/');
  await page.locator('#nav-tab-settings').click();
  await expect(page.getByText('Loading settings…', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Retry settings', exact: true })).toBeVisible({ timeout: 40_000 });
  await expect(page.getByText('Loading settings…', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Save configuration', exact: true })).toHaveCount(0);
});

test('failed settings load cannot expose writable defaults and retry restores the real form', async ({ page, context, runtime }) => {
  await context.route('**/*', route => new URL(route.request().url()).origin === runtime.baseURL ? route.continue() : route.abort('blockedbyclient'));
  await runtime.identity();
  let writes = 0;
  page.on('request', request => { if (request.url().endsWith('/api/settings') && request.method() === 'POST') writes += 1; });
  await page.route('**/api/settings', route => route.request().method() === 'GET'
    ? route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"SYNTHETIC_PRIVATE_CONFIG_FAILURE"}' })
    : route.continue());
  await page.goto('/');
  await page.locator('#nav-tab-settings').click();
  await expect(page.getByText('Provider settings could not be loaded. Retry before making changes.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save configuration', exact: true })).toHaveCount(0);
  await expect(page.getByText('SYNTHETIC_PRIVATE_CONFIG_FAILURE', { exact: true })).toHaveCount(0);
  expect(writes).toBe(0);
  await page.unroute('**/api/settings');
  await page.route('**/api/settings', route => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  const malformed = page.waitForResponse(response => response.url().endsWith('/api/settings'));
  await page.getByRole('button', { name: 'Retry settings', exact: true }).click();
  await malformed;
  await expect(page.getByRole('button', { name: 'Retry settings', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save configuration', exact: true })).toHaveCount(0);
  await page.unroute('**/api/settings');
  await page.getByRole('button', { name: 'Retry settings', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Save configuration', exact: true })).toBeVisible();
  await expect(page.locator('form section').filter({ hasText: 'Identity-anchored web search' }).getByRole('checkbox', { name: 'Enabled' })).toBeChecked();
  expect(writes).toBe(0);
});

test('provider choices saved through Settings survive backend restart', async ({ page, context, runtime }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await context.route('**/*', route => new URL(route.request().url()).origin === runtime.baseURL ? route.continue() : route.abort('blockedbyclient'));
  await runtime.identity();
  await page.goto('/');
  await page.locator('#nav-tab-settings').click();
  const serper = page.locator('form section').filter({ hasText: 'Identity-anchored web search' });
  const hunter = page.locator('form section').filter({ hasText: 'Domain email intelligence' });
  await expect(serper.getByRole('checkbox', { name: 'Enabled' })).toBeChecked();
  await serper.getByRole('checkbox', { name: 'Enabled' }).uncheck();
  await hunter.getByRole('checkbox', { name: 'Enabled' }).uncheck();
  await page.getByRole('radio', { name: 'Groq', exact: true }).check();
  await page.getByRole('textbox', { name: 'Groq model', exact: true }).fill('openai/gpt-oss-20b');
  const saved = page.waitForResponse(response => response.url().endsWith('/api/settings') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Save configuration', exact: true }).click();
  expect((await saved).ok()).toBe(true);
  await expect(page.getByText('EdgeView V1 provider settings saved. Stored keys remain hidden.', { exact: true })).toBeVisible();
  const assertStored = async () => {
    const response = await page.request.get('/api/settings');
    expect(response.ok()).toBe(true);
    expect(await response.json()).toMatchObject({ serper_enabled: false, hunter_enabled: false, primary_ai_provider: 'GROQ', groq_model: 'openai/gpt-oss-20b', has_serper_key: false, has_hunter_key: false });
  };
  await assertStored();
  await page.goto('about:blank');
  await runtime.restart();
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Save configuration', exact: true })).toBeVisible();
  await expect(serper.getByRole('checkbox', { name: 'Enabled' })).not.toBeChecked();
  await expect(hunter.getByRole('checkbox', { name: 'Enabled' })).not.toBeChecked();
  await expect(serper.getByRole('button', { name: 'Test connection', exact: true })).toBeDisabled();
  await expect(page.getByRole('radio', { name: 'Groq', exact: true })).toBeChecked();
  await expect(page.getByRole('textbox', { name: 'Groq model', exact: true })).toHaveValue('openai/gpt-oss-20b');
  await assertStored();
  const groq = page.locator('form section').filter({ hasText: 'AI fallback for query planning and extraction' });
  await groq.getByRole('button', { name: 'Test connection', exact: true }).click();
  await expect(groq.getByText(/API Key is empty/i)).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('settings-restart.png'), fullPage: true });
  expect(errors).toEqual([]);
});
