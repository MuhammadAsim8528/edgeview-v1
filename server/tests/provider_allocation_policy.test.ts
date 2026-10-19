import assert from 'node:assert/strict';
import { scoreProviderForTarget } from '../orchestrator';

assert.ok(
  scoreProviderForTarget('serper', 'official_website') > scoreProviderForTarget('tavily', 'official_website'),
  'Serper should lead exact official-identity discovery'
);
assert.ok(
  scoreProviderForTarget('exa', 'leadership') >= scoreProviderForTarget('serper', 'leadership'),
  'semantic discovery may lead leadership work'
);
assert.equal(scoreProviderForTarget('hunter', 'company'), 0, 'Hunter must not be wasted on general discovery');
assert.equal(scoreProviderForTarget('hunter', 'email'), 100, 'Hunter remains specialized for email objectives');

console.log('provider_allocation_policy.test.ts: PASS');
