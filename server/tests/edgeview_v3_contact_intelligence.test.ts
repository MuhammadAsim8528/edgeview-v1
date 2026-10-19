import assert from 'node:assert';
import { normalizeCountryName, normalizeCountryExact, interpretExplicitCountryCode, detectCountriesInFreeText, compareCountryOwnership } from '../../src/utils/countryNormalizer';
import { buildEntityScopedEvidence, factHasTargetLocalOwnership } from '../evidence_neighborhood';
import { isPlausibleOfficialCompanyUrlCandidate, verifyContentBackedDomainProof } from '../official_website';
import { EvidenceGraph } from '../research_fabric';
import { ResourceGovernor } from '../resource_governor';
import { buildAIExecutionPlan, executeAIPlan } from '../ai_execution_plan';
import { scoreDiscriminativeTransactionFeatures, decomposeProductSearchFeatures } from '../trade_fingerprint';
import { calculateEnrichmentStatus, saveEnrichedData, getCachedCompany } from '../enrichment';
import { assertSafeOutboundUrl, isSafeExternalUrl } from '../url_safety';
import { classifyCanonicalSourceAuthority } from '../source_authority';
import { rememberProviderFailure } from '../provider_failure_memory';
import { applyEnrichmentDetailsToContact } from '../contact_projection';

async function runEdgeViewV3RegressionSuite() {
  console.log('====================================================');
  console.log('  EDGEVIEW V3 CONTACT INTELLIGENCE REGRESSION SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let total = 0;

  const test = (name: string, fn: () => void | Promise<void>) => {
    total++;
    try {
      const res = fn();
      if (res && typeof res.then === 'function') {
        return res.then(() => {
          console.log(`  ✓ [TEST ${total}] ${name}`);
          passed++;
        }).catch((err: any) => {
          console.error(`  ✗ [TEST ${total}] ${name} FAILED:`, err.message);
          throw err;
        });
      } else {
        console.log(`  ✓ [TEST ${total}] ${name}`);
        passed++;
      }
    } catch (err: any) {
      console.error(`  ✗ [TEST ${total}] ${name} FAILED:`, err.message);
      throw err;
    }
  };

  // 1. Geographic Resolver — No US State collisions
  await test('country_free_text_state_collision (Atlanta, GA != Gabon; Los Angeles, CA != Canada; Chicago, IL != Israel)', () => {
    assert.strictEqual(normalizeCountryName('Atlanta, GA'), 'Atlanta, GA');
    assert.strictEqual(normalizeCountryName('Los Angeles, CA'), 'Los Angeles, CA');
    assert.strictEqual(normalizeCountryName('Chicago, IL'), 'Chicago, IL');
    assert.strictEqual(normalizeCountryName('Acme Corp, San Jose, CR'), 'Acme Corp, San Jose, CR');
    assert.strictEqual(normalizeCountryName('USA'), 'United States');
    assert.strictEqual(normalizeCountryName('United States'), 'United States');
    assert.strictEqual(normalizeCountryName('Kenya'), 'Kenya');
    assert.strictEqual(normalizeCountryName('Somalia'), 'Somalia');
    assert.strictEqual(normalizeCountryName('Kyrgyzstan'), 'Kyrgyzstan');
    assert.strictEqual(normalizeCountryName('Uzbekistan'), 'Uzbekistan');
    assert.strictEqual(normalizeCountryName('Tanzania'), 'Tanzania');
  });

  // 2. Geographic Resolver — Explicit ISO codes
  await test('country_explicit_iso_code (explicit 2-3 char code resolution)', () => {
    assert.strictEqual(interpretExplicitCountryCode('KE'), 'Kenya');
    assert.strictEqual(interpretExplicitCountryCode('PK'), 'Pakistan');
    assert.strictEqual(interpretExplicitCountryCode('SO'), 'Somalia');
    assert.strictEqual(interpretExplicitCountryCode('AFG'), 'Afghanistan');
    assert.strictEqual(interpretExplicitCountryCode('INVALID'), '');
    assert.strictEqual(normalizeCountryExact('UZ'), 'Uzbekistan');
  });

  // 3. Hierarchical Fact Ownership — Case B: Neutral child heading inheritance
  await test('hierarchical_target_section_inheritance (neutral subheadings inherit parent company ownership)', () => {
    const doc = `# Hamar Trading Company
## Contact Information
Phone: +252 61 555 1234
Email: info@hamartrading.so
Address: Mogadishu, Somalia

# Another Random Vendor Ltd
## Contact Information
Phone: +1 800 555 9999`;

    const scoped = buildEntityScopedEvidence(doc, 'https://example.com/dir', 'Hamar Trading Company', 'Somalia', true);
    assert.strictEqual(scoped.mixed_entity_page, true, 'Page must be identified as mixed entity');
    assert.ok(scoped.extraction_content.includes('+252 61 555 1234'), 'Target child phone must be inherited and included');
    assert.ok(scoped.extraction_content.includes('info@hamartrading.so'), 'Target child email must be inherited and included');
    assert.ok(!scoped.extraction_content.includes('+1 800 555 9999'), 'Competitor contacts must NOT be inherited');
  });

  // 4. Hierarchical Fact Ownership — Case A & D: Competing org boundary and regulator footer
  await test('regulator_footer_fact_ownership (regulator footer contacts do not transfer to target)', () => {
    const doc = `# National Pharmacy Board Directory
## Medea Pharm
Country: Kyrgyzstan
City: Bishkek
Phone: +996 312 555 111

## Footer
Regulator Contact: info@pharmboard.gov.kg
Phone: +996 312 000 000
Copyright Ministry of Health`;

    const scoped = buildEntityScopedEvidence(doc, 'https://pharmboard.gov.kg/registry', 'Medea Pharm', 'Kyrgyzstan', true);
    assert.ok(scoped.extraction_content.includes('+996 312 555 111'), 'Target phone must be included');
    assert.ok(!scoped.extraction_content.includes('info@pharmboard.gov.kg'), 'Regulator email must be excluded from target extraction');
  });

  // 5. Official Domain & Content-Backed Domain Proof
  await test('domain_content_backed_binding (GSK acronym and content-backed verification)', () => {
    assert.strictEqual(isPlausibleOfficialCompanyUrlCandidate('https://gsk.com', 'GlaxoSmithKline'), true, 'GSK acronym must pass Route A');
    assert.strictEqual(isPlausibleOfficialCompanyUrlCandidate('https://ungujapharmacy.com', 'Unguja Pharmacy'), true, 'Unguja Pharmacy must pass Route A');
    assert.strictEqual(isPlausibleOfficialCompanyUrlCandidate('https://panjiva.com', 'Medea Pharm'), false, 'Directory host must fail');

    const contentProof = verifyContentBackedDomainProof(
      'Welcome to Medea Pharm. We are a leading pharmaceutical distributor in Bishkek, Kyrgyzstan. Contact us at info@medea.kg',
      'https://medea.kg',
      'Medea Pharm',
      'Kyrgyzstan'
    );
    assert.strictEqual(contentProof.status, 'VERIFIED', 'Content-backed domain proof must verify');
  });

  // 6. Evidence Graph Fact Collision Resistance & Observation Aggregation
  await test('evidence_graph_collision & independent_source_observation_preservation', () => {
    const graph = new EvidenceGraph();
    graph.addFact('email', 'victim@example.net', 'https://search.example', 'serper', 'search_metadata', 0.85);
    graph.addFact('email', 'info@example.com', 'https://source1.com', 'firecrawl', 'page_body', 0.85);
    graph.addFact('email', 'info@example.org', 'https://source2.com', 'firecrawl', 'page_body', 0.85);
    graph.addFact('email', 'info@example.com', 'https://source3.com', 'firecrawl', 'page_body', 0.95);

    const facts = graph.getFacts();
    assert.strictEqual(facts.length, 2, 'Two distinct emails must produce two separate fact nodes without collision');
    assert.ok(!facts.some(f => f.metadata.value === 'victim@example.net'), 'Search metadata must never create a factual node');

    const comFact = facts.find(f => f.metadata.value === 'info@example.com');
    assert.ok(comFact, 'info@example.com fact node must exist');
    assert.strictEqual(comFact?.metadata.corroborationCount, 2, 'Corroboration count must equal 2');
    assert.strictEqual(comFact?.metadata.observations?.length, 2, 'Observations list must contain both sources');
  });

  // 7. Canonical AI Execution Plan & Provider Consistency
  await test('ai_execution_provider_consistency (plan reflects primary setting and circuit health)', () => {
    const settings = {
      primary_ai_provider: 'GROQ' as const,
      groq_enabled: true,
      groq_api_key: 'gsk_test_key_123',
      groq_model: 'llama-3.3-70b-versatile',
      nvidia_enabled: true,
      nvidia_api_key: 'nv_test_key_456',
      nvidia_model: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning',
    } as any;

    const plan = buildAIExecutionPlan(settings);
    assert.strictEqual(plan.provider, 'groq', 'Plan must honor primary_ai_provider = GROQ');
    assert.strictEqual(plan.model, 'llama-3.3-70b-versatile', 'Plan must use Groq model');
    assert.ok(plan.fallbackPlan, 'Fallback plan must be prepared');
    assert.strictEqual(plan.fallbackPlan?.provider, 'groq', 'Intra-provider fallback must be groq');
    assert.strictEqual(plan.fallbackPlan?.fallbackPlan?.provider, 'nvidia', 'Cross-provider fallback must be nvidia');
  });

  // 8. Resource Governor Concurrency Throttling
  await test('provider_concurrency_limit (ResourceGovernor limits active concurrency per provider)', async () => {
    let maxObserved = 0;
    let currentlyRunning = 0;

    const promises = Array.from({ length: 10 }, async (_, i) => {
      return ResourceGovernor.executeWithRetry('nvidia', `Concurrency Test ${i}`, async () => {
        currentlyRunning++;
        maxObserved = Math.max(maxObserved, currentlyRunning);
        await new Promise((r) => setTimeout(r, 20));
        currentlyRunning--;
        return i;
      }, 1);
    });

    await Promise.all(promises);
    assert.ok(maxObserved <= 3, `Observed concurrency ${maxObserved} must be <= max limit 3`);
  });

  // 9. DTF V3 R&D & Recurrence Propagation
  await test('dtf_noise_rejection & dtf_recurrence_propagation', () => {
    const target = {
      entity_key: 'test_entity',
      company_name: 'Alimkhanov Pharm Group',
      normalized_company: 'alimkhanov pharm group',
      country: 'Uzbekistan',
      normalized_country: 'uzbekistan',
      city: 'Tashkent',
      address_fragments: ['Yunusabad district'],
      role: 'Importer',
      trade_partners: ['Getz Pharma', 'MSKU1234567'], // Real partner + OCR container noise
      products: ['Amoxicillin 500mg capsules', 'XZQWJTY123984'],
      source_file_id: '',
      dataset_id: '',
      feature_entity_frequency: { 'getz pharma': 4, 'amoxicillin': 2 },
      feature_recurrence: { 'getz pharma': 12, 'amoxicillin 500mg capsules': 8 },
      verified_partner_domains: { 'getz pharma': 'getzpharma.com' },
    };

    const features = scoreDiscriminativeTransactionFeatures(target);
    const partnerFeature = features.find(f => f.value.toLowerCase() === 'getz pharma');
    assert.ok(partnerFeature, 'Getz Pharma must be identified as high-utility feature');
    assert.ok(partnerFeature!.utility > 1.5, 'Getz Pharma utility must be high due to recurrence');

    const noiseFeature = features.find(f => f.value === 'MSKU1234567');
    assert.ok(!noiseFeature || noiseFeature.utility < 0.5, 'OCR container noise must be filtered or heavily penalized');
  });

  // 10. SSRF Security Guard — Safe Outbound URL
  await test('ssrf_security_guard (private subnets, link-local, loopback blocked)', async () => {
    assert.strictEqual(isSafeExternalUrl('http://127.0.0.1:3901/api/admin'), false);
    assert.strictEqual(isSafeExternalUrl('http://localhost:8080'), false);
    assert.strictEqual(isSafeExternalUrl('http://169.254.169.254/latest/meta-data'), false);
    assert.strictEqual(isSafeExternalUrl('http://10.0.0.1/internal'), false);
    assert.strictEqual(isSafeExternalUrl('http://192.168.1.1/router'), false);
    assert.strictEqual(isSafeExternalUrl('https://api.nvidia.com/v1'), true);
    assert.strictEqual(isSafeExternalUrl('https://google.com'), true);
  });

  // 11. Early Stopping State & Objective Families
  await test('validated_fact_stop_state & calculateEnrichmentStatus', () => {
    const incompleteProfile = {
      company_name: 'Test Corp',
      email: 'info@testcorp.com',
      address: '123 Main St',
      website: 'https://testcorp.com',
      decision_makers: [],
      contact_persons: [],
    };
    assert.strictEqual(calculateEnrichmentStatus(incompleteProfile), 'PARTIAL', 'Profile with 1 email + 1 address and NO decision makers must be PARTIAL, not COMPLETE');

    const richProfile = {
      company_name: 'Test Corp',
      email: 'info@testcorp.com',
      phone: '+1 555 123 4567',
      address: '123 Main St',
      website: 'https://testcorp.com',
      decision_makers: [{ name: 'Jane Doe', designation: 'CEO' }],
      contact_persons: [{ name: 'John Smith', designation: 'Procurement Director' }],
    };
    assert.strictEqual(calculateEnrichmentStatus(richProfile), 'COMPLETE', 'Profile with verified contacts + location + CEO must be COMPLETE');
  });

  // 12. Contact Projection Whitelist
  await test('contact_projection_whitelist (country and multi-contact fields preserved)', () => {
    const contact: any = { company_name: 'Medea Pharm' };
    const details: any = {
      company_name: 'Medea Pharm',
      country: 'Kyrgyzstan',
      website: 'https://medea.kg',
      email: 'info@medea.kg',
      emails_list: ['info@medea.kg', 'sales@medea.kg'],
      phone: '+996 312 555 111',
      phones_list: ['+996 312 555 111'],
      contact_persons: [{ name: 'Almaz Toktorbaev', designation: 'Managing Director' }],
    };

    applyEnrichmentDetailsToContact(contact, details);
    assert.strictEqual(contact.country, 'Kyrgyzstan', 'Country must be projected into contact');
    assert.strictEqual(contact.email, 'info@medea.kg', 'Primary email must be projected');
    assert.strictEqual(contact.emails_list.length, 2, 'All emails must be preserved');
  });

  // 13. Provider Failure Memory In-Place Bounding
  await test('provider_failure_memory_bounding (memory array never exceeds 20 items)', () => {
    const memory: any[] = [];
    for (let i = 0; i < 35; i++) {
      rememberProviderFailure(memory, 'nvidia', `action_${i}`, `fingerprint_${i}`, new Error(`500 Internal Server Error ${i}`));
    }
    assert.strictEqual(memory.length, 20, 'Underlying memory array must be capped at exactly 20 items');
  });

  console.log(`\n====================================================`);
  console.log(`  SUITE SUMMARY: ${passed}/${total} TESTS PASSED`);
  console.log(`====================================================\n`);
}

runEdgeViewV3RegressionSuite().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
