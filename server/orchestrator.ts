import { AppSettings } from './settings';
import { ResourceGovernor } from './resource_governor';
import { assertSafeHeaderValue } from './utils/header_encoder';
import { assertPublicResearchQuery } from './public_research_identity';
import { failureContextFingerprint, PersistentProviderFailureMemory } from './provider_failure_memory';
import { ProviderCapabilityRegistry, type ProviderMetadata } from './research_fabric';

export interface SearchResultItem {
  link: string;
  title: string;
  snippet: string;
}

export interface SearchProviderAttempt {
  provider: string;
  outcome: 'SUCCESS' | 'FAILED' | 'SKIPPED';
  failure_class?: string;
  reason?: string;
  latency_ms: number;
}

function searchFailureClass(error: unknown): string {
  const message = String((error as any)?.message || error || '').toLowerCase();
  if (/\b429\b|rate limit/.test(message)) return 'HTTP_429';
  if (/\b5\d\d\b/.test(message)) return 'HTTP_5XX';
  if (/timeout|abort/.test(message)) return 'RETRIEVAL_TIMEOUT';
  if (/fetch failed|network|dns|enotfound|econn/.test(message)) return 'DNS_NETWORK_FAILURE';
  return 'SEARCH_PROVIDER_FAILURE';
}

export function deduplicateSearchResults(results: SearchResultItem[]): SearchResultItem[] {
  const seen = new Set<string>();
  const unique: SearchResultItem[] = [];
  for (const item of results || []) {
    if (!item?.link) continue;
    let key = item.link.trim().toLowerCase().replace(/#.*$/, '').replace(/\/$/, '');
    try {
      const url = new URL(item.link);
      ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'fbclid'].forEach((param) => url.searchParams.delete(param));
      key = `${url.hostname.toLowerCase().replace(/^www\./, '')}${url.pathname.replace(/\/$/, '')}${url.search}`;
    } catch (_) {}
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }
  return unique;
}

export type ProviderCapability = ProviderMetadata;
export const PROVIDER_CAPABILITIES: Record<string, ProviderCapability> = Object.fromEntries(
  ProviderCapabilityRegistry.getProviders().map((provider) => [provider.id, provider]),
);

function providerFetchOptions(provider: string, options: RequestInit = {}): RequestInit {
  const timeoutMs = PROVIDER_CAPABILITIES[provider]?.timeoutMs || 20_000;
  return { ...options, signal: AbortSignal.timeout(timeoutMs) };
}

export function scoreProviderForTarget(provider: string, targetType: string): number {
  if (provider === 'hunter') return targetType === 'email' ? 100 : 0;
  let score = provider === 'tavily' ? 90
    : provider === 'exa' ? 85
      : provider === 'serper' ? 80
        : provider === 'linkup' ? 70
          : 0;
  if (targetType === 'official_website' || targetType === 'website' || targetType === 'company') {
    if (provider === 'serper') score += 20;
  } else if (targetType === 'leadership') {
    if (provider === 'exa') score += 10;
    if (provider === 'tavily') score += 5;
  } else if (targetType === 'email' && provider === 'tavily') {
    score += 5;
  }
  return score;
}

export async function executeProviderAwareSearch(
  query: string,
  targetType: string, // e.g. "email", "leadership", "website", "company"
  settings: AppSettings,
  logActivity: (msg: string, company: string, type: 'info' | 'warn' | 'error') => void,
  companyName: string,
  options: { preferredProvider?: string; verifiedDomain?: string; excludedProviders?: string[]; fallbackAttempts?: number; attemptChain?: SearchProviderAttempt[] } = {}
): Promise<{ results: SearchResultItem[]; providerUsed: string; attempts: SearchProviderAttempt[] }> {
  query = assertPublicResearchQuery(query, { companyName });
  const attemptChain = options.attemptChain || [];
  
  const isConfigured = (p: string) => {
    switch (p) {
      case 'serper': return Boolean(settings.serper_api_key?.trim()) && settings.serper_enabled;
      case 'tavily': return Boolean(settings.tavily_api_key?.trim()) && settings.tavily_enabled;
      case 'exa': return Boolean(settings.exa_api_key?.trim()) && settings.exa_enabled;
      case 'linkup': return Boolean(settings.linkup_api_key?.trim()) && settings.linkup_enabled;
      case 'hunter': return Boolean(settings.hunter_api_key?.trim()) && settings.hunter_enabled;
      default: return false;
    }
  };

  const isHealthy = (p: string) => {
    const state = ResourceGovernor.getCircuitStateName(p as any);
    return state === 'CLOSED' || state === 'HALF-OPEN';
  };

  let candidates = ['serper', 'tavily', 'exa', 'linkup', 'hunter']
    .filter(p => !(options.excludedProviders || []).includes(p))
    .filter(p => isConfigured(p) && isHealthy(p))
    .filter(p => p !== 'hunter' || Boolean(options.verifiedDomain))
    .map(p => ({
      provider: p,
      score: scoreProviderForTarget(p, targetType),
    }))
    .filter(c => c.score > 0)
    .sort((a, b) => {
      const preferred = options.preferredProvider;
      if (preferred && a.provider === preferred && b.provider !== preferred) return -1;
      if (preferred && b.provider === preferred && a.provider !== preferred) return 1;
      return b.score - a.score;
    });

  const memoryAction = `search:${targetType}`;
  const memoryFingerprint = failureContextFingerprint({ query, targetType, verifiedDomain: options.verifiedDomain || '' });
  const suppression = await Promise.all(candidates.map(async (candidate) => ({
    candidate,
    suppressed: await PersistentProviderFailureMemory.shouldSuppress(candidate.provider, memoryAction, memoryFingerprint),
  })));
  for (const item of suppression.filter((entry) => entry.suppressed)) {
    attemptChain.push({ provider: item.candidate.provider, outcome: 'SKIPPED', reason: 'PROVIDER_SUPPRESSED_BY_FAILURE_MEMORY', latency_ms: 0 });
  }
  candidates = suppression.filter((item) => !item.suppressed).map((item) => item.candidate);

  if (candidates.length === 0) {
    // Default fallback to Serper or throwing a helpful configuration warning
    logActivity(`No healthy configured research provider for "${targetType}". Falling back to Google/Serper as raw base.`, companyName, 'warn');
    const serperAvailable = Boolean(settings.serper_api_key?.trim()) && settings.serper_enabled !== false;
    if (!serperAvailable) {
      throw new Error(`No research providers are configured or healthy. Please configure at least one search key (Serper, Tavily, Exa, or Linkup) in Settings.`);
    }
    candidates.push({ provider: 'serper', score: 1 });
  }

  const chosen = candidates[0].provider;
  logActivity(`Selected provider "${chosen.toUpperCase()}" for "${targetType}" objective (Score: ${candidates[0].score})`, companyName, 'info');

  const results: SearchResultItem[] = [];
  const attemptStarted = Date.now();

  try {
    if (chosen === 'serper') {
      const serperResData = await ResourceGovernor.executeWithRetry('serper', `Serper Search: ${query}`, async () => {
        const res = await fetch('https://google.serper.dev/search', providerFetchOptions('serper', {
          method: 'POST',
          headers: {
            'X-API-KEY': assertSafeHeaderValue(settings.serper_api_key.trim(), 'Serper API key'),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ q: query, num: 5 })
        }));
        if (!res.ok) throw new Error(`Serper returned HTTP ${res.status}`);
        return await res.json();
      });
      const organic = serperResData.organic || [];
      for (const item of organic) {
        if (item.link) {
          results.push({
            link: item.link,
            title: item.title || '',
            snippet: item.snippet || ''
          });
        }
      }
    } else if (chosen === 'tavily') {
      const tavilyResData = await ResourceGovernor.executeWithRetry('tavily', `Tavily Search: ${query}`, async () => {
        const res = await fetch('https://api.tavily.com/search', providerFetchOptions('tavily', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            api_key: settings.tavily_api_key.trim(),
            query,
            max_results: 5
          })
        }));
        if (!res.ok) throw new Error(`Tavily returned HTTP ${res.status}`);
        return await res.json();
      });
      const organic = tavilyResData.results || [];
      for (const item of organic) {
        if (item.url) {
          results.push({
            link: item.url,
            title: item.title || '',
            snippet: item.content || ''
          });
        }
      }
    } else if (chosen === 'exa') {
      const exaResData = await ResourceGovernor.executeWithRetry('exa', `Exa Search: ${query}`, async () => {
        const res = await fetch('https://api.exa.ai/search', providerFetchOptions('exa', {
          method: 'POST',
          headers: {
            'x-api-key': assertSafeHeaderValue(settings.exa_api_key.trim(), 'Exa API key'),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            query,
            numResults: 5
          })
        }));
        if (!res.ok) throw new Error(`Exa returned HTTP ${res.status}`);
        return await res.json();
      });
      const organic = exaResData.results || [];
      for (const item of organic) {
        if (item.url) {
          results.push({
            link: item.url,
            title: item.title || '',
            snippet: item.text || item.highlights?.join(' ') || ''
          });
        }
      }
    } else if (chosen === 'linkup') {
      const linkupResData = await ResourceGovernor.executeWithRetry('linkup', `Linkup Search: ${query}`, async () => {
        const res = await fetch('https://api.linkup.so/v1/search', providerFetchOptions('linkup', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${assertSafeHeaderValue(settings.linkup_api_key.trim(), 'Linkup API key')}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            q: query,
            depth: 'fast',
            outputType: 'searchResults'
          })
        }));
        if (!res.ok) throw new Error(`Linkup returned HTTP ${res.status}`);
        return await res.json();
      });
      const organic = linkupResData.results || [];
      for (const item of organic) {
        if (item.url) {
          results.push({
            link: item.url,
            title: item.title || '',
            snippet: item.content || item.snippet || ''
          });
        }
      }
    } else if (chosen === 'hunter') {
      const domain = String(options.verifiedDomain || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
      if (!domain || !domain.includes('.')) throw new Error('HUNTER_REQUIRES_VERIFIED_DOMAIN');

      const hunterResData = await ResourceGovernor.executeWithRetry('hunter', `Hunter Domain Search: ${domain}`, async () => {
        const res = await fetch(
          `https://api.hunter.io/v2/domain-search?domain=${domain}&api_key=${settings.hunter_api_key.trim()}`,
          providerFetchOptions('hunter')
        );
        if (!res.ok) throw new Error(`Hunter returned HTTP ${res.status}`);
        return await res.json();
      });

      const data = hunterResData.data || {};
      const emails = data.emails || [];
      const formattedEmails = emails.map((e: any) => `${e.value} (${e.type || 'unknown'} - ${e.first_name || ''} ${e.last_name || ''})`).join(', ');

      results.push({
        link: `https://hunter.io/domain-search?domain=${domain}`,
        title: `Hunter Domain Intelligence for ${domain}`,
        snippet: `Emails discovered: ${formattedEmails || 'None'}. Domain pattern: ${data.pattern || 'unknown'}. Organization: ${data.organization || companyName}`
      });
    }
  } catch (err: any) {
    attemptChain.push({ provider: chosen, outcome: 'FAILED', failure_class: searchFailureClass(err), reason: String(err?.message || err).slice(0, 240), latency_ms: Date.now() - attemptStarted });
    await PersistentProviderFailureMemory.remember(chosen, memoryAction, memoryFingerprint, err);
    logActivity(`Provider ${chosen.toUpperCase()} failed during execution: ${err.message}`, companyName, 'error');
    const next = candidates.find((candidate) => candidate.provider !== chosen);
    if (next) {
      logActivity(`Bounded capability fallback: ${chosen.toUpperCase()} -> ${next.provider.toUpperCase()} for "${targetType}".` , companyName, 'warn');
      return executeProviderAwareSearch(query, targetType, settings, logActivity, companyName, {
        ...options,
        preferredProvider: next.provider,
        excludedProviders: [...(options.excludedProviders || []), chosen],
        // increase fallbackAttempts for diagnostics, but no hard limit
        fallbackAttempts: (options.fallbackAttempts || 0) + 1,
        attemptChain,
      });
    }
    err.searchAttempts = attemptChain;
    throw err;
  }

  await PersistentProviderFailureMemory.clear(chosen, memoryAction, memoryFingerprint);
  attemptChain.push({ provider: chosen, outcome: 'SUCCESS', latency_ms: Date.now() - attemptStarted });
  return { results: deduplicateSearchResults(results), providerUsed: chosen, attempts: attemptChain };
}

export async function executeParallelDiscoverySearch(
  query: string,
  targetType: string,
  settings: AppSettings,
  logActivity: (msg: string, company: string, type: 'info' | 'warn' | 'error') => void,
  companyName: string,
  options: { providers?: string[]; verifiedDomain?: string; maxProviders?: number } = {}
): Promise<{ results: Array<SearchResultItem & { discoveredBy: string[] }>; attempts: SearchProviderAttempt[] }> {
  const configured = (provider: string) => {
    const key = provider === 'serper' ? settings.serper_api_key
      : provider === 'tavily' ? settings.tavily_api_key
        : provider === 'exa' ? settings.exa_api_key
          : provider === 'linkup' ? settings.linkup_api_key
            : provider === 'hunter' ? settings.hunter_api_key : '';
    return Boolean(key?.trim()) && (settings as any)[`${provider}_enabled`] !== false;
  };
  const requested = options.providers?.length ? options.providers : ['serper', 'exa', 'tavily'];
  const providers = [...new Set(requested)]
    .filter((provider) => ['serper', 'exa', 'tavily', 'linkup', 'hunter'].includes(provider))
    .filter(configured)
    .filter((provider) => ['CLOSED', 'HALF-OPEN'].includes(ResourceGovernor.getCircuitStateName(provider as any)))
    .slice(0, Math.max(1, Math.min(3, options.maxProviders || 3)));
  if (providers.length === 0) throw new Error('No healthy configured discovery providers');

  const settled = await Promise.allSettled(providers.map((provider) => executeProviderAwareSearch(
    query, targetType, settings, logActivity, companyName,
    { preferredProvider: provider, verifiedDomain: options.verifiedDomain, excludedProviders: providers.filter((item) => item !== provider) }
  )));
  const merged = new Map<string, SearchResultItem & { discoveredBy: string[] }>();
  const attempts: SearchProviderAttempt[] = [];
  for (const outcome of settled) {
    if (outcome.status === 'rejected') continue;
    attempts.push(...outcome.value.attempts);
    for (const result of outcome.value.results) {
      let key = result.link.trim().toLowerCase().replace(/#.*$/, '').replace(/\/$/, '');
      try {
        const url = new URL(result.link);
        for (const param of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'fbclid']) url.searchParams.delete(param);
        key = `${url.hostname.toLowerCase().replace(/^www\./, '')}${url.pathname.replace(/\/$/, '')}${url.search}`;
      } catch (_) {}
      const existing = merged.get(key);
      if (existing) {
        if (!existing.discoveredBy.includes(outcome.value.providerUsed)) existing.discoveredBy.push(outcome.value.providerUsed);
      } else {
        merged.set(key, { ...result, discoveredBy: [outcome.value.providerUsed] });
      }
    }
  }
  return { results: [...merged.values()], attempts };
}
