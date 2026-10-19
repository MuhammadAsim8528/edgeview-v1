import {
  canonicalCompanyIdentityKey,
  canonicalContactCacheKey,
  canonicalCountryIdentityKey,
  canonicalEntityIdentityKey,
} from './company_identity';

export function applyEnrichmentDetailsToContact(contact: any, details: any): void {
  if (!contact || !details) return;
  if (details.invalidate_existing_identity === true) {
    for (const field of ['email', 'phone', 'address', 'website', 'linkedin', 'industry', 'ceo']) contact[field] = '';
  }
  for (const field of ['email', 'phone', 'address', 'website', 'linkedin', 'industry', 'ceo']) {
    if (details[field]) contact[field] = details[field];
  }
  if (details.country) {
    const currentCountry = canonicalCountryIdentityKey(contact.country);
    const detailCountry = canonicalCountryIdentityKey(details.country);
    if (!currentCountry || currentCountry === detailCountry) contact.country = details.country;
  }
  for (const field of [
    'quality_status', 'evidence', 'isPartial', 'decision_makers', 'contact_persons',
    'socials', 'sources', 'emails_list', 'phones_list', 'addresses', 'fax_numbers',
    'linkedin_urls', 'whatsapp_details', 'company_contacts', 'research_trace', 'objectives',
    'claims', 'contradictions', 'research_assessment',
  ]) {
    if (details[field] !== undefined) contact[field] = details[field];
  }
}

/** Select only cache rows eligible to hydrate this exact country/role contact. */
export function selectContactCacheRow(rows: any[], contact: any): any | null {
  const lowerName = canonicalCompanyIdentityKey(contact?.company_name);
  if (!lowerName) return null;
  const country = canonicalCountryIdentityKey(contact?.country);
  const role = String(contact?.type || '').trim().toLowerCase();
  const exactRoleKey = country && role ? canonicalContactCacheKey(contact.company_name, contact.country, role) : '';
  const exactCountryKey = country ? canonicalContactCacheKey(contact.company_name, contact.country) : '';

  const normalizeCacheKey = (value: unknown): string => {
    const parts = String(value || '').trim().split('__');
    if (parts.length === 1) return canonicalCompanyIdentityKey(parts[0]);
    return canonicalContactCacheKey(parts[0], parts[1], parts[2]);
  };

  const eligible = (rows || []).filter((row: any) => {
    const key = normalizeCacheKey(row?.company_name);
    if (key === exactRoleKey || key === exactCountryKey) return true;
    if (key !== lowerName) return false;
    if (!country) return true;
    try {
      const storedCountry = canonicalCountryIdentityKey(JSON.parse(row.details_json || '{}').country);
      return storedCountry === country;
    } catch (_) {
      return false;
    }
  });

  return eligible.sort((a: any, b: any) => {
    const score = (row: any) => {
      const key = normalizeCacheKey(row?.company_name);
      let rank = key === exactRoleKey ? 400 : key === exactCountryKey ? 300 : key === lowerName ? 100 : 0;
      try {
        const details = JSON.parse(row.details_json || '{}');
        const quality = String(details.quality_status || '').toUpperCase();
        rank += quality === 'COMPLETE' ? 80 : quality === 'PARTIAL' ? 40 : quality === 'FAILED' ? 0 : 10;
        rank += Math.min(20, (details.emails_list?.length || 0) + (details.phones_list?.length || 0) + (details.contact_persons?.length || 0));
      } catch (_) {}
      return rank;
    };
    return score(b) - score(a);
  })[0] || null;
}

/** Deterministically resolve one Contacts entity; ambiguous name-only input is rejected. */
export function selectContactEntity(contacts: any[], query: { id?: string; company_name?: string; country?: string; entity_key?: string }): any | null {
  const all = contacts || [];
  if (query.id) {
    const id = String(query.id).trim().toLowerCase();
    return all.find((contact) => String(contact?.id || '').trim().toLowerCase() === id) || null;
  }
  const requestedEntity = String(query.entity_key || '').trim().toLowerCase();
  if (requestedEntity) {
    return all.find((contact) => String(contact?.entity_key || canonicalEntityIdentityKey(contact?.company_name, contact?.country)).toLowerCase() === requestedEntity) || null;
  }
  const company = canonicalCompanyIdentityKey(query.company_name);
  if (!company) return null;
  const country = canonicalCountryIdentityKey(query.country);
  const matches = all.filter((contact) => {
    if (canonicalCompanyIdentityKey(contact?.company_name) !== company) return false;
    return !country || canonicalCountryIdentityKey(contact?.country) === country;
  });
  return matches.length === 1 ? matches[0] : null;
}
