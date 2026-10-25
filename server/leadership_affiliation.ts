import { canonicalCompanyIdentityKey } from './company_identity';
import { detectExplicitCountryNames, interpretExplicitCountryCode, normalizeCountryExact, normalizeCountryName } from '../src/utils/countryNormalizer';

type Source = { id: string; url: string; title?: string; html?: string; text?: string };
export type HeadquartersEvidence = { source_result_id: string; source_url: string; quote: string };
const legal = new Set(['m', 's', 'ms', 'the', 'and', 'co', 'company', 'private', 'pvt', 'limited', 'ltd', 'inc', 'llc', 'plc']);
function words(value: string) {
  return canonicalCompanyIdentityKey(value).split(' ').filter(word => word && !legal.has(word))
    .map(word => /^pharmaceuticals?$/.test(word) ? 'pharma' : word);
}
const plain = (value: string) => value.replace(/<!--[^]*?-->/g, ' ').replace(/<(?:script|style|nav)\b[\s\S]*?<\/(?:script|style|nav)>/gi, ' ')
  .replace(/&nbsp;|&#160;/gi, ' ').replace(/&amp;/gi, '&').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

export function managementPublisherMatches(source: Source, companyName: string): boolean {
  const target = words(companyName);
  const title = source.html?.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  const publisher = words(plain(title || source.title || ''));
  return target.length >= 2 && target.every(word => publisher.includes(word));
}

/** This proves affiliation with a locally headquartered company, not the
 * person's residence/nationality. Absence of a foreign word alone is not proof.
 */
export function localHeadquartersEvidence(pages: Source[], addresses: string[], companyName: string, country: string): HeadquartersEvidence | undefined {
  const target = normalizeCountryName(country).toLowerCase();
  if (!target) return;
  for (const address of addresses) {
    const countries = detectExplicitCountryNames(address);
    const suffix = interpretExplicitCountryCode(address.split(',').at(-1)?.trim());
    if (suffix) countries.push(suffix);
    if (countries.some(value => normalizeCountryName(value).toLowerCase() !== target)) return;
  }
  const matches: HeadquartersEvidence[] = [];
  for (const page of pages) {
    if (!page.id || !page.url || !page.html || !managementPublisherMatches(page, companyName)) continue;
    const carrier = String(page.html || page.text || '').replace(/<!--[^]*?-->/g, ' ')
      .replace(/<(?:script|style|nav)\b[\s\S]*?<\/(?:script|style|nav)>/gi, ' ')
      .replace(/<(?:br|\/p|\/div|\/section|\/article|\/li|\/h[1-6])\b[^>]*>/gi, '\n');
    const lines = carrier.split(/\r?\n/).map(plain).filter(Boolean);
    for (let index = 0; index < lines.length; index++) {
      if (!/^(?:head\s*office|headquarters|registered\s*office)\s*[:–—-]?\s*$/i.test(lines[index])) continue;
      const block = [lines[index]];
      for (const line of lines.slice(index + 1, index + 6)) {
        if (/^(?:support|tel(?:ephone)?|fax|office hours|corporate office|regulatory|registered office|head office|copyright)\b/i.test(line)) break;
        block.push(line);
      }
      const quote = block.join(' ').slice(0, 800);
      const countries = detectExplicitCountryNames(quote);
      if (!countries.length || !/\d/.test(quote)) continue;
      if (countries.some(value => normalizeCountryName(value).toLowerCase() !== target)) return;
      matches.push({ source_result_id: page.id, source_url: page.url, quote });
    }
  }
  return matches[0];
}

export function relatedLeadershipEmployer(role: string, companyName: string, country: string): boolean {
  const target = words(companyName);
  const countryWords = new Set(words(normalizeCountryName(country)));
  for (const match of role.matchAll(/\(([^)]+)\)/g)) {
    const qualifier = words(match[1]).filter(word => !countryWords.has(word));
    // A branded qualifier such as "Scopeanchor Healthcare" is not silently
    // treated as "Scopeanchor Pharmaceuticals". Department-only qualifiers do
    // not identify a different employer, nor does a shared domain prove sameness.
    const explicitlyNamedEmployer = /\b(?:ltd|limited|llc|inc|plc|corporation|corp|company)\b/i.test(match[1]);
    if ((explicitlyNamedEmployer || qualifier.some(word => target.includes(word)))
      && (!target.every(word => qualifier.includes(word)) || !qualifier.every(word => target.includes(word)))) return true;
  }
  return false;
}

export function foreignCurrentLeadershipLocation(role: string, cardText: string, country: string): boolean {
  const target = normalizeCountryName(country).toLowerCase();
  const contexts = [role];
  const markers = [...cardText.matchAll(/\b(?:currently\s+)?(?:based|located|resides?)\s+in\s+/gi)];
  for (const [index, match] of markers.entries()) {
    const prefix = cardText.slice(Math.max(0, match.index - 48), match.index);
    if (!/^currently\b/i.test(match[0]) && /\b(?:previously|formerly|was|were|had been|used to be|once)\s+(?:\w+\s+){0,2}$/i.test(prefix)) continue;
    const start = match.index + match[0].length;
    contexts.push(cardText.slice(start, Math.min(start + 120, markers[index + 1]?.index ?? cardText.length)).split(/[.!?\n;]/)[0]);
  }
  return contexts.some(context => detectExplicitCountryNames(context).some(value => normalizeCountryName(value).toLowerCase() !== target));
}

export function foreignManagementSection(headings: string[], companyName: string, personName: string, country: string): boolean {
  const target = normalizeCountryName(country).toLowerCase();
  return headings.some(heading => {
    const tokens = canonicalCompanyIdentityKey(heading).split(' ').map(word => /^pharmaceuticals?$/.test(word) ? 'pharma' : word);
    for (const name of [words(companyName), canonicalCompanyIdentityKey(personName).split(' ')]) {
      const at = tokens.findIndex((_, index) => name.length > 0 && name.every((word, offset) => tokens[index + offset] === word));
      if (at >= 0) tokens.splice(at, name.length);
    }
    const context = tokens.join(' ');
    const exact = normalizeCountryExact(context);
    const exactCountries = detectExplicitCountryNames(exact).filter(value => value.toLowerCase() === exact.toLowerCase());
    const countries = exactCountries.length ? exactCountries : /\b(?:office|branch|team|country|regional|headquarters|management|leadership|operations)\b/i.test(context)
      ? [...detectExplicitCountryNames(context), ...detectExplicitCountryNames(normalizeCountryExact(tokens[0]))] : [];
    return countries.some(value => normalizeCountryName(value).toLowerCase() !== target);
  });
}
