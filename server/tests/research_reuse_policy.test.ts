import assert from 'node:assert/strict';
import { canonicalEntityIdentityKey } from '../company_identity';
import * as engine from '../v1_engine';

const assess = (engine as any).assessV1FreshReuse;
assert.equal(typeof assess, 'function', 'automatic reuse needs an explicit validity gate');
const now = Date.parse('2026-11-01T12:00:00.000Z');
const context = { format: 1, pipeline_version: 1, result_schema: 30, objective: 'company-contact-research', profile: 'interactive', provider_fingerprint: 'a'.repeat(64) };
const run = { company_name: 'Synthetic Buyer', country: 'Sudan', status: 'COMPLETED', started_at: '2026-10-31T12:00:00.000Z', completed_at: '2026-10-31T12:00:01.000Z', research_context: context };
const target = { company_name: 'SYNTHETIC BUYER', country: 'Sudan' };
assert.equal(assess(run, target, context, now).eligible, true);
assert.notEqual(canonicalEntityIdentityKey(run.company_name, 'Sudan'), canonicalEntityIdentityKey(run.company_name, 'South Sudan'));
for (const patch of [
  { country: 'South Sudan' }, { company_name: 'Different Buyer' }, { country: '' },
  { status: 'PARTIAL' }, { status: 'FAILED' }, { status: 'RUNNING' },
  { completed_at: '2026-10-01T12:00:00.000Z' }, { completed_at: '2026-11-02T12:00:00.000Z' },
  { completed_at: undefined }, { completed_at: '2026-02-30T12:00:00Z' }, { started_at: '2026-11-02T12:00:00.000Z' },
  { research_context: undefined }, { research_context: { ...context, profile: 'bulk' } },
  { research_context: { ...context, objective: 'unrelated-operation' } },
  { research_context: { ...context, result_schema: 29 } }, { research_context: { ...context, pipeline_version: 0 } },
  { research_context: { ...context, provider_fingerprint: 'b'.repeat(64) } },
]) assert.equal(assess({ ...run, ...patch }, target, context, now).eligible, false, JSON.stringify(patch));
const boundary = { ...run, started_at: '2026-10-25T11:59:59.000Z', completed_at: '2026-10-25T12:00:00.000Z' };
assert.equal(assess(boundary, target, context, now).eligible, true, 'exactly seven days is within the documented operational window');
assert.equal(assess(boundary, target, context, now + 1).eligible, false, 'one millisecond beyond the window is stale');
assert.equal(assess(run, { ...target, country: '' }, context, now).eligible, false);
for (const country of ['Unknown', 'N/A', 'Not specified', 'nan']) assert.equal(assess({ ...run, country }, { ...target, country }, context, now).eligible, false, 'unknown country cannot become a global fresh cache key');
assert.equal(assess(run, target, context, NaN).eligible, false);
console.log('PASS recent-cache policy refuses age/future/clock/profile/schema/pipeline/provider/objective/quality and entity-country mismatches; historical visibility is independent');
