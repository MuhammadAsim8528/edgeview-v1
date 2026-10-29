import assert from 'node:assert/strict';
import { crawlOfficialPages, officialPageFallbackUrls } from '../official_site_crawl';

const fetched: string[] = [];
const pages = await crawlOfficialPages('fixture.example', 4, [], ['https://fixture.example/management', 'https://fixture.example/contact'], async url => {
  fetched.push(url);
  if (url === 'https://fixture.example/') return { url, links: ['https://unrelated.example/contact', 'mailto:public@fixture.example'], html: '<a href="/cms.php?page=42">Corporate Management</a><a href="/reach-us">Contact us</a><a href="https://fixture.example.evil.example/team">Team</a>' };
  if (url.includes('page=42')) return { url, links: ['https://fixture.example/board/people'], html: 'Public board information' };
  return { url, links: [], html: 'Published contact evidence' };
});
assert.equal(fetched[0], 'https://fixture.example/');
assert.equal(fetched[1], 'https://fixture.example/cms.php?page=42', 'actual labelled CMS management route precedes guesses');
assert.ok(fetched.includes('https://fixture.example/board/people'), 'follow relevant links discovered after the homepage');
assert.ok(fetched.includes('https://fixture.example/reach-us'), 'use real contact route rather than assuming /contact');
assert.equal(fetched.length, 4, 'discovery cannot exceed request budget');
assert.equal(pages.length, 4, 'every attempted page retained');
assert.ok(fetched.every(url => new URL(url).hostname === 'fixture.example'), 'external and deceptive hosts never enter the queue');
const reused: string[] = [];
await crawlOfficialPages('fixture.example', 1, [{ url: 'https://fixture.example/', links: ['https://fixture.example/contact#one', 'https://fixture.example/contact#two'] }], [], async url => {
  reused.push(url); return { url, links: [] };
});
assert.deepEqual(reused, ['https://fixture.example/contact'], 'reuse captured homepage and deduplicate fragments');
const unavailableHome: string[] = [];
const observed = ['https://fixture.example/leadership.php'];
await crawlOfficialPages('fixture.example', 4, [], [...observed, ...officialPageFallbackUrls('fixture.example', observed)], async url => {
  unavailableHome.push(url);
  return { url, links: [], html: url.endsWith('/contact-us.php') ? '<p>Published local contacts</p>' : '' };
});
assert.ok(unavailableHome.includes('https://fixture.example/contact-us.php'), 'observed CMS extension and contact priority must survive a failed homepage within four-page budget');
assert.ok(!officialPageFallbackUrls('fixture.example', ['https://foreign.example/team.aspx']).some(url => url.endsWith('.aspx')), 'foreign CMS hints cannot drive official routes');
console.log('PASS bounded official-site link discovery, opaque CMS anchors, domain boundary and reuse');
