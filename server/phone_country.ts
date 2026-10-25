import { normalizeCountryName } from '../src/utils/countryNormalizer';

const CALLING_CODES: Record<string, string[]> = {
  angola:['244'], china:['86'], honduras:['504'], kenya:['254'], kyrgyzstan:['996'],
  mauritius:['230'], netherlands:['31'], nigeria:['234'], pakistan:['92'], philippines:['63'],
  reunion:['262'], somalia:['252'], 'sri lanka':['94'], tanzania:['255'], thailand:['66'],
  uzbekistan:['998'],
};

/** Positive number-country evidence; unlike compatibility, unknown mappings
 * and unprefixed local numbers do not establish a country. */
export function hasExplicitCountryCallingCode(phone: string, country: string): boolean {
  const raw = String(phone || '').trim();
  if (!raw.startsWith('+')) return false;
  const expected = CALLING_CODES[normalizeCountryName(country || '').toLowerCase()];
  return Boolean(expected?.some(code => raw.replace(/\D/g, '').startsWith(code)));
}

/** Rejects masked and explicitly foreign international numbers. Local numbers
 * remain eligible because public sources frequently omit the country prefix. */
export function isCountryCompatiblePhone(phone: unknown, country: string): boolean {
  const raw = String(phone || '').trim();
  if (!raw || /[x*•]/i.test(raw)) return false;
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 6 || digits.length > 15) return false;
  if (!raw.startsWith('+')) return true;
  const canonical = normalizeCountryName(country || '').toLowerCase();
  const expected = CALLING_CODES[canonical];
  return !expected?.length || expected.some((code) => digits.startsWith(code));
}
