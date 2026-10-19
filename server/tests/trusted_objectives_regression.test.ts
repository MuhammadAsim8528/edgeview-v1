import assert from 'node:assert/strict';
import { ResearchDirector, isResearchCoverageComplete } from '../research_director';

const candidateOnly: any = {
  id: 'candidate',
  name: 'Target Company',
  status: 'processing',
  stage: 'Researching',
  resourceUsage: {},
  hasEmail: true,
  hasPhone: true,
  currentWebsite: 'https://unverified.example',
  evidenceCorpus: [],
};
const candidateObjectives = ResearchDirector.evaluateObjectives(candidateOnly, { country: 'Kenya' });
assert.equal(candidateObjectives.IDENTITY.status, 'PARTIAL');
assert.equal(candidateObjectives.IDENTITY.proof_status, 'UNPROVEN');
assert.equal(candidateObjectives.EMAIL.status, 'UNKNOWN');
assert.equal(candidateObjectives.PHONE.status, 'UNKNOWN');
assert.equal(candidateObjectives.OFFICIAL_WEBSITE.status, 'PARTIAL');
assert.equal(isResearchCoverageComplete(candidateObjectives), false);

const admitted: any = {
  ...candidateOnly,
  extractedDetails: {
    email: 'contact@target.example',
    emails_list: ['contact@target.example'],
    phone: '+254700000000',
    phones_list: ['+254700000000'],
    address: 'Nairobi, Kenya',
    contact_persons: [{ name: 'A Person', designation: 'Director' }],
    website: 'https://target.example',
  },
  entityProof: { result: 'OFFICIAL_WEB_IDENTITY_SUPPORTED' },
  evidenceCorpus: [
    { url: 'https://target.example/contact', content: 'Target Company Kenya' },
    { url: 'https://registry.example/target', content: 'Target Company Kenya' },
  ],
};
const admittedObjectives = ResearchDirector.evaluateObjectives(admitted, { country: 'Kenya' });
assert.equal(admittedObjectives.IDENTITY.status, 'SATISFIED');
assert.equal(admittedObjectives.EMAIL.status, 'SATISFIED');
assert.equal(admittedObjectives.PHONE.status, 'SATISFIED');
assert.equal(admittedObjectives.OFFICIAL_WEBSITE.status, 'SATISFIED');
assert.equal(isResearchCoverageComplete(admittedObjectives), true);

console.log('trusted_objectives_regression: 11 assertions passed');
