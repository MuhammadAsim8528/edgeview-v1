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
const collision = { url: 'https://slim.lk/', title: 'Sri Lanka Institute of Marketing | SLIM', snippet: 'Sri Lanka marketing awards with Slim Pharmaceuticals', rank: 1 };
const pharma = { url: 'https://slimpharma.com/', title: 'Slim Pharmaceuticals (Pvt) Ltd', snippet: 'Sri Lanka', rank: 2 };
assert.equal(resolveOfficialDomain('Slim Pharmaceuticals Pvt Ltd', 'Sri Lanka', [collision]).official_domain, '');
assert.equal(resolveOfficialDomain('Slim Pharmaceuticals Pvt Ltd', 'Sri Lanka', [collision, pharma]).official_domain, 'slimpharma.com');
assert.equal(resolveOfficialDomain('Slim Pharmaceuticals Pvt Ltd', 'Sri Lanka', [
  { ...collision, title: 'Slim Pharmaceuticals | Contact' },
]).official_domain, 'slim.lk');
assert.equal(resolveOfficialDomain('Slim Pharmaceuticals Pvt Ltd', 'Sri Lanka', [
  { ...collision, title: 'SLIM | Sri Lanka Institute of Marketing' },
]).official_domain, '', 'a bare acronym homepage title is insufficient even on a local domain');
const regional = { url: 'https://globalpharmaceuticalspk.com/', title: 'Global Pharmaceutical', snippet: 'Pharmaceutical manufacturer in Pakistan', rank: 1 };
assert.equal(resolveOfficialDomain('Global Pharmaceuticals (Pvt) Limited', 'Pakistan', [regional]).official_domain, 'globalpharmaceuticalspk.com');
assert.equal(resolveOfficialDomain('Global Pharmaceuticals (Pvt) Limited', 'Kenya', [regional]).official_domain, '');
assert.equal(resolveOfficialDomain('Global Pharmaceuticals (Pvt) Limited', 'Pakistan', [
  { ...regional, title: 'Global Trading', snippet: 'Distributor of Global Pharmaceuticals in Pakistan' },
]).official_domain, '');

// H11: country names must be complete, affirmed entities rather than substrings.
const acmeIdentity = (url: string, snippet: string) => ({
  url, title: 'ACME Biologics Limited', snippet, provider: 'serper', rank: 1,
});
assert.equal(resolveOfficialDomain('ACME BIOLOGICS LIMITED', 'Niger', [
  acmeIdentity('https://acmebiologics.com.ng/', 'Nigeria office'),
]).official_domain, '', 'Nigeria is not Niger');
assert.equal(resolveOfficialDomain('ACME BIOLOGICS LIMITED', 'Niger', [
  acmeIdentity('https://acmebiologics.ne/', 'Niger office'),
]).official_domain, 'acmebiologics.ne');
assert.equal(resolveOfficialDomain('ACME BIOLOGICS LIMITED', 'Sudan', [
  acmeIdentity('https://acmebiologics.ss/', 'South Sudan office'),
]).official_domain, '', 'South Sudan is not Sudan');
assert.equal(resolveOfficialDomain('ACME BIOLOGICS LIMITED', 'Sudan', [
  acmeIdentity('https://acmebiologics.sd/', 'Sudan office'),
]).official_domain, 'acmebiologics.sd');
assert.equal(resolveOfficialDomain('ACME BIOLOGICS LIMITED', 'Kenya', [
  acmeIdentity('https://acmebiologics.co.ke/', 'This is not the Kenya office'),
]).official_domain, '', 'a local suffix cannot override an explicit country denial');
assert.equal(resolveOfficialDomain('ACME BIOLOGICS LIMITED', 'Kenya', [
  acmeIdentity('https://acmebiologics.com/', 'Not located in Kenya'),
]).official_domain, '', 'negated text is not target-country evidence on a neutral domain');
assert.equal(resolveOfficialDomain('ACME BIOLOGICS LIMITED', 'Kenya', [
  acmeIdentity('https://acmebiologics.co.ke/', 'Kenya office'),
]).official_domain, 'acmebiologics.co.ke', 'affirmed local evidence remains valid');

// H12: previously unlisted ccTLDs are country-coded, not neutral global domains.
assert.equal(resolveOfficialDomain('ACME BIOLOGICS LIMITED', 'Germany', [
  acmeIdentity('https://acmebiologics.at/', 'Austria office'),
]).official_domain, '', 'Austria ccTLD cannot borrow German identity');
assert.equal(resolveOfficialDomain('ACME BIOLOGICS LIMITED', 'Austria', [
  acmeIdentity('https://acmebiologics.at/', 'Austria office'),
]).official_domain, 'acmebiologics.at');
console.log('v1_country_domain_boundary.test.ts: PASS');
