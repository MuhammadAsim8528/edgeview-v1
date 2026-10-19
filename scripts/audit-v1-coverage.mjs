import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const runsDir = path.join(root, 'data', 'v1-runs');
const files = fs.readdirSync(runsDir).filter((name) => name.endsWith('.json'));
const runs = files.map((name) => {
  try { return JSON.parse(fs.readFileSync(path.join(runsDir, name), 'utf8')); }
  catch { return null; }
}).filter(Boolean);
const key = (run) => `${String(run.company_name || '').trim().toLowerCase()}__${String(run.country || '').trim().toLowerCase()}`;
const latest = new Map();
for (const run of runs) {
  const prior = latest.get(key(run));
  if (!prior || String(run.completed_at || run.started_at) > String(prior.completed_at || prior.started_at)) latest.set(key(run), run);
}

const providerFailures = new Map();
const providerSuccesses = new Map();
const rejectedDomainReasons = new Map();
const weak = [];
for (const run of latest.values()) {
  for (const raw of run.raw_records || []) {
    const map = raw.failure ? providerFailures : providerSuccesses;
    map.set(raw.provider, (map.get(raw.provider) || 0) + 1);
  }
  const claims = run.evidence_workspace?.accepted_claims || [];
  const officialDomain = run.identity_resolution?.official_domain || '';
  if (!officialDomain) {
    for (const candidate of run.identity_resolution?.candidates || []) {
      for (const reason of candidate.reasons || []) rejectedDomainReasons.set(reason, (rejectedDomainReasons.get(reason) || 0) + 1);
    }
  }
  const officialPages = (run.results || []).filter((result) => {
    try { return officialDomain && new URL(result.url).hostname.replace(/^www\./, '').endsWith(officialDomain.replace(/^www\./, '')); }
    catch { return false; }
  });
  if (claims.length === 0) weak.push({
    id: run.id,
    company_name: run.company_name,
    country: run.country,
    status: run.status,
    official_domain: officialDomain,
    results: (run.results || []).length,
    official_pages: officialPages.length,
    raw_records: (run.raw_records || []).length,
    failures: (run.raw_records || []).filter((raw) => raw.failure).length,
    rejected_claims: (run.evidence_workspace?.rejected_claims || []).length,
  });
}
const count = (predicate) => [...latest.values()].filter(predicate).length;
const report = {
  generated_at: new Date().toISOString(),
  run_files: runs.length,
  latest_entities: latest.size,
  with_official_domain: count((run) => Boolean(run.identity_resolution?.official_domain)),
  with_accepted_claims: count((run) => (run.evidence_workspace?.accepted_claims || []).length > 0),
  with_any_results: count((run) => (run.results || []).length > 0),
  with_official_page_capture: count((run) => {
    const domain = run.identity_resolution?.official_domain;
    return Boolean(domain && (run.results || []).some((result) => {
      try { return new URL(result.url).hostname.replace(/^www\./, '').endsWith(domain.replace(/^www\./, '')) && Boolean(result.text || result.markdown || result.html); }
      catch { return false; }
    }));
  }),
  zero_claim_entities: weak.length,
  zero_claim_with_domain: weak.filter((item) => item.official_domain).length,
  zero_claim_with_official_pages: weak.filter((item) => item.official_pages > 0).length,
  provider_failures: Object.fromEntries([...providerFailures.entries()].sort((a, b) => b[1] - a[1])),
  provider_successes: Object.fromEntries([...providerSuccesses.entries()].sort((a, b) => b[1] - a[1])),
  rejected_domain_reasons: Object.fromEntries([...rejectedDomainReasons.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30)),
  weakest: weak.sort((a, b) => Number(Boolean(b.official_domain)) - Number(Boolean(a.official_domain)) || b.results - a.results).slice(0, 100),
};
const output = path.join(root, 'v1-coverage-audit.json');
fs.writeFileSync(output, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ output, ...report, weakest: undefined }, null, 2));
