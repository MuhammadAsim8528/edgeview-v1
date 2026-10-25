import assert from 'node:assert/strict';
import { isDirectoryOrPlatformDomain, registrableDomain, resolveOfficialDomain } from '../v1_identity';
import { validPhone, validBusinessEmail, plausiblePersonName, projectDeterministicContactFields, safeDecodeUriComponent } from '../job_manager';
import { classifyRunStatus, fallbackIdentityQueries } from '../v1_engine';

for (const garbage of ['2022-01-13', '2010-03-19', '2025-04-24', '13.109856', '50412 - 00200']) {
  assert.equal(validPhone(garbage), false, `${garbage} must never be displayed as a phone number`);
}
assert.equal(validPhone('+250 789920625 Email: patrick@company.com Read More About Rwanda Branch'), false);
assert.equal(validPhone('+94 11 268 1680'), true);
for (const placeholder of ['234567899', '0123456789', '999999999']) {
  assert.equal(validPhone(placeholder), false, `${placeholder} must be rejected as a placeholder phone`);
}
assert.equal(validBusinessEmail('procurement@sto.mv'), true);
assert.equal(validBusinessEmail('email@example.com'), false);
assert.equal(validBusinessEmail('yourname@company.com'), false);
assert.equal(validBusinessEmail('605a7baede844d278b89dc95ae0a9123@sentry-next.wixpress.com'), false);
assert.equal(validBusinessEmail('your@email.com'), false);
assert.equal(validBusinessEmail('john@doe.com'), false);
assert.equal(validBusinessEmail('254-737-203-030info@harleysltd.com'), false);
assert.equal(validBusinessEmail('malto:person@example.com'), false);
assert.equal(validBusinessEmail('tel:info@example.com'), false);
assert.equal(validBusinessEmail('sales@example-company.com'), true);
assert.equal(validPhone('+7(7112280793'), false);
assert.equal(validPhone('+7 (7112) 28-25-57'), true);
assert.equal(plausiblePersonName('Jane Target'), true);
assert.equal(plausiblePersonName('Dr. Aung Wint Zaw'), true);
for (const heading of ['Corporate Management', 'Key Management Team', 'Regulatory Officer', 'Malasakit Care Team', 'Our management brings extensive experience in the healthcare sector']) {
  assert.equal(plausiblePersonName(heading), false, `${heading} must not be projected as a person`);
}
assert.equal(safeDecodeUriComponent('%2B94%2011%20268%201680'), '+94 11 268 1680');
assert.equal(safeDecodeUriComponent('%E0%A4%A'), '%E0%A4%A', 'malformed page data must be isolated rather than aborting a company run');

assert.deepEqual(fallbackIdentityQueries('Hyperpharm Ltd', 'Mauritius', 3), [
  '"Hyperpharm Ltd" "Mauritius"',
  'Hyperpharm Ltd Mauritius official website',
  'Hyperpharm Ltd Mauritius contact management leadership',
]);
assert.equal(classifyRunStatus(0, true, 3), 'PARTIAL', 'successful empty searches are a NOT_FOUND outcome, not an engine failure');
assert.equal(classifyRunStatus(0, true, 0), 'FAILED', 'a run with no result and no successful search really failed');

assert.equal(isDirectoryOrPlatformDomain('www.volza.com'), true);
assert.equal(isDirectoryOrPlatformDomain('trial.medpath.com'), true);
assert.equal(isDirectoryOrPlatformDomain('slimpharma.com'), false);
assert.equal(registrableDomain('https://ansapharmaltd.com.clearwebstats.com/report'), 'clearwebstats.com');
assert.equal(registrableDomain('https://shop.example.co.uk/contact'), 'example.co.uk');
assert.equal(isDirectoryOrPlatformDomain('ug.africabz.com'), true);

const slim = resolveOfficialDomain('SLIM PHARMACEUTICALS PVT LTD', 'Sri Lanka', [
  { url: 'https://trademo.com/companies/slim-pharmaceuticals', title: 'SLIM Pharmaceuticals trade data', provider: 'serper', rank: 1 },
  { url: 'https://slimpharma.com/contact-us', title: 'Contact SLIM Pharmaceuticals Sri Lanka', snippet: 'Official contact page', provider: 'serper', rank: 2 },
  { url: 'https://slimpharma.com/about', title: 'About SLIM Pharmaceuticals', snippet: 'Sri Lanka', provider: 'tavily', rank: 1 },
]);
assert.equal(slim.official_domain, 'slimpharma.com', 'official company domain wins over a trade directory');
assert.equal(slim.candidates.find(candidate => candidate.domain === 'trademo.com')?.accepted, false);

const exactGlobalCom = resolveOfficialDomain('ACME BIOLOGICS LIMITED', 'Kenya', [
  { url: 'https://acmebiologics.com/about', title: 'ACME Biologics Limited', snippet: 'About our company', provider: 'serper', rank: 1 },
]);
assert.equal(exactGlobalCom.official_domain, 'acmebiologics.com', 'an exact top-ranked global company identity must not require the country in the snippet');

const pharmatrade = resolveOfficialDomain('PHARMATRADE ETHICALS LTD', 'Kenya', [
  { url: 'https://volza.com/company-profile/pharmatrade-ethicals', title: 'Pharmatrade Ethicals import data', provider: 'serper', rank: 1 },
  { url: 'https://trademo.com/companies/pharmatrade-ethicals', title: 'Pharmatrade Ethicals shipments', provider: 'tavily', rank: 1 },
]);
assert.equal(pharmatrade.official_domain, '', 'no website is safer than falsely promoting a directory');

const unrelated = resolveOfficialDomain('ZILLION INTERNATIONAL TRADING PTE LTD', 'Thailand', [
  { url: 'https://recordowl.com/company/zillion-international', title: 'Zillion International company record', provider: 'serper', rank: 1 },
  { url: 'https://companies.sg/business/123/zillion-international', title: 'Zillion International Pte Ltd', provider: 'tavily', rank: 2 },
]);
assert.equal(unrelated.official_domain, '');

const wrongSameCountryBrand = resolveOfficialDomain('ZILLION INTERNATIONAL TRADING PTE LTD', 'Thailand', [
  { url: 'https://zillioninnovation.com/', title: 'Zillion Innovation Co., Ltd.', snippet: 'Bangkok Thailand', provider: 'exa', rank: 1 },
]);
assert.equal(wrongSameCountryBrand.official_domain, '', 'sharing one brand token and country is not enough to establish exact entity ownership');

const hostedDirectory = resolveOfficialDomain('ANSA PHARMA LTD', 'Ghana', [
  { url: 'https://ansapharmaltd.com.clearwebstats.com', title: 'ANSA Pharma Ltd Ghana', snippet: 'Website statistics', provider: 'serper', rank: 1 },
]);
assert.equal(hostedDirectory.official_domain, '', 'a matching hosted subdomain never turns the hosting directory into the official company domain');

const genericCollision = resolveOfficialDomain('HAMAR TRADING COMPANY', 'Somalia', [
  { url: 'https://salmatradingconstruction.com', title: 'Salma Trading and Construction', snippet: 'Somalia', provider: 'serper', rank: 1 },
]);
assert.equal(genericCollision.official_domain, '', 'generic trading/country overlap cannot replace the company brand');

const shortGenericBrand = resolveOfficialDomain('ROSE TRADE', "Lao People's Democra", [
  { url: 'https://rose.org/meet-the-ars-leadership/', title: 'Rose leadership', snippet: 'Search result for Rose Trade Laos', provider: 'serper', rank: 1 },
]);
assert.equal(shortGenericBrand.official_domain, '', 'a short generic word on an unrelated global domain is not company identity proof');

const personCollision = resolveOfficialDomain('HO VAN CONG', 'Vietnam', [
  { url: 'https://drcongphan.vn', title: 'Dr Cong Phan', snippet: 'Vietnam', provider: 'serper', rank: 1 },
]);
assert.equal(personCollision.official_domain, '', 'one shared personal-name token cannot establish exact identity');

const genericPrefix = resolveOfficialDomain('ETS GLOBAL BUSINESS', 'Chad', [
  { url: 'https://etsglobal.org', title: 'ETS Global', snippet: 'Testing services including programs in Chad', provider: 'serper', rank: 1 },
]);
assert.equal(genericPrefix.official_domain, '', 'a shorter generic domain prefix cannot establish the full company identity');

const sto = resolveOfficialDomain('M/s. State Trading Organization Plc', 'Maldives', [
  { url: 'https://sto.mv/about-us', title: 'About State Trading Organization Plc', snippet: 'Maldives', provider: 'serper', rank: 1 },
  { url: 'https://www.sto.mv/contact-us', title: 'State Trading Organization Contact', snippet: 'Maldives', provider: 'tavily', rank: 1 },
]);
assert.equal(sto.official_domain, 'sto.mv', 'country-code acronym domains are accepted when independent evidence matches the full identity');
const stoSingleProvider = resolveOfficialDomain('M/s. State Trading Organization Plc', 'Maldives', [
  { url: 'https://sto.mv/about-us', title: 'About State Trading Organization Plc', snippet: 'Maldives', provider: 'serper', rank: 1 },
]);
assert.equal(stoSingleProvider.official_domain, 'sto.mv', 'an exact country-code acronym plus full-name search evidence is sufficient without provider-count gaming');

const getz = resolveOfficialDomain('GETZ PHARMA INTERNATIONAL FZ-LLC DUBAI', 'Kazakistan', [
  { url: 'https://getzpharma.com/global-presence', title: 'Getz Pharma International', snippet: 'Our presence in Kazakhstan', provider: 'serper', rank: 1 },
  { url: 'https://getzpharma.com/contact-us', title: 'Getz Pharma contact', snippet: 'Global pharmaceutical company', provider: 'tavily', rank: 1 },
]);
assert.equal(getz.official_domain, 'getzpharma.com', 'known country spelling variants must not cause false negatives');

const topPrime = resolveOfficialDomain('TOP PRIME TRADING CO., LTD.', 'Myanmar', [
  { url: 'https://topprime.com.mm/contact', title: 'Top Prime Trading Co Ltd', snippet: 'Myanmar', provider: 'serper', rank: 1 },
]);
assert.equal(topPrime.official_domain, 'topprime.com.mm', 'official domains may omit generic legal and trading words');

const alFajiri = resolveOfficialDomain('AL FAJIRI PHARMACEUTICALS LTD', 'Kenya', [
  { url: 'https://alfajiripharmaceuticals.com/about', title: 'Al Fajiri Pharmaceuticals Ltd', snippet: 'Kenya', provider: 'serper', rank: 1 },
]);
assert.equal(alFajiri.official_domain, 'alfajiripharmaceuticals.com', 'a core brand embedded in the domain remains specific when full identity and country agree');

const shipToNoise = resolveOfficialDomain('GETZ PHARMA INTERNATIONAL - FZ LLC, DUBAI UAE SHIP TO STRONG', 'Azerbaijan', [
  { url: 'https://getzpharma.com/global-presence', title: 'Getz Pharma International', snippet: 'Azerbaijan', provider: 'serper', rank: 1 },
]);
assert.equal(shipToNoise.official_domain, 'getzpharma.com', 'customs ship-to suffixes must not contaminate company identity');

const projected = projectDeterministicContactFields({
  company_name: 'Target Company',
  country: 'Kenya',
  identity_resolution: { official_domain: 'target.example', confidence: 'high', candidates: [] },
  results: [
    { provider: 'serper', status: 'success', url: 'https://target.example/about', title: 'Target Company', snippet: 'Target Company official website Kenya', metadata: {} },
    { provider: 'hunter', snippet: 'directory.person@volza.com', metadata: { domain: 'volza.com' }, url: 'https://volza.com' },
    { provider: 'direct-http', status: 'success', url: 'https://target.example/contact', html: '<script type="application/ld+json">{"@type":"Organization","address":{"@type":"PostalAddress","streetAddress":"1 Target Road","addressLocality":"Nairobi","addressCountry":"Kenya"},"employee":{"@type":"Person","name":"John Target","jobTitle":"Chief Executive Officer"}}</script><a href="mailto:info@target.example">Mail</a><a href="mailto:email@example.com">Template</a><a href="tel:+254 700 123456">Call</a><div class="elementor-team-name">Jane Target</div><div class="elementor-team-job">Managing Director</div>', text: 'Founded 2022-01-13 HS 3004900002 registration 166100033', links: [] },
    { provider: 'serper', status: 'success', url: 'https://linkedin.com/in/jane-target-123', title: 'Jane Target - Managing Director | LinkedIn', snippet: 'Jane Target at Target Company', metadata: {} },
  ] as any,
});
assert.deepEqual(projected.emails_list, ['info@target.example']);
assert.deepEqual(projected.phones_list, ['+254 700 123456']);
assert.deepEqual(projected.addresses, ['1 Target Road, Nairobi, Kenya']);
assert.deepEqual(projected.contact_persons, [
  { name: 'John Target', designation: 'Chief Executive Officer', source_url: 'https://target.example/contact' },
  { name: 'Jane Target', designation: 'Managing Director', source_url: 'https://target.example/contact', linkedin: 'https://linkedin.com/in/jane-target-123' },
]);

const publicProfileCorroboration = projectDeterministicContactFields({
  company_name: 'Emerchemie NB Ceylon Limited',
  country: 'Sri Lanka',
  identity_resolution: { official_domain: 'emerchemie.lk', confidence: 'high', candidates: [] },
  results: [
    { provider: 'serper', status: 'success', url: 'https://emerchemie.lk/contact-us.php', title: 'Emerchemie NB Ceylon Limited Contact', snippet: '', metadata: {} },
    { provider: 'apify', status: 'success', url: 'https://facebook.com/emerchemieNB/', title: 'Emerchemie NB Ceylon Limited', text: 'Emerchemie NB Ceylon Limited\nSri Lanka office\n60, Maligawatte Road, Colombo 10\ninteract@emerchemie.lk', links: [] },
  ] as any,
});
assert.deepEqual(publicProfileCorroboration.emails_list, ['interact@emerchemie.lk'], 'an exact company public profile may corroborate an email on the already-resolved official domain');
assert.deepEqual(publicProfileCorroboration.addresses, ['60, Maligawatte Road, Colombo 10'], 'a labeled street address on an exact company public profile remains attributable evidence');

const linkedInManagement = projectDeterministicContactFields({
  company_name: 'Emerchemie NB Ceylon Limited',
  country: 'Sri Lanka',
  identity_resolution: { official_domain: 'emerchemie.lk', confidence: 'high', candidates: [] },
  results: [
    { provider: 'serper', status: 'success', url: 'https://emerchemie.lk/about', title: 'Emerchemie NB Ceylon Limited', snippet: 'Sri Lanka', metadata: {} },
    { provider: 'linkup', status: 'success', url: 'https://linkedin.com/in/jonathan-benjamin-9804b9302', title: '', snippet: '# Jonathan Benjamin\nSri Lanka\n### Modern Trade Manager at Emerchemie NB (Ceylon) Limited', metadata: {} },
    { provider: 'linkup', status: 'success', url: 'https://linkedin.com/in/ordinary-person-123456', title: '', snippet: '# Ordinary Person\n### Sales Representative at Emerchemie NB (Ceylon) Limited', metadata: {} },
    { provider: 'serper', status: 'success', url: 'https://linkedin.com/in/unrelated-manager-123456', title: 'Unrelated Manager', snippet: 'General Manager at Another Company', metadata: {} },
  ] as any,
});
assert.deepEqual(linkedInManagement.contact_persons, [
  { name: 'Jonathan Benjamin', designation: 'Modern Trade Manager', source_url: 'https://linkedin.com/in/jonathan-benjamin-9804b9302', linkedin: 'https://linkedin.com/in/jonathan-benjamin-9804b9302' },
], 'company-attributed LinkedIn managers are recovered while ordinary and unrelated people remain excluded');

const unresolvedProjection = projectDeterministicContactFields({
  company_name: 'Target Company',
  identity_resolution: { official_domain: '', confidence: 'none', candidates: [] },
  results: [{ provider: 'serper', status: 'success', url: 'https://linkedin.com/in/wrong-person', title: 'Wrong Person - Director', snippet: 'Possible match', metadata: {} }] as any,
  evidence_workspace: { chunks: [], rejected_claims: [], accepted_claims: [{ field: 'leader', value: 'Wrong Person', role: 'Director', source_result_id: 'x', source_url: 'https://linkedin.com/in/wrong-person', source_type: 'linkedin', quote: 'Wrong Person' }] },
});
assert.deepEqual(unresolvedProjection.contact_persons, [], 'LinkedIn-only people remain evidence and are not projected without resolved company identity');

const ordinaryEmployee = projectDeterministicContactFields({
  company_name: 'Target Company',
  identity_resolution: { official_domain: 'target.example', confidence: 'high', candidates: [] },
  results: [] as any,
  evidence_workspace: { chunks: [], rejected_claims: [], accepted_claims: [{ field: 'leader', value: 'Ordinary Employee', role: 'Employee', source_result_id: 'x', source_url: 'https://linkedin.com/company/target', source_type: 'linkedin', quote: 'Ordinary Employee' }] },
});
assert.deepEqual(ordinaryEmployee.contact_persons, [], 'ordinary or title-less LinkedIn people must not be promoted as leadership');

const junkLeadership = projectDeterministicContactFields({
  company_name: 'Quest Pharmaceuticals Limited',
  identity_resolution: { official_domain: 'quest.example', confidence: 'high', candidates: [] },
  results: [] as any,
  evidence_workspace: { chunks: [], rejected_claims: [], accepted_claims: [
    { field: 'leader', value: 'Quest Pharmaceuticals Limited', role: '', source_result_id: 'a', source_url: 'https://quest.example', source_type: 'official', quote: 'Quest Pharmaceuticals Limited' },
    { field: 'leader', value: 'General Manager (International Marketing & Sales)', role: 'General Manager', source_result_id: 'b', source_url: 'https://linkedin.com/posts/company-update', source_type: 'linkedin', quote: 'General Manager' },
    { field: 'leader', value: 'CEO Jamal Bare', role: 'CEO', source_result_id: 'c', source_url: 'https://quest.example/team', source_type: 'official', quote: 'CEO Jamal Bare' },
  ] },
});
assert.deepEqual(junkLeadership.contact_persons, [
  { name: 'Jamal Bare', designation: 'CEO', source_url: 'https://quest.example/team' },
], 'organization names and role headings are rejected while role-prefixed real names are normalized');

console.log('PASS EdgeView V1 identity-quality regressions');
