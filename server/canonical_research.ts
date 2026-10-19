import type { EntityResearchContext } from './research_director';

export interface CanonicalResearchRequest {
  companyName: string;
  forceFetch: boolean;
  context: EntityResearchContext;
}

/** One trusted context projection shared by manual, batch and directory adapters. */
export function buildCanonicalResearchRequest(contact: any, forceFetch = false, fallbackName = '', peerContacts: any[] = []): CanonicalResearchRequest {
  const companyName = String(contact?.company_name || fallbackName || '').trim();
  const emails = Array.from(new Set([...(contact?.emails_list || []), contact?.email].map(String).filter(Boolean)));
  const phones = Array.from(new Set([...(contact?.phones_list || []), contact?.phone].map(String).filter(Boolean)));
  const featureFrequency: Record<string, number> = {};
  for (const peer of peerContacts || []) {
    const values = new Set([...(peer?.traded_with || []), ...(peer?.top_products || [])].map((v) => String(v || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()).filter(Boolean));
    for (const value of values) featureFrequency[value] = (featureFrequency[value] || 0) + 1;
  }
  return {
    companyName,
    forceFetch,
    context: {
      entity_key: String(contact?.entity_key || '').trim(),
      original_company_name: companyName,
      country: String(contact?.country || '').trim(),
      website: String(contact?.website || '').trim(),
      website_verified: contact?.website_verified === true,
      role: String(contact?.type || contact?.role || 'Importer').toLowerCase() === 'exporter' ? 'Exporter' : 'Importer',
      target_city: String(contact?.city || contact?.target_city || '').trim(),
      known_address: String(contact?.address || '').trim(),
      source_file_id: String(contact?.source_file_ids?.[0] || contact?.source_file || '').trim(),
      dataset_id: String(contact?.source_file || contact?.dataset_id || '').trim(),
      known_products: [...(contact?.top_products || contact?.known_products || [])],
      traded_with: [...(contact?.traded_with || contact?.trade_partners || [])],
      existing_contacts: { emails, phones },
      trade_feature_entity_frequency: featureFrequency,
      trade_feature_recurrence: { ...(contact?.trade_feature_recurrence || {}) },
      verified_partner_domains: { ...(contact?.verified_partner_domains || {}) },
      deep_recovery: forceFetch,
    },
  };
}
