import assert from 'node:assert/strict';
import { detectCountryMentions } from '../research_director';

const lacks = (text: string, country: string) => assert(!detectCountryMentions(text).includes(country), `${text} must not imply ${country}`);
lacks('Somalia importer', 'mali');
lacks('Nigeria distributor', 'niger');
lacks('Romania office', 'oman');
lacks('Dominican Republic registry', 'dominica');
lacks('Papua New Guinea buyer', 'equatorial guinea');
lacks('South Sudan importer', 'sudan');
assert(detectCountryMentions('Operations in Somalia and the Somali market').includes('somalia'));
assert(detectCountryMentions('Registered in the Dominican Republic').includes('dominican republic'));
assert(detectCountryMentions('UAE branch in Dubai').includes('united arab emirates'));
console.log('country_alias_boundary_regression.test.ts: PASS');
