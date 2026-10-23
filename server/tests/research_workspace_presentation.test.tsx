import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ResearchWorkspace } from '../../src/components/ResearchWorkspace';
const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
try {
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('controlled denied browser storage'); } });
  const markup = renderToStaticMarkup(React.createElement(ResearchWorkspace));
  assert.ok(markup.includes('aria-label="Refresh research"'), 'initial/empty/loading surface must retain a discoverable refresh control');
  assert.ok(markup.includes('aria-busy="true"'));
  assert.ok(markup.includes('Loading captured V1 research'));
  assert.ok(!markup.includes('No V1 run yet'), 'initial loading must not claim no history exists');
  console.log('PASS initial Research markup tolerates denied storage and exposes accessible refresh/loading; not browser/effect QA');
} finally {
  if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
  else delete (globalThis as any).localStorage;
}
