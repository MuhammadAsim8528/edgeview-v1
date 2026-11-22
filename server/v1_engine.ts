import { acquireCompanyIdentityWork } from './company_identity_work';
import { createDeadlineSignal, throwIfCancelled, withBoundedConcurrency } from './operation_control';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { getAppSettings, type AppSettings } from './settings';
import { V1_CONTACT_OVERLAY_VERSION, V1_REUSE_MAX_AGE_DAYS } from '../shared/v1_contact_contract';
import { isDeepStrictEqual } from 'node:util';
import { canonicalEntityIdentityKey, canonicalCountryIdentityKey } from './company_identity';
import { getRuntimeDataRoot } from './db_paths';
import { isSafeExternalUrl, safeFetchOutboundText, safeFetchProviderRequest } from './url_safety';
import { resolveOfficialDomain, type DomainResolution, sameDomainOrSubdomain } from './v1_identity';
import { externalizeV1RunForStorage, hydrateV1RunFromStorage } from './v1_blob_store';
import { readProviderResponse, validateProviderEnvelope, providerSchemaError } from './provider_response';
import { crawlOfficialPages, officialPageFallbackUrls } from './official_site_crawl';
import { visibleHtmlText } from './html_evidence';
import { isSerperGoogleRedirect, serperLinkSubstitutions } from './serper_links';

export type V1Status = 'pending' | 'success' | 'failed' | 'skipped';

export interface V1TimelineEvent {
  at: string;
  stage: 'run' | 'query_generation' | 'search' | 'resolution' | 'scrape' | 'storage';
  status: V1Status;
  message: string;
  query?: string;
  provider?: string;
  latency_ms?: number;
  error?: string;
}

export interface V1RawRecord {
  id: string;
  run_id: string;
  kind: 'ai' | 'search' | 'scrape';
  provider: string;
  request: Record<string, unknown>;
  response?: unknown;
  http_status?: number;
  failure?: { name: string; message: string; status?: number };
  requested_at: string;
  completed_at: string;
  latency_ms: number;
  sha256: string;
}

export interface V1Result {
  id: string;
  run_id: string;
  raw_record_id: string;
  query: string;
  provider: string;
  rank: number;
  title: string;
  url: string;
  snippet: string;
  text?: string;
  markdown?: string;
  html?: string;
  links: string[];
  metadata: Record<string, unknown>;
  search_latency_ms: number;
  scrape_latency_ms?: number;
  status: V1Status;
  error?: string;
}

export interface V1ResearchContext {
  format: 1;
  pipeline_version: 2;
  result_schema: number;
  objective: 'company-contact-research';
  profile: 'interactive' | 'bulk';
  provider_fingerprint: string;
}

/** Request-context metadata, never credentials or a second evidence store.
 * Actual attempted providers remain in immutable raw records/timeline. */
export function createV1ResearchContext(profile: 'interactive' | 'bulk', settings: AppSettings = getAppSettings()): V1ResearchContext {
  if (!['interactive', 'bulk'].includes(profile)) throw new Error('Invalid V1 research profile');
  const selection = {
    serper: { enabled: settings.serper_enabled === true, configured: Boolean(settings.serper_api_key?.trim()) },
    hunter: { enabled: settings.hunter_enabled === true, configured: Boolean(settings.hunter_api_key?.trim()) },
    nvidia: { enabled: settings.nvidia_enabled === true, configured: Boolean(settings.nvidia_api_key?.trim()), model: settings.nvidia_model, base: settings.nvidia_base_url },
    groq: { enabled: settings.groq_enabled === true, configured: Boolean(settings.groq_api_key?.trim()), model: settings.groq_model },
    primary: settings.primary_ai_provider,
  };
  return { format: 1, pipeline_version: 2, result_schema: V1_CONTACT_OVERLAY_VERSION, objective: 'company-contact-research', profile,
    provider_fingerprint: crypto.createHash('sha256').update(JSON.stringify(selection)).digest('hex') };
}

// Compare credentials only in memory; never fingerprint/store their values in
// research context. Non-research preferences must not interrupt research.
const researchSettingKeys = ['serper_enabled', 'serper_api_key', 'hunter_enabled', 'hunter_api_key',
  'nvidia_enabled', 'nvidia_api_key', 'nvidia_model', 'nvidia_base_url',
  'groq_enabled', 'groq_api_key', 'groq_model', 'primary_ai_provider'] as const satisfies readonly (keyof AppSettings)[];
function assertResearchSettingsCurrent(expected: AppSettings): void {
  const current = getAppSettings();
  if (researchSettingKeys.some(key => current[key] !== expected[key])) throw new Error('RESEARCH_CONFIGURATION_CHANGED');
}
function researchSettingsStillCurrent(expected: AppSettings): boolean {
  try { assertResearchSettingsCurrent(expected); return true; }
  catch { return false; } // Unknown/new configuration cannot inherit old account suppression.
}

export function v1ResearchCompatibility(run: { research_context?: V1ResearchContext }, expected: V1ResearchContext): 'unverified' | 'matches_current_context' | 'different_context' {
  if (!run.research_context) return 'unverified';
  return isDeepStrictEqual(run.research_context, expected) ? 'matches_current_context' : 'different_context';
}

/** Describes historical evidence; context equality is never live verification. */
function canonicalResearchTime(time: unknown): string | null {
  if (typeof time === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(time) && Number.isFinite(Date.parse(time))) {
    const normalized = new Date(time).toISOString();
    if (normalized.slice(0, 19) === time.slice(0, 19)) return normalized;
  }
  return null;
}

export function describeV1EvidenceReuse(run: { completed_at?: string; research_context?: V1ResearchContext }, expected: V1ResearchContext) {
  return { captured_at: canonicalResearchTime(run.completed_at), compatibility: v1ResearchCompatibility(run, expected), freshness: 'not_live_verified' as const };
}

export { V1_REUSE_MAX_AGE_DAYS } from '../shared/v1_contact_contract';
/** Operational reuse window, not a guarantee that external facts remain true.
 * Historical revalidation/opening is deliberately independent of this gate. */
export function assessV1FreshReuse(run: Pick<V1Run, 'company_name' | 'country' | 'status' | 'started_at' | 'completed_at' | 'research_context'>,
  target: { company_name?: string; country?: string }, expected: V1ResearchContext, now = Date.now()) {
  const reject = (code: string) => ({ eligible: false, code, max_age_days: V1_REUSE_MAX_AGE_DAYS });
  if (!target.company_name?.trim() || !canonicalCountryIdentityKey(target.country) || !canonicalCountryIdentityKey(run.country)
    || canonicalEntityIdentityKey(run.company_name, run.country) !== canonicalEntityIdentityKey(target.company_name, target.country)) return reject('REUSE_IDENTITY_MISMATCH');
  if (run.status !== 'COMPLETED') return reject('REUSE_INCOMPLETE_RESULT');
  if (v1ResearchCompatibility(run, expected) !== 'matches_current_context') return reject('REUSE_CONTEXT_UNVERIFIED');
  const completed = canonicalResearchTime(run.completed_at), started = canonicalResearchTime(run.started_at);
  if (!Number.isFinite(now) || !completed || !started || Date.parse(completed) < Date.parse(started) || Date.parse(completed) > now) return reject('REUSE_TIME_UNVERIFIED');
  if (now - Date.parse(completed) > V1_REUSE_MAX_AGE_DAYS * 86400000) return reject('REUSE_EXPIRED');
  return { eligible: true, code: 'REUSE_RECENT_COMPATIBLE', max_age_days: V1_REUSE_MAX_AGE_DAYS };
}

export interface V1Run {
  id: string;
  company_name: string;
  country: string;
  status: 'RUNNING' | 'COMPLETED' | 'PARTIAL' | 'FAILED';
  started_at: string;
  completed_at?: string;
  research_context?: V1ResearchContext;
  queries: string[];
  results: V1Result[];
  raw_records: V1RawRecord[];
  timeline: V1TimelineEvent[];
  identity_resolution?: DomainResolution;
  evidence_workspace?: {
    chunks: Array<{ id: string; result_id: string; url: string; source_type: 'official' | 'linkedin'; text: string }>;
    accepted_claims: Array<{ field: 'address' | 'email' | 'phone' | 'leader'; value: string; role?: string; source_result_id: string; source_url: string; source_type: 'official' | 'linkedin'; quote: string }>;
    rejected_claims: Array<{ claim: unknown; reason: string }>;
  };
  limits: { max_queries: number; max_results_per_query: number; max_scrapes: number; timeout_ms: number };
}

export interface V1RunOptions {
  profile?: 'interactive' | 'bulk';
  signal?: AbortSignal;
  timeoutMs?: number;
}

export interface V1RunSummary {
  id: string;
  company_name: string;
  country: string;
  status: V1Run['status'];
  started_at: string;
  completed_at?: string;
  query_count: number;
  result_count: number;
  raw_record_count: number;
  failure_count: number;
  research_context?: V1ResearchContext;
}

const MAX_QUERIES = 4;
const MAX_RESULTS = 8;
const MAX_SCRAPES = 8;
const RUN_TIMEOUT_MS = 120_000;
const PROVIDER_TIMEOUT_MS = 25_000;
const dataDir = process.env.EDGEVIEW_V1_DATA_DIR
  ? path.resolve(process.env.EDGEVIEW_V1_DATA_DIR)
  : path.join(getRuntimeDataRoot(), 'data', 'v1-runs');
const identityIndexPath = path.join(dataDir, 'identity-index.jsonl');
const providerMetricsPath = path.join(dataDir, 'provider-metrics.json');
const activeRuns = new Map<string, { promise: Promise<V1Run>; startedAt: number }>();
const ACTIVE_RUN_TTL_MS = 5 * 60 * 1000;
let summaryCache: V1RunSummary[] | null = null;
type V1RunIdentityHeader = {
  id: string; company_name: string; country: string; status: V1Run['status'];
  started_at: string; completed_at?: string; query_count: number;
  research_context?: V1ResearchContext;
};
let identityHeaderCache: V1RunIdentityHeader[] | null = null;

function invalidateV1Caches(): void {
  summaryCache = null;
  identityHeaderCache = null;
}

function cleanupActiveRuns(): void {
  const now = Date.now();
  for (const [key, value] of activeRuns.entries()) {
    if (now - value.startedAt > ACTIVE_RUN_TTL_MS) {
      activeRuns.delete(key);
    }
  }
}
const hardUnavailableProviders = new Map<string, string>();
const providerCooldowns = new Map<string, { until: number; reason: string }>();
type ProviderMetricAggregate = {
  request_count: number; success_count: number; failure_count: number;
  timeout_count: number; rate_limit_count: number; total_latency_ms: number;
  last_error: string | null; last_http_status: number | null; last_completed_at: string | null;
  last_requested_at?: string | null;
};
type ProviderMetricStore = { format: 1; processed_run_ids: string[]; providers: Record<string, ProviderMetricAggregate> };
let providerMetricStore: ProviderMetricStore | null = null;

function now() { return new Date().toISOString(); }
function id(prefix: string) { return `${prefix}-${Date.now().toString(36)}-${crypto.randomBytes(5).toString('hex')}`; }
function sha(value: unknown) { return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
function cleanText(value: unknown) { return typeof value === 'string' ? value.trim() : ''; }
function safeError(error: unknown, status?: number) {
  const e = error instanceof Error ? error : new Error(String(error));
  const responseStatus = (e as Error & { status?: unknown; httpStatus?: unknown }).status;
  const observedHttpStatus = (e as Error & { httpStatus?: unknown }).httpStatus;
  if (!status && typeof responseStatus === 'number' && Number.isInteger(responseStatus) && responseStatus >= 100 && responseStatus <= 599) status = responseStatus;
  if (!status && typeof observedHttpStatus === 'number' && Number.isInteger(observedHttpStatus) && observedHttpStatus >= 100 && observedHttpStatus <= 599) status = observedHttpStatus;
  return { name: e.name || 'Error', message: e.message || 'Unknown failure', ...(status ? { status } : {}) };
}
function throwIfRunAborted(signal: AbortSignal): void {
  if (signal.aborted) throw signal.reason instanceof Error ? signal.reason : new Error('RUN_DEADLINE_EXCEEDED');
}
function attachOperationFailure(run: V1Run, provider: string, request: Record<string, unknown>, failure: V1RawRecord['failure']): void {
  const captured = run.raw_records.find(record => record.provider === provider && record.request === request);
  if (captured && !captured.failure) captured.failure = failure;
}
function providerCircuitKey(provider: string) { return provider.replace(/-extraction$/, ''); }
function emptyProviderMetric(): ProviderMetricAggregate {
  return { request_count: 0, success_count: 0, failure_count: 0, timeout_count: 0, rate_limit_count: 0, total_latency_ms: 0, last_error: null, last_http_status: null, last_completed_at: null };
}
function loadProviderMetricStore(): ProviderMetricStore {
  if (providerMetricStore) return providerMetricStore;
  try {
    const parsed = JSON.parse(fs.readFileSync(providerMetricsPath, 'utf8'));
    if (parsed?.format === 1 && Array.isArray(parsed.processed_run_ids) && parsed.providers && typeof parsed.providers === 'object') {
      providerMetricStore = parsed as ProviderMetricStore;
      return providerMetricStore;
    }
  } catch { /* derived metrics begin empty and are rebuilt by future completed runs */ }
  providerMetricStore = { format: 1, processed_run_ids: [], providers: {} };
  return providerMetricStore;
}
function recordProviderMetrics(run: V1Run): void {
  const store = loadProviderMetricStore();
  if (store.processed_run_ids.includes(run.id)) return;
  for (const record of run.raw_records) {
    const provider = providerCircuitKey(record.provider);
    if (!['serper', 'hunter', 'nvidia', 'groq'].includes(provider)) continue;
    const metric = store.providers[provider] ||= emptyProviderMetric();
    metric.request_count += 1;
    metric.total_latency_ms += Math.max(0, Number(record.latency_ms || 0));
    const completedAt = record.completed_at || run.completed_at || null;
    const failureMessage = record.failure ? cleanText(record.failure.message).slice(0, 500) || 'Provider request failed' : null;
    if (completedAt && (!metric.last_completed_at || completedAt >= metric.last_completed_at)) {
      metric.last_completed_at = completedAt;
      metric.last_requested_at = record.requested_at || null;
      metric.last_error = failureMessage;
      metric.last_http_status = Number(record.http_status) || (record.failure ? Number(record.failure.status) || null : null);
    }
    if (record.response !== undefined && !record.failure) metric.success_count += 1;
    if (record.failure) {
      metric.failure_count += 1;
      if (record.failure.status === 408 || /timeout|aborted/i.test(failureMessage || '')) metric.timeout_count += 1;
      if (record.failure.status === 429 || /rate.?limit|quota/i.test(failureMessage || '')) metric.rate_limit_count += 1;
    }
  }
  store.processed_run_ids.push(run.id);
  store.processed_run_ids = store.processed_run_ids.slice(-5000);
  const temp = `${providerMetricsPath}.${process.pid}.tmp`;
  fs.writeFileSync(temp, `${JSON.stringify(store, null, 2)}\n`, 'utf8');
  fs.renameSync(temp, providerMetricsPath);
}
function providerAvailable(run: V1Run, provider: string, query: string): boolean {
  const key = providerCircuitKey(provider);
  const reason = hardUnavailableProviders.get(key);
  if (reason) {
    run.timeline.push({ at: now(), stage: 'search', status: 'skipped', provider, query, message: `Provider suppressed after a hard account/authentication failure: ${reason}` });
    return false;
  }
  const cooldown = providerCooldowns.get(key);
  if (cooldown && cooldown.until > Date.now()) {
    run.timeline.push({ at: now(), stage: 'search', status: 'skipped', provider, query, message: `Provider cooling down after ${cooldown.reason}; retrying in a later run` });
    return false;
  }
  if (cooldown) providerCooldowns.delete(key);
  return true;
}
function rememberHardProviderFailure(provider: string, status: number, settings: AppSettings) {
  if (!researchSettingsStillCurrent(settings)) return;
  const key = providerCircuitKey(provider);
  if ([401, 402, 403, 432].includes(status)) hardUnavailableProviders.set(key, `HTTP ${status}`);
  if (status === 429) {
    const cooldownMs = key === 'hunter' ? 6 * 60 * 60 * 1000 : 120_000;
    providerCooldowns.set(key, { until: Date.now() + cooldownMs, reason: key === 'hunter' ? 'quota/rate limit response' : 'HTTP 429' });
  }
}
export function resetV1ProviderFailureState(provider: string): void {
  const key = providerCircuitKey(provider);
  if (!['serper','hunter','nvidia','groq'].includes(key)) throw new Error('Unknown V1 provider.');
  hardUnavailableProviders.delete(key);
  providerCooldowns.delete(key);
}
function runPath(runId: string) { return path.join(dataDir, `${runId}.json`); }
function summarize(run: V1Run): V1RunSummary {
  return { id: run.id, company_name: run.company_name, country: run.country, status: run.status, started_at: run.started_at, completed_at: run.completed_at, query_count: run.queries.length, result_count: run.results.length, raw_record_count: run.raw_records.length, failure_count: run.timeline.filter(event => event.status === 'failed').length, ...(run.research_context ? { research_context: run.research_context } : {}) };
}
export function persistV1Run(run: V1Run) {
  fs.mkdirSync(dataDir, { recursive: true });
  const target = runPath(run.id);
  if (!/^run-[a-z0-9-]+$/i.test(run.id)) throw new Error('Invalid immutable run identity.');
  if (fs.existsSync(target)) {
    const error = new Error('Immutable run already exists; a refresh requires a new run identity.');
    (error as Error & { code: string }).code = 'RUN_IMMUTABLE_CONFLICT';
    throw error;
  }
  const temp = path.join(dataDir, `.${run.id}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`);
  const persistedRun = externalizeV1RunForStorage(run as any, dataDir);
  const payload = JSON.stringify(persistedRun, null, 2);
  let handle: number | undefined;
  try {
    // Never stream directly into the final immutable filename. A process crash
    // during write would otherwise leave a zero-byte/truncated run that looks
    // final to the rest of the application.
    handle = fs.openSync(temp, 'wx');
    fs.writeFileSync(handle, payload, { encoding: 'utf8' });
    fs.fsyncSync(handle);
    fs.closeSync(handle);
    handle = undefined;

    // The single backend writer and unique run IDs protect promotion. Never
    // move an existing immutable final file aside to replace it.
    fs.renameSync(temp, target);

    // Derived metrics/caches/indexes are updated only after the final run file
    // has been successfully promoted.
    recordProviderMetrics(run);
    if (summaryCache) summaryCache.unshift(summarize(run));
    if (identityHeaderCache) {
      const header = { id: run.id, company_name: run.company_name, country: run.country, status: run.status, started_at: run.started_at, completed_at: run.completed_at, query_count: run.queries.length, ...(run.research_context ? { research_context: run.research_context } : {}) };
      identityHeaderCache.unshift(header);
      fs.appendFileSync(identityIndexPath, `${JSON.stringify(header)}\n`, 'utf8');
    }
  } finally {
    if (handle !== undefined) {
      try { fs.closeSync(handle); } catch { /* best-effort cleanup */ }
    }
    if (fs.existsSync(temp)) {
      try { fs.unlinkSync(temp); } catch { /* stale temp is ignored by run readers */ }
    }
  }
}

function jsonStringFromHeader(header: string, field: string): string {
  const match = header.match(new RegExp(`"${field}"\\s*:\\s*("(?:\\\\.|[^"\\\\])*")`));
  if (!match) return '';
  try { return JSON.parse(match[1]); } catch { return ''; }
}

/**
 * Lightweight identity index for historical projection. Only the first 16 KB
 * of each immutable run is read; multi-megabyte provider payloads are not
 * parsed during application startup.
 */
function readV1RunIdentityHeader(name: string): V1RunIdentityHeader | null {
  let handle: number | undefined;
  try {
    handle = fs.openSync(path.join(dataDir, name), 'r');
    const stat = fs.fstatSync(handle);
    const maxHeaderSize = 64 * 1024;
    const buffer = Buffer.alloc(Math.min(stat.size, maxHeaderSize));
    const bytes = fs.readSync(handle, buffer, 0, buffer.length, 0);
    const header = buffer.subarray(0, bytes).toString('utf8');
    const idValue = jsonStringFromHeader(header, 'id');
    const company = jsonStringFromHeader(header, 'company_name');
    const countryValue = jsonStringFromHeader(header, 'country');
    const statusValue = jsonStringFromHeader(header, 'status') as V1Run['status'];
    const startedAt = jsonStringFromHeader(header, 'started_at');
    const completedAt = jsonStringFromHeader(header, 'completed_at');
    const queriesMatch = header.match(/"queries"\s*:\s*(\[[\s\S]*?\])\s*,\s*"results"/);
    let queryCount = 0;
    try { queryCount = queriesMatch ? JSON.parse(queriesMatch[1]).length : 0; } catch { /* header remains usable */ }
    let researchContext: V1ResearchContext | undefined;
    try {
      const match = header.match(/"research_context"\s*:\s*(\{[^{}]*\})/);
      if (match) researchContext = JSON.parse(match[1]);
    } catch { /* Legacy/damaged metadata never becomes verified context. */ }
    if (idValue !== name.slice(0, -5) || !company || !countryValue) return null;
    return {
      id: idValue, company_name: company, country: countryValue,
      status: ['RUNNING', 'COMPLETED', 'PARTIAL', 'FAILED'].includes(statusValue) ? statusValue : 'PARTIAL',
      started_at: startedAt, ...(completedAt ? { completed_at: completedAt } : {}), query_count: queryCount,
      ...(researchContext ? { research_context: researchContext } : {}),
    };
  } catch { return null; } // One damaged header cannot hide other runs.
  finally { if (handle !== undefined) fs.closeSync(handle); }
}

export function listV1RunIdentityHeaders() {
  if (identityHeaderCache) return identityHeaderCache;
  const byId = new Map<string, V1RunIdentityHeader>();
  if (!fs.existsSync(dataDir)) return (identityHeaderCache = []);
  if (fs.existsSync(identityIndexPath)) {
    try {
      for (const line of fs.readFileSync(identityIndexPath, 'utf8').split(/\r?\n/)) {
        if (!line.trim()) continue;
        try {
          const item = JSON.parse(line) as V1RunIdentityHeader;
          if (item && /^run-[a-z0-9-]+$/i.test(item.id) && typeof item.company_name === 'string'
            && typeof item.country === 'string' && typeof item.started_at === 'string') byId.set(item.id, item);
        } catch { /* ignore damaged cache line */ }
      }
    } catch { /* an unreadable derived index is rebuilt from immutable runs */ }
  }
  const indexed = JSON.stringify([...byId.values()].sort((a, b) => b.started_at.localeCompare(a.started_at)));
  // Promotion is the durable commit point. Reconcile every cold start, even
  // when an index exists, because its append may have failed or been interrupted.
  for (const name of fs.readdirSync(dataDir).filter(file => /^run-[a-z0-9-]+\.json$/i.test(file))) {
    const header = readV1RunIdentityHeader(name);
    if (header) byId.set(header.id, header);
  }
  identityHeaderCache = [...byId.values()].sort((a, b) => b.started_at.localeCompare(a.started_at));
  if (JSON.stringify(identityHeaderCache) !== indexed) {
    const temp = `${identityIndexPath}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`;
    try {
      fs.writeFileSync(temp, identityHeaderCache.map(item => JSON.stringify(item)).join('\n') + '\n', { encoding: 'utf8', flag: 'wx' });
      fs.renameSync(temp, identityIndexPath);
    } catch { /* recovered in-memory headers remain truthful; retry next start */ }
    finally { try { if (fs.existsSync(temp)) fs.unlinkSync(temp); } catch { /* derived temp cleanup */ } }
  }
  return identityHeaderCache;
}
async function boundedFetch(url: string, init: RequestInit, timeoutMs = PROVIDER_TIMEOUT_MS, maxRequestBytes = 2 * 1024 * 1024) {
  return safeFetchProviderRequest(url, { ...init, timeoutMs, maxBytes: 8 * 1024 * 1024, maxRequestBytes });
}

export function parseQueries(text: string, company: string, country: string, maxQueries = MAX_QUERIES): string[] {
  let candidates: unknown = null;
  try {
    const match = text.match(/\[[\s\S]*\]/);
    if (match) candidates = JSON.parse(match[0]);
  } catch { /* recorded raw response remains available */ }
  const jsonCandidates = Array.isArray(candidates) ? candidates.map(cleanText) : [];
  // Some reasoning models put valid proposed queries in quoted draft text and
  // exhaust their token budget before emitting the final JSON array. Recover
  // only strings that still satisfy the exact deterministic identity anchor.
  const quotedCandidates = [...text.matchAll(/["“]([^"”\r\n]{3,240})["”]/g)].map(match => cleanText(match[1]));
  const anchored = [...jsonCandidates, ...quotedCandidates];
  const valid = anchored.filter((q, index, all) => q && q.toLowerCase().includes(company.toLowerCase()) && q.toLowerCase().includes(country.toLowerCase()) && all.indexOf(q) === index);
  if (valid.length < 2) throw providerSchemaError('AI provider did not return at least two identity-anchored queries');
  const deterministicCoverage = [
    `"${company}" "${country}"`,
    `${company} ${country} official website`,
    `${company} ${country} contact management leadership`,
    `${company} ${country} LinkedIn company`,
  ];
  return [...valid, ...deterministicCoverage]
    .filter((q, index, all) => q && q.toLowerCase().includes(company.toLowerCase()) && q.toLowerCase().includes(country.toLowerCase()) && all.indexOf(q) === index)
    .slice(0, maxQueries);
}

export function fallbackIdentityQueries(company: string, country: string, maxQueries = MAX_QUERIES): string[] {
  return [
    `"${company}" "${country}"`,
    `${company} ${country} official website`,
    `${company} ${country} contact management leadership`,
    `${company} ${country} LinkedIn company`,
  ].slice(0, maxQueries);
}

function orderAiProviders<T extends { name: string }>(providers: T[], primary: 'NVIDIA' | 'GROQ' | 'GEMINI'): T[] {
  const preferred = primary === 'NVIDIA' ? 'nvidia' : 'groq';
  return [...providers].sort((a, b) => Number(b.name.startsWith(preferred)) - Number(a.name.startsWith(preferred)));
}

async function generateQueries(run: V1Run, profile: 'interactive' | 'bulk', settings: AppSettings, signal: AbortSignal): Promise<string[]> {
  throwIfRunAborted(signal);
  assertResearchSettingsCurrent(settings);
  const request = {
    company_name: run.company_name,
    country: run.country,
    instruction: 'Return only a JSON array of 3 compact web search queries. Every query must contain the exact company name and country. Cover official identity, contact/about, and leadership. Do not answer the queries.',
  };
  const configuredProviders = [
    ...(settings.groq_enabled && settings.groq_api_key ? [{ name: 'groq', url: 'https://api.groq.com/openai/v1/chat/completions', key: settings.groq_api_key, model: settings.groq_model }] : []),
    ...(settings.nvidia_enabled && settings.nvidia_api_key ? [{ name: 'nvidia', url: `${(settings.nvidia_base_url || 'https://integrate.api.nvidia.com/v1').replace(/\/+$/, '')}/chat/completions`, key: settings.nvidia_api_key, model: settings.nvidia_model }] : []),
  ];
  const providers = orderAiProviders(configuredProviders, settings.primary_ai_provider);
  if (!providers.length) {
    const queries = fallbackIdentityQueries(run.company_name, run.country, run.limits.max_queries);
    run.timeline.push({ at: now(), stage: 'query_generation', status: 'skipped', message: `No AI query provider is configured; using ${queries.length} deterministic exact-identity fallback queries` });
    return queries;
  }
  let lastError: unknown = new Error('Query generation failed');
  for (const provider of providers) {
    throwIfRunAborted(signal);
    assertResearchSettingsCurrent(settings);
    if (!providerAvailable(run, provider.name, `${run.company_name} ${run.country}`)) continue;
    const started = Date.now(); const requestedAt = now();
    try {
      const aiPayload: Record<string, unknown> = { model: provider.model, temperature: 0.1, max_tokens: 500, messages: [{ role: 'system', content: 'Output only the requested JSON. Do not explain or show reasoning.' }, { role: 'user', content: JSON.stringify(request) }] };
      if (provider.name === 'nvidia') aiPayload.chat_template_kwargs = { thinking: false };
      const response = await safeFetchProviderRequest(provider.url, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${provider.key}` },
        body: JSON.stringify(aiPayload), maxBytes: 8 * 1024 * 1024, signal,
        timeoutMs: provider.name === 'nvidia' ? 8_000 : 12_000,
      });
      const { body, failure: bodyFailure } = await readProviderResponse(response, 8 * 1024 * 1024, 20_000, false, signal);
      const raw: V1RawRecord = { id: id('raw'), run_id: run.id, kind: 'ai', provider: provider.name, request, ...(response.ok ? { response: body } : { failure: safeError(new Error(`HTTP ${response.status}`), response.status), response: body }), requested_at: requestedAt, completed_at: now(), latency_ms: Date.now() - started, sha256: sha(body) };
      run.raw_records.push(raw);
      raw.http_status = response.status;
      if (!response.ok) rememberHardProviderFailure(provider.name, response.status, settings);
      if (bodyFailure) { if (response.ok) raw.failure = bodyFailure; throw Object.assign(new Error(bodyFailure.message), bodyFailure); }
      if (!response.ok) throw new Error(`${provider.name} returned HTTP ${response.status}`);
      validateProviderEnvelope(body, 'ai');
      const text = cleanText((body as any)?.choices?.[0]?.message?.content);
      const queries = parseQueries(text, run.company_name, run.country, run.limits.max_queries);
      if (queries.length < 2) throw new Error(`${provider.name} did not return at least two valid identity-anchored queries`);
      run.timeline.push({ at: now(), stage: 'query_generation', status: 'success', provider: provider.name, latency_ms: Date.now() - started, message: `Generated ${queries.length} identity-anchored queries` });
      return queries;
    } catch (error) {
      lastError = error; const failure = safeError(error);
      if (failure.status) rememberHardProviderFailure(provider.name, failure.status, settings);
      attachOperationFailure(run, provider.name, request, failure);
      if (!signal.aborted && /aborted|timeout|fetch failed|socket|network/i.test(failure.message) && researchSettingsStillCurrent(settings)) {
        providerCooldowns.set(providerCircuitKey(provider.name), { until: Date.now() + 120_000, reason: failure.message });
      }
      if (!run.raw_records.some(r => r.kind === 'ai' && r.provider === provider.name)) run.raw_records.push({ id: id('raw'), run_id: run.id, kind: 'ai', provider: provider.name, request, failure, ...(failure.status ? { http_status: failure.status } : {}), requested_at: requestedAt, completed_at: now(), latency_ms: Date.now() - started, sha256: sha(failure) });
      run.timeline.push({ at: now(), stage: 'query_generation', status: 'failed', provider: provider.name, latency_ms: Date.now() - started, message: 'Query generation provider failed; trying next configured provider', error: failure.message });
      throwIfRunAborted(signal);
    }
  }
  const queries = fallbackIdentityQueries(run.company_name, run.country, run.limits.max_queries);
  run.timeline.push({ at: now(), stage: 'query_generation', status: 'failed', message: `All AI query providers failed; continuing with ${queries.length} deterministic exact-identity fallback queries`, error: safeError(lastError).message });
  return queries;
}

async function searchSerper(run: V1Run, query: string, settings: AppSettings, signal: AbortSignal): Promise<V1Result[]> {
  throwIfRunAborted(signal);
  assertResearchSettingsCurrent(settings);
  const provider = 'serper';
  if (!providerAvailable(run, provider, query)) return [];
  const request = { q: query, num: run.limits.max_results_per_query };
  const started = Date.now(); const requestedAt = now();
  try {
    if (!settings.serper_enabled || !settings.serper_api_key) throw new Error('Serper is not configured and enabled');
    const response = await boundedFetch('https://google.serper.dev/search', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-API-KEY': settings.serper_api_key }, body: JSON.stringify(request), signal });
    const { body, failure: bodyFailure } = await readProviderResponse(response, 8 * 1024 * 1024, 20_000, false, signal);
    const raw: V1RawRecord = { id: id('raw'), run_id: run.id, kind: 'search', provider, request, ...(response.ok ? { response: body } : { failure: safeError(new Error(`HTTP ${response.status}`), response.status), response: body }), requested_at: requestedAt, completed_at: now(), latency_ms: Date.now() - started, sha256: sha(body) };
    run.raw_records.push(raw);
    raw.http_status = response.status;
    if (!response.ok) rememberHardProviderFailure(provider, response.status, settings);
    if (bodyFailure) { if (response.ok) raw.failure = bodyFailure; throw Object.assign(new Error(bodyFailure.message), bodyFailure); }
    if (!response.ok) throw new Error(`Serper returned HTTP ${response.status}`);
    validateProviderEnvelope(body, 'serper');
    const items = Array.isArray((body as any).organic) ? (body as any).organic : [];
    const usableItems = items.filter((item: unknown) => item && typeof item === 'object' && !Array.isArray(item) && typeof (item as any).link === 'string');
    if (usableItems.length !== items.length) {
      raw.failure = safeError(providerSchemaError(`${items.length - usableItems.length} malformed organic records retained in raw evidence`));
      run.timeline.push({ at: now(), stage: 'search', status: 'failed', provider, query, message: 'Some organic records could not be normalized; raw evidence and valid results retained', error: raw.failure.message });
    }
    run.timeline.push({ at: now(), stage: 'search', status: 'success', provider, query, latency_ms: raw.latency_ms, message: `Captured ${items.length} search results` });
    return usableItems.slice(0, run.limits.max_results_per_query).map((item: any, index: number) => ({ id: id('result'), run_id: run.id, raw_record_id: raw.id, query, provider, rank: Number(item.position) || index + 1, title: cleanText(item.title), url: cleanText(item.link), snippet: cleanText(item.snippet), links: [], metadata: Object.fromEntries(Object.entries(item).filter(([key]) => !['title', 'link', 'snippet', 'position'].includes(key))), search_latency_ms: raw.latency_ms, status: 'success' as const }));
  } catch (error) {
    const failure = safeError(error);
    const observedStatus=(error as {httpStatus?:number})?.httpStatus;
    if(observedStatus!==undefined)rememberHardProviderFailure(provider,observedStatus,settings);
    if (!run.raw_records.some(r => r.kind === 'search' && (r.request as any).q === query)) run.raw_records.push({ id: id('raw'), run_id: run.id, kind: 'search', provider, request, failure, ...(observedStatus!==undefined?{http_status:observedStatus}:{}), requested_at: requestedAt, completed_at: now(), latency_ms: Date.now() - started, sha256: sha(failure) });
    attachOperationFailure(run, provider, request, failure);
    run.timeline.push({ at: now(), stage: 'search', status: 'failed', provider, query, latency_ms: Date.now() - started, message: 'Search request failed', error: failure.message });
    return [];
  }
}

async function resolveSerperSearchLinks(run: V1Run, settings: AppSettings, signal: AbortSignal): Promise<void> {
  throwIfRunAborted(signal);
  assertResearchSettingsCurrent(settings);
  const pending=run.raw_records.filter(record=>record.provider==='serper'&&record.kind==='search'
    && record.http_status!==undefined&&record.http_status>=200&&record.http_status<300
    && Array.isArray((record.response as any)?.organic)
    && run.results.some(result=>result.raw_record_id===record.id&&isSerperGoogleRedirect(result.url)));
  if(!pending.length)return;
  const deadline=Date.now()+45_000;
  let cursor=0;
  // Search all query responses first, then resolve with two bounded workers.
  // Google links age together instead of paying a fresh ~30s wait per query.
  const worker=async()=>{
    while(!signal.aborted&&cursor<pending.length){
      const source=pending[cursor++], query=String(source.request.q||'');
      const request={operation:'resolve',source_raw_record_id:source.id,q:query};
      const raw:V1RawRecord={id:id('raw'),run_id:run.id,kind:'search',provider:'serper-resolve',request,
        requested_at:now(),completed_at:now(),latency_ms:0,sha256:''};
      const started=performance.now();
      try{
        assertResearchSettingsCurrent(settings);
        const remaining=deadline-Date.now();
        if(remaining<=0)throw Object.assign(new Error('Serper link resolution budget exhausted'),{status:408});
        const response=await boundedFetch('https://google.serper.dev/resolve',{method:'POST',redirect:'error',
          headers:{'Content-Type':'application/json','X-API-KEY':settings.serper_api_key},body:JSON.stringify(source.response),signal},Math.min(40_000,remaining),8*1024*1024);
        raw.http_status=response.status;
        const captured=await readProviderResponse(response,8*1024*1024,Math.max(1,Math.min(20_000,deadline-Date.now())),false,signal);
        raw.response=captured.body;
        if(captured.failure)throw Object.assign(new Error(captured.failure.message),captured.failure);
        if(!response.ok)throw Object.assign(new Error(`Serper link resolution returned HTTP ${response.status}`),{status:response.status});
        validateProviderEnvelope(captured.body,'serper');
        const substitutions=serperLinkSubstitutions(source.response,captured.body);
        const items=(source.response as any).organic;
        for(const result of run.results.filter(result=>result.raw_record_id===source.id)){
          const at=items.findIndex((item:any)=>item?.link===result.url&&String(item?.title||'').trim()===result.title);
          const target=substitutions.get(at);
          if(target){result.metadata={...result.metadata,original_google_link:result.url,link_resolution_raw_record_id:raw.id};result.url=target;result.raw_record_id+=','+raw.id;}
        }
        if(run.results.some(result=>result.raw_record_id===source.id&&isSerperGoogleRedirect(result.url)))throw Object.assign(new Error('SERPER_LINK_UNRESOLVED: Some Google links remain unresolved; provider retryAfter is retained in raw evidence.'),{status:response.status});
      }catch(error){raw.failure=safeError(error);const observed=(error as {httpStatus?:number})?.httpStatus;if(observed!==undefined)raw.http_status=observed;
        // Drain both already-issued workers before execute persists the run.
        // Rejecting Promise.all early would let a sibling mutate saved state.
        if(raw.failure.message==='RESEARCH_CONFIGURATION_CHANGED')return;
      }
      finally{
        raw.completed_at=now();raw.latency_ms=Math.max(0,performance.now()-started);raw.sha256=sha(raw.response??raw.failure);run.raw_records.push(raw);
        run.timeline.push({at:now(),stage:'search',provider:'serper-resolve',query,status:raw.failure?'failed':'success',latency_ms:raw.latency_ms,
          message:raw.failure?'Some search links could not be resolved; existing real links retained':'Resolved Google search links to source URLs',...(raw.failure?{error:raw.failure.message}:{})});
        for(const result of run.results.filter(result=>result.raw_record_id===source.id&&isSerperGoogleRedirect(result.url))){
          result.status='failed';result.error='SERPER_LINK_UNRESOLVED';result.metadata={...result.metadata,link_resolution_raw_record_id:raw.id};result.raw_record_id+=','+raw.id;
        }
      }
    }
  };
  await Promise.all(Array.from({length:Math.min(2,pending.length)},worker));
  throwIfRunAborted(signal);
  // A partial malformed-sibling warning must not strand usable siblings, and
  // no skipped/failed source may leave an opaque link labelled successful.
  for(const result of run.results)if(isSerperGoogleRedirect(result.url)){
    result.status='failed';result.error='SERPER_LINK_UNRESOLVED';
  }
}

async function searchTavily(run: V1Run, query: string): Promise<V1Result[]> {
  const settings = getAppSettings(); const provider = 'tavily';
  if (!settings.tavily_enabled || !settings.tavily_api_key) return [];
  if (!providerAvailable(run, provider, query)) return [];
  const request = { api_key: settings.tavily_api_key, query, max_results: run.limits.max_results_per_query, search_depth: 'advanced', include_raw_content: true, include_images: false };
  const persistedRequest = { ...request, api_key: '[configured]' };
  const started = Date.now(); const requestedAt = now();
  try {
    const response = await boundedFetch('https://api.tavily.com/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request) });
    const body = await response.json().catch(() => ({}));
    const raw: V1RawRecord = { id: id('raw'), run_id: run.id, kind: 'search', provider, request: persistedRequest, ...(response.ok ? { response: body } : { failure: safeError(new Error(`HTTP ${response.status}`), response.status), response: body }), requested_at: requestedAt, completed_at: now(), latency_ms: Date.now() - started, sha256: sha(body) };
    run.raw_records.push(raw);
    if (!response.ok) rememberHardProviderFailure(provider, response.status, settings);
    if (!response.ok) throw new Error(`Tavily returned HTTP ${response.status}`);
    const items = Array.isArray((body as any).results) ? (body as any).results : [];
    run.timeline.push({ at: now(), stage: 'search', status: 'success', provider, query, latency_ms: raw.latency_ms, message: `Captured ${items.length} search results with requested raw content` });
    return items.slice(0, run.limits.max_results_per_query).map((item: any, index: number) => ({ id: id('result'), run_id: run.id, raw_record_id: raw.id, query, provider, rank: index + 1, title: cleanText(item.title), url: cleanText(item.url), snippet: cleanText(item.content), text: cleanText(item.raw_content), markdown: cleanText(item.raw_content), links: [], metadata: Object.fromEntries(Object.entries(item).filter(([key]) => !['title', 'url', 'content', 'raw_content'].includes(key))), search_latency_ms: raw.latency_ms, status: 'success' as const }));
  } catch (error) {
    const failure = safeError(error);
    if (!run.raw_records.some(r => r.kind === 'search' && r.provider === provider && (r.request as any).query === query)) run.raw_records.push({ id: id('raw'), run_id: run.id, kind: 'search', provider, request: persistedRequest, failure, requested_at: requestedAt, completed_at: now(), latency_ms: Date.now() - started, sha256: sha(failure) });
    run.timeline.push({ at: now(), stage: 'search', status: 'failed', provider, query, latency_ms: Date.now() - started, message: 'Search request failed', error: failure.message });
    return [];
  }
}

async function searchExa(run: V1Run, query: string): Promise<V1Result[]> {
  const settings = getAppSettings(); const provider = 'exa';
  if (!settings.exa_enabled || !settings.exa_api_key) return [];
  if (!providerAvailable(run, provider, query)) return [];
  const request = { query, numResults: run.limits.max_results_per_query, contents: { text: { maxCharacters: 12000 } } };
  const started = Date.now(); const requestedAt = now();
  try {
    const response = await boundedFetch('https://api.exa.ai/search', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': settings.exa_api_key }, body: JSON.stringify(request) });
    const body = await response.json().catch(() => ({}));
    const raw: V1RawRecord = { id: id('raw'), run_id: run.id, kind: 'search', provider, request, ...(response.ok ? { response: body } : { response: body, failure: safeError(new Error(`HTTP ${response.status}`), response.status) }), requested_at: requestedAt, completed_at: now(), latency_ms: Date.now() - started, sha256: sha(body) };
    run.raw_records.push(raw);
    if (!response.ok) rememberHardProviderFailure(provider, response.status, settings);
    if (!response.ok) throw new Error(`Exa returned HTTP ${response.status}`);
    const items = Array.isArray((body as any).results) ? (body as any).results : [];
    run.timeline.push({ at: now(), stage: 'search', status: 'success', provider, query, latency_ms: raw.latency_ms, message: `Captured ${items.length} search results` });
    return items.slice(0, run.limits.max_results_per_query).map((item: any, index: number) => ({ id: id('result'), run_id: run.id, raw_record_id: raw.id, query, provider, rank: index + 1, title: cleanText(item.title), url: cleanText(item.url), snippet: cleanText(item.highlights?.join(' ') || item.text), text: cleanText(item.text), links: [], metadata: Object.fromEntries(Object.entries(item).filter(([key]) => !['title', 'url', 'text', 'highlights'].includes(key))), search_latency_ms: raw.latency_ms, status: 'success' as const }));
  } catch (error) {
    const failure = safeError(error);
    if (!run.raw_records.some(r => r.kind === 'search' && r.provider === provider && (r.request as any).query === query)) run.raw_records.push({ id: id('raw'), run_id: run.id, kind: 'search', provider, request, failure, requested_at: requestedAt, completed_at: now(), latency_ms: Date.now() - started, sha256: sha(failure) });
    run.timeline.push({ at: now(), stage: 'search', status: 'failed', provider, query, latency_ms: Date.now() - started, message: 'Search request failed', error: failure.message });
    return [];
  }
}

async function searchLinkup(run: V1Run, query: string): Promise<V1Result[]> {
  const settings = getAppSettings(); const provider = 'linkup';
  if (!settings.linkup_enabled || !settings.linkup_api_key) return [];
  if (!providerAvailable(run, provider, query)) return [];
  const request = { q: query, depth: 'fast', outputType: 'searchResults' };
  const started = Date.now(); const requestedAt = now();
  try {
    const response = await boundedFetch('https://api.linkup.so/v1/search', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${settings.linkup_api_key}` }, body: JSON.stringify(request) });
    const body = await response.json().catch(() => ({}));
    const raw: V1RawRecord = { id: id('raw'), run_id: run.id, kind: 'search', provider, request, ...(response.ok ? { response: body } : { response: body, failure: safeError(new Error(`HTTP ${response.status}`), response.status) }), requested_at: requestedAt, completed_at: now(), latency_ms: Date.now() - started, sha256: sha(body) };
    run.raw_records.push(raw);
    if (!response.ok) rememberHardProviderFailure(provider, response.status, settings);
    if (!response.ok) throw new Error(`Linkup returned HTTP ${response.status}`);
    const items = Array.isArray((body as any).results) ? (body as any).results : [];
    run.timeline.push({ at: now(), stage: 'search', status: 'success', provider, query, latency_ms: raw.latency_ms, message: `Captured ${items.length} search results` });
    return items.slice(0, run.limits.max_results_per_query).map((item: any, index: number) => ({ id: id('result'), run_id: run.id, raw_record_id: raw.id, query, provider, rank: index + 1, title: cleanText(item.title), url: cleanText(item.url), snippet: cleanText(item.content || item.snippet), text: cleanText(item.content), links: [], metadata: Object.fromEntries(Object.entries(item).filter(([key]) => !['title', 'url', 'content', 'snippet'].includes(key))), search_latency_ms: raw.latency_ms, status: 'success' as const }));
  } catch (error) {
    const failure = safeError(error);
    if (!run.raw_records.some(r => r.kind === 'search' && r.provider === provider && (r.request as any).q === query)) run.raw_records.push({ id: id('raw'), run_id: run.id, kind: 'search', provider, request, failure, requested_at: requestedAt, completed_at: now(), latency_ms: Date.now() - started, sha256: sha(failure) });
    run.timeline.push({ at: now(), stage: 'search', status: 'failed', provider, query, latency_ms: Date.now() - started, message: 'Search request failed', error: failure.message });
    return [];
  }
}

async function enrichHunter(run: V1Run, domain: string, settings: AppSettings, signal: AbortSignal): Promise<V1Result[]> {
  throwIfRunAborted(signal);
  assertResearchSettingsCurrent(settings); const provider = 'hunter';
  if (!settings.hunter_enabled || !settings.hunter_api_key || !domain) return [];
  if (!providerAvailable(run, provider, domain)) return [];
  const request = { domain, company: run.company_name, country: run.country };
  const started = Date.now(); const requestedAt = now();
  try {
    const endpoint = new URL('https://api.hunter.io/v2/domain-search');
    endpoint.searchParams.set('domain', domain); endpoint.searchParams.set('api_key', settings.hunter_api_key);
    const response = await boundedFetch(endpoint.toString(), { method: 'GET', signal });
    const { body, failure: bodyFailure } = await readProviderResponse(response, 8 * 1024 * 1024, 20_000, false, signal);
    const raw: V1RawRecord = { id: id('raw'), run_id: run.id, kind: 'search', provider, request, ...(response.ok ? { response: body } : { response: body, failure: safeError(new Error(`HTTP ${response.status}`), response.status) }), requested_at: requestedAt, completed_at: now(), latency_ms: Date.now() - started, sha256: sha(body) };
    run.raw_records.push(raw);
    raw.http_status = response.status;
    if (!response.ok) rememberHardProviderFailure(provider, response.status, settings);
    if (bodyFailure) { if (response.ok) raw.failure = bodyFailure; throw Object.assign(new Error(bodyFailure.message), bodyFailure); }
    if (!response.ok) throw new Error(`Hunter returned HTTP ${response.status}`);
    validateProviderEnvelope(body, 'hunter');
    const data = (body as any).data || {};
    const emails = Array.isArray(data.emails) ? data.emails : [];
    const usableEmails = emails.filter((email: unknown) => email && typeof email === 'object' && !Array.isArray(email) && typeof (email as any).value === 'string');
    if (usableEmails.length !== emails.length) {
      raw.failure = safeError(providerSchemaError(`${emails.length - usableEmails.length} malformed email records retained in raw evidence`));
      run.timeline.push({ at: now(), stage: 'search', status: 'failed', provider, query: domain, message: 'Some email records could not be normalized; raw evidence and valid records retained', error: raw.failure.message });
    }
    run.timeline.push({ at: now(), stage: 'search', status: 'success', provider, query: domain, latency_ms: raw.latency_ms, message: `Captured domain intelligence and ${emails.length} email records` });
    return usableEmails.slice(0, run.limits.max_results_per_query).map((email: any, index: number) => ({ id: id('result'), run_id: run.id, raw_record_id: raw.id, query: domain, provider, rank: index + 1, title: cleanText(`${email.first_name || ''} ${email.last_name || ''}`) || `Public email for ${domain}`, url: `https://${domain}`, snippet: cleanText(email.value), links: [], metadata: { ...email, organization: data.organization, pattern: data.pattern, domain }, search_latency_ms: raw.latency_ms, status: 'success' as const }));
  } catch (error) {
    const failure = safeError(error);
    const observedStatus=(error as {httpStatus?:number})?.httpStatus;
    if(observedStatus!==undefined)rememberHardProviderFailure(provider,observedStatus,settings);
    if (!run.raw_records.some(r => r.kind === 'search' && r.provider === provider && (r.request as any).domain === domain)) run.raw_records.push({ id: id('raw'), run_id: run.id, kind: 'search', provider, request, failure, ...(observedStatus!==undefined?{http_status:observedStatus}:{}), requested_at: requestedAt, completed_at: now(), latency_ms: Date.now() - started, sha256: sha(failure) });
    attachOperationFailure(run, provider, request, failure);
    run.timeline.push({ at: now(), stage: 'search', status: 'failed', provider, query: domain, latency_ms: Date.now() - started, message: 'Domain enrichment request failed', error: failure.message });
    return [];
  }
}

async function scrapeFirecrawl(run: V1Run, result: V1Result): Promise<void> {
  const settings = getAppSettings(); const provider = 'firecrawl';
  const request = { url: result.url, formats: ['markdown', 'html', 'links'] };
  const started = Date.now(); const requestedAt = now();
  try {
    if (!result.url || !isSafeExternalUrl(result.url)) throw new Error('Unsafe or invalid external URL');
    if (!settings.firecrawl_enabled || !settings.firecrawl_api_key) throw new Error('Firecrawl is not configured and enabled');
    if (!providerAvailable(run, provider, result.url)) throw new Error(`Firecrawl unavailable: ${hardUnavailableProviders.get(provider)}`);
    const response = await boundedFetch('https://api.firecrawl.dev/v1/scrape', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${settings.firecrawl_api_key}` }, body: JSON.stringify(request) });
    const body = await response.json().catch(() => ({}));
    const raw: V1RawRecord = { id: id('raw'), run_id: run.id, kind: 'scrape', provider, request, ...(response.ok ? { response: body } : { failure: safeError(new Error(`HTTP ${response.status}`), response.status), response: body }), requested_at: requestedAt, completed_at: now(), latency_ms: Date.now() - started, sha256: sha(body) };
    run.raw_records.push(raw);
    if (!response.ok) rememberHardProviderFailure(provider, response.status, settings);
    result.scrape_latency_ms = raw.latency_ms;
    result.raw_record_id = `${result.raw_record_id},${raw.id}`;
    if (!response.ok || (body as any)?.success === false) throw new Error(`Firecrawl returned HTTP ${response.status}: ${cleanText((body as any)?.error)}`);
    const data = (body as any)?.data || body;
    result.markdown = cleanText(data?.markdown);
    result.html = cleanText(data?.html || data?.rawHtml);
    result.text = cleanText(data?.text || data?.content || data?.markdown);
    result.links = Array.isArray(data?.links) ? data.links.map(cleanText).filter(Boolean) : [];
    result.metadata = { ...result.metadata, ...(data?.metadata && typeof data.metadata === 'object' ? data.metadata : {}) };
    run.timeline.push({ at: now(), stage: 'scrape', status: 'success', provider, query: result.query, latency_ms: raw.latency_ms, message: `Captured page content for ${result.url}` });
  } catch (error) {
    const failure = safeError(error); result.error = failure.message; result.scrape_latency_ms = Date.now() - started;
    result.metadata = { ...result.metadata, scrape_status: 'failed' };
    if (!run.raw_records.some(r => r.kind === 'scrape' && (r.request as any).url === result.url)) run.raw_records.push({ id: id('raw'), run_id: run.id, kind: 'scrape', provider, request, failure, requested_at: requestedAt, completed_at: now(), latency_ms: Date.now() - started, sha256: sha(failure) });
    run.timeline.push({ at: now(), stage: 'scrape', status: 'failed', provider, query: result.query, latency_ms: Date.now() - started, message: `Scrape failed for ${result.url}`, error: failure.message });
    const apifyCaptured = await scrapeApifyFallback(run, result);
    if (!apifyCaptured) await scrapeDirectFallback(run, result);
  }
}

async function scrapeApifyFallback(run: V1Run, result: V1Result): Promise<boolean> {
  const settings = getAppSettings(); const provider = 'apify';
  if (!settings.apify_enabled || !settings.apify_api_key) return false;
  if (!providerAvailable(run, provider, result.url)) return false;
  const request = { actor: 'apify/website-content-crawler', startUrls: [{ url: result.url }], maxCrawlPages: 1 };
  const started = Date.now(); const requestedAt = now();
  try {
    if (!result.url || !isSafeExternalUrl(result.url)) throw new Error('Unsafe or invalid external URL');
    const endpoint = `https://api.apify.com/v2/acts/apify~website-content-crawler/run-sync-get-dataset-items?token=${encodeURIComponent(settings.apify_api_key)}&timeout=60`;
    const response = await boundedFetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ startUrls: request.startUrls, maxCrawlPages: 1, crawlerType: 'playwright:adaptive', saveHtml: true }) }, 65_000);
    const body = await response.json().catch(() => ({}));
    const raw: V1RawRecord = { id: id('raw'), run_id: run.id, kind: 'scrape', provider, request, ...(response.ok ? { response: body } : { response: body, failure: safeError(new Error(`HTTP ${response.status}`), response.status) }), requested_at: requestedAt, completed_at: now(), latency_ms: Date.now() - started, sha256: sha(body) };
    run.raw_records.push(raw); result.raw_record_id = `${result.raw_record_id},${raw.id}`;
    if (!response.ok) rememberHardProviderFailure(provider, response.status, settings);
    if (!response.ok) throw new Error(`Apify returned HTTP ${response.status}`);
    const item = Array.isArray(body) ? body[0] : body;
    result.markdown = cleanText((item as any)?.markdown);
    result.html = cleanText((item as any)?.html);
    result.text = cleanText((item as any)?.text || (item as any)?.markdown);
    result.links = Array.isArray((item as any)?.links) ? (item as any).links.map((link: any) => cleanText(link?.url || link)).filter(Boolean) : [];
    result.metadata = { ...result.metadata, apify: Object.fromEntries(Object.entries((item as any)?.metadata || {}).slice(0, 100)) };
    if (!result.text && !result.markdown && !result.html) throw new Error('Apify returned no page content');
    result.status = 'success'; result.error = undefined; result.scrape_latency_ms = raw.latency_ms;
    run.timeline.push({ at: now(), stage: 'scrape', status: 'success', provider, query: result.query, latency_ms: raw.latency_ms, message: `Captured page content for ${result.url}` });
    return true;
  } catch (error) {
    const failure = safeError(error);
    if (!run.raw_records.some(r => r.kind === 'scrape' && r.provider === provider && (r.request as any).startUrls?.[0]?.url === result.url)) run.raw_records.push({ id: id('raw'), run_id: run.id, kind: 'scrape', provider, request, failure, requested_at: requestedAt, completed_at: now(), latency_ms: Date.now() - started, sha256: sha(failure) });
    run.timeline.push({ at: now(), stage: 'scrape', status: 'failed', provider, query: result.query, latency_ms: Date.now() - started, message: `Apify fallback failed for ${result.url}`, error: failure.message });
    return false;
  }
}

const DEFAULT_DIRECT_PAGE_MAX_BYTES = 2 * 1024 * 1024;
const OFFICIAL_DIRECT_PAGE_MAX_BYTES = 4 * 1024 * 1024;

async function scrapeDirectFallback(run: V1Run, result: V1Result, timeoutMs = 12_000, officialDomain?: string, attempt = 1, signal?: AbortSignal): Promise<void> {
  const provider = 'direct-http'; const request = {
    url: result.url,
    max_bytes: officialDomain ? OFFICIAL_DIRECT_PAGE_MAX_BYTES : DEFAULT_DIRECT_PAGE_MAX_BYTES,
    ...(officialDomain ? { max_bytes_domain: officialDomain } : {}),
    ...(officialDomain ? { accepted_content_encoding: 'gzip, identity' } : {}),
    ...(attempt > 1 ? { attempt } : {}),
  };
  const started = Date.now(); const requestedAt = now();
  let responseRecorded = false;
  try {
    const { response, text, transport, provenance } = await safeFetchOutboundText(result.url, {
      timeoutMs,
      signal,
      maxBytes: request.max_bytes,
      maxBytesDomain: officialDomain,
      allowGzip: Boolean(officialDomain),
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    const headers = Object.fromEntries(response.headers.entries());
    const payload = { status: response.status, headers, body: text, provenance, ...(transport ? { transport } : {}) };
    const raw: V1RawRecord = { id: id('raw'), run_id: run.id, kind: 'scrape', provider, request, ...(response.ok ? { response: payload } : { response: payload, failure: safeError(new Error(`HTTP ${response.status}`), response.status) }), requested_at: requestedAt, completed_at: now(), latency_ms: Date.now() - started, sha256: sha(payload) };
    run.raw_records.push(raw); responseRecorded = true;
    result.raw_record_id = [result.raw_record_id, raw.id].filter(Boolean).join(',');
    if (!response.ok) throw new Error(`Direct retrieval returned HTTP ${response.status}`);
    const originalUrl = result.url;
    result.url = provenance.finalUrl;
    result.html = text;
    result.text = visibleHtmlText(text);
    result.links = [...text.matchAll(/href=["']([^"'#]+)["']/gi)].map(match => {
      try { return new URL(match[1], provenance.finalUrl).toString(); } catch { return ''; }
    }).filter(Boolean).slice(0, 500);
    result.metadata = { ...result.metadata,
      ...(originalUrl !== provenance.finalUrl ? { original_url: originalUrl } : {}),
      scrape_status: 'success', direct_http_status: response.status, content_type: response.headers.get('content-type') || '' };
    result.status = 'success'; result.error = undefined; result.scrape_latency_ms = raw.latency_ms;
    run.timeline.push({ at: now(), stage: 'scrape', status: 'success', provider, query: result.query, latency_ms: raw.latency_ms, message: `Captured bounded HTML fallback for ${result.url}` });
  } catch (error) {
    const failure = safeError(error);
    if (!responseRecorded) {
      const raw: V1RawRecord = { id: id('raw'), run_id: run.id, kind: 'scrape', provider, request, failure, requested_at: requestedAt, completed_at: now(), latency_ms: Date.now() - started, sha256: sha(failure) };
      run.raw_records.push(raw);
      result.raw_record_id = [result.raw_record_id, raw.id].filter(Boolean).join(',');
    }
    if (result.provider === 'direct-http') result.status = 'failed';
    result.error = result.error
      ? `${result.error}; direct retrieval: ${failure.message}`
      : `Direct retrieval failed: ${failure.message}`;
    result.metadata = { ...result.metadata, scrape_status: 'failed' };
    run.timeline.push({ at: now(), stage: 'scrape', status: 'failed', provider, query: result.query, latency_ms: Date.now() - started, message: `Direct fallback failed for ${result.url}`, error: failure.message });
  }
}

async function crawlOfficialWebsite(run: V1Run, domain: string, signal: AbortSignal): Promise<void> {
  throwIfRunAborted(signal);
  if (!domain) return;
  const pagePriority = (url: string) => /(?:management|leadership|team|board|director|executive)/i.test(url) ? 4 : /contact/i.test(url) ? 3 : /about|company/i.test(url) ? 2 : 1;
  // Search already discovered real CMS routes (for example contact-us.php and
  // leadership.php). Seed those exact URLs before generic guessed paths.
  const discoveredSearchPages = run.results
    .filter(result => sameDomainOrSubdomain(result.url, domain))
    .map(result => result.url)
    .filter(url => !/\.(?:css|js|mjs|json|xml|png|jpe?g|gif|webp|svg|ico|woff2?|ttf|eot|pdf|zip)(?:[?#]|$)/i.test(url))
    .sort((a, b) => pagePriority(b) - pagePriority(a));
  // These routes cover the common places where smaller international
  // distributors publish contacts and management without linking them clearly
  // from the home page. Exact search-discovered CMS routes still take priority.
  const fallbackUrls = officialPageFallbackUrls(domain, discoveredSearchPages);
  let transientRetries = 0;
  const existingPages = run.results.filter(result => sameDomainOrSubdomain(result.url, domain) && result.status === 'success' && Boolean(result.html || result.text || result.markdown));
  await crawlOfficialPages(domain, run.limits.max_scrapes, existingPages, [...discoveredSearchPages, ...fallbackUrls], async (url, rank) => {
    throwIfRunAborted(signal);
    const result: V1Result = {
      id: id('result'), run_id: run.id, raw_record_id: '',
      query: `official website crawl: ${run.company_name} ${run.country}`,
      provider: 'direct-http', rank,
      title: `Official page: ${new URL(url).pathname || '/'}`,
      url, snippet: 'Bounded deterministic crawl of the resolved official company domain.',
      links: [], metadata: { official_domain: domain, official_domain_confidence: run.identity_resolution?.confidence },
      search_latency_ms: 0, status: 'pending',
    };
    // Official pages use one deterministic, bounded capture path. This avoids
    // conflicting scrape payloads while preserving the complete HTTP response
    // (or structured failure) for every attempted page.
    run.results.push(result);
    await scrapeDirectFallback(run, result, 10_000, domain, 1, signal);
    throwIfRunAborted(signal);
    const lastCapture = run.raw_records.at(-1);
    // At most two extra network attempts for the entire official crawl. Never
    // retry caller aborts, policy refusals, body limits, HTTP failures or every
    // external search result. Both attempts remain in immutable raw evidence.
    if (transientRetries < 2 && lastCapture?.request.url === url && lastCapture.failure
      && /^(?:RETRIEVAL_TIMEOUT|socket hang up|(?:read )?ECONNRESET)$/i.test(lastCapture.failure.message)) {
      transientRetries++;
      run.timeline.push({ at: now(), stage: 'scrape', status: 'pending', provider: 'direct-http',
        message: `Retrying transient official-page capture (${transientRetries}/2 retry budget)` });
      await scrapeDirectFallback(run, result, 10_000, domain, 2, signal);
    }
    return result;
  });
}

async function extractStructuredEvidence(run: V1Run, profile: 'interactive' | 'bulk', settings: AppSettings, signal: AbortSignal): Promise<void> {
  throwIfRunAborted(signal);
  assertResearchSettingsCurrent(settings);
  const domain = run.identity_resolution?.official_domain || '';
  const pagePriority = (url: string) => /(?:management|leadership|team|board|director|executive)/i.test(url) ? 3 : /contact/i.test(url) ? 2 : /about|company/i.test(url) ? 1 : 0;
  // Provider-returned full text from an official-domain URL is equally valid
  // evidence. Do not discard it merely because the later direct crawl failed.
  const pages = run.results.filter(result => domain && result.status === 'success' && sameDomainOrSubdomain(result.url, domain) && Boolean(result.text || result.markdown || result.html))
    .sort((a, b) => pagePriority(b.url) - pagePriority(a.url));
  const officialChunks = pages.flatMap(result => {
    const source = cleanText(result.text || result.markdown);
    const size = 6_000;
    const limit = profile === 'bulk' ? 3 : 4;
    return Array.from({ length: Math.min(limit, Math.ceil(source.length / size)) }, (_, index) => ({
      id: `${result.id}-chunk-${index + 1}`, result_id: result.id, url: result.url, source_type: 'official' as const, text: source.slice(index * size, (index + 1) * size),
    })).filter(chunk => chunk.text);
  });
  const linkedInResults = [...new Map(run.results.filter(result => /(^|\.)linkedin\.com$/i.test((() => { try { return new URL(result.url).hostname.replace(/^www\./, ''); } catch { return ''; } })())).map(result => [result.url.replace(/[?#].*$/, '').replace(/\/$/, ''), result])).values()]
    .sort((a, b) => Number(/linkedin\.com\/in\//i.test(b.url)) - Number(/linkedin\.com\/in\//i.test(a.url)) || a.rank - b.rank);
  const linkedInChunks = linkedInResults
    .map(result => ({ id: `${result.id}-chunk-1`, result_id: result.id, url: result.url, source_type: 'linkedin' as const, text: cleanText(`${result.title}\n${result.snippet}\n${result.text || ''}`).slice(0, 6_000) }))
    .filter(chunk => chunk.text);
  const chunks = [...officialChunks.slice(0, 8), ...linkedInChunks.slice(0, 2)];
  run.evidence_workspace = { chunks, accepted_claims: [], rejected_claims: [] };
  if (!chunks.length) return;
  const providers = orderAiProviders([
    ...(settings.groq_enabled && settings.groq_api_key ? [{ name: 'groq-extraction', url: 'https://api.groq.com/openai/v1/chat/completions', key: settings.groq_api_key, model: settings.groq_model }] : []),
    ...(settings.nvidia_enabled && settings.nvidia_api_key ? [{ name: 'nvidia-extraction', url: `${(settings.nvidia_base_url || 'https://integrate.api.nvidia.com/v1').replace(/\/+$/, '')}/chat/completions`, key: settings.nvidia_api_key, model: settings.nvidia_model }] : []),
  ], settings.primary_ai_provider);
  if (!providers.length) return;
  // Two evidence batches at most keeps interactive latency bounded while still
  // giving the model up to ten complete, source-addressable chunks.
  const batches = Array.from({ length: Math.ceil(chunks.length / 5) }, (_, index) => chunks.slice(index * 5, index * 5 + 5));
  for (const [batchIndex, batchChunks] of batches.entries()) {
    throwIfRunAborted(signal);
    const request = {
      company_name: run.company_name, country: run.country, official_domain: domain, batch: batchIndex + 1, total_batches: batches.length,
      instruction: 'Extract only explicit facts about the exact target company. Official chunks may support address, email, phone, and leaders. LinkedIn chunks may support leader name/title only, never email, phone, or address. Return JSON object {claims:[{field:"address|email|phone|leader",value:string,role?:string,source_chunk_id:string,quote:string}]}. quote must be a short exact substring from that chunk. Do not infer, repair, or add facts.',
      chunks: batchChunks,
    };
    let batchSucceeded = false;
    for (const provider of providers) {
      throwIfRunAborted(signal);
      assertResearchSettingsCurrent(settings);
      if (!providerAvailable(run, provider.name, `evidence batch ${batchIndex + 1}`)) continue;
      const started = Date.now(); const requestedAt = now();
      try {
        const response = await safeFetchProviderRequest(provider.url, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${provider.key}` }, body: JSON.stringify({ model: provider.model, temperature: 0, max_tokens: 2200, messages: [{ role: 'system', content: 'You are a strict evidence extractor. Output JSON only.' }, { role: 'user', content: JSON.stringify(request) }], ...(provider.name.startsWith('nvidia') ? { chat_template_kwargs: { thinking: false } } : {}) }), timeoutMs: 20_000, maxBytes: 8 * 1024 * 1024, signal });
        const { body, failure: bodyFailure } = await readProviderResponse(response, 8 * 1024 * 1024, 20_000, false, signal);
        const raw: V1RawRecord = { id: id('raw'), run_id: run.id, kind: 'ai', provider: provider.name, request, ...(response.ok ? { response: body } : { response: body, failure: safeError(new Error(`HTTP ${response.status}`), response.status) }), requested_at: requestedAt, completed_at: now(), latency_ms: Date.now() - started, sha256: sha(body) };
        run.raw_records.push(raw);
        raw.http_status = response.status;
        if (!response.ok) rememberHardProviderFailure(provider.name, response.status, settings);
        if (bodyFailure) { if (response.ok) raw.failure = bodyFailure; throw Object.assign(new Error(bodyFailure.message), bodyFailure); }
        if (!response.ok) throw new Error(`${provider.name} returned HTTP ${response.status}`);
        validateProviderEnvelope(body, 'ai');
        const choice = (body as any).choices[0];
        if (choice.message.role !== undefined && choice.message.role !== 'assistant') throw providerSchemaError('AI extraction message must have the assistant role');
        if (choice.finish_reason !== undefined && choice.finish_reason !== 'stop') throw providerSchemaError('AI extraction response was truncated or incomplete');
        const content = cleanText(choice.message.content);
        let claims: unknown;
        try { claims = JSON.parse(content)?.claims; }
        catch { throw providerSchemaError('AI extraction response is not one complete JSON object'); }
        if (!Array.isArray(claims)) throw providerSchemaError('AI extraction response lacks a claims array');
        for (const claim of claims) {
          if (!claim || typeof claim !== 'object' || Array.isArray(claim)) {
            run.evidence_workspace.rejected_claims.push({ claim, reason: 'claim is not an object' });
            continue;
          }
          const chunk = batchChunks.find(item => item.id === claim.source_chunk_id);
          const field = cleanText(claim.field) as 'address' | 'email' | 'phone' | 'leader';
          const value = cleanText(claim.value); const quote = cleanText(claim.quote); const role = cleanText(claim.role);
          const unsupportedRole = claim.role !== undefined && (!role || role.length > 120 || !quote.toLowerCase().includes(role.toLowerCase()));
          if (!chunk || !['address', 'email', 'phone', 'leader'].includes(field) || !value || !quote || !chunk.text.includes(quote) || !quote.toLowerCase().includes(value.toLowerCase()) || (chunk.source_type === 'linkedin' && field !== 'leader')) {
            run.evidence_workspace.rejected_claims.push({ claim, reason: 'claim lacks an exact supporting quote in its cited evidence chunk' });
            continue;
          }
          if (unsupportedRole) {
            run.evidence_workspace.rejected_claims.push({ claim, reason: 'claim role lacks an exact supporting quote in its cited evidence chunk' });
            continue;
          }
          const accepted = { field, value, ...(role ? { role } : {}), source_result_id: chunk.result_id, source_url: chunk.url, source_type: chunk.source_type, quote };
          if (!run.evidence_workspace.accepted_claims.some(existing => existing.field === accepted.field && existing.value.toLowerCase() === accepted.value.toLowerCase())) run.evidence_workspace.accepted_claims.push(accepted);
        }
        run.timeline.push({ at: now(), stage: 'resolution', status: 'success', provider: provider.name, latency_ms: raw.latency_ms, message: `Evidence workspace batch ${batchIndex + 1}/${batches.length} processed` });
        batchSucceeded = true;
        break;
      } catch (error) {
        const failure = safeError(error);
        if (failure.status) rememberHardProviderFailure(provider.name, failure.status, settings);
        attachOperationFailure(run, provider.name, request, failure);
        if (!signal.aborted && /aborted|timeout|fetch failed|socket|network/i.test(failure.message) && researchSettingsStillCurrent(settings)) {
          providerCooldowns.set(providerCircuitKey(provider.name), { until: Date.now() + 120_000, reason: failure.message });
        }
        if (!run.raw_records.some(record => record.provider === provider.name && (record.request as any).batch === batchIndex + 1)) run.raw_records.push({ id: id('raw'), run_id: run.id, kind: 'ai', provider: provider.name, request, failure, ...(failure.status ? { http_status: failure.status } : {}), requested_at: requestedAt, completed_at: now(), latency_ms: Date.now() - started, sha256: sha(failure) });
        run.timeline.push({ at: now(), stage: 'resolution', status: 'failed', provider: provider.name, latency_ms: Date.now() - started, message: `Evidence workspace batch ${batchIndex + 1}/${batches.length} failed; trying fallback`, error: failure.message });
        throwIfRunAborted(signal);
      }
    }
    if (!batchSucceeded) run.timeline.push({ at: now(), stage: 'resolution', status: 'failed', message: `Evidence workspace batch ${batchIndex + 1}/${batches.length} could not be processed; captured chunks remain available` });
  }
}

export function classifyRunStatus(resultsCount: number, hasRecordedFailures: boolean, successfulSearchRequests: number): V1Run['status'] {
  if (resultsCount > 0) return hasRecordedFailures ? 'PARTIAL' : 'COMPLETED';
  // An empty, successful search is valid negative evidence. It must surface as
  // NOT_FOUND to callers, not masquerade as an engine crash because an earlier
  // optional provider also rate-limited or timed out.
  if (successfulSearchRequests > 0) return hasRecordedFailures ? 'PARTIAL' : 'COMPLETED';
  return 'FAILED';
}

async function execute(companyName: string, country: string, profile: 'interactive' | 'bulk', options: V1RunOptions = {}): Promise<V1Run> {
  const bulk = profile === 'bulk';
  throwIfCancelled(options.signal);
  const deadline = createDeadlineSignal(options.signal, options.timeoutMs ?? (bulk ? 180_000 : RUN_TIMEOUT_MS), 'RUN_DEADLINE_EXCEEDED');
  const run: V1Run = { id: id('run'), company_name: companyName.trim(), country: country.trim(), status: 'RUNNING', started_at: now(), research_context: undefined, queries: [], results: [], raw_records: [], timeline: [], limits: bulk
    ? { max_queries: 4, max_results_per_query: 8, max_scrapes: 8, timeout_ms: options.timeoutMs ?? 180_000 }
    : { max_queries: MAX_QUERIES, max_results_per_query: MAX_RESULTS, max_scrapes: MAX_SCRAPES, timeout_ms: options.timeoutMs ?? RUN_TIMEOUT_MS } };
  run.timeline.push({ at: now(), stage: 'run', status: 'pending', message: `Started bounded V1 enrichment for ${run.company_name} in ${run.country}` });
  try {
    const settings = Object.freeze({ ...getAppSettings() });
    run.research_context = createV1ResearchContext(profile, settings);
    run.queries = await generateQueries(run, profile, settings, deadline.signal);
    // V1's supported retrieval path is intentionally narrow: Serper discovers
    // candidates, Hunter enriches the resolved company domain, and bounded
    // deterministic HTTP capture reads the official site. Other experimental
    // providers remain in the repository but cannot enter this critical path.
    for (const query of run.queries) run.results.push(...await searchSerper(run, query, settings, deadline.signal));
    await resolveSerperSearchLinks(run, settings, deadline.signal);
    assertResearchSettingsCurrent(settings);
    run.identity_resolution = resolveOfficialDomain(run.company_name, run.country, run.results);
    run.timeline.push({ at: now(), stage: 'resolution', status: run.identity_resolution.official_domain ? 'success' : 'skipped', message: run.identity_resolution.official_domain
      ? `Resolved official domain ${run.identity_resolution.official_domain} with ${run.identity_resolution.confidence} confidence`
      : 'No domain met the minimum company-ownership evidence threshold; directories remain evidence only' });
    run.results.push(...await enrichHunter(run, run.identity_resolution.official_domain, settings, deadline.signal));
    assertResearchSettingsCurrent(settings);
    const unique = [...new Map(run.results.filter(r => r.url&&!isSerperGoogleRedirect(r.url)).map(r => [r.url, r])).values()];
    if (!bulk) await Promise.all(unique.filter(result => result.provider !== 'direct-http' && !result.text && !result.markdown).slice(0, MAX_SCRAPES).map(result => scrapeDirectFallback(run, result, 12_000, undefined, 1, deadline.signal)));
    throwIfRunAborted(deadline.signal);
    // Search providers may return the same URL for several queries. Fetch it
    // once, then project that captured page/failure onto every normalized row
    // without collapsing the per-query result records. Redirected rows retain
    // their requested URL as metadata and project the final URL consistently.
    const fetchedByUrl = new Map(unique.map(result => [cleanText(result.metadata.original_url) || result.url, result]));
    for (const result of run.results) {
      const fetched = fetchedByUrl.get(result.url);
      if (!fetched || fetched === result || !fetched.metadata.scrape_status) continue;
      result.raw_record_id = `${result.raw_record_id},${fetched.raw_record_id.split(',').slice(-1)[0]}`;
      result.url = fetched.url;
      result.text = fetched.text; result.markdown = fetched.markdown; result.html = fetched.html;
      result.links = fetched.links;
      result.metadata = { ...result.metadata, ...Object.fromEntries(['original_url','scrape_status','direct_http_status','content_type']
        .filter(key=>fetched.metadata[key]!==undefined).map(key=>[key,fetched.metadata[key]])) };
      result.scrape_latency_ms = fetched.scrape_latency_ms; result.status = fetched.status; result.error = fetched.error;
    }
    await crawlOfficialWebsite(run, run.identity_resolution.official_domain, deadline.signal);
    await extractStructuredEvidence(run, profile, settings, deadline.signal);
    throwIfRunAborted(deadline.signal);
    assertResearchSettingsCurrent(settings);
    const successfulSearchRequests = run.raw_records.filter(record => record.provider === 'serper' && record.kind === 'search' && record.response !== undefined && !record.failure).length;
    const usableCount=run.results.filter(result=>result.status==='success').length;
    run.status = run.results.length>0&&usableCount===0 ? 'FAILED'
      : classifyRunStatus(usableCount, run.timeline.some(e => e.status === 'failed'), successfulSearchRequests);
  } catch (error) {
    const failure = deadline.signal.aborted ? safeError(deadline.signal.reason) : safeError(error);
    run.status = run.results.length ? 'PARTIAL' : 'FAILED';
    run.timeline.push({ at: now(), stage: 'run', status: 'failed', message: !deadline.signal.aborted && error instanceof Error && error.message === 'RESEARCH_CONFIGURATION_CHANGED'
      ? 'Provider settings changed; captured evidence was saved. Retry research using the current configuration.'
      : 'Run stopped before all stages completed', error: failure.message });
  } finally {
    run.completed_at = now();
    run.timeline.push({ at: now(), stage: 'storage', status: 'success', message: `Persisting ${run.raw_records.length} raw records and ${run.results.length} normalized results` });
    deadline.cleanup();
    persistV1Run(run);
  }
  return run;
}

export async function runV1Enrichment(companyName: string, country: string, options: V1RunOptions = {}): Promise<V1Run> {
  return withBoundedConcurrency(6, async () => {
    const releaseIdentityWork = acquireCompanyIdentityWork();
    try {
      const company = cleanText(companyName); const nation = cleanText(country);
      if (!company || !nation) throw new Error('Exact company name and country are required');
      const profile = options.profile || 'interactive';
      const key = `${profile}::${company.toLowerCase()}::${nation.toLowerCase()}`;
      cleanupActiveRuns();
      const existing = activeRuns.get(key); if (existing) return existing.promise;
      const task = execute(company, nation, profile, options);
      activeRuns.set(key, { promise: task, startedAt: Date.now() });
      try { return await task; } finally { activeRuns.delete(key); }
    } finally { releaseIdentityWork(); }
  });
}

export async function getV1Run(runId: string): Promise<V1Run | null> {
  if (!/^[a-z0-9-]+$/i.test(runId)) return null;
  const file = runPath(runId); if (!fs.existsSync(file)) return null;
  const persisted = JSON.parse(fs.readFileSync(file, 'utf8'));
  return hydrateV1RunFromStorage(persisted, dataDir) as Promise<V1Run>;
}

/** Activity-only projection: never hydrate raw/provider/page evidence blobs. */
export function listV1ActivityEvents(limit = 500): Array<V1TimelineEvent & { run_id: string; company_name: string }> {
  const maximum = Number.isFinite(limit) ? Math.max(1, Math.min(1000, Math.trunc(limit))) : 500;
  const events: Array<V1TimelineEvent & { run_id: string; company_name: string }> = [];
  const newest = (a: V1TimelineEvent, b: V1TimelineEvent) => (Date.parse(b.at) || 0) - (Date.parse(a.at) || 0);
  for (const header of listV1RunSummaries(20)) {
    try {
      if (!/^[a-z0-9-]+$/i.test(header.id)) throw new Error('Invalid stored run identity');
      const stored = JSON.parse(fs.readFileSync(runPath(header.id), 'utf8'));
      if (stored.id !== header.id || !Array.isArray(stored.timeline)) throw new Error('Invalid stored run timeline');
      for (const event of stored.timeline) {
        if (!event || typeof event.at !== 'string' || typeof event.stage !== 'string' || typeof event.status !== 'string' || typeof event.message !== 'string') throw new Error('Invalid stored event');
        events.push({ at: event.at, stage: event.stage, status: event.status, message: event.message,
          ...(typeof event.provider === 'string' ? { provider: event.provider } : {}),
          ...(typeof event.query === 'string' ? { query: event.query } : {}),
          ...(typeof event.error === 'string' ? { error: event.error } : {}),
          ...(Number.isFinite(event.latency_ms) ? { latency_ms: event.latency_ms } : {}),
          run_id: header.id, company_name: header.company_name });
        if (events.length >= maximum * 2) { events.sort(newest); events.length = maximum; }
      }
    } catch {
      // This is a current read failure, not an invented historical provider event.
      events.push({ at: now(), stage: 'storage', status: 'failed', message: 'Stored research timeline could not be read.',
        error: 'RUN_TIMELINE_READ_FAILED', run_id: header.id, company_name: header.company_name });
    }
  }
  return events.sort(newest).slice(0, maximum);
}

export async function listV1Runs(): Promise<V1Run[]> {
  if (!fs.existsSync(dataDir)) return [];
  const runs = await Promise.all(fs.readdirSync(dataDir).filter(name => /^run-[a-z0-9-]+\.json$/i.test(name)).map(async name => {
    try {
      const persisted = JSON.parse(fs.readFileSync(path.join(dataDir, name), 'utf8'));
      return await hydrateV1RunFromStorage(persisted, dataDir) as V1Run;
    } catch { return null; }
  }));
  return runs.filter((run): run is V1Run => Boolean(run)).sort((a, b) => b.started_at.localeCompare(a.started_at));
}

export function listV1RunSummaries(limit = 200): V1RunSummary[] {
  if (!summaryCache) {
    // The list view needs identity/status, not multi-megabyte raw payloads.
    // Exact result/failure counts are loaded from the selected run on demand.
    summaryCache = listV1RunIdentityHeaders().map(header => ({
      ...header, result_count: 0, raw_record_count: 0, failure_count: 0,
    }));
  }
  return summaryCache.slice(0, Math.max(1, Math.min(100_000, limit)));
}

/** Cursor browsing is a local view of existing immutable identity headers.
 * Never hydrate provider/page blobs or change cache-reuse policy to list history.
 * A timestamp + ID boundary avoids offset drift when a new run arrives. */
export function listV1RunPage(limit = 50, cursor = '') {
  if (!Number.isInteger(limit) || limit < 1 || limit > 200 || typeof cursor !== 'string' || cursor.length > 2048) throw new Error('HISTORY_PAGE_INVALID');
  let boundary: { started_at: string; id: string } | undefined;
  if (cursor) {
    try {
      if (!/^[A-Za-z0-9_-]+$/.test(cursor)) throw new Error();
      const bytes = Buffer.from(cursor, 'base64url');
      if (bytes.toString('base64url') !== cursor) throw new Error();
      const parsed = JSON.parse(bytes.toString('utf8'));
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || Object.keys(parsed).length !== 2
        || typeof parsed.started_at !== 'string' || parsed.started_at.length > 64 || !Number.isFinite(Date.parse(parsed.started_at))
        || typeof parsed.id !== 'string' || !/^run-[a-z0-9-]{1,128}$/i.test(parsed.id)) throw new Error();
      boundary = parsed;
    } catch { throw new Error('HISTORY_PAGE_INVALID'); }
  }
  const compare = (a: { started_at: string; id: string }, b: { started_at: string; id: string }) =>
    b.started_at.localeCompare(a.started_at) || b.id.localeCompare(a.id);
  const ordered = [...listV1RunIdentityHeaders()].sort(compare);
  const eligible = boundary ? ordered.filter(item => compare(item, boundary!) > 0) : ordered;
  const runs = eligible.slice(0, limit);
  const last = runs[runs.length - 1];
  const next_cursor = eligible.length > limit && last
    ? Buffer.from(JSON.stringify({ started_at: last.started_at, id: last.id })).toString('base64url') : null;
  return { runs, next_cursor, limit };
}

export function getV1EngineDiagnostics() {
  return {
    active_runs: activeRuns.size,
    summary_cache_entries: summaryCache?.length || 0,
    suppressed_providers: [...hardUnavailableProviders.entries()].map(([provider, reason]) => ({ provider, reason })),
    cooling_down_providers: [...providerCooldowns.entries()]
      .filter(([, state]) => state.until > Date.now())
      .map(([provider, state]) => ({ provider, reason: state.reason, retry_at: new Date(state.until).toISOString() })),
  };
}

export function getV1ProviderMetrics() {
  const store = loadProviderMetricStore();
  return Object.fromEntries(Object.entries(store.providers).map(([provider, metric]) => [provider, {
    requestCount: metric.request_count,
    successCount: metric.success_count,
    failureCount: metric.failure_count,
    timeoutCount: metric.timeout_count,
    rateLimitCount: metric.rate_limit_count,
    averageLatencyMs: metric.request_count ? Math.round(metric.total_latency_ms / metric.request_count) : null,
    lastError: metric.last_error,
    lastHttpStatus: metric.last_http_status,
    lastCompletedAt: metric.last_completed_at,
    lastRequestedAt: metric.last_requested_at ?? null,
  }]));
}
