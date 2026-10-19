import initSqlJs from 'sql.js';
import fs from 'fs';

async function main() {
  const SQL = await initSqlJs();
  const fileBuffer = fs.readFileSync('edgeview.db');
  const db = new SQL.Database(fileBuffer);
  
  // Get the run with summary_json
  const run = db.exec(`SELECT research_id, company, country, status, iterations, evidence_count, pages_retrieved, started_at, completed_at, summary_json FROM research_ledger_runs WHERE research_id='r-1789819284518-z9go3'`);
  console.log('Run with summary_json:');
  if (run[0]) {
    const row = Object.fromEntries(run[0].columns.map((c,i)=>[c,run[0].values[0][i]]));
    console.log('Run:', row.research_id, row.company, row.status);
    if (row.summary_json) {
      const summary = JSON.parse(row.summary_json);
      console.log('Summary:', JSON.stringify(summary, null, 2));
    }
  }
  
  // Check the content of some key cached pages
  const urls = [
    'https://slimpharma.com/contact',
    'https://slimpharma.com/corporate-management',
    'https://slimpharma.com/about-us/'
  ];
  
  for (const url of urls) {
    const cached = db.exec(`SELECT substr(content,1,2000) as preview FROM scraped_url_cache WHERE url=?`, [url]);
    console.log(`\n=== ${url} ===`);
    if (cached[0] && cached[0].values[0]) {
      console.log(cached[0].values[0][0].substring(0, 2000));
    } else {
      console.log('NOT CACHED');
    }
  }
}
main().catch(console.error);