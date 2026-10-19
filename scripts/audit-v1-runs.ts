import fs from 'node:fs';
import path from 'node:path';
import { resolveOfficialDomain } from '../server/v1_identity';

const root = process.cwd();
const runDir = path.join(root, 'data', 'v1-runs');
const latest = new Map<string, any>();
for (const name of fs.existsSync(runDir) ? fs.readdirSync(runDir).filter(file => /^run-.*\.json$/i.test(file)) : []) {
  try {
    const run = JSON.parse(fs.readFileSync(path.join(runDir, name), 'utf8'));
    const key = `${String(run.company_name).toLowerCase()}\u0000${String(run.country).toLowerCase()}`;
    if (!latest.has(key) || String(latest.get(key).started_at) < String(run.started_at)) latest.set(key, run);
  } catch { /* corrupt evidence is reported by normal run loading */ }
}

const rows = [...latest.values()].map(run => {
  const replay = resolveOfficialDomain(run.company_name, run.country, run.results || []);
  const prior = run.identity_resolution?.official_domain || '';
  return { company: run.company_name, country: run.country, prior_domain: prior, replay_domain: replay.official_domain, changed: prior !== replay.official_domain };
});

console.log(JSON.stringify({ audited: rows.length, changed: rows.filter(row => row.changed).length, changes: rows.filter(row => row.changed) }, null, 2));
