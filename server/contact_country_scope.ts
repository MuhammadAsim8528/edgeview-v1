import { detectExplicitCountryNames, normalizeCountryName, normalizeCountryExact } from '../src/utils/countryNormalizer';

type Source = { id: string; status?: string; url: string; title?: string; snippet?: string;
  text?: string; markdown?: string; html?: string; links?: string[] };
export type ContactFactScope = 'local' | 'foreign' | 'ambiguous' | 'related_entity' | 'unknown';

function visible(value: string) {
  return value.replace(/<!--[^]*?-->/g, ' ').replace(/<(?:script|style)\b[\s\S]*?<\/(?:script|style)>/gi, ' ')
    .replace(/<(?:br|\/p|\/div|\/section|\/article|\/li|\/h[1-6]|\/tr)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/gi, ' ').replace(/&amp;/gi, '&');
}
function countryScope(text: string, country: string): ContactFactScope {
  const prose = text.replace(/\bhttps?:\/\/\S+/gi, ' ').replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, ' ');
  const countries = detectExplicitCountryNames(prose).map(value => normalizeCountryName(value).toLowerCase());
  if (!countries.length) return 'unknown';
  if (countries.length > 1) return 'ambiguous';
  return countries[0] === normalizeCountryName(country).toLowerCase() ? 'local' : 'foreign';
}

/** Country codes are meaningful in addressCountry, never in arbitrary prose.
 * Walk structured office objects independently: a graph sibling or visible nav
 * cannot supply another object's location. No @id/reference inference here.
 */
function structuredScope(scripts: string[], sought: string, country: string) {
  const matches: Array<{ scope: ContactFactScope; raw: string; hint: string }> = [];
  let nodes = 0;
  const includes = (value: string) => value.toLowerCase().replace(/\s+/g, ' ').includes(sought);
  const quote = (raw: string, hint: string) => {
    const at = raw.toLowerCase().indexOf(hint.toLowerCase());
    return at < 0 ? '' : raw.slice(Math.max(0, at - 512), Math.max(0, at - 512) + 4096);
  };
  const countryValue = (value: unknown): string => {
    const raw = typeof value === 'string' ? value : value && typeof value === 'object' ? (value as any).name : '';
    if (typeof raw !== 'string') return '';
    const normalized = normalizeCountryExact(raw);
    return detectExplicitCountryNames(normalized).find(name => name.toLowerCase() === normalized.toLowerCase()) || '';
  };
  const visit = (node: unknown, inherited: ContactFactScope, raw: string, depth: number): void => {
    if (++nodes > 2048 || depth > 24 || node === null) return;
    if (typeof node === 'string') {
      if (includes(node)) matches.push({ scope: inherited, raw, hint: node });
      return;
    }
    if (typeof node !== 'object') return;
    if (Array.isArray(node)) { for (const child of node) { if (nodes >= 2048) break; visit(child, inherited, raw, depth + 1); } return; }
    const object = node as Record<string, any>;
    let scope = inherited;
    const address = object.address ?? object.location?.address;
    if (inherited !== 'related_entity' && (Object.hasOwn(object, 'addressCountry') || address !== undefined)) {
      const locations = Array.isArray(address) ? address : address ? [address] : [];
      const values = [object.addressCountry, ...locations.flatMap(item => typeof item === 'string'
        ? detectExplicitCountryNames(item) : [item?.addressCountry])].filter(value => value !== undefined);
      const countries = [...new Set(values.map(countryValue).filter(Boolean))];
      scope = countries.length > 1 ? 'ambiguous' : countries.length === 1
        ? countries[0].toLowerCase() === normalizeCountryName(country).toLowerCase() ? 'local' : 'foreign' : 'unknown';
    }
    const combinedAddress = [object.streetAddress, object.addressLocality, object.addressRegion, object.postalCode,
      object.addressCountry?.name || object.addressCountry].filter(value => typeof value === 'string').join(', ');
    if (combinedAddress && includes(combinedAddress)) matches.push({ scope, raw, hint: String(object.streetAddress || object.addressLocality || combinedAddress) });
    for (const [key, child] of Object.entries(object)) {
      if (nodes >= 2048) break;
      if (['@context', '@id', '@type', 'nationality', 'areaServed'].includes(key)) continue;
      const related = /^(?:distributors?|partners?|agents?|suppliers?|parentOrganization)$/i.test(key);
      visit(child, related ? 'related_entity' : scope, raw, depth + 1);
    }
  };
  for (const raw of scripts.slice(0, 32)) {
    if (raw.length > 256 * 1024 || nodes > 2048) break;
    try { visit(JSON.parse(raw), 'unknown', raw, 0); } catch { /* raw malformed evidence remains retained */ }
  }
  const chosen = matches.find(match => match.scope === 'local') || matches.find(match => match.scope !== 'unknown') || matches[0];
  return chosen ? { scope: chosen.scope, quote: quote(chosen.raw, chosen.hint) } : undefined;
}

/** Explicit evidence guard, not a complete entity resolver. Unknown country
 * stays explicit so legacy admission is distinguishable from local proof. */
export function contactFactScope(source: Source, value: string, country: string, field?: string) {
  const sought = value.toLowerCase().replace(/\s+/g, ' ').trim();
  const contains = (text: string) => text.toLowerCase().replace(/\s+/g, ' ').includes(sought);
  const scripts = [...String(source.html || '').matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].map(match => match[1]);
  const structured = scripts.join('\n');
  const visibleHtml = visible(source.html || '');
  if (sought && scripts.length && !contains(visibleHtml)) {
    const scoped = structuredScope(scripts, sought, country);
    if (scoped) return scoped;
    // Malformed, unsupported or over-budget structured-only facts cannot borrow
    // the country of navigation or a different office from another carrier.
    const otherHtml = String(source.html || '').replace(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi, '');
    if (contains(structured) || (!contains(otherHtml) && !contains(source.text || '') && !contains(source.markdown || ''))) {
      return { scope: 'unknown' as const, quote: '' };
    }
  }
  const htmlContext = `${visible(source.html || '')}\n${structured}`;
  // Use the representation actually carrying the value: a short provider text
  // summary must not confer Kenyan scope on a Pakistan-only HTML contact.
  // Direct retrieval may flatten every office into one text line. Prefer the
  // full HTML's visible block boundaries when they actually carry this fact.
  const body = source.html && contains(htmlContext) ? htmlContext
    : source.text && contains(source.text) ? source.text
    : source.markdown && contains(source.markdown) ? source.markdown
    : source.html && contains(source.html) ? htmlContext
    : source.text || source.markdown || htmlContext.trim() || `${source.title || ''}\n${source.snippet || ''}`;
  // A person's given name may itself be a country (Jordan, Chad, Georgia).
  // Mask only this exact person value when reading location context; do not
  // remove actual office country labels elsewhere in the same source.
  const personName = field === 'leader' && value.trim()
    ? new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'giu') : null;
  const contextualScope = (text: string) => countryScope(personName ? text.replace(personName, ' ') : text, country);
  const whole = contextualScope(body);
  const valueScope = field === 'leader' ? 'unknown' : countryScope(value, country);
  if (valueScope === 'foreign') return { scope: 'foreign' as const, quote: value };
  let active: ContactFactScope = whole;
  let relatedEntity = false;
  const matches: Array<{ scope: ContactFactScope; quote: string }> = [];
  for (const rawLine of body.split(/\r?\n/)) {
    const line = rawLine.replace(/\s+/g, ' ').trim();
    if (!line) continue;
    const lineScope = contextualScope(line);
    if (lineScope !== 'unknown') active = lineScope;
    // A named distributor/partner contact is not automatically the company.
    // This does not reject an entity merely because it is itself a distributor.
    if (/\b(?:distributor|partner|agent|supplier)\s*[:=]/i.test(line)) relatedEntity = true;
    if (relatedEntity) active = 'related_entity';
    if (sought && line.toLowerCase().includes(sought)) matches.push({ scope: active, quote: line });
  }
  if (matches.some(match => match.scope === 'local')) return matches.find(match => match.scope === 'local')!;
  if (matches.length) return matches.find(match => match.scope !== 'unknown') || matches[0];
  // Structured addresses can combine several JSON fields and need not appear
  // as one contiguous string. An explicitly foreign value still failed above.
  return { scope: valueScope === 'local' && whole !== 'foreign' ? 'local' as const : whole,
    quote: contains(body) ? value : '' };
}

export function countryScopedFactSources(results: Source[], value: string, country: string, sourceUrl?: string, field?: string) {
  return results.filter(source => source.status === 'success' && (!sourceUrl || source.url === sourceUrl))
    .filter(source => {
      const content = `${source.text || ''}\n${source.markdown || ''}\n${source.html || ''}\n${source.snippet || ''}`.toLowerCase();
      return content.includes(value.toLowerCase()) || Boolean(source.links?.some(link => link.replace(/\/$/, '') === value.replace(/\/$/, '')));
    }).map(source => ({ source_result_id: source.id, source_url: source.url, ...contactFactScope(source, value, country, field) }));
}
