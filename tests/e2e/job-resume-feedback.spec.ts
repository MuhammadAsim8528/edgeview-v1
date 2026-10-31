import { test, expect } from './fixtures';

test('resume explains draining/refusal and allows a later successful retry', async ({ page, context, runtime }) => {
  await context.route('**/*', route => new URL(route.request().url()).origin === runtime.baseURL ? route.continue() : route.abort('blockedbyclient'));
  await runtime.identity();
  await page.route('**/api/runtime/state', async route => {
    const response = await route.fetch(); const data = await response.json();
    data.capabilities.company_enrichment.available = true;
    await route.fulfill({ response, json: data });
  });
  let status = 'STOPPED';
  const job = () => ({ id:'synthetic-drain-job',status,importer_exporter_mode:'importer',total_companies:1,completed_companies:0,current_company:'',current_stage:'Stopped',company_ids:['synthetic'],company_states:{synthetic:{id:'synthetic',name:'Synthetic Buyer',status:'pending',stage:'Queued'}},resource_usage:{} });
  await page.route('**/api/enrich/job/active', route => route.fulfill({ json:{success:true,job:job()} }));
  await page.route('**/api/enrich/job/synthetic-drain-job', route => route.fulfill({ json:{success:true,job:job()} }));
  await page.route('**/api/enrich/job/synthetic-drain-job/progress', route => route.fulfill({ json:{success:true,progress:{...job(),recent_results:[]}} }));
  let attempt = 0; const held: import('@playwright/test').Route[] = [];
  await page.route('**/api/enrich/job/synthetic-drain-job/start', route => {
    attempt++;
    if (attempt === 1) return route.fulfill({status:409,json:{success:false,code:'JOB_DRAINING',error:'PRIVATE_SERVER_TEXT_MUST_NOT_RENDER'}});
    if (attempt === 2) return route.fulfill({status:503,json:{success:false,error:'PRIVATE_SERVER_TEXT_MUST_NOT_RENDER'}});
    if (attempt === 3) { held.push(route); return; }
    status = 'DISCOVERING'; return route.fulfill({json:{success:true}});
  });
  await page.goto('/'); await page.locator('#nav-tab-contacts').click();
  await page.getByRole('button',{name:'Research Companies',exact:true}).click();
  await page.getByRole('button',{name:'Resume from Checkpoint',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('Previous research work is finishing. Try resuming shortly.');
  await expect(page.getByText('PRIVATE_SERVER_TEXT_MUST_NOT_RENDER')).toHaveCount(0);
  await page.getByRole('button',{name:'Resume from Checkpoint',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('Could not resume research.');
  await expect(page.getByText('PRIVATE_SERVER_TEXT_MUST_NOT_RENDER')).toHaveCount(0);
  await page.getByRole('button',{name:'Resume from Checkpoint',exact:true}).click();
  await expect(page.getByRole('button',{name:'Resuming…',exact:true})).toBeDisabled();
  await expect(page.getByRole('alert')).toContainText('Resuming took too long.',{timeout:18000});
  for (const route of held) await route.abort().catch(() => {});
  await page.getByRole('button',{name:'Resume from Checkpoint',exact:true}).click();
  await expect(page.getByRole('button',{name:'Pause / Halt Traversal',exact:true})).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
});
