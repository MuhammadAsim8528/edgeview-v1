import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { classifyProviderFailure, failureContextFingerprint, rememberProviderFailure, shouldSuppressEquivalentFailure } from '../provider_failure_memory';
import { classifyCanonicalSourceAuthority } from '../source_authority';
import { scoreTruthEntity, firstLossBoundary } from '../contact_recovery_benchmark';
import { buildEntityScopedEvidence, factHasTargetLocalOwnership } from '../evidence_neighborhood';
import { buildTradeEntityFingerprint } from '../entity_proof_search';
import { decomposeProductSearchFeatures, planJointTransactionQueries, planRelationalWitnessActions, scoreDiscriminativeTransactionFeatures } from '../trade_fingerprint';
import { ProviderCapabilityRegistry } from '../../src/services/research/registry';
import { isCountryCompatiblePhone } from '../phone_country';
import { isPlausibleOfficialCompanyUrlCandidate } from '../official_website';
import { normalizeCountryName } from '../../src/utils/countryNormalizer';

const truthPath = path.resolve('.agent/benchmarks/IMPORTER_CONTACT_RECOVERY_TRUTHSET_V1.json');
const truth = JSON.parse(fs.readFileSync(truthPath, 'utf8'));
assert(truth.entities.length >= 25, 'truth set must contain at least 25 real entities');
assert(truth.entities.every((entity: any) => entity.facts.every((fact: any) => ['VERIFIED','PARTIAL','UNKNOWN'].includes(fact.status))));
const encore = truth.entities.find((entity: any) => entity.company === 'ENCORE MEDICS LIMITED');
const score = scoreTruthEntity(encore, { emails:['info@encoremedics.com'], phones:[], address:'' });
assert.equal(score.verified_total, 3);
assert.equal(score.verified_recovered, 1);
assert.equal(score.verified_missed, 2);
assert.equal(firstLossBoundary({ QUERY_NOT_GENERATED:true, SEARCH_RESULT_NOT_RETRIEVED:false }), 'SEARCH_RESULT_NOT_RETRIEVED');

assert.equal(classifyProviderFailure(new Error('HTTP 429 rate limit')), 'RATE_LIMIT');
assert.equal(classifyProviderFailure(new Error('request timeout')), 'TIMEOUT');
const fingerprint = failureContextFingerprint({ objective:'leadership', evidence:0 });
const memory = rememberProviderFailure([], 'nvidia', 'extract', fingerprint, new Error('HTTP 400 invalid request'));
assert(shouldSuppressEquivalentFailure(memory, 'nvidia', 'extract', fingerprint));
assert(!shouldSuppressEquivalentFailure(memory, 'nvidia', 'extract', failureContextFingerprint({ objective:'leadership', evidence:1 })));

const previousGemini = process.env.GEMINI_API_KEY;
process.env.GEMINI_API_KEY = 'TEST-' + 'GEMINI-FIXTURE-000000000000';
const blankSettings: any = { gemini_enabled:true, serper_enabled:true, nvidia_enabled:true, groq_enabled:true, serper_api_key:'', nvidia_api_key:'', groq_api_key:'' };
assert.equal(ProviderCapabilityRegistry.isConfigured('gemini', blankSettings), true);
assert.equal(ProviderCapabilityRegistry.isConfigured('serper', blankSettings), false);
assert.equal(ProviderCapabilityRegistry.isConfigured('nvidia', blankSettings), false);
assert.equal(ProviderCapabilityRegistry.isConfigured('groq', blankSettings), false);
if (previousGemini === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = previousGemini;

assert.equal(classifyCanonicalSourceAuthority('https://acme.example/contact', 'verified official', 'https://acme.example'), 'OFFICIAL_COMPANY');
assert.equal(classifyCanonicalSourceAuthority('https://tmda.go.tz/registry', 'government'), 'GOVERNMENT');
assert.equal(classifyCanonicalSourceAuthority('https://www.volza.com/company/x', ''), 'TRADE_DATABASE');
assert.equal(classifyCanonicalSourceAuthority('https://linkedin.com/company/acme', ''), 'PROFESSIONAL_PROFILE');
assert.equal(isCountryCompatiblePhone('+254 733 200400', 'Kenya'), true);
assert.equal(isCountryCompatiblePhone('+250 781 074000', 'Kenya'), false);
assert.equal(isCountryCompatiblePhone('+254 731 64XXXX', 'Kenya'), false);
assert.equal(isCountryCompatiblePhone('020 1234567', 'Kenya'), true);
assert.equal(isPlausibleOfficialCompanyUrlCandidate('https://alimkhanov.com', 'ALIMKHANOV PHARM GROUP FC'), true);
assert.equal(isPlausibleOfficialCompanyUrlCandidate('https://uzpharm-gxp.uz', 'ALIMKHANOV PHARM GROUP FC'), false);
assert.equal(normalizeCountryName('Kyrzyghistan'), 'Kyrgyzstan');
assert.equal(isCountryCompatiblePhone('+420 724 296 960', 'Kyrzyghistan'), false);

const decomposed = decomposeProductSearchFeatures('Cardioval-XZ41 500mg tablets');
assert(decomposed.some((feature) => feature.kind === 'product_code' || feature.kind === 'brand_token'));
assert(decomposed.some((feature) => feature.kind === 'strength'));
assert(decomposed.some((feature) => feature.kind === 'dosage_form'));
const fp = buildTradeEntityFingerprint('Acme Importers Ltd', { country:'Tanzania', traded_with:['Rare Exporter AG'], known_products:['Cardioval-XZ41 500mg tablets'], trade_feature_recurrence:{'rare exporter ag':3}, verified_partner_domains:{'rare exporter ag':'rare-exporter.example'} });
const features = scoreDiscriminativeTransactionFeatures(fp);
assert(features.find((feature) => feature.value === 'Rare Exporter AG')!.recurrence >= 3);
assert(planJointTransactionQueries(fp, features).some((row) => row.query.includes('Rare Exporter AG')));
const witnesses = planRelationalWitnessActions(fp, features, 3);
assert(witnesses.some((row) => row.query.includes('site:rare-exporter.example')));
assert(witnesses.some((row) => row.query.includes('filetype:pdf')));

const document = buildEntityScopedEvidence([
  '[Page 12]',
  'Company,Country,Address,Phone',
  'ACME IMPORTERS LTD,Tanzania,Plot 10 Dar es Salaam,+255 700 111 222',
  'OTHER COMPANY LTD,Kenya,Nairobi,+254 700 999 999',
].join('\n'), 'https://registry.example/list.pdf', 'ACME IMPORTERS LTD', 'Tanzania', true);
assert(document.blocks.some((block) => ['DOCUMENT_SECTION','CSV_LIKE_ROW','CONTACT_BLOCK'].includes(block.block_type)));
assert(factHasTargetLocalOwnership(document, '+255 700 111 222'));
assert(!factHasTargetLocalOwnership(document, '+254 700 999 999'));

const productionFiles = [
  'server/research_runtime.ts','server/research_director.ts','server/entity_proof_search.ts',
  'server/trade_fingerprint.ts','server/evidence_packaging.ts','server/research_fabric.ts','server/enrichment.ts',
];
for (const file of productionFiles) {
  const body = fs.readFileSync(file, 'utf8');
  assert(!/HAMAR TRADING COMPANY|KobacGT|SLIM PHARMACEUTICALS/i.test(body), `benchmark literal leaked into production source: ${file}`);
}

console.log('contact_recovery_breakthrough_v2_1.test.ts: PASS');
