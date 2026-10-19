import initSqlJs from 'sql.js';
import fs from 'fs';

async function main() {
  const SQL = await initSqlJs();
  const fileBuffer = fs.readFileSync('edgeview.db');
  const db = new SQL.Database(fileBuffer);
  
  // Check the latest Slim run details
  const runId = 'r-1789819284518-z9go3';
  
  const actions = db.exec(`SELECT iteration, action_type, target_type, provider, query, status, information_gain, latency_ms, error 
    FROM research_ledger_actions 
    WHERE research_id=? ORDER BY iteration`, [runId]);
  
  console.log('Actions for latest Slim run:');
  if (actions[0]) {
    actions[0].values.forEach(a => {
      const obj = Object.fromEntries(actions[0].columns.map((c,i)=>[c,a[i]]));
      console.log(JSON.stringify(obj));
    });
  }
  
  // Check entityProofObservations for this run
  const obs = db.exec(`SELECT * FROM research_ledger_actions WHERE research_id=? AND action_type='EXTRACT_INFORMATION'`, [runId]);
  console.log('\nEXTRACT_INFORMATION actions:');
  if (obs[0]) {
    obs[0].values.forEach(o => console.log(JSON.stringify(Object.fromEntries(obs[0].columns.map((c,i)=>[c,o[i]])))));
  }
  
  // Check what URLs were actually fetched for this run
  const fetched = db.exec(`SELECT iteration, action_type, target_type, provider, query, status, information_gain 
    FROM research_ledger_actions 
    WHERE research_id=? AND action_type='EXECUTE_QUERY' AND status='SUCCESS' ORDER BY iteration`, [runId]);
  console.log('\nSuccessful queries:');
  if (fetched[0]) {
    fetched[0].values.forEach(f => console.log(JSON.stringify(Object.fromEntries(fetched[0].columns.map((c,i)=>[c,f[i]])))));
  }
}
main().catch(console.error);