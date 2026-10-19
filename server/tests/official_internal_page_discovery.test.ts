import assert from 'node:assert/strict';
import { extractHtmlLinkManifest, focusEvidenceForTargetCountry, htmlToEvidenceText, mergeScrapedAndDirectEvidence } from '../page_content';
import { discoverInternalLinks, selectHighValueInternalLinks } from '../research_director';
import { canonicalPersonNameKey, mergeExtractionResults } from '../evidence_packaging';

const html = `
  <html><body>
    <nav>
      <a href="/contact-us.php">Contact Us</a>
      <a href="leadership.php">Leadership</a>
      <a href="/about.php#history">About Us</a>
    </nav>
    <footer>
      <a href="?page_id=2">Contact Us</a>
      <a href="/locations/warehouse">Warehouse & Distribution</a>
      <a href="https://unrelated.example/contact">Other Directory</a>
    </footer>
  </body></html>`;

const evidenceText = htmlToEvidenceText(html);
assert.match(evidenceText, /\[Contact Us\]\(\/contact-us\.php\)/, 'direct HTML conversion must preserve hrefs');

const hugeHtml = `<a href="/contact-us.php">Contact Us</a>${'x'.repeat(100_000)}<footer><a href="leadership.php">Leadership</a></footer>`;
const hugeEvidence = htmlToEvidenceText(hugeHtml);
assert.match(hugeEvidence, /contact-us\.php/, 'early navigation survives oversized page reduction');
assert.match(hugeEvidence, /leadership\.php/, 'late footer navigation survives oversized page reduction');
assert.match(extractHtmlLinkManifest(hugeHtml), /leadership\.php/, 'raw link manifest includes footer links');

const complemented = mergeScrapedAndDirectEvidence('Contact form only', '<footer>Email: info@example.com <a href="?page_id=2">Contact Us</a></footer>');
assert.match(complemented, /info@example\.com/, 'direct body complements a scraper response that omitted footer contacts');
assert.match(complemented, /page_id=2/, 'direct body complement retains opaque contact route');

const worldwide = `# Worldwide\n### Egypt\nTel: +20 123\negypt@gsk.com\n### Kenya\nThird-party distribution partner\nkenya@gsk.com\n+254 700\n### Pakistan\npk@gsk.com\n+92 21`;
const kenyaOnly = focusEvidenceForTargetCountry(worldwide, 'Kenya', 'https://example.com/contact/worldwide');
assert.match(kenyaOnly, /kenya@gsk\.com/);
assert.match(kenyaOnly, /\+254 700/);
assert.doesNotMatch(kenyaOnly, /egypt@gsk\.com|pk@gsk\.com|\+92 21/, 'foreign sections must not enter a branch extraction prompt');
const flattenedWorldwide = `Egypt contact +20 123\n\negypt@gsk.com\n\nIn Kenya, we operate under a third-party distribution model.\n\nhttps://example.com/locations/kenya/\n\nPakistan contact +92 21\n\npk@gsk.com`;
const flattenedKenya = focusEvidenceForTargetCountry(flattenedWorldwide, 'Kenya', 'https://example.com/contact/worldwide');
assert.match(flattenedKenya, /In Kenya|locations\/kenya/);
assert.doesNotMatch(flattenedKenya, /egypt@gsk\.com|pk@gsk\.com|\+92 21/);

const links = discoverInternalLinks(evidenceText, 'https://example.com/company/index.php', 'Example Company', 'Kenya');
const urls = links.map((link) => link.url);
assert.ok(urls.includes('https://example.com/contact-us.php'), 'legacy absolute .php contact route discovered');
assert.ok(urls.includes('https://example.com/company/leadership.php'), 'relative leadership route resolved');
assert.ok(urls.includes('https://example.com/about.php'), 'URL fragments normalized away');
assert.ok(urls.includes('https://example.com/company/index.php?page_id=2'), 'footer label identifies opaque CMS contact route');
assert.ok(!urls.some((url) => url.includes('unrelated.example')), 'cross-domain footer link rejected');

const selected = selectHighValueInternalLinks(links, 4);
assert.ok(selected.some((link) => link.label === 'Contact Page'), 'contact category retained');
assert.ok(selected.some((link) => link.label === 'Leadership Page'), 'leadership category retained');
assert.ok(selected.some((link) => link.label === 'About Page'), 'about category retained');
assert.ok(selected.some((link) => link.label === 'Business Operations Page'), 'location/operations category retained');

const merged = mergeExtractionResults([
  { contact_persons: [{ name: 'Amina Example', designation: 'Country Manager', country: 'Kenya', linkedin_url: 'https://www.linkedin.com/in/amina-example', source_url: 'https://example.com/team' }] },
  { contact_persons: [{ name: 'Ms. Amina Example', department: 'Commercial', branch: 'Nairobi' }] },
]);
assert.equal(canonicalPersonNameKey('Ms. Amina Example'), canonicalPersonNameKey('Amina Example'));
assert.equal(merged.contact_persons.length, 1, 'honorific variants must merge into one canonical person');
assert.equal(merged.contact_persons[0].country, 'Kenya');
assert.equal(merged.contact_persons[0].branch, 'Nairobi');
assert.equal(merged.contact_persons[0].department, 'Commercial');
assert.equal(merged.contact_persons[0].linkedin_url, 'https://www.linkedin.com/in/amina-example');

console.log('official_internal_page_discovery.test.ts: PASS');
