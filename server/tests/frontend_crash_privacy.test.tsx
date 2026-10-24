import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { ErrorBoundary } from '../../src/components/ErrorBoundary';
import { reportFrontendCrash } from '../../src/utils/reportFrontendCrash';
import { projectMonitoringEvent } from '../../shared/monitoring_privacy';
const secret = 'SYNTHETIC_PRIVATE_COMPANY private-contact@example.test C:/Users/private';
const boundary = new ErrorBoundary({});
boundary.state = ErrorBoundary.getDerivedStateFromError(new Error(secret));
const html = renderToStaticMarkup(boundary.render());
assert.ok(!html.includes(secret));
assert.ok(html.includes('REACT_RENDER_FAILED'));
assert.ok(!html.includes('fully safe'), 'recovery UI must not make unsupported data guarantees');
const original = globalThis.fetch;
const requests: Array<{input: unknown; init: RequestInit | undefined}> = [];
try {
  globalThis.fetch = (async (input, init) => { requests.push({input,init}); throw new Error(secret); }) as typeof fetch;
  await reportFrontendCrash(); // Offline rejection must not escape into the boundary.
  assert.equal(requests[0].input, '/api/monitoring/frontend-error');
  assert.deepEqual(JSON.parse(String(requests[0].init?.body)), {code:'REACT_RENDER_FAILED'});
  assert.ok(!JSON.stringify(requests).includes(secret));
  for(let i=0;i<8;i++) await reportFrontendCrash();
  assert.equal(requests.length,5,'repeated crashes have a per-page report budget');
} finally { globalThis.fetch=original; }
const event = projectMonitoringEvent('runtime_error', {stage:'render',outcome:'failed',error_code:'REACT_RENDER_FAILED',message:secret,stack:secret}, {version:'1.0.0-rc.2',build_id:'a'.repeat(64),channel:'beta',installation_id:'00000000-0000-4000-8000-000000000001'});
assert.equal(event?.message,'EdgeView interface rendering failed');
assert.equal(event?.stage,'render');
assert.ok(!JSON.stringify(event).includes(secret));
console.log('PASS frontend crash UI and reporting omit private exceptions, survive offline and bound reports.');
