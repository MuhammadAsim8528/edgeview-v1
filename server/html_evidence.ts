/** Keep the original response separately; these are evidence-carrier projections,
 * not an HTML sanitizer or a claim to model every CSS/DOM visibility rule. */
export function stripHtmlComments(html: string): string {
  // Skip quoted tag attributes and raw script/style bodies: their literal
  // "<!--" strings do not begin an HTML comment in browser parsing.
  return html.replace(/<(script|style)\b(?:[^"'<>]|"[^"]*"|'[^']*')*>[\s\S]*?<\/\1\s*>|<!--[\s\S]*?(?:-->|$)|<(?:[^"'<>]|"[^"]*"|'[^']*')+>/gi,
    token => token.startsWith('<!--') ? ' ' : token);
}

export function visibleHtmlText(html: string): string {
  return stripHtmlComments(html).replace(/<(?:script|style)\b[\s\S]*?<\/(?:script|style)>/gi, ' ')
    .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Old captures may contain a flattened text copy of hidden markup. That copy
 * cannot rehabilitate a value carried only by a comment/script/style in HTML.
 * Supported JSON-LD is retained for the existing structured-evidence validator. */
export function hiddenOnlyHtmlCarrier(html: string, value: string): boolean {
  const key = value.toLowerCase().replace(/\s+/g, ' ').trim();
  if (!html || !key) return false;
  const contains = (text: string) => text.toLowerCase().replace(/\s+/g, ' ').includes(key);
  if (!contains(html)) return false;
  const permitted = stripHtmlComments(html).replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,
    block => /^<script\b[^>]*\btype\s*=\s*["']application\/ld\+json["']/i.test(block) ? block : ' ');
  return !contains(permitted);
}
