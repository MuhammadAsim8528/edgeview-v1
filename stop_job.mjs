import initSqlJs from 'sql.js';
import fs from 'fs';

async function main() {
  const DB_PATH = 'edgeview.db';
  const SQL = await initSqlJs();
  const fileBuffer = fs.readFileSync(DB_PATH);
  const db = new SQL.Database(fileBuffer);

  // First, check current status
  const before = db.exec(`SELECT id, status, current_company, current_stage, completed_companies FROM research_jobs WHERE id='job-1789812121356-ww8u06'`);
  console.log('BEFORE STOP:');
  if (before[0]) before[0].values.forEach(r => console.log(JSON.stringify(Object.fromEntries(before[0].columns.map((c,i)=>[c,r[i]])))));

  // Set status to STOPPED
  db.run(`UPDATE research_jobs SET status='STOPPED' WHERE id='job-1789812121356-ww8u06'`);
  
  // Persist to disk
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
  console.log('\nSTOPPED status written to DB.');

  // Verify
  const after = db.exec(`SELECT id, status, current_company, current_stage, completed_companies FROM research_jobs WHERE id='job-1789812121356-ww8u06'`);
  console.log('AFTER STOP:');
  if (after[0]) after[0].values.forEach(r => console.log(JSON.stringify(Object.fromEntries(after[0].columns.map((c,i)=>[c,r[i]])))));
}

main().catch(console.error);