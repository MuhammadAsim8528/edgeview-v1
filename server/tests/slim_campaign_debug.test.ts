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

(globalThis as any).__mockExecuteAIPlan = async (plan: any, prompt: string, _settings: any, label: string) => {
  console.log(`[MOCK AI] ${plan.provider} - ${label}`);
  if (plan.provider === 'nvidia') {
    if (prompt.includes('PRIMARY RESEARCH DIRECTOR')) {
      const turnMatch = prompt.match(/This is turn (\d+) of the campaign/);
      const turn = turnMatch ? parseInt(turnMatch[1]) : 1;
      console.log(`[MOCK AI] NVIDIA detected turn: ${turn}`);
      
      // Turn 1: Search for website and leadership
      if (turn === 1) {
        return {
          content: JSON.stringify({
            summary: 'Find official website and leadership for Slim Pharma',
            missing_information: ['leadership', 'email', 'phone', 'address'],
            actions: [
              { action: 'search_web', reason: 'Find official website', arguments: { query: 'SLIM Pharmaceuticals Sri Lanka official website', target_type: 'website', providers: ['serper', 'exa', 'tavily'] } },
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
      // Turn 2: Fetch the discovered pages
      if (turn === 2) {
        return {
          content: JSON.stringify({
            summary: 'Fetch discovered official pages for contact and leadership details',
            missing_information: ['email', 'phone', 'address', 'leadership'],
            actions: [
              { action: 'scrape_page', reason: 'Fetch contact page for email/phone/address', arguments: { url: 'https://slimpharma.com/contact' } },
              { action: 'scrape_page', reason: 'Fetch leadership page for chairman details', arguments: { url: 'https://slimpharma.com/corporate-management' } },
            ],
            recommend_stop: false,
          }),
          executedProvider: 'nvidia',
          executedModel: 'nvidia-test',
          attempts: 1,
          latencyMs: 1,
        };
      }
      // Turn 3: Done
      return {
        content: JSON.stringify({
          summary: 'All key information gathered from official sources',
          missing_information: [],
          actions: [],
          recommend_stop: true,
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
    if (prompt.includes('ADVERSARIAL RESEARCH CO-DIRECTOR')) {
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
  console.log(`[MOCK FETCH] ${url}`);

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
try {
  await runCampaign(created.campaign.id, settings);
} catch (e) {
  console.error('Campaign error:', e);
}

console.log('--- Verifying results ---');
const final = await ResearchWorkspace.get(created.campaign.id);
console.log('Final status:', final?.status);
console.log('Tasks:', final?.tasks?.length || 0);
console.log('Sources:', final?.sources?.length || 0);
console.log('Observations:', final?.observations?.length || 0);
console.log('Candidate facts:', final?.candidate_facts?.length || 0);
console.log('Claims:', final?.claims?.length || 0);

if (final?.events) {
  console.log('\nEvents:');
  for (const event of final.events) {
    console.log(`  v${event.version} ${event.event_type} [${event.actor}] ${JSON.stringify(event.payload).slice(0, 200)}`);
  }
}

resetDbInstanceForTests();