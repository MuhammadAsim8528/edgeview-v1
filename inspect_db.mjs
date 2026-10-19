import initSqlJs from 'sql.js';
import fs from 'fs';

async function main() {
  const DB_PATH = 'edgeview.db';
  const SQL = await initSqlJs();
  const fileBuffer = fs.readFileSync(DB_PATH);
  const db = new SQL.Database(fileBuffer);

  console.log('=== TABLES ===');
  const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table'");
  if (tables[0]) console.log(tables[0].values.map(r => r[0]).join(', '));

  console.log('\n=== research_ledger_runs schema ===');
  const s1 = db.exec("SELECT sql FROM sqlite_master WHERE name='research_ledger_runs'");
  if (s1[0]?.values[0]?.[0]) console.log(s1[0].values[0][0]);

  console.log('\n=== research_ledger_actions schema ===');
  const s2 = db.exec("SELECT sql FROM sqlite_master WHERE name='research_ledger_actions'");
  if (s2[0]?.values[0]?.[0]) console.log(s2[0].values[0][0]);

  console.log('\n=== scraped_url_cache schema ===');
  const s3 = db.exec("SELECT sql FROM sqlite_master WHERE name='scraped_url_cache'");
  if (s3[0]?.values[0]?.[0]) console.log(s3[0].values[0][0]);

  console.log('\n=== Recent research_ledger_runs (last 30) ===');
  const runs = db.exec("SELECT research_id, company, country, status, iterations, evidence_count, pages_retrieved, created_at FROM research_ledger_runs ORDER BY created_at DESC LIMIT 30");
  if (runs[0]) runs[0].values.forEach(r => console.log(JSON.stringify(Object.fromEntries(runs[0].columns.map((c,i)=>[c,r[i]])))));

  console.log('\n=== scraped_url_cache sample (last 10) ===');
  const cache = db.exec("SELECT url, substr(content,1,200) as preview, cached_at FROM scraped_url_cache ORDER BY cached_at DESC LIMIT 10");
  if (cache[0]) cache[0].values.forEach(c => console.log(c[0], '|', c[1], '|', c[2]));

  console.log('\n=== Failed companies from recent runs ===');
  const failed = db.exec(`SELECT research_id, company, country, status, iterations, evidence_count, pages_retrieved, created_at 
    FROM research_ledger_runs 
    WHERE status='FAILED' AND company IN (
      'SIXA PHARMACEUTICAL TRADING COMPANY',
      'SURAD MEDICAL SUPPLIES COMPANY', 
      'SALAMA PHARMACEUTICAL LTD',
      'SHAFICI PHARMACEUTICAL MEDICAL SUPPLIES WHOLESALER',
      'ZEE PHARMACEUTICALS LTD',
      'MOUMIN GROUP OF COMPANIES',
      'GLOBE PHARMACY LTD.',
      'Raheeg Medical Co LTD',
      'PHARMAKEN LTD',
      'M/S. GLOBE PHARMACY LIMITED.',
      'ABUUBAKAR SADIIQ PHARMACEUTICAL CO',
      'STAR PHARMACEUTICALS LTD',
      'PHARM ACTIV FZCO',
      'MOUMIN GROUP COMPANIES',
      'Astra Pharma (U) Ltd',
      'GETZ PHARMA INTERNATIONAL FZ - LLC',
      'ASTRA  PHARMA LTD',
      'GLOBE PHARMACY LIMITED,',
      'HEALTH SOLUTIONS LTD',
      'Q PHARMA DMCC',
      'CARE PHARMACY',
      'ABACUS PHARMA (A) LTD',
      'TAWAKAL PHARMACEUTICALS'
    )
    ORDER BY created_at DESC`);
  if (failed[0]) failed[0].values.forEach(r => console.log(JSON.stringify(Object.fromEntries(failed[0].columns.map((c,i)=>[c,r[i]])))));
}

main().catch(console.error);