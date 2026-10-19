import assert from 'node:assert/strict';
import { assessEvidenceForCountry, resolveVerifiedInitialWebsite } from '../research_director';

const kobacPage = `Kobac General Trading is a leading company in Somalia.
Contact Kobac GT at info@kobacgt.so or +252 619 520 999. Hassan Kobac, CEO.`;

assert.equal(resolveVerifiedInitialWebsite({ website: 'https://kobacgt.so' }), '');
assert.equal(
  resolveVerifiedInitialWebsite({ website: 'https://hamar.example', website_verified: true }),
  'https://hamar.example'
);

// A cached/UI URL is an unverified candidate. It must not be supplied as an
// official-domain fact and therefore cannot authenticate its own unrelated page.
const unverifiedCandidate = assessEvidenceForCountry(
  kobacPage,
  'https://kobacgt.so/contact-us',
  'HAMAR TRADING COMPANY',
  'Somalia',
  undefined,
  { sourceType: 'candidate_official' }
);
assert.equal(unverifiedCandidate.decision, 'HOLD');
assert.equal(unverifiedCandidate.isAssociated, false);

const realTarget = assessEvidenceForCountry(
  'Hamar Trading Company Somalia official contact and corporate information.',
  'https://hamar.example/contact',
  'HAMAR TRADING COMPANY',
  'Somalia'
);
assert.equal(realTarget.decision, 'ADMIT');

console.log('hamar_entity_substitution_guard.test.ts: PASS');
