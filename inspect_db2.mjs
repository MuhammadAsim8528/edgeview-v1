import initSqlJs from 'sql.js';
import fs from 'fs';

async function main() {
  const DB_PATH = 'edgeview.db';
  const SQL = await initSqlJs();
  const fileBuffer = fs.readFileSync(DB_PATH);
  const db = new SQL.Database(fileBuffer);

  console.log('=== Recent research_ledger_runs (last 40) ===');
  const runs = db.exec("SELECT research_id, company, country, status, iterations, evidence_count, pages_retrieved, started_at, completed_at FROM research_ledger_runs ORDER BY started_at DESC LIMIT 40");
  if (runs[0]) runs[0].values.forEach(r => console.log(JSON.stringify(Object.fromEntries(runs[0].columns.map((c,i)=>[c,r[i]])))));

  console.log('\n=== Failed companies from recent runs ===');
  const failed = db.exec(`SELECT research_id, company, country, status, iterations, evidence_count, pages_retrieved, started_at, completed_at 
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
    ORDER BY started_at DESC`);
  if (failed[0]) failed[0].values.forEach(r => console.log(JSON.stringify(Object.fromEntries(failed[0].columns.map((c,i)=>[c,r[i]])))));

  console.log('\n=== Actions for one failed run (SIXA latest) ===');
  const sixaRun = db.exec("SELECT research_id FROM research_ledger_runs WHERE company='SIXA PHARMACEUTICAL TRADING COMPANY' AND status='FAILED' ORDER BY started_at DESC LIMIT 1");
  if (sixaRun[0]?.values[0]?.[0]) {
    const rid = sixaRun[0].values[0][0];
    console.log('Research ID:', rid);
    const actions = db.exec(`SELECT iteration, action_type, target_type, provider, query, status, information_gain, latency_ms, error 
      FROM research_ledger_actions 
      WHERE research_id=? ORDER BY iteration, id`, [rid]);
    if (actions[0]) actions[0].values.forEach(a => console.log(JSON.stringify(Object.fromEntries(actions[0].columns.map((c,i)=>[c,a[i]])))));
  }

  console.log('\n=== scraped_url_cache for SIXA-related URLs ===');
  const sixaUrls = db.exec(`SELECT url, substr(content,1,300) as preview, cached_at FROM scraped_url_cache 
    WHERE url LIKE '%sixapharmaceutical%' OR url LIKE '%sixapharma%' OR url LIKE '%sixa%' ORDER BY cached_at DESC LIMIT 10`);
  if (sixaUrls[0]) sixaUrls[0].values.forEach(c => console.log(c[0], '|', c[1], '|', c[2]));

  console.log('\n=== scraped_url_cache for GLOBE PHARMACY URLs ===');
  const globeUrls = db.exec(`SELECT url, substr(content,1,300) as preview, cached_at FROM scraped_url_cache 
    WHERE url LIKE '%globepharmacy%' OR url LIKE '%globe-pharmacy%' ORDER BY cached_at DESC LIMIT 10`);
  if (globeUrls[0]) globeUrls[0].values.forEach(c => console.log(c[0], '|', c[1], '|', c[2]));
}

main().catch(console.error);