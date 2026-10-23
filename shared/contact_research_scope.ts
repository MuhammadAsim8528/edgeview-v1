export interface ResearchScopeContact {
  type?: unknown; country?: unknown; edgeview_v1_run_id?: unknown;
  email?: unknown; phone?: unknown; address?: unknown; website?: unknown;
  emails_list?: unknown; phones_list?: unknown; addresses?: unknown; contact_persons?: unknown;
}
export type ResearchContactCategory = 'EXCLUDED' | 'UNRESEARCHED' | 'ENRICHED' | 'UNRESOLVED';

/** Shared summary/filter/retry scope; this classifies retained state, not truth. */
export function contactResearchCategory(contact: ResearchScopeContact): ResearchContactCategory {
  if (String(contact.type || '').trim().toLowerCase() === 'exporter'
    && String(contact.country || '').trim().toLowerCase() === 'pakistan') return 'EXCLUDED';
  if (!contact.edgeview_v1_run_id) return 'UNRESEARCHED';
  const hasInfo = Boolean(contact.email || contact.phone || contact.address || contact.website)
    || [contact.emails_list, contact.phones_list, contact.addresses, contact.contact_persons].some(value => Array.isArray(value) && value.length > 0);
  return hasInfo ? 'ENRICHED' : 'UNRESOLVED';
}

export function matchesResearchFilter(contact: ResearchScopeContact, filter: string): boolean {
  if (filter === 'ALL') return true;
  const type = String(contact.type || '').trim().toUpperCase();
  if (filter === 'EXPORTER') return type === 'EXPORTER' || type === 'BOTH';
  if (filter === 'IMPORTER') return type === 'IMPORTER' || type === 'BOTH';
  const category = contactResearchCategory(contact);
  return filter === 'RESEARCHED' ? category === 'ENRICHED' || category === 'UNRESOLVED' : filter === category;
}
