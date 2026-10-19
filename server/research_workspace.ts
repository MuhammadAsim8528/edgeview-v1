import { createHash, randomUUID } from 'node:crypto';
import { canonicalCompanyIdentityKey } from './company_identity';
import { getDb } from './sqlite';

export type CampaignStatus = 'QUEUED' | 'RUNNING' | 'AI_DEGRADED' | 'COMPLETED' | 'FAILED' | 'PAUSED';
export type CampaignActor = 'system' | 'nvidia' | 'groq' | 'provider' | 'deterministic';

export type ClaimStatus = 'CANDIDATE' | 'HOLD' | 'ADMITTED' | 'REJECTED' | 'DISPUTED' | 'SUPERSEDED';

export interface CampaignBudget {
  wall_time_ms: number;
  query_budget: number;
  fetch_budget: number;
  ai_reasoning_budget: number;
  zero_gain_budget: number;
}

export interface CampaignTaskInput {
  objective: string;
  capability: string;
  query?: string;
  target_country?: string;
  hypothesis?: string;
  desired_source_types?: string[];
  preferred_providers?: string[];
  priority?: number;
  reason?: string;
  origin_agent: 'nvidia' | 'groq' | 'deterministic';
  arguments?: Record<string, unknown>;
}

export const DEFAULT_CAMPAIGN_BUDGET: CampaignBudget = {
  wall_time_ms: 180_000,
  query_budget: 8,
  fetch_budget: 8,
  ai_reasoning_budget: 6,
  zero_gain_budget: 3,
};

let eventAppendQueue: Promise<unknown> = Promise.resolve();

function parseJson<T>(value: unknown, fallback: T): T {
  try { return JSON.parse(String(value || '')) as T; } catch (_) { return fallback; }
}

function requestKey(entityKey: string, forceFetch: boolean): string {
  return createHash('sha256').update(`${entityKey}\0${forceFetch ? 'force' : 'normal'}`).digest('hex');
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

async function appendEventNow(campaignId: string, eventType: string, actor: CampaignActor, payload: unknown): Promise<number> {
  const db = await getDb();
  const now = new Date().toISOString();
  const row = await db.get('SELECT id FROM research_campaigns WHERE id = ?', [campaignId]);
  if (!row) throw new Error('CAMPAIGN_NOT_FOUND');
  await db.run(
    `INSERT INTO research_campaign_events (campaign_id, version, event_type, actor, payload_json, created_at)
     SELECT id, version + 1, ?, ?, ?, ? FROM research_campaigns WHERE id = ?`,
    [eventType, actor, JSON.stringify(payload ?? {}), now, campaignId]
  );
  await db.run('UPDATE research_campaigns SET version = version + 1, updated_at = ? WHERE id = ?', [now, campaignId]);
  const updated = await db.get('SELECT version FROM research_campaigns WHERE id = ?', [campaignId]);
  return Number(updated?.version || 0);
}

function appendEventInternal(campaignId: string, eventType: string, actor: CampaignActor, payload: unknown): Promise<number> {
  const operation = eventAppendQueue.then(() => appendEventNow(campaignId, eventType, actor, payload));
  eventAppendQueue = operation.catch(() => undefined);
  return operation;
}

export class ResearchWorkspace {
  static async createOrGet(input: { company: string; country?: string; entity_key?: string; force_fetch?: boolean; context?: Record<string, unknown>; budget?: Partial<CampaignBudget> }) {
    const company = input.company.trim();
    const country = String(input.country || '').trim();
    const entityKey = String(input.entity_key || `${canonicalCompanyIdentityKey(company)}__${country.toLowerCase()}`).trim();
    const forceFetch = Boolean(input.force_fetch);
    const key = requestKey(entityKey, forceFetch);
    const db = await getDb();
    const active = await db.get(
      `SELECT id FROM research_campaigns WHERE request_key = ? AND status IN ('QUEUED','RUNNING','AI_DEGRADED','PAUSED') ORDER BY created_at DESC LIMIT 1`,
      [key]
    );
    if (active?.id) return { campaign: await this.get(active.id), created: false };

    const id = `campaign-${Date.now()}-${randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();
    const budget = { ...DEFAULT_CAMPAIGN_BUDGET, ...(input.budget || {}) };
    await db.run(
      `INSERT INTO research_campaigns
       (id, request_key, entity_key, company, country, force_fetch, status, version, objective, context_json, budget_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'QUEUED', 0, ?, ?, ?, ?, ?)`,
      [id, key, entityKey, company, country, forceFetch ? 1 : 0,
        `Research ${company}${country ? ` in ${country}` : ''} with public evidence`, JSON.stringify(input.context || {}), JSON.stringify(budget), now, now]
    );
    await appendEventInternal(id, 'CAMPAIGN_CREATED', 'system', { company, country, entity_key: entityKey, force_fetch: forceFetch, budget });
    return { campaign: await this.get(id), created: true };
  }

  static async appendEvent(campaignId: string, eventType: string, actor: CampaignActor, payload: unknown = {}) {
    return appendEventInternal(campaignId, eventType, actor, payload);
  }

  static async setStatus(campaignId: string, status: CampaignStatus, errorMessage?: string, result?: unknown) {
    const db = await getDb();
    const now = new Date().toISOString();
    const terminal = status === 'COMPLETED' || status === 'FAILED';
    await db.run(
      'UPDATE research_campaigns SET status = ?, error_message = ?, result_json = COALESCE(?, result_json), updated_at = ?, completed_at = ? WHERE id = ?',
      [status, errorMessage || null, result === undefined ? null : JSON.stringify(result), now, terminal ? now : null, campaignId]
    );
    await appendEventInternal(campaignId, terminal ? 'CAMPAIGN_FINALIZED' : 'CAMPAIGN_STATUS_CHANGED', 'system', { status, error: errorMessage || null });
  }

  static async addTask(campaignId: string, input: CampaignTaskInput) {
    const db = await getDb();
    const id = `task-${randomUUID()}`;
    const now = new Date().toISOString();
    await db.run(
      `INSERT INTO research_campaign_tasks
       (id, campaign_id, objective, capability, query_text, target_country, hypothesis, desired_source_types_json,
        preferred_providers_json, arguments_json, priority, reason, origin_agent, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, campaignId, input.objective.slice(0, 240), input.capability.slice(0, 80), input.query?.slice(0, 500) || null,
        input.target_country || '', input.hypothesis || '', JSON.stringify(input.desired_source_types || []),
        JSON.stringify(input.preferred_providers || []), JSON.stringify(input.arguments || {}), Math.max(0, Math.min(100, input.priority ?? 50)), input.reason || '', input.origin_agent, now, now]
    );
    await appendEventInternal(campaignId, 'TASK_CREATED', input.origin_agent, { task_id: id, ...input });
    return id;
  }

  static async reviewTask(campaignId: string, taskId: string, reviewer: 'nvidia' | 'groq', status: 'APPROVED' | 'CHALLENGED' | 'REJECTED', reason = '') {
    const db = await getDb();
    await db.run(
      'UPDATE research_campaign_tasks SET reviewer_agent = ?, review_status = ?, reason = CASE WHEN ? = \'\' THEN reason ELSE ? END, updated_at = ? WHERE id = ? AND campaign_id = ?',
      [reviewer, status, reason, reason, new Date().toISOString(), taskId, campaignId]
    );
    await appendEventInternal(campaignId, status === 'CHALLENGED' ? 'TASK_CHALLENGED' : 'QUERY_APPROVED', reviewer, { task_id: taskId, status, reason });
  }

  static async addSource(campaignId: string, source: { url: string; title?: string; provider?: string; source_type?: string; authority?: string }) {
    const db = await getDb();
    const canonicalUrl = cleanUrl(source.url);
    const id = `source-${createHash('sha256').update(`${campaignId}\0${canonicalUrl}`).digest('hex').slice(0, 20)}`;
    const now = new Date().toISOString();
    const existing = await db.get('SELECT discovered_by_json FROM research_campaign_sources WHERE campaign_id = ? AND canonical_url = ?', [campaignId, canonicalUrl]);
    const providers = new Set(parseJson<string[]>(existing?.discovered_by_json, []));
    if (source.provider) providers.add(source.provider);
    await db.run(
      `INSERT INTO research_campaign_sources
       (id, campaign_id, canonical_url, title, source_type, authority, discovered_by_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(campaign_id, canonical_url) DO UPDATE SET
         title = CASE WHEN excluded.title = '' THEN title ELSE excluded.title END,
         discovered_by_json = excluded.discovered_by_json,
         updated_at = excluded.updated_at`,
      [id, campaignId, canonicalUrl, source.title || '', source.source_type || 'web', source.authority || 'unknown', JSON.stringify([...providers]), now, now]
    );
    await appendEventInternal(campaignId, 'SOURCE_DISCOVERED', 'provider', { source_id: id, url: canonicalUrl, provider: source.provider || '' });
    return id;
  }

  static async admitCanonicalClaim(campaignId: string, claim: { id?: string; predicate: string; value: unknown; source_ids?: string[]; proposed_by?: string }) {
    const db = await getDb();
    const valueJson = JSON.stringify(claim.value);
    const id = claim.id || `claim-${createHash('sha256').update(`${campaignId}\0${claim.predicate}\0${valueJson}`).digest('hex').slice(0, 20)}`;
    const now = new Date().toISOString();
    await db.run(
      `INSERT INTO research_campaign_claims
       (id, campaign_id, predicate, value_json, source_ids_json, status, proposed_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'ADMITTED', ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET status = 'ADMITTED', source_ids_json = excluded.source_ids_json, updated_at = excluded.updated_at`,
      [id, campaignId, claim.predicate, valueJson, JSON.stringify(claim.source_ids || []), claim.proposed_by || 'deterministic', now, now]
    );
    await appendEventInternal(campaignId, 'CLAIM_ADMITTED', 'deterministic', { claim_id: id, predicate: claim.predicate });
    return id;
  }

  static async addObservation(campaignId: string, observation: {
    source_id: string;
    fetch_method: string;
    fetch_provider: string;
    content: string;
    country_entity_context?: string;
    retrieval_metadata?: Record<string, unknown>;
  }) {
    const db = await getDb();
    const contentHash = createHash('sha256').update(observation.content).digest('hex');
    const id = `obs-${createHash('sha256').update(`${campaignId}\0${observation.source_id}\0${contentHash}`).digest('hex').slice(0, 20)}`;
    const now = new Date().toISOString();
    await db.run(
      `INSERT INTO research_campaign_observations
       (id, campaign_id, source_id, fetch_method, fetch_provider, fetched_at, content_hash, normalized_content, country_entity_context, retrieval_metadata_json, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'FETCHED')`,
      [id, campaignId, observation.source_id, observation.fetch_method, observation.fetch_provider, now, contentHash, observation.content.slice(0, 50000), observation.country_entity_context || '', JSON.stringify(observation.retrieval_metadata || {})]
    );
    await appendEventInternal(campaignId, 'OBSERVATION_RECORDED', 'provider', { observation_id: id, source_id: observation.source_id, fetch_method: observation.fetch_method });
    return id;
  }

  static async addCandidateFact(campaignId: string, candidateFact: {
    observation_id: string;
    field_type: string;
    raw_value: string;
    normalized_value?: string;
    validator: string;
    validation_result: string;
    confidence?: number;
    proposed_by: string;
  }) {
    const db = await getDb();
    const id = `fact-${randomUUID()}`;
    const now = new Date().toISOString();
    await db.run(
      `INSERT INTO research_campaign_candidate_facts
       (id, campaign_id, observation_id, field_type, raw_value, normalized_value, validator, validation_result, confidence, proposed_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, campaignId, candidateFact.observation_id, candidateFact.field_type, candidateFact.raw_value, candidateFact.normalized_value || '', candidateFact.validator, candidateFact.validation_result, candidateFact.confidence || 0.5, candidateFact.proposed_by, now]
    );
    await appendEventInternal(campaignId, 'CANDIDATE_FACT_PROPOSED', candidateFact.proposed_by as CampaignActor, { fact_id: id, field_type: candidateFact.field_type, validation_result: candidateFact.validation_result });
    return id;
  }

  static async proposeClaim(campaignId: string, claim: {
    predicate: string;
    value: unknown;
    source_ids: string[];
    observation_ids: string[];
    proposed_by: string;
    entity_key: string;
    country_attribution: string;
    fact_ownership: string;
    source_authority: string;
  }) {
    const db = await getDb();
    const valueJson = JSON.stringify(claim.value);
    const id = `claim-${createHash('sha256').update(`${campaignId}\0${claim.predicate}\0${valueJson}`).digest('hex').slice(0, 20)}`;
    const now = new Date().toISOString();
    await db.run(
      `INSERT INTO research_campaign_claims
       (id, campaign_id, predicate, value_json, source_ids_json, observation_ids_json, status, proposed_by, entity_key, country_attribution, fact_ownership, source_authority, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'CANDIDATE', ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET status = 'CANDIDATE', source_ids_json = excluded.source_ids_json, observation_ids_json = excluded.observation_ids_json, updated_at = excluded.updated_at`,
      [id, campaignId, claim.predicate, valueJson, JSON.stringify(claim.source_ids), JSON.stringify(claim.observation_ids), claim.proposed_by, claim.entity_key, claim.country_attribution, claim.fact_ownership, claim.source_authority, now, now]
    );
    await appendEventInternal(campaignId, 'CLAIM_PROPOSED', claim.proposed_by as CampaignActor, { claim_id: id, predicate: claim.predicate, status: 'CANDIDATE' });
    return id;
  }

  static async updateClaimStatus(campaignId: string, claimId: string, status: ClaimStatus, actor: CampaignActor, reason?: string) {
    const db = await getDb();
    const now = new Date().toISOString();
    const challengeBy = status === 'DISPUTED' || status === 'REJECTED' ? actor : null;
    await db.run(
      `UPDATE research_campaign_claims SET status = ?, challenged_by = COALESCE(?, challenged_by), challenge_reason = COALESCE(?, challenge_reason), updated_at = ? WHERE id = ? AND campaign_id = ?`,
      [status, challengeBy, reason || null, now, claimId, campaignId]
    );
    await appendEventInternal(campaignId, `CLAIM_${status}`, actor, { claim_id: claimId, reason: reason || '' });
  }

  static async admitClaim(campaignId: string, claimId: string, actor: CampaignActor = 'deterministic') {
    return this.updateClaimStatus(campaignId, claimId, 'ADMITTED', actor);
  }

  static async holdClaim(campaignId: string, claimId: string, actor: CampaignActor = 'deterministic', reason = 'Awaiting corroboration') {
    return this.updateClaimStatus(campaignId, claimId, 'HOLD', actor, reason);
  }

  static async rejectClaim(campaignId: string, claimId: string, actor: CampaignActor = 'deterministic', reason = 'Failed validation') {
    return this.updateClaimStatus(campaignId, claimId, 'REJECTED', actor, reason);
  }

  static async disputeClaim(campaignId: string, claimId: string, actor: CampaignActor = 'groq', reason = 'Challenged by reviewer') {
    return this.updateClaimStatus(campaignId, claimId, 'DISPUTED', actor, reason);
  }

  static async get(campaignId: string) {
    const db = await getDb();
    const campaign = await db.get('SELECT * FROM research_campaigns WHERE id = ?', [campaignId]);
    if (!campaign) return null;
    const [tasks, sources, claims, events, observations, candidateFacts] = await Promise.all([
      db.all('SELECT * FROM research_campaign_tasks WHERE campaign_id = ? ORDER BY priority DESC, created_at ASC', [campaignId]),
      db.all('SELECT * FROM research_campaign_sources WHERE campaign_id = ? ORDER BY created_at ASC', [campaignId]),
      db.all('SELECT * FROM research_campaign_claims WHERE campaign_id = ? ORDER BY created_at ASC', [campaignId]),
      db.all('SELECT * FROM research_campaign_events WHERE campaign_id = ? ORDER BY version ASC', [campaignId]),
      db.all('SELECT id, campaign_id, source_id, fetch_method, fetch_provider, fetched_at, content_hash, content_ref, normalized_content, country_entity_context, retrieval_metadata_json, status FROM research_campaign_observations WHERE campaign_id = ? ORDER BY fetched_at ASC', [campaignId]),
      db.all('SELECT * FROM research_campaign_candidate_facts WHERE campaign_id = ? ORDER BY created_at ASC', [campaignId]),
    ]);
    return {
      id: campaign.id,
      entity_key: campaign.entity_key,
      company: campaign.company,
      country: campaign.country,
      force_fetch: Boolean(campaign.force_fetch),
      status: campaign.status,
      version: Number(campaign.version || 0),
      objective: campaign.objective,
      context: parseJson(campaign.context_json, {}),
      budget: parseJson(campaign.budget_json, DEFAULT_CAMPAIGN_BUDGET),
      result: parseJson(campaign.result_json, null),
      error_message: campaign.error_message || '',
      created_at: campaign.created_at,
      updated_at: campaign.updated_at,
      completed_at: campaign.completed_at || '',
      tasks: tasks.map((row) => ({ ...row, desired_source_types: parseJson(row.desired_source_types_json, []), preferred_providers: parseJson(row.preferred_providers_json, []), arguments: parseJson(row.arguments_json, {}) })),
      sources: sources.map((row) => ({ ...row, discovered_by: parseJson(row.discovered_by_json, []) })),
      claims: claims.map((row) => ({ ...row, value: parseJson(row.value_json, null), source_ids: parseJson(row.source_ids_json, []), observation_ids: parseJson(row.observation_ids_json, []) })),
      events: events.map((row) => ({ ...row, payload: parseJson(row.payload_json, {}) })),
      observations: observations.map((row) => ({ ...row, retrieval_metadata: parseJson(row.retrieval_metadata_json, {}) })),
      candidate_facts: candidateFacts,
    };
  }

  static async list(limit = 30) {
    const db = await getDb();
    return db.all('SELECT id, entity_key, company, country, force_fetch, status, version, objective, error_message, created_at, updated_at, completed_at FROM research_campaigns ORDER BY created_at DESC LIMIT ?', [Math.max(1, Math.min(100, limit))]);
  }

  static async getActive() {
    const db = await getDb();
    const row = await db.get(`SELECT id FROM research_campaigns WHERE status IN ('QUEUED','RUNNING','AI_DEGRADED','PAUSED') ORDER BY created_at DESC LIMIT 1`);
    return row?.id ? this.get(row.id) : null;
  }

  static async recoverInterrupted() {
    const db = await getDb();
    await db.run(`UPDATE research_campaigns SET status = 'PAUSED', updated_at = ? WHERE status IN ('RUNNING','AI_DEGRADED')`, [new Date().toISOString()]);
  }
}
