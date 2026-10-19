/**
 * Evidence-preserving page content handling.
 *
 * Replaces destructive fixed-character prefix truncation ("keep the first
 * 5k/6k characters") with:
 *
 *   1. Full preservation of complete page content up to a safe processing size.
 *   2. For larger pages: semantic assembly that keeps the title/hero, every
 *      important section (leadership, management, team, contact, location,
 *      branch, import/export/sales/procurement), the useful link manifest, and
 *      as much of the remaining content as the safe limit allows — never a
 *      blind "first N characters" slice, and never silent.
 */

/** Pages at or below this size are preserved in full. */
export const PAGE_SAFE_CHAR_LIMIT = 60_000;

function decodeHtmlAttribute(value: string): string {
  return String(value || '')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#(?:0*39|x0*27);/gi, "'")
    .replace(/&#(\d+);/g, (_match, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, code) => String.fromCharCode(parseInt(code, 16)));
}

/**
 * Converts directly fetched HTML to evidence text without destroying its link
 * graph. Anchors become Markdown links before the remaining tags are removed,
 * allowing bounded official-site discovery to inspect navigation/footer links.
 */
export function htmlToEvidenceText(html: string): string {
  const source = String(html || '');
  if (!source.trim()) return '';

  const navigationLinks: string[] = [];
  const seenLinks = new Set<string>();

  const withLinks = source
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
    .replace(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi, (_match, attributes, innerHtml) => {
      const hrefMatch = String(attributes || '').match(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
      const href = decodeHtmlAttribute(hrefMatch?.[1] || hrefMatch?.[2] || hrefMatch?.[3] || '').trim();
      const label = String(innerHtml || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() || href;
      const markdown = href ? `[${label}](${href})` : '';
      if (markdown && !seenLinks.has(markdown.toLowerCase())) {
        seenLinks.add(markdown.toLowerCase());
        navigationLinks.push(markdown);
      }
      return href ? ` ${markdown} ` : ` ${label} `;
    })
    .replace(/<\/(?:tr|li|p|div|section|article|h[1-6])\s*>/gi, '\n')
    .replace(/<\/?(?:td|th)\b[^>]*>/gi, ' | ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/[\t ]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n');

  const manifest = navigationLinks.length > 0 ? `Navigation links:\n${navigationLinks.join('\n')}\n\n` : '';
  return preservePageContent(manifest + withLinks);
}

/** Returns a bounded Markdown manifest of all HTML anchors, including relatives. */
export function extractHtmlLinkManifest(html: string): string {
  const source = String(html || '');
  const links: string[] = [];
  const seen = new Set<string>();
  const anchorRegex = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = anchorRegex.exec(source)) !== null && links.length < 500) {
    const hrefMatch = String(match[1] || '').match(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
    const href = decodeHtmlAttribute(hrefMatch?.[1] || hrefMatch?.[2] || hrefMatch?.[3] || '').trim();
    if (!href) continue;
    const label = String(match[2] || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() || href;
    const markdown = `[${label}](${href})`;
    const key = markdown.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    links.push(markdown);
  }
  return links.length > 0 ? `Navigation links:\n${links.join('\n')}` : '';
}

/** Combines scraper text with direct HTML evidence without exceeding the page budget. */
export function mergeScrapedAndDirectEvidence(scrapedText: string, directHtml: string): string {
  const scraped = String(scrapedText || '').trim();
  const direct = htmlToEvidenceText(directHtml);
  if (!scraped) return direct;
  if (!direct) return preservePageContent(scraped);
  return preservePageContent(`${scraped}\n\n[EdgeView direct retrieval complement]\n${direct}`);
}

/** Narrow a structured multi-country directory to the requested country. */
export function focusEvidenceForTargetCountry(content: string, country?: string, url?: string): string {
  const text = String(content || '').trim();
  const target = String(country || '').trim();
  if (!text || !target) return text;
  const path = String(url || '').toLowerCase();
  if (!/(?:worldwide|\/locations\/?(?:[?#].*)?$)/i.test(path)) return text;

  const escaped = target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const heading = new RegExp(`^#{1,3}\\s+${escaped}\\s*$`, 'i');
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((line) => heading.test(line.trim()));
  if (start < 0) {
    // Some scraper renderings flatten accordion headings but retain each
    // country as a short paragraph/link block. Keep only bounded blocks that
    // explicitly name the target; discard giant navigation manifests.
    const word = new RegExp(`\\b${escaped}\\b`, 'i');
    const slug = target.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const matchingBlocks = text
      .split(/\n\s*\n/)
      .map((block) => block.trim())
      .filter((block) => block.length > 0 && block.length <= 2_000)
      .filter((block) => word.test(block) || (slug && block.toLowerCase().includes(`/locations/${slug}`)));
    return matchingBlocks.length > 0
      ? `[EdgeView target-country blocks retained from multi-country directory: ${target}]\n${matchingBlocks.join('\n\n')}`
      : text;
  }

  let end = lines.length;
  for (let index = start + 1; index < lines.length; index++) {
    if (/^#{1,3}\s+\S/.test(lines[index].trim())) {
      end = index;
      break;
    }
  }
  const section = lines.slice(start, end).join('\n').trim();
  return section
    ? `[EdgeView target-country section retained from multi-country directory: ${target}]\n${section}`
    : text;
}

const PRIORITY_SECTION_RE =
  /(leadership|management\s*team|management|managing\s*director|chief\s*executive|ceo|president|chairman|director|board\s*(of)?\s*directors|executives?|our\s*people|our\s*team|key\s*people|team\s*members|meet\s*the\s*team|contact\s*us|contact|get\s*in\s*touch|location|locations|branch|branches|head\s*office|corporate\s*office|registered\s*office|import|exports?|export\s*manager|export\s*director|import\s*manager|sales|procurement|supply|purchasing|marketing|linkedin)/i;

const USEFUL_LINK_RE = /(https?:\/\/[^\s"'<>()]+|mailto:[^\s"'<>()]+)/gi;
const LINKEDIN_MAILTO_RE = /(linkedin\.com|mailto:)/i;

/** Splits markdown/plain text into blocks separated by blank lines. */
function splitBlocks(text: string): string[] {
  const blocks: string[] = [];
  let current: string[] = [];
  for (const line of String(text || '').split('\n')) {
    if (/^\s*$/.test(line)) {
      if (current.length) {
        blocks.push(current.join('\n'));
        current = [];
      }
      continue;
    }
    current.push(line);
  }
  if (current.length) blocks.push(current.join('\n'));
  return blocks;
}

function isImportantBlock(block: string): boolean {
  const probe = String(block || '').slice(0, 500);
  return PRIORITY_SECTION_RE.test(probe);
}

/** Collects every useful link (http/https and mailto) found in the page. */
export function collectUsefulLinks(markdown: string): string[] {
  const links: string[] = [];
  const seen = new Set<string>();
  const matches = String(markdown || '').match(USEFUL_LINK_RE) || [];
  for (const raw of matches) {
    const url = raw.replace(/[)\]}>]+$/, '').trim();
    if (!url) continue;
    const clean = url.toLowerCase();
    if (clean.startsWith('mailto:') || clean.includes('linkedin.com')) {
      if (!seen.has(clean)) {
        seen.add(clean);
        links.push(url);
      }
    }
  }
  return links;
}

/**
 * Returns page content that maximizes retained information:
 *  - unchanged when within the safe limit;
 *  - otherwise head + all important sections + remaining blocks (in order)
 *    within the safe limit, with preserved useful links and a visible marker.
 */
export function preservePageContent(markdown: string): string {
  const text = String(markdown || '').trim();
  if (!text) return '';
  if (text.length <= PAGE_SAFE_CHAR_LIMIT) return text;

  const blocks = splitBlocks(text);
  const important: string[] = [];
  const rest: string[] = [];
  for (const b of blocks) {
    if (isImportantBlock(b)) important.push(b);
    else rest.push(b);
  }

  const head = text.slice(0, 2000);
  const parts: string[] = [head];
  for (const b of important) parts.push(b);
  for (const b of rest) parts.push(b);

  let assembled = parts.join('\n\n');
  let truncated = assembled.length > PAGE_SAFE_CHAR_LIMIT;
  if (truncated) assembled = assembled.slice(0, PAGE_SAFE_CHAR_LIMIT);

  // Useful links are appended AFTER the cap so they can never be silently cut.
  const links = collectUsefulLinks(text);
  if (links.length > 0) {
    const missingLinks = links.filter((u) => !assembled.includes(u));
    if (missingLinks.length > 0) {
      const manifest = '\n\nUseful links:\n' + missingLinks.join('\n');
      const bodyBudget = Math.max(0, PAGE_SAFE_CHAR_LIMIT - manifest.length);
      assembled = assembled.slice(0, bodyBudget) + manifest;
    }
  }

  if (truncated) {
    const marker = `\n\n[EdgeView: page exceeded the safe processing size (${PAGE_SAFE_CHAR_LIMIT} chars) and was reduced by retaining important sections first. Full page length: ${text.length} chars.]`;
    assembled = assembled.slice(0, PAGE_SAFE_CHAR_LIMIT) + marker;
  }

  return assembled.trim();
}

/** True when the content is the "blocked by scraper" metadata placeholder. */
export function isBlockedPlaceholder(content: string): boolean {
  return String(content || '').startsWith('Discovered metadata evidence reference');
}

export { LINKEDIN_MAILTO_RE };
