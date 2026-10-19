import { CompanyResearchState } from './job_manager';
import { ResourceGovernor } from './resource_governor';
import { AppSettings } from './settings';
import { assertSafeHeaderValue } from './utils/header_encoder';
import { executeProviderAwareSearch } from './orchestrator';
import {
  isSafeExternalUrl as isSafeExternalUrlGuard,
  safeFetchOutboundText,
} from './url_safety';
import { 
  callAi, 
  extractJsonBlock, 
  safeJsonParse,
  saveEnrichedData, 
  getCachedCompany,
  normalizeCompanyName,
  logActivity,
  recordUsage
} from './enrichment';
import { getDb } from './sqlite';
import { db as pharmaDb } from './db';
import { ProviderCapabilityRegistry } from './research_fabric';
import { extractHtmlLinkManifest, focusEvidenceForTargetCountry, htmlToEvidenceText, mergeScrapedAndDirectEvidence, preservePageContent } from './page_content';
import { buildEntityScopedEvidence } from './evidence_neighborhood';
import { isPlausibleOfficialCompanyUrlCandidate, isPlausibleOfficialCompanyUrl } from './official_website';
export { isPlausibleOfficialCompanyUrl };

import { applyEnrichmentDetailsToContact } from './contact_projection';
import { getProjectRoot } from './db_paths';

export type ResearchActionType = 
  | 'INITIALIZE'
  | 'PLAN_SEARCH'
  | 'EXECUTE_QUERY'
  | 'EXTRACT_INFORMATION'
  | 'FINALIZE';

export interface ResearchAction {
  type: ResearchActionType;
  queryToRun?: string;
  queryTargetType?: string;
  reason: string;
}

export interface EntityResearchContext {
  entity_key?: string;
  original_company_name?: string;
  country?: string;
  website?: string;
  role?: 'Importer' | 'Exporter';
  target_city?: string;
  source_file_id?: string;
  dataset_id?: string;
  known_address?: string;
  known_products?: string[];
  traded_with?: string[];
  existing_contacts?: { emails?: string[]; phones?: string[] };
  /** Aggregate entity frequency only; raw peer trade rows never enter public queries. */
  trade_feature_entity_frequency?: Record<string, number>;
  trade_feature_recurrence?: Record<string, number>;
  verified_partner_domains?: Record<string, string>;
  deep_recovery?: boolean;
  /** UI/cache websites are candidates until page evidence proves ownership. */
  website_verified?: boolean;
}

function containsCountryAlias(text: string, alias: string): boolean {
  const normalizedText = ` ${String(text || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()} `;
  const normalizedAlias = String(alias || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  return Boolean(normalizedAlias && normalizedText.includes(` ${normalizedAlias} `));
}

export function resolveVerifiedInitialWebsite(context?: EntityResearchContext): string {
  return context?.website_verified === true ? String(context.website || '').trim() : '';
}

export function isSafeExternalUrl(urlStr: string): boolean {
  return isSafeExternalUrlGuard(urlStr);
}

/**
 * Country targeting vocabulary. Canonical country names (lowercase) mapped to
 * the tokens that identify that country in free text: the country name itself,
 * demonyms, and major branch/city signals. Used to make enrichment country-aware
 * (queries, ranking, evidence validation) without hallucinating a branch.
 */
const COUNTRY_TARGET_ALIASES: Record<string, string[]> = {
  'afghanistan': ['afghanistan', 'afghan'],
  'albania': ['albania', 'albanian'],
  'angola': ['angola', 'angolan'],
  'australia': ['australia', 'australian'],
  'azerbaijan': ['azerbaijan', 'azerbaijani'],
  'bahamas': ['bahamas', 'bahamian'],
  'bangladesh': ['bangladesh', 'bangladeshi', 'dhaka'],
  'barbados': ['barbados'],
  'belgium': ['belgium', 'belgian'],
  'belize': ['belize'],
  'benin': ['benin'],
  'botswana': ['botswana'],
  'brunei darussalam': ['brunei'],
  'burundi': ['burundi'],
  'cambodia': ['cambodia', 'cambodian', 'kampuchea'],
  'cameroon': ['cameroon', 'cameroonian'],
  'canada': ['canada', 'canadian'],
  'chad': ['chad'],
  'china': ['china', 'chinese', 'hong kong', 'beijing', 'shanghai'],
  'comoros': ['comoros'],
  'congo': ['congo', 'congolese'],
  'djibouti': ['djibouti'],
  'dominica': ['dominica'],
  'dominican republic': ['dominican republic'],
  'egypt': ['egypt', 'egyptian', 'cairo'],
  'equatorial guinea': ['equatorial guinea'],
  'fiji': ['fiji'],
  'france': ['france', 'french', 'paris'],
  'gambia': ['gambia'],
  'georgia': ['georgia', 'georgian'],
  'germany': ['germany', 'german', 'berlin'],
  'ghana': ['ghana', 'ghanian', 'accra'],
  'greece': ['greece', 'greek'],
  'grenada': ['grenada'],
  'guatemala': ['guatemala'],
  'guinea': ['guinea'],
  'guyana': ['guyana'],
  'honduras': ['honduras'],
  'hong kong': ['hong kong'],
  'iraq': ['iraq', 'iraqi'],
  'italy': ['italy', 'italian'],
  'japan': ['japan', 'japanese', 'tokyo'],
  'jordan': ['jordan', 'jordanian'],
  'kazakhstan': ['kazakhstan', 'kazakhstan', 'kazakistan', 'kazakh'],
  'kenya': ['kenya', 'kenyan', 'nairobi', 'mombasa'],
  'korea': ['korea', 'korean', 'south korea'],
  'kosovo': ['kosovo'],
  'kuwait': ['kuwait', 'kuwaiti'],
  'kyrgyzstan': ['kyrgyzstan', 'kyrgyz', 'kyrzyghistan', 'kirghizstan'],
  'laos': ['laos', 'lao people', 'laotian'],
  'latvia': ['latvia', 'latvian'],
  'lebanon': ['lebanon', 'lebanese'],
  'lesotho': ['lesotho'],
  'liberia': ['liberia'],
  'libya': ['libya', 'libyan'],
  'lithuania': ['lithuania', 'lithuanian'],
  'madagascar': ['madagascar'],
  'malawi': ['malawi', 'malawian', 'lilongwe'],
  'malaysia': ['malaysia', 'malaysian', 'kuala lumpur'],
  'maldives': ['maldives'],
  'mali': ['mali'],
  'mauritania': ['mauritania'],
  'mauritius': ['mauritius'],
  'mexico': ['mexico', 'mexican'],
  'monaco': ['monaco'],
  'mongolia': ['mongolia', 'mongolian'],
  'morocco': ['morocco', 'moroccan'],
  'mozambique': ['mozambique', 'mozambican', 'maputo'],
  'myanmar': ['myanmar', 'burma', 'burmese'],
  'nepal': ['nepal', 'nepali', 'kathmandu'],
  'netherlands': ['netherlands', 'dutch', 'amsterdam'],
  'new zealand': ['new zealand', 'auckland'],
  'niger': ['niger'],
  'nigeria': ['nigeria', 'nigerian', 'lagos', 'abuja'],
  'norway': ['norway', 'norwegian'],
  'oman': ['oman', 'omani'],
  'pakistan': ['pakistan', 'pakistani', 'karachi', 'lahore', 'islamabad', 'korangi'],
  'panama': ['panama', 'panamanian'],
  'papua new guinea': ['papua new guinea'],
  'peru': ['peru', 'peruvian'],
  'philippines': ['philippines', 'philippine', 'filipino', 'manila'],
  'qatar': ['qatar', 'qatari'],
  'rwanda': ['rwanda', 'rwandan', 'kigali'],
  'saudi arabia': ['saudi arabia', 'saudi'],
  'senegal': ['senegal', 'senegalese'],
  'serbia': ['serbia', 'serbian'],
  'seychelles': ['seychelles'],
  'sierra leone': ['sierra leone'],
  'singapore': ['singapore', 'singaporean'],
  'slovakia': ['slovakia', 'slovak'],
  'somalia': ['somalia', 'somali'],
  'south africa': ['south africa', 'south african', 'johannesburg', 'cape town'],
  'south sudan': ['south sudan'],
  'spain': ['spain', 'spanish', 'madrid'],
  'sri lanka': ['sri lanka', 'sri lankan', 'ceylon', 'colombo'],
  'sudan': ['sudan', 'sudanese'],
  'switzerland': ['switzerland', 'swiss', 'zurich'],
  'tajikistan': ['tajikistan', 'tajik', 'tasmania'],
  'tanzania': ['tanzania', 'tanzanian', 'dar es salaam', 'arusha', 'zanzibar'],
  'thailand': ['thailand', 'thai', 'bangkok'],
  'togo': ['togo'],
  'trinidad and tobago': ['trinidad', 'tobago'],
  'tunisia': ['tunisia', 'tunisian'],
  'turkmenistan': ['turkmenistan', 'turkemenistan', 'turkmen'],
  'turkey': ['turkey', 'turkish', 'istanbul'],
  'uganda': ['uganda', 'ugandan', 'kampala'],
  'united arab emirates': ['united arab emirates', 'uae', 'dubai', 'abu dhabi', 'sharjah'],
  'united kingdom': ['united kingdom', 'uk', 'britain', 'british', 'england', 'london'],
  'united states': ['united states', 'usa', 'u.s.a', 'america', 'american'],
  'uzbekistan': ['uzbekistan', 'uzbek'],
  'vietnam': ['viet nam', 'vietnam', 'vietnamese'],
  'west indies': ['west indies'],
  'yemen': ['yemen', 'yemeni'],
  'zambia': ['zambia', 'zambian', 'lusaka'],
};

function normalizeTargetCountry(raw: string): string {
  const c = (raw || '').trim().toLowerCase();
  if (COUNTRY_TARGET_ALIASES[c]) return c;
  for (const [canonical, tokens] of Object.entries(COUNTRY_TARGET_ALIASES)) {
    if (tokens.includes(c)) return canonical;
  }
  return c;
}

/**
 * Detects which countries are mentioned in free text. Returns canonical country
 * names (lowercase) for every matched alias token.
 */
export function detectCountryMentions(text: string): string[] {
  if (!text) return [];
  const found = new Set<string>();
  const entries = Object.entries(COUNTRY_TARGET_ALIASES)
    .sort((a, b) => Math.max(...b[1].map((v) => v.length)) - Math.max(...a[1].map((v) => v.length)));
  for (const [canonical, tokens] of entries) {
    for (const token of tokens) {
      if (token.length >= 2 && containsCountryAlias(text, token)) {
        found.add(canonical);
        break;
      }
    }
  }
  // A specific compound country owns its nested country token. For example,
  // "South Sudan" must not also become Sudan, and "Dominican Republic" must
  // not also become Dominica merely because both aliases are valid alone.
  for (const specific of Array.from(found)) {
    for (const broad of Array.from(found)) {
      if (specific !== broad && ` ${specific} `.includes(` ${broad} `)) found.delete(broad);
    }
  }
  return Array.from(found);
}

/**
 * Country-aware evidence assessment used before admitting scraped content into
 * the evidence corpus. The admission rule is country-scoped: when a target
 * country is provided, evidence that only describes a *different* country's
 * branch is blocked. Company association and geography are both hard factual
 * admission boundaries. Cross-domain authorities must be explicitly typed;
 * country coincidence alone never establishes entity ownership.
 */
export type EvidenceAdmissionDecision = 'ADMIT' | 'REJECT' | 'HOLD';

export interface EvidenceAdmissionOptions {
  sourceType?: 'web' | 'official' | 'candidate_official' | 'authoritative_registry' | 'official_relationship';
  /** Set only when an official target-company source explicitly supports the relationship. */
  relationshipEstablished?: boolean;
  /** Allow HOLD for plausible candidates with partial identity signals */
  allowHold?: boolean;
}

export interface EvidenceAdmissionAssessment {
  admissible: boolean;
  decision: EvidenceAdmissionDecision;
  associationScore: number;
  isAssociated: boolean;
  entityMatch: 'official-domain' | 'explicit-name' | 'authoritative' | 'unestablished';
  countryMatch: 'target' | 'global' | 'foreign';
  targetCountryMatch: boolean;
  foreignCountryMentions: string[];
  reasons: string[];
  /** Positive identity signals found (for HOLD candidates) */
  identitySignals?: string[];
  /** Missing proof needed for ADMIT */
  missingProof?: string[];
}

export function assessEvidenceForCountry(
  content: string,
  url: string,
  companyName: string,
  country?: string,
  officialWebsite?: string,
  options: EvidenceAdmissionOptions = {}
): EvidenceAdmissionAssessment {
  const association = calculateCompanyAssociationScore(content, url, companyName, country, officialWebsite);
  const targetCountry = normalizeTargetCountry(country || '');
  const mentioned = detectCountryMentions(content);

  let foreign = targetCountry
    ? mentioned.filter((m) => m !== targetCountry)
    : [];

  // Never treat a country that is literally part of the company name as foreign
  // (e.g. "GETZ PHARMA INTERNATIONAL FZ-LLC DUBAI" legitimately mentions Dubai).
  const companyLower = (companyName || '').toLowerCase();
  foreign = foreign.filter((m) => {
    const tokens = COUNTRY_TARGET_ALIASES[m] || [m];
    return !tokens.some((t) => t.length >= 2 && companyLower.includes(t));
  });

  const targetCountryMatch = Boolean(targetCountry) && mentioned.includes(targetCountry);
  const geographyCompatible = !(targetCountry && foreign.length > 0 && !targetCountryMatch);

  let officialDomain = false;
  if (officialWebsite) {
    try {
      const officialHost = new URL(officialWebsite).hostname.toLowerCase().replace(/^www\./, '');
      const pageHost = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
      officialDomain = pageHost === officialHost || pageHost.endsWith(`.${officialHost}`);
    } catch (_) {}
  }

  const normalizedCompany = companyName.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const companyTokens = normalizedCompany.split(/\s+/).filter((token) =>
    token.length > 2 && !['pvt', 'ltd', 'limited', 'inc', 'corp', 'gmbh', 'company', 'pharma', 'pharmaceutical', 'pharmaceuticals'].includes(token)
  );
  const normalizedHaystack = `${url} ${content}`.toLowerCase().replace(/[^a-z0-9]+/g, ' ');
  const orderedTokenPattern = companyTokens.length > 1
    ? new RegExp(companyTokens.map((token) => token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('(?:\\s|[^a-z0-9]){0,60}'))
    : null;
  const explicitNameMatch = Boolean(normalizedCompany && normalizedHaystack.includes(normalizedCompany))
    || (companyTokens.length === 1 && normalizedHaystack.includes(companyTokens[0]))
    || Boolean(orderedTokenPattern?.test(normalizedHaystack));
  const authoritative = options.sourceType === 'authoritative_registry' && explicitNameMatch;
  const establishedRelationship = options.sourceType === 'official_relationship'
    && options.relationshipEstablished === true
    && explicitNameMatch;
  const entityEstablished = officialDomain || explicitNameMatch || authoritative || establishedRelationship;

  // Collect identity signals for HOLD candidates
  const identitySignals: string[] = [];
  const missingProof: string[] = [];
  
  if (officialDomain) identitySignals.push('official-domain-match');
  if (explicitNameMatch) identitySignals.push('explicit-ordered-name-match');
  if (authoritative) identitySignals.push('authoritative-registry');
  if (establishedRelationship) identitySignals.push('official-relationship');
  
  // Partial identity signals that support HOLD
  const partialNameMatch = companyTokens.some(t => normalizedHaystack.includes(t));
  if (partialNameMatch && !explicitNameMatch) identitySignals.push('partial-name-token-match');
  
  if (targetCountryMatch) identitySignals.push('target-country-mentioned');
  if (association.score >= 20) identitySignals.push('business-context-match');
  if (association.score >= 40) identitySignals.push('strong-association');
  
  // Check for domain similarity
  let domainSimilarity = false;
  try {
    const pageHost = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
    const companySlug = normalizedCompany.replace(/\s+/g, '');
    if (pageHost.includes(companySlug) || companySlug.includes(pageHost.replace(/\./g, ''))) {
      domainSimilarity = true;
      identitySignals.push('domain-name-similarity');
    }
  } catch (_) {}

  let decision: EvidenceAdmissionDecision = 'ADMIT';
  const reasons = [...association.reasons];
  
  if (!entityEstablished) {
    // Allow HOLD for candidate_official sources or when explicitly allowed with identity signals
    const isCandidateOfficial = options.sourceType === 'candidate_official';
    const allowHold = options.allowHold || isCandidateOfficial;
    const hasIdentitySignals = identitySignals.length > 0;
    
    if (allowHold && (hasIdentitySignals || isCandidateOfficial)) {
      // Plausible candidate with partial identity signals -> HOLD for entity-proof research
      // candidate_official sources get HOLD even without strong identity signals (for backward compatibility)
      decision = 'HOLD';
      reasons.push(isCandidateOfficial
        ? 'Held: candidate official source requires independent entity proof'
        : 'Held: candidate has partial identity signals but requires independent entity proof');
      
      // Track what's missing for full ADMIT
      if (!officialDomain) missingProof.push('official-domain-verification');
      if (!explicitNameMatch) missingProof.push('explicit-ordered-name-match');
      if (!authoritative) missingProof.push('authoritative-registry-corroboration');
      if (!establishedRelationship) missingProof.push('official-relationship-verification');
    } else {
      decision = 'REJECT';
      reasons.push(isCandidateOfficial
        ? 'Rejected: candidate official source could not be verified even with HOLD allowance'
        : 'Rejected: target-company association was not deterministically established');
    }
  } else if (!geographyCompatible) {
    decision = 'REJECT';
    reasons.push('Rejected: evidence describes a foreign branch without the target-country context');
  } else if (authoritative) {
    reasons.push('Admitted: explicitly classified authoritative registry with exact entity match');
  } else if (establishedRelationship) {
    reasons.push('Admitted: official target-company evidence establishes the third-party relationship');
  }

  const entityMatch: EvidenceAdmissionAssessment['entityMatch'] = officialDomain
    ? 'official-domain'
    : authoritative || establishedRelationship
      ? 'authoritative'
      : explicitNameMatch
        ? 'explicit-name'
        : 'unestablished';
  const countryMatch: EvidenceAdmissionAssessment['countryMatch'] = !geographyCompatible
    ? 'foreign'
    : targetCountryMatch
      ? 'target'
      : 'global';

  return {
    admissible: decision === 'ADMIT',
    decision,
    associationScore: association.score,
    isAssociated: entityEstablished,
    entityMatch,
    countryMatch,
    targetCountryMatch,
    foreignCountryMentions: foreign,
    reasons,
    identitySignals,
    missingProof,
  };
}

export interface RankedSearchResult {
  title: string;
  link: string;
  snippet: string;
  domain: string;
  score: number;
  reason: string;
}

export function focusEvidenceForCompany(content: string, companyName: string, radius = 1200): string {
  const tokens = String(companyName || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/)
    .filter((token) => token.length > 2 && !['pvt', 'ltd', 'limited', 'inc', 'corp', 'gmbh', 'company'].includes(token));
  if (!content || tokens.length === 0) return content;
  const pattern = new RegExp(tokens.map((token) => token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[\\s\\S]{0,60}'), 'ig');
  const ranges: Array<[number, number]> = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(content)) && ranges.length < 8) {
    ranges.push([Math.max(0, match.index - radius), Math.min(content.length, match.index + match[0].length + radius)]);
  }
  if (ranges.length === 0) return content;
  return ranges.map(([start, end]) => content.slice(start, end)).join('\n\n[ENTITY CONTEXT WINDOW]\n\n');
}


function isPlaceholderFact(value: unknown): boolean {
  return /^(?:not\s+(?:answerable|available|found)|unknown|none|null|n\/?a|unavailable)$/i.test(String(value || '').trim());
}

/**
 * Extract phone numbers from evidence text using regex patterns.
 */
export function extractPhonesFromEvidenceText(text: string): string[] {
  if (!text) return [];
  const phoneRegex = /(?:\+?\d{1,3}[\s.-]?)?(?:\(\d{1,4}\)[\s.-]?)?\d{2,4}[\s.-]?\d{2,4}[\s.-]?\d{2,4}(?:[\s.-]?\d{1,4})?/g;
  const matches = text.match(phoneRegex) || [];
  // Filter to plausible phone numbers (at least 7 digits)
  return matches
    .map(m => m.trim())
    .filter(m => m.replace(/\D/g, '').length >= 7)
    .filter((m, i, arr) => arr.indexOf(m) === i); // deduplicate
}

/**
 * Extract email addresses from evidence text using regex patterns.
 */
export function extractEmailsFromEvidenceText(text: string): string[] {
  if (!text) return [];
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const matches = text.replace(/\\([_.%+@-])/g, '$1').match(emailRegex) || [];
  return matches
    .map(m => m.trim())
    .filter((m, i, arr) => arr.findIndex((candidate) => candidate.toLowerCase() === m.toLowerCase()) === i); // deduplicate
}

/**
 * Extract addresses from evidence text using heuristics.
 */
export function extractAddressesFromEvidenceText(text: string): Array<{ address: string; type?: string; source_url?: string }> {
  if (!text) return [];
  const addresses: Array<{ address: string; type?: string; source_url?: string }> = [];
  
  // Pattern for structured addresses (multi-line with common address keywords)
  const addressKeywords = /\b(?:head\s+office|corporate\s+office|branch\s+office|registered\s+office|tender\s+office|regulatory\s+office|headquarters|office|address|location|street|road|avenue|drive|lane|boulevard|way|place|court|suite|floor|building|tower|plaza|center|park)\b/gi;
  
  // Split into paragraphs and look for address-like content
  const paragraphs = text.split(/\n\s*\n/);
  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (trimmed.length < 15 || trimmed.length > 500) continue;
    if (!addressKeywords.test(trimmed)) continue;
    
    // Check for postal code patterns or country names
    const hasPostalCode = /\b\d{4,6}\b/.test(trimmed);
    const hasCountry = /\b(?:Sri Lanka|Kenya|Somalia|Sudan|Ghana|Nigeria|Uganda|Tanzania|Pakistan|India|Bangladesh|Sri\s+Lanka)\b/i.test(trimmed);
    if (hasPostalCode || hasCountry) {
      addresses.push({ address: trimmed, type: 'office' });
    }
  }
  
  // Also look for address patterns in structured data (schema.org, JSON-LD)
  const jsonLdMatches = text.match(/"address"\s*:\s*\{[^}]+\}/gi) || [];
  for (const match of jsonLdMatches) {
    try {
      const obj = JSON.parse(match);
      if (obj.streetAddress || obj.addressLocality || obj.addressRegion || obj.postalCode) {
        const addr = [obj.streetAddress, obj.addressLocality, obj.addressRegion, obj.postalCode, obj.addressCountry]
          .filter(Boolean).join(', ');
        addresses.push({ address: addr, type: 'structured' });
      }
    } catch (_) {}
  }
  
  // Deduplicate
  const seen = new Set<string>();
  return addresses.filter(a => {
    const key = a.address.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Extract people/leadership from evidence text using heuristics.
 */
export function extractPeopleFromEvidenceText(text: string, companyName: string): Array<{ name: string; designation?: string; email?: string; phone?: string; department?: string; country?: string; branch?: string; linkedin_url?: string }> {
  if (!text) return [];
  const people: Array<{ name: string; designation?: string; email?: string; phone?: string; department?: string; country?: string; branch?: string; linkedin_url?: string }> = [];
  
  // Title patterns for leadership roles
  const titlePatterns = [
    /\b(?:CEO|CTO|CFO|COO|CMO|CIO|CHRO|CSO|CISO|President|Vice\s+President|VP|Managing\s+Director|General\s+Manager|Country\s+Manager|Regional\s+Manager|Director|Chairman|Chairperson|Founder|Co-founder|Co\s+Founder|Partner|Principal|Head\s+of|Lead|Manager|Supervisor|Coordinator)\b/gi,
    /\b(?:Chief\s+(?:Executive|Technology|Financial|Operating|Marketing|Information|Human\s+Resources|Security|Compliance|Strategy)\s+Officer)\b/gi
  ];
  
  // Look for name + title patterns in text
  const lines = text.split(/\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length < 5 || trimmed.length > 200) continue;
    
    for (const pattern of titlePatterns) {
      const matches = [...trimmed.matchAll(pattern)];
      if (matches.length > 0) {
        // Try to extract name before/after title
        for (const match of matches) {
          const titleStart = match.index;
          const beforeTitle = trimmed.substring(0, titleStart).trim();
          const afterTitle = trimmed.substring(titleStart + match[0].length).trim();
          
          // Try to extract name (capitalized words before title)
          const nameMatch = beforeTitle.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})$/);
          if (nameMatch) {
            people.push({
              name: nameMatch[1],
              designation: match[0]
            });
          } else if (afterTitle) {
            // Name might be after title: "CEO John Smith"
            const nameMatch2 = afterTitle.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})/);
            if (nameMatch2) {
              people.push({
                name: nameMatch2[1],
                designation: match[0]
              });
            }
          }
        }
      }
    }
  }
  
  // Also look for "Name - Title" or "Name: Title" patterns
  const nameTitlePattern = /([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})\s*[\-:]\s*([A-Z][a-z\s]+)/g;
  for (const match of text.matchAll(nameTitlePattern)) {
    const name = match[1].trim();
    const designation = match[2].trim();
    if (designation.length > 2 && /[A-Z]/.test(designation)) {
      people.push({ name, designation });
    }
  }

  // Normalized management pages commonly render a card as two adjacent lines:
  // the person's name followed by the role (or vice versa).
  const nonEmptyLines = lines.map((line) => line.trim()).filter(Boolean);
  const personName = /^[A-Z][A-Za-z'.-]+(?:\s+[A-Z][A-Za-z'.-]+){1,3}$/;
  const corporateTitle = /^(?:CEO|CTO|CFO|COO|CMO|CIO|CHRO|CSO|CISO|President|Vice\s+President|VP|Managing\s+Director|General\s+Manager|Country\s+Manager|Regional\s+Manager|Director|Chairman|Chairperson|Founder|Co-founder|Partner|Principal|Head\s+of\s+.+)$/i;
  for (let i = 0; i < nonEmptyLines.length - 1; i++) {
    const first = nonEmptyLines[i];
    const second = nonEmptyLines[i + 1];
    if (personName.test(first) && corporateTitle.test(second)) people.push({ name: first, designation: second });
    if (corporateTitle.test(first) && personName.test(second)) people.push({ name: second, designation: first });
  }
  
  // Deduplicate
  const seen = new Set<string>();
  return people.filter(p => {
    const key = p.name.toLowerCase() + '|' + (p.designation || '').toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function addDeterministicEvidenceFacts(
  graph: { addFact: (...args: any[]) => void },
  corpus: Array<{ url?: string; content?: string }>,
  companyName: string,
  officialWebsite = ''
): { emails: number; phones: number; addresses: number; people: number } {
  const counts = { emails: 0, phones: 0, addresses: 0, people: 0 };
  let officialHost = '';
  try { officialHost = new URL(officialWebsite).hostname.toLowerCase().replace(/^www\./, ''); } catch (_) {}

  for (const item of corpus || []) {
    const url = String(item?.url || '');
    const content = String(item?.content || '');
    let itemHost = '';
    try { itemHost = new URL(url).hostname.toLowerCase().replace(/^www\./, ''); } catch (_) {}
    const isOfficial = Boolean(itemHost && officialHost && isSameCompanyHost(itemHost, officialHost))
      || isPlausibleOfficialCompanyUrl(url, companyName);
    if (!isOfficial) continue;

    for (const email of rankAttributedEmails(extractEmailsFromEvidenceText(content), 8)) {
      graph.addFact('email', email.toLowerCase(), url, 'deterministic_official_site', 'REG_EX_SCANNER', 0.85);
      counts.emails++;
    }
    for (const phone of extractPhonesFromEvidenceText(content)) {
      graph.addFact('phone', phone, url, 'deterministic_official_site', 'REG_EX_SCANNER', 0.8);
      counts.phones++;
    }
    for (const address of extractAddressesFromEvidenceText(content)) {
      graph.addFact('address', { ...address, source_url: url }, url, 'deterministic_official_site', 'STRUCTURED_CONTACT', 0.8);
      counts.addresses++;
    }
    for (const person of extractPeopleFromEvidenceText(content, companyName)) {
      if (!isValidCorporateContactPerson(person)) continue;
      graph.addFact('contact_person', { ...person, source_url: url }, url, 'deterministic_official_site', 'STRUCTURED_CONTACT', 0.75);
      counts.people++;
    }
  }
  return counts;
}

/**
 * Validate if a person object represents a legitimate corporate contact.
 */
export function isValidCorporateContactPerson(person: any): boolean {
  if (!person || !person.name || typeof person.name !== 'string') return false;
  const name = person.name.trim();
  if (name.length < 3 || name.length > 100) return false;
  // Must have at least two words (first + last name)
  if (!/\s/.test(name)) return false;
  // Reject obvious non-person patterns
  if (/^(?:the|our|your|this|that|all|any|each|every|some|many|few|several|various|different)\b/i.test(name)) return false;
  if (/\b(?:company|corporation|inc|ltd|limited|llc|group|holdings|international|global|pharma|pharmaceutical|pharmacy|medical|health|care|solutions|services|systems|technologies|technologies|industries|enterprises|trading|import|export|distribution|logistics|supply|chain|management|consulting|advisory|partners|associates|capital|ventures|investments|finance|bank|insurance|real\s+estate|construction|engineering|energy|power|oil|gas|mining|chemical|chemicals|materials|material|food|beverage|retail|wholesale|e-commerce|ecommerce|online|digital|tech|technology|software|it|information|data|analytics|ai|ml|cloud|security|cyber|network|telecom|telecommunications|media|marketing|advertising|brand|creative|design|studio|agency|firm|law|legal|accounting|audit|tax|hr|human\s+resources|recruitment|staffing|training|education|university|college|school|institute|hospital|clinic|medical|dental|veterinary|pharmacy|drug|biotech|biotechnology|life\s+sciences|research|development|r&d|lab|laboratory|testing|quality|assurance|compliance|regulatory|affairs|government|public|private|non-profit|ngo|foundation|association|society|club|organization|org|org\.)\b/i.test(name)) return false;
  // Must have at least one capitalized word
  if (!/[A-Z]/.test(name)) return false;
  return true;
}

export function rankSearchResults(
  organicResults: any[],
  companyName: string,
  targetType: string,
  currentWebsite?: string,
  country?: string
): RankedSearchResult[] {
  const normCompany = companyName.toLowerCase().replace(/[^a-z0-9]/g, '');
  const targetCanonical = normalizeTargetCountry(country || '');

  return organicResults
    .filter((item) => item && item.link && isSafeExternalUrl(item.link))
    .map((item) => {
      let score = 0;
      const reasons: string[] = [];
      const link = String(item.link || '');
      const title = String(item.title || '');
      const snippet = String(item.snippet || '');
      const lowerLink = link.toLowerCase();
      const lowerTitle = title.toLowerCase();
      const lowerSnippet = snippet.toLowerCase();
      const searchableText = `${title} ${snippet} ${link}`.toLowerCase();

      try {
        const parsed = new URL(link);
        const host = parsed.hostname.toLowerCase();
        const path = parsed.pathname.toLowerCase();
        const normHost = host.replace(/[^a-z0-9]/g, '');

        // 1. Official domain bonus
        if (currentWebsite) {
          try {
            const currHost = new URL(currentWebsite).hostname.toLowerCase();
            if (host === currHost || host.endsWith('.' + currHost)) {
              score += 10.0;
              reasons.push('Matches official company domain');
            }
          } catch (_) {}
        } else if (normCompany.length > 3 && normHost.includes(normCompany)) {
          score += 8.0;
          reasons.push('Domain contains company name');
        }

        // 2. High-value path keywords
        if (/(contact|about|management|leadership|team|executive|export|sales|locations|offices|branches|distributors)/.test(path)) {
          score += 6.0;
          reasons.push(`High-value path (${path})`);
        }

        // 3. Snippet relevance
        if (/(email|phone|contact|headquarters|address|ceo|president|founder|director|manager)/.test(lowerSnippet) || /(email|phone|contact|ceo|president|director)/.test(lowerTitle)) {
          score += 4.0;
          reasons.push('Snippet contains contact/leadership evidence');
        }

        // 4. Registry / Directory domain handling
        const isDirectory = /(dnb\.com|bloomberg\.com|crunchbase\.com|zoominfo\.com|gov\.uk|tradekey\.com|indiamart\.com|panjiva\.com|importgenius\.com|volza\.com|tendata\.com|marketinsidedata\.com|tradeatlas\.com|eximpedia\.app|seair\.co\.in|rocketreach\.co|thomasnet\.com|kompass\.com)/.test(host);
        if (isDirectory) {
          score -= 2.0;
          reasons.push('Directory/trade-data source (deprioritized for official site)');
        }
        // Recognized authoritative registries still get a small boost
        else if (/(dnb\.com|bloomberg\.com|gov\.uk)/.test(host)) {
          score += 1.0;
          reasons.push('Authoritative registry');
        }

        // 5. Target-type specific boost
        if (targetType === 'official_website' && (path === '/' || path === '' || path.includes('contact') || path.includes('about'))) {
          score += 3.0;
        } else if (targetType === 'leadership' && /(linkedin\.com|leadership|management|team|ceo|president|director)/.test(lowerLink + lowerTitle)) {
          score += 4.0;
        }

        // 6. Social media penalty if searching for official website
        if ((host.includes('facebook.com') || host.includes('twitter.com') || host.includes('instagram.com')) && targetType === 'official_website') {
          score -= 3.0;
          reasons.push('Social media deprioritized for official website');
        }

        // 7. Country-aware ranking: prefer results tied to the target country's
        // branch and demote results that only reference a different country.
        if (targetCanonical) {
          const mentioned = detectCountryMentions(searchableText);
          const targetMentioned = mentioned.includes(targetCanonical);
          if (targetMentioned) {
            score += 6.0;
            reasons.push(`Matches target country branch (${country})`);
          } else {
            const foreign = mentioned.filter((m) => m !== targetCanonical);
            if (foreign.length > 0) {
              score -= 4.0;
              reasons.push(`References other country (${foreign.join(', ')}), not target ${country}`);
            }
          }
        }
      } catch (_) {}

      return {
        title,
        link,
        snippet,
        domain: item.domain || '',
        score,
        reason: reasons.join('; ') || 'Standard search result'
      };
    })
    .sort((a, b) => b.score - a.score);
}

export function discoverInternalLinks(
  content: string,
  baseUrl: string,
  companyName: string,
  country?: string
): { url: string; score: number; label: string }[] {
  if (!content || !baseUrl || !isSafeExternalUrl(baseUrl)) return [];

  const targetCanonical = normalizeTargetCountry(country || '');
  const countryTokens = targetCanonical ? (COUNTRY_TARGET_ALIASES[targetCanonical] || []) : [];

  const discoveredMap = new Map<string, { url: string; score: number; label: string }>();

  try {
    const baseParsed = new URL(baseUrl);
    const baseHost = baseParsed.hostname.toLowerCase();

    // Match raw HTML hrefs and Markdown links while retaining the anchor label.
    // The label matters for legacy CMS routes such as `?page_id=2`, whose URL
    // alone does not reveal that it is the official Contact Us page.
    const hrefRegex = /(?:<a\b[^>]*href\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))[^>]*>([\s\S]*?)<\/a>|\[([^\]]+)\]\(([^)]+)\))/gi;
    let match: RegExpExecArray | null;

    while ((match = hrefRegex.exec(content)) !== null) {
      const rawUrl = match[1] || match[2] || match[3] || match[6];
      const anchorLabel = String(match[4] || match[5] || '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (!rawUrl || rawUrl.startsWith('#') || rawUrl.startsWith('javascript:') || rawUrl.startsWith('mailto:') || rawUrl.startsWith('tel:')) {
        continue;
      }

      try {
        const resolved = new URL(rawUrl, baseUrl);
        if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') continue;

        const resHost = resolved.hostname.toLowerCase();
        // Ensure same origin or same root domain
        if (resHost !== baseHost && !resHost.endsWith('.' + baseHost) && !baseHost.endsWith('.' + resHost)) {
          continue;
        }

        resolved.hash = '';
        const pathAndQuery = `${resolved.pathname} ${resolved.search} ${anchorLabel}`.toLowerCase();
        const fullUrl = resolved.toString();

        let score = 0;
        let label = 'Internal Link';

        // Country-branch links (e.g. /kenya/, /nairobi/, /ke/) are high-value
        // when we are targeting that specific country's importer operation.
        if (countryTokens.length > 0 && countryTokens.some((t) => t.length >= 3 && pathAndQuery.includes(t))) {
          score = 11.0;
          label = `${country} Branch Page`;
        } else if (/(contact|contact-us|contactus|get-in-touch)/.test(pathAndQuery)) {
          score = 10.0;
          label = 'Contact Page';
        } else if (/(about|about-us|who-we-are|company-profile|profile)/.test(pathAndQuery)) {
          score = 8.0;
          label = 'About Page';
        } else if (/(management|leadership|board|executives|team|directors|key-people)/.test(pathAndQuery)) {
          score = 9.0;
          label = 'Leadership Page';
        } else if (/(export|import|sales|commercial|procurement|supply-chain|logistics|distribution|distributors|locations|offices|branches|warehouse|manufactur|factories)/.test(pathAndQuery)) {
          score = 7.0;
          label = 'Business Operations Page';
        }

        if (score > 0) {
          discoveredMap.set(fullUrl, { url: fullUrl, score, label });
        }
      } catch (_) {}
    }
  } catch (_) {}

  return Array.from(discoveredMap.values()).sort((a, b) => b.score - a.score);
}

/** Select a small, diverse set so branch/contact pages cannot crowd out leadership. */
export function selectHighValueInternalLinks(
  links: { url: string; score: number; label: string }[],
  maxLinks: number = 3
): { url: string; score: number; label: string }[] {
  if (!Array.isArray(links) || maxLinks <= 0) return [];
  const selected: typeof links = [];
  const add = (link: (typeof links)[number] | undefined) => {
    if (link && !selected.some((item) => item.url === link.url) && selected.length < maxLinks) selected.push(link);
  };
  add(links.find((link) => /branch|operations/i.test(link.label)));
  add(links.find((link) => /contact/i.test(link.label)));
  add(links.find((link) => /leadership/i.test(link.label)));
  add(links.find((link) => /about/i.test(link.label)));
  for (const link of links) add(link);
  return selected.sort((a, b) => b.score - a.score);
}

/** Prefer operational mailboxes while retaining a strict per-page budget. */
export function rankAttributedEmails(emails: string[], maxEmails: number = 8): string[] {
  const priority = /^(info|contact|sales|commercial|business|businessdevelopment|bd|procurement|purchase|purchasing|supplychain|import|export|marketing|office|admin|support)([._+-]|$)/i;
  return Array.from(new Set((emails || []).map((email) => String(email).trim().toLowerCase()).filter(Boolean)))
    .map((email, index) => ({ email, index, score: priority.test(email.split('@')[0] || '') ? 1 : 0 }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, Math.max(1, maxEmails))
    .map(({ email }) => email);
}

export function isSameCompanyHost(candidateHost: string, targetHost: string): boolean {
  const normalize = (host: string) => String(host || '').trim().toLowerCase().replace(/^www\./, '').replace(/\.$/, '');
  const candidate = normalize(candidateHost);
  const target = normalize(targetHost);
  return Boolean(candidate && target && (candidate === target || candidate.endsWith(`.${target}`)));
}

export function shouldAdmitRegexEmailSource(itemHost: string, targetHost: string): boolean {
  return !String(targetHost || '').trim() || isSameCompanyHost(itemHost, targetHost);
}

export function findExactEmailSourceUrl(
  corpus: Array<{ url?: string; content?: string }>,
  email: string
): string {
  const target = String(email || '').trim().toLowerCase();
  if (!target) return '';
  for (const item of corpus || []) {
    const discovered = extractEmailsFromEvidenceText(String(item?.content || ''));
    if (discovered.some((value) => value.toLowerCase() === target)) return String(item?.url || '');
  }
  return '';
}

export interface CompanyAssociationResult {
  score: number;
  isAssociated: boolean;
  reasons: string[];
}

export function calculateCompanyAssociationScore(
  content: string,
  url: string,
  companyName: string,
  country?: string,
  officialWebsite?: string
): CompanyAssociationResult {
  if (!content || !companyName) {
    return { score: 0, isAssociated: false, reasons: ['Empty content or company name'] };
  }

  let score = 0;
  const reasons: string[] = [];
  const lowerContent = content.toLowerCase();
  const cleanComp = companyName.toLowerCase().replace(/[^a-z0-9]/g, ' ').trim();
  const tokens = cleanComp.split(/\s+/).filter(t => t.length > 2 && !['pvt', 'ltd', 'limited', 'inc', 'corp', 'gmbh', 'co', 'sa'].includes(t));

  // 1. Official domain match (+10)
  if (officialWebsite) {
    try {
      const officialHost = new URL(officialWebsite).hostname.toLowerCase();
      const pageHost = new URL(url).hostname.toLowerCase();
      if (pageHost === officialHost || pageHost.endsWith('.' + officialHost)) {
        score += 10.0;
        reasons.push('Scraped page is on official company domain');
      }
    } catch (_) {}
  }

  // 2. Full company name presence (+8)
  if (lowerContent.includes(cleanComp)) {
    score += 8.0;
    reasons.push('Full company name explicitly present in page text');
  } else if (tokens.length > 0 && tokens.every(t => lowerContent.includes(t))) {
    score += 6.0;
    reasons.push('All core company name tokens present in page text');
  } else if (tokens.length > 0 && tokens.some(t => lowerContent.includes(t))) {
    score += 2.0;
    reasons.push('Partial company name tokens present in page text');
  } else {
    score -= 5.0;
    reasons.push('Target company name tokens absent from page text');
  }

  // 3. Country match bonus (+4)
  if (country && country.trim().length > 2) {
    const cleanCountry = country.toLowerCase().trim();
    if (lowerContent.includes(cleanCountry)) {
      score += 4.0;
      reasons.push(`Target country (${country}) present in page text`);
    }
  }

  // 3b. Foreign-country demotion: when targeting a specific country branch,
  // evidence that only references a *different* country (and never the target)
  // must not be promoted as target-country information. Countries embedded in
  // the company name itself are never treated as foreign.
  const targetCanonical = normalizeTargetCountry(country || '');
  if (targetCanonical) {
    const mentioned = detectCountryMentions(lowerContent);
    const targetMentioned = mentioned.includes(targetCanonical);
    let foreign = mentioned.filter((m) => m !== targetCanonical);
    const companyLower = companyName.toLowerCase();
    foreign = foreign.filter((m) => {
      const tokens = COUNTRY_TARGET_ALIASES[m] || [m];
      return !tokens.some((t) => t.length >= 2 && companyLower.includes(t));
    });
    if (foreign.length > 0 && !targetMentioned) {
      score -= 6.0;
      reasons.push(`Evidence references other country (${foreign.join(', ')}) while targeting ${country}`);
    }
  }

  // 4. Academic / University penalty (-10)
  try {
    const parsedUrl = new URL(url);
    const host = parsedUrl.hostname.toLowerCase();
    const isAcademicDomain = host.endsWith('.edu') || host.includes('.ac.') || host.endsWith('.sch.uk');
    const isAcademicContent = /(university|faculty|registrar|academic|college|student|professor|lecturer)/.test(lowerContent);

    if (isAcademicDomain || isAcademicContent) {
      const hasCorporateLeadership = /(ceo|managing director|president|chairman|export manager|sales director|founder)/.test(lowerContent);
      if (!hasCorporateLeadership) {
        score -= 10.0;
        reasons.push('Academic/University page without explicit corporate leadership association');
      }
    }
  } catch (_) {}

  const isAssociated = score >= 4.0;
  return { score, isAssociated, reasons };
}

/** Contact completeness is necessary but not sufficient for research coverage. */
export function isResearchCoverageComplete(objectives: Record<string, any>): boolean {
  const satisfied = (key: string) => objectives?.[key]?.status === 'SATISFIED';
  const sourceCount = Number(objectives?.IDENTITY?.sourceCount || 0);
  return satisfied('IDENTITY')
    && satisfied('OFFICIAL_WEBSITE')
    && satisfied('CONTACT')
    && satisfied('ADDRESS')
    && satisfied('LEADERSHIP')
    && sourceCount >= 2;
}

export class ResearchDirector {

  /**
   * Evaluates the current evidence corpus and sets explicit research objective state dynamically.
   */
  public static evaluateObjectives(
    companyState: CompanyResearchState,
    extraContext?: EntityResearchContext
  ): Record<string, any> {
    const state = companyState as any;
    const details = state.extractedDetails || {};
    const corpus = state.evidenceCorpus || [];
    const objectives: Record<string, any> = {};

    const getSourceCount = () => {
      const hosts = corpus.map((e: any) => {
        try { return new URL(e.url).hostname.toLowerCase().replace(/^www\./, ''); } catch { return ''; }
      }).filter(Boolean);
      return new Set(hosts).size;
    };

    const hasEmail = Boolean(details.email || (details.emails_list && details.emails_list.length > 0));
    const hasPhone = Boolean(details.phone || (details.phones_list && details.phones_list.length > 0));
    const hasAddress = Boolean(details.address || (details.addresses && details.addresses.length > 0));
    const entityProofResult = String(state.entityProof?.result || details.entity_proof?.result || 'UNRESOLVED');
    const supportedProof = ['TRADE_ENTITY_SUPPORTED', 'BUSINESS_ENTITY_SUPPORTED', 'LEGAL_ENTITY_SUPPORTED', 'OFFICIAL_WEB_IDENTITY_SUPPORTED'].includes(entityProofResult);
    const identityContradicted = entityProofResult === 'REJECTED';
    const officialWebsiteProven = extraContext?.website_verified === true || entityProofResult === 'OFFICIAL_WEB_IDENTITY_SUPPORTED';
    const hasWebsite = Boolean(officialWebsiteProven && (details.website || state.currentWebsite || extraContext?.website));
    const hasLeadership = Boolean((details.contact_persons && details.contact_persons.length > 0) || (details.decision_makers && details.decision_makers.length > 0));
    const hasDmContacts = Boolean(details.contact_persons && details.contact_persons.some((cp: any) => cp.email || cp.phone));
    const hasSocials = Boolean(details.linkedin || (details.linkedin_urls && details.linkedin_urls.length > 0) || (details.socials && details.socials.length > 0));
    const hasDesc = Boolean(details.industry || details.company_description);
    const hasTrade = Boolean(extraContext?.role || (details.trade_relationships && details.trade_relationships.length > 0));
    const sourceCount = getSourceCount();

    // 1. IDENTITY
    objectives['IDENTITY'] = {
      status: supportedProof || extraContext?.website_verified === true ? 'SATISFIED' : (identityContradicted ? 'FAILED' : 'PARTIAL'),
      proof_status: supportedProof || extraContext?.website_verified === true ? 'PROVEN' : (identityContradicted ? 'CONTRADICTED' : (corpus.length ? 'PARTIAL' : 'UNPROVEN')),
      confidence: supportedProof || extraContext?.website_verified === true ? 0.9 : (corpus.length ? 0.35 : 0.0),
      evidenceCount: corpus.length,
      sourceCount,
      lastAttemptedAction: state.lastAction || 'Initialization',
      remainingHypotheses: []
    };

    // 2. OFFICIAL_WEBSITE
    objectives['OFFICIAL_WEBSITE'] = {
      status: hasWebsite ? 'SATISFIED' : ((state.currentWebsite || details.website) ? 'PARTIAL' : (state.plannedQueries?.some((q: any) => q.target_type === 'official_website' && q.status === 'completed') ? 'FAILED' : 'UNKNOWN')),
      confidence: hasWebsite ? 0.9 : 0.0,
      evidenceCount: corpus.filter((c: any) => !c.url.includes('linkedin.com') && !c.url.includes('facebook.com')).length,
      sourceCount,
      lastAttemptedAction: state.lastAction || 'Domain Discovery',
      remainingHypotheses: hasWebsite ? [] : ['Search alternative domain registrars', 'Perform name-based search with TLD extensions']
    };

    // 3. CONTACT
    objectives['CONTACT'] = {
      status: (hasEmail && hasPhone) ? 'SATISFIED' : ((hasEmail || hasPhone) ? 'PARTIAL' : 'UNKNOWN'),
      confidence: (hasEmail && hasPhone) ? 0.85 : ((hasEmail || hasPhone) ? 0.5 : 0.0),
      evidenceCount: corpus.length,
      sourceCount,
      lastAttemptedAction: state.lastAction || 'Contact Discovery',
      remainingHypotheses: (hasEmail && hasPhone) ? [] : ['Scan official contact pages', 'Query generic business registry directories']
    };

    // 4. ADDRESS
    objectives['ADDRESS'] = {
      status: hasAddress ? 'SATISFIED' : 'UNKNOWN',
      confidence: hasAddress ? 0.85 : 0.0,
      evidenceCount: corpus.length,
      sourceCount,
      lastAttemptedAction: state.lastAction || 'Address Discovery',
      remainingHypotheses: hasAddress ? [] : ['Parse contact page footer', 'Query official business registration filings']
    };

    // 5. EMAIL
    objectives['EMAIL'] = {
      status: hasEmail ? 'SATISFIED' : 'UNKNOWN',
      confidence: hasEmail ? 0.85 : 0.0,
      evidenceCount: corpus.length,
      sourceCount,
      lastAttemptedAction: state.lastAction || 'Email Discovery',
      remainingHypotheses: hasEmail ? [] : ['Search pattern intelligence repositories', 'Identify contact form email endpoints']
    };

    // 6. PHONE
    objectives['PHONE'] = {
      status: hasPhone ? 'SATISFIED' : 'UNKNOWN',
      confidence: hasPhone ? 0.85 : 0.0,
      evidenceCount: corpus.length,
      sourceCount,
      lastAttemptedAction: state.lastAction || 'Phone Discovery',
      remainingHypotheses: hasPhone ? [] : ['Search footer for phone tags', 'Parse registration numbers']
    };

    // 7. LEADERSHIP
    objectives['LEADERSHIP'] = {
      status: hasLeadership ? 'SATISFIED' : 'UNKNOWN',
      confidence: hasLeadership ? 0.8 : 0.0,
      evidenceCount: corpus.length,
      sourceCount,
      lastAttemptedAction: state.lastAction || 'Leadership Discovery',
      remainingHypotheses: hasLeadership ? [] : ['Search LinkedIn profiles with executive keywords', 'Scan "About Us" and "Team" pages']
    };

    // 8. DECISION_MAKER_CONTACTS
    objectives['DECISION_MAKER_CONTACTS'] = {
      status: hasDmContacts ? 'SATISFIED' : (hasLeadership ? 'PARTIAL' : 'UNKNOWN'),
      confidence: hasDmContacts ? 0.8 : 0.0,
      evidenceCount: corpus.length,
      sourceCount,
      lastAttemptedAction: state.lastAction || 'Executive Contact Search',
      remainingHypotheses: hasDmContacts ? [] : ['Perform executive email pattern interpolation', 'Check Hunter API context']
    };

    // 9. SOCIAL_PROFILES
    objectives['SOCIAL_PROFILES'] = {
      status: hasSocials ? 'SATISFIED' : 'UNKNOWN',
      confidence: hasSocials ? 0.9 : 0.0,
      evidenceCount: corpus.filter((c: any) => c.url.includes('linkedin.com') || c.url.includes('facebook.com')).length,
      sourceCount,
      lastAttemptedAction: state.lastAction || 'Social Discovery',
      remainingHypotheses: hasSocials ? [] : ['Search professional business networks']
    };

    // 10. COMPANY_DESCRIPTION
    objectives['COMPANY_DESCRIPTION'] = {
      status: hasDesc ? 'SATISFIED' : 'UNKNOWN',
      confidence: hasDesc ? 0.8 : 0.0,
      evidenceCount: corpus.length,
      sourceCount,
      lastAttemptedAction: state.lastAction || 'Description Mining',
      remainingHypotheses: hasDesc ? [] : ['Mine homepage snippet meta tag']
    };

    // 11. TRADE_RELATIONSHIPS
    objectives['TRADE_RELATIONSHIPS'] = {
      status: hasTrade ? 'SATISFIED' : 'UNKNOWN',
      confidence: hasTrade ? 0.85 : 0.0,
      evidenceCount: corpus.length,
      sourceCount,
      lastAttemptedAction: state.lastAction || 'Trade Context Discovery',
      remainingHypotheses: hasTrade ? [] : ['Analyze importer/exporter shipment bills of lading']
    };

    // 12. SOURCE_VERIFICATION
    objectives['SOURCE_VERIFICATION'] = {
      status: sourceCount >= 2 ? 'SATISFIED' : (sourceCount === 1 ? 'PARTIAL' : 'UNKNOWN'),
      confidence: sourceCount >= 2 ? 0.9 : 0.4,
      evidenceCount: corpus.length,
      sourceCount,
      lastAttemptedAction: state.lastAction || 'Verification',
      remainingHypotheses: sourceCount >= 2 ? [] : ['Execute secondary search queries to find independent confirmation sites']
    };

    companyState.objectives = objectives;
    return objectives;
  }

  /**
   * Evaluates task proposal utility based on expected information gain vs provider costs.
   */
  public static calculateActionUtility(
    task: { targetType: string; query: string; providerId: string; reason: string },
    objectives: Record<string, any>,
    settings: AppSettings
  ): number {
    let expectedInfoGain = 0;
    let evidenceQualityImprovement = 0;
    let objectiveCoverageImprovement = 0;
    let verificationValue = 0;

    const target = task.targetType || (task as any).target_type;
    const providerId = task.providerId || (task as any).provider_id;

    if (target === 'website' || target === 'official_website') {
      const obj = objectives['OFFICIAL_WEBSITE'];
      if (obj && obj.status === 'UNKNOWN') {
        expectedInfoGain += 0.8;
        objectiveCoverageImprovement += 0.7;
      } else if (obj && obj.status === 'PARTIAL') {
        evidenceQualityImprovement += 0.4;
      }
    } else if (target === 'contact_page' || target === 'website_details') {
      const contactObj = objectives['CONTACT'];
      const emailObj = objectives['EMAIL'];
      const phoneObj = objectives['PHONE'];
      const addrObj = objectives['ADDRESS'];

      if (contactObj?.status === 'UNKNOWN') expectedInfoGain += 0.7;
      if (emailObj?.status === 'UNKNOWN') objectiveCoverageImprovement += 0.6;
      if (phoneObj?.status === 'UNKNOWN') objectiveCoverageImprovement += 0.5;
      if (addrObj?.status === 'UNKNOWN') objectiveCoverageImprovement += 0.5;
    } else if (target === 'leadership') {
      const obj = objectives['LEADERSHIP'];
      if (obj && obj.status === 'UNKNOWN') {
        expectedInfoGain += 0.8;
        objectiveCoverageImprovement += 0.8;
      }
    } else if (target === 'social_profiles') {
      const obj = objectives['SOCIAL_PROFILES'];
      if (obj && obj.status === 'UNKNOWN') {
        expectedInfoGain += 0.6;
        objectiveCoverageImprovement += 0.6;
      }
    } else if (target === 'email' && providerId === 'hunter') {
      const obj = objectives['EMAIL'];
      if (obj && (obj.status === 'UNKNOWN' || obj.status === 'PARTIAL')) {
        expectedInfoGain += 0.9;
        objectiveCoverageImprovement += 0.8;
      }
    }

    const verificationObj = objectives['SOURCE_VERIFICATION'];
    if (verificationObj && verificationObj.status !== 'SATISFIED') {
      verificationValue += 0.4;
    }

    const providerMeta = ProviderCapabilityRegistry.getProvider(providerId);
    const costMultiplier = providerMeta?.costMultiplier || 1.0;
    const latencyPenalty = (providerMeta?.timeoutMs || 15000) / 15000 * 0.1;
    const healthy = ProviderCapabilityRegistry.isHealthy(providerId);
    
    if (!healthy) return 0; // Skip completely unhealthy or broken providers

    const totalValue = expectedInfoGain + evidenceQualityImprovement + objectiveCoverageImprovement + verificationValue;
    const costPenalty = costMultiplier * 0.15 + latencyPenalty;

    return totalValue - costPenalty;
  }

  /**
   * Plans subsequent escalation queries if initial tasks did not satisfy critical goals.
   */
  private static escalateAndPlanQueries(
    companyState: CompanyResearchState,
    objectives: Record<string, any>,
    extraContext?: EntityResearchContext
  ): boolean {
    const state = companyState as any;
    const cleanName = companyState.name;
    const country = extraContext?.country || '';
    
    let currentStage = 1;
    if (objectives['OFFICIAL_WEBSITE']?.status === 'SATISFIED') currentStage = 3;
    if (objectives['CONTACT']?.status === 'PARTIAL') currentStage = 4;
    if (objectives['CONTACT']?.status === 'SATISFIED') currentStage = 5;
    if (objectives['LEADERSHIP']?.status === 'SATISFIED') currentStage = 6;
    
    const countCompleted = (state.plannedQueries || []).filter((q: any) => q.status === 'completed' || q.status === 'failed').length;
    if (countCompleted > 0) {
      currentStage = Math.max(currentStage, Math.min(10, 5 + countCompleted));
    }

    state.escalationStage = currentStage;
    companyState.stage = `Stage ${currentStage} - Escalating`;

    // Limit maximum queries to 8 to avoid runaways
    if ((state.plannedQueries || []).length >= 8) {
      logActivity(`Escalation Limit: Maximum planned queries (8) reached for "${cleanName}". Preventing further escalation.`, cleanName, 'info');
      return false;
    }

    const addedQueries: any[] = [];
    const existingQueryKeys = new Set((state.plannedQueries || []).map((q: any) =>
      String(q?.query || '').toLowerCase().replace(/\s+/g, ' ').trim()
    ));
    const addUniqueQuery = (query: any) => {
      const key = String(query.query || '').toLowerCase().replace(/\s+/g, ' ').trim();
      if (!key || existingQueryKeys.has(key)) return;
      existingQueryKeys.add(key);
      addedQueries.push(query);
    };

    if (objectives['OFFICIAL_WEBSITE']?.status !== 'SATISFIED' && (state.plannedQueries || []).length < 6) {
      addUniqueQuery({
        query: `${cleanName} ${country} contact homepage email phone`,
        target_type: 'official_website',
        reason: 'Escalation Stage 2/3: Searching alternative domain paths',
        provider_id: 'serper',
        status: 'pending'
      });
    }

    if (objectives['EMAIL']?.status !== 'SATISFIED' && (state.plannedQueries || []).length < 7) {
      addUniqueQuery({
        query: `${cleanName} corporate email contact address "@${cleanName.toLowerCase().replace(/[^a-z0-9]/g, '')}.com"`,
        target_type: 'email',
        reason: 'Escalation Stage 7/9: Querying email pattern intelligence',
        provider_id: 'serper',
        status: 'pending'
      });
    }

    if (objectives['LEADERSHIP']?.status !== 'SATISFIED' && (state.plannedQueries || []).length < 8) {
      addUniqueQuery({
        query: `${cleanName} owner director CEO "linkedin"`,
        target_type: 'leadership',
        reason: 'Escalation Stage 5/7: Scraping leadership registry on professional network',
        provider_id: 'exa',
        status: 'pending'
      });
    }

    if (addedQueries.length > 0) {
      state.plannedQueries = [...(state.plannedQueries || []), ...addedQueries];
      logActivity(`Difficult company escalation triggered Stage ${currentStage} for "${cleanName}": Added ${addedQueries.length} targeted queries.`, cleanName, 'info');
      return true;
    }

    return false;
  }

  /**
   * Evaluates the current state of company research and proposes the next logical step.
   */
  public static proposeNextAction(
    companyState: CompanyResearchState,
    extraContext?: EntityResearchContext
  ): ResearchAction {
    const state = companyState as any;
    const cleanName = (companyState.name || '').trim();

    // Guard: Prevent internal IDs from being processed
    if (companyState.name && (companyState.name.toLowerCase().startsWith('comp-') || companyState.name.match(/^comp-[a-z0-9]+$/i))) {
      companyState.status = 'failed';
      companyState.stage = 'Unresolved Target';
      logActivity(`CRITICAL SAFETY BLOCK: Aborted search on raw internal ID "${companyState.name}"`, companyState.name, 'error');
      return {
        type: 'FINALIZE',
        reason: 'Internal ID detected. Aborting external leak.'
      };
    }

    if (companyState.status === 'pending' || !state.initialized) {
      return {
        type: 'INITIALIZE',
        reason: 'Checking cache and initializing target parameters'
      };
    }

    const objectives = this.evaluateObjectives(companyState, extraContext);
    state.researchTrace = state.researchTrace || [];

    if (!state.plannedQueries || state.plannedQueries.length === 0) {
      return {
        type: 'PLAN_SEARCH',
        reason: 'Drafting capability-aware, targeted search objectives'
      };
    }

    const addTraceEntry = (actionProposed: string, reason: string, decision: string) => {
      const entry = {
        timestamp: new Date().toISOString(),
        stage: companyState.stage || 'Researching',
        actionProposed,
        reason,
        decision,
        objectivesState: JSON.parse(JSON.stringify(objectives)),
        evidenceGatheredCount: (state.evidenceCorpus || []).length
      };
      state.researchTrace.push(entry);
      companyState.research_trace = state.researchTrace;
    };

    let nextQuery = state.plannedQueries.find((q: any) => q.status === 'pending');

    if (!nextQuery) {
      const escalated = this.escalateAndPlanQueries(companyState, objectives, extraContext);
      if (escalated) {
        nextQuery = state.plannedQueries.find((q: any) => q.status === 'pending');
      }
    }

    if (nextQuery) {
      const utility = this.calculateActionUtility(nextQuery, objectives, state.settings || {});
      const costThreshold = (state.settings as any)?.cost_utility_threshold ?? 0.1;

      const hasEmail = objectives['EMAIL']?.status === 'SATISFIED';
      const hasPhone = objectives['PHONE']?.status === 'SATISFIED';
      const hasLeadership = objectives['LEADERSHIP']?.status === 'SATISFIED';

      const coverageComplete = isResearchCoverageComplete(objectives);
      if (hasEmail && hasPhone && hasLeadership && coverageComplete) {
        state.plannedQueries.forEach((q: any) => {
          if (q.status === 'pending') q.status = 'skipped';
        });
        
        logActivity(
          `Adaptive Stop: contact requirements and research coverage requirements are satisfied. Skipping remaining queries.`,
          companyState.name,
          'info'
        );

        addTraceEntry(
          'EXTRACT_INFORMATION',
          'Contact requirements and research coverage requirements are satisfied',
          'Early stop triggered via adaptive criteria.'
        );

        return {
          type: 'EXTRACT_INFORMATION',
          reason: 'Extracting final contact details from collected search corpus'
        };
      }

      if (utility < costThreshold && (state.evidenceCorpus || []).length > 0) {
        state.plannedQueries.forEach((q: any) => {
          if (q.status === 'pending') q.status = 'skipped';
        });

        logActivity(
          `Information Gain Stop: Utility (${utility.toFixed(2)}) fell below cost threshold (${costThreshold}). Stopping queries early.`,
          companyState.name,
          'info'
        );

        addTraceEntry(
          'EXTRACT_INFORMATION',
          `Utility (${utility.toFixed(2)}) is below cost threshold (${costThreshold})`,
          'Early stop triggered via utility threshold.'
        );

        return {
          type: 'EXTRACT_INFORMATION',
          reason: 'Utility calculation concluded that further queries are not cost-justified.'
        };
      }

      addTraceEntry(
        `EXECUTE_QUERY: ${nextQuery.query}`,
        nextQuery.reason || 'Executing planned query',
        `Proceeding because expected utility (${utility.toFixed(2)}) > threshold (${costThreshold}).`
      );

      return {
        type: 'EXECUTE_QUERY',
        queryToRun: nextQuery.query,
        queryTargetType: nextQuery.target_type,
        reason: `Executing query via optimal provider: "${nextQuery.query}"`
      };
    }

    if (!state.extractedDetails) {
      addTraceEntry(
        'EXTRACT_INFORMATION',
        'All queries executed or skipped. Transitioning to synthesis.',
        'Synthesizing gathered data.'
      );

      return {
        type: 'EXTRACT_INFORMATION',
        reason: 'Compiling multi-source evidence into a conflict-free canonical profile'
      };
    }

    addTraceEntry(
      'FINALIZE',
      'Canonical profile synthesized successfully. Saving results.',
      'Research cycle completed.'
    );

    return {
      type: 'FINALIZE',
      reason: 'Saving consolidated canonical profile'
    };
  }

  /**
   * Executes the proposed research step under governor guardrails.
   */
  public static async executeAction(
    jobId: string,
    companyState: CompanyResearchState,
    action: ResearchAction,
    settings: AppSettings,
    extraContext?: EntityResearchContext
  ): Promise<void> {
    const state = companyState as any;
    const cleanName = (companyState.name || '').trim();

    // Guard: Prevent internal IDs from leaking to external services
    if (cleanName.toLowerCase().startsWith('comp-') || cleanName.match(/^comp-[a-z0-9]+$/i)) {
      companyState.status = 'failed';
      companyState.stage = 'Unresolved Target';
      state.extractedDetails = {
        company_name: cleanName,
        website: '',
        address: '',
        phone: '',
        email: '',
        isPartial: true,
        quality_status: 'NOT_FOUND',
        source: 'unresolved-id-guard'
      };
      return;
    }

    switch (action.type) {
      case 'INITIALIZE': {
        state.initialized = true;
        companyState.status = 'processing';
        state.evidenceCorpus = state.evidenceCorpus || [];
        state.seenUrls = state.seenUrls || [];
        state.hasEmail = false;
        state.hasPhone = false;
        state.hasLeadership = false;
        state.currentWebsite = resolveVerifiedInitialWebsite(extraContext);
        
        companyState.stage = 'Cache Check';

        // Load cached records (country-aware: a Kenya context must never be
        // served a Pakistan-context record, and vice versa)
        const cached = await getCachedCompany(cleanName, extraContext?.country, extraContext?.role);
        const isNegativeOrPartial = !cached || cached.quality_status === 'NOT_FOUND' || cached.quality_status === 'FAILED' || cached.isPartial;
        
        let isExpired = false;
        if (cached && isNegativeOrPartial) {
          const fetchedAt = cached.fetched_at ? new Date(cached.fetched_at).getTime() : 0;
          const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
          if (fetchedAt < oneDayAgo) {
            isExpired = true;
          }
        }

        if (cached && !isNegativeOrPartial && !isExpired && !state.forceFresh) {
          logActivity(`Cache hit: loading persisted profile for "${cleanName}"`, cleanName, 'success');
          state.extractedDetails = cached;
          state.plannedQueries = [{ query: 'From Cache', target_type: 'cache', reason: 'Cache Hit', status: 'completed' }];
          state.hasEmail = !!cached.email;
          state.hasPhone = !!cached.phone;
          state.hasLeadership = (cached.decision_makers || []).length > 0;
        } else {
          if (cached && isNegativeOrPartial && !state.forceFresh) {
            // Partial cache: narrow research to only the fields still missing (cost control).
            const { getMissingFields } = await import('./enrichment');
            state.missingFields = getMissingFields(cached);
            state.partialCachedRecord = cached;
            logActivity(`Cache hit (partial): narrowing research to missing fields: ${(state.missingFields || []).join(', ') || 'all'} for "${cleanName}"`, cleanName, 'info');
          }
          if (cached && isExpired) {
            logActivity(`Cache expired: Retrying previously failed/partial target "${cleanName}"`, cleanName, 'info');
          } else {
            logActivity(`Cache miss: initiating autonomous research for "${cleanName}"`, cleanName, 'info');
          }
        }
        break;
      }

      case 'PLAN_SEARCH': {
        companyState.stage = 'Query Planning';
        const country = extraContext?.country || '';
        const role = extraContext?.role || 'Importer';
        const existingWebsite = state.currentWebsite || '';

        // Leverage capability-aware ResearchTaskPlanner from research fabric
        try {
          const { ResearchTaskPlanner } = await import('./research_fabric');
          const plannedTasks = ResearchTaskPlanner.plan(cleanName, { country, website: existingWebsite, role }, settings, state.missingFields);
          if (plannedTasks && plannedTasks.length > 0) {
            state.plannedQueries = plannedTasks.map(t => ({
              query: t.query,
              target_type: t.targetType,
              reason: t.reason,
              provider_id: t.providerId,
              status: 'pending'
            }));
            logActivity(`ResearchTaskPlanner drafted ${state.plannedQueries.length} capability-aware queries for "${cleanName}"`, cleanName, 'info');
            break;
          }
        } catch (err: any) {
          console.warn("[PLAN_SEARCH] ResearchTaskPlanner failed, falling back:", err.message);
        }

        // Robust default plan
        state.plannedQueries = [
          { query: existingWebsite ? `${cleanName} contact page address` : `${cleanName} official website contact address`, target_type: 'official_website', reason: 'Locate official website', status: 'pending' },
          { query: `${cleanName} linkedin page company profile facebook`, target_type: 'social_profiles', reason: 'Find professional social pages', status: 'pending' },
          { query: `${cleanName} CEO president founder export manager director`, target_type: 'leadership', reason: 'Find leadership contacts', status: 'pending' },
          { query: `${cleanName} headquarters email address phone number contact`, target_type: 'contact_page', reason: 'Search for public emails and phones', status: 'pending' }
        ];
        break;
      }

      case 'EXECUTE_QUERY': {
        const queryObj = state.plannedQueries.find((q: any) => q.status === 'pending');
        if (!queryObj) return;

        companyState.stage = `Searching`;
        const searchQuery = queryObj.query;
        const targetType = queryObj.target_type || 'company';
        const requestedProvider = String(queryObj.provider_id || '').toLowerCase();
        const cacheQueryKey = requestedProvider ? `${requestedProvider}::${searchQuery}` : searchQuery;
        let organic: any[] = [];
        state.providerTelemetry = state.providerTelemetry || [];
        state.entityProofObservations = state.entityProofObservations || [];
        state.rejectedDomains = state.rejectedDomains || [];

        // Check cache for this search query
        const db = await getDb();
        let cachedSearch: any = null;
        if (!state.forceFresh) {
          cachedSearch = await db.get('SELECT response FROM search_query_cache WHERE query = ?', [cacheQueryKey]);
        }
        if (cachedSearch && cachedSearch.response) {
          try {
            const parsed = JSON.parse(cachedSearch.response);
            organic = parsed.organic || [];
            logActivity(`Query cache hit for "${searchQuery}"`, cleanName, 'info');
            recordUsage('cache_hits', 1);
            ResourceGovernor.recordCacheHit('serper');
          } catch (_) {}
        } else {
          recordUsage('cache_misses', 1);
          try {
            const { results, providerUsed, attempts } = await executeProviderAwareSearch(
              searchQuery,
              targetType,
              settings,
              logActivity,
              cleanName,
              { preferredProvider: requestedProvider || undefined, verifiedDomain: state.currentWebsite || undefined }
            );
            organic = results;
            state.providerTelemetry.push({ provider: providerUsed, query: searchQuery, target_type: targetType, urls_discovered: results.length, urls: results.map((item: any) => item.link).filter(Boolean), attempts, at: new Date().toISOString() });
            ResourceGovernor.recordCacheMiss(providerUsed as any);

            const cacheResponse = { organic: results, provider_used: providerUsed };
            await db.run(
              'INSERT INTO search_query_cache (query, response) VALUES (?, ?) ON CONFLICT(query) DO UPDATE SET response = excluded.response, cached_at = CURRENT_TIMESTAMP',
              [cacheQueryKey, JSON.stringify(cacheResponse)]
            );
          } catch (err: any) {
            state.providerTelemetry.push({
              provider: err?.searchAttempts?.at(-1)?.provider || requestedProvider || 'unknown',
              query: searchQuery,
              target_type: targetType,
              urls_discovered: 0,
              urls: [],
              attempts: err?.searchAttempts || [],
              at: new Date().toISOString(),
            });
            console.warn(`Search query failed for "${searchQuery}":`, err.message);
            queryObj.status = 'failed';
            throw err;
          }
        }

        // Rank organic search candidates using candidate relevance scoring, domain matching & country targeting
        const rankedResults = rankSearchResults(organic, cleanName, targetType, state.currentWebsite, extraContext?.country);
        const rejectedDomainSet = new Set<string>(state.rejectedDomains || []);
        const urlsToScrape = rankedResults
          .filter(item => {
            if (!item.link || state.seenUrls.includes(item.link)) return false;
            try { return !rejectedDomainSet.has(new URL(item.link).hostname.toLowerCase().replace(/^www\./, '')); } catch (_) { return false; }
          })
          .slice(0, queryObj.entity_proof_contact_recovery ? 2 : 3);

        if (urlsToScrape.length > 0) {
          logActivity(`Ranked ${organic.length} search candidates for "${cleanName}". High-value target: ${urlsToScrape[0].link}`, cleanName, 'info');
        }

        for (const item of urlsToScrape) {
          const targetUrl = item.link;
let cacheUrl = targetUrl;
          state.seenUrls.push(targetUrl);
          companyState.stage = `Crawling: ${targetUrl.substring(0, 25)}...`;

          logActivity(`Retrieving URL evidence: ${targetUrl}`, cleanName, 'info');

          let content = '';
          let directHtmlForLinks = '';
          let cachedScrape: any = null;
          if (!state.forceFresh) {
            cachedScrape = await db.get('SELECT content FROM scraped_url_cache WHERE url = ?', [targetUrl]);
          }
          if (cachedScrape && cachedScrape.content) {
            content = cachedScrape.content;
            logActivity(`Scrape cache hit for ${targetUrl}`, cleanName, 'info');
            recordUsage('cache_hits', 1);
          } else {
            recordUsage('cache_misses', 1);

            // Retrieval cascade: direct fetch → Firecrawl → Apify (for dynamic pages)
            // 1) Direct fetch (DNS‑pinned SSRF‑protected)
            if (isSafeExternalUrl(targetUrl)) {
                try {
                    const { response: fetchRes, text: directHtml } = await safeFetchOutboundText(targetUrl, {
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                        }
                    });
                    if (fetchRes.ok) {
                        directHtmlForLinks = directHtml;
                        content = htmlToEvidenceText(directHtml);
                        state.directRetrievalCount = Number(state.directRetrievalCount || 0) + 1;
                    }
                } catch (_) {}
            }
            // 2) Firecrawl fallback if direct fetch yielded no content
            if (!content && settings.firecrawl_api_key?.trim() && settings.firecrawl_enabled) {
                try {
                    content = await ResourceGovernor.executeWithRetry('firecrawl', `Firecrawl Scrape: ${targetUrl}`, async () => {
                        const res = await fetch('https://api.firecrawl.dev/v1/scrape', {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${assertSafeHeaderValue(settings.firecrawl_api_key.trim(), 'Firecrawl API key')}`,
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({ url: targetUrl, formats: ['markdown'] })
                        });
                        if (res.status === 403) throw new Error("HTTP_403_BLOCKED");
                        if (!res.ok) throw new Error(`Firecrawl returned HTTP ${res.status}`);
                        const scrapeData = await res.json();
                        if (scrapeData.success && scrapeData.data && scrapeData.data.markdown) {
                            return preservePageContent(scrapeData.data.markdown);
                        }
                        return '';
                    });
                } catch (e: any) {
                    if (e.message?.includes("HTTP_403_BLOCKED")) {
                        logActivity(`Scraper was blocked (HTTP 403) on ${targetUrl}. Preserving discovered URL as valid metadata evidence.`, cleanName, 'info');
                    } else {
                        console.warn(`Firecrawl scrape failed for ${targetUrl}: ${e.message}`);
                    }
                }
            }
            // 3) Apify for socially‑dynamic pages when still no content
            const isLinkedInOrFacebook = targetUrl.includes('linkedin.com') || targetUrl.includes('facebook.com');
            const isApifyConfigured = settings.apify_api_key?.trim() && settings.apify_enabled;
            if (!content && isLinkedInOrFacebook && isApifyConfigured) {
                try {
                    logActivity(`Scraping dynamic URL via Apify: ${targetUrl}`, cleanName, 'info');
                    const apifyResult = await ResourceGovernor.executeWithRetry('apify', `Apify Scrape: ${targetUrl}`, async () => {
                        const { ApifyProvider } = await import('./apify');
                        return await ApifyProvider.scrapeUrl(targetUrl, settings.apify_api_key);
                    });
                    if (apifyResult && (apifyResult.markdown || apifyResult.text)) {
                        content = apifyResult.markdown || apifyResult.text || '';
                        logActivity(`Apify successfully scraped ${targetUrl}`, cleanName, 'success');
                        if (apifyResult.emails && apifyResult.emails.length > 0) state.hasEmail = true;
                    }
                } catch (e: any) {
                    logActivity(`Apify scrape failed for ${targetUrl}: ${e.message}`, cleanName, 'warn');
                }
            }

            // 4) Alternate official page fallback (e.g., /contact, /about) when no content
            if (!content) {
                try {
                    const baseOrigin = (() => {
                        try {
                            const parsed = new URL(targetUrl);
                            return `${parsed.protocol}//${parsed.hostname}`;
                        } catch (_) { return ''; }
                    })();
                    const alternatePaths = ['', 'contact', 'contact-us', 'about', 'about-us', 'team', 'leadership', 'people'];
                    for (const p of alternatePaths) {
                        const altUrl = p ? `${baseOrigin}/${p}` : baseOrigin;
                        if (!altUrl || altUrl === targetUrl) continue;
                        if (state.seenUrls.includes(altUrl)) continue;
                        if (!isSafeExternalUrl(altUrl)) continue;
                        try {
                            const { response: altRes, text: altHtml } = await safeFetchOutboundText(altUrl, {
                                headers: {
                                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                                }
                            });
                            if (altRes.ok) {
                                const altContent = htmlToEvidenceText(altHtml);
                                if (altContent && altContent.trim()) {
                                    content = altContent;
                                    state.seenUrls.push(altUrl);
                                    logActivity(`Alternate official page retrieved: ${altUrl}`, cleanName, 'info');
                                    break;
                                }
                            }
                        } catch (_) {}
                    }
                } catch (_) {}
            }

            if (content && !directHtmlForLinks && isSafeExternalUrl(targetUrl)) {
              try {
                const { response: directResponse, text: directHtml } = await safeFetchOutboundText(targetUrl, {
                  headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36' },
                });
                if (directResponse.ok) {
                  directHtmlForLinks = directHtml;
                  state.directRetrievalCount = Number(state.directRetrievalCount || 0) + 1;
                }
              } catch (_) {}
            }
            content = mergeScrapedAndDirectEvidence(content, directHtmlForLinks);

            // If all retrieval failed, do NOT use search snippet as factual content.
            // Instead record a metadata-only observation with source_kind = SEARCH_METADATA.
            const retrievalFailed = !content || !content.trim();
            if (retrievalFailed) {
              logActivity(`Retrieval failed for ${targetUrl}; preserving search metadata only`, cleanName, 'warn');
              // Do not cache snippet as factual evidence
            } else {
              await db.run(
                'INSERT INTO scraped_url_cache (url, content) VALUES (?, ?) ON CONFLICT(url) DO UPDATE SET content = excluded.content, cached_at = CURRENT_TIMESTAMP',
                [cacheUrl, content.trim()]
              );
            }
          }

          if (!content.trim()) {
            logActivity(`Retrieval failed for ${targetUrl}; recording search metadata only`, cleanName, 'warn');
            state.entityProofObservations.push({
              url: targetUrl,
              title: item.title || targetUrl,
              content: item.snippet || '',
              source_type: 'search_metadata',
              admission_decision: 'HOLD',
              admission_reason: 'No retrievable page evidence; search metadata preserved for discovery only',
              official_domain: state.currentWebsite || '',
            });
            continue;
          }

          const countryContext = extraContext?.country || '';
          const trimmedContent = focusEvidenceForTargetCountry(content.trim(), countryContext, targetUrl);
          
          // Allow HOLD for plausible web sources; directories/registries have their own logic
          const isDirectoryOrRegistry = /(?:panjiva|importgenius|volza|tendata|marketinsidedata)\.com/i.test(targetUrl) 
            || ['registry', 'directory'].includes(targetType);
          const countryAssessment = assessEvidenceForCountry(
            trimmedContent, targetUrl, cleanName, 
            countryContext || undefined, 
            state.currentWebsite || undefined,
            { 
              sourceType: isDirectoryOrRegistry ? 'web' : 'web', 
              allowHold: true // Enable HOLD for plausible web sources
            }
          );
          
          // Track HOLD candidates for entity-proof research
          if (countryAssessment.decision === 'HOLD') {
            state.candidatePool = state.candidatePool || [];
            state.candidatePool.push({
              url: targetUrl,
              host: new URL(targetUrl).hostname,
              title: item.title || targetUrl,
              snippet: item.snippet || '',
              contentPreview: trimmedContent.slice(0, 500),
              company: cleanName,
              country: countryContext,
              targetType,
              identitySignals: countryAssessment.identitySignals || [],
              missingProof: countryAssessment.missingProof || [],
              reasons: countryAssessment.reasons,
              timestamp: new Date().toISOString(),
              content: trimmedContent, // Store for reassessment
            });
            logActivity(`HOLD candidate added to entity-proof pool: ${targetUrl} (signals: ${countryAssessment.identitySignals?.join(', ') || 'none'})`, cleanName, 'info');
          }
          
          if (!countryAssessment.admissible) {
              // Record REJECT decisions in entityProofObservations for telemetry parity
              if (countryAssessment.decision === 'REJECT') {
                state.entityProofObservations = state.entityProofObservations || [];
                state.entityProofObservations.push({
                  url: targetUrl,
                  title: item.title || targetUrl,
                  content: trimmedContent.slice(0, 500),
                  source_type: 'web',
                  admission_decision: 'REJECT',
                  admission_reason: countryAssessment.reasons.slice(-1)[0],
                  official_domain: state.currentWebsite || '',
                  identitySignals: countryAssessment.identitySignals || [],
                  missingProof: countryAssessment.missingProof || [],
                });
              }
              logActivity(
                `${countryAssessment.decision === 'HOLD' ? 'Holding' : 'Discarding'} untrusted evidence from ${targetUrl} for "${cleanName}" (${countryAssessment.reasons.slice(-1)[0]}).`,
                cleanName,
                'warn'
              );
            } else {
              const isTradeDirectory = /(?:panjiva|importgenius|volza|tendata|marketinsidedata)\.com/i.test(targetUrl);
              let officialHostMatch = false;
              try {
                const officialHost = new URL(state.currentWebsite || '').hostname.replace(/^www\./, '');
                const pageHost = new URL(targetUrl).hostname.replace(/^www\./, '');
                officialHostMatch = Boolean(officialHost && (pageHost === officialHost || pageHost.endsWith(`.${officialHost}`)));
              } catch (_) {}
              const scoped = buildEntityScopedEvidence(trimmedContent, targetUrl, cleanName, countryContext, isTradeDirectory || targetType === 'registry' || targetType === 'directory');
              const entityScopedContent = officialHostMatch
                ? trimmedContent
                : scoped.mixed_entity_page
                  ? (scoped.extraction_content || '[EdgeView: mixed-entity page admitted, but no target-local fact neighborhood was established.]')
                  : focusEvidenceForCompany(trimmedContent, cleanName, isTradeDirectory ? 400 : 1200);
              state.evidenceCorpus.push({
                url: targetUrl,
                title: item.title || targetUrl,
                content: entityScopedContent,
                blocks: scoped.blocks,
                mixed_entity_page: scoped.mixed_entity_page,
              });

              // Only update candidate discovery flags if target-scoped content contains entity-owned evidence
              const targetScopedText = scoped.mixed_entity_page ? (scoped.extraction_content || '') : entityScopedContent;
              const lowerScoped = targetScopedText.toLowerCase();
              if (/@([a-zA-Z0-9-]+\.)+[a-zA-Z0-9-]{2,4}/.test(lowerScoped) && !scoped.mixed_entity_page) state.hasEmail = true;
              if (/\+?[0-9][0-9\s.-]{7,15}/.test(lowerScoped) && !scoped.mixed_entity_page) state.hasPhone = true;

              // Only adopt the official domain from validated evidence so a
              // wrong-company page can never leak into the profile (incident 001).
              if (isPlausibleOfficialCompanyUrl(targetUrl, cleanName)) {
                // Set or update the official website candidate based on lexical match.
                // Overwrite any previous candidate to ensure the most recent plausible domain is used.
                try {
                  const parsedUrl = new URL(targetUrl);
                  state.currentWebsite = `${parsedUrl.protocol}//${parsedUrl.hostname}`;
                } catch (_) {}
              }

              // Perform internal website link discovery on official/corporate domains
              if (state.currentWebsite) {
                try {
                  const currHost = new URL(state.currentWebsite).hostname.toLowerCase();
                  const targetHost = new URL(targetUrl).hostname.toLowerCase();
                  if (targetHost === currHost || targetHost.endsWith('.' + currHost)) {
                    const remainingInternalBudget = Math.max(0, 4 - Number(state.internalDiscoveryCount || 0));
                    if (remainingInternalBudget > 0 && !directHtmlForLinks && isSafeExternalUrl(targetUrl)) {
                      try {
                        const { response: rawResponse, text: rawHtml } = await safeFetchOutboundText(targetUrl, {
                          timeoutMs: 6000,
                          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36' },
                        });
                        if (rawResponse.ok) directHtmlForLinks = rawHtml;
                      } catch (_) {}
                    }
                    const discoveryContent = `${extractHtmlLinkManifest(directHtmlForLinks)}\n${content}`;
                    const internalLinks = discoverInternalLinks(discoveryContent, targetUrl, cleanName, countryContext || undefined);
                    const unvisitedInternal = selectHighValueInternalLinks(
                      internalLinks.filter(l => !state.seenUrls.includes(l.url)),
                      remainingInternalBudget
                    );

                    for (const intLink of unvisitedInternal) {
                      state.internalDiscoveryCount = Number(state.internalDiscoveryCount || 0) + 1;
                      state.seenUrls.push(intLink.url);
                      logActivity(`Discovered internal high-value link (${intLink.label}): ${intLink.url}`, cleanName, 'info');

                      if (isSafeExternalUrl(intLink.url)) {
                        try {
                          const { response: intRes, text: intHtml } = await safeFetchOutboundText(intLink.url, {
                            timeoutMs: 6000,
                            headers: {
                              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                            }
                          });
                          if (intRes.ok) {
                            const intClean = htmlToEvidenceText(intHtml);
                            if (intClean.trim()) {
                              // Internal pages are on the official domain: admit
                              // them when they remain associated with the target.
                              const intAssessment = assessEvidenceForCountry(intClean.trim(), intLink.url, cleanName, countryContext || undefined, state.currentWebsite || undefined);
                              if (intAssessment.admissible) {
                                state.evidenceCorpus.push({
                                  url: intLink.url,
                                  title: `${intLink.label} - ${cleanName}`,
                                  content: intClean.trim()
                                });
                                logActivity(`Retrieved internal evidence page (${intLink.label}): ${intLink.url}`, cleanName, 'success');
                              } else {
                                logActivity(`Discarding internal page ${intLink.url} (describes a different country while targeting "${countryContext || 'none'}").`, cleanName, 'warn');
                              }
                            }
                          }
                        } catch (err: any) {
                          console.warn(`Internal link fetch failed for ${intLink.url}:`, err.message);
                        }
                      }
                    }
                  }
                } catch (_) {}
              }
            }
          }

        queryObj.status = 'completed';
        break;
      }

      case 'EXTRACT_INFORMATION': {
        companyState.stage = 'Extracting Profile';

        if (!state.evidenceCorpus || state.evidenceCorpus.length === 0) {
          logActivity(`No evidence collected for "${cleanName}", writing empty profile`, cleanName, 'warn');
          state.extractedDetails = {
            company_name: cleanName,
            website: state.currentWebsite || '',
            address: '',
            phone: '',
            email: '',
            country: extraContext?.country || '',
            isPartial: true,
            quality_status: 'NOT_FOUND',
            source: 'api - no evidence'
          };
          break;
        }

        const country = extraContext?.country || '';
        const countryInstruction = country
          ? `TARGET COUNTRY BRANCH: "${country}". This enrichment targets the importer operation IN ${country.toUpperCase()}.
- PREFER contact details, addresses, phones, emails, and executives of the company's operation in ${country}.
- If a piece of evidence describes the company operating in a DIFFERENT country (e.g. a branch/office/site in another country), DO NOT promote it as the ${country} contact information.
- A global corporate page that does not specify a country may be used only as supporting context; do not prefer it over ${country}-specific evidence.
- Never invent a ${country} branch, address, phone, or email that is not explicitly present in the evidence.`
          : `No specific target country was provided: extract the company's global/headquarters contact information.`;

        try {
          // Select reasoning LLM plan canonically
          const { buildAIExecutionPlan, executeAIPlan } = await import('./ai_execution_plan');
          const aiPlan = buildAIExecutionPlan(settings);
          const providerId = aiPlan.provider;

          // Evidence-aware packaging: single pass when the corpus fits the
          // model context, bounded whole-item chunks otherwise (never a blind
          // prefix slice). Chunk results are merged deterministically so no
          // evidence-backed fact is lost.
          const { packageEvidenceForExtraction, mergeExtractionResults, buildExtractionPrompt } = await import('./evidence_packaging');
          const packaged = packageEvidenceForExtraction(
            state.evidenceCorpus,
            cleanName,
            country,
            countryInstruction,
            providerId,
            settings,
            aiPlan.contextWindow
          );

          const runChunk = async (chunk: any[], chunkIdx: number): Promise<any> => {
            const prompt = buildExtractionPrompt(
              chunk,
              cleanName,
              country,
              countryInstruction,
              chunkIdx + 1,
              packaged.chunkCount,
              settings
            );
            const execResult = await executeAIPlan(
              aiPlan,
              prompt,
              settings,
              `Extract Details: ${cleanName}${packaged.chunkCount > 1 ? ` (chunk ${chunkIdx + 1}/${packaged.chunkCount})` : ''}`
            );
            const cleanedExtraction = extractJsonBlock(execResult.content);
            return safeJsonParse(cleanedExtraction, {}) as any;
          };

          let parsed: any;
          if (packaged.chunkCount === 1) {
            parsed = await runChunk(packaged.chunks[0], 0);
          } else {
            const partials: any[] = [];
            for (let i = 0; i < packaged.chunks.length; i++) {
              partials.push(await runChunk(packaged.chunks[i], i));
            }
            parsed = mergeExtractionResults(partials);
            logActivity(`Merged extraction from ${partials.length} evidence chunks for "${cleanName}"`, cleanName, 'info');
          }

          // Integrate EvidenceGraph & Fusion Engine
          const { EvidenceGraph, EvidenceFusionEngine } = await import('./research_fabric');
          const graph = new EvidenceGraph();
          addDeterministicEvidenceFacts(graph, state.evidenceCorpus || [], cleanName, state.currentWebsite || parsed.website || '');

          // Grounding Helper: Find authentic source_url in evidence corpus for every fact
          const corpusUrls = new Set((state.evidenceCorpus || []).map((e: any) => e.url));

          const getGroundedSourceUrl = (val: string, requestedUrl?: string): string => {
            if (requestedUrl && corpusUrls.has(requestedUrl)) {
              return requestedUrl;
            }
            if (val && typeof val === 'string' && val.length > 2) {
              const cleanVal = val.toLowerCase().trim();
              const foundItem = (state.evidenceCorpus || []).find((e: any) => e.content && e.content.toLowerCase().includes(cleanVal));
              if (foundItem) {
                return foundItem.url;
              }
            }
            // Strict provenance: NEVER return a fake fallback URL if not grounded in evidence
            return '';
          };

          if (Array.isArray(parsed.emails)) {
            parsed.emails.forEach((email: string) => {
              const groundedUrl = findExactEmailSourceUrl(state.evidenceCorpus || [], email);
              if (groundedUrl) {
                graph.addFact('email', email, groundedUrl, 'ai_extract', 'LLM_AI_EXTRACT', 0.9);
              }
            });
          }
          if (Array.isArray(parsed.phones)) {
            parsed.phones.forEach((phone: string) => {
              const groundedUrl = getGroundedSourceUrl(phone);
              if (groundedUrl) {
                graph.addFact('phone', phone, groundedUrl, 'ai_extract', 'LLM_AI_EXTRACT', 0.9);
              }
            });
          }
          if (parsed.website) {
            const groundedUrl = getGroundedSourceUrl(parsed.website, parsed.website);
            if (groundedUrl && isPlausibleOfficialCompanyUrl(parsed.website, cleanName)) {
              graph.addFact('website', parsed.website, groundedUrl, 'ai_extract', 'LLM_AI_EXTRACT', 0.95);
            }
          }
          if (parsed.industry) {
            const groundedUrl = getGroundedSourceUrl(parsed.industry);
            if (groundedUrl) {
              graph.addFact('industry', parsed.industry, groundedUrl, 'ai_extract', 'LLM_AI_EXTRACT', 0.8);
            }
          }
          if (Array.isArray(parsed.linkedin_urls)) {
            parsed.linkedin_urls.forEach((lk: string) => {
              const groundedUrl = getGroundedSourceUrl(lk, lk);
              if (groundedUrl) {
                graph.addFact('linkedin', lk, groundedUrl, 'ai_extract', 'LLM_AI_EXTRACT', 0.9);
              }
            });
          }
          if (Array.isArray(parsed.fax_numbers)) {
            parsed.fax_numbers.forEach((fax: string) => {
              const groundedUrl = getGroundedSourceUrl(fax);
              if (groundedUrl) {
                graph.addFact('fax', fax, groundedUrl, 'ai_extract', 'LLM_AI_EXTRACT', 0.85);
              }
            });
          }
          if (Array.isArray(parsed.addresses)) {
            parsed.addresses.forEach((addr: any) => {
              if (addr && addr.address && !isPlaceholderFact(addr.address)) {
                const groundedUrl = getGroundedSourceUrl(addr.address, addr.source_url);
                const directorySource = /(?:panjiva|importgenius|volza)\.com/i.test(groundedUrl);
                const addressHasTargetCountry = !country || detectCountryMentions(String(addr.address)).includes(normalizeTargetCountry(country));
                if (groundedUrl && (!directorySource || addressHasTargetCountry)) {
                  graph.addFact('address', { ...addr, source_url: groundedUrl }, groundedUrl, 'ai_extract', 'LLM_AI_EXTRACT', 0.9);
                }
              }
            });
          }
          if (Array.isArray(parsed.contact_persons)) {
            parsed.contact_persons.forEach((cp: any) => {
              if (isValidCorporateContactPerson(cp)) {
                const groundedUrl = getGroundedSourceUrl(cp.name, cp.source_url);
                if (groundedUrl) {
                  graph.addFact('contact_person', { ...cp, source_url: groundedUrl }, groundedUrl, 'ai_extract', 'LLM_AI_EXTRACT', 0.9);
                }
              }
            });
          }

          // Scan corpus for other regex traces as secondary nodes. Only emails
          // with sufficient company/source attribution are admitted: when a
          // target website is known, a corpus item must be on the company's own
          // site, or the email's domain must match the company's site.
          // Otherwise unrelated emails from third-party pages (e.g. LinkedIn
          // page chrome) leak into the record.
            // Build a set of hostnames that are trusted as the target company's official domain(s).
            const officialHosts = new Set<string>();
            // Official website discovered during research (state.currentWebsite)
            if (state.currentWebsite && isPlausibleOfficialCompanyUrl(state.currentWebsite, cleanName)) {
                try {
                    const host = new URL(state.currentWebsite).hostname.toLowerCase().replace(/^www\./, '');
                    officialHosts.add(host);
                } catch (_) {}
            }
            // Official website parsed from LLM suggestion (parsed.website)
            if (parsed.website && isPlausibleOfficialCompanyUrl(parsed.website, cleanName)) {
                try {
                    const host = new URL(parsed.website).hostname.toLowerCase().replace(/^www\./, '');
                    officialHosts.add(host);
                } catch (_) {}
            }
            // At this stage we only trust the above official hosts for email admission.
            const targetHosts = Array.from(officialHosts);

          
          // Fallback: scan raw scraped content from official website for emails
          // This catches emails that were filtered out by entity scoping on mixed pages
          if (state.currentWebsite && isPlausibleOfficialCompanyUrl(state.currentWebsite, cleanName)) {
            try {
              const { getDb } = await import('./sqlite');
              const db = await getDb();
              const cachedRows = await db.all('SELECT url, content FROM scraped_url_cache WHERE url LIKE ?', [`${state.currentWebsite}%`]);
              for (const cached of cachedRows) {
                if (cached && cached.content) {
                  const emailsFound = extractEmailsFromEvidenceText(cached.content);
                  let itemHost = '';
                  try { itemHost = new URL(cached.url).hostname.toLowerCase().replace(/^www\./, ''); } catch (_) {}
                  rankAttributedEmails(emailsFound, 8).forEach((email: string) => {
                    graph.addFact('email', email.trim().toLowerCase(), cached.url, 'regex_scanner', 'REG_EX_SCANNER', 0.7);
                  });
                }
              }
            } catch (_) {}
          }

          // Fuse conflict-free corporate registry
          const fused = EvidenceFusionEngine.fuse(graph, cleanName, country);

          state.extractedDetails = {
            company_name: cleanName,
            website: fused.website,
            address: fused.address,
            phone: fused.phone,
            email: fused.email,
            linkedin: fused.linkedin,
            industry: fused.industry,
            country: fused.country,
            fax_numbers: fused.fax_numbers,
            emails_list: fused.emails_list,
            phones_list: fused.phones_list,
            linkedin_urls: fused.linkedin_urls,
            addresses: fused.addresses,
            contact_persons: fused.contact_persons,
            sources: fused.sources,
            evidence: fused.evidence,
            isPartial: fused.quality_status === 'PARTIAL' || fused.quality_status === 'NOT_FOUND',
            quality_status: fused.quality_status,
            source: 'Evidence Fusion Engine'
          };

            // (Heuristic email guess removed – email must be sourced from evidence)
            logActivity(`Synthesized canonical profile for "${cleanName}" via ${providerId.toUpperCase()}`, cleanName, 'success');
        } catch (e: any) {
          console.error("Extraction failed, falling back to deterministic extraction:", e);
          
          // Deterministic fallback: extract from evidence corpus using regex/structured parsing
          const { EvidenceGraph, EvidenceFusionEngine } = await import('./research_fabric');
          const fallbackGraph = new EvidenceGraph();
          addDeterministicEvidenceFacts(fallbackGraph, state.evidenceCorpus || [], cleanName, state.currentWebsite || '');
          
          // Deterministic website detection
          if (state.currentWebsite && isPlausibleOfficialCompanyUrl(state.currentWebsite, cleanName)) {
            fallbackGraph.addFact('website', state.currentWebsite, state.currentWebsite, 'regex_scanner', 'REG_EX_SCANNER', 0.8);
          }
          
          // Deterministic phone/email from official website cache
          if (state.currentWebsite && isPlausibleOfficialCompanyUrl(state.currentWebsite, cleanName)) {
            try {
              const { getDb } = await import('./sqlite');
              const db = await getDb();
              const cachedRows = await db.all('SELECT url, content FROM scraped_url_cache WHERE url LIKE ?', [`${state.currentWebsite}%`]);
              for (const cached of cachedRows) {
                if (cached && cached.content) {
                  const emailsFound = extractEmailsFromEvidenceText(cached.content);
                  emailsFound.forEach((email: string) => {
                    fallbackGraph.addFact('email', email.trim().toLowerCase(), cached.url, 'regex_scanner', 'REG_EX_SCANNER', 0.7);
                  });
                  const phonesFound = extractPhonesFromEvidenceText(cached.content);
                  phonesFound.forEach((phone: string) => {
                    fallbackGraph.addFact('phone', phone.trim(), cached.url, 'regex_scanner', 'REG_EX_SCANNER', 0.7);
                  });
                }
              }
            } catch (_) {}
          }
          
          // Fuse the deterministic facts
          const fused = EvidenceFusionEngine.fuse(fallbackGraph, cleanName, extraContext?.country || '');
          
          state.extractedDetails = {
            company_name: cleanName,
            website: fused.website,
            address: fused.address,
            phone: fused.phone,
            email: fused.email,
            linkedin: fused.linkedin,
            industry: fused.industry,
            country: extraContext?.country || '',
            fax_numbers: fused.fax_numbers,
            emails_list: fused.emails_list,
            phones_list: fused.phones_list,
            linkedin_urls: fused.linkedin_urls,
            addresses: fused.addresses,
            contact_persons: fused.contact_persons,
            sources: fused.sources,
            evidence: fused.evidence,
            isPartial: fused.quality_status === 'PARTIAL' || fused.quality_status === 'NOT_FOUND',
            quality_status: fused.quality_status,
            source: 'Deterministic Fallback Extraction'
          };
          
          logActivity(`Deterministic fallback extraction for "${cleanName}" (${fused.quality_status})`, cleanName, 'warn');
        }
        break;
      }

      case 'FINALIZE': {
        companyState.stage = 'Saving';

        const extracted = state.extractedDetails;
        if (extracted) {
          // Force Fetch bypasses discovery caches, but it is still an
          // improvement operation. Existing trusted facts are merged unless
          // strong identity evidence explicitly invalidates them.
          if ((companyState as any).invalidateExistingIdentity) extracted.invalidate_existing_identity = true;
          extracted.research_trace = state.researchTrace || [];
          extracted.objectives = companyState.objectives || {};
          if ((companyState as any).entityProof) extracted.entity_proof = (companyState as any).entityProof;
          const details = await saveEnrichedData(extracted);

          const contact = pharmaDb.getContactById(companyState.id);
          if (contact) {
            applyEnrichmentDetailsToContact(contact, details);
            contact.last_updated = new Date().toISOString();
          }

          companyState.metrics = {
            emailsFound: (details.emails_list || []).length,
            phonesFound: (details.phones_list || []).length,
            socialsFound: (details.socials || []).length,
            leadershipFound: (details.decision_makers || []).length > 0,
            websiteFound: !!details.website
          };

          companyState.status = 'completed';
          companyState.stage = 'Complete';
          logActivity(`Enrichment complete for "${cleanName}" (${details.quality_status})`, cleanName, 'success');

          // Optional development diagnostic trace saved in .agent/traces/
          try {
            const fs = await import('fs');
            const path = await import('path');
            const scratchDir = path.join(getProjectRoot(), '.agent', 'traces');
            if (!fs.existsSync(scratchDir)) fs.mkdirSync(scratchDir, { recursive: true });
            const tracePath = path.join(scratchDir, 'research_trace.jsonl');
            const tracePayload = {
              research_run_id: `run-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
              company: cleanName,
              country: extraContext?.country || '',
              quality_status: details.quality_status,
              emails_found: (details.emails_list || []).length,
              phones_found: (details.phones_list || []).length,
              contact_persons_found: (details.contact_persons || []).length,
              addresses_found: (details.addresses || []).length,
              sources_count: (details.sources || []).length,
              timestamp: new Date().toISOString()
            };
            fs.appendFileSync(tracePath, JSON.stringify(tracePayload) + '\n');
          } catch (_) {}
        } else {
          companyState.status = 'failed';
          companyState.stage = 'Failed';
        }
        break;
      }
    }
  }
}
