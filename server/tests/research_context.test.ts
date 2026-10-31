import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const reopen = process.argv[2] === '--reopen';
const root = reopen ? process.env.EDGEVIEW_V1_DATA_DIR! : fs.mkdtempSync(path.join(os.tmpdir(), 'edgeview-research-context-'));
process.env.EDGEVIEW_TEST_MODE = '1';
process.env.EDGEVIEW_V1_DATA_DIR = root;
process.env.EDGEVIEW_CONFIG = path.join(root, 'config.json');
globalThis.fetch = () => { throw new Error('CONTEXT_TEST_MUST_NOT_CALL_PROVIDERS'); };
try {
  if (!reopen) fs.writeFileSync(process.env.EDGEVIEW_CONFIG, JSON.stringify({ serper_enabled: false, hunter_enabled: false, nvidia_enabled: false, groq_enabled: false }));
  const engine = await import('../v1_engine');
  const { getAppSettings } = await import('../settings');
  const settings = getAppSettings();
  const create = (engine as any).createV1ResearchContext;
  const compatibility = (engine as any).v1ResearchCompatibility;
  const describe = (engine as any).describeV1EvidenceReuse;
  assert.equal(typeof create, 'function', 'immutable research needs explicit version/profile/provider context');
  const context = create('interactive', settings);
  assert.equal(context.profile, 'interactive');
  assert.match(context.provider_fingerprint, /^[a-f0-9]{64}$/);
  assert.equal(compatibility({ research_context: context }, context), 'matches_current_context');
  assert.equal(compatibility({}, context), 'unverified');
  for (const completed_at of [undefined, '0', 'private/raw/path', '2026-02-30T00:00:00Z', 'not-a-date']) {
    assert.deepEqual(describe({ completed_at }, context), { captured_at: null, compatibility: 'unverified', freshness: 'not_live_verified' });
  }
  assert.deepEqual(describe({ completed_at: '2026-01-01T00:00:01Z', research_context: context }, context), { captured_at: '2026-01-01T00:00:01.000Z', compatibility: 'matches_current_context', freshness: 'not_live_verified' });
  assert.equal(compatibility({ research_context: { ...context, pipeline_version: 0 } }, context), 'different_context');
  assert.equal(compatibility({ research_context: { ...context, result_schema: -1 } }, context), 'different_context');
  assert.equal(compatibility({ research_context: create('bulk', settings) }, context), 'different_context');
  assert.throws(() => create('unregistered-profile', settings), /Invalid V1 research profile/);
  const syntheticKeys = { ...settings, serper_api_key: 'synthetic-first-key', nvidia_api_key: 'synthetic-model-key' };
  const firstKeyContext = create('interactive', syntheticKeys);
  const rotated = create('interactive', { ...syntheticKeys, serper_api_key: 'synthetic-rotated-key', nvidia_api_key: 'synthetic-rotated-model-key' });
  assert.deepEqual(firstKeyContext, rotated, 'key values must never be fingerprint inputs');
  assert.ok(!JSON.stringify(firstKeyContext).includes('synthetic-'));
  assert.notEqual(create('interactive', { ...settings, groq_model: 'different-synthetic-model' }).provider_fingerprint, context.provider_fingerprint);
  if (!reopen) {
    const first = await engine.runV1Enrichment('Synthetic Context Buyer', 'Kenya');
    assert.deepEqual(engine.listV1RunIdentityHeaders().find(run => run.id === first.id)!.research_context, context, 'initial prefix scan must retain context before the raw payload');
    const second = await engine.runV1Enrichment('Synthetic Context Buyer', 'Kenya');
    assert.deepEqual(engine.listV1RunIdentityHeaders().find(run => run.id === second.id)!.research_context, context, 'an already initialized index must append new context');
    const bulk = await engine.runV1Enrichment('Synthetic Context Buyer', 'Kenya', { profile: 'bulk' });
    assert.equal(bulk.research_context!.profile, 'bulk');
    assert.notEqual(bulk.limits.timeout_ms, first.limits.timeout_ms);
    assert.notEqual(first.id, second.id, 'a new explicit execution must create a new immutable operation');
    assert.deepEqual(first.research_context, context);
    assert.equal(first.status, 'FAILED', 'disabled providers cannot fabricate successful research');
    assert.deepEqual(engine.getV1Run(first.id)!.research_context, context);
    fs.writeFileSync(path.join(root, 'expected.json'), JSON.stringify({ id: first.id, context }));
    const result = spawnSync(process.execPath, ['--import', 'tsx', path.resolve('server/tests/research_context.test.ts'), '--reopen'], {
      env: { ...process.env, EDGEVIEW_V1_DATA_DIR: root }, encoding: 'utf8', timeout: 30000, windowsHide: true,
    });
    assert.equal(result.status, 0, result.stdout + result.stderr);
  } else {
    const expected = JSON.parse(fs.readFileSync(path.join(root, 'expected.json'), 'utf8'));
    assert.deepEqual(engine.getV1Run(expected.id)!.research_context, expected.context);
    assert.deepEqual(engine.listV1RunIdentityHeaders().find(run => run.id === expected.id)!.research_context, expected.context, 'restart derived index must retain context without hydrating raw blobs');
  }
  console.log('PASS actual immutable operation context: profile/schema/pipeline/provider compatibility, key exclusion, disabled-provider failure, new IDs and fresh-process restart');
} finally {
  if (!reopen) { assert.equal(path.dirname(fs.realpathSync(root)), fs.realpathSync(os.tmpdir())); fs.rmSync(root, { recursive: true, force: true }); }
}
