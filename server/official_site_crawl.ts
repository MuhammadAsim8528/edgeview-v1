export interface CapturedOfficialPage { url: string; links: string[]; html?: string }

const priority = (text: string) => /management|leadership|team|board|director|executive|contact/i.test(text) ? 4 : /about|company/i.test(text) ? 2 : 0;

/** Infer a bounded CMS suffix only from the already-resolved publisher's URLs. */
export function officialPageFallbackUrls(domain: string, observedUrls: string[]): string[] {
  const extensions = new Set<string>();
  for (const value of observedUrls) {
    try {
      const url = new URL(value);
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password
        || (url.hostname !== domain && !url.hostname.endsWith(`.${domain}`))) continue;
      const extension = url.pathname.match(/\.(php|aspx?|html?)$/i)?.[1]?.toLowerCase();
      if (extension && extensions.size < 2) extensions.add(extension);
    } catch { /* Invalid search hints do not become routes. */ }
  }
  const contact = ['/contact', '/contact-us'];
  return [...[...extensions].flatMap(extension => contact.map(route => `https://${domain}${route}.${extension}`)),
    ...[...contact, '/management', '/management-team', '/corporate-management', '/leadership', '/our-team', '/team',
      '/board-of-directors', '/about', '/about-us'].map(route => `https://${domain}${route}`)];
}

/** Bounded discovery, not a URL safety bypass: capture still owns DNS/redirect checks. */
export async function crawlOfficialPages<T extends CapturedOfficialPage>(
  domain: string, budget: number, seeds: T[], initialUrls: string[], capture: (url: string, rank: number) => Promise<T>,
): Promise<T[]> {
  const origin = `https://${domain}`;
  const visited = new Set<string>();
  const queue = new Map<string, number>();
  const captured: T[] = [];
  const enqueue = (input: string, base: string, label = '', discovered = false) => {
    try {
      const url = new URL(input.replace(/&amp;/gi, '&'), base);
      const host = url.hostname.toLowerCase();
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || (host !== domain && !host.endsWith(`.${domain}`))) return;
      if (/\.(css|js|mjs|json|xml|png|jpe?g|gif|webp|svg|ico|woff2?|ttf|eot|pdf|zip)$/i.test(url.pathname)) return;
      url.hash = '';
      const key = url.toString();
      if (visited.has(key)) return;
      const relevance = priority(`${url.pathname} ${label}`);
      const score = relevance + (discovered && relevance > 0 ? 10 : 0);
      if (queue.size < 500 || queue.has(key)) queue.set(key, Math.max(queue.get(key) ?? 0, score));
    } catch { /* Invalid link remains in raw page evidence, not the fetch queue. */ }
  };
  const discover = (page: T) => {
    for (const link of page.links.slice(0, 500)) enqueue(link, page.url, '', true);
    // Anchor labels identify opaque CMS routes such as /index.php?page=42.
    for (const match of (page.html || '').matchAll(/<a\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a\s*>/gi)) {
      const label = match[2].replace(/<[^>]*>/g, ' ');
      if (priority(label)) enqueue(match[1], page.url, label, true);
    }
  };
  for (const page of seeds) { try { visited.add(new URL(page.url).toString()); } catch {} }
  for (const url of initialUrls) enqueue(url, origin);
  for (const page of seeds) discover(page);
  const fetchPage = async (url: string) => {
    visited.add(url); queue.delete(url);
    const page = await capture(url, captured.length + 1);
    captured.push(page); discover(page);
  };
  const home = new URL(origin).toString();
  if (budget > 0 && !visited.has(home)) await fetchPage(home);
  while (captured.length < budget && queue.size) {
    const next = [...queue].sort((a, b) => b[1] - a[1])[0][0];
    await fetchPage(next);
  }
  return captured;
}
