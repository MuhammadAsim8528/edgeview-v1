import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const experimentDir = path.join(repoRoot, '.test-cache', `entity-proof-hamar-${Date.now()}`);
fs.mkdirSync(experimentDir, { recursive: true });
process.env.EDGEVIEW_TEST_MODE = '1';
process.env.EDGEVIEW_TEST_DB_DIR = experimentDir;
process.env.EDGEVIEW_SQLITE_DB = path.join(experimentDir, 'edgeview.db');
process.env.EDGEVIEW_JSON_DB = path.join(experimentDir, 'edgeview_db.json');
process.env.EDGEVIEW_CONFIG = path.join(repoRoot, 'config.json'); // read-only in this experiment
process.env.EDGEVIEW_ENTITY_PROOF_SEARCH_V1 = 'true';

const [{ AutonomousResearchRuntime }, { getAppSettings }, { ResourceGovernor }] = await Promise.all([
  import('../research_runtime'),
  import('../settings'),
  import('../resource_governor'),
]);

const settings = getAppSettings();
ResourceGovernor.resetStats();
const started = Date.now();
const result = await AutonomousResearchRuntime.run('HAMAR TRADING COMPANY', {
  country: 'Somalia',
  role: 'Importer',
  known_products: [
    'Femicon 5ml Drops', 'CaC-1000 Plus Effervescent Tablets', 'ERO-B 120ml Syrup',
    'Oxytocin 10iu/ml Injection', 'Probeta-N 7.5ml Drops', 'Ascard 75mg Tablets',
  ],
  traded_with: ['SIMBA ENTERPRISES', 'HASNAIN GROUPS OF COMPANIES.'],
  website_verified: false,
  dataset_id: 'production-context-read-only',
}, settings, true);
const elapsed_ms = Date.now() - started;

const compactMetrics = Object.fromEntries(Object.entries(ResourceGovernor.getAllProviderMetrics()).map(([provider, value]: [string, any]) => [provider, {
  requests: value.requestCount,
  successes: value.successCount,
  failures: value.failureCount,
  retries: value.retryCount,
  total_duration_ms: value.totalLatencyMs,
}]));
const proof = result?.entity_proof || null;
const serialized = JSON.stringify(result || {});
const output = {
  experiment: 'ENTITY_PROOF_SEARCH_V1_1',
  production_persistence_used: false,
  isolated_directory: experimentDir,
  elapsed_ms,
  entity_key: proof?.fingerprint?.entity_key || 'hamar trading company__somalia',
  quality_status: result?.quality_status || '',
  website: result?.website || '',
  emails: result?.emails_list || [],
  phones: result?.phones_list || [],
  addresses: result?.addresses || (result?.address ? [result.address] : []),
  leadership: result?.decision_makers || [],
  sources: result?.sources || [],
  proof,
  kobac_matches: (serialized.match(/kobac/gi) || []).length,
  provider_metrics: compactMetrics,
};
const tracePath = path.join(repoRoot, '.agent', 'traces', 'entity-proof-hamar-v1-1-live-experiment.json');
fs.mkdirSync(path.dirname(tracePath), { recursive: true });
fs.writeFileSync(tracePath, JSON.stringify(output, null, 2), 'utf8');
console.log(JSON.stringify({
  trace_path: tracePath,
  elapsed_ms,
  quality_status: output.quality_status,
  entity_proof_result: proof?.result || 'UNAVAILABLE',
  candidates: proof?.candidates?.map((candidate: any) => ({ id: candidate.candidate_id, status: candidate.status, domains: candidate.domains })) || [],
  queries: proof?.action_history?.map((action: any) => ({ query: action.query, discriminator: action.discriminator, utility: action.utility })) || [],
  website: output.website,
  emails: output.emails,
  phones: output.phones,
  addresses: output.addresses,
  leadership_count: output.leadership.length,
  source_urls: output.sources.map((source: any) => source?.url || source).filter(Boolean),
  kobac_matches: output.kobac_matches,
  provider_metrics: compactMetrics,
}, null, 2));
