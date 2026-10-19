import assert from 'node:assert/strict';
import { normalizeV1ContactOverlay } from '../../shared/v1_contact_contract';

const legacy = normalizeV1ContactOverlay({
  schema_version: 16,
  emails_list: ['Info@Example.com', 'info@example.com'],
  phone: '+254 20 1234567',
  website: 'https://example.com',
  social_links: [
    'https://www.linkedin.com/company/example-co/',
    'https://facebook.com/exampleco',
  ],
  addresses: ['123 Example Road, Nairobi'],
  address: '123 Example Road, Nairobi',
  contact_persons: [{
    name: 'Jane Example',
    designation: 'Managing Director',
    linkedin: 'https://www.linkedin.com/in/jane-example/',
    source_url: 'https://example.com/team',
  }],
  quality_status: 'PARTIAL',
  evidence: [{ field: 'address', value: '123 Example Road, Nairobi' }],
});

assert.deepEqual(legacy.emails_list, ['Info@Example.com']);
assert.deepEqual(legacy.addresses, [{ address: '123 Example Road, Nairobi' }]);
assert.equal(legacy.address, '123 Example Road, Nairobi');
assert.deepEqual(legacy.linkedin_urls, ['https://www.linkedin.com/company/example-co/']);
assert.equal(legacy.socials[0].platform, 'LinkedIn');
assert.equal(legacy.socials[1].platform, 'Facebook');
assert.equal(legacy.contact_persons[0].linkedin_url, 'https://www.linkedin.com/in/jane-example/');
assert.equal((legacy.contact_persons[0] as any).linkedin, undefined);
assert.equal((legacy as any).social_links, undefined);

const roundTrip = normalizeV1ContactOverlay(legacy);
assert.deepEqual(roundTrip, legacy, 'canonical V1 overlays must normalize idempotently');

const canonical = normalizeV1ContactOverlay({
  schema_version: 17,
  addresses: [{ address: 'PO Box 99', type: 'postal', source_url: 'https://example.com/contact' }],
  socials: [{ platform: 'LinkedIn', url: 'https://linkedin.com/company/example' }],
  linkedin_urls: ['https://linkedin.com/company/example'],
  contact_persons: [{ name: 'Ali Example', linkedin_url: 'https://linkedin.com/in/ali-example' }],
  quality_status: 'COMPLETE',
});
assert.equal(canonical.addresses[0].type, 'postal');
assert.equal(canonical.addresses[0].source_url, 'https://example.com/contact');
assert.equal(canonical.contact_persons[0].linkedin_url, 'https://linkedin.com/in/ali-example');

console.log('PASS canonical V1 contact contract and legacy overlay adaptation');
