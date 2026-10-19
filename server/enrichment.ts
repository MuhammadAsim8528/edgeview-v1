import { getAppSettings, AppSettings } from './settings';
import { getDb } from './sqlite';
import { ResourceGovernor } from './resource_governor';
import { GoogleGenAI } from '@google/genai';
import { assertSafeHeaderValue } from './utils/header_encoder';
import {
  isContaminatedPerson,
  isAcademicEmail,
} from './corporate_validation';
import { isSafeExternalUrl, safeFetchOutboundText } from './url_safety';
import { preservePageContent } from './page_content';
import { detectCountryNamesInText, normalizeCountryName } from '../src/utils/countryNormalizer';
import type { EntityResearchContext } from './research_director';
import { canonicalPersonNameKey } from './evidence_packaging';
import { canonicalCompanyIdentityKey, canonicalContactCacheKey, canonicalCountryIdentityKey } from './company_identity';
import { assertPublicResearchQuery } from './public_research_identity';
import { isCountryCompatiblePhone } from './phone_country';
import { isPlausibleOfficialCompanyUrlCandidate } from './official_website';

let _geminiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!_geminiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is required');
    }
    _geminiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return _geminiClient;
}

export interface SocialAccount {
  platform: string;
  url: string;
  handle?: string;
  display_name?: string;
  verified?: boolean;
  source_url?: string;
}

export interface WhatsAppContact {
  value: string;
  status: 'verified' | 'not_verified' | 'unknown';
  source_url?: string;
}

export interface PersonContact {
  value: string;
  type?: string;
  verified?: boolean;
  source_url?: string;
}

export interface DecisionMaker {
  id?: string;
  name: string;
  designation?: string;
  department?: string;
  emails?: PersonContact[];
  phones?: PersonContact[];
  whatsapp?: WhatsAppContact;
  socials?: SocialAccount[];
  address?: { full: string; type?: string; source_url?: string };
  sources?: ContactSource[];
}

export interface GeneralCompanyContact {
  email?: string;
  phone?: string;
  type?: string;
  source_url?: string;
}

export interface ContactPerson {
  name: string;
  designation?: string;
  email?: string;
  phone?: string;
  department?: string;
  country?: string;
  branch?: string;
  linkedin_url?: string;
  source_url?: string;
}

export interface CompanyAddress {
  address: string;
  type?: string;
  source_url?: string;
}

export interface ContactSource {
  url: string;
  title?: string;
  source_type?: string;
}

export interface SourceEvidence {
  field: string;
  value: string;
  source_url: string;
  source_type?: string;
  confidence?: number;
  evidence_text?: string;
}

export type CompanyQualityStatus = 'COMPLETE' | 'PARTIAL' | 'NOT_FOUND' | 'FAILED' | 'PENDING' | 'ENRICHING';

export interface ActivityLogEntry {
  id: string;
  timestamp: string;
  company_name?: string;
  message: string;
  type: 'info' | 'success' | 'warn' | 'error';
}

export interface SystemLogEntry {
  id: string;
  timestamp: string;
  level: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
  subsystem: 'STARTUP' | 'DATABASE' | 'CONFIG' | 'API' | 'EXPORT' | 'SECURITY';
  message: string;
  details?: string;
}

export interface EnrichmentLogEntry {
  id: string;
  timestamp: string;
  company_name: string;
  step: 'QUERY_GEN' | 'SERPER_SEARCH' | 'AI_RANKING' | 'SCRAPE' | 'AI_EXTRACT' | 'CACHE_WRITE';
  status: 'SUCCESS' | 'WARNING' | 'ERROR' | 'INFO';
  message: string;
  details?: string;
}

export interface SyncLogEntry {
  id: string;
  timestamp: string;
  event_type: 'FILE_IMPORT' | 'DB_WRITE' | 'CACHE_HIT' | 'CACHE_MISS' | 'UI_SYNC';
  record_count?: number;
  target: string;
  status: 'SUCCESS' | 'FAILED' | 'PENDING';
  message: string;
}

export interface UsageStats {
  search_requests: number;
  scraper_requests: number;
  nvidia_calls: number;
  groq_calls: number;
  gemini_calls: number;
  pages_analyzed: number;
  duration_ms: number;
  cache_hits: number;
  cache_misses: number;
}

const activityLogs: ActivityLogEntry[] = [];
const systemLogs: SystemLogEntry[] = [
  {
    id: 'sys-init-0',
    timestamp: new Date().toISOString(),
    level: 'INFO',
    subsystem: 'STARTUP',
    message: 'EdgeView backend system initialized. Persistence and AI modules online.',
  },
];
const enrichmentLogs: EnrichmentLogEntry[] = [];
const syncLogs: SyncLogEntry[] = [
  {
    id: 'sync-init-0',
    timestamp: new Date().toISOString(),
    event_type: 'UI_SYNC',
    target: 'SQLite Persistence Cache',
    status: 'SUCCESS',
    message: 'Canonical database layer synchronized.',
  },
];

const usageStats: UsageStats = {
  search_requests: 0,
  scraper_requests: 0,
  nvidia_calls: 0,
  groq_calls: 0,
  gemini_calls: 0,
  pages_analyzed: 0,
  duration_ms: 0,
  cache_hits: 0,
  cache_misses: 0,
};

export function logActivity(message: string, company_name?: string, type: 'info' | 'success' | 'warn' | 'error' = 'info') {
  const entry: ActivityLogEntry = {
    id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    timestamp: new Date().toLocaleTimeString(),
    company_name,
    message,
    type,
  };
  activityLogs.unshift(entry);
  if (activityLogs.length > 250) activityLogs.pop();
}

export function logSystemEvent(
  level: SystemLogEntry['level'],
  subsystem: SystemLogEntry['subsystem'],
  message: string,
  details?: string
) {
  const entry: SystemLogEntry = {
    id: `sys-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    timestamp: new Date().toISOString(),
    level,
    subsystem,
    message,
    details,
  };
  systemLogs.unshift(entry);
  if (systemLogs.length > 300) systemLogs.pop();
}

export function logEnrichmentEvent(
  company_name: string,
  step: EnrichmentLogEntry['step'],
  status: EnrichmentLogEntry['status'],
  message: string,
  details?: string
) {
  const entry: EnrichmentLogEntry = {
    id: `enr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    timestamp: new Date().toISOString(),
    company_name,
    step,
    status,
    message,
    details,
  };
  enrichmentLogs.unshift(entry);
  if (enrichmentLogs.length > 500) enrichmentLogs.pop();
}

export function logSyncEvent(
  event_type: SyncLogEntry['event_type'],
  target: string,
  status: SyncLogEntry['status'],
  message: string,
  record_count?: number
) {
  const entry: SyncLogEntry = {
    id: `sync-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    timestamp: new Date().toISOString(),
    event_type,
    target,
    status,
    message,
    record_count,
  };
  syncLogs.unshift(entry);
  if (syncLogs.length > 300) syncLogs.pop();
}

export function getActivityLogs(): ActivityLogEntry[] {
  return activityLogs;
}

export function getSystemLogs(): SystemLogEntry[] {
  return systemLogs;
}

export function getEnrichmentLogs(): EnrichmentLogEntry[] {
  return enrichmentLogs;
}

export function getSyncLogs(): SyncLogEntry[] {
  return syncLogs;
}

export function clearSystemLogs() {
  systemLogs.length = 0;
  logSystemEvent('INFO', 'CONFIG', 'System logs cleared by user.');
}

export function clearEnrichmentLogs() {
  enrichmentLogs.length = 0;
}

export function clearSyncLogs() {
  syncLogs.length = 0;
}

export function getUsageStats(): UsageStats {
  return usageStats;
}

export let currentSingleEnrichment: { companyName: string; status: string } | null = null;

export function setCurrentSingleEnrichment(companyName: string, status: string) {
  currentSingleEnrichment = { companyName, status };
}

export function clearCurrentSingleEnrichment() {
  currentSingleEnrichment = null;
}

export async function initializePersistentCounters() {
  try {
    const { getDb } = await import('./sqlite');
    const db = await getDb();
    const rows = await db.all("SELECT key, value FROM settings WHERE key LIKE 'counter_%'");
    for (const row of rows) {
      const metric = row.key.replace('counter_', '') as keyof UsageStats;
      if (metric in usageStats) {
        usageStats[metric] = Number(row.value) || 0;
      }
    }
    console.log('[Enrichment] Persistent counters loaded:', usageStats);
  } catch (err) {
    console.error('[Enrichment] Failed to load persistent counters:', err);
  }
}

export function recordUsage(metric: keyof UsageStats, amount: number = 1) {
  if (metric in usageStats) {
    usageStats[metric] += amount;
    // Persist asynchronously to SQLite
    import('./sqlite').then(({ getDb }) => {
      getDb().then(db => {
        db.run(
          'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
          [`counter_${metric}`, String(usageStats[metric])]
        ).catch(err => {
          console.warn(`[Enrichment] Failed to persist counter_${metric}:`, err);
        });
      }).catch(() => {});
    }).catch(() => {});
  }
}

export function calculateEnrichmentStatus(company: any): CompanyQualityStatus {
  if (!company) return 'PENDING';

  if (company.quality_status === 'FAILED' || company.status === 'FAILED') return 'FAILED';
  if (company.quality_status === 'ENRICHING' || company.status === 'ENRICHING') return 'ENRICHING';

  const decisionMakers = company.decision_makers || company.contact_persons || [];
  const emails = company.emails_list || (company.email ? [company.email] : []);
  const phones = company.phones_list || (company.phone ? [company.phone] : []);
  const addresses = company.addresses || (company.address ? [{ address: company.address }] : []);
  const website = company.website || '';
  const ceo = company.ceo || '';

  const hasDecisionMaker = decisionMakers.length > 0 && decisionMakers.some((dm: any) => Boolean(dm.name || dm.ceo));
  const hasContactInfo = emails.length > 0 || phones.length > 0;
  const hasLocationOrWeb = addresses.length > 0 || Boolean(website);

  // COMPLETE requires all three pillars: leadership/decision-maker presence, contact channels (email/phone), and physical/digital location
  if ((hasDecisionMaker || Boolean(ceo)) && hasContactInfo && hasLocationOrWeb) {
    return 'COMPLETE';
  }
  if (hasDecisionMaker || hasContactInfo || hasLocationOrWeb || Boolean(ceo)) {
    return 'PARTIAL';
  }

  if (company.fetched_at || company.source || company.last_updated) {
    return 'NOT_FOUND';
  }

  return 'PENDING';
}

export interface ExtractedCompanyDetails {
  company_name: string;
  website: string;
  address: string;
  phone: string;
  email: string;
  linkedin: string;
  industry: string;
  country?: string;
  fax_numbers?: string[];
  emails_list?: string[];
  phones_list?: string[];
  linkedin_urls?: string[];
  addresses?: CompanyAddress[];
  contact_persons?: ContactPerson[];
  decision_makers?: DecisionMaker[];
  socials?: SocialAccount[];
  whatsapp_details?: WhatsAppContact;
  company_contacts?: GeneralCompanyContact[];
  sources?: ContactSource[];
  isPartial: boolean;
  quality_status?: CompanyQualityStatus;
  evidence?: SourceEvidence[];
  source: string;
  fetched_at?: string;
  research_trace?: any[];
  objectives?: Record<string, any>;
  entity_proof?: import('./entity_proof_search').EntityProofState;
  replace_branch_facts?: boolean;
  /** Set only when a fresh identity check proves the persisted website candidate does not belong to the target. */
  invalidate_existing_identity?: boolean;
  claims?: import('./trusted_intelligence').IntelligenceClaim[];
  contradictions?: import('./trusted_intelligence').IntelligenceContradiction[];
  research_assessment?: import('./trusted_intelligence').ResearchAssessment;
}

export async function callAi(prompt: string, settings: AppSettings): Promise<string> {
  if ((globalThis as any).__mockCallAi) {
    return await (globalThis as any).__mockCallAi(prompt, settings);
  }
  const { buildAIExecutionPlan, executeAIPlan } = await import('./ai_execution_plan');
  const plan = buildAIExecutionPlan(settings);
  const result = await executeAIPlan(plan, prompt, settings, 'callAi');
  return result.content;
}

async function tryGeminiSearch(searchQuery: string, settings: AppSettings, companyName: string): Promise<any> {
  if (settings.gemini_enabled === false) throw new Error('Gemini is disabled in Settings');
  const { assertPublicResearchQuery } = await import('./public_research_identity');
  searchQuery = assertPublicResearchQuery(searchQuery, { companyName });
  return await ResourceGovernor.executeWithRetry('gemini', 'Gemini search', async () => {
    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
      model: settings.gemini_model || 'gemini-3.6-flash',
      contents: `Search Google and return information about: ${searchQuery}`,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    const organic = (chunks || [])
      .filter((c: any) => c.web && c.web.uri)
      .map((c: any) => ({
        title: c.web.title || '',
        link: c.web.uri,
        snippet: response.text || '',
      }));

    return { organic };
  }, 2);
}


async function getCachedSearch(query: string): Promise<any | null> {
  try {
    const db = await getDb();
    const row = await db.get('SELECT response FROM search_query_cache WHERE query = ?', [query]);
    if (row && row.response) {
      return JSON.parse(row.response);
    }
  } catch (err) {
    console.warn('getCachedSearch error:', err);
  }
  return null;
}

async function saveCachedSearch(query: string, response: any): Promise<void> {
  try {
    const db = await getDb();
    await db.run(
      'INSERT INTO search_query_cache (query, response) VALUES (?, ?) ON CONFLICT(query) DO UPDATE SET response = excluded.response, cached_at = CURRENT_TIMESTAMP',
      [query, JSON.stringify(response)]
    );
  } catch (err) {
    console.warn('saveCachedSearch error:', err);
  }
}

async function getCachedScrape(url: string): Promise<string | null> {
  try {
    const db = await getDb();
    const row = await db.get('SELECT content FROM scraped_url_cache WHERE url = ?', [url]);
    if (row && row.content) {
      return row.content;
    }
  } catch (err) {
    console.warn('getCachedScrape error:', err);
  }
  return null;
}

async function saveCachedScrape(url: string, content: string): Promise<void> {
  try {
    const db = await getDb();
    await db.run(
      'INSERT INTO scraped_url_cache (url, content) VALUES (?, ?) ON CONFLICT(url) DO UPDATE SET content = excluded.content, cached_at = CURRENT_TIMESTAMP',
      [url, content]
    );
  } catch (err) {
    console.warn('saveCachedScrape error:', err);
  }
}

export function extractJsonBlock(text: string): string {
  if (!text) return '';
  
  // 1. Try markdown JSON code blocks first
  const jsonBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/;
  const match = jsonBlockRegex.exec(text);
  if (match && match[1]) {
    return match[1].trim();
  }
  
  // 2. Locate first/last brace and first/last bracket
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  const firstBracket = text.indexOf('[');
  const lastBracket = text.lastIndexOf(']');

  let candidateObj = '';
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    candidateObj = text.substring(firstBrace, lastBrace + 1).trim();
  }

  let candidateArr = '';
  if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
    candidateArr = text.substring(firstBracket, lastBracket + 1).trim();
  }

  // Check if either is valid JSON
  if (candidateObj) {
    try {
      JSON.parse(candidateObj);
      return candidateObj;
    } catch (_) {}
  }

  if (candidateArr) {
    try {
      JSON.parse(candidateArr);
      return candidateArr;
    } catch (_) {}
  }

  // Fallback if neither parsed successfully (e.g. malformed JSON but we still want to try returning it)
  if (firstBrace !== -1 && firstBracket !== -1) {
    if (firstBrace < firstBracket && lastBrace > firstBrace) {
      return candidateObj || text.trim();
    } else if (lastBracket > firstBracket) {
      return candidateArr || text.trim();
    }
  }

  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return candidateObj;
  }

  if (firstBracket !== -1 && lastBracket > firstBracket) {
    return candidateArr;
  }

  return text.trim();
}

export function safeJsonParse<T = any>(text: string, fallback: T): T {
  if (!text || !text.trim()) return fallback;
  let cleaned = text.trim();

  // Clean trailing commas in arrays and objects, which AI commonly leaves:
  cleaned = cleaned.replace(/,\s*([\]}])/g, '$1');

  // Try parsing directly
  try {
    return JSON.parse(cleaned) as T;
  } catch (err) {
    // Attempt basic truncation recovery by balancing brackets and braces
    try {
      let temp = cleaned;
      const openBraces = (temp.match(/\{/g) || []).length;
      const closeBraces = (temp.match(/\}/g) || []).length;
      const openBrackets = (temp.match(/\[/g) || []).length;
      const closeBrackets = (temp.match(/\]/g) || []).length;

      // Close open arrays
      if (openBrackets > closeBrackets) {
        temp += ']'.repeat(openBrackets - closeBrackets);
      }
      // Close open objects
      if (openBraces > closeBraces) {
        temp += '}'.repeat(openBraces - closeBraces);
      }

      return JSON.parse(temp) as T;
    } catch (_) {
      // Return fallback if all repair attempts fail
      return fallback;
    }
  }
}

export function normalizeCompanyName(name: string): string {
  return canonicalCompanyIdentityKey(name);
}

export async function getCachedCompany(companyName: string, country?: string, role?: string): Promise<ExtractedCompanyDetails | null> {
  const cleanName = (companyName || '').trim();
  const normName = normalizeCompanyName(cleanName);
  if (!normName) return null;

  const countrySlug = canonicalCountryIdentityKey(country);
  const roleSlug = (role || '').trim().toLowerCase();

  // Country-aware cache keys: a (company, country) context resolves to its own
  // cache record first, so multi-country importers keep fully separate contexts.
  const possibleKeys = [
    (countrySlug && roleSlug) ? canonicalContactCacheKey(cleanName, country, role) : null,
    countrySlug ? canonicalContactCacheKey(cleanName, country) : null,
    cleanName,
    normName,
  ].filter(Boolean) as string[];

  try {
    const db = await getDb();
    let cached: any = null;
    for (const key of possibleKeys) {
      const rows = await db.all(
        'SELECT * FROM contact_cache WHERE LOWER(TRIM(company_name)) = ? OR company_name = ?',
        [key.toLowerCase(), key]
      );
      const row = rows.sort((a: any, b: any) => {
        const score = (candidate: any) => {
          try {
            const details = JSON.parse(candidate.details_json || '{}');
            const quality = String(details.quality_status || '').toUpperCase();
            return (quality === 'COMPLETE' ? 1000 : quality === 'PARTIAL' ? 500 : quality === 'FAILED' ? 0 : 100)
              + (details.emails_list?.length || 0)
              + (details.phones_list?.length || 0)
              + (details.contact_persons?.length || 0);
          } catch (_) { return 0; }
        };
        return score(b) - score(a);
      })[0];
      if (!row) continue;

      // A legacy plain key may serve a country request only when its persisted
      // country canonically matches. Missing country is ambiguous and cannot be
      // attached to an arbitrary branch.
      const keyIsSuffixed = key.includes('__');
      if (countrySlug && !keyIsSuffixed) {
        let stored = '';
        try {
          stored = canonicalCountryIdentityKey(JSON.parse(row.details_json || '{}').country);
        } catch (_) {}
        if (stored !== countrySlug) {
          console.warn(`[getCachedCompany] Plain record for "${cleanName}" stored country "${stored}" differs from target "${countrySlug}". Not reused for this country context.`);
          continue;
        }
      }

      cached = row;
      break;
    }

    if (cached) {
      let extraDetails: Partial<ExtractedCompanyDetails> = {};
      if (cached.details_json) {
        try {
          extraDetails = JSON.parse(cached.details_json);
        } catch (e) {
          // ignore parse errors
        }
      }

      const email = cached.email || extraDetails.email || '';
      const phone = cached.phone || extraDetails.phone || '';
      const address = cached.address || extraDetails.address || '';
      const website = cached.website || extraDetails.website || '';
      const linkedin = cached.linkedin || extraDetails.linkedin || '';
      const industry = cached.industry || extraDetails.industry || '';

      const res: ExtractedCompanyDetails = {
        company_name: cleanName,
        website,
        address,
        phone,
        email,
        linkedin,
        industry,
        country: extraDetails.country || '',
        fax_numbers: extraDetails.fax_numbers || [],
        emails_list: extraDetails.emails_list || (email ? [email] : []),
        phones_list: extraDetails.phones_list || (phone ? [phone] : []),
        linkedin_urls: extraDetails.linkedin_urls || (linkedin ? [linkedin] : []),
        addresses: extraDetails.addresses || (address ? [{ address }] : []),
        contact_persons: extraDetails.contact_persons || [],
        decision_makers: extraDetails.decision_makers || [],
        socials: extraDetails.socials || (linkedin ? [{ platform: 'LinkedIn', url: linkedin }] : []),
        whatsapp_details: extraDetails.whatsapp_details || undefined,
        company_contacts: extraDetails.company_contacts || [],
        sources: extraDetails.sources || [],
        evidence: extraDetails.evidence || [],
        isPartial: extraDetails.isPartial ?? false,
        quality_status: extraDetails.quality_status || calculateEnrichmentStatus({ ...extraDetails, email, phone, address, website }),
        source: cached.source || 'cache',
        fetched_at: cached.fetched_at || undefined,
        research_trace: extraDetails.research_trace || undefined,
        objectives: extraDetails.objectives || undefined,
        entity_proof: extraDetails.entity_proof,
        claims: extraDetails.claims || [],
        contradictions: extraDetails.contradictions || [],
        research_assessment: extraDetails.research_assessment,
        invalidate_existing_identity: extraDetails.invalidate_existing_identity,
      };

      logSyncEvent('CACHE_HIT', 'contact_cache', 'SUCCESS', `Retrieved cached profile for "${cleanName}"`, 1);
      return res;
    }
  } catch (err) {
    console.warn('getCachedCompany error:', err);
  }
  return null;
}

export function isValidEmail(e: string): boolean {
  return Boolean(e && typeof e === 'string' && e.includes('@') && e.includes('.') && e.length >= 5);
}

export function isValidPhone(p: string): boolean {
  if (!p || typeof p !== 'string' || p.length < 6) return false;
  const digits = p.replace(/\D/g, '');
  return digits.length >= 6 && new Set(digits).size > 1;
}

export function isValidUrl(u: string): boolean {
  return Boolean(u && typeof u === 'string' && u.length >= 5 && (u.startsWith('http') || u.includes('.')));
}

function isThirdPartyDirectoryWebsite(value: string): boolean {
  try {
    const candidate = value.startsWith('http') ? value : `https://${value}`;
    const host = new URL(candidate).hostname.toLowerCase().replace(/^www\./, '');
    return ['panjiva.com', 'importgenius.com', 'volza.com', 'zoominfo.com', 'crunchbase.com']
      .some((domain) => host === domain || host.endsWith(`.${domain}`));
  } catch (_) {
    return false;
  }
}

export function shouldRetainAddressForCountryMerge(address: string, targetCountry: string, hasFreshTargetAddress: boolean): boolean {
  if (!hasFreshTargetAddress || !targetCountry) return true;
  const target = normalizeCountryName(targetCountry).toLowerCase();
  const mentions = detectCountryNamesInText(address).map((country) => normalizeCountryName(country).toLowerCase());
  return mentions.length === 0 || mentions.includes(target);
}

export function isEmailAttributedToCompany(email: string, website: string, evidence: SourceEvidence[]): boolean {
  let targetHost = '';
  try { targetHost = new URL(website).hostname.toLowerCase().replace(/^www\./, ''); } catch (_) {}
  if (!targetHost) return true;
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const emailHost = normalizedEmail.split('@')[1] || '';
  const matchingEvidence = (evidence || []).filter((item) =>
    String(item?.field || '').toLowerCase() === 'email' && String(item?.value || '').trim().toLowerCase() === normalizedEmail
  );
  const hasOfficialEvidence = matchingEvidence.some((item) => {
    try {
      const sourceHost = new URL(String(item.source_url || '')).hostname.toLowerCase().replace(/^www\./, '');
      return sourceHost === targetHost || sourceHost.endsWith(`.${targetHost}`);
    } catch (_) {
      return false;
    }
  });

  if (emailHost === targetHost || emailHost.endsWith(`.${targetHost}`)) {
    // Preserve a legacy same-domain value when no granular evidence exists,
    // but reject a value whose only known provenance is a third-party pattern
    // page (for example a guessed email-format directory).
    return matchingEvidence.length === 0 || hasOfficialEvidence;
  }
  return hasOfficialEvidence;
}

export function getMissingFields(record: Partial<ExtractedCompanyDetails> | null): string[] {
  if (!record) return ['website', 'email', 'phone', 'address', 'contact_persons'];
  const missing: string[] = [];
  if (!record.website || !isValidUrl(record.website)) missing.push('website');
  if (!record.email && (!record.emails_list || record.emails_list.length === 0)) missing.push('email');
  if (!record.phone && (!record.phones_list || record.phones_list.length === 0)) missing.push('phone');
  if (!record.address && (!record.addresses || record.addresses.length === 0)) missing.push('address');
  if ((!record.contact_persons || record.contact_persons.length === 0) && (!record.decision_makers || record.decision_makers.length === 0)) missing.push('contact_persons');
  return missing;
}

export async function saveEnrichedData(
  data: Partial<ExtractedCompanyDetails> & { company_name: string }
): Promise<ExtractedCompanyDetails> {
  const cleanName = (data.company_name || '').trim();
  if (!cleanName) {
    throw new Error('company_name is required to save enriched data');
  }

  // Country-aware storage: a record enriched for a specific country branch is
  // stored under its own (company, country) cache key so multi-country importers
  // keep separate contexts. The display company_name stays clean.
  const dataCountry = (data.country || '').trim();
  const storageKey = canonicalContactCacheKey(cleanName, dataCountry);

  const existing = dataCountry
    ? await getCachedCompany(cleanName, dataCountry)
    : await getCachedCompany(cleanName);
  const replaceBranchFacts = Boolean(data.replace_branch_facts && dataCountry);
  const staleCandidateWebsite = String(existing?.website || '').trim();
  const invalidateExistingIdentity = Boolean(dataCountry && (
    data.invalidate_existing_identity ||
    (replaceBranchFacts && staleCandidateWebsite && !isPlausibleOfficialCompanyUrlCandidate(staleCandidateWebsite, cleanName))
  ));

  // 1. Emails
  const rawCandidateWebsite = (data.website || (invalidateExistingIdentity ? '' : existing?.website) || '').trim();
  const candidateWebsite = isThirdPartyDirectoryWebsite(rawCandidateWebsite) ? '' : rawCandidateWebsite;
  const hasFreshEmails = Boolean((data.emails_list || []).length || (data as any).emails?.length || data.email);
  const existingEmailValues = invalidateExistingIdentity || (replaceBranchFacts && hasFreshEmails) ? [] : [
    ...(existing?.emails_list || []),
    ...(existing?.email ? [existing.email] : []),
  ];
  const emailEvidence = [
    ...(data.evidence || []),
    ...(replaceBranchFacts && (data.evidence || []).length ? [] : (existing?.evidence || [])),
  ];
  const rawEmails = [
    ...(data.emails_list || []),
    ...((data as any).emails || []),
    ...(data.email ? [data.email] : []),
    ...existingEmailValues,
  ];
  const validEmails: string[] = [];
  const seenEmails = new Set<string>();
  for (const em of rawEmails) {
    if (typeof em === 'string' && isValidEmail(em) && !isAcademicEmail(em) && isEmailAttributedToCompany(em, candidateWebsite, emailEvidence)) {
      const lower = em.trim().toLowerCase();
      if (!seenEmails.has(lower)) {
        seenEmails.add(lower);
        validEmails.push(em.trim());
      }
    }
  }

  // 2. Phones
  const hasFreshPhones = Boolean((data.phones_list || []).length || (data as any).phones?.length || data.phone);
  const rawPhones = [
    ...(data.phones_list || []),
    ...((data as any).phones || []),
    ...(data.phone ? [data.phone] : []),
    ...(invalidateExistingIdentity || (replaceBranchFacts && hasFreshPhones) ? [] : (existing?.phones_list || [])),
    ...(invalidateExistingIdentity || (replaceBranchFacts && hasFreshPhones) ? [] : (existing?.phone ? [existing.phone] : [])),
  ];
  const validPhones: string[] = [];
  const seenPhones = new Set<string>();
  const phoneCountry = (data.country || existing?.country || '').trim();
  for (const ph of rawPhones) {
    if (typeof ph === 'string' && isValidPhone(ph) && isCountryCompatiblePhone(ph, phoneCountry)) {
      const digits = ph.replace(/\D/g, '');
      if (!seenPhones.has(digits)) {
        seenPhones.add(digits);
        validPhones.push(ph.trim());
      }
    }
  }

  // 3. Faxes
  const rawFaxes = [
    ...(data.fax_numbers || []),
    ...(invalidateExistingIdentity || (replaceBranchFacts && (data.fax_numbers || []).length) ? [] : (existing?.fax_numbers || []))
  ];
  const validFaxes: string[] = [];
  const seenFaxes = new Set<string>();
  for (const fx of rawFaxes) {
    if (typeof fx === 'string' && isValidPhone(fx) && isCountryCompatiblePhone(fx, phoneCountry)) {
      const digits = fx.replace(/\D/g, '');
      if (!seenFaxes.has(digits)) {
        seenFaxes.add(digits);
        validFaxes.push(fx.trim());
      }
    }
  }

  // 4. LinkedIn & Social Accounts
  const rawLinkedin = [
    ...(data.linkedin_urls || []),
    ...(data.linkedin ? [data.linkedin] : []),
    ...(invalidateExistingIdentity || (replaceBranchFacts && ((data.linkedin_urls || []).length || data.linkedin) ? true : false) ? [] : (existing?.linkedin_urls || [])),
    ...(invalidateExistingIdentity || (replaceBranchFacts && ((data.linkedin_urls || []).length || data.linkedin) ? true : false) ? [] : (existing?.linkedin ? [existing.linkedin] : []))
  ];
  const validLinkedin: string[] = [];
  const seenLinkedin = new Set<string>();
  for (const lk of rawLinkedin) {
    if (typeof lk === 'string' && lk.toLowerCase().includes('linkedin.com')) {
      const cleanLk = lk.trim().toLowerCase().replace(/\/+$/, '');
      if (!seenLinkedin.has(cleanLk)) {
        seenLinkedin.add(cleanLk);
        validLinkedin.push(lk.trim());
      }
    }
  }

  const rawSocials: SocialAccount[] = [
    ...(data.socials || []),
    ...(invalidateExistingIdentity ? [] : (existing?.socials || [])),
    ...validLinkedin.map((u) => ({ platform: 'LinkedIn', url: u })),
  ];
  const validSocials: SocialAccount[] = [];
  const seenSocialUrls = new Set<string>();
  for (const soc of rawSocials) {
    if (soc && soc.url) {
      const cleanUrl = soc.url.trim().toLowerCase().replace(/\/+$/, '');
      if (!seenSocialUrls.has(cleanUrl)) {
        seenSocialUrls.add(cleanUrl);
        validSocials.push({
          platform: soc.platform || 'Social',
          url: soc.url.trim(),
          handle: soc.handle,
          verified: soc.verified ?? true,
          source_url: soc.source_url,
        });
      }
    }
  }

  // 5. Addresses
  const targetCountry = (data.country || existing?.country || '').trim();
  const freshAddresses = [
    ...(data.addresses || []),
    ...(data.address ? [{ address: data.address }] : []),
  ];
  const targetCountryNorm = normalizeCountryName(targetCountry).toLowerCase();
  const hasFreshTargetAddress = Boolean(targetCountryNorm && freshAddresses.some((addr: any) =>
    detectCountryNamesInText(String(addr?.address || '')).some((country) => normalizeCountryName(country).toLowerCase() === targetCountryNorm)
  ));
  const existingAddresses = (invalidateExistingIdentity || (replaceBranchFacts && freshAddresses.length > 0) ? [] : [
    ...(existing?.addresses || []),
    ...(existing?.address ? [{ address: existing.address }] : []),
  ]).filter((addr: any) => shouldRetainAddressForCountryMerge(String(addr?.address || ''), targetCountry, hasFreshTargetAddress));
  const rawAddresses = [...freshAddresses, ...existingAddresses];
  const validAddresses: CompanyAddress[] = [];
  const seenAddresses = new Set<string>();
  for (const addrObj of rawAddresses) {
    if (addrObj && typeof addrObj === 'object') {
      const addrStr = (addrObj.address || '').trim();
      if (addrStr.length > 5 && !/^(?:n\/?a|unknown|none|null|not\s+(?:answerable|available|found)|unavailable)$/i.test(addrStr)) {
        const normAddr = addrStr.toLowerCase().replace(/\s+/g, ' ');
        if (!seenAddresses.has(normAddr)) {
          seenAddresses.add(normAddr);
          validAddresses.push({
            address: addrStr,
            type: addrObj.type || 'Corporate Headquarters',
            source_url: addrObj.source_url || ''
          });
        }
      }
    }
  }

  // 6. Decision Makers & Contact Persons
  const rawDms: DecisionMaker[] = [
    ...(data.decision_makers || []),
    ...(invalidateExistingIdentity || (replaceBranchFacts && ((data.decision_makers || []).length || (data.contact_persons || []).length)) ? [] : (existing?.decision_makers || [])),
  ];

  const rawContacts = [
    ...(data.contact_persons || []),
    ...(invalidateExistingIdentity || (replaceBranchFacts && ((data.contact_persons || []).length || (data.decision_makers || []).length)) ? [] : (existing?.contact_persons || []))
  ];

  const validDms: DecisionMaker[] = [];
  const seenDmNames = new Set<string>();

  for (const dm of rawDms) {
    if (dm && dm.name && dm.name.trim().length > 1 && !isContaminatedPerson(dm)) {
      const normName = canonicalPersonNameKey(dm.name);
      if (!seenDmNames.has(normName)) {
        seenDmNames.add(normName);
        const dmEmails = Array.isArray(dm.emails) ? dm.emails.filter((e: any) => !(e?.value && isAcademicEmail(e.value))) : [];
        validDms.push({
          id: dm.id || `dm-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          name: dm.name.trim(),
          designation: dm.designation?.trim() || 'Key Executive',
          department: dm.department?.trim(),
          emails: dmEmails,
          phones: dm.phones || [],
          whatsapp: dm.whatsapp || { value: '', status: 'unknown' },
          socials: dm.socials || [],
          address: dm.address,
          sources: dm.sources || [],
        });
      }
    }
  }

  const validContacts: ContactPerson[] = [];
  const seenContactNames = new Set<string>();
  for (const cp of rawContacts) {
    if (cp && typeof cp === 'object') {
      const cpName = (cp.name || '').trim();
      if (cpName.length > 1 && !['n/a', 'unknown', 'none'].includes(cpName.toLowerCase()) && !isContaminatedPerson(cp)) {
        const normName = canonicalPersonNameKey(cpName);
        const cpEmail = (cp.email || '').trim();
        const cpPhone = (cp.phone || '').trim();

        if (!seenDmNames.has(normName)) {
          seenDmNames.add(normName);
          const validCpEmail = isValidEmail(cpEmail) && !isAcademicEmail(cpEmail) ? cpEmail : '';
          const validCpPhone = isValidPhone(cpPhone) && isCountryCompatiblePhone(cpPhone, phoneCountry) ? cpPhone : '';
          validDms.push({
            id: `dm-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            name: cpName,
            designation: cp.designation?.trim() || 'Executive',
            department: cp.department?.trim(),
            emails: validCpEmail ? [{ value: validCpEmail, verified: true }] : [],
            phones: validCpPhone ? [{ value: validCpPhone, verified: false }] : [],
            whatsapp: { value: validCpPhone, status: 'unknown' },
            socials: [],
          });
        }

        if (!seenContactNames.has(normName)) {
          seenContactNames.add(normName);
          validContacts.push({
            name: cpName,
            designation: (cp.designation || '').trim(),
            email: isValidEmail(cpEmail) && !isAcademicEmail(cpEmail) ? cpEmail : '',
            phone: isValidPhone(cpPhone) && isCountryCompatiblePhone(cpPhone, phoneCountry) ? cpPhone : '',
            department: (cp.department || '').trim(),
            country: (cp.country || '').trim(),
            branch: (cp.branch || '').trim(),
            linkedin_url: /^https?:\/\/(?:[a-z]{2,3}\.)?linkedin\.com\//i.test((cp.linkedin_url || '').trim()) ? (cp.linkedin_url || '').trim() : '',
            source_url: (cp.source_url || '').trim()
          });
        } else {
          const existingContact = validContacts.find((person) => canonicalPersonNameKey(person.name) === normName);
          if (existingContact) {
            const incomingDesignation = (cp.designation || '').trim();
            const roles = String(existingContact.designation || '').split('/').map((role) => role.trim().toLowerCase());
            if (incomingDesignation && !roles.includes(incomingDesignation.toLowerCase())) {
              existingContact.designation = existingContact.designation ? `${existingContact.designation} / ${incomingDesignation}` : incomingDesignation;
            }
            if (!existingContact.email && isValidEmail(cpEmail) && !isAcademicEmail(cpEmail)) existingContact.email = cpEmail;
            if (!existingContact.phone && isValidPhone(cpPhone) && isCountryCompatiblePhone(cpPhone, phoneCountry)) existingContact.phone = cpPhone;
            if (!existingContact.department && cp.department) existingContact.department = String(cp.department).trim();
            if (!existingContact.country && cp.country) existingContact.country = String(cp.country).trim();
            if (!existingContact.branch && cp.branch) existingContact.branch = String(cp.branch).trim();
            if (!existingContact.linkedin_url && /^https?:\/\/(?:[a-z]{2,3}\.)?linkedin\.com\//i.test((cp.linkedin_url || '').trim())) existingContact.linkedin_url = String(cp.linkedin_url).trim();
            if (!existingContact.source_url && cp.source_url) existingContact.source_url = String(cp.source_url).trim();
          }
        }
      }
    }
  }

  // 7. Sources
  const rawSources = [
    ...(data.sources || []),
    ...(invalidateExistingIdentity || (replaceBranchFacts && (data.sources || []).length) ? [] : (existing?.sources || []))
  ];
  const validSources: ContactSource[] = [];
  const seenSources = new Set<string>();
  for (const src of rawSources) {
    if (src && typeof src === 'object') {
      const urlStr = (src.url || '').trim();
      if (isValidUrl(urlStr)) {
        const normUrl = urlStr.toLowerCase().replace(/\/+$/, '');
        if (!seenSources.has(normUrl)) {
          seenSources.add(normUrl);
          validSources.push({
            url: urlStr,
            title: (src.title || '').trim(),
            source_type: (src.source_type || 'web').trim()
          });
        }
      }
    }
  }

  const rawWebsite = (data.website || (invalidateExistingIdentity ? '' : existing?.website) || '').trim();
  const website = isThirdPartyDirectoryWebsite(rawWebsite) ? '' : rawWebsite;
  const primaryEmail = validEmails[0] || '';
  const primaryPhone = validPhones[0] || '';
  const primaryAddress = validAddresses[0]?.address || '';
  const primaryLinkedin = validLinkedin[0] || '';
  const industry = (data.industry || (invalidateExistingIdentity ? '' : existing?.industry) || '').trim();
  const country = (data.country || existing?.country || '').trim();
  const source = data.source || existing?.source || 'api';

  // Evidence Details (Only retain authentic, field-level evidence with verified provenance URLs)
  const authenticSourceUrl = validSources[0]?.url || (website.startsWith('http') ? website : website ? `https://${website}` : '');
  const evidence: SourceEvidence[] = (data.evidence?.length ? data.evidence : existing?.evidence || [])
    .filter((e) => e && e.field && e.value != null && e.source_url && e.source_url !== 'https://google.com' && isValidUrl(e.source_url))
    .filter((e) => String(e.field || '').toLowerCase() !== 'email' || validEmails.some((email) => email.toLowerCase() === String(e.value || '').trim().toLowerCase()))
    .filter((e) => !['phone','fax'].includes(String(e.field || '').toLowerCase()) || isCountryCompatiblePhone(e.value, phoneCountry))
    .map((e) => {
      const val = e.value;
      const formattedVal = typeof val === 'object' && val !== null ? ((val as any).name ? `${(val as any).name}${(val as any).designation ? ` (${(val as any).designation})` : ''}` : JSON.stringify(val)) : String(val ?? '');
      return {
        ...e,
        value: formattedVal
      };
    });

  validDms.forEach((dm) => {
    const srcUrl = dm.sources?.[0]?.url || authenticSourceUrl;
    if (srcUrl && isValidUrl(srcUrl)) {
      evidence.push({
        field: 'Decision Maker',
        value: `${dm.name}${dm.designation ? ` (${dm.designation})` : ''}`,
        source_url: srcUrl,
        source_type: 'executive_profile',
        confidence: 90,
        evidence_text: `Extracted decision maker: ${dm.name}, Title: ${dm.designation || 'Executive'}`,
      });
    }
  });

  const quality_status: CompanyQualityStatus = calculateEnrichmentStatus({
    quality_status: data.quality_status,
    decision_makers: validDms,
    contact_persons: validContacts,
    emails_list: validEmails,
    phones_list: validPhones,
    addresses: validAddresses,
    email: primaryEmail,
    phone: primaryPhone,
    address: primaryAddress,
    website,
    fetched_at: new Date().toISOString(),
    source,
  });

  const isPartial = quality_status === 'PARTIAL' || quality_status === 'NOT_FOUND';

  const whatsapp_details = data.whatsapp_details || existing?.whatsapp_details || {
    value: primaryPhone,
    status: 'unknown',
  };

  const { buildTrustedIntelligence } = await import('./trusted_intelligence');
  const intelligence = buildTrustedIntelligence(
    cleanName,
    country,
    website,
    evidence,
    [website, primaryEmail, primaryPhone, primaryAddress, primaryLinkedin, industry, validDms.length ? 'leadership' : ''].filter(Boolean).length
  );

  const finalResult: ExtractedCompanyDetails = {
    company_name: cleanName,
    website,
    address: primaryAddress,
    phone: primaryPhone,
    email: primaryEmail,
    linkedin: primaryLinkedin,
    industry,
    country,
    fax_numbers: validFaxes,
    emails_list: validEmails,
    phones_list: validPhones,
    linkedin_urls: validLinkedin,
    addresses: validAddresses,
    contact_persons: validContacts,
    decision_makers: validDms,
    socials: validSocials,
    company_contacts: data.company_contacts || existing?.company_contacts || [],
    whatsapp_details,
    sources: validSources,
    isPartial,
    quality_status,
    evidence,
    claims: intelligence.claims,
    contradictions: intelligence.contradictions,
    research_assessment: intelligence.assessment,
    entity_proof: data.entity_proof,
    research_trace: data.research_trace || existing?.research_trace || [],
    objectives: data.objectives || existing?.objectives || {},
    invalidate_existing_identity: invalidateExistingIdentity,
    source,
  };

  const db = await getDb();

  // FIX 11: Duplicate entity safety check
  const duplicateCheck = checkDuplicateEntity(db, storageKey, finalResult);
  if (duplicateCheck.isDuplicate) {
    logSyncEvent('DB_WRITE', 'contact_cache', 'SUCCESS', `Duplicate entity detected for "${cleanName}": conflicts with "${duplicateCheck.conflictingEntity?.name}" (canonical: ${duplicateCheck.conflictingEntity?.canonical_key})`, 1);
    console.warn(`Duplicate entity conflict detected: ${storageKey} conflicts with ${duplicateCheck.conflictingEntity?.name}`);
    // Still save but log the conflict for audit
  }

  await db.run(
    `INSERT INTO contact_cache (company_name, website, address, phone, email, linkedin, industry, details_json, source) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(company_name) DO UPDATE SET 
     website=excluded.website, address=excluded.address, phone=excluded.phone, email=excluded.email, 
     linkedin=excluded.linkedin, industry=excluded.industry, details_json=excluded.details_json, fetched_at=CURRENT_TIMESTAMP, source=excluded.source`,
    [
      storageKey,
      website,
      primaryAddress,
      primaryPhone,
      primaryEmail,
      primaryLinkedin,
      industry,
      JSON.stringify(finalResult),
      source
    ]
  );

  logSyncEvent('DB_WRITE', 'contact_cache', 'SUCCESS', `Saved enriched record for "${cleanName}" (${quality_status})`, 1);

  return finalResult;
}

function checkDuplicateEntity(db: any, storageKey: string, finalResult: any): { isDuplicate: boolean; conflictingEntity?: any } {
  try {
    // Check if there's an existing record with the same canonical identity but different trade name
    const existing = db.get(
      `SELECT company_name, details_json FROM contact_cache WHERE company_name != ? AND (
        json_extract(details_json, '$.entity_proof.canonical_key') = ? OR
        json_extract(details_json, '$.website') = ? OR
        json_extract(details_json, '$.primary_email') = ? OR
        json_extract(details_json, '$.primary_phone') = ?
      )`,
      [
        storageKey,
        finalResult.entity_proof?.canonical_key || '',
        finalResult.website || '',
        finalResult.emails_list?.[0] || '',
        finalResult.phones_list?.[0] || ''
      ]
    );
    
    if (existing && existing.details_json && existing.details_json !== 'undefined') {
      try {
        // Check if the existing entity has a different canonical identity
        const existingDetails = JSON.parse(existing.details_json);
        const existingCanonicalKey = existingDetails.entity_proof?.canonical_key;
        const newCanonicalKey = finalResult.entity_proof?.canonical_key;
        
        if (existingCanonicalKey && newCanonicalKey && existingCanonicalKey !== newCanonicalKey) {
          return { isDuplicate: true, conflictingEntity: { name: existing.company_name, canonical_key: existingCanonicalKey } };
        }
        
        // Check for same website but different canonical identity
        if (existingDetails.website && finalResult.website && 
            existingDetails.website === finalResult.website &&
            existingCanonicalKey !== newCanonicalKey) {
          return { isDuplicate: true, conflictingEntity: { name: existing.company_name, canonical_key: existingCanonicalKey } };
        }
      } catch (parseErr) {
        console.warn('Failed to parse existing details_json:', parseErr);
      }
    }
    return { isDuplicate: false };
  } catch (err) {
    console.warn('Duplicate entity check failed:', err);
    return { isDuplicate: false };
  }
}

const inFlightEnrichments = new Map<string, Promise<ExtractedCompanyDetails>>();

/** Coalesce identical concurrent requests so one company never consumes duplicate provider calls. */
export function enrichCompanyDetails(
  companyName: string,
  forceFetch: boolean = false,
  extraContext?: EntityResearchContext
): Promise<ExtractedCompanyDetails> {
  const companyKey = normalizeCompanyName(companyName);
  const contextKey = `${extraContext?.country?.trim().toLowerCase() || ''}|${extraContext?.website?.trim().toLowerCase() || ''}|${extraContext?.role || ''}`;
  const key = `${companyKey}|${contextKey}|${forceFetch ? 'force' : 'cache'}`;
  const active = inFlightEnrichments.get(key);
  if (active) return active;

  const task = enrichCompanyDetailsInternal(companyName, forceFetch, extraContext);
  inFlightEnrichments.set(key, task);
  void task.finally(() => {
    if (inFlightEnrichments.get(key) === task) inFlightEnrichments.delete(key);
  }).catch(() => {});
  return task;
}

async function enrichCompanyDetailsInternal(
  companyName: string,
  forceFetch: boolean = false,
  extraContext?: EntityResearchContext
): Promise<ExtractedCompanyDetails> {
  const cleanName = (companyName || '').trim();
  if (!cleanName) {
    throw new Error('Please select at least one company.');
  }

  const settings = getAppSettings();
  const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY?.trim());
  const hasAiKey = Boolean(settings.nvidia_api_key?.trim() || settings.groq_api_key?.trim() || hasGeminiKey);
  const hasSerperKey = Boolean(settings.serper_api_key?.trim() || hasGeminiKey);

  if (!hasAiKey || !hasSerperKey) {
    throw new Error('API key not connected. Cannot fetch info.');
  }

  // 1. Check cache first if not forced
  if (!forceFetch && !extraContext?.deep_recovery) {
    const cached = await getCachedCompany(cleanName, extraContext?.country, extraContext?.role);
    if (cached) {
      const missing = getMissingFields(cached);
      if (missing.length === 0) {
        return cached;
      }
      console.log(`[enrichCompanyDetails] Cached record for "${cleanName}" is partial. Missing fields: ${missing.join(', ')}. Researching missing fields...`);
    }
  }

  // 1.5 Prefer the controlled Autonomous Research Runtime (spec §5/§35): the
  //     primary provider (NIM, Groq fallback) decides what to investigate as
  //     strict-JSON controlled tool actions; EdgeView validates and safely
  //     executes them. The runtime subsumes the deterministic ResearchDirector
  //     loop below (it drives the same actions), so a completed result — even
  //     NOT_FOUND/FAILED — is authoritative. Only an unexpected runtime crash
  //     degrades to the legacy loop, preserving the established pipeline.
  try {
    const { AutonomousResearchRuntime } = await import('./research_runtime');
    const runtimeResult = await AutonomousResearchRuntime.run(cleanName, extraContext, settings, forceFetch);
    return runtimeResult;
  } catch (err: any) {
    console.warn(`[enrichCompanyDetails] Autonomous research runtime unavailable for "${cleanName}": ${err.message}`);
  }

  const { ResearchDirector } = await import('./research_director');

  // 2. Initialize a local, self-contained CompanyResearchState
  const companyState: any = {
    id: `single-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    name: cleanName,
    status: 'pending',
    stage: 'Initializing',
    resourceUsage: { serper: 0, firecrawl: 0, nvidia: 0, groq: 0 }
  };
  companyState.forceFresh = forceFetch;

  // 3. Drive ResearchDirector's state transitions to completion in a loop
  let maxSteps = 12; // safety cap
  let step = 0;
  while (companyState.status !== 'completed' && companyState.status !== 'failed' && step < maxSteps) {
    step++;
    let action: any;
    try {
      action = ResearchDirector.proposeNextAction(companyState, extraContext);
    } catch (err: any) {
      console.error(`[enrichCompanyDetails] Action proposal failed for "${cleanName}":`, err.message);
      companyState.status = 'failed';
      break;
    }
    try {
      await ResearchDirector.executeAction('single-job', companyState, action, settings, extraContext);
    } catch (err: any) {
      console.error(`[enrichCompanyDetails] Action execution failed for "${cleanName}":`, err.message);
      companyState.status = 'failed';
      break;
    }
  }

  // 4. Retrieve and return the final cached/saved company details
  const finalDetails = await getCachedCompany(cleanName, extraContext?.country);
  if (finalDetails) {
    return finalDetails;
  }

  // Fallback in case of failure or uncached
  return {
    company_name: cleanName,
    website: '',
    address: '',
    phone: '',
    email: '',
    linkedin: '',
    industry: '',
    isPartial: true,
    quality_status: 'FAILED',
    source: 'ResearchDirector loop failure'
  };
}

export async function obsoleteEnrichCompanyDetails(
  companyName: string,
  forceFetch: boolean = false,
  extraContext?: EntityResearchContext
): Promise<ExtractedCompanyDetails> {
  const cleanName = (companyName || '').trim();
  if (!cleanName) {
    throw new Error('Please select at least one company.');
  }

  const settings = getAppSettings();
  const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY?.trim());
  const hasAiKey = Boolean(settings.nvidia_api_key?.trim() || settings.groq_api_key?.trim() || hasGeminiKey);
  const hasSerperKey = Boolean(settings.serper_api_key?.trim() || hasGeminiKey);

  if (!hasAiKey || !hasSerperKey) {
    throw new Error('API key not connected. Cannot fetch info.');
  }

  // Step 1: Cache Check
  if (!forceFetch) {
    const cached = await getCachedCompany(cleanName);
    if (cached && (cached.email || cached.phone || cached.address || cached.website || !cached.isPartial)) {
      return cached;
    }
  }

  // Step 2: AI-Powered Research Strategy Planning
  const country = extraContext?.country || '';
  const existingWebsite = extraContext?.website || '';
  const role = extraContext?.role || 'Importer';

  const plannerPrompt = `You are a precision web intelligence OSINT researcher.
Target Company: "${cleanName}"
Country: "${country || 'Unknown'}"
Role: "${role}"
Existing website: "${existingWebsite || 'None'}"

Design a multi-query research strategy with up to 4 search queries to find the company's contact info (headquarters email, phone, physical address) and key decision-makers (CEO, president, founder, or export managers).

DO NOT blindly generate all 4 queries if fewer are sufficient. Generate only the most relevant, highly targeted queries.
Prioritize:
1. Finding the official website and its contact page or about page (if website is not known).
2. Official social profiles (LinkedIn, Facebook).
3. Government/company registries or trade profiles (highly relevant if we need to verify importers/exporters).
4. High-quality business directories or professional profiles.

For each query, provide:
- query: The search query string for Google.
- target_type: "official_website" | "contact_page" | "leadership" | "registry" | "social_profiles" | "directory"
- reason: Short explanation of why this query is necessary.

Return a valid JSON array of objects. Example:
[
  {
    "query": "ACME Corp France official website contact",
    "target_type": "official_website",
    "reason": "Identify official domain and contact page"
  }
]
Do not write any markdown blocks (e.g. \`\`\`json) or other text outside the JSON.`;

  const defaultQueries = [
    {
      query: existingWebsite ? `${cleanName} contact page address` : `${cleanName} official website contact address`,
      target_type: 'official_website' as const,
      reason: 'Locate official website and contact pages'
    },
    {
      query: `${cleanName} linkedin page company profile facebook`,
      target_type: 'social_profiles' as const,
      reason: 'Find professional social media pages'
    },
    {
      query: `${cleanName} CEO president founder export manager director`,
      target_type: 'leadership' as const,
      reason: 'Find leadership and key contacts'
    },
    {
      query: `${cleanName} headquarters email address phone number contact`,
      target_type: 'contact_page' as const,
      reason: 'Search for public emails and phones'
    }
  ];

  interface SearchResultItem {
    title: string;
    link: string;
    snippet: string;
    domain: string;
  }
  const collectedResults: SearchResultItem[] = [];
  const seenUrls = new Set<string>();

  interface PageEvidence {
    url: string;
    title: string;
    content: string;
  }
  const evidenceCorpus: PageEvidence[] = [];

  let currentWebsite = existingWebsite;
  let hasEmail = false;
  let hasPhone = false;
  let hasLeadership = false;

  // Run AI query planner
  let plannedQueries: any[] = [];
  try {
    logActivity(`Planning research queries for "${cleanName}"...`, cleanName, 'info');
    const plannerRaw = await callAi(plannerPrompt, settings);
    const cleanedPlanner = extractJsonBlock(plannerRaw);
    plannedQueries = safeJsonParse(cleanedPlanner, defaultQueries);
  } catch (err: any) {
    console.warn("AI Query Planner failed, using robust default plan:", err.message);
    plannedQueries = defaultQueries;
  }

  if (!Array.isArray(plannedQueries) || plannedQueries.length === 0) {
    plannedQueries = defaultQueries;
  }

  // To prevent resource exhaustion, we limit the queries list to 4
  const queriesToRun = plannedQueries.slice(0, 4);
  logActivity(`Planned ${queriesToRun.length} targeted search queries for "${cleanName}"`, cleanName, 'info');

  for (let i = 0; i < queriesToRun.length; i++) {
    const planned = queriesToRun[i];

    // Adaptive stop check: If we already have email, phone, and leadership, we can stop the loop early.
    if (hasEmail && hasPhone && hasLeadership) {
      logActivity(`Adaptive stop: satisfied profile parameters met (HQ email, phone, leadership known). Terminating search early.`, cleanName, 'info');
      break;
    }

    // Skip website query if we already found the official website
    if (planned.target_type === 'official_website' && currentWebsite) {
      logActivity(`Adaptive skip: official website already known/resolved, bypassing "${planned.query}"`, cleanName, 'info');
      continue;
    }

    const searchQuery = assertPublicResearchQuery(planned.query, {
      companyName: cleanName,
      country: extraContext?.country,
      role: extraContext?.role,
    });
    logActivity(`Executing query [${i + 1}/${queriesToRun.length} - ${planned.target_type}]: "${searchQuery}"`, cleanName, 'info');

    let organic = [];
    try {
      // Check query cache
      const cachedSearch = await getCachedSearch(searchQuery);
      if (cachedSearch) {
        organic = cachedSearch.organic || [];
        logActivity(`Query cache hit for "${searchQuery}"`, cleanName, 'info');
        recordUsage('cache_hits', 1);
      } else {
        recordUsage('cache_misses', 1);
        if (settings.serper_api_key?.trim()) {
          try {
            // Execute Serper search
            const serperResData = await ResourceGovernor.executeWithRetry('serper', `Serper: ${planned.target_type} query`, async () => {
              const res = await fetch('https://google.serper.dev/search', {
                method: 'POST',
headers: {
        'X-API-KEY': assertSafeHeaderValue(settings.serper_api_key.trim(), 'Serper API key'),
        'Content-Type': 'application/json',
      },
                body: JSON.stringify({ q: searchQuery, num: 5 })
              });
              if (!res.ok) throw new Error(`Serper returned HTTP ${res.status}`);
              return await res.json();
            });
            organic = serperResData.organic || [];
            await saveCachedSearch(searchQuery, serperResData);
          } catch (serperE: any) {
            console.warn(`Serper search failed: ${serperE.message}`);
            if (process.env.GEMINI_API_KEY) {
              logActivity(`Falling back to Gemini Google Search grounding for "${searchQuery}"`, cleanName, 'info');
              const geminiResData = await tryGeminiSearch(searchQuery, settings, cleanName);
              organic = geminiResData.organic || [];
              await saveCachedSearch(searchQuery, geminiResData);
            } else {
              throw serperE;
            }
          }
        } else if (process.env.GEMINI_API_KEY) {
          logActivity(`Using Gemini Google Search grounding for "${searchQuery}"`, cleanName, 'info');
          const geminiResData = await tryGeminiSearch(searchQuery, settings, cleanName);
          organic = geminiResData.organic || [];
          await saveCachedSearch(searchQuery, geminiResData);
        } else {
          throw new Error("No search API key connected.");
        }
      }
    } catch (searchErr: any) {
      console.warn(`Search failed for "${searchQuery}":`, searchErr.message);
      continue;
    }

    const localResults: SearchResultItem[] = [];
    for (const item of organic) {
      if (item.link && !seenUrls.has(item.link)) {
        seenUrls.add(item.link);
        try {
          const urlObj = new URL(item.link);
          const resItem = {
            title: item.title || '',
            link: item.link,
            snippet: item.snippet || '',
            domain: urlObj.hostname
          };
          collectedResults.push(resItem);
          localResults.push(resItem);
        } catch (_) {}
      }
    }

    // Scrape top relevant pages (up to 2 per query)
    const scrapeCandidates = localResults.slice(0, 2);
    for (const candidate of scrapeCandidates) {
      const targetUrl = candidate.link;
      logActivity(`Scraping search result: ${targetUrl}`, cleanName, 'info');

      let content = '';
      const cachedContent = await getCachedScrape(targetUrl);
      if (cachedContent) {
        content = cachedContent;
        logActivity(`Scrape cache hit for ${targetUrl}`, cleanName, 'info');
        recordUsage('cache_hits', 1);
      } else {
        recordUsage('cache_misses', 1);
        if (settings.firecrawl_api_key?.trim()) {
          try {
            content = await ResourceGovernor.executeWithRetry('firecrawl', `Scrape: ${targetUrl}`, async () => {
              const res = await fetch('https://api.firecrawl.dev/v1/scrape', {
                method: 'POST',
headers: {
        'Authorization': `Bearer ${assertSafeHeaderValue(settings.firecrawl_api_key.trim(), 'Firecrawl API key')}`,
        'Content-Type': 'application/json',
      },
                body: JSON.stringify({ url: targetUrl, formats: ['markdown'] })
              });
              if (!res.ok) throw new Error(`Firecrawl returned HTTP ${res.status}`);
              const scrapeData = await res.json();
              if (scrapeData.success && scrapeData.data && scrapeData.data.markdown) {
                return preservePageContent(scrapeData.data.markdown);
              }
              return '';
            });
          } catch (e: any) {
            console.warn(`Firecrawl scrape failed for ${targetUrl}: ${e.message}, trying direct fetch fallback`);
          }
        }

        if (!content && isSafeExternalUrl(targetUrl)) {
          try {
            const { response: fetchRes, text: htmlText } = await safeFetchOutboundText(targetUrl, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Referer': 'https://www.google.com/',
              }
            });
            if (fetchRes.ok) {
              content = preservePageContent(
                htmlText.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
                        .replace(/<[^>]+>/g, ' ')
                        .replace(/\s+/g, ' ')
              );
            }
          } catch (e: any) {
            console.warn(`Direct fallback fetch failed for ${targetUrl}: ${e.message}`);
          }
        }

        if (content.trim()) {
          await saveCachedScrape(targetUrl, content.trim());
        }
      }

      if (content.trim()) {
        evidenceCorpus.push({
          url: targetUrl,
          title: candidate.title || targetUrl,
          content: content.trim()
        });

        // Resolve website if not yet set
        if (!currentWebsite && !targetUrl.includes('linkedin.com') && !targetUrl.includes('facebook.com') && !targetUrl.includes('directory') && !targetUrl.includes('registry')) {
          try {
            const parsedUrl = new URL(targetUrl);
            currentWebsite = `${parsedUrl.protocol}//${parsedUrl.hostname}`;
            logActivity(`Identified official website domain: ${currentWebsite}`, cleanName, 'info');
          } catch (_) {}
        }

        const lowerContent = content.toLowerCase();
        if (/@([a-zA-Z0-9-]+\.)+[a-zA-Z0-9-]{2,4}/.test(lowerContent)) {
          hasEmail = true;
        }
        if (/\+?[0-9][0-9\s.-]{7,15}/.test(lowerContent)) {
          hasPhone = true;
        }
        if (lowerContent.includes('ceo') || lowerContent.includes('director') || lowerContent.includes('founder') || lowerContent.includes('manager')) {
          hasLeadership = true;
        }
      }
    }

    // Dynamic deep-scrape insertion
    if (currentWebsite && (!hasEmail || !hasPhone) && !seenUrls.has(currentWebsite)) {
      try {
        const domain = new URL(currentWebsite).hostname;
        const deepQuery = `site:${domain} contact OR about OR email OR phone`;
        if (!queriesToRun.some(q => q.query === deepQuery)) {
          logActivity(`Deep-Scrape trigger: Scheduling targeted search for domain "${domain}"`, cleanName, 'info');
          queriesToRun.splice(i + 1, 0, {
            query: deepQuery,
            target_type: 'contact_page' as const,
            reason: 'Deep-scrape official contact/about pages'
          });
        }
      } catch (_) {}
    }
  }

  logActivity(`Adaptive search finished. Collected evidence from ${evidenceCorpus.length} sources.`, cleanName, 'info');

  if (evidenceCorpus.length === 0) {
    logActivity(`No public search results retrieved for "${cleanName}"`, cleanName, 'warn');
    return await saveEnrichedData({
      company_name: cleanName,
      website: currentWebsite || '',
      address: '',
      phone: '',
      email: '',
      linkedin: '',
      industry: '',
      isPartial: true,
      quality_status: 'NOT_FOUND',
      source: 'api - no evidence collected'
    });
  }

  // Step 6: Structured AI Information Extraction with Strict NO HALLUCINATION Rule
  // Evidence-aware packaging (forensic ROOT CAUSE 1 fix): single pass when the
  // corpus fits the model context, bounded whole-item chunks otherwise; chunk
  // results are merged deterministically so no evidence-backed fact is lost.
  const countryInstruction = country
    ? `TARGET COUNTRY BRANCH: "${country}". This enrichment targets the operation IN ${country.toUpperCase()}. Prefer contact details of the operation in ${country}; do not promote a branch/office in a different country as the ${country} contact; never invent ${country} details not present in the evidence.`
    : `No specific target country was provided: extract the company's global/headquarters contact information.`;

  const { packageEvidenceForExtraction, mergeExtractionResults, buildExtractionPrompt } = await import('./evidence_packaging');
  const sizingProviderId = settings.primary_ai_provider === 'GEMINI' ? 'gemini' : settings.primary_ai_provider === 'GROQ' ? 'groq' : 'nvidia';
  // Keep every provider fallback below a conservative transport/request-time
  // budget. Evidence items are never prefix-cut; larger corpora become several
  // complete extraction passes whose structured results are union-merged.
  const packaged = packageEvidenceForExtraction(
    evidenceCorpus,
    cleanName,
    country,
    countryInstruction,
    sizingProviderId,
    settings,
    40_000
  );

  let extractedData: any = {};
  try {
    const runChunk = async (chunk: any[], chunkIdx: number): Promise<any> => {
      const prompt = buildExtractionPrompt(chunk, cleanName, country, countryInstruction, chunkIdx + 1, packaged.chunkCount, settings);
      const aiExtractionRaw = await callAi(prompt, settings);
      const cleanedExtraction = extractJsonBlock(aiExtractionRaw);
      return safeJsonParse(cleanedExtraction, {});
    };
    if (packaged.chunkCount === 1) {
      extractedData = await runChunk(packaged.chunks[0], 0);
    } else {
      const partials: any[] = [];
      for (let i = 0; i < packaged.chunks.length; i++) partials.push(await runChunk(packaged.chunks[i], i));
      extractedData = mergeExtractionResults(partials);
    }
  } catch (e) {
    console.error("AI Information Extraction failed:", e);
  }

  // Step 7: Deterministic Validation & Normalization
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
  
  const rawEmails: string[] = Array.isArray(extractedData.emails) ? extractedData.emails : [];
  const validEmails = Array.from(new Set(rawEmails.map(e => String(e).trim().toLowerCase()).filter(e => emailRegex.test(e))));

  const rawPhones: string[] = Array.isArray(extractedData.phones) ? extractedData.phones : [];
  const validPhones = Array.from(new Set(rawPhones.map(p => String(p).trim()).filter(p => isCountryCompatiblePhone(p, country))));

  const rawFax: string[] = Array.isArray(extractedData.fax_numbers) ? extractedData.fax_numbers : [];
  const validFax = Array.from(new Set(rawFax.map(f => String(f).trim()).filter(f => isCountryCompatiblePhone(f, country))));

  const rawLinkedin: string[] = Array.isArray(extractedData.linkedin_urls) ? extractedData.linkedin_urls : [];
  const validLinkedin = Array.from(new Set(rawLinkedin.map(l => String(l).trim()).filter(l => l.includes('linkedin.com'))));

  const validAddresses: CompanyAddress[] = Array.isArray(extractedData.addresses)
    ? extractedData.addresses
        .map((a: any) => ({
          address: String(a.address || '').trim(),
          type: String(a.type || 'head_office').trim(),
          source_url: String(a.source_url || '').trim()
        }))
        .filter((a: CompanyAddress) => a.address.length > 5)
    : [];

  const validContacts: ContactPerson[] = Array.isArray(extractedData.contact_persons)
    ? extractedData.contact_persons
        .map((cp: any) => ({
          name: String(cp.name || '').trim(),
          designation: String(cp.designation || '').trim(),
          email: String(cp.email || '').trim(),
          phone: String(cp.phone || '').trim(),
          department: String(cp.department || '').trim(),
          country: String(cp.country || '').trim(),
          branch: String(cp.branch || '').trim(),
          linkedin_url: /^https?:\/\/(?:[a-z]{2,3}\.)?linkedin\.com\//i.test(String(cp.linkedin_url || '').trim()) ? String(cp.linkedin_url).trim() : '',
          source_url: String(cp.source_url || '').trim()
        }))
        .filter((cp: ContactPerson) => cp.name.length > 1)
    : [];

  const website = String(extractedData.website || currentWebsite || (evidenceCorpus[0]?.url) || '').trim();
  const primaryEmail = validEmails[0] || (validContacts.find(c => c.email)?.email) || '';
  const primaryPhone = validPhones[0] || (validContacts.find(c => c.phone)?.phone) || '';
  const primaryAddress = validAddresses[0]?.address || '';
  const primaryLinkedin = validLinkedin[0] || '';
  const industry = String(extractedData.industry || '').trim();

  const sources: ContactSource[] = evidenceCorpus.map(e => ({
    url: e.url,
    title: e.title,
    source_type: e.url.includes('linkedin') ? 'social' : e.url.includes(new URL(website || 'https://example.com').hostname) ? 'official_website' : 'directory'
  }));

  const isPartial = !primaryEmail && !primaryPhone && !primaryAddress;

  const resultDetails: ExtractedCompanyDetails = {
    company_name: cleanName,
    website,
    address: primaryAddress,
    phone: primaryPhone,
    email: primaryEmail,
    linkedin: primaryLinkedin,
    industry,
    country,
    fax_numbers: validFax,
    emails_list: validEmails,
    phones_list: validPhones,
    linkedin_urls: validLinkedin,
    addresses: validAddresses,
    contact_persons: validContacts,
    sources,
    isPartial,
    source: 'api'
  };

  recordUsage('pages_analyzed', evidenceCorpus.length);

  const savedResult = await saveEnrichedData(resultDetails);
  logActivity(`Enriched "${cleanName}" (${savedResult.quality_status || 'COMPLETE'}) - ${savedResult.email || savedResult.phone || 'Contact info extracted'}`, cleanName, savedResult.quality_status === 'COMPLETE' ? 'success' : 'info');
  return savedResult;
}
