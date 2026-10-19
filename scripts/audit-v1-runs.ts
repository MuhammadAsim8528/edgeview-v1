import fs from 'node:fs';
import path from 'node:path';
import { resolveOfficialDomain } from '../server/v1_identity';
import { getV1Run } from '../server/v1_engine';

const root = process.cwd();
const runDir = path.join(root, 'data', 'v1-runs');
const latest = new Map<string, any>();
let unreadable = 0;
for (const name of fs.existsSync(runDir) ? fs.readdirSync(runDir).filter(file => /^run-.*\.json$/i.test(file)) : []) {
  try {
    const run = getV1Run(name.replace(/\.json$/i, ''));
    if (!run) { unreadable += 1; continue; }
    const key = `${String(run.company_name).toLowerCase()}\u0000${String(run.country).toLowerCase()}`;
    if (!latest.has(key) || String(latest.get(key).started_at) < String(run.started_at)) {
      const replay = resolveOfficialDomain(run.company_name, run.country, run.results || []);
      const prior = run.identity_resolution?.official_domain || '';
      latest.set(key, { started_at: run.started_at, company: run.company_name, country: run.country, prior_domain: prior, replay_domain: replay.official_domain, changed: prior !== replay.official_domain });
    }
  } catch { unreadable += 1; }
}

const rows = [...latest.values()];

console.log(JSON.stringify({ audited: rows.length, unreadable, changed: rows.filter(row => row.changed).length, changes: rows.filter(row => row.changed) }, null, 2));
