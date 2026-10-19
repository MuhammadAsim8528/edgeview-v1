import initSqlJs from 'sql.js';
import fs from 'fs';

async function main() {
  const SQL = await initSqlJs();
  const fileBuffer = fs.readFileSync('edgeview.db');
  const db = new SQL.Database(fileBuffer);
  
  // Check what pages were actually scraped for this run
  const scraped = db.exec(`SELECT DISTINCT url FROM scraped_url_cache WHERE url LIKE '%slimpharma%' ORDER BY cached_at DESC LIMIT 20`);
  console.log('Cached Slim URLs:');
  if (scraped[0]) scraped[0].values.forEach(s => console.log(s[0]));
  
  // Check the research_ledger for the run details including entityProofObservations
  const run = db.exec(`SELECT summary FROM research_ledger_runs WHERE research_id='r-1789819284518-z9go3'`);
  console.log('\nRun summary:');
  if (run[0]) {
    const summary = JSON.parse(run[0].values[0][0]);
    console.log(JSON.stringify(summary, null, 2));
  }
  
  // Check the entityProofObservations for this run
  const obs = db.exec(`SELECT url, title, content, source_type, admission_decision, admission_reason FROM scraped_url_cache WHERE url LIKE '%slimpharma%'`);
  console.log('\nCached observations for Slim:');
  if (obs[0]) {
    obs[0].values.forEach(o => {
      console.log('URL:', o[0]);
      console.log('Title:', o[1]);
      console.log('Content preview:', o[2]?.substring(0, 300));
      console.log('---');
    });
  }
}
main().catch(console.error);