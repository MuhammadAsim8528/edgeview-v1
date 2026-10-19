import assert from 'node:assert/strict';
import { assertPublicResearchQuery, isOpaqueInternalIdentifier } from '../public_research_identity';
import { normalizePublicResearchQuery } from '../research_runtime';

assert.equal(isOpaqueInternalIdentifier('comp-123abc'), true);
assert.throws(
  () => assertPublicResearchQuery('comp-123abc Somalia company', { companyName: 'Hamar Trading Company' }),
  /INTERNAL_ID_QUERY_BLOCKED/
);
assert.throws(
  () => assertPublicResearchQuery('official website', { companyName: 'comp-123abc' }),
  /UNRESOLVED_PUBLIC_ENTITY/
);
const query = normalizePublicResearchQuery(
  'Hamar Trading Company official website',
  'official_website',
  'Hamar Trading Company',
  'Somalia'
);
assert.match(query, /Hamar Trading Company/i);
assert.match(query, /Somalia/i);
assert.doesNotMatch(query, /comp-/i);

console.log('public_research_identity_guard.test.ts: PASS');
