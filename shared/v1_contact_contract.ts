export const V1_CONTACT_OVERLAY_VERSION = 27;

export interface V1CompanyAddress {
  address: string;
  type?: string;
  source_url?: string;
}

export interface V1SocialAccount {
  platform: string;
  url: string;
  source_url?: string;
}

export interface V1ContactPerson {
  name: string;
  designation?: string;
  email?: string;
  phone?: string;
  department?: string;
  country?: string;
  branch?: string;
  linkedin_url?: string;
  source_url?: string;
}

export type V1ContactQuality = 'COMPLETE' | 'PARTIAL' | 'NOT_FOUND' | 'FAILED' | 'PENDING' | 'ENRICHING';

export interface V1ContactOverlay {
  schema_version?: number | string;
  entity_key?: string;
  emails_list: string[];
  email: string;
  phones_list: string[];
  phone: string;
  website: string;
  linkedin_urls: string[];
  socials: V1SocialAccount[];
  addresses: V1CompanyAddress[];
  address: string;
  contact_persons: V1ContactPerson[];
  decision_makers: unknown[];
  ceo: string;
  quality_status: V1ContactQuality;
  evidence: unknown[];
  unscoped_facts: Array<{ field: string; value: string; source_result_id: string; source_url: string;
    quote: string; scope: 'unknown'; reason: 'COUNTRY_SCOPE_UNPROVEN'; target_country: string }>;
}

function uniqueStrings(values: unknown[], limit: number): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const clean = String(value ?? '').trim();
    const key = clean.toLowerCase();
    if (!clean || seen.has(key)) continue;
    seen.add(key);
    out.push(clean);
    if (out.length >= limit) break;
  }
  return out;
}

function uniquePhones(values: unknown[], limit: number): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const clean = String(value ?? '').trim();
    if (!clean) continue;
    const digits = clean.replace(/\D/g, '').replace(/^00/, '');
    const key = digits.length >= 7 ? digits : clean.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(clean);
    if (out.length >= limit) break;
  }
  return out;
}

function socialPlatform(url: string): string {
  if (/linkedin\.com/i.test(url)) return 'LinkedIn';
  if (/(?:twitter\.com|x\.com)/i.test(url)) return 'X';
  if (/facebook\.com/i.test(url)) return 'Facebook';
  if (/instagram\.com/i.test(url)) return 'Instagram';
  if (/youtube\.com|youtu\.be/i.test(url)) return 'YouTube';
  if (/tiktok\.com/i.test(url)) return 'TikTok';
  if (/t\.me|telegram\./i.test(url)) return 'Telegram';
  return 'Social';
}

export function normalizeV1Addresses(value: unknown, scalar?: unknown): V1CompanyAddress[] {
  const input = [...(Array.isArray(value) ? value : []), ...(scalar ? [scalar] : [])];
  const out: V1CompanyAddress[] = [];
  const seen = new Set<string>();
  for (const item of input) {
    const address = typeof item === 'string'
      ? item.trim()
      : item && typeof item === 'object'
        ? String((item as any).address ?? '').trim()
        : '';
    const key = address.toLowerCase().replace(/\s+/g, ' ');
    if (!address || seen.has(key)) continue;
    seen.add(key);
    out.push({
      address,
      ...(item && typeof item === 'object' && (item as any).type ? { type: String((item as any).type) } : {}),
      ...(item && typeof item === 'object' && (item as any).source_url ? { source_url: String((item as any).source_url) } : {}),
    });
    if (out.length >= 10) break;
  }
  return out;
}

export function normalizeV1Socials(input: any): { linkedin_urls: string[]; socials: V1SocialAccount[] } {
  const socialObjects = Array.isArray(input?.socials) ? input.socials : [];
  const urls = uniqueStrings([
    ...(Array.isArray(input?.social_links) ? input.social_links : []),
    ...(Array.isArray(input?.linkedin_urls) ? input.linkedin_urls : []),
    ...(input?.linkedin ? [input.linkedin] : []),
    ...socialObjects.map((item: any) => item?.url),
  ], 50);
  const socials: V1SocialAccount[] = [];
  const seen = new Set<string>();
  for (const url of urls) {
    const key = url.toLowerCase().replace(/\/+$/, '');
    if (seen.has(key)) continue;
    seen.add(key);
    const existing = socialObjects.find((item: any) => String(item?.url || '').trim().toLowerCase().replace(/\/+$/, '') === key);
    socials.push({
      platform: String(existing?.platform || socialPlatform(url)),
      url,
      ...(existing?.source_url ? { source_url: String(existing.source_url) } : {}),
    });
  }
  return {
    linkedin_urls: urls.filter(url => /linkedin\.com/i.test(url)),
    socials,
  };
}

export function normalizeV1ContactPeople(value: unknown): V1ContactPerson[] {
  if (!Array.isArray(value)) return [];
  const out: V1ContactPerson[] = [];
  const seen = new Set<string>();
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue;
    const item = raw as any;
    const name = String(item.name || '').trim();
    const key = name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    if (!name || !key || seen.has(key)) continue;
    seen.add(key);
    out.push({
      name,
      ...(item.designation ? { designation: String(item.designation).trim() } : {}),
      ...(item.email ? { email: String(item.email).trim() } : {}),
      ...(item.phone ? { phone: String(item.phone).trim() } : {}),
      ...(item.department ? { department: String(item.department).trim() } : {}),
      ...(item.country ? { country: String(item.country).trim() } : {}),
      ...(item.branch ? { branch: String(item.branch).trim() } : {}),
      ...((item.linkedin_url || item.linkedin) ? { linkedin_url: String(item.linkedin_url || item.linkedin).trim() } : {}),
      ...(item.source_url ? { source_url: String(item.source_url).trim() } : {}),
    });
    if (out.length >= 50) break;
  }
  return out;
}

function normalizeUnscopedFacts(input: unknown): V1ContactOverlay['unscoped_facts'] {
  const facts: V1ContactOverlay['unscoped_facts'] = [];
  const seen = new Set<string>();
  for (const item of Array.isArray(input) ? input : []) {
    if (!item || typeof item.value !== 'string' || item.scope !== 'unknown'
      || item.reason !== 'COUNTRY_SCOPE_UNPROVEN') continue;
    const fact = { field: String(item.field || '').slice(0, 24), value: item.value.slice(0, 1000),
      source_result_id: String(item.source_result_id || '').slice(0, 200), source_url: String(item.source_url || '').slice(0, 2000),
      quote: String(item.quote || '').slice(0, 1000), scope: 'unknown' as const,
      reason: 'COUNTRY_SCOPE_UNPROVEN' as const, target_country: String(item.target_country || '').slice(0, 100) };
    // Repeated crawls assign new result IDs. Keep the first reference while
    // preserving distinct sources/passages/countries; raw runs remain immutable.
    const key = JSON.stringify([fact.field, fact.value, fact.source_url, fact.quote, fact.target_country]);
    if (seen.has(key)) continue;
    seen.add(key);
    facts.push(fact);
    if (facts.length >= 200) break;
  }
  return facts;
}

export function normalizeV1ContactOverlay(input: any): V1ContactOverlay {
  const emails = uniqueStrings([...(Array.isArray(input?.emails_list) ? input.emails_list : []), input?.email], 50);
  const phones = uniquePhones([...(Array.isArray(input?.phones_list) ? input.phones_list : []), input?.phone], 10);
  const addresses = normalizeV1Addresses(input?.addresses, input?.address);
  const { linkedin_urls, socials } = normalizeV1Socials(input || {});
  const contact_people = normalizeV1ContactPeople(input?.contact_persons);
  const quality = String(input?.quality_status || 'NOT_FOUND').toUpperCase();
  const allowed = new Set<V1ContactQuality>(['COMPLETE','PARTIAL','NOT_FOUND','FAILED','PENDING','ENRICHING']);
  return {
    schema_version: input?.schema_version,
    entity_key: typeof input?.entity_key === 'string' ? input.entity_key : undefined,
    emails_list: emails,
    email: emails[0] || '',
    phones_list: phones,
    phone: phones[0] || '',
    website: String(input?.website || '').trim(),
    linkedin_urls,
    socials,
    addresses,
    address: addresses[0]?.address || '',
    contact_persons: contact_people,
    decision_makers: Array.isArray(input?.decision_makers) ? input.decision_makers : [],
    ceo: String(input?.ceo || '').trim(),
    quality_status: allowed.has(quality as V1ContactQuality) ? quality as V1ContactQuality : 'NOT_FOUND',
    evidence: Array.isArray(input?.evidence) ? input.evidence : [],
    unscoped_facts: normalizeUnscopedFacts(input?.unscoped_facts),
  };
}
