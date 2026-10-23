import dns from 'dns/promises';
import net from 'net';
import http from 'node:http';
import https from 'node:https';

export function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split('.').map((p) => parseInt(p, 10));
  if (parts.length !== 4 || parts.some((p) => isNaN(p))) return false;
  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 192 && b === 0) ||
    a >= 224
  );
}

export function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower.startsWith('::1') || lower === '::') return true;
  const firstHextet = parseInt(lower.split(':')[0] || '0', 16);
  if (firstHextet >= 0xfe80 && firstHextet <= 0xfebf) return true;
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true;
  if (lower.startsWith('ff')) return true;
  const mappedHextets = lower.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (mappedHextets) {
    const hex = mappedHextets[1].padStart(4, '0') + mappedHextets[2].padStart(4, '0');
    const num = parseInt(hex, 16);
    const v4 = `${(num >>> 24) & 255}.${(num >>> 16) & 255}.${(num >>> 8) & 255}.${num & 255}`;
    return isPrivateIPv4(v4);
  }
  const mappedDotted = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mappedDotted) {
    return isPrivateIPv4(mappedDotted[1]);
  }
  return false;
}

function stripBrackets(host: string): string {
  let h = host.trim().toLowerCase();
  if (h.startsWith('[') && h.endsWith(']')) h = h.slice(1, -1);
  return h;
}

export function isSafeExternalUrl(urlStr: string): boolean {
  if (!urlStr || typeof urlStr !== 'string') return false;
  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }
    if (parsed.username || parsed.password) return false;
    let host = stripBrackets(parsed.hostname);
    if (!host) return false;

    if (net.isIPv6(host)) {
      if (isPrivateIPv6(host)) return false;
      return true;
    }

    if (host.endsWith('.')) host = host.slice(0, -1);

    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '::1' ||
      host === '0.0.0.0' ||
      host.endsWith('.local') ||
      host.endsWith('.internal') ||
      host.endsWith('.lan') ||
      host.endsWith('.localhost') ||
      /^169\.254\./.test(host) ||
      /^100\.(6[4-9]|[7-9][0-9]|1[01][0-9]|12[0-7])\./.test(host) ||
      host.startsWith('10.') ||
      host.startsWith('192.168.') ||
      host.startsWith('127.') ||
      /^172\.(1[6-9]|2[0-9]|3[01])\./.test(host)
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

async function resolveSafeOutboundAddress(urlStr: string): Promise<{ address: string; family: number }> {
  if (!isSafeExternalUrl(urlStr)) {
    throw new Error('Blocked: URL is not a safe external http(s) address (SSRF guard)');
  }
  const parsed = new URL(urlStr);
  let host = stripBrackets(parsed.hostname);
  if (host.endsWith('.')) host = host.slice(0, -1);

  if (net.isIPv4(host)) {
    if (isPrivateIPv4(host)) throw new Error('Blocked: URL resolves to a private IPv4 address');
    return { address: host, family: 4 };
  }
  if (net.isIPv6(host)) {
    if (isPrivateIPv6(host)) throw new Error('Blocked: URL resolves to a private IPv6 address');
    return { address: host, family: 6 };
  }

  let addresses;
  try {
    addresses = await dns.lookup(host, { all: true, verbatim: true });
  } catch {
    throw new Error('Blocked: could not resolve URL hostname (SSRF guard)');
  }
  if (!addresses.length) throw new Error('Blocked: could not resolve URL hostname (SSRF guard)');
  for (const addr of addresses) {
    if (!net.isIP(addr.address)) throw new Error('Blocked: invalid DNS address (SSRF guard)');
    if (net.isIPv4(addr.address) && isPrivateIPv4(addr.address)) {
      throw new Error('Blocked: URL hostname resolves to a private IPv4 address');
    }
    if (net.isIPv6(addr.address) && isPrivateIPv6(addr.address)) {
      throw new Error('Blocked: URL hostname resolves to a private IPv6 address');
    }
  }
  return addresses[0];
}

export async function assertSafeOutboundUrl(urlStr: string): Promise<void> {
  await resolveSafeOutboundAddress(urlStr);
}

/**
 * Executes a network fetch with SSRF validation on the initial URL AND all redirect targets (manual redirect handling).
 */
export async function safeFetchOutboundUrl(
  urlStr: string,
  options: RequestInit = {},
  maxRedirects = 5
): Promise<Response> {
  // No production caller needs a streaming or non-GET variant. Reuse the
  // pinned, bounded capture rather than validating DNS then resolving again.
  return (await safeFetchOutboundText(urlStr, { ...options, maxRedirects, timeoutMs: 20_000 })).response;
}

export const DEFAULT_EXTERNAL_PAGE_MAX_BYTES = 2 * 1024 * 1024;

export interface SafeOutboundTextResult {
  response: Response;
  text: string;
}

export function appendBoundedResponseChunk(chunks: Buffer[], chunk: Buffer, bytesRead: number, maxBytes: number): number {
  const next = bytesRead + chunk.length;
  if (next > maxBytes) throw new Error('RETRIEVAL_BODY_LIMIT_EXCEEDED');
  chunks.push(chunk);
  return next;
}

/** Fetches a public text page while bounding redirects, total time, and decoded body bytes. */
export async function safeFetchOutboundText(
  urlStr: string,
  options: RequestInit & { timeoutMs?: number; maxBytes?: number; maxRedirects?: number; maxBytesDomain?: string } = {},
): Promise<SafeOutboundTextResult> {
  const {
    timeoutMs = 8_000,
    maxBytes = DEFAULT_EXTERNAL_PAGE_MAX_BYTES,
    maxRedirects = 5,
    maxBytesDomain,
    ...requestOptions
  } = options;
  const method = String(requestOptions.method || 'GET').toUpperCase();
  if (method !== 'GET') throw new Error('Safe page retrieval supports GET only');
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > 120_000
    || !Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > 32 * 1024 * 1024
    || !Number.isSafeInteger(maxRedirects) || maxRedirects < 0 || maxRedirects > 10) throw new Error('Invalid retrieval bounds');
  // An official-site allowance is not transferable to a different host through
  // a redirect. DNS and address validation still apply independently per hop.
  if (maxBytesDomain !== undefined) {
    const scope = new URL(`https://${maxBytesDomain}`);
    if (!maxBytesDomain || scope.hostname !== maxBytesDomain || scope.port || scope.pathname !== '/' || scope.search || scope.hash
      || !isSafeExternalUrl(scope.href)) throw new Error('Invalid retrieval domain scope');
  }
  const controller = new AbortController();
  const abortFromCaller = () => controller.abort(new Error('RETRIEVAL_ABORTED'));
  if (requestOptions.signal?.aborted) abortFromCaller();
  else requestOptions.signal?.addEventListener('abort', abortFromCaller, { once: true });
  const timer = setTimeout(() => controller.abort(new Error('RETRIEVAL_TIMEOUT')), timeoutMs);
  const signal = controller.signal;
  const ensureActive = () => { if (signal.aborted) throw signal.reason; };
  let rejectAbort: (() => void) | undefined;
  const aborted = new Promise<never>((_, reject) => {
    rejectAbort = () => reject(signal.reason);
    if (signal.aborted) rejectAbort();
    else signal.addEventListener('abort', rejectAbort, { once: true });
  });

  const requestPage = async (currentUrl: string, redirectsLeft: number): Promise<SafeOutboundTextResult> => {
    ensureActive();
    // Resolve exactly once per hop. Every answer is checked and the selected
    // numeric address is passed directly to the transport (no second lookup).
    const target = await resolveSafeOutboundAddress(currentUrl);
    ensureActive();
    const parsed = new URL(currentUrl);
    const host = stripBrackets(parsed.hostname).replace(/\.$/, '');
    const inScope = maxBytesDomain === undefined || host === maxBytesDomain || host.endsWith(`.${maxBytesDomain}`);
    const bodyLimit = inScope ? maxBytes : Math.min(maxBytes, DEFAULT_EXTERNAL_PAGE_MAX_BYTES);
    const targetPort = parsed.port || (parsed.protocol === 'https:' ? 443 : 80);

    return new Promise<SafeOutboundTextResult>((resolve, reject) => {
      const headers = Object.fromEntries(new Headers(requestOptions.headers).entries());
      headers['accept-encoding'] = 'identity';
      headers['host'] = parsed.host;
      const transport = parsed.protocol === 'https:' ? https : http;
      const req = transport.request({
        method: 'GET',
        hostname: target.address,
        family: target.family,
        port: targetPort,
        path: parsed.pathname + parsed.search,
        headers,
        signal,
        ...(parsed.protocol === 'https:' && !net.isIP(host) ? { servername: host } : {}),
      }, (incoming) => {
        const status = incoming.statusCode || 0;
        if ([301, 302, 303, 307, 308].includes(status) && incoming.headers.location) {
          incoming.destroy();
          if (requestOptions.redirect === 'error') return reject(new Error('RETRIEVAL_REDIRECT_REJECTED'));
          if (redirectsLeft <= 0) return reject(new Error('Blocked: Maximum redirect limit exceeded (SSRF guard)'));
          let nextUrl: string;
          try { nextUrl = new URL(incoming.headers.location, currentUrl).toString(); } catch { return reject(new Error('RETRIEVAL_INVALID_REDIRECT')); }
          requestPage(nextUrl, redirectsLeft - 1).then(resolve, reject);
          return;
        }

        const contentType = String(incoming.headers['content-type'] || '').toLowerCase();
        if (contentType && !/(?:text\/|application\/(?:xhtml\+xml|xml|json))/.test(contentType)) {
          incoming.destroy();
          reject(new Error(`RETRIEVAL_UNSUPPORTED_CONTENT_TYPE:${contentType.split(';')[0]}`));
          return;
        }
        const contentEncoding = String(incoming.headers['content-encoding'] || '').toLowerCase();
        if (contentEncoding && contentEncoding !== 'identity') {
          incoming.destroy();
          reject(new Error(`RETRIEVAL_UNSUPPORTED_CONTENT_ENCODING:${contentEncoding}`));
          return;
        }
        const declaredLength = Number(incoming.headers['content-length'] || 0);
        if (Number.isFinite(declaredLength) && declaredLength > bodyLimit) {
          incoming.destroy();
          reject(new Error('RETRIEVAL_BODY_LIMIT_EXCEEDED'));
          return;
        }

        const chunks: Buffer[] = [];
        let bytesRead = 0;
        incoming.on('data', (chunk: Buffer | string) => {
          const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          try {
            bytesRead = appendBoundedResponseChunk(chunks, buffer, bytesRead, bodyLimit);
          } catch (error: any) {
            incoming.destroy(error);
          }
        });
        incoming.on('error', reject);
        incoming.on('end', () => {
          const bytes = Buffer.concat(chunks);
          const text = bytes.toString('utf8');
          const responseHeaders = new Headers();
          for (const [key, value] of Object.entries(incoming.headers)) {
            if (Array.isArray(value)) value.forEach((item) => responseHeaders.append(key, item));
            else if (value !== undefined) responseHeaders.set(key, String(value));
          }
          const validStatus = (status >= 200 && status <= 599) ? status : 502;
          // Keep the Response byte-exact. Provider consumers use fatal UTF-8
          // validation; decoding/re-encoding here would conceal malformed bytes.
          const body = [204, 205, 304].includes(validStatus) ? null : new Uint8Array(bytes);
          resolve({ response: new Response(body, { status: validStatus, headers: responseHeaders }), text });
        });
      });
      req.setTimeout(timeoutMs, () => req.destroy(new Error('RETRIEVAL_TIMEOUT')));
      req.on('error', reject);
      req.end();
    });
  };

  try { return await Promise.race([requestPage(urlStr, maxRedirects), aborted]); }
  finally {
    clearTimeout(timer);
    if (rejectAbort) signal.removeEventListener('abort', rejectAbort);
    requestOptions.signal?.removeEventListener('abort', abortFromCaller);
  }
}
