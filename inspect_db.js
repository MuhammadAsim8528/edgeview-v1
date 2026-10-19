const Database = require('better-sqlite3');
const db = new Database('edgeview.db', { readonly: true });

console.log('=== TABLES ===');
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log(tables.map(t => t.name).join(', '));

console.log('\n=== research_ledger_runs schema ===');
try {
  const schema = db.prepare("SELECT sql FROM sqlite_master WHERE name='research_ledger_runs'").get();
  console.log(schema?.sql);
} catch(e) { console.log('table not found'); }

console.log('\n=== research_ledger_actions schema ===');
try {
  const schema = db.prepare("SELECT sql FROM sqlite_master WHERE name='research_ledger_actions'").get();
  console.log(schema?.sql);
} catch(e) { console.log('table not found'); }

console.log('\n=== scraped_url_cache schema ===');
try {
  const schema = db.prepare("SELECT sql FROM sqlite_master WHERE name='scraped_url_cache'").get();
  console.log(schema?.sql);
} catch(e) { console.log('table not found'); }

console.log('\n=== Recent research_ledger_runs (last 30) ===');
try {
  const runs = db.prepare("SELECT research_id, company, country, status, iterations, evidence_count, pages_retrieved, created_at FROM research_ledger_runs ORDER BY created_at DESC LIMIT 30").all();
  runs.forEach(r => console.log(JSON.stringify(r)));
} catch(e) { console.log('error:', e.message); }

console.log('\n=== scraped_url_cache sample ===');
try {
  const cache = db.prepare("SELECT url, substr(content,1,200) as preview, cached_at FROM scraped_url_cache ORDER BY cached_at DESC LIMIT 10").all();
  cache.forEach(c => console.log(c.url, '|', c.preview, '|', c.cached_at));
} catch(e) { console.log('error:', e.message); }