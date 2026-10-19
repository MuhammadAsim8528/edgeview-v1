import initSqlJs from 'sql.js';
import fs from 'fs';

async function main() {
  const SQL = await initSqlJs();
  const fileBuffer = fs.readFileSync('edgeview.db');
  const db = new SQL.Database(fileBuffer);
  
  // Check the research_ledger_runs table schema
  const schema = db.exec("SELECT sql FROM sqlite_master WHERE name='research_ledger_runs'");
  console.log('Schema:');
  if (schema[0]) console.log(schema[0].values[0][0]);
  
  // Get the run with summary
  const run = db.exec(`SELECT research_id, company, country, status, iterations, evidence_count, pages_retrieved, started_at, completed_at, summary FROM research_ledger_runs WHERE research_id='r-1789819284518-z9go3'`);
  console.log('\nRun with summary:');
  if (run[0]) {
    const row = Object.fromEntries(run[0].columns.map((c,i)=>[c,run[0].values[0][i]]));
    console.log('Run:', row.research_id, row.company, row.status, row.summary?.substring(0, 500));
  }
  
  // Check the content of some key cached pages
  const urls = [
    'https://slimpharma.com/contact',
    'https://slimpharma.com/corporate-management',
    'https://slimpharma.com/about-us/'
  ];
  
  for (const url of urls) {
    const cached = db.exec(`SELECT substr(content,1,1000) as preview FROM scraped_url_cache WHERE url=?`, [url]);
    console.log(`\n=== ${url} ===`);
    if (cached[0] && cached[0].values[0]) {
      console.log(cached[0].values[0][0]);
    } else {
      console.log('NOT CACHED');
    }
  }
}
main().catch(console.error);