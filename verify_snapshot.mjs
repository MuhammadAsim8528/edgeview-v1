import initSqlJs from 'sql.js';
import fs from 'fs';

async function main() {
  const DB_PATH = 'edgeview.db';
  const SQL = await initSqlJs();
  const fileBuffer = fs.readFileSync(DB_PATH);
  const db = new SQL.Database(fileBuffer);

  // Get job state
  const job = db.exec("SELECT * FROM research_jobs WHERE id='job-1789812121356-ww8u06'");
  console.log('JOB STATE:');
  if (job[0]) job[0].values.forEach(r => console.log(JSON.stringify(Object.fromEntries(job[0].columns.map((c,i)=>[c,r[i]])))));

  // Get company states
  const states = db.exec("SELECT company_states FROM research_jobs WHERE id='job-1789812121356-ww8u06'");
  if (states[0]?.values[0]?.[0]) {
    const companyStates = JSON.parse(states[0].values[0][0]);
    console.log('\nCOMPANY STATES:');
    const counts = {pending:0, processing:0, completed:0, failed:0};
    for (const [id, state] of Object.entries(companyStates)) {
      counts[state.status]++;
      if (state.status === 'processing' || state.status === 'completed' || state.status === 'failed') {
        console.log(`  ${state.name}: ${state.status} (${state.stage})`);
      }
    }
    console.log('\nCOUNTS:', counts);
  }

  // Research ledger runs for failed companies
  const failedRuns = db.exec(`SELECT research_id, company, country, status, iterations, evidence_count, pages_retrieved, started_at, completed_at FROM research_ledger_runs WHERE status='FAILED' ORDER BY started_at DESC`);
  console.log('\nFAILED RUNS:');
  if (failedRuns[0]) {
    console.log(`Total failed runs: ${failedRuns[0].values.length}`);
    failedRuns[0].values.slice(0,10).forEach(r => console.log(JSON.stringify(Object.fromEntries(failedRuns[0].columns.map((c,i)=>[c,r[i]])))));
  }

  // Pending company IDs
  const pendingRun = db.exec(`SELECT research_id, company, country, status FROM research_ledger_runs WHERE status='PENDING' OR status='RUNNING'`);
  console.log('\nPENDING/RUNNING RUNS:');
  if (pendingRun[0]) console.log(`Total: ${pendingRun[0].values.length}`);

  // Verify integrity
  const integrity = db.exec("PRAGMA integrity_check");
  console.log('\nINTEGRITY CHECK:', integrity[0]?.values?.[0]?.[0]);
}
main().catch(console.error);