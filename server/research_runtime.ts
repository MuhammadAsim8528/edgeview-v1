import fs from 'fs';
import path from 'path';
import { AppSettings, getAppSettings } from './settings';
import { ResourceGovernor } from './resource_governor';
import { ResearchLedger } from './research_ledger';
import { getProjectRoot, isTestProcess } from './db_paths';
import { EntityResearchContext, ResearchAction } from './research_director';
import { assertPublicResearchQuery } from './public_research_identity';
import {
  ResearchDirector,
  assessEvidenceForCountry,
  isSafeExternalUrl,
  isValidCorporateContactPerson,
  detectCountryMentions,
  discoverInternalLinks,
  selectHighValueInternalLinks,
} from './research_director';
import { isPlausibleOfficialCompanyUrl } from './official_website';
import {
  callAi,
  extractJsonBlock,
  safeJsonParse,
  getCachedCompany,
  getMissingFields,
} from './enrichment';
import { getDb } from './sqlite';
import { assertSafeHeaderValue } from './utils/header_encoder';
import { focusEvidenceForTargetCountry, htmlToEvidenceText, mergeScrapedAndDirectEvidence, preservePageContent } from './page_content';
import { buildEntityScopedEvidence } from './evidence_neighborhood';
import { safeFetchOutboundText } from './url_safety';
import { failureContextFingerprint, rememberProviderFailure, shouldSuppressEquivalentFailure, type ProviderFailureRecord } from './provider_failure_memory';
import {
  canRunEntityProofAction,
  createEntityProofState,
  isEntitySupportedForContactRecovery,
  planContactRecoveryActions,
  shouldUseEntityProofSearch,
  updateEntityProofState,
  type EntityProofState,
  buildTradeEntityFingerprint,
} from './entity_proof_search';
import {
  scoreDiscriminativeTransactionFeatures,
  planJointTransactionQueries,
  planRelationalWitnessActions,
  type DiscriminatingResearchAction,
} from './trade_fingerprint';

/**
 * EDGEVIEW — CONTROLLED AUTONOMOUS RESEARCH RUNTIME
 *
 * Layers a bounded, model-driven research loop over the existing (deterministic)
 * ResearchDirector pipeline. NIM (primary) / Groq (fallback) propose what should
 * be investigated as strict-JSON controlled tool actions; EdgeView validates and
 * safely executes them with the existing providers/scrapers/evidence gates.
 * The deterministic planner remains the fallback whenever the model is absent,
 * times out, or returns malformed/unsafe output.
 *
 * All repository artifacts are written only under `.agent/traces/` and
 * `.agent/incidents/` per repository hygiene policy.
 */

// ---------------------------------------------------------------------------
// Formal research state (spec §7)
// ---------------------------------------------------------------------------

export interface ResearchContradiction {
  field: string;
  valueA: string;
  sourceA: string;
  valueB: string;
  sourceB: string;
  detectedAt: string;
}

export interface ResearchFailedAction {
  action: string;
  reason: string;
  url?: string;
  at: string;
}

export interface ResearchEvidenceItem {
  url: string;
  title: string;
  content: string;
  blocks?: import('./evidence_neighborhood').EvidenceBlock[];
  mixed_entity_page?: boolean;
}

export interface ResearchState {
  research_id: string;
  company: string;
  target_country: string;
  target_city: string;
  source_file_id: string;
  objective: string;
  known_information: Record<string, any>;
  missing_information: string[];
  hypotheses: string[];
  queries_attempted: string[];
  pages_scraped: string[];
  evidence: ResearchEvidenceItem[];
  modelNotes: string[];
  contradictions: ResearchContradiction[];
  failed_actions: ResearchFailedAction[];
  actions_taken: string[];
  current_plan: any;
  coverage: number;
  confidence: number;
  iteration: number;
  status: 'researching' | 'completed' | 'failed';
  lastInfoGain: number;
  zeroGainStreak: number;
  modelPlanningAttempts: number;
  directScrapeTargets: string[];
  startedAt: string;
  completedAt?: string;
  entity_proof?: EntityProofState;
  provider_failure_memory?: ProviderFailureRecord[];
}

// ---------------------------------------------------------------------------
// Controlled tool vocabulary (spec §5, §35)
// ---------------------------------------------------------------------------

export type ControlledToolName =
  | 'search_web'
  | 'scrape_page'
  | 'discover_internal_links'
  | 'inspect_company'
  | 'record_evidence'
  | 'validate_evidence'
  | 'get_research_state'
  | 'request_engineering_escalation'
  | 'finalize_research';

export interface ControlledResearchAction {
  action: ControlledToolName;
  reason: string;
  arguments: Record<string, any>;
}

const ALLOWED_ACTIONS: ReadonlySet<ControlledToolName> = new Set<ControlledToolName>([
  'search_web',
  'scrape_page',
  'discover_internal_links',
  'inspect_company',
  'record_evidence',
  'validate_evidence',
  'get_research_state',
  'request_engineering_escalation',
  'finalize_research',
]);

const TARGET_TYPES = new Set([
  'website',
  'contact_page',
  'leadership',
  'social_profiles',
  'registry',
  'directory',
  'email',
  'company',
]);

function isPlainObject(v: any): v is Record<string, any> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Rejects unsafe model actions. The runtime decides what the model is allowed
 * to execute; the model can never override these restrictions.
 */
export class ControlledToolRegistry {
  static describe(): string {
    return Array.from(ALLOWED_ACTIONS).join(', ');
  }

  /**
   * Validates a strict-JSON model proposal. Returns a normalized action or a
   * rejection reason. No tool name outside ALLOWED_ACTIONS is ever accepted.
   */
  static validate(raw: any): { ok: boolean; action?: ControlledResearchAction; error?: string } {
    if (!isPlainObject(raw)) {
      return { ok: false, error: 'Proposal is not a JSON object' };
    }
    const actionName = raw.action;
    if (typeof actionName !== 'string' || !ALLOWED_ACTIONS.has(actionName as ControlledToolName)) {
      return { ok: false, error: `Disallowed/unknown tool action: ${String(actionName)}` };
    }
    if (typeof raw.reason !== 'string' || !raw.reason || raw.reason.length > 400) {
      return { ok: false, error: 'Tool action requires a short textual reason' };
    }
    if (!isPlainObject(raw.arguments)) {
      return { ok: false, error: 'Tool action arguments must be a JSON object' };
    }
    const action = actionName as ControlledToolName;
    const args = raw.arguments;

    if (action === 'search_web') {
      if (typeof args.query !== 'string' || !args.query.trim() || args.query.trim().length > 240) {
        return { ok: false, error: 'search_web requires a bounded query string' };
      }
      if (args.target_type && typeof args.target_type === 'string' && !TARGET_TYPES.has(args.target_type)) {
        return { ok: false, error: `search_web target_type is outside the allowed set: ${args.target_type}` };
      }
    } else if (action === 'scrape_page' || action === 'discover_internal_links') {
      if (typeof args.url !== 'string' || !isSafeExternalUrl(args.url)) {
        return { ok: false, error: `${action} requires a safe external http(s) URL` };
      }
    } else if (action === 'request_engineering_escalation') {
      const url = args.url ? String(args.url) : '';
      if (url && !isSafeExternalUrl(url)) {
        return { ok: false, error: 'request_engineering_escalation URL failed SSRF safety validation' };
      }
    } else if (action === 'record_evidence') {
      if (typeof args.field !== 'string' || !args.field.trim()) return { ok: false, error: 'record_evidence requires a field' };
      if (typeof args.value !== 'string' || !args.value.trim() || args.value.trim().length > 400) {
        return { ok: false, error: 'record_evidence requires a bounded value string' };
      }
      if (args.source_url && !isSafeExternalUrl(String(args.source_url))) {
        return { ok: false, error: 'record_evidence source_url failed SSRF safety validation' };
      }
    } else if (action === 'validate_evidence') {
      if (typeof args.value !== 'string' || !args.value.trim() || args.value.trim().length > 400) {
        return { ok: false, error: 'validate_evidence requires a bounded value string' };
      }
    }

    return { ok: true, action: { action, reason: raw.reason, arguments: args } };
  }

  /** Deterministic value validation for the validate_evidence tool. */
  static validateValue(value: string, kind: string): { valid: boolean; message: string } {
    const v = String(value || '').trim();
    const k = String(kind || '').toLowerCase();
    if (k === 'email') {
      return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)
        ? { valid: true, message: 'valid email' }
        : { valid: false, message: 'invalid email' };
    }
    if (k === 'phone') {
      const digits = v.replace(/\D/g, '');
      return digits.length >= 6 && new Set(digits).size > 1
        ? { valid: true, message: 'valid phone' }
        : { valid: false, message: 'invalid phone' };
    }
    if (k === 'url') {
      return isSafeExternalUrl(v) ? { valid: true, message: 'valid safe URL' } : { valid: false, message: 'invalid/unsafe URL' };
    }
    if (k === 'country') {
      return detectCountryMentions(v).length > 0
        ? { valid: true, message: 'recognized country reference' }
        : { valid: false, message: 'no recognized country reference' };
    }
    if (k === 'person') {
      return isValidCorporateContactPerson({ name: v })
        ? { valid: true, message: 'valid person name' }
        : { valid: false, message: 'rejected person name' };
    }
    return { valid: false, message: `unknown validation kind: ${kind}` };
  }
}

// ---------------------------------------------------------------------------
// Knowledge-gap reasoning (spec §8, §4)
// ---------------------------------------------------------------------------

export interface KnowledgeGapProposal {
  coverage: number;
  confidence: number;
  missing_information: string[];
  queryTasks: { targetType: string; query: string; providerId?: string; reason: string }[];
  directScrapes: string[];
  advisoryNotes: string[];
  finalizeRequested: boolean;
}

export function normalizeModelResearchQuery(query: string, targetType: string, country: string, website?: string): string {
  let normalized = String(query || '').trim();
  const lower = normalized.toLowerCase();
  if ((targetType === 'email' || targetType === 'contact_page') && !/(contact|official website)/.test(lower)) {
    normalized += ' official website contact';
  }
  if (targetType === 'email' || targetType === 'contact_page') {
    try {
      const host = new URL(website || '').hostname.toLowerCase().replace(/^www\./, '');
      if (host && !normalized.toLowerCase().includes(`site:${host}`)) normalized += ` site:${host}`;
    } catch (_) {}
  }
  if (targetType === 'leadership' && !/(leadership|management|director|ceo|executive)/.test(lower)) {
    normalized += ' leadership management directors';
  }
  if (country && !normalized.toLowerCase().includes(country.toLowerCase())) normalized += ` ${country}`;
  return normalized.trim().slice(0, 240);
}

export function normalizePublicResearchQuery(
  query: string,
  targetType: string,
  companyName: string,
  country: string,
  website?: string
): string {
  return assertPublicResearchQuery(
    normalizeModelResearchQuery(query, targetType, country, website),
    { companyName, country }
  );
}

export class KnowledgeGapPlanner {
  /**
   * Asks the primary reasoning provider (NIM, Groq fallback) what should be
   * investigated next. Only trusted DB-derived context is sent (never raw
   * scraped corpus) to avoid prompt-injection and to keep the prompt bounded.
   * Returns null when the model is unavailable or its output fails validation,
   * so the caller can fall back to the deterministic planner.
   */
  static async proposeNext(
    state: ResearchState,
    settings: AppSettings
  ): Promise<KnowledgeGapProposal | null> {
    const allowedTools = ControlledToolRegistry.describe();

    const prompt = `You are the research coordinator inside EdgeView, a controlled autonomous research runtime.
Target company: "${state.company}"
Target country branch: "${state.target_country || 'global'}"
Research objective: "${state.objective}"

Known information (verified): ${JSON.stringify(state.known_information)}
Missing information: ${JSON.stringify(state.missing_information)}
Evidence collected so far: ${state.evidence.length} source(s); ${state.pages_scraped.length} page(s) scraped.
Queries attempted: ${JSON.stringify(state.queries_attempted)}
Iteration: ${state.iteration}; coverage so far: ${state.coverage}

You decide what information still needs to be investigated. Use ONLY these controlled tools, which EdgeView will safely execute for you:
${allowedTools}

For search_web, "arguments" must contain { "query": "...", "target_type": "website" | "contact_page" | "leadership" | "social_profiles" | "registry" | "directory" | "email" | "company" }.
For scrape_page and discover_internal_links, "arguments" must contain { "url": "http(s) URL" }.
Do not generate shell commands, file paths, SQL, credentials, or source code. Never invent facts, people, or URLs.
If the evidence already appears sufficient for the company/branch profile, propose finalize_research.

Respond with STRICT JSON ONLY, matching exactly:
{
  "coverage": number from 0 to 1,
  "confidence": number from 0 to 1,
  "missing_information": ["..."],
  "proposed_actions": [
    { "action": "search_web", "reason": "short reason", "arguments": { "query": "...", "target_type": "leadership" } }
  ]
}
No markdown code fences, no text outside the JSON.`;

    let raw = '';
    state.provider_failure_memory = state.provider_failure_memory || [];
    const primary = String(settings.primary_ai_provider || 'NVIDIA').toLowerCase();
    const contextFingerprint = failureContextFingerprint({ action: 'knowledge_gap_planner', evidence: state.evidence.length, pages: state.pages_scraped.length, known: state.known_information, missing: state.missing_information });
    if (shouldSuppressEquivalentFailure(state.provider_failure_memory, primary, 'knowledge_gap_planner', contextFingerprint)) {
      state.failed_actions.push({ action: 'knowledge_gap_planner_suppressed', reason: `Equivalent ${primary} failure already recorded for unchanged evidence context`, at: new Date().toISOString() });
      return null;
    }
    try {
      raw = await callAi(prompt, settings);
    } catch (err: any) {
      rememberProviderFailure(state.provider_failure_memory, primary, 'knowledge_gap_planner', contextFingerprint, err);
      console.warn(`[ResearchRuntime] Knowledge-gap planner provider failed: ${err.message}`);
      return null;
    }

    let parsed: any;
    try {
      parsed = safeJsonParse(extractJsonBlock(raw), null);
    } catch (_) {
      parsed = null;
    }

    if (!isPlainObject(parsed) || !Array.isArray(parsed.proposed_actions)) {
      return null;
    }

    const queryTasks: KnowledgeGapProposal['queryTasks'] = [];
    const directScrapes: string[] = [];
    const advisoryNotes: string[] = [];

    for (const rawAction of parsed.proposed_actions) {
      if (!isPlainObject(rawAction)) continue;
      const validated = ControlledToolRegistry.validate(rawAction);
      if (!validated.ok || !validated.action) {
        advisoryNotes.push(`Rejected model action: ${validated.error}`);
        continue;
      }
      const a = validated.action;
      if (a.action === 'search_web') {
        const targetType = String(a.arguments.target_type || 'company');
        queryTasks.push({
          targetType,
          query: normalizePublicResearchQuery(String(a.arguments.query), targetType, state.company, state.target_country, state.known_information.website),
          providerId: typeof a.arguments.provider_id === 'string' ? a.arguments.provider_id : undefined,
          reason: a.reason,
        });
      } else if (a.action === 'scrape_page' || a.action === 'discover_internal_links') {
        const url = String(a.arguments.url).trim();
        if (isSafeExternalUrl(url) && !directScrapes.includes(url)) directScrapes.push(url);
      } else if (a.action === 'request_engineering_escalation') {
        advisoryNotes.push(`Model requested engineering escalation: ${a.reason}`);
        void EngineeringEscalationWriter.write({
          research_id: state.research_id,
          company: state.company,
          country: state.target_country,
          problem: String(a.arguments.problem || 'Requested by model'),
          expected: String(a.arguments.expected || 'unknown'),
          observed: String(a.arguments.observed || 'unknown'),
          url: a.arguments.url ? String(a.arguments.url) : undefined,
          attempts: [],
          likelyCause: 'Model-requested escalation',
        }, state.research_id).catch(() => {});
      } else if (a.action === 'record_evidence') {
        // Evidence integrity: model-recorded "facts" are NEVER admitted to the
        // extraction corpus (no fabrication, §31). They are kept as observable
        // notes only and surfaced to engineering for manual verification.
        const field = String(a.arguments.field).trim();
        const value = String(a.arguments.value).trim();
        state.modelNotes.push(`${field}: ${value} (source: ${a.arguments.source_url ? String(a.arguments.source_url) : 'unspecified'})`);
        advisoryNotes.push(`record_evidence noted (not admitted): ${field}`);
        writeTrace(state, 'evidence_added', { source: 'model_record_evidence', field, admitted: false });
      } else if (a.action === 'validate_evidence') {
        const res = ControlledToolRegistry.validateValue(String(a.arguments.value), String(a.arguments.kind || ''));
        advisoryNotes.push(`validate_evidence: ${res.message}`);
      } else if (a.action === 'get_research_state') {
        // no-op: research state is runtime-internal and never exposed to the model
      }
    }

    const finalizeRequested = (parsed.proposed_actions as any[]).some(
      (pa) => isPlainObject(pa) && pa.action === 'finalize_research'
    );

    const coverage = Math.max(0, Math.min(1, Number(parsed.coverage) || 0));
    const confidence = Math.max(0, Math.min(1, Number(parsed.confidence) || 0));

    return {
      coverage,
      confidence,
      missing_information: Array.isArray(parsed.missing_information)
        ? parsed.missing_information.filter((m: any) => typeof m === 'string').slice(0, 20)
        : state.missing_information,
      queryTasks: queryTasks.slice(0, 4),
      directScrapes: directScrapes.slice(0, 4),
      advisoryNotes,
      finalizeRequested,
    };
  }
}

// ---------------------------------------------------------------------------
// Engineering escalation to .agent/incidents/ (spec §19, §20)
// ---------------------------------------------------------------------------

export interface EngineeringEscalation {
  research_id: string;
  company: string;
  country: string;
  problem: string;
  expected: string;
  observed: string;
  url?: string;
  attempts: string[];
  likelyCause: string;
}

export class EngineeringEscalationWriter {
  static async write(esc: EngineeringEscalation, researchId: string): Promise<string> {
    try {
      const incidentsDir = path.join(getProjectRoot(), '.agent', 'incidents');
      if (!fs.existsSync(incidentsDir)) fs.mkdirSync(incidentsDir, { recursive: true });
      const fileName = `EDGEVIEW_ESCALATION_${researchId}_${Date.now()}.md`;
      const filePath = path.join(incidentsDir, fileName);

      const lines = [
        'EDGEVIEW ENGINEERING ESCALATION',
        '',
        `Research ID: ${esc.research_id}`,
        `Company: ${esc.company}`,
        `Country: ${esc.country}`,
        '',
        `Problem: ${esc.problem}`,
        `Expected: ${esc.expected}`,
        `Observed: ${esc.observed}`,
        esc.url ? `URL: ${esc.url}` : 'URL: n/a',
        '',
        'Attempts:',
        ...(esc.attempts.length > 0 ? esc.attempts.map((a) => `1. ${a}`) : ['None recorded']),
        '',
        `Likely cause: ${esc.likelyCause}`,
        '',
        'Requested investigation: OpenCode should inspect the reported extraction/tooling failure independently.',
      ];
      fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');
      writeTrace(
        { research_id: researchId } as any,
        'engineering_escalation',
        { file: fileName, problem: esc.problem, url: esc.url }
      );
      return filePath;
    } catch (err) {
      console.warn('[ResearchRuntime] Failed to write engineering escalation:', err);
      return '';
    }
  }
}

// ---------------------------------------------------------------------------
// Trace writer to .agent/traces/ (spec §32)
// ---------------------------------------------------------------------------

export function writeTrace(state: Partial<ResearchState>, event: string, payload: any = {}): void {
  try {
    const tracesDir = isTestProcess()
      ? path.join(process.env.EDGEVIEW_TEST_DB_DIR || path.join(process.cwd(), '.test-cache'), 'traces')
      : path.join(getProjectRoot(), '.agent', 'traces');
    if (!fs.existsSync(tracesDir)) fs.mkdirSync(tracesDir, { recursive: true });
    const tracePath = path.join(tracesDir, 'research_runtime_trace.jsonl');
    const entry = {
      event,
      research_id: state.research_id || '',
      company: state.company || '',
      country: state.target_country || '',
      iteration: state.iteration || 0,
      timestamp: new Date().toISOString(),
      payload,
    };
    fs.appendFileSync(tracePath, JSON.stringify(entry) + '\n');
  } catch (_) {
    // traces are diagnostic-only; never break the runtime
  }
}

// ---------------------------------------------------------------------------
// Contradiction detection (spec §16)
// ---------------------------------------------------------------------------

const EXECUTIVE_ROLE_PATTERNS: { field: string; regex: RegExp }[] = [
  { field: 'CEO', regex: /(?:chief executive officer|ceo)\s*(?:[:–—-]|\bis\b)\s*([A-Z][a-zA-Z]{2,}(?:\s+[A-Z][a-zA-Z]{2,}){0,3})/i },
  { field: 'Managing Director', regex: /(?:managing director)\s*(?:[:–—-]|\bis\b|&\s*ceo)?\s*([A-Z][a-zA-Z]{2,}(?:\s+[A-Z][a-zA-Z]{2,}){0,3})/i },
];

export function detectContradictions(
  corpus: ResearchEvidenceItem[],
  _companyName: string,
  _country: string
): ResearchContradiction[] {
  const contradictions: ResearchContradiction[] = [];
  if (!Array.isArray(corpus) || corpus.length < 2) return contradictions;

  for (const { field, regex } of EXECUTIVE_ROLE_PATTERNS) {
    const seen = new Map<string, { value: string; url: string }>();
    for (const item of corpus) {
      const lower = item.content.toLowerCase();
      if (!lower.includes('ceo') && !lower.includes('director')) continue;
      const match = item.content.match(regex);
      if (!match || !match[1]) continue;
      const name = match[1].trim().replace(/[.,;]+$/, '');
      if (name.length < 3 || name.length > 60) continue;
      const key = name.toLowerCase();
      if (!seen.has(key)) {
        seen.set(key, { value: name, url: item.url });
      }
    }
    if (seen.size >= 2) {
      const entries = Array.from(seen.values());
      for (let i = 1; i < entries.length; i++) {
        contradictions.push({
          field,
          valueA: entries[0].value,
          sourceA: entries[0].url,
          valueB: entries[i].value,
          sourceB: entries[i].url,
          detectedAt: new Date().toISOString(),
        });
      }
    }
  }
  return contradictions;
}

// ---------------------------------------------------------------------------
// Controlled scrape execution (spec §5 tool: scrape_page)
// ---------------------------------------------------------------------------

/**
 * Safely scrapes a single user- or model-selected page and returns its text.
 * SSRF-guarded; caches into scraped_url_cache. The caller decides whether the
 * returned content is admitted into the evidence corpus (country gate).
 */
export async function scrapeControlledPage(
  url: string,
  _companyName: string,
  country: string | undefined,
  settings: AppSettings,
  forceFresh: boolean = false
): Promise<string> {
  if (!isSafeExternalUrl(url)) return '';

  let content = '';
  const db = await getDb();
  if (!forceFresh) {
    try {
      const cached = await db.get('SELECT content FROM scraped_url_cache WHERE url = ?', [url]);
      if (cached && cached.content) content = cached.content;
    } catch (_) {}
  }

  if (!content && settings.firecrawl_api_key?.trim() && settings.firecrawl_enabled) {
    try {
      content = await ResourceGovernor.executeWithRetry('firecrawl', `Controlled Scrape: ${url}`, async () => {
        const res = await fetch('https://api.firecrawl.dev/v1/scrape', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${assertSafeHeaderValue(settings.firecrawl_api_key.trim(), 'Firecrawl API key')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ url, formats: ['markdown'] }),
        });
        if (res.status === 403) throw new Error('HTTP_403_BLOCKED');
        if (!res.ok) throw new Error(`Firecrawl returned HTTP ${res.status}`);
        const data = await res.json();
        if (data.success && data.data && data.data.markdown) return preservePageContent(data.data.markdown);
        return '';
      }, 1);
    } catch (_) {}
  }

  let directHtml = '';
  if (!content) {
    try {
      const { response: res, text: html } = await safeFetchOutboundText(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      });
      if (res.ok) {
        directHtml = html;
        content = htmlToEvidenceText(directHtml);
      }
    } catch (_) {}
  }

  // Firecrawl/cache text can omit navigation hrefs. Deterministically recover
  // the same-domain link graph with one direct request, without replacing the
  // higher-quality scraped body used for extraction.
  if (content && !directHtml) {
    try {
      const { response: res, text: html } = await safeFetchOutboundText(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36' },
      });
      if (res.ok) directHtml = html;
    } catch (_) {}
  }
  content = mergeScrapedAndDirectEvidence(content, directHtml);

  if (content && content.trim()) {
    await db.run(
      'INSERT INTO scraped_url_cache (url, content) VALUES (?, ?) ON CONFLICT(url) DO UPDATE SET content = excluded.content, cached_at = CURRENT_TIMESTAMP',
      [url, content.trim()]
    );
  }
  return focusEvidenceForTargetCountry(content.trim(), country, url);
}

// ---------------------------------------------------------------------------
// The bounded autonomous runtime loop (spec §22, §24)
// ---------------------------------------------------------------------------

const MAX_STEPS = 14;
export const MAX_COMPANY_RUNTIME_MS = 180_000;
const MAX_MODEL_PLANNING_ATTEMPTS = 2;
const MAX_DIRECT_SCRAPES = 4;
const MAX_OFFICIAL_INTERNAL_PAGES = 4;
const MAX_EVIDENCE_ITEMS = 30;
const MAX_QUERIES = 8;

/**
 * Normalize a query string for deduplication comparison.
 * Removes extra whitespace, normalizes case, removes common stop words.
 */
export function normalizeQueryKey(query: string): string {
  return String(query || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(w => w.length > 2 && !['the', 'and', 'for', 'with', 'from', 'company', 'contact', 'website', 'official', 'kenya', 'somalia', 'sudan', 'kenyan', 'somali', 'sudanese'].includes(w))
    .sort()
    .join(' ');
}

/**
 * Keep the evidence budget bounded without allowing arrival order to evict an
 * earlier authoritative contact or leadership page. The selected items retain
 * their original order so extraction remains deterministic.
 */
export function retainHighValueEvidence(
  items: ResearchEvidenceItem[],
  maxItems: number = MAX_EVIDENCE_ITEMS,
  currentWebsite?: string,
  targetCountry?: string
): ResearchEvidenceItem[] {
  if (!Array.isArray(items) || items.length <= maxItems) return items || [];

  let targetHost = '';
  try { targetHost = new URL(currentWebsite || '').hostname.toLowerCase().replace(/^www\./, ''); } catch (_) {}
  const country = String(targetCountry || '').trim().toLowerCase();

  const scored = items.map((item, index) => {
    const url = String(item?.url || '');
    const raw = String(item?.content || '');
    const representative = raw.length <= 12000 ? raw : `${raw.slice(0, 4000)} ${raw.slice(Math.max(0, raw.length - 8000))}`;
    const haystack = `${url} ${item?.title || ''} ${representative}`.toLowerCase();
    let host = '';
    try { host = new URL(url).hostname.toLowerCase().replace(/^www\./, ''); } catch (_) {}

    let score = 0;
    if (targetHost && (host === targetHost || host.endsWith(`.${targetHost}`))) score += 40;
    if (/(leadership|management|executive|directors?|board|key-people|our-team)/.test(haystack)) score += 32;
    if (/(contact-us|contactus|get-in-touch|\/contact\b|contact information)/.test(haystack)) score += 30;
    if (/(branches?|locations?|offices?|country manager|branch manager)/.test(haystack)) score += 20;
    if (/(procurement|supply chain|business development|commercial|import|export|sales)/.test(haystack)) score += 12;
    if (/(about-us|who-we-are|company-profile|\/about\b)/.test(haystack)) score += 10;
    if (country && haystack.includes(country)) score += 12;
    if (/@|\b(?:phone|telephone|fax|linkedin)\b/.test(haystack)) score += 6;

    return { item, index, score };
  });

  return scored
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, Math.max(1, maxItems))
    .sort((a, b) => a.index - b.index)
    .map(({ item }) => item);
}

const KNOWN_PROVIDER_IDS = new Set<string>([
  'serper', 'firecrawl', 'nvidia', 'groq', 'gemini', 'hunter', 'tavily', 'exa', 'linkup', 'apify',
]);

// Model-selected queries may omit or fabricate a provider id. The deterministic
// planner's utility scoring resolves any id against the circuit governor, which
// crashes on unknown ids, so sanitize every model-emitted provider id to a
// registered provider (serper is the default search provider).
function sanitizeProviderId(id: unknown): string {
  return typeof id === 'string' && KNOWN_PROVIDER_IDS.has(id) ? id : 'serper';
}

/**
 * Stable Deep Recovery: Field-specific contact recovery actions.
 * Promoted from Entity Proof Search (default OFF) to stable Deep Recovery path.
 * Generates role-specific queries for EXECUTIVE, BUYING, TRADE, OPERATIONS, COMMERCIAL roles.
 */
export function planStableContactRecoveryActions(
  cleanName: string,
  country: string,
  missingFields: string[],
  attemptedQueries: string[],
  zeroGainStreak: number,
  settings: AppSettings,
  companyState: any
): Array<{ query: string; target_type: string; provider_id: string; reason: string; status: string }> {
  const missing = new Set(missingFields);
  const attempted = new Set([
    ...attemptedQueries,
    ...((companyState.plannedQueries || []).map((item: any) => String(item?.query || ''))),
  ].map((q) => q.toLowerCase().replace(/\s+/g, ' ').trim()));
  const base = `"${cleanName}" ${country}`.trim();
  const actions: Array<{ query: string; target_type: string; provider_id: string; reason: string; status: string }> = [];

  const providerAvailable = (p: string) => {
    switch (p) {
      case 'serper': return Boolean(settings.serper_enabled && settings.serper_api_key?.trim());
      case 'tavily': return Boolean(settings.tavily_enabled && settings.tavily_api_key?.trim());
      case 'exa': return Boolean(settings.exa_enabled && settings.exa_api_key?.trim());
      case 'linkup': return Boolean(settings.linkup_enabled && settings.linkup_api_key?.trim());
      case 'hunter': return Boolean(settings.hunter_enabled && settings.hunter_api_key?.trim());
      default: return false;
    }
  };

  const admitted = companyState.extractedDetails || {};
  const hasPhone = Boolean(admitted.phone || admitted.phones_list?.length);
  const hasLeadership = Boolean(admitted.contact_persons?.length || admitted.decision_makers?.length);
  const hasAddress = Boolean(admitted.address || admitted.addresses?.length);
  const hasWebsite = Boolean(admitted.website && (companyState.entityProof?.result === 'OFFICIAL_WEB_IDENTITY_SUPPORTED' || companyState.websiteVerified));

  const candidateProvider = (providers: string[]) => providers.find((p) => providerAvailable(p)) || 'serper';

  const addQuery = (query: string, target_type: string, provider_id: string, reason: string) => {
    const key = query.toLowerCase().replace(/\s+/g, ' ').trim();
    if (!key || key.length < 5) return;
    if (attempted.has(key)) return;
    attempted.add(key);
    actions.push({
      query: query.trim().slice(0, 240),
      target_type,
      provider_id: provider_id,
      reason,
      status: 'pending',
    });
  };

  // EXECUTIVE: CEO, Managing Director, Director, Country Manager
  if (missing.has('contact_persons') || missing.has('leadership') || !hasLeadership) {
    addQuery(
      `${cleanName} CEO "Managing Director" director "Country Manager"`,
      'leadership',
      candidateProvider(['exa', 'tavily', 'serper']),
      'EXECUTIVE: CEO/Managing Director/Country Manager contacts'
    );
    addQuery(
      `${cleanName} ${country} "Country Manager" OR "General Manager" contact`,
      'leadership',
      candidateProvider(['tavily', 'exa']),
      'EXECUTIVE: Country/General Manager for target country'
    );
  }

  // BUYING: Procurement, Purchasing, Sourcing
  if (missing.has('email') || missing.has('phone')) {
    addQuery(
      `${cleanName} ${country} procurement purchasing sourcing manager contact email phone`,
      'contact_page',
      candidateProvider(['serper', 'tavily']),
      'BUYING: Procurement/Purchasing/Sourcing contacts'
    );
    addQuery(
      `${cleanName} "Head of Procurement" OR "Procurement Manager" ${country} email`,
      'leadership',
      candidateProvider(['exa', 'tavily']),
      'BUYING: Procurement leadership contacts'
    );
  }

  // TRADE: Import, Export, Distribution
  if (missing.has('email') || missing.has('phone') || missing.has('address')) {
    addQuery(
      `${cleanName} ${country} import export distribution manager contact`,
      'contact_page',
      candidateProvider(['serper', 'tavily']),
      'TRADE: Import/Export/Distribution contacts'
    );
    addQuery(
      `${cleanName} "Import Manager" OR "Export Manager" ${country} email`,
      'leadership',
      candidateProvider(['exa', 'tavily']),
      'TRADE: Import/Export management contacts'
    );
  }

  // OPERATIONS: Supply Chain, Logistics
  if (missing.has('address') || missing.has('phone')) {
    addQuery(
      `${cleanName} ${country} "Supply Chain" OR "Logistics" manager contact`,
      'contact_page',
      candidateProvider(['serper', 'tavily']),
      'OPERATIONS: Supply Chain/Logistics contacts'
    );
  }

  // COMMERCIAL: Sales, Commercial, Business Development
  if (missing.has('email') || missing.has('phone')) {
    addQuery(
      `${cleanName} ${country} "Business Development" OR "Sales Manager" contact`,
      'leadership',
      candidateProvider(['exa', 'tavily']),
      'COMMERCIAL: Business Development/Sales contacts'
    );
    addQuery(
      `${cleanName} ${country} "Commercial Director" OR "Sales Director" contact`,
      'leadership',
      candidateProvider(['exa', 'tavily']),
      'COMMERCIAL: Commercial/Sales leadership contacts'
    );
  }

  // ADDRESS: Government, Registry, Chamber
  if (missing.has('address')) {
    addQuery(
      `${cleanName} ${country} registered office address registry chamber`,
      'registry',
      candidateProvider(['serper', 'tavily']),
      'ADDRESS: Registered office/branch via registry/chamber'
    );
  }

  // EMAIL: Pattern intelligence (Hunter only if domain verified)
  // Note: Hunter queries are added elsewhere when domain is verified

  // Filter by provider availability and deduplicate
  const availableActions = actions.filter((a) => providerAvailable(a.provider_id));
  const seen = new Set<string>();
  return availableActions.filter((a) => {
    const key = a.query.toLowerCase().trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 4); // Max 4 new queries per escalation
}

export function planAuthoritativeDocumentActions(
  cleanName: string,
  country: string,
  missingFields: string[],
  attemptedQueries: string[],
  settings: AppSettings,
  companyState: any,
): Array<{ query: string; target_type: string; provider_id: string; reason: string; status: string }> {
  const missing = new Set(missingFields);
  const known = new Set([
    ...attemptedQueries,
    ...((companyState.plannedQueries || []).map((item: any) => String(item?.query || ''))),
  ].map((query) => query.toLowerCase().replace(/\s+/g, ' ').trim()));
  const available = (provider: string) => provider === 'serper'
    ? Boolean(settings.serper_enabled && settings.serper_api_key?.trim())
    : provider === 'tavily' ? Boolean(settings.tavily_enabled && settings.tavily_api_key?.trim()) : false;
  const provider = available('serper') ? 'serper' : available('tavily') ? 'tavily' : '';
  if (!provider) return [];
  const alreadyQueued = (companyState.plannedQueries || []).filter((item: any) =>
    item?.authoritative_document === true || String(item?.reason || '').startsWith('AUTHORITATIVE_DOCUMENT:'),
  ).length;
  const remainingBudget = Math.max(0, 2 - alreadyQueued);
  if (remainingBudget === 0) return [];

  const base = `"${cleanName}" ${country}`.trim();
  const candidates = [
    {
      query: `${base} regulator licensed importer distributor contact filetype:pdf`,
      target_type: 'registry',
      reason: 'AUTHORITATIVE_DOCUMENT: regulator or licensing record with attributable branch contacts',
      relevant: missing.has('email') || missing.has('phone') || missing.has('address'),
    },
    {
      query: `${base} business registry chamber registered office directors filetype:pdf`,
      target_type: 'registry',
      reason: 'AUTHORITATIVE_DOCUMENT: registry/chamber record for legal address and directors',
      relevant: missing.has('address') || missing.has('leadership') || missing.has('contact_persons'),
    },
    {
      query: `${base} government tender prequalification supplier contact filetype:pdf`,
      target_type: 'directory',
      reason: 'AUTHORITATIVE_DOCUMENT: government supplier/tender document for public contact details',
      relevant: true,
    },
  ];

  const actions: Array<{ query: string; target_type: string; provider_id: string; reason: string; status: string }> = [];
  for (const candidate of candidates) {
    const key = candidate.query.toLowerCase().replace(/\s+/g, ' ').trim();
    if (!candidate.relevant || known.has(key)) continue;
    known.add(key);
    actions.push({ ...candidate, provider_id: provider, status: 'pending' });
    if (actions.length >= remainingBudget) break;
  }
  return actions;
}

export class AutonomousResearchRuntime {
  /**
   * Runs a bounded, model-driven research loop. Returns the final enriched
   * profile (as persisted via the existing cache), mirroring the tail contract
   * of enrichCompanyDetailsInternal so the caller's fallback behavior is
   * unchanged. Never throws; every failure degrades to the deterministic path
   * or an engineering escalation.
   */
  static async run(
    companyName: string,
    extraContext?: EntityResearchContext,
    appSettings?: AppSettings,
    forceFetch: boolean = false
  ): Promise<any> {
    const testRunner = (globalThis as any).__edgeviewTestResearchRunner;
    if (isTestProcess() && typeof testRunner === 'function') {
      return testRunner(companyName, extraContext, appSettings, forceFetch);
    }
    const settings = appSettings ?? getAppSettings();
    const providerMetricsBefore = ResourceGovernor.getAllProviderMetrics();
    const cleanName = (companyName || '').trim();
    const country = extraContext?.country || '';

    const researchId = `r-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const deadlineAt = Date.now() + MAX_COMPANY_RUNTIME_MS;
    const state: ResearchState = {
      research_id: researchId,
      company: cleanName,
      target_country: country,
      target_city: extraContext?.target_city || '',
      source_file_id: extraContext?.source_file_id || '',
      objective: `Enrich ${cleanName}${country ? ` — ${country} branch` : ''} with verified contact, branch, and decision-maker information`,
      known_information: {
        website: extraContext?.website || '',
        country,
        role: extraContext?.role || '',
        address: extraContext?.known_address || '',
        products: extraContext?.known_products || [],
        traded_with: extraContext?.traded_with || [],
        existing_contacts: extraContext?.existing_contacts || {},
        dataset_id: extraContext?.dataset_id || '',
      },
      missing_information: [],
      hypotheses: [],
      queries_attempted: [],
      pages_scraped: [],
      evidence: [],
      modelNotes: [],
      contradictions: [],
      failed_actions: [],
      actions_taken: [],
      current_plan: {},
      coverage: 0,
      confidence: 0,
      iteration: 0,
      status: 'researching',
      lastInfoGain: 0,
      zeroGainStreak: 0,
      modelPlanningAttempts: 0,
      directScrapeTargets: [],
      startedAt: new Date().toISOString(),
    };

    if (shouldUseEntityProofSearch(extraContext || {})) {
      state.entity_proof = createEntityProofState(cleanName, extraContext || {});
      writeTrace(state, 'entity_proof_started', {
        entity_key: state.entity_proof.fingerprint.entity_key,
        budget: state.entity_proof.budget,
      });
    }

    writeTrace(state, 'research_started', { objective: state.objective });
    await ResearchLedger.start({
      research_id: researchId,
      company: cleanName,
      country,
      objective: state.objective,
      started_at: state.startedAt,
    });

    const companyState: any = {
      id: `single-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: cleanName,
      status: 'pending',
      stage: 'Planning research...',
      resourceUsage: { serper: 0, firecrawl: 0, nvidia: 0, groq: 0 },
    };
    companyState.forceFresh = forceFetch;

    // Cache-aware pre-check (mirrors the caller's partial-cache flow).
    // In forceFresh / cold recovery mode, state.known_information starts completely clean.
    try {
      if (!forceFetch) {
        const cached = await getCachedCompany(cleanName, country, extraContext?.role);
        if (cached) {
          const missing = getMissingFields(cached);
          state.known_information = {
            ...state.known_information,
            website: cached.website || '',
            email: cached.email || '',
            phone: cached.phone || '',
            address: cached.address || '',
          };
          state.missing_information = missing;
           if (!extraContext?.deep_recovery && (missing.length === 0 || cached.quality_status === 'COMPLETE')) {
            state.status = 'completed';
            state.completedAt = new Date().toISOString();
             writeTrace(state, 'research_completed', { source: 'cache', quality_status: cached.quality_status });
             await ResearchLedger.complete({ research_id: researchId, status: 'COMPLETED', iterations: 0, evidence_count: 0, pages_retrieved: 0, summary: { source: 'cache', quality_status: cached.quality_status } });
             return cached;
          }
        }
      }
    } catch (_) {}

    let step = 0;
    while (companyState.status !== 'completed' && companyState.status !== 'failed' && step < MAX_STEPS) {
      if (Date.now() >= deadlineAt) {
        state.failed_actions.push({
          action: 'research_deadline',
          reason: `Company research exceeded ${MAX_COMPANY_RUNTIME_MS}ms wall-clock budget`,
          at: new Date().toISOString(),
        });
        writeTrace(state, 'research_deadline_reached', { elapsed_ms: MAX_COMPANY_RUNTIME_MS, step });
        break;
      }
      step++;
      state.iteration = step;

      // Process pending model-selected direct scrapes first (bounded).
      if (state.directScrapeTargets.length > 0) {
        const url = state.directScrapeTargets.shift()!;
        companyState.stage = 'Inspecting company pages...';
        writeTrace(state, 'page_selected', { url, source: 'model' });
        try {
          const content = await scrapeControlledPage(url, cleanName, country || undefined, settings, Boolean((companyState as any).forceFresh));
          if (content && content.trim()) {
            const candidateWebsite = String(extraContext?.website || state.known_information.website || '').trim();
            const isUnverifiedCandidate = !companyState.currentWebsite && candidateWebsite === url;
            const assessment = assessEvidenceForCountry(
              content.trim(),
              url,
              cleanName,
              country || undefined,
              companyState.currentWebsite || undefined,
              { sourceType: isUnverifiedCandidate ? 'candidate_official' : 'web' }
            );
            const candidateCanBeOfficial = !isUnverifiedCandidate || isPlausibleOfficialCompanyUrl(url, cleanName);
            if (assessment.admissible) {
              const scoped = buildEntityScopedEvidence(content.trim(), url, cleanName, country, /(?:directory|registry|chamber|members)/i.test(url));
              const item: ResearchEvidenceItem = {
                url,
                title: url,
                content: scoped.mixed_entity_page ? (scoped.extraction_content || '[EdgeView: no target-local fact neighborhood established.]') : content.trim(),
                blocks: scoped.blocks,
                mixed_entity_page: scoped.mixed_entity_page,
              };
              state.evidence.push(item);
              if (Array.isArray(companyState.evidenceCorpus)) {
                companyState.evidenceCorpus.push(item);
              } else {
                companyState.evidenceCorpus = [item];
              }
              if (Array.isArray(companyState.seenUrls)) companyState.seenUrls.push(url);
              if (!state.pages_scraped.includes(url)) state.pages_scraped.push(url);
              if (!companyState.currentWebsite && candidateCanBeOfficial && isPlausibleOfficialCompanyUrl(url, cleanName)) {
                try {
                  const parsedUrl = new URL(url);
                  companyState.currentWebsite = `${parsedUrl.protocol}//${parsedUrl.hostname}`;
                  // Queue the official homepage for internal link discovery
                  const officialAnchor = companyState.currentWebsite;
                  if (officialAnchor && isSafeExternalUrl(officialAnchor) && !state.pages_scraped.includes(officialAnchor) && !state.directScrapeTargets.includes(officialAnchor) && state.directScrapeTargets.length < MAX_DIRECT_SCRAPES) {
                    state.directScrapeTargets.unshift(officialAnchor);
                    writeTrace(state, 'page_selected', { url: officialAnchor, source: 'known_official_anchor' });
                  }
                } catch (_) {}
              }
              writeTrace(state, 'page_scraped', { url, chars: content.trim().length });
              writeTrace(state, 'evidence_added', { url, source: 'controlled_scrape', admitted: true });

              // A model-selected `discover_internal_links` action used to be
              // executed as a plain scrape. Follow a globally bounded, diverse
              // set of same-domain links so official contact/leadership pages
              // actually enter the evidence corpus.
              const alreadyFollowed = Number((companyState as any).internalDiscoveryCount || 0);
              const remaining = candidateCanBeOfficial
                ? Math.max(0, MAX_OFFICIAL_INTERNAL_PAGES - alreadyFollowed)
                : 0;
              const seen = new Set<string>([
                ...(state.pages_scraped || []),
                ...((companyState.seenUrls || []) as string[]),
              ]);
              const internalTargets = selectHighValueInternalLinks(
                discoverInternalLinks(content, url, cleanName, country || undefined)
                  .filter((link) => !seen.has(link.url)),
                remaining
              );

              for (const internal of internalTargets) {
                (companyState as any).internalDiscoveryCount = Number((companyState as any).internalDiscoveryCount || 0) + 1;
                if (!Array.isArray(companyState.seenUrls)) companyState.seenUrls = [];
                companyState.seenUrls.push(internal.url);
                writeTrace(state, 'page_selected', { url: internal.url, source: 'official_internal', label: internal.label });
                try {
                  const internalContent = await scrapeControlledPage(
                    internal.url,
                    cleanName,
                    country || undefined,
                    settings,
                    Boolean((companyState as any).forceFresh)
                  );
                  if (!internalContent.trim()) continue;
                  const internalAssessment = assessEvidenceForCountry(
                    internalContent,
                    internal.url,
                    cleanName,
                    country || undefined,
                    companyState.currentWebsite || undefined
                  );
                  if (!internalAssessment.admissible) {
                    writeTrace(state, 'evidence_added', { url: internal.url, source: 'official_internal', admitted: false, reason: 'country/association gate' });
                    continue;
                  }
                  const internalItem: ResearchEvidenceItem = {
                    url: internal.url,
                    title: `${internal.label} - ${cleanName}`,
                    content: internalContent,
                  };
                  state.evidence.push(internalItem);
                  companyState.evidenceCorpus.push(internalItem);
                  if (!state.pages_scraped.includes(internal.url)) state.pages_scraped.push(internal.url);
                  writeTrace(state, 'page_scraped', { url: internal.url, chars: internalContent.length, source: 'official_internal' });
                  writeTrace(state, 'evidence_added', { url: internal.url, source: 'official_internal', admitted: true });
                } catch (internalError: any) {
                  state.failed_actions.push({ action: 'discover_internal_links', reason: internalError.message, url: internal.url, at: new Date().toISOString() });
                  writeTrace(state, 'tool_failed', { action: 'discover_internal_links', url: internal.url, error: internalError.message });
                }
              }
              if (isUnverifiedCandidate && !candidateCanBeOfficial) companyState.invalidateExistingIdentity = true;
            } else {
              if (isUnverifiedCandidate) companyState.invalidateExistingIdentity = true;
              writeTrace(state, 'evidence_added', { url, source: 'controlled_scrape', admitted: false, decision: assessment.decision, reason: assessment.reasons.slice(-1)[0] });
            }
          }
        } catch (err: any) {
          state.failed_actions.push({ action: 'scrape_page', reason: err.message, url, at: new Date().toISOString() });
          writeTrace(state, 'tool_failed', { action: 'scrape_page', url, error: err.message });
        }
        continue;
      }

      const action = await this.proposeNextAction(state, companyState, settings, extraContext);
      state.actions_taken.push(action.type);

      const actionStartedAt = Date.now();
      const evidenceBefore = (companyState.evidenceCorpus || []).length;
      const plannedAction = (companyState.plannedQueries || []).find((item: any) => item?.query === action.queryToRun);
      try {
        const seenBefore = (companyState.seenUrls || []).length;

        await ResearchDirector.executeAction('single-job', companyState, action, settings, extraContext);

        if (action.type === 'INITIALIZE') {
          const officialAnchor = String(companyState.currentWebsite || extraContext?.website || state.known_information.website || '').trim();
          if (
            officialAnchor &&
            isSafeExternalUrl(officialAnchor) &&
            !state.pages_scraped.includes(officialAnchor) &&
            !state.directScrapeTargets.includes(officialAnchor) &&
            state.directScrapeTargets.length < MAX_DIRECT_SCRAPES
          ) {
            state.directScrapeTargets.unshift(officialAnchor);
            writeTrace(state, 'page_selected', { url: officialAnchor, source: 'known_official_anchor' });
          }
        }

        if (action.type === 'EXECUTE_QUERY') {
          const gained = (companyState.evidenceCorpus || []).length - evidenceBefore;
          state.lastInfoGain = gained;
          const targetType = action.queryTargetType || '';
          const query = action.queryToRun || '';
          if (query) state.queries_attempted.push(query);
          const newSeen = (companyState.seenUrls || []).slice(seenBefore);
          for (const u of newSeen) {
            if (!state.pages_scraped.includes(u)) state.pages_scraped.push(u);
          }
          // Mirror admitted evidence into the runtime state for observability.
          const evidenceAfter = companyState.evidenceCorpus || [];
          if (evidenceAfter.length > state.evidence.length) {
            state.evidence = evidenceAfter.slice();
          }
          writeTrace(state, 'query_executed', { query, target_type: targetType, new_evidence: gained });

          if (gained > 0) {
            state.zeroGainStreak = 0;
            writeTrace(state, 'evidence_added', { source: 'search', target_type: targetType, count: gained });
            const contradictions = detectContradictions(state.evidence, cleanName, country);
            for (const c of contradictions) {
              if (!state.contradictions.some((x) => x.field === c.field && x.valueA === c.valueA && x.valueB === c.valueB)) {
                state.contradictions.push(c);
                writeTrace(state, 'contradiction_detected', { field: c.field, valueA: c.valueA, valueB: c.valueB });
              }
            }
          } else {
            state.zeroGainStreak++;
            (state as any).zeroGainActions = Number((state as any).zeroGainActions || 0) + 1;
            // Information-gain guard: skip only semantically equivalent pending
            // queries rather than all same target_type queries. Compare normalized query text.
            if (targetType && (companyState.evidenceCorpus || []).length > 0) {
              const currentQueryKey = normalizeQueryKey(action.queryToRun || '');
              const skipped: string[] = [];
              (companyState.plannedQueries || []).forEach((q: any) => {
                if (q && q.status === 'pending' && q.target_type === targetType) {
                  const qKey = normalizeQueryKey(q.query || '');
                  // Only skip if query is semantically equivalent (same normalized key)
                  if (qKey === currentQueryKey) {
                    q.status = 'skipped';
                    skipped.push(q.query);
                  }
                }
              });
              if (skipped.length > 0) {
                writeTrace(state, 'strategy_changed', {
                  reason: `Zero information gain for query="${action.queryToRun}", target_type=${targetType}`,
                  skipped_queries: skipped.length,
                });
              }
            }
          }
        } else if (action.type === 'EXTRACT_INFORMATION') {
          companyState.stage = 'Validating contacts...';
          writeTrace(state, 'strategy_changed', { reason: 'Transitioning to evidence synthesis' });
        } else if (action.type === 'INITIALIZE') {
          companyState.stage = 'Planning research...';
        } else if (action.type === 'PLAN_SEARCH') {
          companyState.stage = 'Planning research...';
        }
        const executedProvider = action.type === 'EXECUTE_QUERY'
          ? [...(companyState.providerTelemetry || [])].reverse().find((row: any) => row.query === action.queryToRun)?.provider
          : undefined;
        await ResearchLedger.action({
          research_id: researchId,
          iteration: step,
          action_type: action.type,
          target_type: action.queryTargetType,
          provider: executedProvider || plannedAction?.provider_id,
          query: action.queryToRun,
          status: 'SUCCESS',
          information_gain: Math.max(0, (companyState.evidenceCorpus || []).length - evidenceBefore),
          latency_ms: Date.now() - actionStartedAt,
        });
      } catch (err: any) {
        console.warn(`[ResearchRuntime] Action ${action.type} failed: ${err.message}`);
        state.failed_actions.push({ action: action.type, reason: err.message, at: new Date().toISOString() });
        writeTrace(state, 'tool_failed', { action: action.type, error: err.message });
        const failedProvider = action.type === 'EXECUTE_QUERY'
          ? [...(companyState.providerTelemetry || [])].reverse().find((row: any) => row.query === action.queryToRun)?.provider
          : undefined;
        await ResearchLedger.action({
          research_id: researchId,
          iteration: step,
          action_type: action.type,
          target_type: action.queryTargetType,
          provider: failedProvider || plannedAction?.provider_id,
          query: action.queryToRun,
          status: 'FAILED',
          information_gain: Math.max(0, (companyState.evidenceCorpus || []).length - evidenceBefore),
          latency_ms: Date.now() - actionStartedAt,
          error: err,
        });
        companyState.status = 'failed';
        companyState.stage = 'Failed';
        break;
      }

      // Bound the evidence corpus to protect the extraction context.
      if (Array.isArray(companyState.evidenceCorpus) && companyState.evidenceCorpus.length > MAX_EVIDENCE_ITEMS) {
        companyState.evidenceCorpus = retainHighValueEvidence(
          companyState.evidenceCorpus,
          MAX_EVIDENCE_ITEMS,
          companyState.currentWebsite || extraContext?.website,
          country
        );
        state.evidence = companyState.evidenceCorpus.slice();
      }
    }

    if (companyState.status === 'completed') {
      state.status = 'completed';
      state.completedAt = new Date().toISOString();
      companyState.stage = 'Research complete.';
      writeTrace(state, 'research_completed', {
        quality_status: companyState.extractedDetails?.quality_status || 'unknown',
        evidence_sources: (companyState.evidenceCorpus || []).length,
        pages_scraped: state.pages_scraped.length,
        telemetry: (() => {
          const observations = companyState.entityProofObservations || [];
          const decisions = { ADMIT: 0, HOLD: 0, REJECT: 0 } as Record<string, number>;
          observations.forEach((item: any) => { if (item?.admission_decision in decisions) decisions[item.admission_decision]++; });
          const providerRows = companyState.providerTelemetry || [];
          const uniqueDiscovered = new Set(providerRows.flatMap((row: any) => row.urls || [])).size;
          const details = companyState.extractedDetails || {};
          return {
            queries_by_provider: providerRows.reduce((acc: any, row: any) => { acc[row.provider] = (acc[row.provider] || 0) + 1; return acc; }, {}),
            urls_discovered: providerRows.reduce((sum: number, row: any) => sum + Number(row.urls_discovered || 0), 0),
            unique_urls_discovered: uniqueDiscovered || new Set(companyState.seenUrls || []).size,
            urls_deduplicated: Math.max(0, providerRows.reduce((sum: number, row: any) => sum + Number(row.urls_discovered || 0), 0) - new Set(companyState.seenUrls || []).size),
            pages_retrieved: state.pages_scraped.length,
            direct_retrievals: Number(companyState.directRetrievalCount || 0),
            admission: decisions,
            candidates: state.entity_proof?.candidates.map((candidate) => ({ id: candidate.candidate_id, status: candidate.status })) || [],
            facts_admitted: (details.evidence || []).length,
            addresses_found: (details.addresses || []).length,
            emails_found: (details.emails_list || []).length,
            phones_found: (details.phones_list || []).length,
            people_found: (details.decision_makers || []).length,
            zero_gain_actions: Number((state as any).zeroGainActions || 0),
            provider_usage: (() => {
              const after = ResourceGovernor.getAllProviderMetrics();
              return Object.fromEntries(Object.keys(after).map((provider) => {
                const a: any = (after as any)[provider];
                const b: any = (providerMetricsBefore as any)[provider] || {};
                const rows = providerRows.filter((row: any) => row.provider === provider);
                const urls = new Set(rows.flatMap((row: any) => row.urls || []));
                const admitted = observations.filter((item: any) => item.admission_decision === 'ADMIT' && urls.has(item.url)).length;
                return [provider, {
                  requests: Math.max(0, a.requestCount - Number(b.requestCount || 0)),
                  successes: Math.max(0, a.successCount - Number(b.successCount || 0)),
                  failures: Math.max(0, a.failureCount - Number(b.failureCount || 0)),
                  latency_ms: Math.max(0, a.totalLatencyMs - Number(b.totalLatencyMs || 0)),
                  candidate_urls: urls.size,
                  evidence_admitted: admitted,
                }];
              }));
            })(),
          };
        })(),
      });
    } else {
      state.status = 'failed';
      state.completedAt = new Date().toISOString();
      writeTrace(state, 'research_completed', { success: false, status: companyState.status });

      if (state.failed_actions.length > 0) {
        await EngineeringEscalationWriter.write({
          research_id: researchId,
          company: cleanName,
          country,
          problem: `Research for "${cleanName}" ended in a failed state after ${step} bounded iterations.`,
          expected: 'A validated, evidence-grounded company profile.',
          observed: `Final status: ${companyState.status}; failed actions: ${JSON.stringify(state.failed_actions)}`,
          url: state.pages_scraped[0],
          attempts: state.failed_actions.map((f) => `${f.action}: ${f.reason}`),
          likelyCause: 'Provider outage, unsafe output, or an EdgeView extraction/tooling defect.',
        }, researchId).catch(() => {});
      }
    }

    await ResearchLedger.complete({
      research_id: researchId,
      status: state.status === 'completed' ? 'COMPLETED' : 'FAILED',
      iterations: step,
      evidence_count: state.evidence.length,
      pages_retrieved: state.pages_scraped.length,
      summary: {
        failed_actions: state.failed_actions.length,
        zero_gain_actions: Number((state as any).zeroGainActions || 0),
        contradictions: state.contradictions.length,
      },
    });

    // Mirror the tail contract of enrichCompanyDetailsInternal.
    const finalDetails = await getCachedCompany(cleanName, country);
    if (finalDetails) {
      (finalDetails as any).research_id = researchId;
      return finalDetails;
    }

    return {
      company_name: cleanName,
      website: companyState.currentWebsite || '',
      address: '',
      phone: '',
      email: '',
      linkedin: '',
      industry: '',
      country,
      isPartial: true,
      quality_status: 'FAILED',
      source: 'AutonomousResearchRuntime failure',
      research_id: researchId,
    };
  }

  /**
   * Proposes the next research action. Model-driven at two decision points
   * (initial plan and zero-gain replan); deterministic everywhere else.
   * Never throws: any internal planning error degrades to the deterministic
   * proposer, then to FINALIZE, so the bounded loop always progresses.
   */
  private static async proposeNextAction(
    state: ResearchState,
    companyState: any,
    settings: AppSettings,
    extraContext?: EntityResearchContext
  ): Promise<ResearchAction> {
    try {
      return await this.proposeNextActionUnsafe(state, companyState, settings, extraContext);
    } catch (err: any) {
      console.warn(`[ResearchRuntime] proposeNextAction degraded to deterministic fallback: ${err.message}`);
      writeTrace(state, 'tool_failed', { action: 'propose_next_action', error: err.message });
      try {
        return ResearchDirector.proposeNextAction(companyState, extraContext);
      } catch (innerErr: any) {
        return { type: 'FINALIZE', reason: 'Runtime planning failure; finalizing with collected evidence' };
      }
    }
  }

  private static async proposeNextActionUnsafe(
    state: ResearchState,
    companyState: any,
    settings: AppSettings,
    extraContext?: EntityResearchContext
  ): Promise<ResearchAction> {
    if (!Array.isArray(companyState.plannedQueries)) companyState.plannedQueries = [];
    companyState.plannedQueries = companyState.plannedQueries
      .filter((q: any) => q && typeof q === 'object' && typeof q.status === 'string')
      .map((q: any) => ({ ...q, provider_id: sanitizeProviderId(q.provider_id) }));
    const plannedQueryKeys = new Set(
      companyState.plannedQueries.map((item: any) => String(item.query || '').toLowerCase().replace(/\s+/g, ' ').trim()),
    );
    const enqueueUniqueQuery = (item: any): boolean => {
      const key = String(item?.query || '').toLowerCase().replace(/\s+/g, ' ').trim();
      if (!key || plannedQueryKeys.has(key) || companyState.plannedQueries.length >= MAX_QUERIES) return false;
      plannedQueryKeys.add(key);
      companyState.plannedQueries.push(item);
      return true;
    };

    if (companyState.status === 'pending' || !companyState.initialized) {
      return { type: 'INITIALIZE', reason: 'Checking cache and initializing target parameters' };
    }

    if (state.entity_proof) {
      const admittedProofEvidence = (companyState.evidenceCorpus || []).map((item: any) => ({
        url: String(item?.url || ''),
        title: String(item?.title || ''),
        content: String(item?.content || ''),
        source_type: 'admitted_evidence',
        admission_decision: 'ADMIT' as const,
      }));
      const proofEvidence = Array.isArray(companyState.entityProofObservations) && companyState.entityProofObservations.length
        ? companyState.entityProofObservations
        : admittedProofEvidence;
      const updated = updateEntityProofState(state.entity_proof, proofEvidence, state.queries_attempted);
      updated.retrievals_used = Math.min(updated.budget.max_additional_retrievals, state.pages_scraped.length);
      state.entity_proof = updated;
      companyState.entityProof = updated;
      companyState.rejectedDomains = Array.from(new Set([...(companyState.rejectedDomains || []), ...updated.rejected_domains]));

      if (canRunEntityProofAction(updated)) {
        const nextProofAction = updated.actions[0];
        if (nextProofAction) {
          updated.searches_used++;
          updated.discrimination_rounds++;
          updated.action_history.push(nextProofAction);
          if (!Array.isArray(companyState.plannedQueries)) companyState.plannedQueries = [];
          enqueueUniqueQuery({
            query: nextProofAction.query,
            target_type: nextProofAction.target_type,
            reason: nextProofAction.reason,
            provider_id: nextProofAction.provider_id,
            status: 'pending',
            entity_proof: true,
            discrimination_utility: nextProofAction.utility,
          });
          writeTrace(state, 'entity_proof_action', {
            phase: updated.phase,
            query: nextProofAction.query,
            discriminator: nextProofAction.discriminator,
            utility: nextProofAction.utility,
            provider_id: nextProofAction.provider_id,
            candidates: updated.candidates.map((candidate) => ({ id: candidate.candidate_id, status: candidate.status })),
            discrimination_gain: updated.discrimination_gain,
          });
          return {
            type: 'EXECUTE_QUERY',
            queryToRun: nextProofAction.query,
            queryTargetType: nextProofAction.target_type,
            reason: nextProofAction.reason,
          };
        }
      }
      if (isEntitySupportedForContactRecovery(updated.result)
        && updated.contact_searches_used < updated.budget.max_contact_recovery_searches
        && updated.retrievals_used < updated.budget.max_additional_retrievals) {
        const missing = Array.from(new Set([
          ...(state.missing_information || []),
          ...(!companyState.currentWebsite ? ['website'] : []),
          ...(!companyState.hasEmail ? ['email'] : []),
          ...(!companyState.hasPhone ? ['phone', 'fax'] : []),
          ...(!companyState.hasLeadership ? ['contact_persons', 'leadership'] : []),
          'address', 'linkedin',
        ]));
        const availability = {
          serper: Boolean(settings.serper_enabled && settings.serper_api_key?.trim()),
          tavily: Boolean(settings.tavily_enabled && settings.tavily_api_key?.trim()),
          exa: Boolean(settings.exa_enabled && settings.exa_api_key?.trim()),
          linkup: Boolean(settings.linkup_enabled && settings.linkup_api_key?.trim()),
          hunter: Boolean(settings.hunter_enabled && settings.hunter_api_key?.trim()),
        };
        updated.contact_actions = planContactRecoveryActions(updated, missing, state.queries_attempted, state.zeroGainStreak, availability);
        const contactAction = updated.contact_actions[0];
        if (contactAction) {
          updated.phase = 'DEEP_EXTRACTION';
          updated.contact_searches_used++;
          updated.contact_action_history.push(contactAction);
          enqueueUniqueQuery({
            query: contactAction.query,
            target_type: contactAction.target_type,
            reason: contactAction.reason,
            provider_id: contactAction.provider_id,
            status: 'pending',
            entity_proof_contact_recovery: true,
          });
          writeTrace(state, 'contact_recovery_action', {
            field: contactAction.discriminator,
            query: contactAction.query,
            provider_id: contactAction.provider_id,
            utility: contactAction.utility,
            entity_support: updated.result,
          });
          return { type: 'EXECUTE_QUERY', queryToRun: contactAction.query, queryTargetType: contactAction.target_type, reason: contactAction.reason };
        }
      }
writeTrace(state, 'entity_proof_state', {
        phase: updated.phase,
        result: updated.result,
        candidates: updated.candidates.map((candidate) => ({ id: candidate.candidate_id, status: candidate.status })),
        discrimination_gain: updated.discrimination_gain,
        budget_exhausted: !canRunEntityProofAction(updated),
      });
    }

    // ===== HOLD REASSESSMENT AFTER ENTITY-PROOF EVIDENCE =====
    // After entity proof evidence is processed, reassess HOLD candidates with new evidence
    if (companyState.candidatePool && Array.isArray(companyState.candidatePool) && companyState.candidatePool.length > 0) {
      const holdCandidates = companyState.candidatePool.filter((c: any) => c.identitySignals && c.identitySignals.length > 0);
      
      if (holdCandidates.length > 0 && state.entity_proof) {
        // Check if entity proof has found supported candidates for our HOLD hosts
        const supportedHosts = new Set(
          state.entity_proof.candidates
            .filter((c: any) => ['TRADE_ENTITY_SUPPORTED', 'BUSINESS_ENTITY_SUPPORTED', 'LEGAL_ENTITY_SUPPORTED', 'OFFICIAL_WEB_IDENTITY_SUPPORTED'].includes(c.status))
            .map((c: any) => c.domains).flat()
            .map((d: string) => new URL(d).hostname.replace(/^www\./, ''))
        );
        
        // Also check entity proof memory for admitted evidence on HOLD hosts
        const admittedHosts = new Set(
          state.entity_proof.candidate_memory
            .filter((m: any) => m.decision === 'ADMIT')
            .map((m: any) => m.domain)
        );
        
        const reassessed: any[] = [];
        const remainingHold: any[] = [];
        
        for (const candidate of companyState.candidatePool) {
          if (!candidate.identitySignals || candidate.identitySignals.length === 0) continue;
          
          const host = candidate.host;
          const isSupported = supportedHosts.has(host);
          const isAdmittedInMemory = admittedHosts.has(host);
          
          // Re-assess with the new entity proof evidence
          const reassessment = assessEvidenceForCountry(
            candidate.content || candidate.contentPreview || '',
            candidate.url,
            candidate.company,
            candidate.country || extraContext?.country,
            companyState.currentWebsite,
            { 
              sourceType: isSupported || isAdmittedInMemory ? 'candidate_official' : 'web',
              allowHold: true 
            }
          );
          
          // If entity proof supports this host, upgrade to ADMIT
          if (isSupported || isAdmittedInMemory) {
            candidate.reassessmentResult = 'ADMIT';
            candidate.reassessmentReason = isSupported 
              ? `Entity proof supported host ${host} (${state.entity_proof.result})`
              : `Entity proof memory admitted host ${host}`;
            reassessed.push(candidate);
          } 
          // If entity proof explicitly rejected, mark as REJECT
          else if (state.entity_proof.rejected_domains?.includes(host)) {
            candidate.reassessmentResult = 'REJECT';
            candidate.reassessmentReason = `Entity proof rejected host ${host}`;
            // Don't add to remaining
          }
          // Otherwise keep as HOLD for further research
          else {
            remainingHold.push(candidate);
          }
        }
        
        if (reassessed.length > 0) {
          // Promote reassessed candidates to evidence corpus
          for (const candidate of reassessed) {
            if (candidate.reassessmentResult === 'ADMIT') {
              companyState.evidenceCorpus.push({
                url: candidate.url,
                title: candidate.title,
                content: candidate.content,
                source_type: 'entity_proof_validated',
              });
              writeTrace(state, 'hold_promoted_to_admit', {
                host: candidate.host,
                reason: candidate.reassessmentReason,
              });
            }
          }
          
          // Update candidate pool with remaining HOLD candidates
          companyState.candidatePool = remainingHold;
          
          writeTrace(state, 'hold_reassessment_complete', {
            reassessed: reassessed.length,
            remaining: remainingHold.length,
            supportedHosts: Array.from(supportedHosts),
          });
        }
      }
    }

    // Deep Recovery flag

    // Deep Recovery flag - used by both Stable Contact Recovery and DTF/Witness Mining
    const isDeepRecovery = Boolean(extraContext?.deep_recovery || companyState.forceFresh);

    // Stable Deep Recovery: Field-specific contact recovery (promoted from Entity Proof Search)
    // Only run when in deep recovery mode and we have missing contact fields
    const missingFields = Array.from(new Set([
      ...(state.missing_information || []),
      ...(!companyState.currentWebsite ? ['website'] : []),
      ...(!companyState.hasEmail ? ['email'] : []),
      ...(!companyState.hasPhone ? ['phone', 'fax'] : []),
      ...(!companyState.hasLeadership ? ['contact_persons', 'leadership'] : []),
      ...(!companyState.hasAddress ? ['address'] : []),
      ...(!companyState.hasLinkedin ? ['linkedin'] : []),
    ]));

    if (isDeepRecovery && missingFields.length > 0 && companyState.plannedQueries.length < MAX_QUERIES) {
      const authoritativeActions = planAuthoritativeDocumentActions(
        state.company,
        state.target_country || '',
        missingFields,
        state.queries_attempted,
        settings,
        companyState,
      );
      for (const action of authoritativeActions) {
        enqueueUniqueQuery({ ...action, authoritative_document: true });
      }
      if (authoritativeActions.length > 0) {
        writeTrace(state, 'authoritative_document_actions_added', {
          actions: authoritativeActions.map((action) => ({ query: action.query, target_type: action.target_type, provider: action.provider_id })),
        });
      }
    }

    if (isDeepRecovery && missingFields.length > 0 && (companyState.plannedQueries || []).length < MAX_QUERIES) {
      try {
        const stableContactActions = planStableContactRecoveryActions(
          state.company,
          state.target_country || '',
          missingFields,
          state.queries_attempted,
          state.zeroGainStreak,
          settings,
          companyState
        );
        for (const action of stableContactActions) {
          if (companyState.plannedQueries.length >= MAX_QUERIES) break;
           enqueueUniqueQuery({
            query: action.query,
            target_type: action.target_type,
            provider_id: action.provider_id,
            reason: action.reason,
            status: 'pending',
            stable_contact_recovery: true,
          });
        }
        writeTrace(state, 'stable_contact_recovery_added', {
          actions: stableContactActions.map(a => ({ query: a.query, target_type: a.target_type, provider: a.provider_id })),
        });
      } catch (err: any) {
        console.warn(`[ResearchRuntime] Stable contact recovery failed: ${err.message}`);
        writeTrace(state, 'stable_contact_recovery_failed', { error: err.message });
      }
    }

    // DTF V3+ and Relational Witness Mining for Deep Recovery (stable path promotion)
    // Only run when we have trade data and are in deep recovery mode
    const hasTradeData = Boolean(
      extraContext?.traded_with?.length ||
      extraContext?.known_products?.length ||
      Object.keys(extraContext?.trade_feature_recurrence || {}).length > 0 ||
      Object.keys(extraContext?.verified_partner_domains || {}).length > 0
    );

    if (isDeepRecovery && hasTradeData && (companyState.plannedQueries || []).length < MAX_QUERIES) {
      try {
        const fingerprint = buildTradeEntityFingerprint(state.company, extraContext || {});
        const dtfFeatures = scoreDiscriminativeTransactionFeatures(fingerprint);

        // Add bounded joint DTF queries (max 2)
        for (const joint of planJointTransactionQueries(fingerprint, dtfFeatures, 2)) {
          if (companyState.plannedQueries.length >= MAX_QUERIES) break;
           enqueueUniqueQuery({
            query: joint.query,
            target_type: 'company',
            reason: `DTF joint query: ${joint.features.join(' + ')}`,
            provider_id: 'serper',
            status: 'pending',
            dtf_utility: joint.utility,
          });
        }

        // Add bounded relational witness queries (max 2)
        for (const witness of planRelationalWitnessActions(fingerprint, dtfFeatures, 2)) {
          if (companyState.plannedQueries.length >= MAX_QUERIES) break;
           enqueueUniqueQuery({
            query: witness.query,
            target_type: witness.target_type,
            provider_id: witness.provider_id,
            discriminator: witness.discriminator,
            candidate_ids: witness.candidate_ids,
            utility: witness.utility,
            reason: witness.reason,
            status: 'pending',
            is_witness: true,
          });
        }

        writeTrace(state, 'dtf_witness_queries_added', {
          dtf_features: dtfFeatures.map(f => ({ kind: f.kind, value: f.value, utility: f.utility, recurrence: f.recurrence })),
          joint_queries: planJointTransactionQueries(fingerprint, dtfFeatures, 2).map(j => j.query),
          witness_queries: planRelationalWitnessActions(fingerprint, dtfFeatures, 2).map(w => w.query),
        });
      } catch (err: any) {
        console.warn(`[ResearchRuntime] DTF/Witness query generation failed: ${err.message}`);
        writeTrace(state, 'dtf_witness_failed', { error: err.message });
      }
    }

    const noPlan = !companyState.plannedQueries || companyState.plannedQueries.length === 0;
    const hasPending = (companyState.plannedQueries || []).some((q: any) => q.status === 'pending');
    const replan = state.zeroGainStreak >= 2 && hasPending;

    if ((noPlan || replan) && state.modelPlanningAttempts < MAX_MODEL_PLANNING_ATTEMPTS) {
      state.modelPlanningAttempts++;
      const proposal = await KnowledgeGapPlanner.proposeNext(state, settings);
      if (proposal && (proposal.queryTasks.length > 0 || proposal.directScrapes.length > 0)) {
        state.coverage = Math.max(state.coverage, proposal.coverage);
        state.confidence = Math.max(state.confidence, proposal.confidence);
        if (proposal.missing_information.length > 0) state.missing_information = proposal.missing_information;
        state.current_plan = { source: 'model', tasks: proposal.queryTasks };

        if (replan) {
          const pendingKept = (companyState.plannedQueries || []).filter((q: any) => q.status !== 'pending');
          companyState.plannedQueries = pendingKept;
        }
        if (!Array.isArray(companyState.plannedQueries)) companyState.plannedQueries = [];
        for (const t of proposal.queryTasks) {
          if (companyState.plannedQueries.length >= MAX_QUERIES) break;
           enqueueUniqueQuery({
            query: t.query,
            target_type: t.targetType,
            reason: t.reason,
            provider_id: sanitizeProviderId(t.providerId),
            status: 'pending',
          });
        }
        for (const u of proposal.directScrapes) {
          if (state.directScrapeTargets.length >= MAX_DIRECT_SCRAPES) break;
          if (!state.directScrapeTargets.includes(u)) state.directScrapeTargets.push(u);
        }

        writeTrace(state, 'plan_created', {
          source: 'model',
          tasks: proposal.queryTasks.map((t) => t.targetType),
          direct_scrapes: proposal.directScrapes,
        });
        state.zeroGainStreak = 0;

        const first = (companyState.plannedQueries || []).find((q: any) => q.status === 'pending');
        if (first) {
          return {
            type: 'EXECUTE_QUERY',
            queryToRun: first.query,
            queryTargetType: first.target_type,
            reason: first.reason || 'Model-selected targeted query',
          };
        }
        return { type: 'EXECUTE_QUERY', queryToRun: '', queryTargetType: 'company', reason: 'No pending queries remain' };
      }

      // Model output invalid/unavailable -> deterministic fallback below.
      if (noPlan) {
        writeTrace(state, 'provider_fallback', { reason: 'Model planning unavailable; using deterministic planner' });
      }
    }

    // Information-gain stop (§17/§24): when model replan attempts are exhausted
    // and repeated searches yield no new evidence, synthesize what we have.
    if (
      state.modelPlanningAttempts >= MAX_MODEL_PLANNING_ATTEMPTS &&
      state.zeroGainStreak >= 2 &&
      (companyState.evidenceCorpus || []).length > 0 &&
      (companyState.plannedQueries || []).some((q: any) => q.status === 'pending')
    ) {
      const skipped = (companyState.plannedQueries || []).filter((q: any) => q.status === 'pending').map((q: any) => q.query);
      (companyState.plannedQueries || []).forEach((q: any) => {
        if (q.status === 'pending') q.status = 'skipped';
      });
      writeTrace(state, 'strategy_changed', { reason: 'Information-gain stop: no new evidence from repeated searches', skipped });
      return {
        type: 'EXTRACT_INFORMATION',
        reason: 'Repeated zero-gain searches; synthesizing the collected evidence',
      };
    }

    return ResearchDirector.proposeNextAction(companyState, extraContext);
  }
}
