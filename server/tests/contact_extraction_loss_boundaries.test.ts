import assert from 'assert';
import { normalizeModelResearchQuery, retainHighValueEvidence, type ResearchEvidenceItem } from '../research_runtime';
import { extractEmailsFromEvidenceText, findExactEmailSourceUrl, isSameCompanyHost, rankAttributedEmails, selectHighValueInternalLinks, shouldAdmitRegexEmailSource } from '../research_director';
import { mergeContacts } from '../contact_report_model';
import { getInternationalImporterDirectory } from '../international_importer_directory';
import { isEmailAttributedToCompany, shouldRetainAddressForCountryMerge } from '../enrichment';

console.log('--- RUNNING CONTACT EXTRACTION LOSS-BOUNDARY TESTS ---');

const evidence: ResearchEvidenceItem[] = [
  { url: 'https://example.com/leadership', title: 'Leadership', content: 'Chief Executive Officer and Managing Director' },
  { url: 'https://example.com/contact', title: 'Contact', content: 'Phone fax email contact information' },
  ...Array.from({ length: 31 }, (_, i) => ({
    url: `https://directory.invalid/noise-${i}`,
    title: `Search result ${i}`,
    content: 'Low-value third-party directory snippet',
  })),
];
const retained = retainHighValueEvidence(evidence, 30, 'https://example.com', 'Kenya');
assert.strictEqual(retained.length, 30);
assert.ok(retained.some((item) => item.url.endsWith('/leadership')), 'earlier official leadership evidence must survive');
assert.ok(retained.some((item) => item.url.endsWith('/contact')), 'earlier official contact evidence must survive');
console.log('✅ Quality-aware evidence retention preserves authoritative early pages');

const links = [
  { url: 'https://example.com/kenya', score: 11, label: 'Kenya Branch Page' },
  { url: 'https://example.com/contact', score: 10, label: 'Contact Page' },
  { url: 'https://example.com/management', score: 9, label: 'Leadership Page' },
  { url: 'https://example.com/about', score: 8, label: 'About Page' },
];
const selected = selectHighValueInternalLinks(links, 3);
assert.deepStrictEqual(selected.map((item) => item.label), ['Kenya Branch Page', 'Contact Page', 'Leadership Page']);
console.log('✅ Internal-link budget includes branch, contact, and leadership pages');

const emails = [
  'person1@example.com', 'person2@example.com', 'person3@example.com',
  'sales@example.com', 'procurement@example.com', 'export@example.com',
  'import@example.com', 'info@example.com', 'support@example.com',
];
const ranked = rankAttributedEmails(emails, 8);
assert.strictEqual(isSameCompanyHost('surgilinksltd.com', 'www.surgilinksltd.com'), true, 'www and apex are the same company host');
assert.strictEqual(isSameCompanyHost('directory.example', 'www.surgilinksltd.com'), false, 'third-party host remains rejected');
assert.strictEqual(shouldAdmitRegexEmailSource('datanyze.com', 'hyperpharm.mu'), false, 'same-domain-looking values from third-party pattern pages are rejected');
assert.strictEqual(shouldAdmitRegexEmailSource('www.hyperpharm.mu', 'hyperpharm.mu'), true, 'official-site regex email remains admissible');
assert.strictEqual(findExactEmailSourceUrl(
  [{ url: 'https://example.com/kenya', content: 'Email ICS_orders@dpworld.com' }],
  '_orders@dpworld.com'
), '', 'an email substring is not exact source grounding');
assert.strictEqual(findExactEmailSourceUrl(
  [{ url: 'https://example.com/kenya', content: 'Email ICS_orders@dpworld.com' }],
  'ics_orders@dpworld.com'
), 'https://example.com/kenya', 'the exact public email retains source grounding');
assert.deepStrictEqual(
  Array.from(new Set(extractEmailsFromEvidenceText('[ICS\\_orders@dpworld.com](mailto:ICS_orders@dpworld.com)'))),
  ['ICS_orders@dpworld.com'],
  'markdown escaping cannot create a false email suffix'
);
assert.strictEqual(ranked.length, 8);
for (const required of ['sales@example.com', 'procurement@example.com', 'export@example.com', 'import@example.com']) {
  assert.ok(ranked.includes(required), `${required} must survive the bounded fallback`);
}
console.log('✅ Bounded email fallback prioritizes operational company mailboxes');

const mergedContacts = mergeContacts([
  { company_name: 'SLIM PHARMACEUTICALS PVT LTD', type: 'Importer', country: 'Sri Lanka', email: 'info@slimpharma.com' } as any,
  { company_name: 'SLIM PHARMACEUTICALS (PVT) LTD', type: 'Importer', country: 'Sri Lanka' } as any,
]);
assert.strictEqual(mergedContacts.length, 1, 'punctuation variants of the same legal suffix must merge');
assert.strictEqual(mergedContacts[0].email, 'info@slimpharma.com');
console.log('✅ Directory merge collapses PVT LTD / (PVT) LTD identity variants');

const directory = await getInternationalImporterDirectory([
  {
    company_name: 'Leadership Preservation Pharma', type: 'Importer', country: 'Sri Lanka',
    contact_persons: Array.from({ length: 11 }, (_, i) => ({ name: `Leader ${i + 1}`, designation: 'Director' })),
  } as any,
], { importedFrom: new Map(), suppliedTo: new Map() });
const leadership = directory.countrySections[0].importers[0].leadership;
assert.ok(leadership.includes('Leader 11'), 'all 11 canonical leaders must reach the directory');
assert.ok(!leadership.includes(' more'), 'directory must not collapse a normal leadership team');
console.log('✅ Directory projection preserves all 11 canonical leaders');

const deduplicatedDirectory = await getInternationalImporterDirectory([
  {
    company_name: 'Honorific Merge Pharma', type: 'Importer', country: 'Sri Lanka',
    contact_persons: [
      { name: 'Mr. P N Mendis', designation: 'Associate Director - Business Development' },
      { name: 'M. Prathaban', designation: 'Deputy Chairman / Group CEO / Deputy Chairman / Group CEO' },
    ],
    decision_makers: [
      { name: 'P N Mendis', designation: 'Associate Director - Business Development' },
    ],
  } as any,
], { importedFrom: new Map(), suppliedTo: new Map() });
const deduplicatedLeadership = deduplicatedDirectory.countrySections[0].importers[0].leadership;
assert.strictEqual(deduplicatedLeadership.split('\n').length, 2, 'honorific variants must not duplicate directory people');
assert.strictEqual((deduplicatedLeadership.match(/P N Mendis/gi) || []).length, 1);
assert.ok(!deduplicatedLeadership.includes('Deputy Chairman / Group Ceo / Deputy Chairman'), 'repeated designation segments must collapse');
console.log('✅ Directory projection deduplicates honorific variants and repeated roles');

assert.strictEqual(shouldRetainAddressForCountryMerge('Irvine, California 92612, US', 'Kenya', true), false);
assert.strictEqual(shouldRetainAddressForCountryMerge('P.O.Box 14461-00800 Nairobi, Kenya', 'Kenya', true), true);
assert.strictEqual(shouldRetainAddressForCountryMerge('Global corporate office', 'Kenya', true), true);
assert.strictEqual(shouldRetainAddressForCountryMerge('Irvine, California 92612, US', 'Kenya', false), true, 'failed fresh research must not erase prior data');
console.log('✅ Country-scoped merge rejects explicit foreign addresses only after fresh target-country evidence');

assert.strictEqual(
  normalizeModelResearchQuery('Emerchemie NB Ceylon Limited email', 'email', 'Sri Lanka', 'https://www.emerchemie.lk'),
  'Emerchemie NB Ceylon Limited email official website contact site:emerchemie.lk Sri Lanka'
);
assert.ok(normalizeModelResearchQuery('Acme team', 'leadership', 'Kenya').includes('leadership management directors Kenya'));
console.log('✅ Model-selected queries preserve country and contact/leadership intent');

const officialEvidence = [{ field: 'email', value: 'sales@surgilinks.com', source_url: 'https://surgilinksltd.com/contact', source_type: 'LLM_AI_EXTRACT', confidence: 0.9 }] as any;
const directoryEvidence = [{ field: 'email', value: 'info@africa2trust.com', source_url: 'https://africa2trust.com/surgilinks', source_type: 'LLM_AI_EXTRACT', confidence: 0.9 }] as any;
assert.strictEqual(isEmailAttributedToCompany('surgimail@surgilinksltd.com', 'https://surgilinksltd.com', []), true);
assert.strictEqual(isEmailAttributedToCompany('john@hyperpharm.mu', 'https://hyperpharm.mu', [{ field: 'email', value: 'john@hyperpharm.mu', source_url: 'https://datanyze.com/hyperpharm' }] as any), false, 'same-domain pattern guesses with only third-party provenance are rejected');
assert.strictEqual(isEmailAttributedToCompany('info@hyperpharm.mu', 'https://hyperpharm.mu', [{ field: 'email', value: 'info@hyperpharm.mu', source_url: 'https://www.hyperpharm.mu/contact-us' }] as any), true, 'same-domain email with official provenance is accepted');
assert.strictEqual(isEmailAttributedToCompany('sales@surgilinks.com', 'https://surgilinksltd.com', officialEvidence), true, 'official-site evidence may support a different domain');
assert.strictEqual(isEmailAttributedToCompany('info@africa2trust.com', 'https://surgilinksltd.com', directoryEvidence), false);
console.log('✅ Canonical email attribution rejects third-party directory mailboxes');
console.log('--- ALL CONTACT EXTRACTION LOSS-BOUNDARY TESTS PASSED ---');
