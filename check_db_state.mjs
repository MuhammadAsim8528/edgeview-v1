import initSqlJs from 'sql.js';
import fs from 'fs';

async function main() {
  const SQL = await initSqlJs();
  const db = new SQL.Database(fs.readFileSync('edgeview.db'));
  const r = db.exec("SELECT id, status, current_company, current_stage, completed_companies FROM research_jobs WHERE id='job-1789812121356-ww8u06'");
  console.log('DB STATE:', r[0]?.values?.map(v=>Object.fromEntries(r[0].columns.map((c,i)=>[c,v[i]]))));
}
main().catch(console.error);