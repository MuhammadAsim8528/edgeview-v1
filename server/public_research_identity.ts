/** Public identity boundary for every external research query. */
export interface PublicResearchEntityContext {
  companyName: string;
  country?: string;
  role?: 'Importer' | 'Exporter';
  entityKey?: string;
}

const OPAQUE_ID = /\b(?:comp|file|dataset|research|job)-[a-z0-9_-]+\b/i;

export function isOpaqueInternalIdentifier(value: unknown): boolean {
  const text = String(value || '').trim();
  return !text || OPAQUE_ID.test(text) || /^\d{8,}$/.test(text);
}

export function assertPublicResearchQuery(query: string, context: PublicResearchEntityContext): string {
  const cleanQuery = String(query || '').trim();
  const companyName = String(context.companyName || '').trim();
  if (isOpaqueInternalIdentifier(companyName)) {
    throw new Error('UNRESOLVED_PUBLIC_ENTITY: external research requires a real company name');
  }
  if (!cleanQuery || OPAQUE_ID.test(cleanQuery)) {
    throw new Error('INTERNAL_ID_QUERY_BLOCKED: opaque application identifiers must never be sent to public search');
  }
  return cleanQuery;
}
