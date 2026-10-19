import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const dir = path.join(process.cwd(), '.test-cache', `dual-agent-${process.pid}-${Date.now()}`);
fs.mkdirSync(dir, { recursive: true });
process.env.EDGEVIEW_TEST_MODE = '1';
process.env.EDGEVIEW_TEST_DB_DIR = dir;
process.env.EDGEVIEW_SQLITE_DB = path.join(dir, 'workspace.db');

const { ResearchWorkspace } = await import('../research_workspace');
const { DualAgentCoordinator } = await import('../dual_agent_coordinator');
const settings: any = {
  nvidia_api_key: 'test-nvidia', nvidia_enabled: true, nvidia_model: 'nvidia-test', nvidia_max_tokens: 1000, nvidia_temperature: 0,
  groq_api_key: 'test-groq', groq_enabled: true, groq_model: 'groq-test', groq_max_tokens: 1000, groq_temperature: 0,
  gemini_enabled: false, api_timeout_seconds: 2, primary_ai_provider: 'NVIDIA', nvidia_reasoning_mode: 'INSTRUCT',
};
const calls: string[] = [];
(globalThis as any).__mockExecuteAIPlan = async (plan: any, _prompt: string, _settings: any, label: string) => {
  calls.push(`${plan.provider}:${label}:${Boolean(plan.fallbackPlan)}`);
  if (plan.provider === 'nvidia') return { content: JSON.stringify({ summary: 'Find leadership', missing_information: ['leadership'], actions: [{ action: 'search_web', reason: 'Find official leadership', arguments: { query: 'Slim Pharmaceuticals Sri Lanka chairman managing director', target_type: 'leadership', providers: ['serper', 'exa', 'tavily'] } }] }), executedProvider: 'nvidia', executedModel: 'nvidia-test', attempts: 1, latencyMs: 1 };
  return { content: JSON.stringify({ verdict: 'APPROVE', accepted_action_indexes: [0], challenges: [], replacement_actions: [], summary: 'Entity and country context retained' }), executedProvider: 'groq', executedModel: 'groq-test', attempts: 1, latencyMs: 1 };
};

const created = await ResearchWorkspace.createOrGet({ company: 'SLIM PHARMACEUTICALS PVT LTD', country: 'Sri Lanka', force_fetch: true });
const outcome = await DualAgentCoordinator.initializeCampaign(created.campaign.id, settings);
assert.equal(outcome.degraded, false);
assert.equal(outcome.taskIds.length, 1);
assert.deepEqual(calls, [
  'nvidia:Campaign NVIDIA Research Director:false',
  'groq:Campaign Groq Adversarial Reviewer:false',
]);
const workspace = await ResearchWorkspace.get(created.campaign.id);
assert.equal(workspace?.tasks[0].origin_agent, 'nvidia');
assert.equal(workspace?.tasks[0].reviewer_agent, 'groq');
assert.equal(workspace?.tasks[0].review_status, 'APPROVED');

settings.groq_enabled = false;
const degradedCampaign = await ResearchWorkspace.createOrGet({ company: 'SURAD MEDICAL SUPPLIES COMPANY', country: 'Sudan', force_fetch: true });
const degraded = await DualAgentCoordinator.initializeCampaign(degradedCampaign.campaign.id, settings);
assert.equal(degraded.degraded, true);
assert.equal(degraded.taskIds.length, 1, 'NVIDIA plus deterministic validation continues when Groq is unavailable');
const degradedWorkspace = await ResearchWorkspace.get(degradedCampaign.campaign.id);
assert.ok(degradedWorkspace?.events.some((event: any) => event.event_type === 'AGENT_FAILED' && event.actor === 'groq'));
delete (globalThis as any).__mockExecuteAIPlan;
console.log('dual_agent_campaign.test.ts: PASS');
