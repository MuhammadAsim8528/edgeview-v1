import dns from 'node:dns/promises';
import https from 'node:https';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';

/** Adapt existing synthetic provider payloads at the real pinned wire boundary.
 * Production DNS validation/request construction still execute. No real AI call.
 */
export function installAiTransportFixture(hostnames: string[]) {
  const hosts = new Set(hostnames);
  const originalLookup = dns.lookup;
  const originalRequest = https.request;
  dns.lookup = (async (hostname: string, ...args: any[]) => hosts.has(hostname)
    ? [{ address: '93.184.216.34', family: 4 }]
    : (originalLookup as any)(hostname, ...args)) as typeof dns.lookup;
  https.request = ((options: any, callback: (incoming: any) => void) => {
    if (!hosts.has(options.servername)) return (originalRequest as any)(options, callback);
    const request = new EventEmitter() as any;
    let incoming: any;
    let destroyed = false;
    const abort = () => request.destroy(options.signal.reason);
    request.setTimeout = () => request;
    request.destroy = (error: Error) => {
      options.signal.removeEventListener('abort', abort);
      if (!destroyed) { destroyed = true; incoming?.destroy(); request.emit('error', error); }
      return request;
    };
    request.end = (bytes?: Buffer) => {
      queueMicrotask(async () => {
        try {
          if (options.signal.aborted) return abort();
          options.signal.addEventListener('abort', abort, { once: true });
          const authority = options.headers.host;
          const response = await globalThis.fetch(`https://${authority}${options.path}`, {
            method: options.method, headers: options.headers, signal: options.signal,
            redirect: 'error', ...(bytes ? { body: bytes.toString('utf8') } : {}),
          });
          const body = Buffer.from(await response.arrayBuffer());
          if (destroyed) return;
          incoming = new PassThrough();
          incoming.statusCode = response.status;
          incoming.headers = Object.fromEntries(response.headers);
          incoming.once('close', () => options.signal.removeEventListener('abort', abort));
          callback(incoming);
          incoming.end(body);
        } catch (error) { request.destroy(error as Error); }
      });
      return request;
    };
    return request;
  }) as typeof https.request;
  return () => { dns.lookup = originalLookup; https.request = originalRequest; };
}
