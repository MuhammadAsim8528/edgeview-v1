import initSqlJs from 'sql.js';
import fs from 'fs';

async function main() {
  const DB_PATH = 'edgeview.db';
  const SQL = await initSqlJs();
  const fileBuffer = fs.readFileSync(DB_PATH);
  const db = new SQL.Database(fileBuffer);

  console.log('Repeatedly setting STOPPED to catch worker during its 500ms sleep...');
  
  for (let i = 0; i < 50; i++) {
    // Read current state
    const r = db.exec("SELECT id, status, current_company, current_stage, completed_companies FROM research_jobs WHERE id='job-1789812121356-ww8u06'");
    const state = r[0]?.values?.[0];
    if (state) {
      const cols = r[0].columns;
      const status = state[cols.indexOf('status')];
      const company = state[cols.indexOf('current_company')];
      const completed = state[cols.indexOf('completed_companies')];
      console.log(`Attempt ${i+1}: status=${status}, company=${company}, completed=${completed}`);
      
      if (status === 'STOPPED') {
        console.log('Worker already stopped!');
        break;
      }
    }
    
    // Write STOPPED
    db.run(`UPDATE research_jobs SET status='STOPPED' WHERE id='job-1789812121356-ww8u06'`);
    const data = db.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
    
    // Wait 200ms - shorter than worker's 500ms sleep
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  // Final check
  const final = db.exec("SELECT id, status, current_company, current_stage, completed_companies FROM research_jobs WHERE id='job-1789812121356-ww8u06'");
  console.log('FINAL:', final[0]?.values?.map(v=>Object.fromEntries(final[0].columns.map((c,i)=>[c,v[i]]))));
}
main().catch(console.error);