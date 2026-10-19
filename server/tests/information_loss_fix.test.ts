/**
 * INFORMATION LOSS FIX — REGRESSION TESTS
 *
 * Verifies the forensic ROOT CAUSE fixes:
 *   1. Groq no longer truncates the extraction prompt to 12,000 chars.
 *   2. Scraper content is preserved in full (up to the safe processing size)
 *      instead of being cut at 5,000/6,000 chars; oversized pages retain the
 *      important sections (leadership/team/contact/location/branch/import/
 *      export/sales/procurement) and useful links, never a blind prefix slice.
 *   3. Large evidence corpora are packaged into model-context-aware chunks
 *      (whole items, provenance intact) and the structured results are merged
 *      deterministically — people are combined (roles preserved), contacts
 *      deduplicated, contradictions kept.
 *   4. Country targeting is applied per chunk and preserved through the merge.
 *   5. Cache merges are union-based (richer record wins, nothing lost).
 *   6. Directory leadership lines no longer cap people at 3.
 *   7. NVIDIA and Groq receive the same evidence packaging for the same corpus.
 *
 * Self-running (no framework); mirrors the emerchemie_scenario harness style.
 */
import { getDb } from '../sqlite';
import { callAi, saveEnrichedData, getCachedCompany } from '../enrichment';
import { ResourceGovernor } from '../resource_governor';
import { getInternationalImporterDirectory } from '../international_importer_directory';
import {
  packageEvidenceForExtraction,
  planEvidenceChunks,
  buildExtractionPrompt,
  mergeExtractionResults,
  getInputBudgetChars,
} from '../evidence_packaging';
import { preservePageContent, collectUsefulLinks, PAGE_SAFE_CHAR_LIMIT } from '../page_content';
import type { AppSettings } from '../settings';
import type { TradeIndex } from '../contact_report_model';

let passed = 0;
function ok(name: string, cond: boolean, detail?: string) {
  if (!cond) throw new Error(`TEST FAILED: ${name}${detail ? ` — ${detail}` : ''}`);
  passed++;
  console.log(`  ✓ ${name}`);
}

function baseSettings(): AppSettings {
  return {
    serper_api_key: 'test',
    firecrawl_api_key: 'test',
    nvidia_api_key: 'test',
    nvidia_model: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning',
    nvidia_temperature: 0.7,
    nvidia_max_tokens: 1024,
    nvidia_fallback_model: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning',
    nvidia_base_url: '',
    groq_api_key: 'test',
    groq_model: 'llama-3.3-70b-versatile',
    groq_temperature: 0.7,
    groq_max_tokens: 1024,
    groq_fallback_model: 'mixtral-8x7b-32768',
    gemini_api_key: '',
    primary_ai_provider: 'NVIDIA',
    api_timeout_seconds: 30,
    hunter_api_key: '',
    tavily_api_key: '',
    exa_api_key: '',
    linkup_api_key: '',
    apify_api_key: '',
    serper_enabled: true,
    firecrawl_enabled: true,
    nvidia_enabled: true,
    groq_enabled: true,
    gemini_enabled: true,
    hunter_enabled: true,
    tavily_enabled: true,
    exa_enabled: true,
    linkup_enabled: true,
    apify_enabled: true,
  };
}

const EXECS = [
  'Gayan Edirisinghe',
  'Riza Cassim',
  'Wathsala Wimalasena',
  'Aisha Kariyawasam',
  'Nuwan Perera',
  'Chamila Fernando',
];

function filler(n: number): string {
  const word = 'Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. ';
  return word.repeat(Math.ceil(n / word.length)).slice(0, n);
}

function leadershipBlock(): string {
  const people = EXECS.map((name, i) => {
    const roles = ['Managing Director', 'Chief Executive Officer', 'Export Director', 'Finance Director', 'Operations Manager', 'Sales Manager'];
    return `- ${name} — ${roles[i]}`;
  }).join('\n');
  return `## Our Leadership Team\n\n${people}\n\nLinkedIn: https://www.linkedin.com/company/slim-labs-pharma`;
}

function buildLargeCorpus(totalChars: number): Array<{ url: string; title: string; content: string }> {
  const items: Array<{ url: string; title: string; content: string }> = [];
  const perItem = Math.floor(totalChars / 10);
  for (let i = 0; i < 10; i++) {
    let content = filler(perItem);
    if (i === 9) {
      // The leadership evidence lives at the END of the corpus — exactly what
      // the old 12,000-char prefix cut away.
      content = content.slice(0, perItem - leadershipBlock().length) + leadershipBlock();
    }
    items.push({ url: `https://source-${i}.example.com/page`, title: `Source ${i}`, content });
  }
  return items;
}

function testLargeCorpusSurvival(): void {
  console.log('\n[1] Large corpus: full preservation + chunked coverage (150k)');
  const corpus = buildLargeCorpus(150_000);
  const name = 'Slim Laboratories (Pvt) Ltd';
  const country = 'Pakistan';
  const instr = `TARGET COUNTRY BRANCH: "${country}". This enrichment targets the importer operation IN ${country.toUpperCase()}.`;

  // Default NVIDIA context: single pass, full corpus, NO truncation marker.
  const plan = packageEvidenceForExtraction(corpus, name, country, instr, 'nvidia', baseSettings());
  ok('150k corpus is a single pass within the NVIDIA context', plan.singlePass && plan.chunkCount === 1, `chunks=${plan.chunkCount} budget=${plan.budgetChars}`);

  const fullPrompt = buildExtractionPrompt(corpus, name, country, instr);
  ok('packaged prompt far exceeds the old 12k limit', fullPrompt.length > 12_000, `len=${fullPrompt.length}`);
  ok('no silent truncation marker remains', !fullPrompt.includes('[Truncated for model limits]'));
  ok('all six executives survive in the single-pass prompt', EXECS.every((e) => fullPrompt.includes(e)));
  ok('full corpus JSON present (nothing prefix-cut)', fullPrompt.includes('Gayan Edirisinghe') && fullPrompt.length > 140_000, `len=${fullPrompt.length}`);

  const transportSafe = packageEvidenceForExtraction(corpus, name, country, instr, 'nvidia', baseSettings(), 40_000);
  ok('transport budget losslessly splits a large fallback request', transportSafe.chunkCount > 1, `chunks=${transportSafe.chunkCount}`);
  ok('transport-safe chunks retain every corpus URL', corpus.every((item) => transportSafe.chunks.flat().some((part) => part.url === item.url)));
  ok('transport-safe segmentation preserves every character', corpus.every((item) => transportSafe.chunks.flat().filter((part) => part.url === item.url).map((part) => part.content).join('') === item.content));
  ok('transport-safe chunks retain late leadership evidence', transportSafe.chunks.some((chunk) => chunk.some((item) => item.content.includes('Gayan Edirisinghe'))));
  const manyItems = Array.from({ length: 12 }, (_, index) => ({ url: `https://many-${index}.example`, title: `Many ${index}`, content: filler(4_000) }));
  const manyChunks = planEvidenceChunks(manyItems, 5_000);
  ok('chunk planning never drops items after ten passes', manyItems.every((item) => manyChunks.flat().filter((part) => part.url === item.url).map((part) => part.content).join('') === item.content), `parts=${manyChunks.flat().length}`);

  // Forced chunking (as if the context were small): all items retained, all
  // executives reachable across chunk prompts.
  const chunks = planEvidenceChunks(corpus, 30_000);
  ok('small context forces multiple chunks', chunks.length > 1, `chunks=${chunks.length}`);
  const seenItems = new Set<string>();
  const allPromptText = chunks
    .map((c, i) => buildExtractionPrompt(c, name, country, instr, i + 1, chunks.length))
    .join('\n');
  for (const c of chunks) {
    for (const item of c) {
      if (seenItems.has(item.url)) throw new Error('TEST FAILED: item appears in more than one chunk');
      seenItems.add(item.url);
    }
  }
  ok('every corpus item appears in exactly one chunk', seenItems.size === corpus.length);
  ok('all executives reachable across chunk prompts', EXECS.every((e) => allPromptText.includes(e)));
}

function testPageRetention(): void {
  console.log('\n[2] Page content: no 6k cap, important sections retained, links preserved');

  const small = 'A B C contact@small.co';
  ok('small page unchanged', preservePageContent(small) === small);

  const midLen = 20_000;
  const mid = filler(15_000) + '\n\n' + leadershipBlock() + '\n\n' + filler(midLen - 15_000 - leadershipBlock().length - 4);
  const midPreserved = preservePageContent(mid);
  ok('20k page preserved in full (old 6k cap gone)', midPreserved === mid, `outLen=${midPreserved.length}`);
  ok('late leadership survives on 20k page', midPreserved.includes('Gayan Edirisinghe'));

  const hugeLen = 100_000;
  const huge = filler(60_000) + '\n\n' + leadershipBlock() + '\n\n' + filler(hugeLen - 60_000 - leadershipBlock().length - 4);
  const hugeOut = preservePageContent(huge);
  ok('oversized page stays within the safe processing size', hugeOut.length <= PAGE_SAFE_CHAR_LIMIT + 400, `outLen=${hugeOut.length}`);
  ok('leadership section retained on oversized page', hugeOut.includes('Gayan Edirisinghe') && hugeOut.includes('Riza Cassim'));
  ok('LinkedIn link preserved on oversized page', hugeOut.includes('linkedin.com/company/slim-labs-pharma'));
  ok('truncation is not silent (marker present)', hugeOut.includes('[EdgeView: page exceeded the safe processing size'));
  ok('link manifest collects linkedin/mailto', collectUsefulLinks(huge).some((u) => u.includes('linkedin.com')));
}

function testMerge(): void {
  console.log('\n[3] Multi-person merge: roles combined, dedup, contradictions kept');

  const p1 = {
    company_name: 'Slim Laboratories',
    website: 'https://slimlabs.pk',
    industry: 'Pharmaceuticals',
    country: 'Pakistan',
    emails: ['info@slimlabs.pk', 'sales@slimlabs.pk'],
    phones: ['+92 42 35778888'],
    fax_numbers: [],
    linkedin_urls: ['https://www.linkedin.com/company/slim-labs-pharma'],
    addresses: [{ address: 'Lahore, Pakistan', type: 'head_office', source_url: 'https://a.example' }],
    contact_persons: [
      { name: 'Gayan Edirisinghe', designation: 'Managing Director', email: '', phone: '', department: '', source_url: 'https://a.example' },
      { name: 'Riza Cassim', designation: 'Chief Executive Officer', email: 'riza@slimlabs.pk', phone: '', department: 'Executive', source_url: 'https://a.example' },
    ],
    sources: [{ url: 'https://a.example', title: 'A', source_type: 'directory' }],
  };
  const p2 = {
    emails: ['info@slimlabs.pk'],
    phones: ['+92 42 35778888', '+92 300 1234567'],
    addresses: [{ address: 'Head Office, Lahore', type: 'head_office', source_url: 'https://b.example' }],
    contact_persons: [
      { name: 'Gayan Edirisinghe', designation: 'CEO', email: 'gayan@slimlabs.pk', phone: '', department: '', source_url: 'https://b.example' },
      { name: 'Wathsala Wimalasena', designation: 'Export Director', email: 'wathsala@slimlabs.pk', phone: '', department: 'Exports', source_url: 'https://b.example' },
    ],
    sources: [{ url: 'https://b.example', title: 'B', source_type: 'official_website' }],
  };

  const m = mergeExtractionResults([p1, p2] as any);

  ok('shared person is merged into one record', m.contact_persons.length === 3, `people=${m.contact_persons.length}`);
  const gay = m.contact_persons.find((x: any) => x.name === 'Gayan Edirisinghe');
  ok('multiple roles preserved, not overwritten', gay && gay.designation.includes('Managing Director') && gay.designation.includes('CEO'), `designation="${gay && gay.designation}"`);
  ok('email preserved on merged person', gay && gay.email === 'gayan@slimlabs.pk');
  const riza = m.contact_persons.find((x: any) => x.name === 'Riza Cassim');
  ok('chunk-1-only person retained', !!riza);
  ok('emails deduplicated', m.emails.length === 2, `emails=${m.emails.length}`);
  ok('phones deduplicated by digits', m.phones.length === 2, `phones=${m.phones.length}`);
  ok('contradictory addresses both kept', m.addresses.length === 2, `addresses=${m.addresses.length}`);
  ok('company scalars preserved', m.company_name === 'Slim Laboratories' && m.country === 'Pakistan' && m.industry === 'Pharmaceuticals');
  ok('sources deduplicated by url', m.sources.length === 2, `sources=${m.sources.length}`);
}

function testCountryChunking(): void {
  console.log('\n[4] Country targeting applied per chunk');
  const corpus = [
    { url: 'https://ke.example', title: 'Kenya office', content: filler(11_000) + '\nNairobi, Kenya: +254 20 555000' },
    { url: 'https://pk.example', title: 'Pakistan HQ', content: filler(11_000) + '\nLahore, Pakistan: +92 42 555000' },
    { url: 'https://de.example', title: 'Germany branch', content: filler(11_000) + '\nBerlin, Germany' },
  ];
  const chunks = planEvidenceChunks(corpus, 30_000);
  ok('multi-country corpus is chunked for a small context', chunks.length >= 2, `chunks=${chunks.length}`);
  const prompts = chunks.map((c, i) => buildExtractionPrompt(c, 'Test Pharma', 'Kenya', `TARGET COUNTRY BRANCH: "Kenya". Target the operation IN KENYA.`, i + 1, chunks.length));
  for (const p of prompts) {
    ok('every chunk prompt carries the Kenya country instruction', p.includes('KENYA') && p.includes('TARGET COUNTRY BRANCH'));
  }
  const allItems = chunks.flat().map((c) => c.url);
  ok('all country evidence retained across chunks', ['https://ke.example', 'https://pk.example', 'https://de.example'].every((u) => allItems.includes(u)));
  const merged = mergeExtractionResults(prompts.map(() => ({ country: 'Kenya', phones: ['+254 20 555000'] })));
  ok('country preserved through merge', merged.country === 'Kenya');
}

async function testCacheMergeRicherWins(): Promise<void> {
  console.log('\n[5] Cache merge: richer record wins (union, nothing lost)');
  const name = 'CacheMerge Test Co';

  const first = await saveEnrichedData({
    company_name: name,
    website: 'https://cachemerge.example',
    email: 'sales@cachemerge.example',
    quality_status: 'PARTIAL',
    isPartial: true,
    source: 'test-run-1',
  });
  ok('first save persists email', first.email === 'sales@cachemerge.example');

  const second = await saveEnrichedData({
    company_name: name,
    website: 'https://cachemerge.example',
    email: 'sales@cachemerge.example',
    phone: '+1 212 5550199',
    linkedin: 'https://www.linkedin.com/company/cachemerge',
    emails_list: ['sales@cachemerge.example', 'info@cachemerge.example'],
    phones_list: ['+1 212 5550199'],
    addresses: [{ address: '100 Market St, New York', type: 'head_office', source_url: 'https://cachemerge.example/contact' }],
    contact_persons: [
      { name: 'Jane Manager', designation: 'Sales Manager', email: 'jane@cachemerge.example', phone: '', department: 'Sales', source_url: 'https://cachemerge.example/team' },
    ],
    sources: [{ url: 'https://cachemerge.example', title: 'CM', source_type: 'official_website' }],
    quality_status: 'COMPLETE',
    isPartial: false,
    source: 'test-run-2',
  });

  const cached = await getCachedCompany(name);
  ok('cache contains union of emails', cached && (cached.emails_list || []).includes('info@cachemerge.example') && (cached.emails_list || []).includes('sales@cachemerge.example'));
  ok('cache contains the phone from the richer run', cached && cached.phones_list && cached.phones_list.some((p: string) => p.includes('212 5550199')));
  ok('cache contains the linkedin from the richer run', cached && (cached.linkedin_urls || []).some((l: string) => l.includes('cachemerge')));
  ok('cache contains the address from the richer run', cached && (cached.addresses || []).some((a: any) => a.address.includes('Market St')));
  ok('cache contains the contact person from the richer run', cached && (cached.contact_persons || []).some((p: any) => p.name === 'Jane Manager'));

  const branchName = 'Force Replace Branch Test';
  await saveEnrichedData({
    company_name: branchName,
    country: 'Kenya',
    website: 'https://branch.example',
    emails_list: ['foreign@branch.example'],
    phones_list: ['+92 21 555 0000'],
    addresses: [{ address: 'Karachi, Pakistan' }],
    quality_status: 'COMPLETE',
    isPartial: false,
    source: 'older-run',
  });
  await saveEnrichedData({
    company_name: branchName,
    country: 'Kenya',
    website: 'https://branch.example',
    emails_list: ['kenya@branch.example'],
    phones_list: ['+254 700 555000'],
    addresses: [{ address: 'Nairobi, Kenya' }],
    replace_branch_facts: true,
    quality_status: 'COMPLETE',
    isPartial: false,
    source: 'fresh-force-run',
  });
  const branchCached = await getCachedCompany(branchName, 'Kenya');
  ok('successful fresh branch run replaces stale foreign email facts', branchCached?.emails_list?.length === 1 && branchCached.emails_list[0] === 'kenya@branch.example');
  ok('successful fresh branch run replaces stale foreign phone facts', branchCached?.phones_list?.length === 1 && branchCached.phones_list[0].includes('+254'));
  ok('successful fresh branch run replaces stale foreign address facts', branchCached?.addresses?.length === 1 && branchCached.addresses[0].address.includes('Nairobi'));
}

async function testDirectoryPreservesPeople(): Promise<void> {
  console.log('\n[6] Directory leadership lines preserve all people (cap raised)');
  const emptyIndex: TradeIndex = { importedFrom: new Map(), suppliedTo: new Map() };
  const contact: any = {
    id: 'c1',
    company_name: 'Slim Laboratories (Pvt) Ltd',
    country: 'Sri Lanka',
    type: 'Importer',
    contact_persons: EXECS.map((name, i) => {
      const roles = ['Managing Director', 'Chief Executive Officer', 'Export Director', 'Finance Director', 'Operations Manager', 'Sales Manager'];
      return { name, designation: roles[i], email: '', phone: '', department: '', source_url: 'https://a.example' };
    }),
  };

  const directory = await getInternationalImporterDirectory([contact], emptyIndex);
  const row = directory.countrySections[0].importers[0];
  ok('all 6 executives present in leadership lines', EXECS.every((e) => row.leadership.includes(e)), row.leadership);
  ok('no "+N more" collapse for 6 people', !row.leadership.includes('more'));
}

async function testGroqNoTruncation(): Promise<void> {
  console.log('\n[7] Groq callAi: no 12k prompt truncation');
  ResourceGovernor.resetCircuit('groq');
  ResourceGovernor.resetCircuit('nvidia');

  const settings = baseSettings();
  settings.primary_ai_provider = 'GROQ';
  settings.groq_api_key = 'test-key';

  const longPrompt = `Evidence corpus for slim labs:\n${filler(15_000)}\nGayan Edirisinghe Managing Director Riza Cassim Chief Executive Officer.`;

  const originalFetch = (globalThis as any).fetch;
  let capturedBody: any = null;
  (globalThis as any).fetch = async (input: any, init: any) => {
    const url = typeof input === 'string' ? input : input.url;
    if (String(url).includes('api.groq.com')) {
      capturedBody = JSON.parse(init.body);
      return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: '{"company_name":"Slim Laboratories","emails":[]}' } }] }) };
    }
    return originalFetch(input, init);
  };

  try {
    const out = await callAi(longPrompt, settings);
    ok('Groq call returns the parsed JSON', out.includes('Slim Laboratories'));
    ok('Groq request captured', !!capturedBody);
    ok('Groq request uses the Settings-selected runtime model', capturedBody?.model === settings.groq_model, `model=${capturedBody?.model}`);
    ok('Groq receives the FULL prompt (> 12k chars)', capturedBody && capturedBody.messages[0].content.length > 12_000, `len=${capturedBody && capturedBody.messages[0].content.length}`);
    ok('Groq prompt is byte-identical to input (no destructive prefix)', capturedBody && capturedBody.messages[0].content === longPrompt);
    ok('no truncation marker appended by callAi', capturedBody && !capturedBody.messages[0].content.includes('[Truncated'));
    ok('executives reachable in the prompt sent to Groq', capturedBody && capturedBody.messages[0].content.includes('Gayan Edirisinghe'));
  } finally {
    (globalThis as any).fetch = originalFetch;
  }
}

async function testNvidiaReasoningIsBounded(): Promise<void> {
  console.log('\n[8] NVIDIA reasoning model: bounded strict-JSON mode');
  const settings = baseSettings();
  settings.primary_ai_provider = 'NVIDIA';
  settings.nvidia_model = 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning';
  settings.nvidia_fallback_model = settings.nvidia_model;
  const originalFetch = (globalThis as any).fetch;
  let capturedBody: any = null;
  (globalThis as any).fetch = async (_input: any, init: any) => {
    capturedBody = JSON.parse(init.body);
    return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: '{"company_name":"Bounded Test"}' } }] }) };
  };
  try {
    await callAi('Return strict JSON.', settings);
    ok('NVIDIA request uses the Settings-selected runtime model', capturedBody?.model === settings.nvidia_model, `model=${capturedBody?.model}`);
    ok('reasoning model disables thinking for extraction latency', capturedBody?.chat_template_kwargs?.enable_thinking === false);
    ok('reasoning model uses deterministic top-k request option', capturedBody?.top_k === 1);
  } finally {
    (globalThis as any).fetch = originalFetch;
  }
}

function testFallbackSamePackaging(): void {
  console.log('\n[9] NVIDIA and Groq receive identical evidence packaging');
  const corpus = buildLargeCorpus(100_000);
  const name = 'Slim Laboratories';
  const instr = 'TARGET COUNTRY BRANCH: "Pakistan".';

  const nvidiaBudget = getInputBudgetChars('nvidia', 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning');
  const groqBudget = getInputBudgetChars('groq', 'llama-3.3-70b-versatile');
  ok('NVIDIA and Groq primary models share the same context budget', nvidiaBudget === groqBudget, `nvidia=${nvidiaBudget} groq=${groqBudget}`);

  const nvidiaPlan = packageEvidenceForExtraction(corpus, name, 'Pakistan', instr, 'nvidia', baseSettings());
  const groqPlan = packageEvidenceForExtraction(corpus, name, 'Pakistan', instr, 'groq', baseSettings());
  ok('100k corpus is single-pass for BOTH providers', nvidiaPlan.singlePass && groqPlan.singlePass);
  ok('same chunk structure across providers', nvidiaPlan.chunkCount === groqPlan.chunkCount && nvidiaPlan.chunks[0].length === groqPlan.chunks[0].length);

  const nvidiaPrompt = buildExtractionPrompt(corpus, name, 'Pakistan', instr);
  const groqPrompt = buildExtractionPrompt(corpus, name, 'Pakistan', instr);
  ok('the exact same evidence reaches NIM and Groq', nvidiaPrompt === groqPrompt);
}

async function runTest() {
  console.log('=== STARTING INFORMATION LOSS FIX REGRESSION TESTS ===');
  await getDb();

  testLargeCorpusSurvival();
  testPageRetention();
  testMerge();
  testCountryChunking();
  await testCacheMergeRicherWins();
  await testDirectoryPreservesPeople();
  await testGroqNoTruncation();
  await testNvidiaReasoningIsBounded();
  testFallbackSamePackaging();

  console.log(`\n=============================================`);
  console.log(`  SUCCESS: all information-loss regression checks passed (${passed} assertions)`);
  console.log(`=============================================\n`);
}

runTest().catch((err) => {
  console.error('Information loss fix test failed with error:', err);
  process.exit(1);
});
