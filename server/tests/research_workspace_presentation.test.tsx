import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ResearchWorkspace, ResearchCaptureDetails } from '../../src/components/ResearchWorkspace';
const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
try {
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('controlled denied browser storage'); } });
  const markup = renderToStaticMarkup(React.createElement(ResearchWorkspace));
  assert.ok(markup.includes('aria-label="Refresh research"'), 'initial/empty/loading surface must retain a discoverable refresh control');
  assert.ok(markup.includes('aria-busy="true"'));
  assert.ok(markup.includes('Loading captured V1 research'));
  assert.ok(!markup.includes('No V1 run yet'), 'initial loading must not claim no history exists');
  const metadata = renderToStaticMarkup(<ResearchCaptureDetails run={{
    started_at: '2026-10-01T00:00:00.000Z', completed_at: '2026-10-01T00:00:01.000Z',
    research_context: { format: 1, objective: 'company-contact-research', profile: 'bulk' },
    raw_records: [{ provider: 'serper' }, { provider: 'hunter' }, { provider: 'serper' }, { provider: 'groq-extraction' }],
  }} />);
  assert.ok(metadata.includes('Company contact research'));
  assert.ok(metadata.includes('Bulk'));
  assert.ok(metadata.includes('Groq, Hunter, Serper'));
  assert.equal((metadata.match(/Serper/g) || []).length, 1, 'recorded providers deduplicate across requests');
  assert.ok(metadata.includes('dateTime="2026-10-01T00:00:01.000Z"'));
  assert.ok(metadata.includes('not checked live'));
  const legacy = renderToStaticMarkup(<ResearchCaptureDetails run={{ started_at: 'not-a-date', raw_records: [],
    research_context: { format: 99, objective: 'private/unrecognized-operation', profile: 'bulk' } }} />);
  assert.ok(legacy.includes('Not recorded'));
  assert.ok(legacy.includes('No provider attempts recorded'));
  assert.ok(!legacy.includes('Bulk'), 'unknown context versions must not imply a known operation');
  assert.ok(!legacy.includes('private/unrecognized-operation'));
  assert.ok(!legacy.includes('Invalid Date'));
  const unknown = renderToStaticMarkup(<ResearchCaptureDetails run={{ started_at: '',
    raw_records: [{ provider: 'constructor' }, { provider: '<script>private</script>' }] }} />);
  assert.ok(unknown.includes('Other recorded provider'));
  assert.ok(!unknown.includes('<script>'));
  assert.ok(!unknown.includes('function Object'));
  console.log('PASS initial Research markup tolerates denied storage and exposes accessible refresh/loading; not browser/effect QA');
} finally {
  if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
  else delete (globalThis as any).localStorage;
}
