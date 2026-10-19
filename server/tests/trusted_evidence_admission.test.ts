import assert from 'node:assert/strict';
import { assessEvidenceForCountry } from '../research_director';

const target = 'Alpha Pharma';
const country = 'Kenya';
const official = 'https://alpha.example';

const unrelated = assessEvidenceForCountry(
  'Beta Pharma Kenya. Email beta@beta.example, phone +254 700 000000.',
  'https://beta.example/contact', target, country, official
);
assert.equal(unrelated.decision, 'REJECT', 'same-country evidence from another company must be rejected');

const foreignBranch = assessEvidenceForCountry(
  'Alpha Pharma Pakistan contact office. Email pk@alpha.example.',
  'https://alpha.example/pakistan/contact', target, country, official
);
assert.equal(foreignBranch.decision, 'REJECT', 'foreign branch-local facts must be rejected');

const officialPage = assessEvidenceForCountry(
  'Kenya customer support and contact information.',
  'https://alpha.example/ke/contact', target, country, official
);
assert.equal(officialPage.decision, 'ADMIT', 'official-domain target-country evidence must be admitted');

const registry = assessEvidenceForCountry(
  'Government registry record: Alpha Pharma, registered in Kenya.',
  'https://registry.go.ke/entity/alpha-pharma', target, country, official,
  { sourceType: 'authoritative_registry' }
);
assert.equal(registry.decision, 'ADMIT', 'explicit authoritative registry with exact entity match must be admitted');

const unsupportedRegistry = assessEvidenceForCountry(
  'Government registry record: Beta Pharma, registered in Kenya.',
  'https://registry.go.ke/entity/beta-pharma', target, country, official,
  { sourceType: 'authoritative_registry' }
);
assert.equal(unsupportedRegistry.decision, 'REJECT', 'registry authority cannot replace entity matching');

const distributor = assessEvidenceForCountry(
  'Alpha Pharma Kenya appoints DP World as its official distribution contact.',
  'https://alpha.example/ke/distributors', target, country, official,
  { sourceType: 'official_relationship', relationshipEstablished: true }
);
assert.equal(distributor.decision, 'ADMIT', 'officially supported cross-domain relationship must remain admissible');

console.log('trusted_evidence_admission.test.ts: PASS');
