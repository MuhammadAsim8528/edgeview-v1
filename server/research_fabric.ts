import { AppSettings } from './settings';
import { ResourceGovernor } from './resource_governor';
import { classifyCanonicalSourceAuthority } from './source_authority';
import { isCountryCompatiblePhone } from './phone_country';

/**
 * Canonically represents a consolidated, high-fidelity corporate profile.
 */
export interface ContactProfile {
  company_name: string;
  website: string;
  address: string;
  phone: string;
  email: string;
  linkedin: string;
  industry: string;
  country: string;
  fax_numbers: string[];
  emails_list: string[];
  phones_list: string[];
  linkedin_urls: string[];
  addresses: { address: string; type: string; source_url: string }[];
  contact_persons: {
    name: string;
    designation: string;
    email: string;
    phone: string;
    department: string;
    source_url: string;
  }[];
  quality_status: 'COMPLETE' | 'PARTIAL' | 'NOT_FOUND' | 'FAILED';
  sources: { url: string; title: string; source_type: string }[];
  evidence: {
    field: string;
    value: string;
    source_url: string;
    source_type?: string;
    confidence?: number;
    evidence_text?: string;
    observed_at?: string;
    temporal_conflict?: boolean;
    observed_dates?: string[];
  }[];
}

/**
 * Provider metadata representing capabilities, costs, and limits.
 */
export interface ProviderMetadata {
  id: string;
  name: string;
  capabilities: string[];
  costMultiplier: number;
  valueScore: number;
  timeoutMs: number;
  supportedStrategies: ('search' | 'scrape' | 'structured-extraction' | 'browser-execution')[];
}

/**
 * A central registry for all available providers and their capabilities.
 */
export class ProviderCapabilityRegistry {
  private static providers: Record<string, ProviderMetadata> = {
    serper: {
      id: 'serper',
      name: 'Serper',
      capabilities: [
        'google-result-discovery',
        'official-website-discovery',
        'social-discovery',
        'targeted-query-execution',
        'company-identity-resolution'
      ],
      costMultiplier: 1.0,
      valueScore: 8,
      timeoutMs: 15000,
      supportedStrategies: ['search']
    },
    tavily: {
      id: 'tavily',
      name: 'Tavily',
      capabilities: [
        'broad-web-research',
        'multi-source-discovery',
        'company-person-research',
        'alternative-scraping-fallback',
        'leadership-discovery'
      ],
      costMultiplier: 2.0,
      valueScore: 9,
      timeoutMs: 25000,
      supportedStrategies: ['search']
    },
    exa: {
      id: 'exa',
      name: 'Exa',
      capabilities: [
        'semantic-web-discovery',
        'company-discovery',
        'person-leadership-discovery',
        'concept-related-discovery',
        'leadership-discovery'
      ],
      costMultiplier: 2.0,
      valueScore: 9,
      timeoutMs: 25000,
      supportedStrategies: ['search']
    },
    linkup: {
      id: 'linkup',
      name: 'Linkup',
      capabilities: [
        'web-research-retrieval',
        'alternative-discovery-path',
        'unscrappable-extracting',
        'person-discovery'
      ],
      costMultiplier: 1.5,
      valueScore: 7,
      timeoutMs: 20000,
      supportedStrategies: ['search']
    },
    hunter: {
      id: 'hunter',
      name: 'Hunter',
      capabilities: [
        'domain-identification',
        'corporate-email-discovery',
        'email-pattern-intelligence',
        'email-verification'
      ],
      costMultiplier: 1.2,
      valueScore: 10,
      timeoutMs: 15000,
      supportedStrategies: ['structured-extraction']
    },
    firecrawl: {
      id: 'firecrawl',
      name: 'Firecrawl',
      capabilities: [
        'deep-raw-http-scraping',
        'markdown-extraction',
        'static-page-scraping'
      ],
      costMultiplier: 1.0,
      valueScore: 8,
      timeoutMs: 30000,
      supportedStrategies: ['scrape']
    },
    apify: {
      id: 'apify',
      name: 'Apify Crawler',
      capabilities: [
        'programmable-browser-execution',
        'dynamic-client-side-rendering',
        'deep-javascript-heavy-scraping',
        'structured-contact-extraction',
        'custom-actor-execution'
      ],
      costMultiplier: 3.5, // High resource characteristic
      valueScore: 10,       // Exceptional dynamic extraction quality
      timeoutMs: 65000,
      supportedStrategies: ['scrape', 'browser-execution', 'structured-extraction']
    },
    gemini: {
      id: 'gemini',
      name: 'Gemini',
      capabilities: ['multimodal-reasoning', 'evidence-synthesis', 'structured-extraction', 'dynamic-task-planning'],
      costMultiplier: 1.0,
      valueScore: 8,
      timeoutMs: 30000,
      supportedStrategies: ['structured-extraction']
    },
    nvidia: {
      id: 'nvidia',
      name: 'NVIDIA NIM',
      capabilities: ['high-performance-query-planning', 'complex-strategy-reasoning', 'structured-json-extraction'],
      costMultiplier: 2.0,
      valueScore: 9,
      timeoutMs: 30000,
      supportedStrategies: ['structured-extraction']
    },
    groq: {
      id: 'groq',
      name: 'Groq',
      capabilities: ['ultra-fast-text-generation', 'rapid-structured-parsing', 'simple-classification'],
      costMultiplier: 1.0,
      valueScore: 8,
      timeoutMs: 30000,
      supportedStrategies: ['structured-extraction']
    }
  };

  public static getProviders(): ProviderMetadata[] {
    return Object.values(this.providers);
  }

  public static getProvider(id: string): ProviderMetadata | undefined {
    return this.providers[id];
  }

  public static isConfigured(id: string, settings: AppSettings): boolean {
    switch (id) {
      case 'serper': return Boolean(settings.serper_api_key?.trim()) && settings.serper_enabled;
      case 'tavily': return Boolean(settings.tavily_api_key?.trim()) && settings.tavily_enabled;
      case 'exa': return Boolean(settings.exa_api_key?.trim()) && settings.exa_enabled;
      case 'linkup': return Boolean(settings.linkup_api_key?.trim()) && settings.linkup_enabled;
      case 'hunter': return Boolean(settings.hunter_api_key?.trim()) && settings.hunter_enabled;
      case 'firecrawl': return Boolean(settings.firecrawl_api_key?.trim()) && settings.firecrawl_enabled;
      case 'apify': return Boolean((settings as any).apify_api_key?.trim()) && ((settings as any).apify_enabled ?? true);
      case 'gemini': return Boolean(process.env.GEMINI_API_KEY?.trim()) && settings.gemini_enabled !== false;
      case 'nvidia': return Boolean(settings.nvidia_api_key?.trim()) && settings.nvidia_enabled !== false;
      case 'groq': return Boolean(settings.groq_api_key?.trim()) && settings.groq_enabled !== false;
      default: return false;
    }
  }

  public static isHealthy(id: string): boolean {
    const state = ResourceGovernor.getCircuitStateName(id as any);
    return state === 'CLOSED' || state === 'HALF-OPEN';
  }
}

import { createHash } from 'node:crypto';

/**
 * An individual observation of a fact from a specific source/provider.
 */
export interface FactObservation {
  url: string;
  provider: string;
  method: string;
  confidence: number;
  timestamp: string;
  snippet?: string;
  sourceFamily?: string;
  observedAt?: string;
}

export type SourceFamily = 'official' | 'government' | 'partner' | 'trade-data' | 'directory' | 'professional' | 'news' | 'social' | 'other';

function classifySourceFamily(url: string, method: string): SourceFamily {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
    if (host.endsWith('.gov') || host.endsWith('.gov.') || /\.gov\./.test(host)) return 'government';
    if (host.includes('crunchbase') || host.includes('linkedin') || host.includes('zoominfo') || host.includes('apollo.io')) return 'directory';
    if (host.includes('tendata') || host.includes('importgenius') || host.includes('volza') || host.includes('panjiva') || host.includes('oec.world')) return 'trade-data';
    if (host.includes('partner') || host.includes('distributor') || host.includes('supplier')) return 'partner';
    if (host.includes('news') || host.includes('reuters') || host.includes('bloomberg') || host.includes('ft.com')) return 'news';
    if (host.includes('facebook') || host.includes('twitter') || host.includes('x.com') || host.includes('instagram')) return 'social';
    if (method === 'LLM_AI_EXTRACT' || method === 'AI_EXTRACT') return 'official';
    return 'other';
  } catch {
    return 'other';
  }
}

const DATE_PATTERNS = [
  /\b(\d{4}-\d{2}-\d{2})\b/g,                          // ISO YYYY-MM-DD
  /\b(\d{2}\/\d{2}\/\d{4})\b/g,                        // MM/DD/YYYY
  /\b(\d{2}-\d{2}-\d{4})\b/g,                          // DD-MM-YYYY
  /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4}\b/gi, // MMM DD, YYYY
  /\b\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}\b/gi, // DD MMM YYYY
  /\b(?:20\d{2})\b/g,                                  // Year only 20XX
];

function extractObservedDate(text: string): string | undefined {
  for (const pattern of DATE_PATTERNS) {
    const matches = text.match(pattern);
    if (matches && matches.length > 0) {
      // Return the first match as ISO string if possible
      const match = matches[0];
      const parsed = new Date(match);
      if (!isNaN(parsed.getTime())) return parsed.toISOString().split('T')[0];
      return match;
    }
  }
  return undefined;
}

/**
 * Node in the Evidence Graph.
 */
export interface EvidenceNode {
  id: string;
  type: 'url' | 'fact';
  label: string;
    metadata: {
      url?: string;
      provider?: string;
      method?: string;
      timestamp?: string;
      confidence?: number;
      field?: string;
      value?: any;
      snippet?: string;
        observations?: FactObservation[];
        corroborationCount?: number;
        independentFamilies?: number;
        observed_at?: string;
        temporal_conflict?: boolean;
        observed_dates?: string[];
      };


}

/**
 * Directed edge in the Evidence Graph.
 */
export interface EvidenceEdge {
  sourceId: string;
  targetId: string;
  relationship: string; // e.g., "extracted_from", "discovered_by"
}

/**
 * Tracks and structures all crawled sources, snippets, and factual nodes with SHA-256 collision resistance.
 */
export class EvidenceGraph {
  public nodes = new Map<string, EvidenceNode>();
  public edges: EvidenceEdge[] = [];

  public addNode(node: EvidenceNode) {
    this.nodes.set(node.id, node);
  }

  public addEdge(sourceId: string, targetId: string, relationship: string) {
    this.edges.push({ sourceId, targetId, relationship });
  }

  public addFact(
    field: string,
    value: any,
    sourceUrl: string,
    provider: string,
    method: string,
    confidence = 0.8,
    snippet?: string
  ) {
    if (/^(?:search_snippet|search_metadata)$/i.test(String(method || '').trim())) return;
    const valueKey = (typeof value === 'object' && value !== null && (value as any).name)
      ? `name:${String((value as any).name).toLowerCase().trim()}`
      : String(value).toLowerCase().trim();

    // Canonical SHA-256 fact identity: unique per (field, normalized_value)
    const hash = createHash('sha256').update(`${field.toLowerCase().trim()}\0${valueKey}`).digest('hex');
    const factId = `fact-${field.toLowerCase().trim()}-${hash.slice(0, 16)}`;
    
    // Ensure URL node exists
    const urlNodeId = `url-${sourceUrl}`;
    if (!this.nodes.has(urlNodeId)) {
      this.addNode({
        id: urlNodeId,
        type: 'url',
        label: sourceUrl,
        metadata: { url: sourceUrl, provider }
      });
    }

    const sourceFamily = classifySourceFamily(sourceUrl, method);
    const observedAt = extractObservedDate(snippet || '');
    const observation: FactObservation = {
      url: sourceUrl,
      provider,
      method,
      confidence,
      timestamp: new Date().toISOString(),
      snippet,
      sourceFamily,
      observedAt,
    };

    const existing = this.nodes.get(factId);
    if (existing) {
      // Multi-source observation aggregation
      const obs = existing.metadata.observations || [];
      obs.push(observation);
      existing.metadata.observations = obs;
      // Count distinct source families for independent corroboration
      const distinctFamilies = new Set(obs.map((o: FactObservation) => o.sourceFamily).filter(Boolean)).size;
      existing.metadata.corroborationCount = distinctFamilies;
      // Boost confidence asymptotically on corroboration from INDEPENDENT source families only
      if (distinctFamilies > (existing.metadata.independentFamilies || 0)) {
        existing.metadata.independentFamilies = distinctFamilies;
        existing.metadata.confidence = Math.min(0.99, (existing.metadata.confidence || confidence) + 0.05);
      }
    } else {
      // Add canonical fact node
      this.addNode({
        id: factId,
        type: 'fact',
        label: `${field}: ${String(value)}`,
        metadata: {
          field,
          value,
          url: sourceUrl,
          provider,
          method,
          timestamp: new Date().toISOString(),
          confidence,
          snippet,
          observations: [observation],
          corroborationCount: 1,
          independentFamilies: 1,
        }
      });
    }

    // Draw edge from fact to this source URL
    this.addEdge(factId, urlNodeId, 'extracted_from');
  }

  public getNodes(): EvidenceNode[] {
    return Array.from(this.nodes.values());
  }

  public getFacts(): EvidenceNode[] {
    return this.getNodes().filter(n => n.type === 'fact');
  }
}

/**
 * Merges multi-source evidence based on source quality, confidence, and provider characteristics.
 */
export class EvidenceFusionEngine {
  /**
   * Evaluates the gathered EvidenceGraph and resolves a single consolidated profile.
   */
  public static fuse(
    graph: EvidenceGraph,
    companyName: string,
    country = ''
): ContactProfile {
    const facts = graph.getFacts();

    // Track email facts for official website boosting
    const emailFactsRaw: Array<{ email: string; score: number; observations: any[] }> = [];
    const phonesSet = new Set<string>();
    const faxesSet = new Set<string>();
    const linkedinSet = new Set<string>();
    const addressesMap = new Map<string, { address: string; type: string; source_url: string }>();
    const contactsMap = new Map<string, any>();
    
    let bestWebsite = '';
    let bestIndustry = '';
    const websiteScores = new Map<string, number>();
    const industryScores = new Map<string, number>();

    function cpTitle(t: string): string {
      return t;
    }

    // Sort facts by confidence and provider quality score
    const scoredFacts = facts.map(f => {
      const providerMeta = ProviderCapabilityRegistry.getProvider(f.metadata.provider || '');
      const valueScore = providerMeta?.valueScore || 5;
      const confidence = f.metadata.confidence || 0.8;
      const combinedScore = valueScore * confidence;
      return { node: f, combinedScore };
    }).sort((a, b) => b.combinedScore - a.combinedScore);

    // First pass: collect website scores and raw email facts
    for (const item of scoredFacts) {
      const fact = item.node;
      const field = fact.metadata.field;
      const val = fact.metadata.value;
      const srcUrl = fact.metadata.url || '';
      const score = item.combinedScore;

      if (!val) continue;

      switch (field) {
        case 'email': {
          const emailStr = String(val).trim().toLowerCase();
          if (emailStr.includes('@') && emailStr.includes('.')) {
            emailFactsRaw.push({ email: emailStr, score, observations: fact.metadata.observations || [] });
          }
          break;
        }
        case 'phone': {
          const phoneStr = String(val).trim();
          if (isCountryCompatiblePhone(phoneStr, country)) {
            phonesSet.add(phoneStr);
          }
          break;
        }
        case 'fax': {
          const faxStr = String(val).trim();
          if (isCountryCompatiblePhone(faxStr, country)) {
            faxesSet.add(faxStr);
          }
          break;
        }
        case 'linkedin': {
          const lkStr = String(val).trim();
          if (lkStr.toLowerCase().includes('linkedin.com')) {
            linkedinSet.add(lkStr);
          }
          break;
        }
        case 'website': {
          const webStr = String(val).trim();
          const currentScore = websiteScores.get(webStr) || 0;
          websiteScores.set(webStr, currentScore + score);
          break;
        }
        case 'industry': {
          const indStr = String(val).trim();
          const currentScore = industryScores.get(indStr) || 0;
          industryScores.set(indStr, currentScore + score);
          break;
        }
        case 'address': {
          let addrStr = '';
          let addrType = 'UNKNOWN_BUSINESS_ADDRESS';
          if (typeof val === 'object' && val.address) {
            addrStr = String(val.address).trim();
            const proposed = String(val.type || '').trim().toUpperCase().replace(/[ -]+/g, '_');
            const supportedTypes = new Set(['REGISTERED_OFFICE','HEAD_OFFICE','BRANCH','WAREHOUSE','MANUFACTURING','DISTRIBUTION','OTHER_BUSINESS_ADDRESS','UNKNOWN_BUSINESS_ADDRESS']);
            addrType = supportedTypes.has(proposed) ? proposed : 'UNKNOWN_BUSINESS_ADDRESS';
          } else {
            addrStr = String(val).trim();
          }

          if (addrStr.length > 5) {
            const key = addrStr.toLowerCase().replace(/\s+/g, ' ');
            if (!addressesMap.has(key)) {
              addressesMap.set(key, { address: addrStr, type: addrType, source_url: srcUrl });
            }
          }
          break;
        }
        case 'contact_person': {
          let name = '';
          let designation = 'Executive';
          let email = '';
          let phone = '';
          let department = '';

          if (typeof val === 'object') {
            name = String(val.name || '').trim();
            designation = String(val.designation || cpTitle(designation)).trim();
            email = String(val.email || '').trim();
            phone = String(val.phone || '').trim();
            department = String(val.department || '').trim();
          } else {
            name = String(val).trim();
          }

          if (name.length > 1) {
            const key = name.toLowerCase().replace(/\s+/g, ' ');
            const existing = contactsMap.get(key);
            if (!existing) {
              contactsMap.set(key, { name, designation, email, phone, department, source_url: srcUrl });
            } else {
              if (!existing.email && email) existing.email = email;
              if (!existing.phone && phone) existing.phone = phone;
              if ((!existing.designation || existing.designation === 'Executive') && designation) {
                existing.designation = designation;
              }
            }
          }
          break;
        }
      }
    }

    // Resolve best website
    let maxWebScore = 0;
    for (const [web, s] of websiteScores.entries()) {
      if (s > maxWebScore) {
        maxWebScore = s;
        bestWebsite = web;
      }
    }

    // Resolve best industry
    let maxIndScore = 0;
    for (const [ind, s] of industryScores.entries()) {
      if (s > maxIndScore) {
        maxIndScore = s;
        bestIndustry = ind;
      }
    }

    // Second pass: process email facts with official website host boosting
    const officialHost = bestWebsite ? (() => { try { return new URL(bestWebsite).hostname.toLowerCase().replace(/^www\./, ''); } catch { return ''; } })() : '';
    const emailFacts: Array<{ email: string; score: number; hasOfficialHost: boolean }> = [];
    for (const raw of emailFactsRaw) {
      let hasOfficialHost = false;
      if (officialHost) {
        hasOfficialHost = raw.observations.some((obs: any) => {
          try {
            const obsHost = new URL(obs.url).hostname.toLowerCase().replace(/^www\./, '');
            return obsHost === officialHost || obsHost.endsWith(`.${officialHost}`);
          } catch { return false; }
        });
      }
      emailFacts.push({ email: raw.email, score: hasOfficialHost ? raw.score * 2 : raw.score, hasOfficialHost });
    }

    // Prefer emails from official website host
    const emailFactsSorted = emailFacts
      .sort((a, b) => b.score - a.score)
      .map(e => e.email);
    const emailsList = Array.from(new Set(emailFactsSorted));
    const phonesList = Array.from(phonesSet);
    const faxesList = Array.from(faxesSet);
    const linkedinList = Array.from(linkedinSet);
    const addressesList = Array.from(addressesMap.values());
    const contactsList = Array.from(contactsMap.values());

    const hasEmail = emailsList.length > 0;
    const hasPhone = phonesList.length > 0;
    const hasAddress = addressesList.length > 0;

    let quality_status: ContactProfile['quality_status'] = 'NOT_FOUND';
    if (hasEmail && hasPhone && hasAddress) {
      quality_status = 'COMPLETE';
    } else if (hasEmail || hasPhone || hasAddress) {
      quality_status = 'PARTIAL';
    }

    // Construct evidence list for the canonical profile
    const evidenceList: ContactProfile['evidence'] = [];
    for (const fact of facts) {
      if ((fact.metadata.field === 'phone' || fact.metadata.field === 'fax') && !isCountryCompatiblePhone(fact.metadata.value, country)) continue;
      const rawVal = fact.metadata.value;
      let valueStr = '';
      if (rawVal && typeof rawVal === 'object') {
        const objVal = rawVal as any;
        valueStr = objVal.name
          ? `${objVal.name}${objVal.designation ? ` (${objVal.designation})` : ''}`
          : (objVal.address || JSON.stringify(rawVal));
      } else {
        valueStr = String(rawVal ?? '');
      }
      const observations = fact.metadata.observations || [];
      const dates = observations.map((o: any) => o.observedAt).filter(Boolean);
      const uniqueDates = Array.from(new Set(dates));
      const temporalConflict = uniqueDates.length > 1;
      const latestDate = uniqueDates.sort().pop();
      evidenceList.push({
        field: fact.metadata.field || 'General',
        value: valueStr,
        source_url: fact.metadata.url || '',
        source_type: classifyCanonicalSourceAuthority(fact.metadata.url || '', fact.metadata.method || '', bestWebsite),
        confidence: fact.metadata.confidence || 0.8,
        evidence_text: fact.metadata.snippet || `Extracted ${fact.metadata.field} fact from ${fact.metadata.url}`,
        observed_at: latestDate,
        temporal_conflict: temporalConflict,
        observed_dates: uniqueDates.length > 0 ? uniqueDates : undefined
      });
    }

    // Generate standard sources
    const sources: ContactProfile['sources'] = Array.from(new Set(facts.map(f => f.metadata.url).filter(Boolean)))
      .map(url => ({
        url: url!,
        title: 'Collected Research Source',
        source_type: classifyCanonicalSourceAuthority(url!, '', bestWebsite)
      }));

    return {
      company_name: companyName,
      website: bestWebsite,
      address: addressesList[0]?.address || '',
      phone: phonesList[0] || '',
      email: emailsList[0] || '',
      linkedin: linkedinList[0] || '',
      industry: bestIndustry,
      country,
      fax_numbers: faxesList,
      emails_list: emailsList,
      phones_list: phonesList,
      linkedin_urls: linkedinList,
      addresses: addressesList,
      contact_persons: contactsList,
      quality_status,
      sources,
      evidence: evidenceList
    };
  }
}

/**
 * Capability-aware task planner to outline optimal multi-provider steps.
 */
export class ResearchTaskPlanner {
  public static plan(
    companyName: string,
    extraContext?: { country?: string; website?: string; role?: string },
    settings?: AppSettings,
    missingFields?: string[]
  ): { targetType: string; query: string; providerId: string; reason: string }[] {
    const country = extraContext?.country || '';
    const website = extraContext?.website || '';
    const missing = new Set<string>(missingFields || []);
    const withCountry = (query: string): string => {
      const c = country.trim();
      if (!c) return query;
      const cLower = c.toLowerCase();
      if (query.toLowerCase().includes(cLower)) return query;
      return `${query} ${c}`;
    };
    
    // When a partial cache exists, only research fields that are still missing.
    const shouldResearch = (field: string, alwaysIfUnknown = true): boolean => {
      if (missing.size === 0) return alwaysIfUnknown;
      return missing.has(field);
    };

    const tasks: { targetType: string; query: string; providerId: string; reason: string }[] = [];

    // Helper to find best healthy configured provider for a capability
    const getBestProvider = (capability: string, defaultFallback = 'serper'): string => {
      if (!settings) return defaultFallback;

      const candidates = ProviderCapabilityRegistry.getProviders()
        .filter(p => ProviderCapabilityRegistry.isConfigured(p.id, settings) && ProviderCapabilityRegistry.isHealthy(p.id))
        .filter(p => p.capabilities.includes(capability))
        .sort((a, b) => b.valueScore - a.valueScore);

      return candidates[0]?.id || defaultFallback;
    };

    // Task 1: Find official domain & contact page
    if (!website) {
      if (shouldResearch('website')) {
        const provider = getBestProvider('official-website-discovery', 'serper');
        tasks.push({
          targetType: 'website',
          query: `${companyName} ${country} official website contact`,
          providerId: provider,
          reason: 'Locate official corporate domain'
        });
      }
    } else {
      // If we already have the domain, execute search directly on domain/email pattern
      if (shouldResearch('email') || shouldResearch('phone') || shouldResearch('address')) {
        const provider = getBestProvider('domain-identification', 'serper');
        tasks.push({
          targetType: 'website_details',
          query: withCountry(`${companyName} contact email phone`),
          providerId: provider,
          reason: 'Identify verified contact details directly on official website'
        });
      }
    }

    // Task 2: Find social accounts & professional registry listings
    if (shouldResearch('linkedin') || shouldResearch('socials')) {
      const socialProvider = getBestProvider('social-discovery', 'serper');
      tasks.push({
        targetType: 'social_profiles',
        query: withCountry(`${companyName} linkedin page company profile registry`),
        providerId: socialProvider,
        reason: 'Locate business registers and social profiles'
      });
    }

    // Task 3: Find executive leadership (CEO, Managing Director, President, Country Manager)
    if (shouldResearch('contact_persons') || shouldResearch('decision_makers')) {
      const leadershipProvider = getBestProvider('leadership-discovery', 'serper');
      tasks.push({
        targetType: 'leadership',
        query: withCountry(`${companyName} CEO managing director president founder country manager`),
        providerId: leadershipProvider,
        reason: 'Locate corporate executive decision makers'
      });
    }

    // Task 4: Find trade, procurement, and commercial contacts (Procurement, Supply Chain, Import/Export)
    if (extraContext?.role && (shouldResearch('contact_persons') || shouldResearch('commercial_contacts'))) {
      const tradeProvider = getBestProvider('targeted-query-execution', 'serper');
      tasks.push({
        targetType: 'commercial_contacts',
        query: withCountry(`${companyName} procurement purchasing import export supply chain sales manager`),
        providerId: tradeProvider,
        reason: 'Locate procurement, import/export, and commercial contacts'
      });
    }

    // Task 5: Target corporate email patterns if hunter is configured
    if (website && shouldResearch('email') && settings && ProviderCapabilityRegistry.isConfigured('hunter', settings) && ProviderCapabilityRegistry.isHealthy('hunter')) {
      tasks.push({
        targetType: 'email',
        query: website,
        providerId: 'hunter',
        reason: 'Retrieve candidate corporate emails only after independent domain verification'
      });
    }

    return tasks.slice(0, 5); // Allow up to 5 strategic targeted tasks
  }
}
