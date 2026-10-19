import assert from 'node:assert/strict';
import { applyEnrichmentDetailsToContact, selectContactCacheRow } from '../contact_projection';

const rows = [
  { company_name: 'novartis__pakistan', details_json: JSON.stringify({ country: 'Pakistan' }) },
  { company_name: 'Novartis__netherlands', details_json: JSON.stringify({ country: 'Netherlands', quality_status: 'FAILED' }) },
  { company_name: 'novartis__netherlands', details_json: JSON.stringify({ country: 'Netherlands', quality_status: 'COMPLETE', emails_list: ['nl@novartis.test'] }) },
  { company_name: 'novartis', details_json: JSON.stringify({ country: 'Switzerland' }) },
  { company_name: 'NOVARTIS.', details_json: JSON.stringify({ emails_list: ['ambiguous@test.invalid'] }) },
];

assert.equal(
  selectContactCacheRow(rows, { company_name: 'Novartis.', country: 'Netherlands', type: 'Importer' })?.company_name,
  'novartis__netherlands',
  'formatting alias resolves to the same country-specific cache row'
);

assert.equal(
  selectContactCacheRow(rows, { company_name: 'Novartis', country: 'Netherlands', type: 'Importer' })?.company_name,
  'novartis__netherlands',
  'exact country branch selected'
);
assert.equal(
  selectContactCacheRow(rows, { company_name: 'Novartis', country: 'Kenya', type: 'Importer' }),
  null,
  'foreign branch and foreign plain cache are not fallbacks'
);

const contact: any = { company_name: 'Novartis', email: '', phone: '' };
applyEnrichmentDetailsToContact(contact, {
  emails_list: ['info@example.test', 'sales@example.test'],
  phones_list: ['+31 1', '+31 2'],
  addresses: [{ address: 'Amsterdam' }, { address: 'Rotterdam' }],
  contact_persons: Array.from({ length: 11 }, (_, index) => ({ name: `Leader ${index + 1}` })),
  linkedin_urls: ['https://linkedin.com/company/example'],
  evidence: [{ field: 'email', value: 'info@example.test', source_url: 'https://example.test/contact' }],
});
assert.equal(contact.emails_list.length, 2);
assert.equal(contact.phones_list.length, 2);
assert.equal(contact.addresses.length, 2);
assert.equal(contact.contact_persons.length, 11);
assert.equal(contact.linkedin_urls.length, 1);
assert.equal(contact.evidence.length, 1);

console.log('contact_projection_country_isolation.test.ts: PASS');
