import { test, expect } from './fixtures';

test('two uploads share one company-country identity but retain separate trade evidence and export authority', async ({ page, request, context, runtime }) => {
  await context.route('**/*', route => new URL(route.request().url()).origin === runtime.baseURL ? route.continue() : route.abort('blockedbyclient'));
  const upload = async (name: string, csv: string) => {
    const response = await request.post('/api/files/upload', { multipart: { file: {
      name, mimeType: 'text/csv', buffer: Buffer.from('Importer,Country,Exporter,Item,TOT_FC\n' + csv),
    } } });
    expect(response.status()).toBe(201);
    const body = await response.json();
    expect(body.success).toBeTruthy();
    expect(body.data?.id).toBeTruthy();
    return body.data.id as string;
  };
  const first = await upload('first-scope.csv', 'Scope Buyer,Kenya,First Supplier,First product,5');
  const second = await upload('second-scope.csv', 'Scope Buyer,Kenya,Second Supplier,Second product,7\nOther Buyer,Sudan,Third Supplier,Third product,8');
  expect(second).not.toBe(first);

  const scoped = async (id: string) => {
    const response = await request.get('/api/companies?file_id=' + encodeURIComponent(id));
    expect(response.status()).toBe(200);
    return (await response.json()) as Array<{id:string;company_name:string}>;
  };
  const left = await scoped(first), right = await scoped(second);
  const buyer = left.find(contact => contact.company_name === 'Scope Buyer');
  const rightBuyer = right.find(contact => contact.company_name === 'Scope Buyer');
  const otherBuyer = right.find(contact => contact.company_name === 'Other Buyer');
  expect(buyer).toBeTruthy();
  expect(rightBuyer).toBeTruthy();
  expect(otherBuyer).toBeTruthy();
  expect(buyer!.id).toBe(rightBuyer!.id);
  expect(left.some(contact => contact.company_name === 'Other Buyer')).toBeFalsy();
  expect((await scoped('missing-file-scope')).length).toBe(0);

  const directory = async (id: string) => {
    const response = await request.get('/api/international-importer-directory?file_id=' + encodeURIComponent(id));
    expect(response.status()).toBe(200);
    return response.text();
  };
  const firstDirectory = await directory(first);
  expect(firstDirectory).toContain('First product');
  expect(firstDirectory).not.toContain('Second product');
  expect(firstDirectory).not.toContain('Third product');
  const secondDirectory = await directory(second);
  expect(secondDirectory).toContain('Second product');
  expect(secondDirectory).toContain('Third product');
  expect(secondDirectory).not.toContain('First product');
  expect(await directory('missing-file-scope')).not.toContain('Scope Buyer');

  const exportCsv = async (fileId: string, id: string) => {
    const response = await request.post('/api/export', {data:{
      dataset:'contacts',format:'csv',title:'Directory',filenamePrefix:'scope',report_type:'international_importer',
      records:[{id,company_name:'FORGED CLIENT COMPANY',email:'forged@example.invalid'}],contact_file_id:fileId,
    }});
    expect(response.status()).toBe(200);
    expect(response.headers()['x-export-failed-formats']).toBeUndefined();
    const csv = (await response.body()).toString('utf8');
    expect(csv).not.toContain('FORGED CLIENT COMPANY');
    expect(csv).not.toContain('forged@example.invalid');
    return csv;
  };
  const firstCsv = await exportCsv(first, buyer!.id);
  expect(firstCsv).toContain('First product');
  expect(firstCsv).not.toContain('Second product');
  expect(firstCsv).not.toContain('Third product');
  const secondCsv = await exportCsv(second, buyer!.id);
  expect(secondCsv).toContain('Second product');
  expect(secondCsv).not.toContain('First product');
  expect(secondCsv).not.toContain('Third product');

  // Other Buyer exists only in the second file. Its id must not authorize an
  // export from the first file even when the client supplies that id directly.
  const crossScope = await request.post('/api/export', {data:{
    dataset:'contacts',format:'csv',title:'Directory',filenamePrefix:'scope',report_type:'international_importer',
    records:[{id:otherBuyer!.id}],contact_file_id:first,
  }});
  expect(crossScope.status()).toBe(400);
  expect((await crossScope.text())).not.toContain('Third product');

  await page.goto('/');
  await page.locator('#nav-tab-contacts').click();
  await page.getByLabel('Company scope').selectOption('all');
  await page.getByRole('button',{name:'All companies',exact:true}).click();
  await expect(page.getByText('Other Buyer',{exact:true}).first()).toBeVisible();
  expect(runtime.outboundAttempts()).toBe(0);
});
