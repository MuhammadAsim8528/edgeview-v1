import assert from 'node:assert/strict';
import { assessEvidenceForCountry, focusEvidenceForCompany, isPlausibleOfficialCompanyUrl, ResearchDirector } from '../research_director';
import { getCachedCompany, saveEnrichedData } from '../enrichment';
import { applyEnrichmentDetailsToContact } from '../contact_projection';

const chamberListing = `Uqiqa Cooperative Agriculture. Contact Yuusuf at Hamar Weyne, Mogadishu, Somalia.
University of Somalia. Universal General Trading Establishment. Many unrelated member rows follow.`;
const broadDirectory = assessEvidenceForCountry(
  chamberListing,
  'http://somalichamber.so/admin/mbr?page=5',
  'HAMAR TRADING COMPANY',
  'Somalia'
);
assert.equal(broadDirectory.decision, 'REJECT', 'geographic Hamar + unrelated Trading must not establish Hamar Trading Company');

const exactRow = assessEvidenceForCountry(
  'HAMAR TRADING COMPANY — registered Somali chamber member, Mogadishu, Somalia.',
  'https://registry.example/hamar-trading-company',
  'HAMAR TRADING COMPANY',
  'Somalia',
  undefined,
  { sourceType: 'authoritative_registry' }
);
assert.equal(exactRow.decision, 'ADMIT');

const scoped = focusEvidenceForCompany(
  `HAMAR TRADING COMPANY trade shipment profile.${'x'.repeat(1500)}55 Water Street New York directory operator footer`,
  'HAMAR TRADING COMPANY',
  400
);
assert.doesNotMatch(scoped, /55 Water Street/, 'third-party directory chrome outside the entity window must not reach extraction');
assert.equal(isPlausibleOfficialCompanyUrl('https://www.volza.com/company-profile/hamar-trading', 'HAMAR TRADING COMPANY'), false);
assert.equal(isPlausibleOfficialCompanyUrl('https://hamartrading.example/contact', 'HAMAR TRADING COMPANY'), true);

const company = `HamarInvalidation_${Date.now()}`;
await saveEnrichedData({
  company_name: company,
  country: 'Somalia',
  website: 'https://kobacgt.so',
  email: 'info@kobacgt.so',
  phones_list: ['+252 619 520 999'],
  decision_makers: [{ id: 'old', name: 'Hassan Kobac', designation: 'CEO', emails: [], phones: [], whatsapp: { value: '', status: 'unknown' }, socials: [] }],
  sources: [{ url: 'https://kobacgt.so', title: 'wrong candidate', source_type: 'web' }],
});
await saveEnrichedData({
  company_name: company,
  country: 'Somalia',
  quality_status: 'NOT_FOUND',
  invalidate_existing_identity: true,
  replace_branch_facts: true,
  website: 'www.volza.com',
  address: 'Not answerable',
  addresses: [{ address: 'Not answerable', source_url: 'https://www.volza.com/company-profile/hamar' }],
  sources: [{ url: 'https://www.volza.com/company-profile/hamar', title: 'trade directory', source_type: 'directory' }],
  evidence: [],
});
const cleared = await getCachedCompany(company, 'Somalia');
assert.equal(cleared?.website, '');
assert.equal(cleared?.email, '');
assert.deepEqual(cleared?.phones_list, []);
assert.deepEqual(cleared?.decision_makers, []);
const projected: any = { website: 'https://kobacgt.so', email: 'info@kobacgt.so', phone: '+252 old', ceo: 'Hassan Kobac' };
applyEnrichmentDetailsToContact(projected, cleared);
assert.equal(projected.website, '');
assert.equal(projected.email, '');
assert.equal(projected.ceo, '');

const plannerState: any = {
  id: 'test', name: 'HAMAR TRADING COMPANY', status: 'processing', initialized: true,
  evidenceCorpus: [{ url: 'https://example.test', content: 'supporting evidence' }],
  plannedQueries: [{ query: 'HAMAR TRADING COMPANY Somalia management leadership', target_type: 'leadership', status: 'completed' }],
};
ResearchDirector.proposeNextAction(plannerState, { country: 'Somalia' });
const firstCount = plannerState.plannedQueries.length;
plannerState.plannedQueries.forEach((q: any) => { q.status = 'completed'; });
ResearchDirector.proposeNextAction(plannerState, { country: 'Somalia' });
const keys = plannerState.plannedQueries.map((q: any) => q.query.toLowerCase().replace(/\s+/g, ' ').trim());
assert.equal(new Set(keys).size, keys.length, 'escalation must never append an identical query');
assert.ok(plannerState.plannedQueries.length >= firstCount);

console.log('hamar_entity_contamination_regression.test.ts: PASS');
