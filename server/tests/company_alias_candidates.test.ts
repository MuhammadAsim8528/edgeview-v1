import assert from 'node:assert/strict';
import { classifyCompanyAliasCandidate, canonicalEntityIdentityKey, type CompanyAliasIdentity } from '../company_identity';

const row = (company_name: string, country = 'Kenya', extra: Partial<CompanyAliasIdentity> = {}): CompanyAliasIdentity =>
  ({ company_name, country, ...extra });
const support = { website: 'https://global.example.test', phone: '+254 00 000 0001' };
const cases: Array<[string, CompanyAliasIdentity, CompanyAliasIdentity, string]> = [
  ['suffix alone', row('Global Pharma'), row('Global Pharma Ltd'), 'AMBIGUOUS'],
  ['case/punctuation', row('GLOBAL PHARMA LTD.'), row('Global Pharma Ltd'), 'EXACT_SAFE'],
  ['private/legal variants', row('Global Pharma Pvt Ltd', 'Kenya', support), row('Global Pharma Private Limited', 'Kenya', support), 'PROBABLE_ALIAS'],
  ['foreign same name', row('Global Pharma', 'Kenya', support), row('Global Pharma', 'Pakistan', support), 'DISTINCT'],
  ['Sudan/South Sudan', row('Global Pharma', 'Sudan', support), row('Global Pharma', 'South Sudan', support), 'DISTINCT'],
  ['distinct business names', row('Northstar Pharma'), row('Eastbridge Pharma'), 'DISTINCT'],
  ['same domain alone', row('Global Pharma', 'Kenya', { website: support.website }), row('Global Pharma Ltd', 'Kenya', { website: support.website }), 'AMBIGUOUS'],
  ['same domain plus phone', row('Global Pharma', 'Kenya', support), row('Global Pharma Ltd', 'Kenya', support), 'PROBABLE_ALIAS'],
  ['supported typo', row('Glboal Pharma', 'Kenya', support), row('Global Pharma', 'Kenya', support), 'PROBABLE_ALIAS'],
  ['unsupported typo', row('Glboal Pharma'), row('Global Pharma'), 'AMBIGUOUS'],
  ['generic tokens only', row('Pharma Medical Healthcare Trading International', 'Kenya', support), row('Pharma Medical Healthcare Trading International Ltd', 'Kenya', support), 'AMBIGUOUS'],
  ['missing country', row('Global Pharma', ''), row('Global Pharma Ltd', '', support), 'AMBIGUOUS'],
  ['unresolved country', row('Global Pharma', 'Unresolved territory'), row('Global Pharma', 'Unresolved territory'), 'AMBIGUOUS'],
  ['mixed country label', row('Global Pharma', 'Sudan South Sudan'), row('Global Pharma', 'Sudan South Sudan'), 'AMBIGUOUS'],
  ['exact country code alias', row('Global Pharma', 'KE'), row('Global Pharma', 'Kenya'), 'EXACT_SAFE'],
  ['conflicting registration', row('Global Pharma', 'Kenya', { registrations: [{ namespace: 'ke-company-registry', value: 'A123' }] }), row('Global Pharma', 'Kenya', { registrations: [{ namespace: 'ke-company-registry', value: 'B456' }] }), 'DISTINCT'],
  ['matching registration', row('Global Pharma', 'Kenya', { registrations: [{ namespace: 'ke-company-registry', value: 'A123' }] }), row('Global Pharma Ltd', 'Kenya', { registrations: [{ namespace: 'ke-company-registry', value: 'A123' }] }), 'PROBABLE_ALIAS'],
  ['different registry namespace', row('Global Pharma', 'Kenya', { registrations: [{ namespace: 'tax', value: '123' }] }), row('Global Pharma Ltd', 'Kenya', { registrations: [{ namespace: 'company-register', value: '123' }] }), 'AMBIGUOUS'],
  ['Unicode formatting', row('醫藥 有限公司'), row('醫藥　有限公司'), 'EXACT_SAFE'],
  ['oversized name', row('G'.repeat(201)), row('Global Pharma', 'Kenya', support), 'AMBIGUOUS'],
  ['normalization expansion bound', row('\uFDFA'.repeat(20)), row('Global Pharma', 'Kenya', support), 'AMBIGUOUS'],
  ['conflicting exact-name profiles', row('Global Pharma', 'Kenya', support), row('GLOBAL PHARMA', 'Kenya', { website: 'https://another.example.test', phone: support.phone }), 'AMBIGUOUS'],
  ['dangerous URL scheme', row('Global Pharma', 'Kenya', { website: 'javascript:alert(1)', phone: support.phone }), row('Global Pharma Ltd', 'Kenya', { website: 'javascript:alert(1)', phone: support.phone }), 'AMBIGUOUS'],
  ['credential-bearing URL', row('Global Pharma', 'Kenya', { website: 'https://user:secret@global.example.test', phone: support.phone }), row('Global Pharma Ltd', 'Kenya', { website: 'https://user:secret@global.example.test', phone: support.phone }), 'AMBIGUOUS'],
];
for (const [name, left, right, expected] of cases) {
  const before = JSON.stringify([left, right]);
  const result = classifyCompanyAliasCandidate(left, right);
  assert.equal(result.tier, expected, name);
  assert.equal(result.autoMerge, false, 'classification must never mutate identity or authorize an alias');
  assert.equal(JSON.stringify([left, right]), before, 'raw names and supporting inputs must remain unchanged');
}
for (const relationship of ['PARENT_SUBSIDIARY', 'DISTRIBUTOR', 'DISTINCT_LEGAL_ENTITIES'] as const) {
  assert.equal(classifyCompanyAliasCandidate(row('Global Pharma', 'Kenya', support), row('Global Pharma Ltd', 'Kenya', support), relationship).tier, 'DISTINCT');
}
assert.notEqual(canonicalEntityIdentityKey('Global Pharma', 'Kenya'), canonicalEntityIdentityKey('Global Pharma Ltd', 'Kenya'), 'candidate suffix rules must not alter canonical/cache keys');
assert.notEqual(canonicalEntityIdentityKey('Global Pharma', 'Sudan'), canonicalEntityIdentityKey('Global Pharma', 'South Sudan'));
console.log('PASS conservative alias candidate tiers, country/relationship/registry isolation, supported-only typo matching, raw preservation and unchanged canonical keys; admission/persistence NOT VERIFIED');
