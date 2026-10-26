import assert from 'node:assert/strict';
import { contactFactScope } from '../contact_country_scope';

const local = 'https://www.linkedin.com/company/scopeanchor-kenya/';
const foreign = 'https://www.linkedin.com/company/scopeanchor-pakistan/';
const script = '<script type="application/ld+json">{"@type":"Organization","name":"Scopeanchor"}</script>';
const html = '<section><h2>Kenya office</h2><a href="' + local + '">LinkedIn</a></section>'
  + '<section><h2>Pakistan office</h2><a href="' + foreign + '">LinkedIn</a></section>' + script;
const source = { id: 'actual-anchor', url: 'https://scopeanchor.test/locations', html, links: [local, foreign] };
assert.equal(contactFactScope(source, local, 'Kenya', 'social').scope, 'local', 'labelled local office link must not disappear because another script exists');
assert.equal(contactFactScope(source, foreign, 'Kenya', 'social').scope, 'foreign', 'foreign office link must not borrow the local office');
assert.equal(contactFactScope({ ...source, html: script, text: 'Kenya office' }, local, 'Kenya', 'social').scope, 'unknown', 'links array is not scoped HTML evidence');
assert.equal(contactFactScope({ ...source, html: '<a href="' + local + '">LinkedIn</a>' + script }, local, 'Kenya', 'social').scope, 'unknown', 'unlabelled link cannot gain country from its domain/name');
assert.equal(contactFactScope({ ...source, html: '<!-- Kenya <a href="' + local + '">LinkedIn</a> -->' + script }, local, 'Kenya', 'social').scope, 'unknown', 'comment anchors are not visible evidence');
for (const tag of [
  '<a data-href="' + local + '">LinkedIn</a>',
  '<a title=\' href="' + local + '"\'>LinkedIn</a>',
  '<a title=\'x > href="' + local + '"\'>LinkedIn</a>',
  '<script>const link = \'<a href="' + local + '">LinkedIn</a>\'</script>',
]) assert.equal(contactFactScope({ ...source, html: '<h2>Kenya office</h2>' + tag + script }, local, 'Kenya', 'social').scope, 'unknown', 'non-href attributes and script templates cannot carry a visible office link');
const queryUrl = 'https://www.facebook.com/scopeanchor?ref=office&lang=en';
assert.equal(contactFactScope({ ...source, html: '<h2>Kenya office</h2><a href="https://www.facebook.com/scopeanchor?ref=office&amp;lang=en">Facebook</a>' + script }, queryUrl, 'Kenya', 'social').scope, 'local');
assert.equal(source.html, html, 'raw HTML must remain unchanged');
console.log('PASS actual labelled social anchors retain local/foreign office scope; uncarried, unknown and comment links abstain');
