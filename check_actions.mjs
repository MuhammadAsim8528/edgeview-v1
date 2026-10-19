import initSqlJs from 'sql.js';
import fs from 'fs';

async function main() {
  const DB_PATH = 'edgeview.db';
  const SQL = await initSqlJs();
  const fileBuffer = fs.readFileSync(DB_PATH);
  const db = new SQL.Database(fileBuffer);

  // Check action types
  const actionTypes = db.exec("SELECT DISTINCT action_type FROM research_ledger_actions");
  console.log('Action types:', actionTypes[0]?.values?.flat() || 'none');

  // Check for EXECUTE_QUERY actions with URLs
  const queryActions = db.exec(`SELECT action_type, query, target_type, provider, status, information_gain 
    FROM research_ledger_actions 
    WHERE research_id='r-1789816705524-eai0r' ORDER BY iteration`);
  console.log('\nTAWAKAL actions:');
  if (queryActions[0]) queryActions[0].values.forEach(a => console.log(JSON.stringify(Object.fromEntries(queryActions[0].columns.map((c,i)=>[c,a[i]])))));

  // Check what URLs are in scraped_url_cache for TAWAKAL
  const tawakalUrls = db.exec(`SELECT url, substr(content,1,300) as preview FROM scraped_url_cache 
    WHERE url LIKE '%tawakal%' OR url LIKE '%tawakul%' ORDER BY cached_at DESC LIMIT 10`);
  console.log('\nTAWAKAL cached URLs:');
  if (tawakalUrls[0]) tawakalUrls[0].values.forEach(c => console.log(c[0], '|', c[1]));

  // Check SIXA URLs
  const sixaUrls = db.exec(`SELECT url, substr(content,1,300) as preview FROM scraped_url_cache 
    WHERE url LIKE '%sixa%' ORDER BY cached_at DESC LIMIT 10`);
  console.log('\nSIXA cached URLs:');
  if (sixaUrls[0]) sixaUrls[0].values.forEach(c => console.log(c[0], '|', c[1]));

  // Check GLOBE PHARMACY URLs
  const globeUrls = db.exec(`SELECT url, substr(content,1,300) as preview FROM scraped_url_cache 
    WHERE url LIKE '%globe%' ORDER BY cached_at DESC LIMIT 10`);
  console.log('\nGLOBE cached URLs:');
  if (globeUrls[0]) globeUrls[0].values.forEach(c => console.log(c[0], '|', c[1]));

  // Check all cached URLs sample
  const allUrls = db.exec(`SELECT url, substr(content,1,200) as preview FROM scraped_url_cache ORDER BY cached_at DESC LIMIT 30`);
  console.log('\nAll recent cached URLs:');
  if (allUrls[0]) allUrls[0].values.forEach(c => console.log(c[0], '|', c[1]));
}

main().catch(console.error);