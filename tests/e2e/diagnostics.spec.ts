import { test, expect } from './fixtures';
import { build } from 'esbuild';

test('actual React boundary recovers and sends only a fixed crash code to the real API', async ({ page, context, runtime }) => {
  await context.route('**/*', route => new URL(route.request().url()).origin === runtime.baseURL ? route.continue() : route.abort('blockedbyclient'));
  await runtime.identity();
  const compiled = await build({ stdin: { contents: `import React from 'react'; import {createRoot} from 'react-dom/client'; import {ErrorBoundary} from './src/components/ErrorBoundary'; let fail=true; function View(){if(fail){throw new Error('SYNTHETIC_PRIVATE_CRASH_BODY');}return <p>Recovered fixture view</p>;} createRoot(document.getElementById('root')).render(<ErrorBoundary onReset={()=>{fail=false;}}><View/></ErrorBoundary>);`, resolveDir: process.cwd(), loader: 'tsx' }, bundle:true, write:false, format:'iife', platform:'browser', define:{'process.env.NODE_ENV':'"production"'} });
  await page.route('**/__crash-fixture.js', route => route.fulfill({contentType:'application/javascript',body:compiled.outputFiles[0].text}));
  await page.route('**/__crash-fixture.html', route => route.fulfill({contentType:'text/html',body:'<!doctype html><div id="root"></div><script src="/__crash-fixture.js"></script>'}));
  const report = page.waitForResponse(response => response.url().endsWith('/api/monitoring/frontend-error'));
  await page.goto('/__crash-fixture.html');
  const response = await report;
  expect(response.status()).toBe(202);
  expect(response.request().postDataJSON()).toEqual({code:'REACT_RENDER_FAILED'});
  await expect(page.getByText('Error code: REACT_RENDER_FAILED', {exact:true})).toBeVisible();
  await expect(page.getByText('SYNTHETIC_PRIVATE_CRASH_BODY', {exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Reset Section',exact:true}).click();
  await expect(page.getByText('Recovered fixture view',{exact:true})).toBeVisible();
  const invalid = await page.request.post('/api/monitoring/frontend-error',{data:{code:'REACT_RENDER_FAILED',message:'SYNTHETIC_PRIVATE_CRASH_BODY'}});
  expect(invalid.status()).toBe(400);
});

test('disabled monitoring stays honest in the API and rendered Settings', async ({ page, context, runtime }) => {
  await context.route('**/*', route => new URL(route.request().url()).origin === runtime.baseURL ? route.continue() : route.abort('blockedbyclient'));
  await runtime.identity();
  const before = await page.request.get('/api/monitoring/status');
  expect(before.ok()).toBe(true);
  const status = await before.json();
  expect(status.monitoring.enabled).toBe(false);
  expect(status.monitoring.replay).toBe('OFF');
  for (const vendor of ['sentry', 'posthog']) {
    expect(status.monitoring[vendor].state).toBe('DISABLED');
    expect(status.monitoring[vendor].dashboard_verified).toBe(false);
    expect(status.monitoring[vendor].last_transport_success_at).toBeNull();
  }
  const probe = await page.request.post('/api/monitoring/test');
  expect(probe.ok()).toBe(true);
  const result = await probe.json();
  expect(result.success).toBe(false);
  expect(result.delivery.sentry).toBe(false);
  expect(result.delivery.posthog).toBe(false);
  await page.goto('/');
  await page.locator('#nav-tab-settings').click();
  const panel = page.getByRole('region', { name: 'Remote monitoring status', exact: true });
  await expect(panel).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Test monitoring delivery', exact: true })).toBeDisabled();
  await expect(panel.getByText('DISABLED', { exact: true })).toHaveCount(2);
  await expect(panel.getByText('NOT VERIFIED', { exact: true })).toHaveCount(2);
  await expect(panel.getByText('TRANSPORT_OK', { exact: true })).toHaveCount(0);
});

test('log failures are not presented as empty success and real refresh recovers', async ({ page, context, runtime }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await context.route('**/*', route => new URL(route.request().url()).origin === runtime.baseURL ? route.continue() : route.abort('blockedbyclient'));
  await runtime.identity();
  await page.route('**/api/logs/enrichment*', route => route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"SYNTHETIC_PRIVATE_LOG_ERROR"}' }));
  await page.goto('/');
  await page.locator('#nav-tab-settings').click();
  await expect(page.getByRole('heading', { name: 'System Diagnostics & Activity Logs', exact: true })).toBeVisible();
  await expect(page.getByText('Activity logs could not be loaded. Retry to refresh.', { exact: true })).toBeVisible();
  await expect(page.getByText('No enrichment log entries available.', { exact: true })).toHaveCount(0);
  await expect(page.getByText('SYNTHETIC_PRIVATE_LOG_ERROR', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Enrichment Logs (—)', exact: true })).toBeVisible();
  await page.unroute('**/api/logs/enrichment*');
  await page.route('**/api/logs/enrichment*', route => route.fulfill({ status: 200, contentType: 'application/json', body: '[{"message":null}]' }));
  await page.getByRole('button', { name: 'Refresh Logs', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Refresh Logs', exact: true })).toBeEnabled();
  await expect(page.getByText('Activity logs could not be loaded. Retry to refresh.', { exact: true })).toBeVisible();
  await expect(page.getByText('No enrichment log entries available.', { exact: true })).toHaveCount(0);
  await page.unroute('**/api/logs/enrichment*');
  await page.getByRole('button', { name: 'Refresh Logs', exact: true }).click();
  await expect(page.getByText('No enrichment log entries available.', { exact: true })).toBeVisible();
  await expect(page.getByText('Activity logs could not be loaded. Retry to refresh.', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: /^System Logs/ }).click();
  await expect(page.getByRole('button', { name: 'Refresh Logs', exact: true })).toBeEnabled();
  await page.getByPlaceholder('Search log entries...').fill('a-term-that-does-not-occur-in-the-synthetic-logs');
  await expect(page.getByText('No system log entries match this search.', { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('logs-search.png'), fullPage: true });
  expect(errors).toEqual([]);
});
