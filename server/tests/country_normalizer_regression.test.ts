import assert from 'node:assert/strict';
import { normalizeCountryName, detectExplicitCountryNames } from '../../src/utils/countryNormalizer';

assert.equal(normalizeCountryName('not Kenya'), 'not Kenya', 'a negated country is not an affirmed country value');
assert.equal(normalizeCountryName('excluding Pakistan'), 'excluding Pakistan');
assert.equal(normalizeCountryName('non-Kenya'), 'non-Kenya');
assert.equal(normalizeCountryName('Country: Kenya'), 'Kenya');
assert.equal(normalizeCountryName('Not Specified'), 'Not Specified');
assert.equal(normalizeCountryName('Kenya, not Pakistan'), 'Kenya, not Pakistan');
assert.deepEqual(detectExplicitCountryNames('Office in Kenya'), ['Kenya']);
console.log('PASS affirmed/negated country normalization');
