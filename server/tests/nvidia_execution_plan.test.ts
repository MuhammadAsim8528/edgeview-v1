import assert from 'node:assert/strict';
import {
  buildAIExecutionPlan,
  buildNvidiaChatPayload,
  resolveNvidiaRequestProfile,
  sanitizeProviderError,
} from '../ai_execution_plan';
import { runNvidiaDiagnostics } from '../nvidia_diagnostics';
import { getAppSettings, type AppSettings } from '../settings';

function settings(): AppSettings {
  return {
    ...getAppSettings(),
    primary_ai_provider: 'NVIDIA' as const,
    nvidia_api_key: 'test-nvidia-key',
    nvidia_enabled: true,
    nvidia_model: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning',
    nvidia_fallback_model: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning',
    nvidia_reasoning_mode: 'INSTRUCT' as const,
    nvidia_temperature: 0.17,
    nvidia_max_tokens: 777,
    groq_api_key: 'test-groq-key',
    groq_enabled: true,
    gemini_enabled: false,
  };
}

const configured = settings();
const plan = buildAIExecutionPlan(configured);
assert.equal(plan.provider, 'nvidia');
assert.equal(plan.model, configured.nvidia_model);
assert.equal(plan.temperature, 0.17);
assert.equal(plan.maxTokens, 777);
assert.equal(plan.requestProfile, 'NANO_OMNI_INSTRUCT');
assert.deepEqual((buildNvidiaChatPayload(plan, 'test').chat_template_kwargs as any), { enable_thinking: false });

configured.nvidia_reasoning_mode = 'THINKING';
const thinking = buildAIExecutionPlan(configured);
assert.equal(thinking.requestProfile, 'NANO_OMNI_THINKING');
assert.deepEqual((buildNvidiaChatPayload(thinking, 'test').chat_template_kwargs as any), { enable_thinking: true });
assert.equal(resolveNvidiaRequestProfile('nvidia/nemotron-3.5-lightning', 'THINKING'), 'NEMOTRON_3_5_LIGHTNING');

configured.nvidia_enabled = false;
const fallback = buildAIExecutionPlan(configured);
assert.equal(fallback.provider, 'groq');
assert.ok(!JSON.stringify(fallback).includes('"provider":"nvidia"'), 'Disabled NVIDIA must not appear in fallback chain');

configured.groq_enabled = false;
assert.throws(() => buildAIExecutionPlan(configured), /No enabled AI provider/);
assert.ok(!sanitizeProviderError('Bearer nvapi-secret-value').includes('secret-value'));

let calls = 0;
const originalFetch = globalThis.fetch;
globalThis.fetch = (async () => {
  calls++;
  throw new Error('fetch must not run');
}) as typeof fetch;
try {
  const report = await runNvidiaDiagnostics(configured);
  assert.equal(report.enabled, false);
  assert.ok(report.stages.every((stage) => stage.status === 'SKIPPED'));
  assert.equal(calls, 0, 'Disabled NVIDIA diagnostics must make zero HTTP calls');
} finally {
  globalThis.fetch = originalFetch;
}

configured.nvidia_enabled = true;
const requestBodies: any[] = [];
globalThis.fetch = (async (input: any, init?: RequestInit) => {
  const url = String(input);
  if (url.endsWith('/models')) {
    return new Response(JSON.stringify({ data: [{ id: configured.nvidia_model }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  requestBodies.push(JSON.parse(String(init?.body || '{}')));
  return new Response(JSON.stringify({ choices: [{ message: { content: 'OK' } }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}) as typeof fetch;
try {
  const report = await runNvidiaDiagnostics(configured);
  assert.ok(report.stages.every((stage) => stage.status === 'PASS'));
  assert.equal(requestBodies.length, 3, 'Diagnostics must execute minimal, profile, and exact-production requests once each');
  assert.equal(requestBodies[0].chat_template_kwargs, undefined, 'Minimal inference must isolate base payload behavior');
  assert.deepEqual(requestBodies[1].chat_template_kwargs, { enable_thinking: true });
  assert.equal(requestBodies[2].temperature, configured.nvidia_temperature);
  assert.equal(requestBodies[2].max_tokens, configured.nvidia_max_tokens);
} finally {
  globalThis.fetch = originalFetch;
}

console.log('nvidia_execution_plan: 19 assertions passed');
