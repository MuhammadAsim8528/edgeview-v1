import initSqlJs from 'sql.js';
import fs from 'fs';

async function main() {
  const SQL = await initSqlJs();
  const fileBuffer = fs.readFileSync('edgeview.db');
  const db = new SQL.Database(fileBuffer);
  
  // Get the run ID
  const runId = 'r-1789819284518-z9go3';
  
  // Get all actions with details
  const actions = db.exec(`SELECT iteration, action_type, target_type, provider, query, status, information_gain, latency_ms, error 
    FROM research_ledger_actions 
    WHERE research_id=? ORDER BY iteration`, ['r-1789819284518-z9go3']);
  
  console.log('All actions for latest Slim run:');
  if (actions[0]) {
    actions[0].values.forEach(a => {
      const obj = Object.fromEntries(actions[0].columns.map((c,i)=>[c,a[i]]));
      console.log(JSON.stringify(obj));
    });
  }
}
main().catch(console.error);