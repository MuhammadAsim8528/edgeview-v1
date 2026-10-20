/** Routes whose writes require the operational store, before parsers/providers.
 * Read-only recovery exports, evidence, settings and diagnostics are not blocked.
 * Stopping a job must still clear its scheduling flag if persistence is broken.
 */
export function requiresOperationalDatabase(method: string, pathname: string): boolean {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase())) return false;
  const path = pathname.toLowerCase().replace(/\/+$/, '') || '/';
  if (method.toUpperCase() === 'POST' && /^\/api\/enrich\/job\/[^/]+\/stop$/.test(path)) return false;
  return /^\/api\/(?:enrich|files)(?:\/|$)/.test(path)
    || ['/api/upload', '/upload', '/files/upload', '/api/stats/save-to-history'].includes(path);
}
