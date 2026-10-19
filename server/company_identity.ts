import { normalizeCountryName } from '../src/utils/countryNormalizer';

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
