import { normalizeCountryName, normalizeCountryExact, detectExplicitCountryNames } from '../src/utils/countryNormalizer';

/**
 * Conservative company identity key used for dataset grouping and cache lookup.
 * It removes formatting-only punctuation while preserving every word, legal
 * suffix, spelling, and country/role boundary. Thus "CO., LTD" and "CO LTD"
 * are one customs entity, while genuinely different names remain separate.
 */
export function canonicalCompanyIdentityKey(name: unknown): string {
  return String(name || '')
    .normalize('NFKC')
    .replace(/\u00a0/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Canonical country component shared by contacts, cache, trade, and reports. */
export function canonicalCountryIdentityKey(country: unknown): string {
  const raw = String(country || '').trim();
  if (!raw) return '';
  if (/^(?:unknown|not specified|n\/?a|null|nan)$/i.test(raw)) return '';
  return normalizeCountryName(raw).normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Minimum entity boundary when country comes from trusted source context. */
export function canonicalEntityIdentityKey(name: unknown, country?: unknown): string {
  const company = canonicalCompanyIdentityKey(name);
  if (!company) return '';
  const countryKey = canonicalCountryIdentityKey(country);
  return countryKey ? `${company}__${countryKey}` : company;
}

/** Country-aware contact-cache key, with optional legacy role discriminator. */
export function canonicalContactCacheKey(name: unknown, country?: unknown, role?: unknown): string {
  const entity = canonicalEntityIdentityKey(name, country);
  if (!entity) return '';
  const roleKey = String(role || '').trim().toLowerCase().replace(/\s+/g, ' ');
  return roleKey ? `${entity}__${roleKey}` : entity;
}

export interface CompanyAliasIdentity {
  company_name: string;
  country?: string;
  website?: string;
  phone?: string;
  address?: string;
  registrations?: ReadonlyArray<{ namespace: string; value: string }>;
}
export type CompanyAliasRelationship = 'UNKNOWN' | 'PARENT_SUBSIDIARY' | 'DISTRIBUTOR' | 'DISTINCT_LEGAL_ENTITIES';
export type CompanyAliasTier = 'EXACT_SAFE' | 'PROBABLE_ALIAS' | 'AMBIGUOUS' | 'DISTINCT';

const aliasSuffixes = new Set(['ltd', 'limited', 'pvt', 'private', 'inc', 'incorporated', 'co', 'company', 'llc', 'plc']);
const genericAliasWords = new Set([...aliasSuffixes, 'pharma', 'pharmaceutical', 'pharmaceuticals', 'medical',
  'healthcare', 'health', 'trading', 'international', 'import', 'export', 'imports', 'exports', 'group']);
const boundedAliasText = (value: unknown, max: number) => {
  if (typeof value !== 'string' || value.length > max || /[\x00-\x1f\x7f]/.test(value)) return '';
  const normalized = value.normalize('NFKC').trim();
  return normalized.length <= max ? normalized : '';
};
function aliasCandidateBase(name: string): string {
  const words = canonicalCompanyIdentityKey(name).split(' ');
  // Candidate generation only. Never use this stripped value for identity,
  // persistence, grouping, cache selection or evidence admission.
  while (words.length && aliasSuffixes.has(words[words.length - 1])) words.pop();
  return words.join(' ');
}
function aliasDomain(value: unknown): string {
  const text = boundedAliasText(value, 2048);
  if (!text) return '';
  try {
    const url = new URL(text.includes('://') ? text : `https://${text}`);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return '';
    return url.hostname.toLowerCase().replace(/^www\./, '') + (url.port ? `:${url.port}` : '');
  } catch { return ''; }
}
function aliasPhone(value: unknown): string {
  const number = boundedAliasText(value, 80).replace(/\D/g, '');
  return /^\d{7,15}$/.test(number) && !/^(\d)\1+$/.test(number) ? number : '';
}
function aliasCountry(value: unknown): string {
  const exact = normalizeCountryExact(boundedAliasText(value, 100));
  const names = detectExplicitCountryNames(exact);
  // Existing import normalization deliberately preserves unresolved strings.
  // That does not make an unknown or mixed label safe for alias decisions.
  return names.length === 1 && names[0].toLowerCase() === exact.toLowerCase()
    ? canonicalCountryIdentityKey(exact) : '';
}
function aliasRegistrations(value: CompanyAliasIdentity['registrations']): Map<string, string> | null {
  const result = new Map<string, string>();
  if (value === undefined) return result;
  if (!Array.isArray(value) || value.length > 8) return null;
  for (const item of value) {
    const namespace = boundedAliasText(item?.namespace, 80).toLowerCase();
    const id = boundedAliasText(item?.value, 120);
    if (!namespace || !id || (result.has(namespace) && result.get(namespace) !== id)) return null;
    result.set(namespace, id);
  }
  return result;
}
function aliasWithinTwoEdits(left: string, right: string): boolean {
  if (Math.abs(left.length - right.length) > 2) return false;
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i++) {
    const row = [i]; let smallest = i;
    for (let j = 1; j <= right.length; j++) {
      row[j] = Math.min(row[j - 1] + 1, previous[j] + 1, previous[j - 1] + (left[i - 1] === right[j - 1] ? 0 : 1));
      smallest = Math.min(smallest, row[j]);
    }
    if (smallest > 2) return false;
    previous = row;
  }
  return previous[right.length] <= 2;
}

/** Backend candidate triage, not legal-entity admission. Profile signals must
 * come from existing scoped backend records. A probable result cannot authorize
 * a merge or research/cache reuse. Registry admission must independently verify
 * immutable source proof. No mutation, I/O, new IDs or confidence scores here.
 */
export function classifyCompanyAliasCandidate(left: CompanyAliasIdentity, right: CompanyAliasIdentity,
  relationship: CompanyAliasRelationship = 'UNKNOWN') {
  const decision = (tier: CompanyAliasTier, reason: string) => ({ tier, reason, autoMerge: false as const });
  const leftName = boundedAliasText(left?.company_name, 200), rightName = boundedAliasText(right?.company_name, 200);
  const leftCountry = aliasCountry(left?.country);
  const rightCountry = aliasCountry(right?.country);
  if (!leftName || !rightName || !leftCountry || !rightCountry) return decision('AMBIGUOUS', 'MISSING_BOUNDED_IDENTITY');
  if (leftCountry !== rightCountry) return decision('DISTINCT', 'COUNTRY_MISMATCH');
  if (relationship !== 'UNKNOWN') return decision('DISTINCT', 'SEPARATE_LEGAL_RELATIONSHIP');
  const aIds = aliasRegistrations(left.registrations), bIds = aliasRegistrations(right.registrations);
  if (!aIds || !bIds) return decision('AMBIGUOUS', 'INVALID_REGISTRATION_SIGNALS');
  let sameRegistration = false;
  for (const [namespace, value] of aIds) {
    if (!bIds.has(namespace)) continue;
    if (bIds.get(namespace) !== value) return decision('DISTINCT', 'REGISTRATION_CONFLICT');
    sameRegistration = true;
  }
  const a = aliasCandidateBase(leftName), b = aliasCandidateBase(rightName);
  if (!a || !b) return decision('AMBIGUOUS', 'MISSING_BUSINESS_NAME');
  const aWords = a.split(' ').filter(word => !genericAliasWords.has(word));
  const bWords = b.split(' ').filter(word => !genericAliasWords.has(word));
  const aDomain = aliasDomain(left.website), bDomain = aliasDomain(right.website);
  const aPhone = aliasPhone(left.phone), bPhone = aliasPhone(right.phone);
  const aAddress = canonicalCompanyIdentityKey(boundedAliasText(left.address, 500));
  const bAddress = canonicalCompanyIdentityKey(boundedAliasText(right.address, 500));
  const conflictingProfile = (aDomain && bDomain && aDomain !== bDomain)
    || (aPhone && bPhone && aPhone !== bPhone) || (aAddress && bAddress && aAddress !== bAddress);
  if (canonicalCompanyIdentityKey(leftName) === canonicalCompanyIdentityKey(rightName)
    && !conflictingProfile && (sameRegistration || (aWords.length && bWords.length))) {
    return decision('EXACT_SAFE', 'EXISTING_FORMATTING_IDENTITY');
  }
  if (sameRegistration) return decision('PROBABLE_ALIAS', 'SHARED_REGISTRATION_REQUIRES_PROOF');
  if (!aWords.length || !bWords.length) return decision('AMBIGUOUS', 'GENERIC_WORDS_ONLY');
  const nearName = a === b || aliasWithinTwoEdits(a, b);
  const sharedDomain = aDomain && aDomain === bDomain;
  const sharedPhone = aPhone && aPhone === bPhone;
  const sharedAddress = aAddress.length >= 12 && aAddress === bAddress;
  if (nearName && sharedDomain && (sharedPhone || sharedAddress)) return decision('PROBABLE_ALIAS', 'SUPPORTED_NAME_CANDIDATE_REQUIRES_PROOF');
  if (nearName || aWords.some(word => bWords.includes(word))) return decision('AMBIGUOUS', 'INSUFFICIENT_ALIAS_EVIDENCE');
  return decision('DISTINCT', 'DIFFERENT_BUSINESS_NAME');
}
