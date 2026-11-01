import { setTimeout as delay } from 'node:timers/promises';
import fs from 'node:fs';
import dns from 'node:dns/promises';
import https from 'node:https';
import http from 'node:http';
import { installAiTransportFixture } from './ai_transport.ts';
const originalRead = fs.readFileSync;
if (process.env.EDGEVIEW_TEST_RUN_READ_MARKER) {
  fs.readFileSync = function (file, ...args) {
    if (/[\\/]run-runtime-payload\.json$/.test(String(file))) {
      fs.writeFileSync(process.env.EDGEVIEW_TEST_RUN_READ_MARKER, 'unexpected full run hydration');
      throw new Error('Runtime polling must not hydrate provider evidence');
    }
    return originalRead.call(this, file, ...args);
  };
}

// Isolated test process only: unexpected external requests fail instead of
// reaching a real provider. No production account or dataset is used.
globalThis.fetch = async (input, init) => {
  const url = new URL(typeof input === 'string' ? input : input.url || input.href);
  if (url.hostname === 'google.serper.dev') {
    const diagnostic = JSON.parse(String(init?.body || '{}')).q === 'test';
    if (!init?.signal || (diagnostic && init.redirect !== 'error')) throw new Error('Serper diagnostic transport is not bounded.');
    await delay(50, undefined, { signal: init.signal });
    if (new Headers(init?.headers).get('X-API-KEY')?.includes('auth-failed')) return new Response(JSON.stringify({ message: 'Unauthorized synthetic fixture' }), { status: 401 });
    if (!diagnostic && new Headers(init?.headers).get('X-API-KEY')?.includes('upstream-failed')) return new Response(JSON.stringify({ message: 'Unavailable synthetic fixture' }), { status: 503 });
    return new Response(JSON.stringify({ organic: [] }), { status: 200 });
  }
  if (url.hostname === 'api.hunter.io') {
    if (init?.redirect !== 'error' || !init.signal) throw new Error('Hunter diagnostic transport is not bounded.');
    await delay(80, undefined, { signal: init.signal });
    return new Response(JSON.stringify({ data: { emails: [] } }), { status: 200 });
  }
  throw new Error('Unexpected external request in isolated telemetry fixture.');
};

// Provider diagnostics now use the hardened pinned HTTPS boundary, not fetch.
// Keep DNS and socket traffic synthetic as well as the response payloads.
const denyWire = () => { throw new Error('Unexpected wire request in isolated telemetry fixture.'); };
dns.lookup = denyWire;
https.request = denyWire;
http.request = denyWire;
installAiTransportFixture(['google.serper.dev', 'api.hunter.io']);
