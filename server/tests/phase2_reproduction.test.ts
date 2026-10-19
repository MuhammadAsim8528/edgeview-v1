import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const dir = path.join(process.cwd(), '.test-cache', `phase2-repro-${process.pid}-${Date.now()}`);
fs.mkdirSync(dir, { recursive: true });
process.env.EDGEVIEW_TEST_MODE = '1';
process.env.EDGEVIEW_TEST_DB_DIR = dir;
process.env.EDGEVIEW_SQLITE_DB = path.join(dir, 'phase2_repro.db');

const { ResearchWorkspace } = await import('../research_workspace');
const { runCampaign } = await import('../campaign_workers');
const { resetDbInstanceForTests, getDb } = await import('../sqlite');

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

const nvidiaTurns: any[] = [];
const groqTurns: any[] = [];
const taskEvents: any[] = [];
const providerEvents: any[] = [];
const candidateFacts: any[] = [];
const claimEvents: any[] = [];
const workspaceVersions: any[] = [];

(globalThis as any).__mockExecuteAIPlan = async (plan: any, prompt: string, _settings: any, label: string) => {
  if (plan.provider === 'nvidia') {
    const turnMatch = prompt.match(/This is turn (\d+) of the campaign/);
    const turn = turnMatch ? parseInt(turnMatch[1]) : 1;
    nvidiaTurns.push({ turn, label, promptLength: prompt.length, timestamp: Date.now() });
    
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
  if (plan.provider === 'groq') {
    const turnMatch = prompt.match(/This is turn (\d+)/);
    const turn = turnMatch ? parseInt(turnMatch[1]) : 1;
    groqTurns.push({ turn, label, promptLength: prompt.length, timestamp: Date.now() });
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
  throw new Error('Unknown provider');
};

(globalThis as any).fetch = async (input: any) => {
  const url = typeof input === 'string' ? input : (input?.url || String(input));
  providerEvents.push({ url, timestamp: Date.now() });
  
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

// Hook into workspace to capture state at each turn
const originalRunCampaign = runCampaign;
let turnStates: any[] = [];

console.log('=== PHASE 2: REPRODUCING SLIM CAMPAIGN FROM CURRENT CODE ===');
const created = await ResearchWorkspace.createOrGet({ 
  company: 'SLIM PHARMACEUTICALS PVT LTD', 
  country: 'Sri Lanka', 
  force_fetch: true,
  context: { role: 'Importer', dataset_id: 'test' }
});
const campaignId = created.campaign.id;
console.log('Campaign ID:', campaignId);

await runCampaign(campaignId, settings);

console.log('\n=== REPRODUCTION COMPLETE ===');
const final = await ResearchWorkspace.get(campaignId);
console.log('Final status:', final?.status);
console.log('Tasks:', final?.tasks?.length || 0);
console.log('Sources:', final?.sources?.length || 0);
console.log('Observations:', final?.observations?.length || 0);
console.log('Candidate facts:', final?.candidate_facts?.length || 0);
console.log('Claims:', final?.claims?.length || 0);

console.log('\n=== NVIDIA TURNS ===');
for (const t of nvidiaTurns) {
  console.log(`Turn ${t.turn}: ${t.label} (prompt: ${t.promptLength} chars)`);
}

console.log('\n=== GROQ TURNS ===');
for (const t of groqTurns) {
  console.log(`Turn ${t.turn}: ${t.label} (prompt: ${t.promptLength} chars)`);
}

console.log('\n=== PROVIDER EVENTS ===');
const providerCounts = new Map();
for (const e of providerEvents) {
  const host = new URL(e.url).host;
  providerCounts.set(host, (providerCounts.get(host) || 0) + 1);
}
for (const [host, count] of providerCounts) {
  console.log(`${host}: ${count} requests`);
}

console.log('\n=== CANDIDATE FACTS BREAKDOWN ===');
const factsByType = new Map();
for (const f of final?.candidate_facts || []) {
  const key = f.field_type;
  factsByType.set(key, (factsByType.get(key) || 0) + 1);
}
for (const [type, count] of factsByType) {
  console.log(`${type}: ${count} candidates`);
}

console.log('\n=== CLAIMS BREAKDOWN ===');
const claimsByStatus = new Map();
const claimsByPredicate = new Map();
for (const c of final?.claims || []) {
  claimsByStatus.set(c.status, (claimsByStatus.get(c.status) || 0) + 1);
  const predKey = `${c.predicate}:${JSON.stringify(c.value)}`;
  if (!claimsByPredicate.has(predKey)) claimsByPredicate.set(predKey, []);
  claimsByPredicate.get(predKey)!.push(c);
}

console.log('By status:');
for (const [status, count] of claimsByStatus) {
  console.log(`  ${status}: ${count}`);
}

console.log('\nBy predicate (unique claims):');
for (const [pred, claims] of claimsByPredicate) {
  console.log(`  ${pred}: ${claims.length} claim(s) [statuses: ${claims.map(c => c.status).join(', ')}]`);
}

// Deduplication audit
console.log('\n=== CLAIM CARDINALITY AUDIT ===');
const phoneClaims = Array.from(claimsByPredicate.entries()).filter(([k]) => k.includes('contact:phone'));
const emailClaims = Array.from(claimsByPredicate.entries()).filter(([k]) => k.includes('contact:email'));
const addressClaims = Array.from(claimsByPredicate.entries()).filter(([k]) => k.includes('contact:address'));
const personClaims = Array.from(claimsByPredicate.entries()).filter(([k]) => k.includes('leadership:person'));

console.log(`Phone unique values: ${phoneClaims.length}`);
for (const [k, v] of phoneClaims) {
  const vals = [...new Set(v.map(c => String(c.value)).filter(Boolean))];
  if (vals.length > 1) console.log(`  DUPLICATE VALUES: ${vals.join(' | ')}`);
}

console.log(`Email unique values: ${emailClaims.length}`);
for (const [k, v] of emailClaims) {
  const vals = [...new Set(v.map(c => String(c.value)).filter(Boolean))];
  if (vals.length > 1) console.log(`  DUPLICATE VALUES: ${vals.join(' | ')}`);
}

console.log(`Address unique values: ${addressClaims.length}`);
for (const [k, v] of addressClaims) {
  const vals = [...new Set(v.map(c => String(c.value)).filter(Boolean))];
  if (vals.length > 1) console.log(`  DUPLICATE VALUES: ${vals.join(' | ')}`);
}

console.log(`Person unique values: ${personClaims.length}`);
for (const [k, v] of personClaims) {
  const vals = [...new Set(v.map(c => String(c.value)).filter(Boolean))];
  if (vals.length > 1) console.log(`  DUPLICATE VALUES: ${vals.join(' | ')}`);
}

resetDbInstanceForTests();
console.log('\n=== PHASE 2 REPRODUCTION TEST PASSED ===');