import initSqlJs from 'sql.js';
import fs from 'fs';

async function main() {
  const DB_PATH = 'edgeview.db';
  const SQL = await initSqlJs();
  const fileBuffer = fs.readFileSync(DB_PATH);
  const db = new SQL.Database(fileBuffer);

  // Set STOPPED once
  db.run(`UPDATE research_jobs SET status='STOPPED' WHERE id='job-1789812121356-ww8u06'`);
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
  console.log('STOPPED written. Waiting for worker to exit at next iteration boundary...');
  
  // Monitor until worker exits (status stays STOPPED and completed_companies stops increasing)
  let lastCompleted = -1;
  let stableCount = 0;
  
  for (let i = 0; i < 200; i++) {
    await new Promise(resolve => setTimeout(resolve, 5000)); // 5 second polls
    
    const r = db.exec("SELECT id, status, current_company, current_stage, completed_companies FROM research_jobs WHERE id='job-1789812121356-ww8u06'");
    const state = r[0]?.values?.[0];
    if (state) {
      const cols = r[0].columns;
      const status = state[cols.indexOf('status')];
      const company = state[cols.indexOf('current_company')];
      const completed = state[cols.indexOf('completed_companies')];
      console.log(`Poll ${i+1}: status=${status}, company=${company}, completed=${completed}`);
      
      if (status === 'STOPPED') {
        if (completed === lastCompleted) {
          stableCount++;
          if (stableCount >= 2) {
            console.log('Worker has exited cleanly (status STOPPED, completed stable).');
            break;
          }
        } else {
          stableCount = 0;
          lastCompleted = completed;
        }
      } else {
        stableCount = 0;
        lastCompleted = completed;
      }
    }
  }
  
  // Final state
  const final = db.exec("SELECT id, status, current_company, current_stage, completed_companies FROM research_jobs WHERE id='job-1789812121356-ww8u06'");
  console.log('FINAL:', final[0]?.values?.map(v=>Object.fromEntries(final[0].columns.map((c,i)=>[c,v[i]]))));
}
main().catch(console.error);