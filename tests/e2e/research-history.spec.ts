import { test, expect } from './fixtures';

test.use({ savedHistoryCount: 1005 });

test('saved history pages beyond 1000, opens original evidence, and survives restart without provider requests', async ({ page, context, runtime }, testInfo) => {
  await context.route('**/*', route => new URL(route.request().url()).origin === runtime.baseURL ? route.continue() : route.abort('blockedbyclient'));
  const badRequests = [
    '?limit=0', '?limit=201', '?limit=1.5', '?limit=50&limit=40', '?cursor[]=bad', '?cursor=e30', '?cursor=../escape',
  ];
  for (const query of badRequests) {
    const response = await page.request.get(`/api/v1/runs${query}`);
    expect(response.status()).toBe(400);
    expect((await response.json()).code).toBe('HISTORY_PAGE_INVALID');
  }
  let cursor = '';
  const seen = new Set<string>();
  for (let count = 0; count < 21; count++) {
    const response = await page.request.get('/api/v1/runs?' + new URLSearchParams({ limit: '50', ...(cursor ? { cursor } : {}) }));
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.runs.length).toBeLessThanOrEqual(50);
    for (const run of body.runs) { expect(seen.has(run.id)).toBe(false); seen.add(run.id); }
    cursor = body.next_cursor;
    if (!cursor) break;
  }
  expect(seen.size).toBe(1005);
  let mutationRequests = 0;
  page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/') && request.method() !== 'GET') mutationRequests++; });
  await page.goto('/');
  await page.locator('#nav-tab-research').click();
  const selector = page.getByRole('combobox', { name: 'Research run' });
  await expect(selector).toBeEnabled();
  await expect(selector.locator('option')).toHaveCount(50);
  await expect(page.getByRole('heading', { name: 'Synthetic History Buyer 1004', exact: true })).toBeVisible();
  const details = page.getByRole('region', { name: 'Saved capture details' });
  await expect(details).toContainText('Company contact research · Mode: Bulk');
  await expect(details).toContainText('Providers recorded: Hunter, Serper');
  await expect(details).toContainText('not checked live');
  await expect(details.locator('time')).toHaveCount(2);
  await page.getByRole('button', { name: 'Older saved runs', exact: true }).click();
  await expect(selector).toBeEnabled();
  await expect(selector.locator('option').filter({ hasText: 'Synthetic History Buyer 954 ·' })).toHaveCount(1);
  await selector.selectOption('run-history-0954');
  await expect(page.getByRole('heading', { name: 'Synthetic History Buyer 954', exact: true })).toBeVisible();
  await expect(page.getByText('South Sudan · run-history-0954', { exact: true })).toBeVisible();
  await expect(details).toContainText('Operation: Not recorded · Mode: Not recorded');
  await expect(details).toContainText('No provider attempts recorded');
  await page.getByRole('button', { name: 'Newer saved runs', exact: true }).click();
  await expect(selector).toBeEnabled();
  await expect(selector.locator('option').filter({ hasText: 'Synthetic History Buyer 1004 ·' })).toHaveCount(1);
  // Selected evidence remains available even when its header is on another page.
  await expect(page.getByRole('heading', { name: 'Synthetic History Buyer 954', exact: true })).toBeVisible();
  await runtime.restart();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Synthetic History Buyer 954', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Refresh research', exact: true }).click();
  await expect(selector).toBeEnabled();
  await selector.selectOption('run-history-1004');
  await expect(details).toContainText('Providers recorded: Hunter, Serper');
  await expect(details).toContainText('Company contact research · Mode: Bulk');
  await page.getByRole('button', { name: 'Older saved runs', exact: true }).click();
  await expect(selector).toBeEnabled();
  await selector.selectOption('run-history-0954');
  await expect(page.getByRole('heading', { name: 'Synthetic History Buyer 954', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Newer saved runs', exact: true }).click();
  await expect(selector).toBeEnabled();
  await page.route('**/api/v1/runs?*', route => route.fulfill({ status: 503, json: { success: false, message: 'Saved history temporarily unavailable.' } }), { times: 1 });
  await page.getByRole('button', { name: 'Older saved runs', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Synthetic History Buyer 954', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Retry research', exact: true }).click();
  await expect(page.getByRole('alert')).not.toBeVisible();
  await expect(selector).toBeEnabled();
  for (let pageNumber = 3; pageNumber <= 21; pageNumber++) {
    await page.getByRole('button', { name: 'Older saved runs', exact: true }).click();
    await expect(page.getByText(`Saved evidence only · page ${pageNumber}. Opening or reloading history does not refresh company research.`, { exact: true })).toBeVisible();
    await expect(selector).toBeEnabled();
  }
  await expect(page.getByRole('button', { name: 'Older saved runs', exact: true })).toBeDisabled();
  await selector.selectOption('run-history-0000');
  await expect(page.getByRole('heading', { name: 'Synthetic History Buyer 0', exact: true })).toBeVisible();
  await expect(page.getByText('South Sudan · run-history-0000', { exact: true })).toBeVisible();
  expect(mutationRequests).toBe(0);
  expect(runtime.outboundAttempts()).toBe(0);
  await testInfo.attach('history-scope', { body: JSON.stringify({ build: (await runtime.identity()).app.build, savedRuns: seen.size, mutationRequests, backendOutboundAttempts: runtime.outboundAttempts(), limitation: 'Synthetic local history only; live refresh/reuse/aliases not accepted here' }), contentType: 'application/json' });
});
