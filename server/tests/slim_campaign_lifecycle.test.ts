import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const dir = path.join(process.cwd(), '.test-cache', `slim-campaign-${process.pid}-${Date.now()}`);
fs.mkdirSync(dir, { recursive: true });
process.env.EDGEVIEW_TEST_MODE = '1';
process.env.EDGEVIEW_TEST_DB_DIR = dir;
process.env.EDGEVIEW_SQLITE_DB = path.join(dir, 'slim_campaign.db');

const { ResearchWorkspace } = await import('../research_workspace');
const { runCampaign, startCampaign } = await import('../campaign_workers');
const { resetDbInstanceForTests } = await import('../sqlite');

const settings: any = {
  nvidia_api_key: 'test-nvidia', nvidia_enabled: true, nvidia_model: 'nvidia-test', nvidia_max_tokens: 1000, nvidia_temperature: 0,
  groq_api_key: 'test-groq', groq_enabled: true, groq_model: 'groq-test', groq_max_tokens: 1000, groq_temperature: 0,
  gemini_enabled: false, api_timeout_seconds: 2, primary_ai_provider: 'NVIDIA', nvidia_reasoning_mode: 'INSTRUCT',
  serper_api_key: 'test-serper', serper_enabled: true,
  exa_api_key: 'test-exa', exa_enabled: true,
  tavily_api_key: 'test-tavily', tavily_enabled: true,
  linkup_enabled: false, hunter_enabled: false,
  firecrawl_enabled: false, apify_enabled: false,
};

const nvidiaCalls: string[] = [];
const groqCalls: string[] = [];
const fetchCalls: string[] = [];

(globalThis as any).__mockExecuteAIPlan = async (plan: any, prompt: string, _settings: any, label: string) => {
  if (plan.provider === 'nvidia') {
    nvidiaCalls.push(label);
    if (label.includes('NVIDIA_TURN_START') || prompt.includes('PRIMARY RESEARCH DIRECTOR')) {
      return {
        content: JSON.stringify({
          summary: 'Find leadership and contact info for Slim Pharma',
          missing_information: ['leadership', 'email', 'phone', 'address'],
          actions: [
            { action: 'search_web', reason: 'Find official website and leadership', arguments: { query: 'SLIM Pharmaceuticals Sri Lanka official website contact', target_type: 'website', providers: ['serper', 'exa', 'tavily'] } },
            { action: 'search_web', reason: 'Find leadership team', arguments: { query: 'SLIM Pharmaceuticals Sri Lanka chairman managing director', target_type: 'leadership', providers: ['serper', 'exa', 'tavily'] } },
            { action: 'search_web', reason: 'Find contact details', arguments: { query: 'SLIM Pharmaceuticals Sri Lanka email phone address Colombo', target_type: 'contact_page', providers: ['serper', 'exa', 'tavily'] } },
          ],
          recommend_stop: false,
        }),
        executedProvider: 'nvidia',
        executedModel: 'nvidia-test',
        attempts: 1,
        latencyMs: 1,
      };
    }
    return { content: '{}', executedProvider: 'nvidia', executedModel: 'nvidia-test', attempts: 1, latencyMs: 1 };
  }
  if (plan.provider === 'groq') {
    groqCalls.push(label);
    if (label.includes('GROQ_TURN_START') || prompt.includes('ADVERSARIAL RESEARCH CO-DIRECTOR')) {
      return {
        content: JSON.stringify({
          verdict: 'APPROVE',
          accepted_action_indexes: [0, 1, 2],
          challenges: [],
          replacement_actions: [],
          summary: 'All queries appropriate for Slim Pharma Sri Lanka entity',
        }),
        executedProvider: 'groq',
        executedModel: 'groq-test',
        attempts: 1,
        latencyMs: 1,
      };
    }
    return { content: '{}', executedProvider: 'groq', executedModel: 'groq-test', attempts: 1, latencyMs: 1 };
  }
  throw new Error('Unknown provider');
};

(globalThis as any).fetch = async (input: any) => {
  const url = String(input);
  fetchCalls.push(url);

  if (url.includes('serper')) {
    return { ok: true, json: async () => ({ organic: [
      { link: 'https://slimpharma.com/', title: 'SLIM Pharmaceuticals', snippet: 'Official website' },
      { link: 'https://slimpharma.com/contact', title: 'Contact Us', snippet: 'Contact information' },
      { link: 'https://slimpharma.com/corporate-management', title: 'Corporate Management', snippet: 'Leadership team' },
    ]}) };
  }
  if (url.includes('exa')) {
    return { ok: true, json: async () => ({ results: [
      { url: 'https://slimpharma.com/', title: 'SLIM Pharmaceuticals', text: 'Official website' },
      { url: 'https://slimpharma.com/contact', title: 'Contact Us', text: 'info@slimpharma.com +94-11-268-1680' },
      { url: 'https://slimpharma.com/corporate-management', title: 'Corporate Management', text: 'Sumith Premaratne Chairman' },
    ]}) };
  }
  if (url.includes('tavily')) {
    return { ok: true, json: async () => ({ results: [
      { url: 'https://slimpharma.com/contact', title: 'Contact Us', content: 'info@slimpharma.com +94-11-268-1680 123 Hospital Road Colombo 00700 Sri Lanka' },
      { url: 'https://slimpharma.com/corporate-management', title: 'Corporate Management', content: 'Sumith Premaratne Chairman' },
    ]}) };
  }
  if (url.includes('slimpharma.com')) {
    const content = url.includes('contact') 
      ? 'SLIM PHARMACEUTICALS PVT LTD\nHead Office Address\n123 Hospital Road, Colombo 00700, Sri Lanka\nEmail: info@slimpharma.com\nPhone: +94-11-268-1680'
      : 'Sumith Premaratne\nChairman';
    return { ok: true, text: async () => content };
  }
  throw new Error(`Unexpected URL ${url}`);
};

console.log('--- Creating Slim campaign ---');
const created = await ResearchWorkspace.createOrGet({ 
  company: 'SLIM PHARMACEUTICALS PVT LTD', 
  country: 'Sri Lanka', 
  force_fetch: true,
  context: { role: 'Importer', dataset_id: 'test' }
});
console.log('Campaign created:', created.campaign.id);

console.log('--- Running campaign ---');
await runCampaign(created.campaign.id, settings);

console.log('--- Verifying results ---');
const final = await ResearchWorkspace.get(created.campaign.id);
console.log('Final status:', final?.status);
console.log('Tasks:', final?.tasks?.length || 0);
console.log('Sources:', final?.sources?.length || 0);
console.log('Observations:', final?.observations?.length || 0);
console.log('Candidate facts:', final?.candidate_facts?.length || 0);
console.log('Claims:', final?.claims?.length || 0);

assert.equal(final?.status, 'COMPLETED', 'Campaign should complete');
assert.ok((final?.tasks?.length || 0) > 0, 'Should have tasks');
assert.ok((final?.sources?.length || 0) > 0, 'Should have sources');
assert.ok((final?.observations?.length || 0) > 0, 'Should have observations');
assert.ok((final?.candidate_facts?.length || 0) > 0, 'Should have candidate facts');
assert.ok((final?.claims?.length || 0) > 0, 'Should have claims');

const admittedClaims = final?.claims?.filter((c: any) => c.status === 'ADMITTED') || [];
assert.ok(admittedClaims.length > 0, 'Should have admitted claims');

const emailClaim = admittedClaims.find((c: any) => c.predicate === 'contact:email');
assert.ok(emailClaim, 'Should have admitted email claim');
assert.equal(emailClaim.value, 'info@slimpharma.com');

const phoneClaim = admittedClaims.find((c: any) => c.predicate === 'contact:phone');
assert.ok(phoneClaim, 'Should have admitted phone claim');
assert.ok(String(phoneClaim.value).includes('268-1680'));

const addressClaim = admittedClaims.find((c: any) => c.predicate === 'contact:address');
assert.ok(addressClaim, 'Should have admitted address claim');
assert.ok(String(addressClaim.value).includes('Colombo'));

const leadershipClaim = admittedClaims.find((c: any) => c.predicate === 'leadership:person');
assert.ok(leadershipClaim, 'Should have admitted leadership claim');
const leader = JSON.parse(String(leadershipClaim.value));
assert.equal(leader.name, 'Sumith Premaratne');
assert.equal(leader.designation, 'Chairman');

const websiteSrc = final?.sources?.find((s: any) => s.authority === 'official');
assert.ok(websiteSrc, 'Should have official website source');
assert.ok(websiteSrc.canonical_url.includes('slimpharma.com'));

console.log('NVIDIA calls:', nvidiaCalls.length);
console.log('Groq calls:', groqCalls.length);
console.log('Fetch calls:', fetchCalls.length);
assert.ok(nvidiaCalls.length >= 1, 'NVIDIA should be called');
assert.ok(groqCalls.length >= 1, 'Groq should be called');
assert.ok(fetchCalls.length > 0, 'Fetch should be called');

resetDbInstanceForTests();
const reopened = await ResearchWorkspace.get(created.campaign.id);
assert.equal(reopened?.id, created.campaign.id);
assert.equal(reopened?.status, 'COMPLETED');
console.log('Reopened campaign status:', reopened?.status);

console.log('\n=== SLIM CAMPAIGN LIFECYCLE TEST PASSED ===');