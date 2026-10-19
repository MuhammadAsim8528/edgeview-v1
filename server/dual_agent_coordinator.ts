import { buildAIExecutionPlan, executeAIPlan, type AIProviderName } from './ai_execution_plan';
import { extractJsonBlock, safeJsonParse } from './enrichment';
import { ControlledToolRegistry, type ControlledResearchAction } from './research_runtime';
import { getAppSettings, type AppSettings } from './settings';
import { ResearchWorkspace, type CampaignTaskInput } from './research_workspace';

export interface AgentActionProposal {
  summary: string;
  missing_information: string[];
  actions: ControlledResearchAction[];
  recommend_stop?: boolean;
}

export interface AgentReview {
  verdict: 'APPROVE' | 'REVISE' | 'REJECT';
  accepted_action_indexes: number[];
  challenges: Array<{ action_index: number; reason: string }>;
  replacement_actions: ControlledResearchAction[];
  summary: string;
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

function pinnedPlan(settings: AppSettings, provider: AIProviderName) {
  const plan = buildAIExecutionPlan(settings, { preferredProvider: provider, temperature: 0, maxTokens: 1800 });
  if (plan.provider !== provider) throw new Error(`${provider.toUpperCase()}_UNAVAILABLE`);
  return { ...plan, fallbackPlan: undefined };
}

function boundedSnapshot(workspace: any): string {
  return JSON.stringify({
    campaign_id: workspace.id,
    entity_key: workspace.entity_key,
    company: workspace.company,
    country: workspace.country,
    objective: workspace.objective,
    context: workspace.context,
    budget: workspace.budget,
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
  }).slice(0, 30_000);
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
  };
}

export class DualAgentCoordinator {
  static async initializeCampaign(campaignId: string, settings = getAppSettings()) {
    const workspace = await ResearchWorkspace.get(campaignId);
    if (!workspace) throw new Error('CAMPAIGN_NOT_FOUND');
    const snapshot = boundedSnapshot(workspace);
    let director: AgentActionProposal | null = null;
    let review: AgentReview | null = null;

    try {
      await ResearchWorkspace.appendEvent(campaignId, 'AGENT_STARTED', 'nvidia', { role: 'PRIMARY_RESEARCH_DIRECTOR', model: settings.nvidia_model });
      const result = await executeAIPlan(
        pinnedPlan(settings, 'nvidia'),
        `You are EdgeView's PRIMARY RESEARCH DIRECTOR. Inspect this shared campaign workspace and propose up to four controlled research actions. Do not assert facts and do not use snippets as evidence. Return JSON only: {"summary":"...","missing_information":["..."],"actions":[{"action":"search_web","reason":"...","arguments":{"query":"...","target_type":"leadership"}}],"recommend_stop":false}. Allowed actions: ${ControlledToolRegistry.describe()}. WORKSPACE: ${snapshot}`,
        settings,
        'Campaign NVIDIA Research Director'
      );
      const parsed = parseObject(result.content);
      director = {
        summary: String(parsed.summary || '').slice(0, 500),
        missing_information: Array.isArray(parsed.missing_information) ? parsed.missing_information.map(String).slice(0, 12) : [],
        actions: validateActions(parsed.actions),
        recommend_stop: Boolean(parsed.recommend_stop),
      };
      await ResearchWorkspace.appendEvent(campaignId, 'AGENT_ACTIONS_PROPOSED', 'nvidia', { summary: director.summary, actions: director.actions, model: result.executedModel });
    } catch (error: any) {
      await ResearchWorkspace.appendEvent(campaignId, 'AGENT_FAILED', 'nvidia', { role: 'PRIMARY_RESEARCH_DIRECTOR', error: String(error?.message || error).slice(0, 300) });
    }

    if (director) {
      try {
        await ResearchWorkspace.appendEvent(campaignId, 'AGENT_STARTED', 'groq', { role: 'ADVERSARIAL_CO_DIRECTOR', model: settings.groq_model });
        const result = await executeAIPlan(
          pinnedPlan(settings, 'groq'),
          `You are EdgeView's ADVERSARIAL RESEARCH CO-DIRECTOR. Review NVIDIA's proposed actions against immutable entity/country context. Challenge drift, weak queries, unsupported assumptions, and redundant cost. Return JSON only: {"verdict":"APPROVE|REVISE|REJECT","accepted_action_indexes":[0],"challenges":[{"action_index":1,"reason":"..."}],"replacement_actions":[],"summary":"..."}. Any replacement must use: ${ControlledToolRegistry.describe()}. WORKSPACE: ${snapshot} NVIDIA_PROPOSAL: ${JSON.stringify(director)}`,
          settings,
          'Campaign Groq Adversarial Reviewer'
        );
        const parsed = parseObject(result.content);
        review = {
          verdict: ['APPROVE', 'REVISE', 'REJECT'].includes(parsed.verdict) ? parsed.verdict : 'REJECT',
          accepted_action_indexes: Array.isArray(parsed.accepted_action_indexes) ? parsed.accepted_action_indexes.filter(Number.isInteger).slice(0, 4) : [],
          challenges: Array.isArray(parsed.challenges) ? parsed.challenges.slice(0, 8).map((item: any) => ({ action_index: Number(item.action_index), reason: String(item.reason || '').slice(0, 300) })) : [],
          replacement_actions: validateActions(parsed.replacement_actions),
          summary: String(parsed.summary || '').slice(0, 500),
        };
        await ResearchWorkspace.appendEvent(campaignId, 'AGENT_REVIEWED', 'groq', { ...review, model: result.executedModel });
      } catch (error: any) {
        await ResearchWorkspace.appendEvent(campaignId, 'AGENT_FAILED', 'groq', { role: 'ADVERSARIAL_CO_DIRECTOR', error: String(error?.message || error).slice(0, 300) });
      }
    }

    let accepted: Array<{ action: ControlledResearchAction; origin: 'nvidia' | 'groq' }> = [];
    if (director && review) {
      accepted = review.accepted_action_indexes
        .filter((index) => index >= 0 && index < director!.actions.length)
        .map((index) => ({ action: director!.actions[index], origin: 'nvidia' as const }));
      accepted.push(...review.replacement_actions.map((action) => ({ action, origin: 'groq' as const })));
    } else if (director) {
      accepted = director.actions.map((action) => ({ action, origin: 'nvidia' as const }));
    }

    const taskIds: string[] = [];
    for (const item of accepted.slice(0, workspace.budget.query_budget || 8)) {
      const taskId = await ResearchWorkspace.addTask(campaignId, taskFromAction(item.action, item.origin, workspace.country));
      taskIds.push(taskId);
      if (review) {
        const index = director?.actions.indexOf(item.action) ?? -1;
        const challenge = review.challenges.find((entry) => entry.action_index === index);
        await ResearchWorkspace.reviewTask(campaignId, taskId, 'groq', challenge ? 'CHALLENGED' : 'APPROVED', challenge?.reason || review.summary);
      }
    }
    return { director, review, taskIds, degraded: !director || !review };
  }
}
