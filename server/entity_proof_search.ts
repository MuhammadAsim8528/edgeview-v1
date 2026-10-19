import { createHash } from 'node:crypto';
import { canonicalCompanyIdentityKey, canonicalCountryIdentityKey, canonicalEntityIdentityKey } from './company_identity';
import { detectCountryMentions, type EntityResearchContext } from './research_director';
import { planJointTransactionQueries, planRelationalWitnessActions, scoreDiscriminativeTransactionFeatures } from './trade_fingerprint';

export const ENTITY_PROOF_SEARCH_FLAG = 'EDGEVIEW_ENTITY_PROOF_SEARCH_V1';

export type EntityProofCandidateStatus =
  | 'ACTIVE' | 'UNRESOLVED' | 'TRADE_ENTITY_SUPPORTED' | 'BUSINESS_ENTITY_SUPPORTED'
  | 'LEGAL_ENTITY_SUPPORTED' | 'OFFICIAL_WEB_IDENTITY_SUPPORTED' | 'REJECTED';
export type EntitySourceAuthority =
  | 'OFFICIAL_COMPANY' | 'OFFICIAL_BRANCH' | 'GOVERNMENT_REGISTRY'
  | 'CHAMBER_TRADE_ASSOCIATION' | 'OFFICIAL_PARTNER_SUPPLIER_DISTRIBUTOR'
  | 'PROFESSIONAL_BUSINESS_PROFILE' | 'COMMERCIAL_TRADE_DATABASE'
  | 'ESTABLISHED_BUSINESS_DIRECTORY' | 'OTHER_PUBLIC_SOURCE';
export type EntitySourceFamily = 'official' | 'government' | 'partner' | 'trade-data-derived' | 'directory' | 'professional' | 'local-business' | 'other';
export type EntityProofEdgeType =
  | 'NAME_MATCH' | 'COUNTRY_MATCH' | 'CITY_MATCH' | 'ADDRESS_OVERLAP'
  | 'PHONE_MATCH' | 'EMAIL_DOMAIN_MATCH' | 'TRADE_PARTNER_MATCH' | 'PRODUCT_MATCH'
  | 'REGISTRY_MATCH' | 'OFFICIAL_RELATIONSHIP' | 'TRADE_RELATIONSHIP' | 'PARTNER_REFERENCE' | 'INDEPENDENT_SOURCE_CORROBORATION';
export type EntityProofContradictionType =
  | 'DIFFERENT_LEGAL_NAME' | 'WRONG_COUNTRY' | 'CONFLICTING_ADDRESS'
  | 'DIFFERENT_BUSINESS' | 'DIFFERENT_TRADE_CONTEXT' | 'WRONG_DOMAIN' | 'OTHER_ENTITY_DOMINATES_PAGE';

export interface TradeEntityFingerprint {
  entity_key: string;
  company_name: string;
  normalized_company: string;
  country: string;
  normalized_country: string;
  city: string;
  address_fragments: string[];
  role: string;
  trade_partners: string[];
  products: string[];
  source_file_id: string;
  dataset_id: string;
  feature_entity_frequency: Record<string, number>;
  feature_recurrence: Record<string, number>;
  verified_partner_domains: Record<string, string>;
}

export interface EntityProofEdge {
  type: EntityProofEdgeType;
  value: string;
  evidence_ref: string;
  source_url: string;
}

export interface EntityProofContradictionEdge {
  type: EntityProofContradictionType;
  value: string;
  evidence_ref: string;
  source_url: string;
}

export interface EntityProofCandidate {
  candidate_id: string;
  observed_names: string[];
  aliases: string[];
  country: string;
  city_address_fragments: string[];
  domains: string[];
  urls: string[];
  business_activity_hints: string[];
  trade_relationships: string[];
  products: string[];
  phones: string[];
  emails: string[];
  source_refs: string[];
  source_authorities: EntitySourceAuthority[];
  source_families: EntitySourceFamily[];
  supporting_evidence: EntityProofEdge[];
  contradicting_evidence: EntityProofContradictionEdge[];
  proof_paths: string[][];
  status: EntityProofCandidateStatus;
}

export interface EntityProofEvidenceInput {
  url: string;
  title?: string;
  content?: string;
  source_type?: string;
  admission_decision?: 'ADMIT' | 'HOLD' | 'REJECT';
  admission_reason?: string;
  official_domain?: string;
}

export interface EntityProofCandidateMemory {
  url: string;
  domain: string;
  title: string;
  decision: 'ADMIT' | 'HOLD' | 'REJECT';
  reason: string;
  authority: EntitySourceAuthority;
  family: EntitySourceFamily;
  candidate_id?: string;
}

export interface DiscriminatingResearchAction {
  query: string;
  target_type: 'company' | 'registry' | 'directory' | 'contact_page' | 'email' | 'leadership' | 'social_profiles';
  provider_id: 'serper' | 'tavily' | 'exa' | 'linkup' | 'hunter';
  discriminator: string;
  candidate_ids: string[];
  utility: number;
  reason: string;
}

export interface EntityProofBudget {
  max_candidates: number;
  max_discrimination_rounds: number;
  max_additional_searches: number;
  max_additional_retrievals: number;
  max_contact_recovery_searches: number;
}

export interface EntityProofState {
  enabled: true;
  phase: 'CANDIDATE_DISCOVERY' | 'CANDIDATE_DIFFERENTIATION' | 'ENTITY_SUPPORT' | 'DEEP_EXTRACTION' | 'COMPLETE';
  fingerprint: TradeEntityFingerprint;
  candidates: EntityProofCandidate[];
  actions: DiscriminatingResearchAction[];
  action_history: DiscriminatingResearchAction[];
  searches_used: number;
  retrievals_used: number;
  discrimination_rounds: number;
  discrimination_gain: number;
  budget: EntityProofBudget;
  result: Exclude<EntityProofCandidateStatus, 'ACTIVE'>;
  candidate_memory: EntityProofCandidateMemory[];
  rejected_domains: string[];
  contact_actions: DiscriminatingResearchAction[];
  contact_action_history: DiscriminatingResearchAction[];
  contact_searches_used: number;
}

const DEFAULT_BUDGET: EntityProofBudget = {
  max_candidates: 5,
  max_discrimination_rounds: 4,
  max_additional_searches: 3,
  max_additional_retrievals: 8,
  max_contact_recovery_searches: 4,
};

const uniq = (values: unknown[], max = 20): string[] => Array.from(new Set(values.map((v) => String(v || '').trim()).filter(Boolean))).slice(0, max);
const normalize = (value: unknown): string => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const digest = (value: string): string => createHash('sha256').update(value).digest('hex').slice(0, 14);
const GENERIC_ENTITY_WORDS = new Set(['company', 'co', 'corporation', 'corp', 'trading', 'trade', 'limited', 'ltd', 'inc', 'incorporated', 'group', 'pharma', 'pharmaceutical', 'pharmaceuticals']);
const words = (value: unknown): string[] => normalize(value).split(' ').filter((word) => word.length > 2 && !GENERIC_ENTITY_WORDS.has(word));
const quoted = (value: string): string => `"${String(value).replace(/"/g, '').trim()}"`;
const countryTextMatches = (text: string, country: string): boolean => {
  const normalizedCountry = canonicalCountryIdentityKey(country);
  return Boolean(normalizedCountry && detectCountryMentions(text).includes(normalizedCountry));
};

const TRADE_DATABASE_HOSTS = ['tendata.com', 'panjiva.com', 'importgenius.com', 'volza.com', 'trademo.com', 'tradeatlas.com', 'marketinsidedata.com', 'nbd.ltd'];
const BUSINESS_DIRECTORY_HOSTS = ['dnb.com', 'kompass.com', 'yellowpages.com', 'zoominfo.com', 'crunchbase.com'];
const PROFESSIONAL_HOSTS = ['linkedin.com', 'facebook.com'];

const hostMatches = (host: string, domains: string[]): boolean => domains.some((domain) => host === domain || host.endsWith(`.${domain}`));

export function classifyEntitySource(input: EntityProofEvidenceInput): { authority: EntitySourceAuthority; family: EntitySourceFamily } {
  const host = hostOf(input.url);
  const type = normalize(input.source_type);
  let officialHost = '';
  try { officialHost = new URL(input.official_domain || '').hostname.toLowerCase().replace(/^www\./, ''); } catch (_) {}
  if (officialHost && (host === officialHost || host.endsWith(`.${officialHost}`))) return { authority: 'OFFICIAL_COMPANY', family: 'official' };
  if (/(official branch)/.test(type)) return { authority: 'OFFICIAL_BRANCH', family: 'official' };
  if (/(government|registry|regulator|legal filing)/.test(type) || /(?:\.gov\.|\.gov$|companieshouse\.gov\.uk)/.test(host)) return { authority: 'GOVERNMENT_REGISTRY', family: 'government' };
  if (/(chamber|trade association|association)/.test(type) || /chamber|association/.test(host)) return { authority: 'CHAMBER_TRADE_ASSOCIATION', family: 'local-business' };
  if (/(official relationship|official partner|supplier|distributor)/.test(type)) return { authority: 'OFFICIAL_PARTNER_SUPPLIER_DISTRIBUTOR', family: 'partner' };
  if (hostMatches(host, TRADE_DATABASE_HOSTS) || /(trade database|trade directory)/.test(type)) return { authority: 'COMMERCIAL_TRADE_DATABASE', family: 'trade-data-derived' };
  if (hostMatches(host, PROFESSIONAL_HOSTS) || /(professional profile)/.test(type)) return { authority: 'PROFESSIONAL_BUSINESS_PROFILE', family: 'professional' };
  if (hostMatches(host, BUSINESS_DIRECTORY_HOSTS) || /(business directory)/.test(type)) return { authority: 'ESTABLISHED_BUSINESS_DIRECTORY', family: 'directory' };
  return { authority: 'OTHER_PUBLIC_SOURCE', family: 'other' };
}

export function isEntityProofSearchEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return /^(1|true|yes|on)$/i.test(String(env[ENTITY_PROOF_SEARCH_FLAG] || '').trim());
}

export function shouldUseEntityProofSearch(context: EntityResearchContext = {}, env: NodeJS.ProcessEnv = process.env): boolean {
  return isEntityProofSearchEnabled(env) && context.website_verified !== true;
}

export function buildTradeEntityFingerprint(companyName: string, context: EntityResearchContext = {}): TradeEntityFingerprint {
  const address = String(context.known_address || '').trim();
  const addressFragments = uniq(address.split(/[,;|]/).map((part) => part.trim()).filter((part) => part.length >= 4), 8);
  return {
    entity_key: canonicalEntityIdentityKey(companyName, context.country),
    company_name: String(companyName || '').trim(),
    normalized_company: canonicalCompanyIdentityKey(companyName),
    country: String(context.country || '').trim(),
    normalized_country: canonicalCountryIdentityKey(context.country),
    city: String(context.target_city || '').trim(),
    address_fragments: addressFragments,
    role: String(context.role || '').trim(),
    trade_partners: uniq(context.traded_with || [], 8),
    products: uniq(context.known_products || [], 8),
    source_file_id: String(context.source_file_id || '').trim(),
    dataset_id: String(context.dataset_id || '').trim(),
    feature_entity_frequency: { ...(context.trade_feature_entity_frequency || {}) },
    feature_recurrence: { ...(context.trade_feature_recurrence || {}) },
    verified_partner_domains: { ...(context.verified_partner_domains || {}) },
  };
}

function hostOf(url: string): string {
  try { return new URL(url).hostname.toLowerCase().replace(/^www\./, ''); } catch (_) { return ''; }
}

function evidenceRef(input: EntityProofEvidenceInput): string {
  return `entity_evidence_${digest(`${input.url}\u0000${input.title || ''}`)}`;
}

function candidateClusterKey(input: EntityProofEvidenceInput, fingerprint: TradeEntityFingerprint): string {
  const text = normalize(`${input.title || ''} ${input.content || ''}`);
  const targetName = normalize(fingerprint.company_name);
  if (targetName && text.includes(targetName) && (!fingerprint.normalized_country || countryTextMatches(text, fingerprint.normalized_country))) {
    return `target:${fingerprint.entity_key}`;
  }
  const host = hostOf(input.url);
  if (host) return host;
  return normalize(input.title || input.url).slice(0, 80);
}

export function generateEntityProofCandidates(
  fingerprint: TradeEntityFingerprint,
  evidence: EntityProofEvidenceInput[],
  budget: EntityProofBudget = DEFAULT_BUDGET
): EntityProofCandidate[] {
  const clusters = new Map<string, EntityProofEvidenceInput[]>();
  for (const item of evidence || []) {
    if (!item?.url) continue;
    const key = candidateClusterKey(item, fingerprint);
    if (!key) continue;
    const list = clusters.get(key) || [];
    list.push(item);
    clusters.set(key, list);
  }

  const candidates = Array.from(clusters.entries()).map(([cluster, items]): EntityProofCandidate => {
    const combined = items.map((item) => `${item.title || ''}\n${item.content || ''}`).join('\n');
    const lower = normalize(combined);
    const refItems = items.map((item) => ({ item, ref: evidenceRef(item) }));
    const support: EntityProofEdge[] = [];
    const contradictions: EntityProofContradictionEdge[] = [];
    const targetTokens = words(fingerprint.company_name);
    const nameMatches = targetTokens.length > 0 && targetTokens.every((token) => lower.includes(token));
    const exactPhrase = normalize(fingerprint.company_name) && lower.includes(normalize(fingerprint.company_name));
    const countryMatch = fingerprint.normalized_country && countryTextMatches(lower, fingerprint.normalized_country);
    const cityMatch = fingerprint.city && lower.includes(normalize(fingerprint.city));
    const matchedPartner = fingerprint.trade_partners.find((partner) => lower.includes(normalize(partner)));
    const matchedProduct = fingerprint.products.find((product) => words(product).some((token) => lower.includes(token)));
    const matchedAddress = fingerprint.address_fragments.find((fragment) => lower.includes(normalize(fragment)));
    const primary = refItems[0];
    const classifications = items.map(classifyEntitySource);
    const sourceAuthorities = uniq(classifications.map((item) => item.authority)) as EntitySourceAuthority[];
    const sourceFamilies = uniq(classifications.map((item) => item.family)) as EntitySourceFamily[];
    const edge = (type: EntityProofEdgeType, value: string) => support.push({ type, value, evidence_ref: primary.ref, source_url: primary.item.url });
    if (nameMatches || exactPhrase) edge('NAME_MATCH', fingerprint.company_name);
    if (countryMatch) edge('COUNTRY_MATCH', fingerprint.country);
    if (cityMatch) edge('CITY_MATCH', fingerprint.city);
    if (matchedPartner) edge('TRADE_PARTNER_MATCH', matchedPartner);
    if (matchedProduct) edge('PRODUCT_MATCH', matchedProduct);
    if (matchedAddress) edge('ADDRESS_OVERLAP', matchedAddress);
    const independentHosts = new Set(items.map((item) => hostOf(item.url)).filter(Boolean)).size;
    if (sourceFamilies.length >= 2) edge('INDEPENDENT_SOURCE_CORROBORATION', `${sourceFamilies.length} observable evidence families across ${independentHosts} domains`);

    const decisions = items.map((item) => item.admission_decision).filter(Boolean);
    if (decisions.includes('REJECT')) contradictions.push({ type: 'OTHER_ENTITY_DOMINATES_PAGE', value: 'Existing Trusted Evidence Admission rejected this source', evidence_ref: primary.ref, source_url: primary.item.url });
    const mentionedCountries = detectCountryMentions(combined);
    if (fingerprint.normalized_country && mentionedCountries.length > 0 && !mentionedCountries.includes(fingerprint.normalized_country) && !countryMatch) {
      contradictions.push({ type: 'WRONG_COUNTRY', value: 'Source presents another country without target-country support', evidence_ref: primary.ref, source_url: primary.item.url });
    }
    if (!nameMatches && !exactPhrase && normalize(items[0]?.title).length > 2) {
      contradictions.push({ type: 'OTHER_ENTITY_DOMINATES_PAGE', value: String(items[0]?.title || cluster), evidence_ref: primary.ref, source_url: primary.item.url });
    }

    const strongIdentity = support.some((item) => item.type === 'NAME_MATCH') && support.some((item) => item.type === 'COUNTRY_MATCH');
    const tradeSupport = support.some((item) => item.type === 'TRADE_PARTNER_MATCH') || support.some((item) => item.type === 'PRODUCT_MATCH');
    const officialSupport = sourceFamilies.includes('official');
    const legalSupport = sourceFamilies.includes('government');
    const businessFamilies = sourceFamilies.filter((family) => ['partner', 'professional', 'directory', 'local-business'].includes(family));
    let status: EntityProofCandidateStatus = 'UNRESOLVED';
    if (contradictions.length > 0 && !strongIdentity) status = 'REJECTED';
    else if (strongIdentity && officialSupport && contradictions.length === 0) status = 'OFFICIAL_WEB_IDENTITY_SUPPORTED';
    else if (strongIdentity && legalSupport && contradictions.length === 0) status = 'LEGAL_ENTITY_SUPPORTED';
    else if (strongIdentity && businessFamilies.length > 0 && sourceFamilies.length >= 2 && contradictions.length === 0) status = 'BUSINESS_ENTITY_SUPPORTED';
    else if (strongIdentity && tradeSupport && sourceFamilies.includes('trade-data-derived') && contradictions.length === 0) status = 'TRADE_ENTITY_SUPPORTED';
    else if (strongIdentity || (support.length >= 2 && contradictions.length === 0)) status = 'UNRESOLVED';
    else status = contradictions.length ? 'REJECTED' : 'ACTIVE';

    const urls = uniq(items.map((item) => item.url), 12);
    const proofPaths = support.length
      ? [
          ...support.filter((item) => item.type !== 'INDEPENDENT_SOURCE_CORROBORATION')
            .map((item) => [`TARGET:${fingerprint.entity_key}`, `${item.type}:${item.value}`, `SOURCE:${item.source_url}`]),
          ...urls.map((url) => [`TARGET:${fingerprint.entity_key}`, 'INDEPENDENT_SOURCE_CORROBORATION', `SOURCE:${url}`]),
        ]
      : [];
    return {
      candidate_id: `candidate_${digest(`${fingerprint.entity_key}\u0000${cluster}`)}`,
      observed_names: cluster.startsWith('target:') ? [fingerprint.company_name] : uniq(items.map((item) => item.title || '').filter(Boolean), 8),
      aliases: [],
      country: countryMatch ? fingerprint.country : '',
      city_address_fragments: uniq([cityMatch ? fingerprint.city : '', matchedAddress || '']),
      domains: uniq(urls.map(hostOf).filter(Boolean)),
      urls,
      business_activity_hints: matchedProduct ? [matchedProduct] : [],
      trade_relationships: matchedPartner ? [matchedPartner] : [],
      products: matchedProduct ? [matchedProduct] : [],
      // Candidate discovery must not promote regex hits from directory chrome.
      // Person/company facts are populated only by the normal grounded extraction
      // pipeline after the entity is supported.
      phones: [],
      emails: [],
      source_refs: urls,
      source_authorities: sourceAuthorities,
      source_families: sourceFamilies,
      supporting_evidence: support,
      contradicting_evidence: contradictions,
      proof_paths: proofPaths,
      status,
    };
  });

  const priority: Record<EntityProofCandidateStatus, number> = {
    OFFICIAL_WEB_IDENTITY_SUPPORTED: 7, LEGAL_ENTITY_SUPPORTED: 6, BUSINESS_ENTITY_SUPPORTED: 5,
    TRADE_ENTITY_SUPPORTED: 4, ACTIVE: 3, UNRESOLVED: 2, REJECTED: 1,
  };
  return candidates.sort((a, b) => priority[b.status] - priority[a.status] || b.supporting_evidence.length - a.supporting_evidence.length || a.candidate_id.localeCompare(b.candidate_id)).slice(0, budget.max_candidates);
}

function actionUtility(separation: number, authority: number, trade: number, entity: number, cost: number, latency: number, duplicate: number): number {
  return Number((separation + authority + trade + entity - cost - latency - duplicate).toFixed(3));
}

export function planDiscriminatingResearch(
  fingerprint: TradeEntityFingerprint,
  candidates: EntityProofCandidate[],
  attemptedQueries: string[] = [],
  budget: EntityProofBudget = DEFAULT_BUDGET
): DiscriminatingResearchAction[] {
  const attempted = new Set(attemptedQueries.map(normalize));
  const proposals: DiscriminatingResearchAction[] = [];
  const add = (query: string, discriminator: string, utility: number, provider: DiscriminatingResearchAction['provider_id'] = 'serper') => {
    if (!query || attempted.has(normalize(query)) || proposals.some((item) => normalize(item.query) === normalize(query))) return;
    proposals.push({ query: query.slice(0, 240), target_type: 'company', provider_id: provider, discriminator, candidate_ids: candidates.filter((candidate) => candidate.status !== 'REJECTED').map((candidate) => candidate.candidate_id), utility, reason: `Entity Proof Search: distinguish candidates using trusted ${discriminator}` });
  };

  const base = `${quoted(fingerprint.company_name)}${fingerprint.country ? ` ${quoted(fingerprint.country)}` : ''}`;
  const dtf = scoreDiscriminativeTransactionFeatures(fingerprint);
  for (const feature of dtf.filter((item) => item.kind === 'counterparty' || item.kind === 'product').slice(0, 3)) {
    add(`${base} ${quoted(feature.value)}`, `DTF ${feature.kind}: ${feature.value}`, feature.utility, 'serper');
  }
  for (const joint of planJointTransactionQueries(fingerprint, dtf, 2)) add(joint.query, `DTF joint: ${joint.features.join(' + ')}`, joint.utility, 'serper');
  if (fingerprint.city) add(`${base} ${quoted(fingerprint.city)}`, `city: ${fingerprint.city}`, actionUtility(0.8, 0.4, 0.2, 0.9, 0.2, 0.1, 0), 'serper');
  for (const fragment of fingerprint.address_fragments.slice(0, 1)) {
    add(`${quoted(fingerprint.company_name)} ${quoted(fragment)}`, `address fragment: ${fragment}`, actionUtility(0.9, 0.5, 0.2, 0.9, 0.2, 0.1, 0), 'serper');
  }
  for (const product of fingerprint.products.slice(0, 2)) {
    add(`${base} ${quoted(product)}`, `product: ${product}`, actionUtility(0.7, 0.3, 0.8, 0.7, 0.2, 0.1, 0), 'serper');
  }
  for (const witness of planRelationalWitnessActions(fingerprint, dtf, 1)) {
    add(witness.query, witness.discriminator, witness.utility, witness.provider_id);
  }
  for (const candidate of candidates.filter((item) => item.status === 'ACTIVE' || item.status === 'UNRESOLVED').slice(0, 2)) {
    const name = candidate.observed_names[0];
    if (name) add(`${quoted(name)} ${quoted(fingerprint.company_name)} ${fingerprint.country}`, `candidate identity: ${name}`, actionUtility(0.9, 0.4, 0.3, 0.8, 0.2, 0.1, 0.1), 'serper');
  }
  if (attemptedQueries.length >= 2 && candidates.every((candidate) => !['TRADE_ENTITY_SUPPORTED', 'BUSINESS_ENTITY_SUPPORTED', 'LEGAL_ENTITY_SUPPORTED', 'OFFICIAL_WEB_IDENTITY_SUPPORTED'].includes(candidate.status))) {
    add(`${base} business registry supplier distributor address`, 'complementary evidence family after lexical zero gain', actionUtility(1.0, 0.8, 0.5, 0.8, 0.4, 0.2, 0), 'tavily');
    if (attemptedQueries.length >= 3) add(`${base} company profile leadership location`, 'semantic entity differentiation', actionUtility(0.9, 0.6, 0.3, 0.8, 0.4, 0.2, 0), 'exa');
    if (attemptedQueries.length >= 4) add(`${base} public business contact registry`, 'independent discovery coverage', actionUtility(0.8, 0.6, 0.3, 0.7, 0.35, 0.2, 0), 'linkup');
  }
  if (proposals.length === 0) add(`${base} registry chamber importer`, 'independent registry/chamber corroboration', actionUtility(0.6, 0.8, 0.3, 0.8, 0.2, 0.1, 0), 'serper');
  const ranked = proposals.sort((a, b) => b.utility - a.utility || a.query.localeCompare(b.query));
  const selected = ranked.slice(0, budget.max_additional_searches);
  // Once lexical searches have produced zero gain, reserve one bounded slot for
  // a genuinely complementary evidence family even when DTF proposals score
  // slightly higher. Otherwise richer DTF decomposition can starve escalation.
  const complementary = ranked.find((item) => item.provider_id === 'tavily');
  if (complementary && !selected.includes(complementary) && selected.length > 0) selected[selected.length - 1] = complementary;
  return selected;
}

export function createEntityProofState(companyName: string, context: EntityResearchContext = {}, budget: Partial<EntityProofBudget> = {}): EntityProofState {
  return {
    enabled: true,
    phase: 'CANDIDATE_DISCOVERY',
    fingerprint: buildTradeEntityFingerprint(companyName, context),
    candidates: [],
    actions: [],
    action_history: [],
    searches_used: 0,
    retrievals_used: 0,
    discrimination_rounds: 0,
    discrimination_gain: 0,
    budget: { ...DEFAULT_BUDGET, ...budget },
    result: 'UNRESOLVED',
    candidate_memory: [],
    rejected_domains: [],
    contact_actions: [],
    contact_action_history: [],
    contact_searches_used: 0,
  };
}

export function isEntitySupportedForContactRecovery(status: EntityProofState['result']): boolean {
  return ['TRADE_ENTITY_SUPPORTED', 'BUSINESS_ENTITY_SUPPORTED', 'LEGAL_ENTITY_SUPPORTED', 'OFFICIAL_WEB_IDENTITY_SUPPORTED'].includes(status);
}

export function verifiedDomainForHunter(state: EntityProofState): string {
  const official = state.candidates.find((candidate) => candidate.status === 'OFFICIAL_WEB_IDENTITY_SUPPORTED');
  return official?.domains[0] || '';
}

export function planContactRecoveryActions(
  state: EntityProofState,
  missingFields: string[],
  attemptedQueries: string[],
  zeroGainStreak: number,
  providerAvailability: Partial<Record<'serper' | 'tavily' | 'exa' | 'linkup' | 'hunter', boolean>> = {}
): DiscriminatingResearchAction[] {
  if (!isEntitySupportedForContactRecovery(state.result)) return [];
  const missing = new Set(missingFields);
  const attempted = new Set(attemptedQueries.map(normalize));
  const company = quoted(state.fingerprint.company_name);
  const country = state.fingerprint.country ? quoted(state.fingerprint.country) : '';
  const base = `${company} ${country}`.trim();
  const actions: DiscriminatingResearchAction[] = [];
  const candidateIds = state.candidates.filter((candidate) => candidate.status === state.result).map((candidate) => candidate.candidate_id);
  const add = (query: string, target: DiscriminatingResearchAction['target_type'], provider: DiscriminatingResearchAction['provider_id'], field: string, authority: number) => {
    if (providerAvailability[provider] === false || attempted.has(normalize(query)) || actions.some((item) => normalize(item.query) === normalize(query))) return;
    const semanticPenalty = provider === 'serper' ? 0 : 0.35;
    const duplicatePenalty = zeroGainStreak > 0 && provider === 'serper' ? 0.5 : 0;
    actions.push({
      query: query.slice(0, 240), target_type: target, provider_id: provider,
      discriminator: `contact field: ${field}`, candidate_ids: candidateIds,
      utility: actionUtility(0.4, authority, 0.3, 0.8, 0.2 + semanticPenalty, 0.1, duplicatePenalty),
      reason: `Contact Intelligence Recovery: ${field} via ${provider}`,
    });
  };

  if (missing.has('address')) {
    add(`${base} address head office branch warehouse registry chamber filetype:pdf`, 'registry', 'serper', 'address', 0.9);
    if (zeroGainStreak > 0) add(`${base} office location address tender distributor`, 'directory', 'tavily', 'address complementary evidence', 0.7);
  }
  if (missing.has('phone') || missing.has('fax')) {
    add(`${base} telephone phone fax contact address`, 'directory', 'serper', 'phone/fax', 0.7);
    if (zeroGainStreak > 0) add(`${base} phone fax public document`, 'directory', 'linkup', 'phone/fax complementary evidence', 0.6);
  }
  if (missing.has('email')) {
    add(`${base} email contact "@" filetype:pdf`, 'directory', 'serper', 'attributable email', 0.7);
    if (zeroGainStreak > 0) add(`${base} public email contact team`, 'directory', 'tavily', 'email complementary evidence', 0.6);
    const verifiedDomain = verifiedDomainForHunter(state);
    if (verifiedDomain && providerAvailability.hunter !== false) {
      add(verifiedDomain, 'email', 'hunter', 'verified-domain email discovery', 0.8);
    }
  }
  if (missing.has('contact_persons') || missing.has('leadership')) {
    add(`${base} CEO "Managing Director" procurement sales commercial import export`, 'directory', 'exa', 'leadership/decision makers', 0.8);
    if (zeroGainStreak > 0) add(`${base} management director procurement distributor announcement`, 'directory', 'tavily', 'leadership complementary evidence', 0.7);
  }
  if (missing.has('linkedin') || missing.has('professional_profiles')) {
    add(`${base} LinkedIn company director manager`, 'directory', 'exa', 'professional profiles', 0.6);
  }
  const sorted = actions.sort((a, b) => b.utility - a.utility || a.query.localeCompare(b.query));
  const remaining = Math.max(0, state.budget.max_contact_recovery_searches - state.contact_searches_used);
  const selected: DiscriminatingResearchAction[] = [];
  const attemptedField = (field: string) => state.contact_action_history.some((item) => item.discriminator.includes(field));
  for (const field of ['address', 'attributable email', 'phone/fax', 'leadership']) {
    if (attemptedField(field)) continue;
    const action = field === 'attributable email' && verifiedDomainForHunter(state)
      ? sorted.find((item) => item.provider_id === 'hunter' && !selected.includes(item))
      : sorted.find((item) => item.discriminator.includes(field) && !selected.includes(item));
    if (action && selected.length < remaining) selected.push(action);
  }
  for (const action of sorted) {
    if (selected.length >= remaining) break;
    if (!selected.includes(action)) selected.push(action);
  }
  return selected;
}

export function updateEntityProofState(state: EntityProofState, evidence: EntityProofEvidenceInput[], attemptedQueries: string[]): EntityProofState {
  const previousActive = state.candidates.filter((candidate) => candidate.status !== 'REJECTED').length;
  const candidates = generateEntityProofCandidates(state.fingerprint, evidence, state.budget);
  const active = candidates.filter((candidate) => candidate.status !== 'REJECTED').length;
  const supportPriority: EntityProofCandidateStatus[] = ['OFFICIAL_WEB_IDENTITY_SUPPORTED', 'LEGAL_ENTITY_SUPPORTED', 'BUSINESS_ENTITY_SUPPORTED', 'TRADE_ENTITY_SUPPORTED'];
  const supported = candidates.filter((candidate) => supportPriority.includes(candidate.status));
  const supportedState = supportPriority.find((status) => supported.some((candidate) => candidate.status === status));
  const result: EntityProofState['result'] = supported.length === 1 && supportedState ? supportedState as EntityProofState['result'] : candidates.every((candidate) => candidate.status === 'REJECTED') && candidates.length ? 'REJECTED' : 'UNRESOLVED';
  const actions = planDiscriminatingResearch(state.fingerprint, candidates, attemptedQueries, state.budget);
  const memoryByUrl = new Map(state.candidate_memory.map((item) => [item.url, item]));
  for (const item of evidence) {
    const classified = classifyEntitySource(item);
    memoryByUrl.set(item.url, {
      url: item.url,
      domain: hostOf(item.url),
      title: String(item.title || ''),
      decision: item.admission_decision || 'HOLD',
      reason: String(item.admission_reason || 'Observed during bounded entity proof search'),
      authority: classified.authority,
      family: classified.family,
      candidate_id: candidates.find((candidate) => candidate.urls.includes(item.url))?.candidate_id,
    });
  }
  const candidateMemory = Array.from(memoryByUrl.values()).slice(-state.budget.max_candidates * 4);
  const rejectedDomains = uniq(candidateMemory.filter((item) => item.decision === 'REJECT').map((item) => item.domain).filter(Boolean), state.budget.max_candidates * 2);
  return {
    ...state,
    candidates,
    actions,
    discrimination_gain: state.discrimination_gain + Math.max(0, previousActive - active) + supported.length,
    phase: supported.length === 1 ? 'ENTITY_SUPPORT' : candidates.length ? 'CANDIDATE_DIFFERENTIATION' : 'CANDIDATE_DISCOVERY',
    result,
    candidate_memory: candidateMemory,
    rejected_domains: rejectedDomains,
  };
}

export function canRunEntityProofAction(state: EntityProofState): boolean {
  return !['TRADE_ENTITY_SUPPORTED', 'BUSINESS_ENTITY_SUPPORTED', 'LEGAL_ENTITY_SUPPORTED', 'OFFICIAL_WEB_IDENTITY_SUPPORTED'].includes(state.result)
    && state.searches_used < state.budget.max_additional_searches
    && state.retrievals_used < state.budget.max_additional_retrievals
    && state.discrimination_rounds < state.budget.max_discrimination_rounds;
}
