import assert from 'node:assert/strict';
import { resolveOfficialDomain } from '../v1_identity';

const foreign = resolveOfficialDomain('Getz Pharma', 'Kenya', [
  { url: 'https://getzpharma.pk/contact', title: 'Getz Pharma', snippet: 'Contact our Pakistan office', provider: 'serper', rank: 1 },
]);
assert.equal(foreign.official_domain, '', 'a matching brand on a foreign country domain needs target-country evidence');

const local = resolveOfficialDomain('Getz Pharma', 'Kenya', [
  { url: 'https://getzpharma.co.ke/contact', title: 'Getz Pharma Kenya', snippet: 'Kenya contact office', provider: 'serper', rank: 1 },
]);
assert.equal(local.official_domain, 'getzpharma.co.ke');

const parentLocalPage = resolveOfficialDomain('Getz Pharma', 'Kenya', [
  { url: 'https://getzpharma.pk/kenya', title: 'Getz Pharma Kenya', snippet: 'Our Kenya office', provider: 'serper', rank: 1 },
]);
assert.equal(parentLocalPage.official_domain, 'getzpharma.pk', 'a foreign parent domain can carry explicit local-entity evidence');

const global = resolveOfficialDomain('ACME BIOLOGICS LIMITED', 'Kenya', [
  { url: 'https://acmebiologics.com/about', title: 'ACME Biologics Limited', snippet: 'About our company', provider: 'serper', rank: 1 },
]);
assert.equal(global.official_domain, 'acmebiologics.com', 'neutral global-domain discovery remains available; it is not local contact proof');
console.log('v1_country_domain_boundary.test.ts: PASS');
