/**
 * Isolated, resumable cold contact-recovery benchmark.
 * Frozen truth values are evaluation-only and never enter research prompts.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { ExtractedCompanyDetails } from '../enrichment';
import type { AppSettings } from '../settings';
import type { DatabaseWrapper } from '../sqlite';
import type { ProviderStats } from '../resource_governor';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const ORIGINAL_18_PATH = path.join(REPO_ROOT, '.agent', 'benchmarks', 'IMPORTER_CONTACT_RECOVERY_ORIGINAL_18_FROZEN.json');
const EXPANDED_PATH = path.join(REPO_ROOT, '.agent', 'benchmarks', 'IMPORTER_CONTACT_RECOVERY_TRUTHSET_V1_FROZEN.json');
const SECRET_FIELDS = [
  'serper_api_key', 'firecrawl_api_key', 'nvidia_api_key', 'groq_api_key',
  'hunter_api_key', 'tavily_api_key', 'exa_api_key', 'linkup_api_key', 'apify_api_key',
] as const;

export interface TruthFact {
  field: string;
  value?: string | number;
  status: 'VERIFIED' | 'PARTIAL' | 'UNKNOWN';
  source_url?: string;
  source_authority?: string;
  note?: string;
}

export interface TruthEntity {
  company: string;
  country: string;
  cohort: string;
  facts: TruthFact[];
}

interface Truthset {
  version: string;
  created_at: string;
  policy: string;
  entities: TruthEntity[];
}

type EntityRunState = 'RUNNING' | 'INVALID' | 'PARTIAL_PROVIDER_FAILURE' | 'COMPLETED';
type FactStatus = 'RECOVERED_CORRECTLY' | 'MISSED' | 'WRONG' | 'PROVIDER_BLOCKED' | 'RETRIEVAL_BLOCKED';

export interface FactScore {
  fact_index: number;
  field: string;
  expected_value: string | number;
  status: FactStatus;
  recovered_value?: string | number | Array<string | number>;
  first_loss_boundary?: string;
}

export interface EntityResult {
  company: string;
  country: string;
  state: EntityRunState;
  facts: FactScore[];
  started_at: string;
  completed_at?: string;
  error?: string;
  provider_calls: number;
  retrieval_calls: number;
  model_calls: number;
  latency_ms: number;
}

type MetricsSnapshot = Record<string, ProviderStats>;

interface RunnerOptions {
  runId?: string;
  maxEntities?: number;
  enrich?: (company: string, forceFetch: boolean, context: { country: string; role: 'Importer'; deep_recovery: true }) => Promise<ExtractedCompanyDetails>;
}

function safeRunId(value: string): string {
  if (!/^[a-zA-Z0-9._-]+$/.test(value)) throw new Error('Run ID may contain only letters, numbers, dot, underscore, and hyphen');
  return value;
}

export function loadBenchmarkTruthset(track: 'A' | 'B'): Truthset {
  const source = JSON.parse(fs.readFileSync(track === 'A' ? ORIGINAL_18_PATH : EXPANDED_PATH, 'utf-8'));
  if (track === 'B') return source as Truthset;

  const entities = new Map<string, TruthEntity>();
  for (const raw of source.facts || []) {
    const key = `${raw.company}\u0000${raw.country}`;
    if (!entities.has(key)) {
      entities.set(key, { company: raw.company, country: raw.country, cohort: 'original-18', facts: [] });
    }
    entities.get(key)!.facts.push({
      field: raw.field,
      value: raw.value,
      status: 'VERIFIED',
    });
  }
  return {
    version: 'original-18',
    created_at: source.frozen_at || '',
    policy: source.purpose || 'Exactly the original 18 VERIFIED facts.',
    entities: Array.from(entities.values()),
  };
}

function normalizeText(value: unknown): string {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}@.+-]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeForField(value: unknown, field: string): string {
  const key = field.toLowerCase();
  if (key === 'phone' || key === 'fax') return String(value ?? '').replace(/\D/g, '');
  if (key === 'website') {
    try {
      const parsed = new URL(String(value));
      return parsed.hostname.toLowerCase().replace(/^www\./, '');
    } catch {
      return normalizeText(value).replace(/^www\./, '');
    }
  }
  return normalizeText(value);
}

export function scoreBenchmarkFact(
  fact: TruthFact,
  recovered: unknown,
  factIndex: number,
  evidenceCount = 0,
): FactScore {
  if (fact.status !== 'VERIFIED' || fact.value === undefined) {
    throw new Error('Only VERIFIED facts with expected values may be scored');
  }
  const values = (Array.isArray(recovered) ? recovered : [recovered])
    .filter((value) => value !== undefined && value !== null && String(value).trim() !== '') as Array<string | number>;
  const expected = normalizeForField(fact.value, fact.field);
  const matched = values.some((value) => normalizeForField(value, fact.field) === expected);
  const base = { fact_index: factIndex, field: fact.field, expected_value: fact.value };

  if (matched) return { ...base, status: 'RECOVERED_CORRECTLY', recovered_value: values.length === 1 ? values[0] : values };
  if (values.length === 0) {
    return {
      ...base,
      status: 'MISSED',
      first_loss_boundary: 'UNTRACED',
    };
  }
  return {
    ...base,
    status: 'WRONG',
    recovered_value: values.length === 1 ? values[0] : values,
    first_loss_boundary: 'VALIDATION_FAILURE',
  };
}

function uniquePeople(result: ExtractedCompanyDetails): Array<{ name: string; designation?: string }> {
  const people = [...(result.contact_persons || []), ...(result.decision_makers || [])];
  const seen = new Set<string>();
  return people.filter((person) => {
    const key = normalizeText(person.name);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function officialPeople(result: ExtractedCompanyDetails): Array<{ name: string; designation?: string }> {
  let websiteHost = '';
  try { websiteHost = new URL(result.website).hostname.toLowerCase().replace(/^www\./, ''); } catch (_) {}
  if (!websiteHost) return uniquePeople(result);
  return uniquePeople(result).filter((person: any) => {
    try {
      const sourceHost = new URL(String(person.source_url || '')).hostname.toLowerCase().replace(/^www\./, '');
      return sourceHost === websiteHost || sourceHost.endsWith(`.${websiteHost}`);
    } catch {
      return false;
    }
  });
}

export function extractRecoveredValue(fact: TruthFact, result: ExtractedCompanyDetails): unknown {
  switch (fact.field.toLowerCase()) {
    case 'email': return [...(result.emails_list || []), result.email].filter(Boolean);
    case 'phone': return [...(result.phones_list || []), result.phone].filter(Boolean);
    case 'fax': return result.fax_numbers || [];
    case 'address': return [...(result.addresses || []).map((item) => item.address), result.address].filter(Boolean);
    case 'website': return result.website;
    case 'entity': return result.company_name;
    case 'leaders': {
      const people = typeof fact.value === 'number' ? officialPeople(result) : uniquePeople(result);
      return typeof fact.value === 'number' ? people.length : people.map((person) => `${person.name} ${person.designation || ''}`.trim());
    }
    case 'leadership': return uniquePeople(result).map((person) => `${person.name} ${person.designation || ''}`.trim());
    default: return (result as unknown as Record<string, unknown>)[fact.field];
  }
}

function metricDelta(before: MetricsSnapshot, after: MetricsSnapshot, providers: string[]): number {
  return providers.reduce((sum, provider) => {
    const prior = before[provider]?.requestCount || 0;
    const current = after[provider]?.requestCount || 0;
    return sum + Math.max(0, current - prior);
  }, 0);
}

function blockedStatus(error: unknown): { state: EntityRunState; status: FactStatus; boundary: string } {
  const message = String((error as any)?.message || error || '').toLowerCase();
  const retrieval = /firecrawl|serper|tavily|exa|linkup|hunter|scrap|search|fetch failed|retriev/.test(message);
  if (retrieval) return { state: 'PARTIAL_PROVIDER_FAILURE', status: 'RETRIEVAL_BLOCKED', boundary: 'RETRIEVAL_PROVIDER_FAILURE' };
  if (/nvidia|groq|gemini|model|quota|rate limit|\b(?:400|401|403|408|429|5\d\d)\b/.test(message)) {
    return { state: 'PARTIAL_PROVIDER_FAILURE', status: 'PROVIDER_BLOCKED', boundary: 'MODEL_PROVIDER_FAILURE' };
  }
  return { state: 'INVALID', status: 'PROVIDER_BLOCKED', boundary: 'RUNNER_FAILURE' };
}

export class ColdBenchmarkRunner {
  private readonly runId: string;
  private readonly track: 'A' | 'B';
  private readonly truthset: Truthset;
  private readonly runDir: string;
  private readonly benchmarkDbPath: string;
  private readonly maxEntities?: number;
  private readonly injectedEnrich?: RunnerOptions['enrich'];
  private benchmarkDb: DatabaseWrapper | null = null;
  private results: EntityResult[] = [];
  private runStartedAt = new Date().toISOString();

  constructor(track: 'A' | 'B' = 'A', options: RunnerOptions = {}) {
    this.track = track;
    this.runId = safeRunId(options.runId || `bench-${track.toLowerCase()}-${Date.now()}`);
    this.truthset = loadBenchmarkTruthset(track);
    this.runDir = path.join(REPO_ROOT, '.test-cache', 'cold-benchmarks', this.runId);
    this.benchmarkDbPath = path.join(this.runDir, 'edgeview.db');
    this.maxEntities = options.maxEntities;
    this.injectedEnrich = options.enrich;
  }

  private async prepareIsolatedRuntime(): Promise<void> {
    fs.mkdirSync(this.runDir, { recursive: true });
    process.env.EDGEVIEW_TEST_MODE = '1';
    process.env.EDGEVIEW_TEST_DB_DIR = this.runDir;
    process.env.EDGEVIEW_SQLITE_DB = this.benchmarkDbPath;
    process.env.EDGEVIEW_JSON_DB = path.join(this.runDir, 'edgeview.json');

    const { getAppSettingsFromPath } = await import('../settings');
    const canonical = getAppSettingsFromPath(path.join(REPO_ROOT, 'config.json'));
    const envByField: Partial<Record<(typeof SECRET_FIELDS)[number], string>> = {
      serper_api_key: 'SERPER_API_KEY', firecrawl_api_key: 'FIRECRAWL_API_KEY', nvidia_api_key: 'NVIDIA_API_KEY',
      groq_api_key: 'GROQ_API_KEY', hunter_api_key: 'HUNTER_API_KEY', tavily_api_key: 'TAVILY_API_KEY',
      exa_api_key: 'EXA_API_KEY', linkup_api_key: 'LINKUP_API_KEY', apify_api_key: 'APIFY_API_KEY',
    };
    for (const field of SECRET_FIELDS) {
      const envName = envByField[field];
      if (envName && canonical[field]) process.env[envName] = canonical[field];
    }

    const isolatedSettings: AppSettings = { ...canonical };
    for (const field of SECRET_FIELDS) isolatedSettings[field] = '';
    const isolatedConfig = path.join(this.runDir, 'config.json');
    fs.writeFileSync(isolatedConfig, JSON.stringify(isolatedSettings, null, 2), 'utf-8');
    process.env.EDGEVIEW_CONFIG = isolatedConfig;
  }

  async initialize(): Promise<void> {
    await this.prepareIsolatedRuntime();
    const { getDb } = await import('../sqlite');
    this.benchmarkDb = await getDb();
    await this.benchmarkDb.exec(`
      CREATE TABLE IF NOT EXISTS benchmark_runs (
        run_id TEXT PRIMARY KEY, track TEXT NOT NULL, started_at TEXT NOT NULL, completed_at TEXT, status TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS entity_results (
        run_id TEXT NOT NULL, company TEXT NOT NULL, country TEXT NOT NULL, state TEXT NOT NULL,
        facts_json TEXT NOT NULL, started_at TEXT NOT NULL, completed_at TEXT, error TEXT,
        provider_calls INTEGER NOT NULL DEFAULT 0, retrieval_calls INTEGER NOT NULL DEFAULT 0,
        model_calls INTEGER NOT NULL DEFAULT 0, latency_ms INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (run_id, company, country)
      );
      CREATE TABLE IF NOT EXISTS benchmark_fact_results (
        run_id TEXT NOT NULL, company TEXT NOT NULL, country TEXT NOT NULL, fact_index INTEGER NOT NULL,
        field TEXT NOT NULL, expected_value TEXT NOT NULL, status TEXT NOT NULL,
        recovered_value TEXT, first_loss_boundary TEXT,
        PRIMARY KEY (run_id, company, country, fact_index)
      );
    `);
    const existing = await this.benchmarkDb.get('SELECT track, started_at FROM benchmark_runs WHERE run_id = ?', [this.runId]);
    if (existing && existing.track !== this.track) throw new Error(`Run ${this.runId} belongs to Track ${existing.track}`);
    if (existing) {
      this.runStartedAt = existing.started_at;
      await this.benchmarkDb.run('UPDATE benchmark_runs SET status = ?, completed_at = NULL WHERE run_id = ?', ['RUNNING', this.runId]);
    } else {
      await this.benchmarkDb.run(
        'INSERT INTO benchmark_runs (run_id, track, started_at, status) VALUES (?, ?, ?, ?)',
        [this.runId, this.track, this.runStartedAt, 'RUNNING'],
      );
    }
  }

  async loadPreviousState(): Promise<void> {
    if (!this.benchmarkDb) throw new Error('Benchmark database is not initialized');
    const rows = await this.benchmarkDb.all(
      "SELECT * FROM entity_results WHERE run_id = ? AND state = 'COMPLETED'",
      [this.runId],
    );
    this.results = rows.map((row) => ({
      company: row.company, country: row.country, state: row.state, facts: JSON.parse(row.facts_json),
      started_at: row.started_at, completed_at: row.completed_at || undefined, error: row.error || undefined,
      provider_calls: Number(row.provider_calls), retrieval_calls: Number(row.retrieval_calls),
      model_calls: Number(row.model_calls), latency_ms: Number(row.latency_ms),
    }));
  }

  private async saveEntityResult(result: EntityResult): Promise<void> {
    if (!this.benchmarkDb) throw new Error('Benchmark database is not initialized');
    const key = `${result.company}\u0000${result.country}`;
    this.results = this.results.filter((item) => `${item.company}\u0000${item.country}` !== key);
    this.results.push(result);
    await this.benchmarkDb.run(
      `INSERT OR REPLACE INTO entity_results
       (run_id, company, country, state, facts_json, started_at, completed_at, error, provider_calls, retrieval_calls, model_calls, latency_ms)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [this.runId, result.company, result.country, result.state, JSON.stringify(result.facts), result.started_at,
        result.completed_at || null, result.error || null, result.provider_calls, result.retrieval_calls,
        result.model_calls, result.latency_ms],
    );
    for (const fact of result.facts) {
      await this.benchmarkDb.run(
        `INSERT OR REPLACE INTO benchmark_fact_results
         (run_id, company, country, fact_index, field, expected_value, status, recovered_value, first_loss_boundary)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [this.runId, result.company, result.country, fact.fact_index, fact.field, String(fact.expected_value),
          fact.status, fact.recovered_value === undefined ? null : JSON.stringify(fact.recovered_value),
          fact.first_loss_boundary || null],
      );
    }
  }

  async runEntity(entity: TruthEntity): Promise<EntityResult> {
    const startedAt = new Date().toISOString();
    const result: EntityResult = {
      company: entity.company, country: entity.country, state: 'RUNNING', facts: [], started_at: startedAt,
      provider_calls: 0, retrieval_calls: 0, model_calls: 0, latency_ms: 0,
    };
    const verifiedFacts = entity.facts.filter((fact) => fact.status === 'VERIFIED' && fact.value !== undefined);
    const { ResourceGovernor } = await import('../resource_governor');
    const before = ResourceGovernor.getAllProviderMetrics() as MetricsSnapshot;
    const started = Date.now();
    try {
      const enrich = this.injectedEnrich || (await import('../enrichment')).enrichCompanyDetails;
      const enrichment = await enrich(entity.company, true, { country: entity.country, role: 'Importer', deep_recovery: true });
      const evidenceCount = (enrichment.sources || []).length + (enrichment.evidence || []).length;
      if (enrichment.quality_status === 'FAILED') {
        const blocked = blockedStatus(enrichment.source || 'model provider failure');
        result.state = blocked.state;
        result.error = String(enrichment.source || 'Enrichment returned FAILED').slice(0, 500);
        result.facts = verifiedFacts.map((fact, index) => ({
          fact_index: index, field: fact.field, expected_value: fact.value!, status: blocked.status,
          first_loss_boundary: blocked.boundary,
        }));
      } else {
        result.facts = verifiedFacts.map((fact, index) => scoreBenchmarkFact(fact, extractRecoveredValue(fact, enrichment), index, evidenceCount));
        result.state = 'COMPLETED';
      }
    } catch (error: any) {
      const blocked = blockedStatus(error);
      result.state = blocked.state;
      result.error = String(error?.message || error).slice(0, 500);
      result.facts = verifiedFacts.map((fact, index) => ({
        fact_index: index, field: fact.field, expected_value: fact.value!, status: blocked.status,
        first_loss_boundary: blocked.boundary,
      }));
    } finally {
      const after = ResourceGovernor.getAllProviderMetrics() as MetricsSnapshot;
      const modelProviders = ['nvidia', 'groq', 'gemini'];
      const retrievalProviders = ['serper', 'firecrawl', 'hunter', 'tavily', 'exa', 'linkup', 'apify'];
      result.model_calls = metricDelta(before, after, modelProviders);
      result.retrieval_calls = metricDelta(before, after, retrievalProviders);
      result.provider_calls = result.model_calls + result.retrieval_calls;
      result.latency_ms = Date.now() - started;
      result.completed_at = new Date().toISOString();
    }
    await this.saveEntityResult(result);
    return result;
  }

  private async finalizeRun(): Promise<void> {
    if (!this.benchmarkDb) throw new Error('Benchmark database is not initialized');
    const facts = this.results.flatMap((result) => result.facts);
    const count = (status: FactStatus) => facts.filter((fact) => fact.status === status).length;
    const recovered = count('RECOVERED_CORRECTLY');
    const wrong = count('WRONG');
    const completedAt = new Date().toISOString();
    const expectedFacts = this.truthset.entities.flatMap((entity) => entity.facts).filter((fact) => fact.status === 'VERIFIED' && fact.value !== undefined).length;
    const attemptedEntities = this.results.length;
    const expectedEntities = this.truthset.entities.length;
    const complete = this.truthset.entities.every((entity) => this.results.some((result) => result.company === entity.company && result.country === entity.country));
    const runStatus = complete ? 'COMPLETED' : 'PARTIAL';
    const firstLossDistribution = facts.reduce<Record<string, number>>((counts, fact) => {
      if (fact.status === 'RECOVERED_CORRECTLY') return counts;
      const boundary = fact.first_loss_boundary || 'UNTRACED';
      counts[boundary] = (counts[boundary] || 0) + 1;
      return counts;
    }, {});
    const summary = {
      run_id: this.runId,
      track: this.track,
      started_at: this.runStartedAt,
      completed_at: completedAt,
      run_status: runStatus,
      expected_entities: expectedEntities,
      attempted_entities: attemptedEntities,
      entity_coverage: expectedEntities ? attemptedEntities / expectedEntities : 0,
      expected_facts: expectedFacts,
      attempted_facts: facts.length,
      fact_coverage: expectedFacts ? facts.length / expectedFacts : 0,
      total_facts: facts.length,
      recovered_correctly: recovered,
      missed: count('MISSED'),
      wrong,
      provider_blocked: count('PROVIDER_BLOCKED'),
      retrieval_blocked: count('RETRIEVAL_BLOCKED'),
      blocked: count('PROVIDER_BLOCKED') + count('RETRIEVAL_BLOCKED'),
      outcome_distribution: {
        RECOVERED_CORRECTLY: recovered,
        MISSED: count('MISSED'),
        WRONG: wrong,
        BLOCKED: count('PROVIDER_BLOCKED') + count('RETRIEVAL_BLOCKED'),
      },
      first_loss_distribution: firstLossDistribution,
      track_recall: complete && expectedFacts ? recovered / expectedFacts : null,
      precision: null,
      provider_calls: this.results.reduce((sum, item) => sum + item.provider_calls, 0),
      retrieval_calls: this.results.reduce((sum, item) => sum + item.retrieval_calls, 0),
      model_calls: this.results.reduce((sum, item) => sum + item.model_calls, 0),
      entities: this.results,
    };
    await this.benchmarkDb.run(
      'UPDATE benchmark_runs SET completed_at = ?, status = ? WHERE run_id = ?',
      [completedAt, runStatus, this.runId],
    );
    const summaryPath = path.join(REPO_ROOT, '.agent', 'benchmarks', `benchmark_${this.track}_${this.runId}_summary.json`);
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), 'utf-8');
    console.log(`Track ${this.track}: ${recovered}/${facts.length} recovered; summary ${summaryPath}`);
  }

  async run(): Promise<void> {
    await this.initialize();
    await this.loadPreviousState();
    const completed = new Set(this.results.map((result) => `${result.company}\u0000${result.country}`));
    let remaining = this.truthset.entities.filter((entity) => !completed.has(`${entity.company}\u0000${entity.country}`));
    if (this.maxEntities !== undefined) remaining = remaining.slice(0, Math.max(0, this.maxEntities));
    for (const entity of remaining) await this.runEntity(entity);
    await this.finalizeRun();
  }
}

function cliOption(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

async function main(): Promise<void> {
  const track = process.argv[2]?.toUpperCase() === 'B' ? 'B' : 'A';
  const maxRaw = cliOption('max-entities');
  const runner = new ColdBenchmarkRunner(track, {
    runId: cliOption('run-id'),
    maxEntities: maxRaw === undefined ? undefined : Number(maxRaw),
  });
  await runner.run();
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
