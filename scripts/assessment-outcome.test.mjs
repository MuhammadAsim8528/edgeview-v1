import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import initSqlJs from 'sql.js';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'edgeview-assessment-outcome-'));
const script = path.resolve('assess_standalone.mjs');
try {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  db.run(`CREATE TABLE research_ledger_runs (
    research_id TEXT, company TEXT, country TEXT, status TEXT, iterations INTEGER,
    evidence_count INTEGER, pages_retrieved INTEGER, started_at TEXT, completed_at TEXT
  )`);
  db.run(`CREATE TABLE research_ledger_actions (
    research_id TEXT, iteration INTEGER, action_type TEXT, target_type TEXT, provider TEXT, query TEXT,
    status TEXT, information_gain REAL, latency_ms INTEGER, error TEXT
  )`);
  db.run('CREATE TABLE scraped_url_cache (url TEXT, content TEXT)');
  const save = () => fs.writeFileSync(path.join(root, 'edgeview.db'), Buffer.from(db.export()));
  const run = () => spawnSync(process.execPath, [script], { cwd: root, encoding: 'utf8', timeout: 60_000, windowsHide: true, maxBuffer: 1024 * 1024 });

  save();
  const empty = run();
  assert.equal(empty.status, 1, 'missing runs must produce a failing assessment');
  assert.match(empty.stdout, /"NO_RUN":\s*[1-9]/);
  assert.match(empty.stdout, /"INCOMPLETE":\s*[1-9]/);

  const source = fs.readFileSync(script, 'utf8');
  const companyBlock = source.match(/const failedCompanies = \[([\s\S]*?)\];/)?.[1];
  assert.ok(companyBlock, 'assessment fixture must discover the actual requested company set');
  const companies = [...companyBlock.matchAll(/'((?:[^'\\]|\\.)*)'/g)].map(match => match[1]);
  assert.ok(companies.length > 1);
  companies.forEach((company, index) => {
    const id = `synthetic-run-${index}`;
    const url = `https://fixture.invalid/evidence-${index}`;
    db.run('INSERT INTO research_ledger_runs VALUES (?,?,?,?,?,?,?,?,?)', [id, company, 'Kenya', 'COMPLETED', 1, 1, 1, '2026-01-01T00:00:00Z', '2026-01-01T00:01:00Z']);
    db.run("INSERT INTO research_ledger_actions VALUES (?,1,'FETCH','page','fixture',?,'success',1,1,NULL)", [id, url]);
    db.run('INSERT INTO scraped_url_cache VALUES (?,?)', [url, `${company} Kenya pharmaceutical medical contact email`]);
  });
  save();
  const complete = run();
  assert.equal(complete.status, 0, complete.stderr || complete.stdout.slice(-2000));
  assert.match(complete.stdout, /"INCOMPLETE":\s*0/);
  console.log('PASS standalone assessment exits nonzero for missing evidence and zero for a complete synthetic assessment');
} finally {
  assert.equal(path.dirname(fs.realpathSync(root)), fs.realpathSync(os.tmpdir()));
  fs.rmSync(root, { recursive: true, force: true });
}
