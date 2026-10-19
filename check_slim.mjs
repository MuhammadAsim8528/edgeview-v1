import initSqlJs from 'sql.js';
import fs from 'fs';

async function main() {
  const SQL = await initSqlJs();
  const fileBuffer = fs.readFileSync('edgeview.db');
  const db = new SQL.Database(fileBuffer);
  
  // Find Slim research runs
  const runs = db.exec("SELECT research_id, company, country, status, iterations, evidence_count, pages_retrieved, started_at, completed_at FROM research_ledger_runs WHERE company LIKE '%SLIM%' ORDER BY started_at DESC");
  console.log('Slim runs:');
  if (runs[0]) runs[0].values.forEach(r => console.log(JSON.stringify(Object.fromEntries(runs[0].columns.map((c,i)=>[c,r[i]])))));
  
  // Check contact_cache for Slim
  const cache = db.exec("SELECT company_name, website, email, phone, address, details_json FROM contact_cache WHERE company_name LIKE '%SLIM%'");
  console.log('\nSlim in contact_cache:');
  if (cache[0]) cache[0].values.forEach(c => {
    const obj = Object.fromEntries(cache[0].columns.map((col,i)=>[col,c[i]]));
    console.log('Company:', obj.company_name);
    console.log('Website:', obj.website);
    console.log('Email:', obj.email);
    console.log('Phone:', obj.phone);
    console.log('Address:', obj.address);
    if (obj.details_json) {
      const d = JSON.parse(obj.details_json);
      console.log('Quality:', d.quality_status);
      console.log('Emails:', d.emails_list);
      console.log('Phones:', d.phones_list);
      console.log('Addresses:', d.addresses);
      console.log('People:', d.contact_persons);
      console.log('Evidence count:', d.evidence?.length);
    }
  });
  
  // Check scraped_url_cache for slimpharma
  const urls = db.exec("SELECT url, substr(content,1,500) as preview FROM scraped_url_cache WHERE url LIKE '%slimpharma%' ORDER BY cached_at DESC LIMIT 10");
  console.log('\nSlim cached URLs:');
  if (urls[0]) urls[0].values.forEach(u => console.log(u[0], '|', u[1]));
}
main().catch(console.error);