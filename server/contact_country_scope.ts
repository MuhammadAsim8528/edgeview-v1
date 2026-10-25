import { detectExplicitCountryNames, normalizeCountryName } from '../src/utils/countryNormalizer';

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

/** Explicit evidence guard, not a complete entity resolver. Unknown country
 * stays explicit so legacy admission is distinguishable from local proof. */
export function contactFactScope(source: Source, value: string, country: string, field?: string) {
  const sought = value.toLowerCase().replace(/\s+/g, ' ').trim();
  const contains = (text: string) => text.toLowerCase().replace(/\s+/g, ' ').includes(sought);
  const structured = [...String(source.html || '').matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].map(match => match[1]).join('\n');
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
