import { test, expect } from './fixtures';

test('pause failures and unconfirmed stop checkpoints stay visible and recover through polling', async ({ page, context, runtime }) => {
  await context.route('**/*', route => new URL(route.request().url()).origin === runtime.baseURL ? route.continue() : route.abort('blockedbyclient'));
  await runtime.identity();
  await page.route('**/api/runtime/state', async route => { const response=await route.fetch();const data=await response.json();data.capabilities.company_enrichment.available=true;await route.fulfill({response,json:data}); });
  let status='DISCOVERING', checkpointUnavailable=false, progressReads=0;
  const job=()=>({id:'synthetic-pause-job',status,importer_exporter_mode:'importer',total_companies:1,completed_companies:0,current_company:'Synthetic Buyer',current_stage:'Researching',company_ids:['synthetic'],company_states:{synthetic:{id:'synthetic',name:'Synthetic Buyer',status:'processing',stage:'Researching'}},resource_usage:{}});
  await page.route('**/api/enrich/job/active',route=>route.fulfill({json:{success:true,job:job()}}));
  await page.route('**/api/enrich/job/synthetic-pause-job',route=>checkpointUnavailable?route.fulfill({status:503,json:{error:'PRIVATE_CHECKPOINT_TEXT'}}):route.fulfill({json:{success:true,job:job()}}));
  await page.route('**/api/enrich/job/synthetic-pause-job/progress',route=>{progressReads++;return checkpointUnavailable?route.fulfill({status:503,json:{error:'PRIVATE_CHECKPOINT_TEXT'}}):route.fulfill({json:{success:true,progress:{...job(),recent_results:[]}}});});
  let attempt=0;const held:import('@playwright/test').Route[]=[];
  await page.route('**/api/enrich/job/synthetic-pause-job/stop',route=>{
    attempt++;
    if(attempt===1)return route.fulfill({status:503,json:{success:false,error:'PRIVATE_STOP_TEXT'}});
    if(attempt===2){held.push(route);return;}
    checkpointUnavailable=true;return route.fulfill({json:{success:true}});
  });
  await page.goto('/');await page.locator('#nav-tab-contacts').click();await page.getByRole('button',{name:'Research Companies',exact:true}).click();
  await page.getByRole('button',{name:'Pause / Halt Traversal',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('Could not pause research.');
  await expect(page.getByText('PRIVATE_STOP_TEXT')).toHaveCount(0);
  await page.getByRole('button',{name:'Pause / Halt Traversal',exact:true}).click();
  await expect(page.getByRole('button',{name:'Pausing…',exact:true})).toBeDisabled();
  await expect(page.getByRole('alert')).toContainText('Pausing took too long.',{timeout:18000});
  for(const route of held)await route.abort().catch(()=>{});
  await page.getByRole('button',{name:'Pause / Halt Traversal',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('Stop was requested, but its checkpoint could not be confirmed.');
  await expect(page.getByText('PRIVATE_CHECKPOINT_TEXT')).toHaveCount(0);
  const before=progressReads;await expect.poll(()=>progressReads).toBeGreaterThan(before);
  checkpointUnavailable=false;status='STOPPED';
  await expect(page.getByRole('button',{name:'Resume from Checkpoint',exact:true})).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
});
