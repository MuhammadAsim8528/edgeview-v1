import { test, expect } from './fixtures';

for (const action of ['pause', 'resume'] as const) {
  test(`${action} deadline restores controls even when aborted transport does not settle`, async ({ page, context, runtime }) => {
    await context.route('**/*', route => new URL(route.request().url()).origin === runtime.baseURL ? route.continue() : route.abort('blockedbyclient'));
    const response = await page.request.get(`${runtime.baseURL}/api/runtime/state`);
    expect(response.ok()).toBe(true);
    const state = await response.json(); state.capabilities.company_enrichment.available = true;
    await page.route('**/api/runtime/state', route => route.fulfill({ json: state }));
    const job = { id: 'synthetic-deadline-job', status: action === 'pause' ? 'DISCOVERING' : 'STOPPED',
      importer_exporter_mode: 'importer', total_companies: 1, completed_companies: 0,
      current_company: 'Synthetic Buyer', current_stage: 'Researching', company_ids: ['synthetic'],
      company_states: { synthetic: { id: 'synthetic', name: 'Synthetic Buyer', status: 'pending', stage: 'Queued' } }, resource_usage: {} };
    await page.route('**/api/enrich/job/active', route => route.fulfill({ json: { success: true, job } }));
    await page.route('**/api/enrich/job/synthetic-deadline-job', route => route.fulfill({ json: { success: true, job } }));
    await page.route('**/api/enrich/job/synthetic-deadline-job/progress', route => route.fulfill({ json: { success: true, progress: { ...job, recent_results: [] } } }));
    await page.addInitScript(({ action }) => {
      const original = window.fetch.bind(window);
      const probe = { calls: 0, aborted: false, rejectFirst: () => {}, rejectLatest: () => {}, finishSecond: () => {} };
      (window as any).__controlDeadlineProbe = probe;
      window.fetch = (input, init) => {
        const url = new URL(input instanceof Request ? input.url : String(input), window.location.href);
        if (url.pathname !== `/api/enrich/job/synthetic-deadline-job/${action === 'pause' ? 'stop' : 'start'}`) return original(input, init);
        probe.calls++;
        return new Promise<Response>((resolve, reject) => {
          probe.rejectLatest = () => reject(new Error('PRIVATE_OLD_CONTROL_ERROR'));
          if (probe.calls === 1) {
            // Deliberately uncooperative transport: cancellation is observed but
            // cannot be relied on to settle the Promise or release UI controls.
            init?.signal?.addEventListener('abort', () => { probe.aborted = true; }, { once: true });
            probe.rejectFirst = () => reject(new Error('PRIVATE_OLD_CONTROL_ERROR'));
          } else probe.finishSecond = () => resolve(new Response(JSON.stringify({ success: false }), { status: 503 }));
        });
      };
    }, { action });
    await page.goto('/'); await page.locator('#nav-tab-contacts').click();
    await page.getByRole('button', { name: 'Research Companies', exact: true }).click();
    const buttonName = action === 'pause' ? 'Pause / Halt Traversal' : 'Resume from Checkpoint';
    const waitingName = action === 'pause' ? 'Pausing…' : 'Resuming…';
    await page.getByRole('button', { name: buttonName, exact: true }).click();
    await expect(page.getByRole('button', { name: waitingName, exact: true })).toBeDisabled();
    await expect(page.getByRole('alert')).toContainText(action === 'pause' ? 'Pausing took too long.' : 'Resuming took too long.', { timeout: 18000 });
    await expect(page.getByRole('button', { name: buttonName, exact: true })).toBeEnabled();
    expect(await page.evaluate(() => (window as any).__controlDeadlineProbe.aborted)).toBe(true);
    await page.getByRole('button', { name: buttonName, exact: true }).click();
    await expect(page.getByRole('button', { name: waitingName, exact: true })).toBeDisabled();
    await page.evaluate(async () => {
      (window as any).__controlDeadlineProbe.rejectFirst();
      await new Promise(requestAnimationFrame); await new Promise(requestAnimationFrame);
    });
    await expect(page.getByRole('alert')).toHaveCount(0, { timeout: 1000 });
    await expect(page.getByRole('button', { name: waitingName, exact: true })).toBeDisabled();
    await page.evaluate(() => (window as any).__controlDeadlineProbe.finishSecond());
    await expect(page.getByRole('alert')).toContainText(action === 'pause' ? 'Could not pause research.' : 'Could not resume research.');
    await expect(page.getByText('PRIVATE_OLD_CONTROL_ERROR')).toHaveCount(0);
    await expect(page.getByRole('button', { name: buttonName, exact: true })).toBeEnabled();
    expect(await page.evaluate(() => (window as any).__controlDeadlineProbe.calls)).toBe(2);
    await page.getByRole('button', { name: buttonName, exact: true }).click();
    await expect(page.getByRole('button', { name: waitingName, exact: true })).toBeDisabled();
    await page.getByRole('button', { name: 'Back to Config', exact: true }).click();
    await expect(page.getByLabel('Research mode', { exact: true })).toBeVisible();
    await page.evaluate(async () => {
      (window as any).__controlDeadlineProbe.rejectLatest();
      await new Promise(requestAnimationFrame); await new Promise(requestAnimationFrame);
    });
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(page.getByLabel('Research mode', { exact: true })).toBeVisible();
  });
}
