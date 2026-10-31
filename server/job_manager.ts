import { getDb } from './sqlite';
import { getV1Run, listV1RunIdentityHeaders, runV1Enrichment, type V1Run } from './v1_engine';
import { resolveOfficialDomain, sameDomainOrSubdomain } from './v1_identity';
import { hasInstitutionalRole } from './corporate_validation';
import { hasExplicitCountryCallingCode, isCountryCompatiblePhone } from './phone_country';
import { canonicalCompanyIdentityKey, canonicalEntityIdentityKey } from './company_identity';
import { normalizeV1ContactOverlay, V1_CONTACT_OVERLAY_VERSION } from '../shared/v1_contact_contract';
import { OrderedFailureStreak } from './ordered_failure_tracker';
import { contactFactScope, countryScopedFactSources, structuredContactFactScope } from './contact_country_scope';
import { localHeadquartersEvidence, managementPublisherMatches, relatedLeadershipEmployer, foreignCurrentLeadershipLocation, foreignManagementSection } from './leadership_affiliation';
import { stripHtmlComments } from './html_evidence';
import { detectExplicitCountryNames } from '../src/utils/countryNormalizer';

const RESEARCH_PROVIDERS = ['serper', 'firecrawl', 'nvidia', 'groq', 'gemini', 'hunter', 'tavily', 'exa', 'linkup', 'apify'] as const;
type ResearchProvider = typeof RESEARCH_PROVIDERS[number];
const emptyProviderUsage = (): Record<ResearchProvider, number> => Object.fromEntries(RESEARCH_PROVIDERS.map((id) => [id, 0])) as Record<ResearchProvider, number>;

const V1_OVERLAY_VERSION = V1_CONTACT_OVERLAY_VERSION;

export function validPhone(value: string): boolean {
  const normalized = value.replace(/\s+/g, ' ').trim().replace(/[.,;:]+$/, '');
  if (normalized.length > 40 || /(?:@|https?:|read more|email\s*:)/i.test(normalized)) return false;
  if ((normalized.match(/\(/g) || []).length !== (normalized.match(/\)/g) || []).length) return false;
  if ((normalized.match(/\+/g) || []).length > 1 || (normalized.includes('+') && !normalized.startsWith('+'))) return false;
  const digits = normalized.replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 15) return false;
  if (/\b(?:19|20)\d{2}[-/.]\d{1,2}[-/.]\d{1,2}\b/.test(normalized)) return false;
  if (/^\d{4,6}\s*-\s*\d{4,6}$/.test(normalized)) return false;
  if (/^\d+\.\d+$/.test(normalized)) return false;
  // Reject obvious form/demo placeholders that otherwise look like plausible
  // bare international numbers. Do not reject ordinary repeated digits inside
  // a real phone number; these patterns require a long monotonic or identical
  // run that contact forms commonly use as dummy data.
  if (/(?:0123456789|123456789|23456789|987654321|98765432)/.test(digits)) return false;
  if (/(\d)\1{7,}/.test(digits)) return false;
  return true;
}

export function validBusinessEmail(value: string): boolean {
  const email = value.trim().toLowerCase().replace(/[.,;:]+$/, '');
  if (!/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i.test(email)) return false;
  const domain = email.split('@').at(-1) || '';
  if (/^(?:example|exampledomain|test|invalid)\.(?:com|org|net)$/i.test(domain)) return false;
  if (/^(?:example|test|user|name|yourname|email|mail|admin)@/i.test(email)) return false;
  if (/(?:^|\.)(?:sentry|wixpress)\.(?:io|com)$/i.test(domain)) return false;
  if (/^(?:your@email\.com|john@doe\.com)$/i.test(email)) return false;
  const local = email.split('@')[0] || '';
  if ((local.match(/\d/g) || []).length >= 7 && /(?:info|contact|sales|office)$/i.test(local)) return false;
  return true;
}

function attributableEmail(value: string, officialDomain: string): boolean {
  if (!validBusinessEmail(value)) return false;
  const domain = value.toLowerCase().split('@').at(-1) || '';
  const freeMail = /^(?:gmail|yahoo|hotmail|outlook|live|icloud|protonmail)\.[a-z.]{2,}$/i.test(domain);
  return freeMail || sameDomainOrSubdomain(`https://${domain}`, officialDomain);
}

const NON_PERSON_TERMS = /\b(?:management|leadership|team|board|committee|department|staff|people|corporate|executives?|officers?|directors?|managers?|president|chairman|chairperson|chief|ceo|founder|owner|partner|official|contact|about|care team|company|pharm(?:a|aceuticals?)?|pharmacy|limited|ltd|llc|group|services?|solutions?|international|global|healthcare|health care|organization|organisation|guardians?|quality)\b/iu;
const LEADERSHIP_ROLE = /\b(?:chief|ceo|chair(?:man|person)?|director|manager|head|president|founder|officer|executive|procurement|owner|partner|pharmacist)\b/i;

export function plausiblePersonName(value: string): boolean {
  const name = value.replace(/\s+/g, ' ').trim();
  const parts = name.split(/\s+/).filter(Boolean);
  if (name.length < 3 || name.length > 100 || parts.length < 2 || parts.length > 7) return false;
  if (NON_PERSON_TERMS.test(name) || /[!?;]/u.test(name)) return false;
  const letterParts = parts.filter(part => /\p{L}/u.test(part));
  if (letterParts.length < 2) return false;
  // Long prose fragments contain many lowercase connective words; names may
  // contain a small number (de, van, al), but not sentence-like sequences.
  const lowercaseWords = parts.filter(part => /^[a-z]{3,}$/u.test(part));
  if (lowercaseWords.length >= 3) return false;
  return true;
}

function cleanLeadershipRole(value: string): string {
  const role = value.replace(/\s+/g, ' ').trim();
  if (/^(?:official|team|management|leadership|board|staff|people)$/iu.test(role)) return '';
  return role;
}

function normalizeLeadershipPerson(nameValue: string, roleValue: string, companyName: string) {
  let name = nameValue.replace(/\s+/g, ' ').trim();
  let designation = cleanLeadershipRole(roleValue);
  const prefix = name.match(/^(CEO|President|Chairman|Chairperson|Managing Director|General Manager|Director|Founder|Owner)\s+(.+)$/i);
  if (prefix && plausiblePersonName(prefix[2])) {
    designation = designation || prefix[1];
    name = prefix[2].trim();
  }
  const suffix = name.match(/^(.+?)\s+(CEO|President|Chairman|Chairperson|Managing Director|General Manager|Director|Founder|Owner)$/i);
  if (suffix && plausiblePersonName(suffix[1])) {
    designation = designation || suffix[2];
    name = suffix[1].trim();
  }
  const personKey = name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const companyKey = companyName.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const companyTokens = new Set(companyKey.split(' ').filter(token => token.length >= 3 && !/^(?:the|and|pvt|ltd|limited|inc|llc)$/.test(token)));
  const personTokens = personKey.split(' ').filter(token => token.length >= 3);
  const companyOverlap = personTokens.length > 0 && personTokens.filter(token => companyTokens.has(token)).length / personTokens.length >= 0.6;
  if (!plausiblePersonName(name) || companyOverlap || hasInstitutionalRole(designation, name)) return null;
  // Search titles often prepend the person's name to the role. Preserve the
  // original institutional rejection above before cleaning this presentation.
  if (designation.slice(0, name.length).toLowerCase() === name.toLowerCase()) {
    const remainder = designation.slice(name.length);
    if (/^\s*[-–—|:]\s*/u.test(remainder)) designation = cleanLeadershipRole(remainder.replace(/^\s*[-–—|:]\s*/u, ''));
  }
  if (designation && !LEADERSHIP_ROLE.test(designation)) return null;
  return { name, designation, key: personKey };
}

function htmlText(value: string): string {
  return stripHtmlComments(value).replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/gi, ' ').replace(/&amp;/gi, '&').replace(/&#39;|&apos;/gi, "'").replace(/&quot;/gi, '"').replace(/\s+/g, ' ').trim();
}

function jsonLdNodes(html: string): any[] {
  html = stripHtmlComments(html);
  const nodes: any[] = [];
  const visit = (value: any) => {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) { value.forEach(visit); return; }
    nodes.push(value);
    if (Array.isArray(value['@graph'])) value['@graph'].forEach(visit);
    for (const [key, child] of Object.entries(value)) {
      if (key === '@graph' || key === 'address') continue;
      if (['founder', 'employee', 'member', 'founders', 'employees', 'members'].includes(key)) visit(child);
    }
  };
  for (const match of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { visit(JSON.parse(match[1].trim())); } catch { /* malformed structured data stays in the raw HTML */ }
  }
  return nodes;
}

function structuredAddressesFromOfficialPages(pages: Array<any>): string[] {
  const addresses: string[] = [];
  const add = (value: unknown) => {
    const text = htmlText(String(value || ''));
    const looksLocated = /\d|,|\b(?:street|st\.?|road|rd\.?|avenue|ave\.?|lane|building|floor|office|city|district|province|state|postal|p\.?o\.?\s*box)\b/i.test(text);
    if (text.length >= 8 && text.length <= 300 && looksLocated && !addresses.some(item => item.toLowerCase() === text.toLowerCase())) addresses.push(text);
  };
  for (const page of pages) {
    const html = String(page.html || '');
    for (const node of jsonLdNodes(html)) {
      const address = node?.['@type'] === 'PostalAddress' ? node : node?.address;
      if (typeof address === 'string') add(address);
      else if (address && typeof address === 'object') add([
        address.streetAddress, address.addressLocality, address.addressRegion,
        address.postalCode, address.addressCountry?.name || address.addressCountry,
      ].filter(Boolean).join(', '));
    }
    for (const match of html.matchAll(/<(?:address|div|p|span)\b[^>]*(?:itemprop=["']address["']|(?:class|id)=["'][^"']*(?:contact[-_ ]?address|office[-_ ]?address|postal[-_ ]?address)[^"']*["'])[^>]*>([\s\S]{1,800}?)<\/(?:address|div|p|span)>/gi)) add(match[1]);
    // Labelled office blocks need not use a particular site's CSS vocabulary.
    // Keep extraction separate from the field-level country admission below.
    for (const match of html.matchAll(/<(?:div|p|address)\b[^>]*>\s*<span\b[^>]*>\s*(?:(?:registered|office|postal)\s+)?address\s*:?\s*<\/span>([\s\S]{1,800}?)<\/(?:div|p|address)>/gi)) add(match[1]);
    // Common ordinary CMS layout: an office label followed by its paragraph.
    // A global domain or navigation country cannot supply missing local scope.
    const officeHtml = stripHtmlComments(html).replace(/<(?:script|style)\b[\s\S]*?<\/(?:script|style)>/gi, ' ');
    for (const match of officeHtml.matchAll(/<(strong|b|h[1-6])\b[^>]*>([\s\S]{1,120}?)<\/\1>\s*(?:<br\s*\/?>\s*)?<p\b[^>]*>([\s\S]{1,800}?)<\/p>/gi)) {
      const label = htmlText(match[2]), address = htmlText(match[3]);
      if (!/^(?:(?:(?:head|regional|branch|registered|corporate|sales)\s+)?office|headquarters|warehouse(?:\s+complex)?|(?:(?:postal|office|registered)\s+)?address)\s*:?$/i.test(label)) continue;
      const countries = detectExplicitCountryNames(address);
      const street = /\b(?:street|st\.?|road|rd\.?|avenue|ave\.?|lane|building|floor|plot|postal|p\.?o\.?\s*box)\b/i.test(address);
      if (countries.length === 1 && street && !/@|https?:|\b(?:telephone|fax)\b/i.test(address)) add(address);
    }
  }
  return addresses.slice(0, 10);
}

function exactCompanyPublicProfiles(results: Array<any>, companyName: string): Array<any> {
  const ignored = new Set(['the', 'and', 'company', 'limited', 'ltd', 'private', 'pvt', 'inc', 'llc', 'group']);
  const tokens = companyName.toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(' ').filter(token => token.length >= 3 && !ignored.has(token));
  return results.filter(result => {
    if (result.status !== 'success' || !result.url || !(result.text || result.markdown || result.html)) return false;
    let host = '';
    try { host = new URL(result.url).hostname.toLowerCase().replace(/^www\./, ''); } catch { return false; }
    const isCompanyProfile = /(?:^|\.)(?:facebook|instagram)\.com$/.test(host) || (/(?:^|\.)linkedin\.com$/.test(host) && /\/company\//i.test(result.url));
    if (!isCompanyProfile || tokens.length === 0) return false;
    const identityText = `${result.title || ''} ${String(result.text || '').slice(0, 1200)}`.toLowerCase().replace(/[^a-z0-9]+/g, ' ');
    return tokens.filter(token => identityText.includes(token)).length / tokens.length >= 0.75;
  });
}

function usefulSocialUrl(value: string, companyName: string): boolean {
  try {
    const url = new URL(value.replace(/&amp;/g, '&'));
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    const path = url.pathname;
    if (/(?:^|\.)linkedin\.com$/.test(host)) {
      if (!/^\/(?:company|posts)\//i.test(path)) return false;
      const ignored = /^(?:the|and|company|limited|ltd|private|pvt|inc|llc|group)$/;
      const identityTokens = companyName.toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(' ').filter(token => token.length >= 4 && !ignored.test(token));
      return identityTokens.some(token => path.toLowerCase().includes(token));
    }
    if (/(?:^|\.)facebook\.com$/.test(host)) return path.split('/').filter(Boolean).length === 1 && !/^(?:login|help|about|photo|watch)$/i.test(path.replaceAll('/', ''));
    if (/(?:^|\.)instagram\.com$/.test(host)) return /^\/[a-z0-9._]+\/?$/i.test(path) && !/^\/(?:accounts|explore|developer)\b/i.test(path);
    if (/(?:^|\.)(?:twitter|x)\.com$/.test(host)) return /^\/[a-z0-9_]+(?:\/status\/\d+)?\/?$/i.test(path);
  } catch { /* invalid social URL */ }
  return false;
}

function canonicalSocialUrl(value: string): string {
  try {
    const url = new URL(value.replace(/&amp;/g, '&'));
    url.search = '';
    url.hash = '';
    return `${url.origin}${url.pathname}`.replace(/\/$/, '');
  } catch { return ''; }
}

function labeledAddressesFromPublicProfiles(pages: Array<any>): string[] {
  const addresses: string[] = [];
  for (const page of pages) {
    const text = String(page.text || page.markdown || '');
    for (const line of text.split(/\r?\n/).map((value: string) => value.replace(/\s+/g, ' ').trim())) {
      if (line.length < 8 || line.length > 220 || !/\d/.test(line)) continue;
      if (!/\b(?:road|rd\.?|street|st\.?|avenue|ave\.?|lane|building|floor|office|colombo|city|district|province|postal|p\.?o\.?\s*box)\b/i.test(line)) continue;
      if (/https?:|\.(?:jpg|png|webp)|followers?|reactions?/i.test(line)) continue;
      if (!addresses.some(existing => existing.toLowerCase() === line.toLowerCase())) addresses.push(line);
    }
  }
  return addresses.slice(0, 10);
}

export function safeDecodeUriComponent(value: string): string {
  try { return decodeURIComponent(value); }
  catch { return value; }
}

type FormalLeadershipCard = { name: string; designation: string; source: any; text: string; quote: string; headings: string[]; headingsComplete: boolean };
function structuredLeadersFromOfficialPages(pages: Array<any>, companyName: string, formalCards?: FormalLeadershipCard[]) {
  const leaders: Array<{ name: string; designation: string; source_url: string }> = [];
  const pair = /class=["'][^"']*(?:team|member|person)[-_ ]name[^"']*["'][^>]*>([\s\S]{1,240}?)<\/[^>]+>[\s\S]{0,1000}?class=["'][^"']*(?:team|member|person)[-_ ](?:job|role|position|title)[^"']*["'][^>]*>([\s\S]{1,240}?)<\/[^>]+>/gi;
  for (const page of pages) {
    const html = String(page.html || '');
    for (const node of jsonLdNodes(html)) {
      const types = Array.isArray(node?.['@type']) ? node['@type'] : [node?.['@type']];
      const role = htmlText(String(node?.jobTitle || node?.roleName || ''));
      const name = htmlText(String(node?.name || ''));
      const normalized = normalizeLeadershipPerson(name, role, companyName);
      if (types.some((type: unknown) => String(type).toLowerCase() === 'person') && normalized && LEADERSHIP_ROLE.test(normalized.designation)) {
        leaders.push({ name: normalized.name, designation: normalized.designation, source_url: String(page.url || '') });
      }
    }
    const cardHtml = stripHtmlComments(html).replace(/<(?:script|style|nav)\b[\s\S]*?<\/(?:script|style|nav)>/gi, ' ');
    const cards = [...cardHtml.matchAll(pair)].slice(0, 100);
    const headings = [...cardHtml.matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi)];
    const activeHeadings: Array<{ level: number; text: string }> = [];
    let headingIndex = 0;
    for (const [index, match] of cards.entries()) {
      while (headingIndex < Math.min(2000, headings.length) && headings[headingIndex].index < match.index) {
        const heading = headings[headingIndex++]; const level = Number(heading[1]);
        while (activeHeadings.length && activeHeadings.at(-1)!.level >= level) activeHeadings.pop();
        activeHeadings.push({ level, text: htmlText(heading[2]) });
      }
      const name = htmlText(match[1]); const designation = htmlText(match[2]);
      const normalized = normalizeLeadershipPerson(name, designation, companyName);
      if (!normalized || !normalized.designation || normalized.designation.length > 120) continue;
      leaders.push({ name: normalized.name, designation: normalized.designation, source_url: String(page.url || '') });
      formalCards?.push({ name: normalized.name, designation: normalized.designation, source: page,
        text: htmlText(cardHtml.slice(match.index, Math.min(cards[index + 1]?.index ?? cardHtml.length, match.index + 8000))), quote: htmlText(match[0]),
        headings: activeHeadings.map(item => item.text), headingsComplete: headings.length <= 2000 });
    }
  }
  return leaders;
}

function leadershipFromLinkedInResults(results: Array<any>, companyName: string) {
  const employerKey = (name: string) => canonicalCompanyIdentityKey(name).split(' ')
    .filter(token => !/^(?:the|company|co|limited|ltd|private|pvt|inc|llc|plc)$/.test(token))
    .map(token => /^pharmaceuticals?$/.test(token) ? 'pharma' : token).join(' ');
  const targetEmployer = employerKey(companyName);
  const leaders: Array<{ name: string; designation: string; source_url: string; linkedin: string }> = [];
  for (const result of results) {
    const url = String(result.url || '');
    try { const parsed = new URL(url); if (!/(?:^|\.)linkedin\.com$/i.test(parsed.hostname) || !/^\/in\//i.test(parsed.pathname)) continue; } catch { continue; }
    if (result.status !== 'success' || !targetEmployer) continue;
    const evidence = `${String(result.title || '')}\n${String(result.snippet || '')}`;
    // A profile can describe several employers. Bind the role to its own
    // explicit employer clause; target words elsewhere authorize nothing.
    let designation = '';
    for (const match of evidence.matchAll(/(?:^|\n|[;|•])\s*(?:#{1,4}\s*)?([^\n;|•]{2,120}?)\s+at\s+([^\n;|•]{2,180})/gi)) {
      if (/\b(?:former(?:ly)?|previous(?:ly)?|past|retired|ex[- ])\b/i.test(match[1])) continue;
      const employer = match[2].split(/\s+(?:in|based in|located in)\s+/i)[0].replace(/[.!?]+$/, '').trim();
      if (employerKey(employer) !== targetEmployer) continue;
      const role = cleanLeadershipRole(match[1].replace(/^\*+|\*+$/g, '').trim());
      if (LEADERSHIP_ROLE.test(role)) { designation = role; break; }
    }
    if (!LEADERSHIP_ROLE.test(designation)) continue;
    let name = String(result.title || '').split(/\s[-|]\s/)[0].trim();
    const headingName = evidence.match(/(?:^|\n)\s*#\s+([^\n#]{3,100})/);
    if (headingName) name = headingName[1].trim();
    if (!plausiblePersonName(name)) {
      try {
        const slug = new URL(url).pathname.split('/').filter(Boolean).at(-1) || '';
        name = slug.replace(/-[a-z0-9]*\d[a-z0-9]*$/i, '').split('-').filter(Boolean)
          .map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
      } catch { name = ''; }
    }
    const normalized = normalizeLeadershipPerson(name, designation, companyName);
    if (!normalized) continue;
    leaders.push({ name: normalized.name, designation: normalized.designation, source_url: url, linkedin: url });
  }
  return leaders;
}

export function projectDeterministicContactFields(run: Pick<V1Run, 'company_name' | 'results' | 'identity_resolution' | 'evidence_workspace'> & Partial<Pick<V1Run, 'country'>>) {
  const results = run.results;
  // Failure payloads remain in the immutable run, never as domain/contact proof.
  const searchEvidence = results.filter(result => result.status === 'success' && !['direct-http', 'hunter', 'groq', 'nvidia'].includes(String(result.provider || '')));
  const officialDomain = searchEvidence.length
    ? resolveOfficialDomain(run.company_name, String(run.country || ''), searchEvidence).official_domain
    : (run.identity_resolution?.official_domain || '');
  const officialPages = results.filter(result => officialDomain && result.status === 'success' && sameDomainOrSubdomain(result.url, officialDomain) && Boolean(result.text || result.markdown || result.html));
  const publicProfiles = officialDomain ? exactCompanyPublicProfiles(results, String(run.company_name || '')) : [];
  const contactPages = [...officialPages, ...publicProfiles];
  const hunterEmails = results
    .filter(result => result.provider === 'hunter' && officialDomain && String(result?.metadata?.domain || '') === officialDomain)
    .map(result => String(result?.metadata?.value || result?.snippet || '').trim().toLowerCase())
    .filter(validBusinessEmail);
  const pageEmails = contactPages.flatMap(result => {
    const html = String(result.html || '');
    const text = String(result.text || '');
    return [
      ...[...html.matchAll(/mailto:([^?"'\s<>]+)/gi)].map(match => match[1]),
      ...[...`${html} ${text}`.matchAll(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi)].map(match => match[0]),
    ];
  });
  // Search snippets can contain exact contact facts from reputable partner,
  // regulator, or directory pages even when those pages are outside the
  // company's own domain. Admit only email-shaped values attributable to the
  // already-resolved official domain; this preserves useful exact evidence
  // without letting third-party addresses contaminate the company profile.
  const searchSnippetEmails = searchEvidence
    .flatMap(result =>
      [...String(result.snippet || '').matchAll(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi)].map(match => match[0])
    )
    // Unlike an official contact page, an arbitrary search snippet cannot
    // attribute a free-mail mailbox to this company merely by mentioning it.
    .filter(value => officialDomain && sameDomainOrSubdomain(`https://${value.split('@').at(-1)}`, officialDomain));
  const phones = contactPages.flatMap(result => {
    const html = String(result.html || '');
    const text = String(result.text || result.markdown || '');
    // Do not join lines: a postal code/date on the next line is not part of
    // the phone. Unlabelled international numbers require an official page;
    // third-party profiles still require a phone label or explicit tel link.
    const internationalPhones = officialPages.includes(result)
      ? [...text.matchAll(/\+\d[\d \t().-]{7,}\d/g)].filter(match => {
        const prefix = text.slice(Math.max(0, (match.index || 0) - 60), match.index || 0).split(/\r?\n/).at(-1) || '';
        return !/\bfax(?:\s+(?:number|no\.?))?\s*[:.\-]?\s*$/i.test(prefix);
      }).map(match => match[0]) : [];
    return [
      ...[...html.matchAll(/tel:([^"'<>]+)/gi)].map(match => safeDecodeUriComponent(match[1].split('?')[0])),
      ...[...text.matchAll(/\b(?:phone|telephone|tel|mobile|cell|whatsapp|call us)[ \t]*[:.\-]?[ \t]*(\+?\d[\d \t().-]{7,}\d)/gi)].map(match => match[1]),
      ...internationalPhones,
    ];
  })
    .map(value => value.replace(/\s+/g, ' ').trim())
    .filter((value, index, all) => validPhone(value) && isCountryCompatiblePhone(value, String(run.country || '')) && all.findIndex(other => other.replace(/\D/g, '') === value.replace(/\D/g, '')) === index)
    .slice(0, 10);
  const emails = [...hunterEmails, ...pageEmails, ...searchSnippetEmails]
    .map(value => value.trim().toLowerCase().replace(/[.,;:]+$/, ''))
    .filter((value, index, all) => attributableEmail(value, officialDomain) && all.indexOf(value) === index)
    .slice(0, 50);
  const social_links = [...new Set([
    ...publicProfiles.map(result => String(result.url || '')),
    ...contactPages.flatMap(result => result.links || []),
  ].filter((url: string) => usefulSocialUrl(url, String(run.company_name || ''))).map(canonicalSocialUrl).filter(Boolean))].slice(0, 50);
  const citedClaims = run.evidence_workspace?.accepted_claims || [];
  const citedEmails = citedClaims.filter(claim => claim.field === 'email' && claim.source_type === 'official').map(claim => claim.value.toLowerCase()).filter(value => attributableEmail(value, officialDomain));
  const citedPhones = citedClaims.filter(claim => claim.field === 'phone' && claim.source_type === 'official').map(claim => claim.value).filter(value => validPhone(value) && isCountryCompatiblePhone(value, String(run.country || '')));
  const targetCountry = String(run.country || '').trim().toLowerCase();
  const citedAddresses = citedClaims
    .filter(claim => claim.field === 'address' && claim.source_type === 'official')
    .filter(claim => String(claim.role || '').toLowerCase() !== 'country')
    .map(claim => String(claim.value || '').trim())
    .filter(value => value && value.toLowerCase() !== targetCountry);
  const addressKey = (value: string) => value.toLowerCase().replace(/\s+/g, ' ').replace(/[.,;\s]+$/, '');
  const addresses = [
    ...structuredAddressesFromOfficialPages(officialPages),
    ...labeledAddressesFromPublicProfiles(publicProfiles),
    ...citedAddresses,
  ].filter((value, index, all) => all.findIndex(other => addressKey(other) === addressKey(value)) === index).slice(0, 10);
  const leaderMap = new Map<string, { name: string; designation: string; source_url: string; linkedin?: string }>();
  const companyName = String(run.company_name || '');
  const formalCards: FormalLeadershipCard[] = [];
  const linkedInLeaders = leadershipFromLinkedInResults(results, companyName);
  for (const leader of structuredLeadersFromOfficialPages(officialPages, companyName, formalCards)) {
    leaderMap.set(leader.name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(), leader);
  }
  for (const leader of linkedInLeaders) {
    if (!leaderMap.has(leader.name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim())) {
      leaderMap.set(leader.name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(), leader);
    }
  }
  for (const claim of citedClaims.filter(item => item.field === 'leader' && Boolean(officialDomain))) {
    if (claim.source_type === 'linkedin' && /linkedin\.com\/(?:company|posts)\//i.test(claim.source_url)) continue;
    const normalized = normalizeLeadershipPerson(claim.value, claim.role || '', companyName);
    if (!normalized) continue;
    const key = normalized.key;
    const role = normalized.designation;
    if (!role && claim.source_type === 'official' && !/(?:team|management|board|leadership|director|chief|ceo|founder|md[-_ ]?(?:s[-_ ]?)?message|our[-_ ]people|who[-_ ]we[-_ ]are)/i.test(claim.source_url)) continue;
    if (claim.source_type === 'linkedin' && !LEADERSHIP_ROLE.test(role)) continue;
    const existing = leaderMap.get(key);
    const next = existing || { name: normalized.name, designation: role, source_url: claim.source_url };
    if (!next.designation && role) next.designation = role;
    if (claim.source_type === 'official') next.source_url = claim.source_url;
    if (claim.source_type === 'linkedin') next.linkedin = claim.source_url;
    leaderMap.set(key, next);
  }
  const linkedInProfiles = results.filter(result => /linkedin\.com\/in\//i.test(String(result.url || '')));
  for (const leader of leaderMap.values()) {
    const nameTokens = leader.name.toLowerCase().split(/[^a-z0-9]+/).filter(token => token.length >= 2);
    const profile = linkedInProfiles.find(result => {
      const title = String(result.title || '').toLowerCase();
      return nameTokens.length >= 2 && nameTokens.every(token => title.includes(token));
    });
    if (profile) leader.linkedin = String(profile.url);
  }
  const scopeEvidence: Array<Record<string, unknown>> = [];
  const unscopedFacts: Array<Record<string, unknown>> = [];
  const headquarters = localHeadquartersEvidence(officialPages, addresses, companyName, String(run.country || ''));
  const admit = (field: string, value: string, sourceUrl?: string, role = '') => {
    if (field === 'leader' && relatedLeadershipEmployer(role, companyName, String(run.country || ''))) return false;
    if (field === 'leader' && /linkedin\.com\/in\//i.test(String(sourceUrl || ''))
      && !linkedInLeaders.some(person => person.source_url === sourceUrl && person.name.toLowerCase() === value.toLowerCase()
        && person.designation.toLowerCase() === role.toLowerCase())) return false;
    const card = field === 'leader' ? formalCards.find(item => item.name.toLowerCase() === value.toLowerCase() && item.source.url === sourceUrl) : undefined;
    const typed = card && structuredContactFactScope(card.source, value, String(run.country || ''));
    if (card && (foreignCurrentLeadershipLocation(role, card.text, String(run.country || ''))
      || foreignManagementSection(card.headings, companyName, value, String(run.country || ''))
      || (typed && !['local', 'unknown'].includes(typed.scope)))) return false;
    const sources = countryScopedFactSources(results, value, String(run.country || ''), sourceUrl, field);
    // Older immutable runs can retain already-admitted quoted claims without
    // their original normalized result. Keep that provenance explicitly scoped;
    // never use a claim as an escape hatch around a present foreign source.
    for (const claim of citedClaims.filter(claim => claim.field === field && (!sourceUrl || claim.source_url === sourceUrl)
      && claim.value.toLowerCase().includes(value.toLowerCase())
      && !results.some(result => result.id === claim.source_result_id || result.url === claim.source_url))) {
      sources.push({ source_result_id: claim.source_result_id, source_url: claim.source_url,
        ...contactFactScope({ id: claim.source_result_id, url: claim.source_url, text: claim.quote }, value, String(run.country || '')) });
    }
    if (field === 'address') {
      for (const source of officialPages) {
        if (structuredAddressesFromOfficialPages([source]).includes(value) && !sources.some(item => item.source_result_id === source.id)) {
          sources.push({ source_result_id: source.id, source_url: source.url, ...contactFactScope(source, value, String(run.country || '')) });
        }
      }
    }
    if (field === 'leader') {
      // A name appearing only in a script/comment/template is not carried by
      // visible text or supported structured evidence, even if a model claimed it.
      for (let index = sources.length - 1; index >= 0; index--) if (!sources[index].quote) sources.splice(index, 1);
    }
    if (field === 'leader' && headquarters && !sources.some(source => source.scope === 'local' || source.scope === 'related_entity')) {
      if (card && card.headingsComplete && managementPublisherMatches(card.source, companyName)
        && (!typed || typed.scope === 'local' || typed.scope === 'unknown')) {
        scopeEvidence.push({ field, value, source_result_id: card.source.id, source_url: card.source.url, scope: 'local',
          target_country: run.country, quote: card.quote, scope_basis: 'local_head_office_management',
          organization_country_source_result_id: headquarters.source_result_id, organization_country_source_url: headquarters.source_url,
          organization_country_quote: headquarters.quote });
        return true;
      }
    }
    // Domain ownership cannot override explicit foreign/other-entity evidence.
    // Unknown remains a marked legacy scope, not fabricated local-country proof.
    const local = sources.filter(source => source.scope === 'local'
      || (source.scope === 'unknown' && source.quote && field === 'phone' && hasExplicitCountryCallingCode(value, String(run.country || ''))))
      .map(source => source.scope === 'unknown' ? { ...source, scope: 'local' as const, scope_basis: 'explicit_phone_country_code' } : source);
    const unknown = sources.length && sources.every(source => source.scope === 'unknown') ? sources : [];
    const eligible = local.length ? local : !run.country ? unknown : [];
    if (!eligible.length) for (const source of unknown) unscopedFacts.push({ field, value, ...source,
      target_country: run.country || '', reason: 'COUNTRY_SCOPE_UNPROVEN' });
    for (const source of eligible) scopeEvidence.push({ field, value, ...source, target_country: run.country || '' });
    return eligible.length > 0;
  };
  const contact_persons = [...leaderMap.values()].filter(person => admit('leader', person.name, person.source_url, person.designation)).slice(0, 50);
  const finalEmails = [...new Set([...emails, ...citedEmails])].filter(value => admit('email', value)).slice(0, 50);
  const finalPhones = [...new Set([...phones, ...citedPhones])].filter(value => admit('phone', value)).slice(0, 10);
  const scopedAddresses = addresses.filter(value => admit('address', value));
  const scopedSocials = social_links.filter(value => admit('social', value));
  const website = officialDomain ? `https://${officialDomain}` : '';
  const hasChannel = finalEmails.length > 0 || finalPhones.length > 0;
  const hasOrganizationDetail = scopedAddresses.length > 0 || contact_persons.length > 0;
  return {
    schema_version: V1_OVERLAY_VERSION,
    entity_key: canonicalEntityIdentityKey(run.company_name, run.country),
    emails_list: finalEmails,
    email: finalEmails[0] || '',
    phones_list: finalPhones,
    phone: finalPhones[0] || '',
    website,
    social_links: scopedSocials,
    addresses: scopedAddresses,
    address: scopedAddresses[0] || '',
    contact_persons,
    decision_makers: [],
    ceo: '',
    quality_status: website && hasChannel && hasOrganizationDetail ? 'COMPLETE' : website || hasChannel || hasOrganizationDetail ? 'PARTIAL' : 'NOT_FOUND',
    evidence: scopeEvidence,
    unscoped_facts: unscopedFacts,
  };
}

/** Only a retained run for this exact company+country can replace a provider
 * request. Payload loading happens on an explicit action, never startup. */
export function reusableContactRun(contact: { company_name?: string; country?: string; edgeview_v1_run_id?: string } | null | undefined): V1Run | null {
  if (!contact?.edgeview_v1_run_id || !contact.company_name?.trim() || !contact.country?.trim()) return null;
  const run = getV1Run(contact.edgeview_v1_run_id);
  return run && ['COMPLETED', 'PARTIAL'].includes(run.status)
    && canonicalEntityIdentityKey(run.company_name, run.country) === canonicalEntityIdentityKey(contact.company_name, contact.country)
    ? run : null;
}

/** Capability preflight uses only the existing bounded-header representation,
 * never hydrates every selected company's multi-megabyte payload. Actual reuse
 * rechecks the loaded run before publishing anything. */
type RetainedContact = { company_name?: string; country?: string; edgeview_v1_run_id?: string };
export function reusableEvidenceContacts<T extends RetainedContact>(contacts: Array<T | null | undefined>): Set<T> {
  const eligible = contacts.filter(contact => contact?.edgeview_v1_run_id && contact.company_name?.trim() && contact.country?.trim()) as T[];
  const wanted = new Set(eligible.map(contact => contact.edgeview_v1_run_id));
  const retained = new Map(listV1RunIdentityHeaders().filter(header => wanted.has(header.id)).map(header => [header.id, header]));
  return new Set(eligible.filter(contact => {
    const header = retained.get(contact.edgeview_v1_run_id!);
    return header && ['COMPLETED', 'PARTIAL'].includes(header.status)
      && canonicalEntityIdentityKey(header.company_name, header.country) === canonicalEntityIdentityKey(contact.company_name, contact.country);
  }));
}
export function reusableEvidenceSelection(contacts: Array<RetainedContact | null | undefined>): boolean {
  return contacts.length > 0 && reusableEvidenceContacts(contacts).size === contacts.length;
}

export function projectHistoricalContactFields(run: V1Run) {
  const entityName = canonicalEntityIdentityKey(run.company_name, run.country);
  // A company can have an older high-quality run far beyond the most recent
  // 1,000 global runs. Search the complete summary index so a later weak or
  // failed refresh can never erase previously captured fields.
  const projections = [projectDeterministicContactFields(run)];
  for (const summary of listV1RunIdentityHeaders()) {
    if (summary.id === run.id || canonicalEntityIdentityKey(summary.company_name, summary.country) !== entityName) continue;
    // Project one payload at a time. Retaining all historical raw captures can
    // hold hundreds of MB; limiting to recent runs can erase older trusted facts.
    const historical = getV1Run(summary.id);
    if (historical) projections.push(projectDeterministicContactFields(historical));
  }
  const strings = (field: string, scalar?: string) => [...new Set(projections.flatMap((projection: any) => [
    ...(Array.isArray(projection[field]) ? projection[field] : []),
    ...(scalar && projection[scalar] ? [projection[scalar]] : []),
  ]).map(value => String(value || '').trim()).filter(Boolean))];
  const people = new Map<string, any>();
  for (const person of projections.flatMap((projection: any) => projection.contact_persons || [])) {
    const key = String(person?.name || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    if (key && !people.has(key)) people.set(key, person);
  }
  const emails = strings('emails_list', 'email');
  const phones = strings('phones_list', 'phone');
  const addresses = strings('addresses', 'address');
  const contactPersons = [...people.values()].slice(0, 50);
  const website = projections.find((projection: any) => projection.website)?.website || '';
  const hasChannel = emails.length > 0 || phones.length > 0;
  const hasOrganizationDetail = addresses.length > 0 || contactPersons.length > 0;
  return normalizeV1ContactOverlay({
    schema_version: V1_OVERLAY_VERSION,
    entity_key: canonicalEntityIdentityKey(run.company_name, run.country),
    emails_list: emails.slice(0, 50), email: emails[0] || '',
    phones_list: phones.slice(0, 10), phone: phones[0] || '',
    website,
    social_links: [...new Set(strings('social_links').map(canonicalSocialUrl).filter(Boolean))].slice(0, 50),
    addresses: addresses.slice(0, 10), address: addresses[0] || '',
    contact_persons: contactPersons,
    decision_makers: [], ceo: '',
    quality_status: website && hasChannel && hasOrganizationDetail ? 'COMPLETE' : website || hasChannel || hasOrganizationDetail ? 'PARTIAL' : run.status === 'FAILED' ? 'FAILED' : 'NOT_FOUND',
    evidence: projections.flatMap((projection: any) => projection.evidence || []),
    unscoped_facts: projections.flatMap((projection: any) => projection.unscoped_facts || []),
  });
}

export async function persistV1ContactOverlay(companyId: string, runId: string, overlay: unknown, durable = false) {
  const database = await getDb();
  const canonicalOverlay = normalizeV1ContactOverlay(overlay);
  if (durable) {
    await database.saveContactOverlayDurably(companyId, runId, JSON.stringify(canonicalOverlay), new Date().toISOString());
    return;
  }
  await database.run(
    `INSERT INTO v1_contact_enrichment (company_id, run_id, overlay_json, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(company_id) DO UPDATE SET run_id = excluded.run_id, overlay_json = excluded.overlay_json, updated_at = excluded.updated_at`,
    [companyId, runId, JSON.stringify(canonicalOverlay), new Date().toISOString()]
  );
}

export async function hydrateV1ContactEnrichment(): Promise<number> {
  const database = await getDb();
  const rows = await database.all('SELECT company_id, run_id, overlay_json, updated_at FROM v1_contact_enrichment');
  const { db: pharmaDb } = await import('./db');
  let hydrated = 0;
  let runIdentityById: Map<string, { company_name: string; country: string }> | undefined;
  for (const row of rows) {
    let contact = pharmaDb.getContactById(String(row.company_id || '')) as any;
    if (!contact) {
      runIdentityById ||= new Map(listV1RunIdentityHeaders().map(header => [header.id, header]));
      const header = runIdentityById.get(String(row.run_id || ''));
      const key = header ? canonicalEntityIdentityKey(header.company_name, header.country) : '';
      contact = key ? pharmaDb.companyNameIndex.get(key) as any : null;
    }
    if (!contact) continue;
    try {
      const storedOverlay = JSON.parse(String(row.overlay_json || '{}'));
      const entityKey = canonicalEntityIdentityKey(contact.company_name, contact.country);
      runIdentityById ||= new Map(listV1RunIdentityHeaders().map(header => [header.id, header]));
      const retainedIdentity = runIdentityById.get(String(row.run_id || ''));
      if (retainedIdentity && canonicalEntityIdentityKey(retainedIdentity.company_name, retainedIdentity.country) !== entityKey) {
        // Preserve recovery storage, but never attach another country's run to
        // this record or count it as that entity's completed research.
        if (contact.edgeview_v1_run_id === row.run_id) delete contact.edgeview_v1_run_id;
        contact.research_validation_status = 'needs_revalidation';
        continue;
      }
      if (storedOverlay.schema_version !== V1_OVERLAY_VERSION || storedOverlay.entity_key !== entityKey) {
        // Keep the stored overlay and immutable run intact for revalidation.
        // Never certify old policy output or another entity by loading it.
        Object.assign(contact, { edgeview_v1_run_id: row.run_id, research_validation_status: 'needs_revalidation' });
        continue;
      }
      // Normalize old persisted field aliases/shapes exactly once at the
      // storage boundary. Active UI/backend code sees only the V1 contract.
      const overlay = normalizeV1ContactOverlay(storedOverlay);
      // Startup must only hydrate the small persisted projection. Replaying
      // multi-gigabyte immutable run history here kept port 3901 offline for
      // minutes. A fresh enrichment reprojects the complete indexed history
      // and persists the current schema without blocking application launch.
      Object.assign(contact, overlay, { edgeview_v1_run_id: row.run_id, last_updated: row.updated_at, research_validation_status: 'current' });
      if (String(row.company_id || '') !== String(contact.id || '')) {
        await persistV1ContactOverlay(String(contact.id), String(row.run_id || ''), overlay);
        await database.run('DELETE FROM v1_contact_enrichment WHERE company_id = ?', [String(row.company_id || '')]);
      }
      hydrated++;
    } catch { /* corrupt overlay is isolated to one company */ }
  }
  pharmaDb.rebuildIndexes();
  return hydrated;
}

export interface CompanyResearchState {
  id: string;
  name: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  stage: string;
  error?: string;
  reuse_only?: boolean;
  durationMs?: number;
  resourceUsage: Record<ResearchProvider, number>;
  metrics?: {
    emailsFound: number;
    phonesFound: number;
    socialsFound: number;
    leadershipFound: boolean;
    websiteFound: boolean;
  };
  objectives?: Record<string, any>;
  research_trace?: any[];
  outcome?: 'COMPLETE' | 'PARTIAL' | 'NO_EVIDENCE' | 'FAILED';
}

export interface ResearchJob {
  id: string;
  status: 'PENDING' | 'DISCOVERING' | 'CRAWLING' | 'EXTRACTING' | 'VERIFYING' | 'COMPLETED' | 'FAILED' | 'PAUSED' | 'RESOURCE_LIMITED' | 'STOPPED' | 'AWAITING_AUTHORIZATION';
  importer_exporter_mode: 'importer' | 'exporter';
  total_companies: number;
  completed_companies: number;
  current_company: string;
  current_stage: string;
  company_ids: string[];
  company_states: Record<string, CompanyResearchState>;
  resource_usage: Record<ResearchProvider, number>;
  error_message?: string;
  is_pilot?: boolean;
  pilot_authorized?: boolean;
  created_at?: string;
  updated_at?: string;
}

// In-memory registry of currently active background jobs to allow graceful stopping
const activeJobs = new Set<string>();
const runningTasks = new Set<Promise<void>>();
let shuttingDown = false;
export async function stopJobsForShutdown(): Promise<void> {
  shuttingDown = true;
  activeJobs.clear(); // workers finish their current company, not the next one
  const results = await Promise.allSettled([...runningTasks]);
  if (results.some(result => result.status === 'rejected')) throw new Error('Background job did not drain cleanly');
}

export function isInternalId(name: string): boolean {
  if (!name) return true;
  const cleaned = name.trim().toLowerCase();
  if (cleaned.startsWith('id ') || cleaned.startsWith('id_') || cleaned.startsWith('comp-')) {
    return true;
  }
  if (/^comp-[a-z0-9]+$/.test(cleaned)) {
    return true;
  }
  return false;
}

export async function createJob(companyIds: string[], mode: 'importer' | 'exporter', reuseOnly = false): Promise<string> {
  if (shuttingDown) throw new Error('EdgeView is shutting down');
  const db = await getDb();
  const jobId = `job-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  
  // Fetch actual company names for the state map
  const { db: pharmaDb } = await import('./db');
  const companyStates: Record<string, CompanyResearchState> = {};
  
  for (const id of companyIds) {
    const contact = pharmaDb.getContactById(id);
    const companyName = contact ? contact.company_name : `ID ${id}`;
    const isId = isInternalId(companyName);
    const statusVal = isId ? 'failed' : 'pending';
    const stageVal = isId ? 'UNRESOLVED_COMPANY' : 'Planner';
    const errorVal = isId ? 'INVALID_INPUT / UNRESOLVED_COMPANY' : undefined;

    companyStates[id] = {
      id,
      name: companyName,
      status: statusVal,
      stage: stageVal,
      error: errorVal,
      reuse_only: reuseOnly,
      resourceUsage: emptyProviderUsage(),
    };
  }

  const job: ResearchJob = {
    id: jobId,
    status: 'PENDING',
    importer_exporter_mode: mode,
    total_companies: companyIds.length,
    completed_companies: 0,
    current_company: '',
    current_stage: '',
    company_ids: companyIds,
    company_states: companyStates,
    resource_usage: emptyProviderUsage(),
    is_pilot: false,
    pilot_authorized: false,
  };

  await db.run(
    `INSERT INTO research_jobs (
      id, status, importer_exporter_mode, total_companies, completed_companies, 
      current_company, current_stage, company_ids, company_states, resource_usage, error_message,
      is_pilot, pilot_authorized
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      job.id,
      job.status,
      job.importer_exporter_mode,
      job.total_companies,
      job.completed_companies,
      job.current_company,
      job.current_stage,
      JSON.stringify(job.company_ids),
      JSON.stringify(job.company_states),
      JSON.stringify(job.resource_usage),
      '',
      job.is_pilot ? 1 : 0,
      job.pilot_authorized ? 1 : 0,
    ]
  );
  await db.flush();

  return jobId;
}

export async function getJob(jobId: string): Promise<ResearchJob | null> {
  const db = await getDb();
  const row = await db.get(`SELECT * FROM research_jobs WHERE id = ?`, [jobId]);
  if (!row) return null;

  return {
    id: row.id,
    status: row.status as any,
    importer_exporter_mode: row.importer_exporter_mode as any,
    total_companies: row.total_companies,
    completed_companies: row.completed_companies,
    current_company: row.current_company,
    current_stage: row.current_stage,
    company_ids: JSON.parse(row.company_ids || '[]'),
    company_states: JSON.parse(row.company_states || '{}'),
    resource_usage: { ...emptyProviderUsage(), ...JSON.parse(row.resource_usage || '{}') },
    error_message: row.error_message || undefined,
    is_pilot: row.is_pilot === 1,
    pilot_authorized: row.pilot_authorized === 1,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function updateJob(jobId: string, updates: Partial<ResearchJob>, durable = false): Promise<void> {
  const db = await getDb();
  const current = await getJob(jobId);
  if (!current) return;

  const status = updates.status !== undefined ? updates.status : current.status;
  const completed_companies = updates.completed_companies !== undefined ? updates.completed_companies : current.completed_companies;
  const current_company = updates.current_company !== undefined ? updates.current_company : current.current_company;
  const current_stage = updates.current_stage !== undefined ? updates.current_stage : current.current_stage;
  const company_states = updates.company_states !== undefined ? updates.company_states : current.company_states;
  const resource_usage = updates.resource_usage !== undefined ? updates.resource_usage : current.resource_usage;
  const error_message = updates.error_message !== undefined ? updates.error_message : current.error_message;
  const is_pilot = updates.is_pilot !== undefined ? (updates.is_pilot ? 1 : 0) : (current.is_pilot ? 1 : 0);
  const pilot_authorized = updates.pilot_authorized !== undefined ? (updates.pilot_authorized ? 1 : 0) : (current.pilot_authorized ? 1 : 0);

  await db.run(
    `UPDATE research_jobs SET 
      status = ?, 
      completed_companies = ?, 
      current_company = ?, 
      current_stage = ?, 
      company_states = ?, 
      resource_usage = ?, 
      error_message = ?,
      is_pilot = ?,
      pilot_authorized = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?`,
    [
      status,
      completed_companies,
      current_company,
      current_stage,
      JSON.stringify(company_states),
      JSON.stringify(resource_usage),
      error_message || '',
      is_pilot,
      pilot_authorized,
      jobId,
    ]
  );
  if (durable) await db.flush();
}

export async function stopJob(jobId: string): Promise<void> {
  activeJobs.delete(jobId);
  await updateJob(jobId, { status: 'STOPPED' }, true);
}

export function isJobActive(jobId: string): boolean {
  return activeJobs.has(jobId);
}

export async function runJobLoop(jobId: string, forceFetch = false): Promise<boolean> {
  if (shuttingDown) return false;
  if (activeJobs.has(jobId)) return false;
  activeJobs.add(jobId);
  const job = await getJob(jobId);
  if (shuttingDown) { activeJobs.delete(jobId); return false; }
  if (!job) {
    activeJobs.delete(jobId);
    return false;
  }
  if (forceFetch && Object.values(job.company_states).some(state => state.reuse_only)) {
    activeJobs.delete(jobId); return false;
  }

  await updateJob(jobId, { status: 'PENDING' }, true);
  if (shuttingDown) { activeJobs.delete(jobId); return false; }

  // Five bounded workers improve throughput while persisted checkpoints keep
  // the job resumable after a server or browser restart.
  const task = (async () => {
    try {
      const { db: pharmaDb } = await import('./db');
      if (forceFetch) {
        job.completed_companies = 0;
        job.resource_usage = emptyProviderUsage();
        for (const state of Object.values(job.company_states)) {
          state.status = 'pending';
          state.stage = 'Queued for forced V1 re-enrichment';
          state.error = undefined;
          state.durationMs = undefined;
          state.metrics = undefined;
          state.outcome = undefined;
          state.resourceUsage = emptyProviderUsage();
        }
      }
      // Completed and failed items are both terminal for this job. Only
      // pending/interrupted work is eligible when a stopped job resumes;
      // otherwise failures are counted twice and the progress total can exceed
      // the number of requested companies.
      const pendingIds = job.company_ids.filter(companyId => {
        const status = job.company_states[companyId]?.status;
        return status === 'pending' || status === 'processing';
      });
      const permittedIds = pendingIds;
      let cursor = 0;
      const transportFailures = new OrderedFailureStreak(9);
      let pausedForTransport = false;
      let persistChain: Promise<void> = Promise.resolve();
      const checkpoint = (stage: string) => {
        persistChain = persistChain.then(() => updateJob(jobId, {
          status: 'DISCOVERING',
          completed_companies: job.completed_companies,
          current_company: job.current_company,
          current_stage: stage,
          company_states: job.company_states,
          resource_usage: job.resource_usage,
        }));
        return persistChain;
      };

      const worker = async () => {
        while (activeJobs.has(jobId)) {
          const position = cursor++;
          if (position >= permittedIds.length) return;
          const companyId = permittedIds[position];
          const companyState = job.company_states[companyId];
          const contact = pharmaDb.getContactById(companyId) as any;
          const companyName = String(contact?.company_name || companyState?.name || '').trim();
          const country = String(contact?.country || contact?.normalized_country || '').trim();
          if (!companyState) {
            const decision = transportFailures.record(position, false);
            if (decision.newlyPaused) {
              pausedForTransport = true;
              activeJobs.delete(jobId);
            }
            continue;
          }

          // Ordinary full/batch enrichment is incremental. If this exact
          // country-aware contact already points at a successful V1 run, reuse
          // the persisted projection instead of paying providers for the same
          // company again. Force Fetch is the explicit refresh override.
          if (!forceFetch && contact?.edgeview_v1_run_id) {
            const reuseStarted = performance.now();
            const cachedRun = reusableContactRun(contact);
            if (cachedRun) {
              const revalidated = contact.research_validation_status !== 'current';
              if (revalidated) {
                const projected = projectHistoricalContactFields(cachedRun);
                // Reuse retained evidence without calling providers. Persist
                // before claiming completion or replacing the live projection.
                await persistV1ContactOverlay(companyId, cachedRun.id, projected, true);
                Object.assign(contact, projected, { research_validation_status: 'current',
                  edgeview_v1_run_id: cachedRun.id, last_updated: new Date().toISOString() });
              }
              companyState.status = 'completed';
              companyState.stage = revalidated ? 'Revalidated retained V1 evidence under current company-country rules; no provider calls'
                : `Reused existing V1 ${cachedRun.status} enrichment; Force Fetch to refresh`;
              companyState.error = undefined;
              companyState.outcome = String(contact.quality_status || '').toUpperCase() === 'COMPLETE' ? 'COMPLETE' : 'PARTIAL';
              companyState.resourceUsage = emptyProviderUsage();
              companyState.metrics = {
                emailsFound: Array.isArray(contact.emails_list) ? contact.emails_list.length : contact.email ? 1 : 0,
                phonesFound: Array.isArray(contact.phones_list) ? contact.phones_list.length : contact.phone ? 1 : 0,
                socialsFound: Array.isArray(contact.socials) ? contact.socials.length : 0,
                leadershipFound: Array.isArray(contact.contact_persons) && contact.contact_persons.length > 0,
                websiteFound: Boolean(contact.website),
              };
              companyState.durationMs = Math.max(0, performance.now() - reuseStarted);
              job.current_company = companyName;
              job.current_stage = companyState.stage;
              job.completed_companies++;
              if (job.completed_companies % 5 === 0 || cursor >= permittedIds.length) await checkpoint(companyState.stage);
              continue;
            }
          }

          companyState.status = 'processing';
          companyState.stage = 'V1 query generation and deterministic retrieval';
          job.current_company = companyName;
          job.current_stage = companyState.stage;
          const startedAt = Date.now();
          let transportOutcome = false;
          try {
            if (companyState.reuse_only) throw new Error('RETAINED_EVIDENCE_UNAVAILABLE: Saved-evidence review cannot start provider requests.');
            if (!companyName || isInternalId(companyName)) throw new Error('INVALID_INPUT / UNRESOLVED_COMPANY');
            if (!country) throw new Error('Exact country is required for identity-anchored V1 enrichment');
            let run: V1Run | undefined;
            for (let attempt = 1; attempt <= 3; attempt++) {
              run = await runV1Enrichment(companyName, country, { profile: 'bulk' });
              const errors = run.timeline.map(event => String(event.error || '')).filter(Boolean);
              const transientTransportFailure = run.status === 'FAILED' && errors.length > 0
                && errors.every(message => /fetch failed|aborted|timeout|econn|enotfound|socket|network/i.test(message));
              if (!transientTransportFailure || attempt === 3) break;
              companyState.stage = `Temporary network failure; retry ${attempt + 1} of 3`;
              await new Promise(resolve => setTimeout(resolve, attempt * 2_000));
            }
            if (!run) throw new Error('V1 run did not start');
            const runErrors = run.timeline.map(event => String(event.error || '')).filter(Boolean);
            const transportFailed = run.status === 'FAILED' && runErrors.length > 0
              && runErrors.every(message => /fetch failed|aborted|timeout|econn|enotfound|socket|network/i.test(message));
            transportOutcome = transportFailed;
            const providerCounts = run.raw_records.reduce<Record<string, number>>((acc, record) => {
              acc[record.provider] = (acc[record.provider] || 0) + 1;
              return acc;
            }, {});
            companyState.resourceUsage = emptyProviderUsage();
            for (const provider of RESEARCH_PROVIDERS) companyState.resourceUsage[provider] = providerCounts[provider] || 0;
            const projected = projectHistoricalContactFields(run);
            companyState.metrics = {
              emailsFound: projected.emails_list.length,
              phonesFound: projected.phones_list.length,
              socialsFound: projected.socials.length,
              leadershipFound: projected.contact_persons.length > 0,
              websiteFound: Boolean(projected.website),
            };
            companyState.status = run.status === 'FAILED' ? 'failed' : 'completed';
            companyState.outcome = run.status === 'COMPLETED' ? 'COMPLETE' : run.status === 'PARTIAL' ? 'PARTIAL' : 'FAILED';
            companyState.stage = `V1 ${run.status}: ${run.results.length} results, ${run.raw_records.length} raw records`;
            companyState.error = run.status === 'FAILED' ? run.timeline.find(event => event.error)?.error || 'No provider results' : undefined;
            if (contact) {
              // Match interactive/cached publication: an accepted raw run does
              // not prove that the operational contact projection is durable.
              await persistV1ContactOverlay(companyId, run.id, projected, true);
              Object.assign(contact, projected, {
                research_validation_status: 'current', edgeview_v1_run_id: run.id,
                last_updated: new Date().toISOString(),
              });
              pharmaDb.rebuildIndexes();
            }
            for (const provider of RESEARCH_PROVIDERS) job.resource_usage[provider] += companyState.resourceUsage[provider] || 0;
          } catch (error: any) {
            transportOutcome = /fetch failed|aborted|timeout|econn|enotfound|socket|network/i.test(String(error?.message || error));
            companyState.status = 'failed';
            companyState.stage = 'V1 failure captured';
            companyState.error = String(error?.message || error);
            companyState.outcome = 'FAILED';
          } finally {
            const decision = transportFailures.record(position, transportOutcome);
            if (decision.newlyPaused) {
              pausedForTransport = true;
              activeJobs.delete(jobId);
              companyState.stage = `${companyState.stage}; safety pause after ${decision.streak} ordered transport failures`;
            }
            companyState.durationMs = Date.now() - startedAt;
            job.completed_companies++;
            if (job.completed_companies % 5 === 0 || cursor >= permittedIds.length) await checkpoint(companyState.stage);
          }
        }
      };

      await checkpoint('Starting bounded V1 worker pool');
      await Promise.all(Array.from({ length: Math.min(5, permittedIds.length || 1) }, () => worker()));
      await persistChain;
      if (!activeJobs.has(jobId)) {
        await updateJob(jobId, {
          status: pausedForTransport ? 'RESOURCE_LIMITED' : 'STOPPED',
          current_stage: pausedForTransport ? 'Paused after repeated network failures; remaining companies stay queued' : job.current_stage,
          error_message: pausedForTransport ? 'Repeated provider transport failures triggered an automatic safety pause.' : job.error_message,
          company_states: job.company_states,
          completed_companies: job.completed_companies,
          resource_usage: job.resource_usage,
        }, true);
      } else {
        await updateJob(jobId, { status: 'COMPLETED', current_company: '', current_stage: 'All requested companies processed', company_states: job.company_states, completed_companies: job.completed_companies, resource_usage: job.resource_usage }, true);
      }
    } catch (err: any) {
      console.error(`Fatal crash in V1 job loop for ${jobId}:`, err);
      await updateJob(jobId, { status: 'FAILED', error_message: String(err?.message || err), company_states: job.company_states, completed_companies: job.completed_companies, resource_usage: job.resource_usage }, true);
    } finally {
      activeJobs.delete(jobId);
    }
  })();
  runningTasks.add(task);
  // Preserve the existing fatal unhandled-rejection behavior if even the
  // failure checkpoint cannot be persisted; tracking must not swallow it.
  void task.finally(() => runningTasks.delete(task));
  return true;
}

export function getStatsAndProjection(job: ResearchJob, remainingCompanies: number) {
  const completed = Object.values(job.company_states).filter(s => s.status === 'completed');
  const count = completed.length;

  if (count === 0) {
    return {
      averageSerper: 0,
      averageFirecrawl: 0,
      averageNvidia: 0,
      averageGroq: 0,
      averageDurationMs: 0,
      projectedSerper: 0,
      projectedFirecrawl: 0,
      projectedNvidia: 0,
      projectedGroq: 0,
      projectedDurationMs: 0,
    };
  }

  const totals = completed.reduce((acc, curr) => {
    acc.serper += curr.resourceUsage.serper;
    acc.firecrawl += curr.resourceUsage.firecrawl;
    acc.nvidia += curr.resourceUsage.nvidia;
    acc.groq += curr.resourceUsage.groq;
    acc.durationMs += curr.durationMs || 0;
    return acc;
  }, { serper: 0, firecrawl: 0, nvidia: 0, groq: 0, durationMs: 0 });

  const avgs = {
    averageSerper: totals.serper / count,
    averageFirecrawl: totals.firecrawl / count,
    averageNvidia: totals.nvidia / count,
    averageGroq: totals.groq / count,
    averageDurationMs: totals.durationMs / count,
  };

  return {
    ...avgs,
    projectedSerper: Math.ceil(avgs.averageSerper * remainingCompanies),
    projectedFirecrawl: Math.ceil(avgs.averageFirecrawl * remainingCompanies),
    projectedNvidia: Math.ceil(avgs.averageNvidia * remainingCompanies),
    projectedGroq: Math.ceil(avgs.averageGroq * remainingCompanies),
    projectedDurationMs: Math.ceil(avgs.averageDurationMs * remainingCompanies),
  };
}

export async function initializeJobsState(): Promise<void> {
  try {
    const db = await getDb();
    const activeStatuses = ['PENDING', 'DISCOVERING', 'CRAWLING', 'EXTRACTING', 'VERIFYING'];
    const placeholders = activeStatuses.map(() => '?').join(',');
    
    const interruptedJobs = await db.all(
      `SELECT id, company_states FROM research_jobs WHERE status IN (${placeholders})`,
      activeStatuses
    );
    
    for (const job of interruptedJobs) {
      let companyStates: Record<string, CompanyResearchState> = {};
      try {
        companyStates = JSON.parse(job.company_states || '{}');
      } catch (_) {}
      
      let updated = false;
      for (const cid of Object.keys(companyStates)) {
        if (companyStates[cid].status === 'processing') {
          companyStates[cid].status = 'pending';
          companyStates[cid].stage = 'Interrupted';
          updated = true;
        }
      }
      
      if (updated) {
        await db.run(
          `UPDATE research_jobs SET status = 'PAUSED', company_states = ?, current_stage = 'Interrupted (Server restarted)' WHERE id = ?`,
          [JSON.stringify(companyStates), job.id]
        );
      } else {
        await db.run(
          `UPDATE research_jobs SET status = 'PAUSED', current_stage = 'Interrupted (Server restarted)' WHERE id = ?`,
          [job.id]
        );
      }
    }
    console.log(`[Job Manager] Initialized jobs database state successfully on startup.`);
  } catch (err: any) {
    console.error(`[Job Manager] Error initializing jobs state:`, err.message);
  }
}

export async function getJobsCountByStatus(): Promise<{ active: number; completed: number; failed: number; partial: number }> {
  try {
    const db = await getDb();
    const activeRow = await db.get(`SELECT COUNT(*) as count FROM research_jobs WHERE status IN ('PENDING', 'DISCOVERING', 'CRAWLING', 'EXTRACTING', 'VERIFYING')`);
    const completedRow = await db.get(`SELECT COUNT(*) as count FROM research_jobs WHERE status = 'COMPLETED'`);
    const failedRow = await db.get(`SELECT COUNT(*) as count FROM research_jobs WHERE status = 'FAILED'`);
    const partialRow = await db.get(`SELECT COUNT(*) as count FROM research_jobs WHERE status IN ('STOPPED', 'PAUSED', 'RESOURCE_LIMITED')`);
    return {
      active: activeRow?.count || 0,
      completed: completedRow?.count || 0,
      failed: failedRow?.count || 0,
      partial: partialRow?.count || 0,
    };
  } catch (err) {
    console.error('[Job Manager] Error counting jobs:', err);
    return { active: 0, completed: 0, failed: 0, partial: 0 };
  }
}

export async function getLatestActiveJob(): Promise<ResearchJob | null> {
  try {
    const db = await getDb();
    const row = await db.get(`
      SELECT id FROM research_jobs 
      WHERE status IN ('PENDING', 'DISCOVERING', 'CRAWLING', 'EXTRACTING', 'VERIFYING')
      ORDER BY updated_at DESC LIMIT 1
    `);
    if (row && row.id) {
      return getJob(row.id);
    }
  } catch (err) {
    console.error('[Job Manager] Error getting latest active job:', err);
  }
  return null;
}
