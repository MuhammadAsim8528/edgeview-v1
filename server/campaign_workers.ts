import { getAppSettings, type AppSettings } from './settings';
import { ResearchWorkspace, type CampaignTaskInput } from './research_workspace';
import { executeParallelDiscoverySearch } from './orchestrator';
import { safeFetchOutboundText } from './url_safety';
import {
  extractEmailsFromEvidenceText,
  extractPhonesFromEvidenceText,
  extractAddressesFromEvidenceText,
  extractPeopleFromEvidenceText,
  isValidCorporateContactPerson,
  isPlausibleOfficialCompanyUrl,
  isSameCompanyHost,
  addDeterministicEvidenceFacts,
} from './research_director';
import { buildAIExecutionPlan, executeAIPlan, type AIProviderName } from './ai_execution_plan';
import { extractJsonBlock, safeJsonParse } from './enrichment';
import { ControlledToolRegistry, type ControlledResearchAction } from './research_runtime';
import { EvidenceGraph, EvidenceFusionEngine } from './research_fabric';
import { canonicalCompanyIdentityKey } from './company_identity';

const runningCampaigns = new Set<string>();

export interface CampaignWorkerContext {
  campaignId: string;
  workspace: any;
  settings: AppSettings;
}

function terminal(status: string): boolean {
  return status === 'COMPLETED' || status === 'FAILED' || status === 'PAUSED';
}

function cleanUrl(raw: string): string {
  try {
    const url = new URL(raw);
    url.hash = '';
    for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'fbclid']) url.searchParams.delete(key);
    return url.toString().replace(/\/$/, '');
  } catch (_) {
    return String(raw || '').trim();
  }
}

function pinnedPlan(settings: AppSettings, provider: AIProviderName) {
  const plan = buildAIExecutionPlan(settings, { preferredProvider: provider, temperature: 0, maxTokens: 1800 });
  if (plan.provider !== provider) throw new Error(`${provider.toUpperCase()}_UNAVAILABLE`);
  return { ...plan, fallbackPlan: undefined };
}

function parseObject(content: string): any {
  return safeJsonParse(extractJsonBlock(content), {});
}

function validateActions(raw: unknown, limit = 4): ControlledResearchAction[] {
  if (!Array.isArray(raw)) return [];
  const actions: ControlledResearchAction[] = [];
  for (const candidate of raw.slice(0, limit)) {
    const validation = ControlledToolRegistry.validate(candidate);
    if (validation.ok && validation.action) actions.push(validation.action);
  }
  return actions;
}

function taskFromAction(action: ControlledResearchAction, origin: 'nvidia' | 'groq' | 'deterministic', country: string): CampaignTaskInput {
  const args = action.arguments || {};
  const capability = action.action === 'search_web' ? 'WEB_SEARCH'
    : action.action === 'scrape_page' ? 'WEB_FETCH'
      : action.action === 'discover_internal_links' ? 'OFFICIAL_SITE_HARVEST'
        : action.action === 'record_evidence' || action.action === 'validate_evidence' ? 'AI_ANALYSIS'
          : 'READ_WORKSPACE';
  return {
    objective: String(args.target_type || action.action).replace(/_/g, ' '),
    capability,
    query: action.action === 'search_web' ? String(args.query || '') : undefined,
    target_country: country,
    hypothesis: String(args.hypothesis || ''),
    desired_source_types: Array.isArray(args.desired_source_types) ? args.desired_source_types : [],
    preferred_providers: Array.isArray(args.providers) ? args.providers : [],
    priority: Number(args.priority || 60),
    reason: action.reason,
    origin_agent: origin,
    arguments: args,
  };
}

function boundedWorkspaceSnapshot(workspace: any): string {
  return JSON.stringify({
    campaign_id: workspace.id,
    entity_key: workspace.entity_key,
    company: workspace.company,
    country: workspace.country,
    objective: workspace.objective,
    context: workspace.context,
    budget: workspace.budget,
    turn: (workspace.tasks?.filter((t: any) => t.origin_agent === 'nvidia').length || 0) + 1,
    tasks: (workspace.tasks || []).slice(-12).map((task: any) => ({
      id: task.id,
      objective: task.objective,
      capability: task.capability,
      query: task.query_text,
      status: task.status,
      review_status: task.review_status,
    })),
    sources: (workspace.sources || []).slice(-12).map((source: any) => ({ url: source.canonical_url, status: source.fetch_status, authority: source.authority })),
    claims: (workspace.claims || []).slice(-12).map((claim: any) => ({ predicate: claim.predicate, value: claim.value, status: claim.status })),
    observations_count: (workspace.observations || []).length,
    candidate_facts_count: (workspace.candidate_facts || []).length,
  }).slice(0, 30_000);
}

async function runNvidiaTurn(ctx: CampaignWorkerContext, turn: number): Promise<{ actions: ControlledResearchAction[]; summary: string; missing: string[]; recommend_stop: boolean } | null> {
  const { campaignId, workspace, settings } = ctx;
  const snapshot = boundedWorkspaceSnapshot(workspace);
  try {
    await ResearchWorkspace.appendEvent(campaignId, 'NVIDIA_TURN_START', 'nvidia', { model: settings.nvidia_model, turn });
    const result = await executeAIPlan(
      pinnedPlan(settings, 'nvidia'),
      `You are EdgeView's PRIMARY RESEARCH DIRECTOR. This is turn ${turn} of the campaign. Inspect the workspace and propose up to four controlled research actions. Do NOT repeat queries already executed. Focus on highest-value gaps. Return JSON only: {"summary":"...","missing_information":["..."],"actions":[{"action":"search_web","reason":"...","arguments":{"query":"...","target_type":"leadership"}}],"recommend_stop":false}. Allowed actions: ${ControlledToolRegistry.describe()}. WORKSPACE: ${snapshot}`,
      settings,
      'Campaign NVIDIA Research Director'
    );
    const parsed = parseObject(result.content);
    const actions = validateActions(parsed.actions);
    const summary = String(parsed.summary || '').slice(0, 500);
    const missing = Array.isArray(parsed.missing_information) ? parsed.missing_information.map(String).slice(0, 12) : [];
    await ResearchWorkspace.appendEvent(campaignId, 'NVIDIA_TURN_COMPLETE', 'nvidia', { summary, actions, model: result.executedModel, turn });
    return { actions, summary, missing, recommend_stop: Boolean(parsed.recommend_stop) };
  } catch (error: any) {
    await ResearchWorkspace.appendEvent(campaignId, 'NVIDIA_TURN_FAILED', 'nvidia', { error: String(error?.message || error).slice(0, 300) });
    return null;
  }
}

async function runGroqTurn(ctx: CampaignWorkerContext, nvidiaProposal: { actions: ControlledResearchAction[]; summary: string; missing: string[]; recommend_stop: boolean } | null, turn: number): Promise<{ verdict: 'APPROVE' | 'REVISE' | 'REJECT'; accepted_action_indexes: number[]; challenges: Array<{ action_index: number; reason: string }>; replacement_actions: ControlledResearchAction[]; summary: string } | null> {
  const { campaignId, workspace, settings } = ctx;
  const snapshot = boundedWorkspaceSnapshot(workspace);
  if (!nvidiaProposal || nvidiaProposal.actions.length === 0) {
    return { verdict: 'APPROVE', accepted_action_indexes: [], challenges: [], replacement_actions: [], summary: 'No NVIDIA proposal to review' };
  }
  try {
    await ResearchWorkspace.appendEvent(campaignId, 'GROQ_TURN_START', 'groq', { model: settings.groq_model, turn });
    const result = await executeAIPlan(
      pinnedPlan(settings, 'groq'),
      `You are EdgeView's ADVERSARIAL RESEARCH CO-DIRECTOR. This is turn ${turn}. Review NVIDIA's proposed actions against immutable entity/country context. Challenge drift, weak queries, unsupported assumptions, and redundant cost. Return JSON only: {"verdict":"APPROVE|REVISE|REJECT","accepted_action_indexes":[0],"challenges":[{"action_index":1,"reason":"..."}],"replacement_actions":[],"summary":"..."}. Any replacement must use: ${ControlledToolRegistry.describe()}. WORKSPACE: ${snapshot} NVIDIA_PROPOSAL: ${JSON.stringify(nvidiaProposal)}`,
      settings,
      'Campaign Groq Adversarial Reviewer'
    );
    const parsed = parseObject(result.content);
    const review = {
      verdict: ['APPROVE', 'REVISE', 'REJECT'].includes(parsed.verdict) ? parsed.verdict : 'REJECT',
      accepted_action_indexes: Array.isArray(parsed.accepted_action_indexes) ? parsed.accepted_action_indexes.filter(Number.isInteger).slice(0, 4) : [],
      challenges: Array.isArray(parsed.challenges) ? parsed.challenges.slice(0, 8).map((item: any) => ({ action_index: Number(item.action_index), reason: String(item.reason || '').slice(0, 300) })) : [],
      replacement_actions: validateActions(parsed.replacement_actions),
      summary: String(parsed.summary || '').slice(0, 500),
    };
    await ResearchWorkspace.appendEvent(campaignId, 'GROQ_TURN_COMPLETE', 'groq', { ...review, model: result.executedModel, turn });
    return review;
  } catch (error: any) {
    await ResearchWorkspace.appendEvent(campaignId, 'GROQ_TURN_FAILED', 'groq', { error: String(error?.message || error).slice(0, 300) });
    return null;
  }
}

async function executeSearchTask(ctx: CampaignWorkerContext, task: any): Promise<void> {
  const { campaignId, workspace, settings } = ctx;
  try {
    await ResearchWorkspace.appendEvent(campaignId, 'TASK_STARTED', 'provider', { task_id: task.id, capability: task.capability });
    const search = await executeParallelDiscoverySearch(
      task.query_text,
      task.objective || 'company',
      settings,
      () => {},
      workspace.company,
      { providers: task.preferred_providers?.length ? task.preferred_providers : ['serper', 'exa', 'tavily'], maxProviders: Number(task.priority || 0) >= 70 ? 3 : 2 }
    );
    for (const result of search.results) {
      const sourceId = await ResearchWorkspace.addSource(campaignId, { url: result.link, title: result.title });
      for (const provider of result.discoveredBy) {
        await ResearchWorkspace.appendEvent(campaignId, 'SOURCE_PROVIDER_LINKED', 'provider', { source_id: sourceId, provider });
      }
    }
    await ResearchWorkspace.appendEvent(campaignId, 'TASK_COMPLETED', 'provider', { task_id: task.id, providers: [...new Set(search.attempts.map((attempt) => attempt.provider))], sources_discovered: search.results.length });
  } catch (error: any) {
    await ResearchWorkspace.appendEvent(campaignId, 'TASK_FAILED', 'provider', { task_id: task.id, error: String(error?.message || error).slice(0, 300) });
  }
}

async function executeFetchTask(ctx: CampaignWorkerContext, task: any): Promise<void> {
  const { campaignId, workspace, settings } = ctx;
  const url = task.arguments?.url;
  if (!url || !cleanUrl(url)) return;
  try {
    await ResearchWorkspace.appendEvent(campaignId, 'FETCH_STARTED', 'provider', { task_id: task.id, url });
    const { response, text: content } = await safeFetchOutboundText(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } });
    if (!response.ok || !content) {
      await ResearchWorkspace.appendEvent(campaignId, 'FETCH_FAILED', 'provider', { task_id: task.id, url, status: response.status });
      return;
    }
    const sourceId = await ResearchWorkspace.addSource(campaignId, { url, title: '', source_type: 'web' });
    const observationId = await ResearchWorkspace.addObservation(campaignId, {
      source_id: sourceId,
      fetch_method: 'direct',
      fetch_provider: 'safe_fetch',
      content,
      country_entity_context: workspace.country,
      retrieval_metadata: { url, status: response.status, bytes: content.length },
    });
    await extractCandidateFactsFromObservation(ctx, observationId, content, url);
    await ResearchWorkspace.appendEvent(campaignId, 'FETCH_COMPLETED', 'provider', { task_id: task.id, observation_id: observationId, url, bytes: content.length });
  } catch (error: any) {
    await ResearchWorkspace.appendEvent(campaignId, 'FETCH_FAILED', 'provider', { task_id: task.id, url, error: String(error?.message || error).slice(0, 300) });
  }
}

async function extractCandidateFactsFromObservation(ctx: CampaignWorkerContext, observationId: string, content: string, sourceUrl: string): Promise<void> {
  const { campaignId, workspace } = ctx;
  const companyName = workspace.company;
  const country = workspace.country;
  let added = 0;

  const emails = extractEmailsFromEvidenceText(content);
  for (const email of emails) {
    const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) && !isGenericEmail(email);
    await ResearchWorkspace.addCandidateFact(campaignId, {
      observation_id: observationId,
      field_type: 'email',
      raw_value: email,
      normalized_value: email.toLowerCase(),
      validator: 'regex_email',
      validation_result: isValid ? 'valid' : 'invalid_format',
      confidence: isValid ? 0.85 : 0.1,
      proposed_by: 'deterministic',
    });
    added++;
  }

  const phones = extractPhonesFromEvidenceText(content);
  for (const phone of phones) {
    const isValid = isValidPhoneNumber(phone);
    const normalized = isValid ? normalizePhone(phone) : phone;
    await ResearchWorkspace.addCandidateFact(campaignId, {
      observation_id: observationId,
      field_type: 'phone',
      raw_value: phone,
      normalized_value: normalized,
      validator: 'regex_phone_strict',
      validation_result: isValid ? 'valid' : 'rejected_false_positive',
      confidence: isValid ? 0.8 : 0.05,
      proposed_by: 'deterministic',
    });
    added++;
  }

  const addresses = extractAddressesFromEvidenceText(content);
  for (const addr of addresses) {
    const isValid = isValidAddress(addr.address, country);
    await ResearchWorkspace.addCandidateFact(campaignId, {
      observation_id: observationId,
      field_type: 'address',
      raw_value: addr.address,
      normalized_value: addr.address,
      validator: 'regex_address_strict',
      validation_result: isValid ? 'valid' : 'rejected_false_positive',
      confidence: isValid ? 0.75 : 0.05,
      proposed_by: 'deterministic',
    });
    added++;
  }

  const people = extractPeopleFromEvidenceText(content, companyName);
  for (const person of people) {
    const isValid = isValidCorporateContactPerson(person);
    await ResearchWorkspace.addCandidateFact(campaignId, {
      observation_id: observationId,
      field_type: 'person',
      raw_value: JSON.stringify(person),
      normalized_value: person.name,
      validator: 'regex_person',
      validation_result: isValid ? 'valid' : 'invalid_person',
      confidence: isValid ? 0.7 : 0.1,
      proposed_by: 'deterministic',
    });
    added++;
  }

  if (added > 0) {
    await ResearchWorkspace.appendEvent(campaignId, 'CANDIDATE_FACTS_EXTRACTED', 'deterministic', { observation_id: observationId, count: added });
  }
}

function isGenericEmail(email: string): boolean {
  const genericDomains = ['example.com', 'test.com', 'localhost', 'domain.com', 'company.com'];
  const domain = email.split('@')[1]?.toLowerCase();
  return genericDomains.includes(domain);
}

function isValidPhoneNumber(phone: string): boolean {
  const raw = phone.trim();
  const digits = raw.replace(/\D/g, '');
  
  // Reject if too short or too long
  if (digits.length < 7 || digits.length > 15) return false;
  
  // Reject if all same digit (e.g., 1111111)
  if (new Set(digits).size === 1) return false;
  
  // Reject date patterns: YYYY-MM-DD, DD-MM-YYYY, YYYY/MM/DD, etc.
  if (/^\d{4}[-/]\d{2}[-/]\d{2}$/.test(raw)) return false;
  if (/^\d{2}[-/]\d{2}[-/]\d{4}$/.test(raw)) return false;
  if (/^\d{4}\d{2}\d{2}$/.test(raw)) return false; // YYYYMMDD
  
  // Reject datetime patterns: YYYY-MM-DD HH:MM
  if (/^\d{4}[-/]\d{2}[-/]\d{2}\s+\d{1,2}:\d{2}/.test(raw)) return false;
  
  // Reject image dimensions: WxH or WxHxD patterns
  if (/^\d+[x×]\d+([x×]\d+)?$/.test(raw.replace(/\s/g, ''))) return false;
  if (/^\d+\s*[x×]\s*\d+/.test(raw)) return false;
  
  // Reject dotted version formats like 07.41.42-254
  if (/^\d{1,2}\.\d{1,2}\.\d{1,2}[-.]\d+$/.test(raw)) return false;
  
  // Reject short codes like 0360-150, 0238-150
  if (/^\d{3,4}-\d{3}$/.test(raw)) return false;
  
  // Reject pure digit sequences that look like invoice/order numbers (10+ digits, no formatting)
  if (digits.length >= 10 && !/[\s\-\(\)\+\.]/.test(raw)) return false;
  
  // Reject years like 2025, 2026, 1995, etc. (4 digits starting with 19 or 20)
  if (/^(19|20)\d{2}$/.test(digits)) return false;
  
  // Reject timestamps like 2026-09-17 20:30
  if (/^\d{4}[-/]\d{2}[-/]\d{2}\s+\d{1,2}:\d{2}/.test(raw)) return false;
  
  // CRITICAL: Phone numbers MUST have either:
  // 1. A country code prefix (+ or 00)
  // 2. Visible formatting (spaces, dashes, parentheses)
  // 3. OR be a known local format with area code (at least 8 digits with formatting)
  const hasCountryCode = raw.startsWith('+') || raw.startsWith('00');
  const hasFormatting = /[\s\-\(\)]/.test(raw);
  
  // For any phone number, require either country code OR formatting
  // Exception: very short local numbers (7-8 digits) are only valid with formatting
  if (!hasCountryCode && !hasFormatting) return false;
  
  // For long numbers (10+ digits), require country code
  if (digits.length >= 10 && !hasCountryCode) return false;
  
  // Reject date patterns: YYYY-MM-DD, DD-MM-YYYY, YYYY/MM/DD, etc.
  if (/^\d{4}[-/]\d{2}[-/]\d{2}$/.test(raw)) return false;
  if (/^\d{2}[-/]\d{2}[-/]\d{4}$/.test(raw)) return false;
  if (/^\d{4}\d{2}\d{2}$/.test(raw)) return false; // YYYYMMDD
  
  // Reject datetime patterns: YYYY-MM-DD HH:MM
  if (/^\d{4}[-/]\d{2}[-/]\d{2}\s+\d{1,2}:\d{2}/.test(raw)) return false;
  
  // Reject image dimensions: WxH or WxHxD patterns
  if (/^\d+[x×]\d+([x×]\d+)?$/.test(raw.replace(/\s/g, ''))) return false;
  if (/^\d+\s*[x×]\s*\d+/.test(raw)) return false;
  
  // Reject dotted version formats like 07.41.42-254
  if (/^\d{1,2}\.\d{1,2}\.\d{1,2}[-.]\d+$/.test(raw)) return false;
  
  // Reject short codes like 0360-150, 0238-150
  if (/^\d{3,4}-\d{3}$/.test(raw)) return false;
  
  // Reject pure digit sequences that look like invoice/order numbers (10+ digits, no formatting)
  if (digits.length >= 10 && !/[\s\-\(\)\+\.]/.test(raw)) return false;
  
  // Reject years like 2025, 2026, 1995, etc. (4 digits starting with 19 or 20)
  if (/^(19|20)\d{2}$/.test(digits)) return false;
  
  // Reject timestamps like 2026-09-17 20:30
  if (/^\d{4}[-/]\d{2}[-/]\d{2}\s+\d{1,2}:\d{2}/.test(raw)) return false;
  
  return true;
}

function normalizePhone(phone: string): string {
  // Keep original formatting but ensure consistent
  return phone.trim();
}

function isValidAddress(address: string, targetCountry: string): boolean {
  const trimmed = address.trim();
  
  // Reject if too short or too long
  if (trimmed.length < 20 || trimmed.length > 500) return false;
  
  // Reject biography/narrative text (contains sentences with multiple verbs)
  const verbCount = (trimmed.match(/\b(was|is|were|are|has|have|had|will|would|could|should|played|role|responsibility|leading|developing|sustaining|building|establishing|entrusted)\b/gi) || []).length;
  if (verbCount >= 3) return false; // Likely narrative text
  
  // Reject if contains HTML tags
  if (/<[^>]+>/.test(trimmed)) return false;
  
  // Reject if contains line breaks with <br>
  if (/<br\s*\/?>/i.test(trimmed)) return false;
  
  // Must contain address-like keywords
  const addressKeywords = /\b(?:road|street|avenue|drive|lane|boulevard|way|place|court|suite|floor|building|tower|plaza|center|park|office|address|location|colombo|sri\s+lanka|hospital\s+road)\b/i;
  if (!addressKeywords.test(trimmed)) return false;
  
  // Must contain at least one number (street number, postal code, etc.)
  if (!/\d/.test(trimmed)) return false;
  
  // If target country specified, should mention it or have local postal code
  if (targetCountry) {
    const countryLower = targetCountry.toLowerCase();
    const countryVariants = [
      countryLower,
      countryLower.replace(/\s+/g, ''),
      countryLower.replace(/\s+/g, '-')
    ];
    const hasCountryRef = countryVariants.some(v => trimmed.toLowerCase().includes(v));
    // Allow if no country ref but has postal code pattern
    const hasPostalCode = /\b\d{5}\b/.test(trimmed) || /\b\d{4,6}\b/.test(trimmed);
    if (!hasCountryRef && !hasPostalCode) return false;
  }
  
  return true;
}

async function evaluateCandidateFactsAndProposeClaims(ctx: CampaignWorkerContext): Promise<void> {
  const { campaignId, workspace } = ctx;
  const country = workspace.country || '';
  const candidateFacts = workspace.candidate_facts || [];
  const claims = workspace.claims || [];
  const admittedPredicates = new Set(claims.filter((c: any) => c.status === 'ADMITTED').map((c: any) => c.predicate));

  for (const fact of candidateFacts) {
    if (fact.validation_result !== 'valid') continue;
    let predicate = '';
    let value: unknown = fact.normalized_value || fact.raw_value;
    let factOwnership = '';
    let sourceAuthority = 'web';

    if (fact.field_type === 'email') {
      predicate = 'contact:email';
      factOwnership = 'company_owned_domain';
      sourceAuthority = 'official_site';
    } else if (fact.field_type === 'phone') {
      predicate = 'contact:phone';
      factOwnership = 'company_listed';
      sourceAuthority = 'official_site';
    } else if (fact.field_type === 'address') {
      predicate = 'contact:address';
      factOwnership = 'company_location';
      sourceAuthority = 'official_site';
    } else if (fact.field_type === 'person') {
      predicate = 'leadership:person';
      factOwnership = 'company_official';
      sourceAuthority = 'official_site';
    } else continue;

    if (admittedPredicates.has(predicate)) continue;

    const obs = (workspace.observations || []).find((o: any) => o.id === fact.observation_id);
    const src = obs ? (workspace.sources || []).find((s: any) => s.id === obs.source_id) : null;
    const sourceIds = src ? [src.id] : [];
    const observationIds = [fact.observation_id];

    const existing = claims.find((c: any) => c.predicate === predicate && JSON.stringify(c.value) === JSON.stringify(value) && c.status !== 'REJECTED');
    if (existing) continue;

    await ResearchWorkspace.proposeClaim(campaignId, {
      predicate,
      value,
      source_ids: sourceIds,
      observation_ids: observationIds,
      proposed_by: 'deterministic',
      entity_key: workspace.entity_key,
      country_attribution: country,
      fact_ownership: factOwnership,
      source_authority: sourceAuthority,
    });
  }

  // Admit claims that have valid candidate facts
  await admitValidClaims(campaignId, workspace);
}

async function admitValidClaims(campaignId: string, workspace: any): Promise<void> {
  const candidateFacts = workspace.candidate_facts || [];
  const claims = workspace.claims || [];
  const validFactsByPredicate = new Map<string, any[]>();

  for (const fact of candidateFacts) {
    if (fact.validation_result !== 'valid') continue;
    let predicate = '';
    if (fact.field_type === 'email') predicate = 'contact:email';
    else if (fact.field_type === 'phone') predicate = 'contact:phone';
    else if (fact.field_type === 'address') predicate = 'contact:address';
    else if (fact.field_type === 'person') predicate = 'leadership:person';
    else continue;
    if (!validFactsByPredicate.has(predicate)) validFactsByPredicate.set(predicate, []);
    validFactsByPredicate.get(predicate)!.push(fact);
  }

  console.log(`[ADMIT] Valid facts by predicate:`, Object.fromEntries(
    Array.from(validFactsByPredicate.entries()).map(([k, v]) => [k, v.length])
  ));

  // Group claims by predicate and normalized value to deduplicate before admitting
  const claimsByKey = new Map<string, any[]>();
  for (const claim of claims) {
    if (claim.status !== 'CANDIDATE' && claim.status !== 'HOLD') continue;
    const key = `${claim.predicate}:${normalizeClaimValue(claim.value)}`;
    if (!claimsByKey.has(key)) claimsByKey.set(key, []);
    claimsByKey.get(key)!.push(claim);
  }

  console.log(`[ADMIT] Claim groups:`, Object.fromEntries(
    Array.from(claimsByKey.entries()).map(([k, v]) => [k, v.length])
  ));

  for (const [key, claimGroup] of claimsByKey) {
    // Find the predicate by checking which validFactsByPredicate key is a prefix of the claim key
    let predicate = '';
    for (const validPred of validFactsByPredicate.keys()) {
      if (key.startsWith(validPred + ':')) {
        predicate = validPred;
        break;
      }
    }
    if (!predicate) {
      // Fallback: extract predicate from claim object
      const claim = claimGroup[0];
      predicate = claim.predicate;
    }
    console.log(`[ADMIT] Processing ${key}: ${claimGroup.length} claims, predicate=${predicate}`);
    const validFacts = validFactsByPredicate.get(predicate) || [];
    console.log(`[ADMIT] Processing ${key}: ${claimGroup.length} claims, ${validFacts.length} valid facts`);
    if (validFacts.length === 0) {
      console.log(`[ADMIT] No valid facts for ${predicate}, skipping`);
      continue;
    }
    
    // Admit the first claim in the group, supersede the rest
    const sortedClaims = claimGroup.sort((a, b) => (a.confidence || 0) - (b.confidence || 0));
    const toAdmit = sortedClaims[0];
    console.log(`[ADMIT] Admitting claim ${toAdmit.id} for ${key}`);
    await ResearchWorkspace.updateClaimStatus(campaignId, toAdmit.id, 'ADMITTED', 'deterministic', `Supported by ${validFacts.length} valid candidate fact(s)`);
    
    // Supersede duplicates
    for (let i = 1; i < sortedClaims.length; i++) {
      await ResearchWorkspace.updateClaimStatus(campaignId, sortedClaims[i].id, 'SUPERSEDED', 'deterministic', `Duplicate of admitted claim`);
    }
  }
}

function normalizeClaimValue(value: unknown): string {
  const str = String(value || '').trim().toLowerCase();
  if (str.includes('@')) return str; // email
  // Phone: strip all non-digits for comparison
  return str.replace(/\D/g, '');
}

async function runOfficialSiteHarvest(ctx: CampaignWorkerContext): Promise<void> {
  const { campaignId, workspace } = ctx;
  const officialUrl = workspace.sources?.find((s: any) => s.authority === 'official')?.canonical_url;
  if (!officialUrl) return;

  try {
    await ResearchWorkspace.appendEvent(campaignId, 'OFFICIAL_SITE_HARVEST_START', 'deterministic', { url: officialUrl });
    const { response, text: content } = await safeFetchOutboundText(officialUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } });
    if (!response.ok || !content) return;

    const sourceId = await ResearchWorkspace.addSource(campaignId, { url: officialUrl, title: '', source_type: 'official_website', authority: 'official' });
    const observationId = await ResearchWorkspace.addObservation(campaignId, {
      source_id: sourceId,
      fetch_method: 'direct',
      fetch_provider: 'safe_fetch',
      content,
      country_entity_context: workspace.country,
      retrieval_metadata: { url: officialUrl, status: response.status, bytes: content.length },
    });

    const companyName = workspace.company;
    const graph = new EvidenceGraph();
    addDeterministicEvidenceFacts(graph, [{ url: officialUrl, content }], companyName, officialUrl);

    const facts = graph.getFacts();
    for (const fact of facts) {
      const val = fact.metadata.value;
      let fieldType = '';
      let rawVal = '';
      if (fact.metadata.field === 'email') { fieldType = 'email'; rawVal = String(val); }
      else if (fact.metadata.field === 'phone') { fieldType = 'phone'; rawVal = String(val); }
      else if (fact.metadata.field === 'address') { fieldType = 'address'; rawVal = JSON.stringify(val); }
      else if (fact.metadata.field === 'contact_person') { fieldType = 'person'; rawVal = JSON.stringify(val); }
      else continue;

      await ResearchWorkspace.addCandidateFact(campaignId, {
        observation_id: observationId,
        field_type: fieldType,
        raw_value: rawVal,
        normalized_value: String(val),
        validator: 'deterministic_official_site',
        validation_result: 'valid',
        confidence: 0.9,
        proposed_by: 'deterministic',
      });
    }
    await ResearchWorkspace.appendEvent(campaignId, 'OFFICIAL_SITE_HARVEST_COMPLETE', 'deterministic', { url: officialUrl, facts_extracted: facts.length });
  } catch (error: any) {
    await ResearchWorkspace.appendEvent(campaignId, 'OFFICIAL_SITE_HARVEST_FAILED', 'deterministic', { url: officialUrl, error: String(error?.message || error).slice(0, 300) });
  }
}

async function recomputeObjectivesAndCheckCompletion(ctx: CampaignWorkerContext): Promise<{ complete: boolean; missingObjectives: string[] }> {
  const { workspace } = ctx;
  const claims = workspace.claims || [];
  const admitted = claims.filter((c: any) => c.status === 'ADMITTED');

  const hasEmail = admitted.some((c: any) => c.predicate === 'contact:email');
  const hasPhone = admitted.some((c: any) => c.predicate === 'contact:phone');
  const hasAddress = admitted.some((c: any) => c.predicate === 'contact:address');
  const hasWebsite = workspace.sources?.some((s: any) => s.authority === 'official') ?? false;
  const hasLeadership = admitted.some((c: any) => c.predicate === 'leadership:person');

  const missing: string[] = [];
  if (!hasWebsite) missing.push('website');
  if (!hasEmail) missing.push('email');
  if (!hasPhone) missing.push('phone');
  if (!hasAddress) missing.push('address');
  if (!hasLeadership) missing.push('leadership');

  return { complete: missing.length === 0, missingObjectives: missing };
}

async function buildCanonicalFromAdmittedClaims(ctx: CampaignWorkerContext): Promise<any> {
  const { workspace } = ctx;
  const claims = workspace.claims?.filter((c: any) => c.status === 'ADMITTED') || [];

  const emailClaim = claims.find((c: any) => c.predicate === 'contact:email');
  const phoneClaim = claims.find((c: any) => c.predicate === 'contact:phone');
  const addressClaim = claims.find((c: any) => c.predicate === 'contact:address');
  const leadershipClaims = claims.filter((c: any) => c.predicate === 'leadership:person');
  const websiteSrc = workspace.sources?.find((s: any) => s.authority === 'official');

  return {
    company_name: workspace.company,
    website: websiteSrc?.canonical_url || '',
    email: emailClaim?.value || '',
    phone: phoneClaim?.value || '',
    address: addressClaim?.value || '',
    linkedin: '',
    industry: '',
    country: workspace.country,
    fax_numbers: [],
    emails_list: emailClaim ? [emailClaim.value] : [],
    phones_list: phoneClaim ? [phoneClaim.value] : [],
    linkedin_urls: [],
    addresses: addressClaim ? [{ address: addressClaim.value, type: 'head_office' }] : [],
    contact_persons: leadershipClaims.map((c: any) => {
      try { return JSON.parse(String(c.value)); } catch { return { name: String(c.value) }; }
    }),
    decision_makers: [],
    socials: [],
    sources: claims.map((c: any) => ({
      predicate: c.predicate,
      value: c.value,
      source_ids: c.source_ids,
      source_authority: c.source_authority,
    })),
    evidence: workspace.observations?.map((o: any) => ({ observation_id: o.id, source_id: o.source_id, content_hash: o.content_hash })) || [],
    isPartial: false,
    quality_status: 'COMPLETED',
    source: 'Campaign Workspace Admitted Claims',
  };
}

async function persistCanonicalIntelligence(campaignId: string, details: any, workspace: any): Promise<void> {
  const dbMod = await import('./db');
  const { applyEnrichmentDetailsToContact, selectContactEntity } = await import('./contact_projection');
  const { saveEnrichedData } = await import('./enrichment');

  await saveEnrichedData({
    ...details,
    company_name: workspace.company,
    country: workspace.country,
  });
  const contact = selectContactEntity(Array.from(dbMod.db.contacts.values()), {
    company_name: workspace.company,
    country: workspace.country,
    entity_key: workspace.entity_key,
  });
  if (contact) {
    applyEnrichmentDetailsToContact(contact, details);
    contact.last_updated = new Date().toISOString();
  }
}

export async function runCampaign(campaignId: string, testSettings?: AppSettings): Promise<void> {
  if (runningCampaigns.has(campaignId)) return;
  runningCampaigns.add(campaignId);
  try {
    let workspace = await ResearchWorkspace.get(campaignId);
    if (!workspace || terminal(workspace.status)) return;
    await ResearchWorkspace.setStatus(campaignId, 'RUNNING');
    const settings = testSettings ?? getAppSettings();

    let nvidiaFailed = false;
    let groqFailed = false;
    let zeroGainRounds = 0;
    const maxZeroGain = workspace.budget?.zero_gain_budget || 3;
    const maxTurns = 8;
    let turn = 0;

    while (!terminal(workspace.status) && turn < maxTurns) {
      turn++;
      await ResearchWorkspace.appendEvent(campaignId, 'RESEARCH_TURN_START', 'system', { turn });

      if (turn === 1) {
        await runOfficialSiteHarvest({ campaignId, workspace, settings });
        workspace = await ResearchWorkspace.get(campaignId);
      }

      await evaluateCandidateFactsAndProposeClaims({ campaignId, workspace, settings });
      workspace = await ResearchWorkspace.get(campaignId);

      const nvidiaProposal = await runNvidiaTurn({ campaignId, workspace, settings }, turn);
      workspace = await ResearchWorkspace.get(campaignId);

      let groqReview = null;
      if (!groqFailed && settings.groq_enabled && settings.groq_api_key?.trim()) {
        groqReview = await runGroqTurn({ campaignId, workspace, settings }, nvidiaProposal, turn);
        workspace = await ResearchWorkspace.get(campaignId);
      } else {
        groqFailed = true;
      }

      let accepted: Array<{ action: ControlledResearchAction; origin: 'nvidia' | 'groq' }> = [];
      if (nvidiaProposal && groqReview && groqReview.accepted_action_indexes) {
        accepted = groqReview.accepted_action_indexes
          .filter((i) => i >= 0 && i < nvidiaProposal!.actions.length)
          .map((i) => ({ action: nvidiaProposal!.actions[i], origin: 'nvidia' as const }));
        accepted.push(...(groqReview.replacement_actions || []).map((action) => ({ action, origin: 'groq' as const })));
      } else if (nvidiaProposal) {
        accepted = nvidiaProposal.actions.map((action) => ({ action, origin: 'nvidia' as const }));
      }

      const beforeTaskCount = workspace.tasks?.length || 0;
      for (const item of accepted.slice(0, workspace.budget?.query_budget || 8)) {
        const taskId = await ResearchWorkspace.addTask(campaignId, taskFromAction(item.action, item.origin, workspace.country));
        if (groqReview) {
          const index = nvidiaProposal?.actions.indexOf(item.action) ?? -1;
          const challenge = groqReview?.challenges.find((e) => e.action_index === index);
          await ResearchWorkspace.reviewTask(campaignId, taskId, 'groq', challenge ? 'CHALLENGED' : 'APPROVED', challenge?.reason || groqReview.summary);
        }
      }
      workspace = await ResearchWorkspace.get(campaignId);

      const newTasks = (workspace.tasks || []).slice(beforeTaskCount);
      console.log(`[CAMPAIGN] Processing ${newTasks.length} new tasks:`, newTasks.map(t => ({ id: t.id, capability: t.capability, objective: t.objective })));
      for (const task of newTasks) {
        console.log(`[CAMPAIGN] Executing task ${task.id} capability=${task.capability}`);
        if (task.capability === 'WEB_SEARCH') await executeSearchTask({ campaignId, workspace, settings }, task);
        else if (task.capability === 'WEB_FETCH') await executeFetchTask({ campaignId, workspace, settings }, task);
        else if (task.capability === 'OFFICIAL_SITE_HARVEST') await runOfficialSiteHarvest({ campaignId, workspace, settings });
        else console.log(`[CAMPAIGN] Unknown capability: ${task.capability} for task ${task.id}`);
        workspace = await ResearchWorkspace.get(campaignId);
      }

      await evaluateCandidateFactsAndProposeClaims({ campaignId, workspace, settings });
      workspace = await ResearchWorkspace.get(campaignId);

      const { complete, missingObjectives } = await recomputeObjectivesAndCheckCompletion({ campaignId, workspace, settings });
      await ResearchWorkspace.appendEvent(campaignId, 'OBJECTIVES_RECOMPUTED', 'system', { missing: missingObjectives, complete });

      // Check if NVIDIA recommends stopping
      if (nvidiaProposal?.recommend_stop) {
        await ResearchWorkspace.appendEvent(campaignId, 'NVIDIA_RECOMMENDS_STOP', 'system', { reason: nvidiaProposal.summary });
        break;
      }

      if (complete) {
        await ResearchWorkspace.appendEvent(campaignId, 'ALL_OBJECTIVES_MET', 'system', {});
        break;
      }

      const newGain = (workspace.candidate_facts?.length || 0) + (workspace.claims?.filter((c: any) => c.status === 'ADMITTED').length || 0);
      if (turn > 1 && newGain === 0) {
        zeroGainRounds++;
        if (zeroGainRounds >= maxZeroGain) {
          await ResearchWorkspace.appendEvent(campaignId, 'ZERO_GAIN_LIMIT_REACHED', 'system', { rounds: zeroGainRounds });
          break;
        }
      } else {
        zeroGainRounds = 0;
      }
    }

    const finalWorkspace = await ResearchWorkspace.get(campaignId);
    if (finalWorkspace) {
      console.log('[CAMPAIGN] Final workspace:', { company: finalWorkspace.company, country: finalWorkspace.country, claims: finalWorkspace.claims?.length });
      const details = await buildCanonicalFromAdmittedClaims({ campaignId, workspace: finalWorkspace, settings });
      console.log('[CAMPAIGN] Built details:', { company_name: details.company_name, country: details.country, email: details.email, phone: details.phone });
      await persistCanonicalIntelligence(campaignId, details, finalWorkspace);
      await ResearchWorkspace.setStatus(campaignId, 'COMPLETED', undefined, details);
    }
  } catch (error: any) {
    console.error('[CAMPAIGN] Error:', error);
    await ResearchWorkspace.setStatus(campaignId, 'FAILED', String(error?.message || error).slice(0, 500));
  } finally {
    runningCampaigns.delete(campaignId);
  }
}

export function startCampaign(campaignId: string): void {
  void runCampaign(campaignId);
}

export async function recoverCampaigns(): Promise<void> {
  await ResearchWorkspace.recoverInterrupted();
}
