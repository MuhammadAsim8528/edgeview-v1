import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

async function main(): Promise<void> {
  const runDir = path.resolve('.test-cache', `provider-failure-memory-${process.pid}`);
  fs.rmSync(runDir, { recursive: true, force: true });
  fs.mkdirSync(runDir, { recursive: true });
  process.env.EDGEVIEW_TEST_MODE = '1';
  process.env.EDGEVIEW_TEST_DB_DIR = runDir;
  process.env.EDGEVIEW_SQLITE_DB = path.join(runDir, 'memory.db');

  const { failureContextFingerprint, PersistentProviderFailureMemory } = await import('../provider_failure_memory');
  const fingerprint = failureContextFingerprint({ model: 'test-model', prompt: 'same-context' });
  assert.equal(await PersistentProviderFailureMemory.shouldSuppress('nvidia', 'ai:test-model', fingerprint), false);

  await PersistentProviderFailureMemory.remember(
    'nvidia',
    'ai:test-model',
    fingerprint,
    { status: 503, message: 'Bearer nvapi-sensitive NVIDIA API Error: 503' },
  );
  assert.equal(await PersistentProviderFailureMemory.shouldSuppress('nvidia', 'ai:test-model', fingerprint), true);
  const rows = await PersistentProviderFailureMemory.list();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].failure_class, 'HTTP_SERVER');
  assert.ok(!rows[0].reason.includes('sensitive'), 'Persisted failure reasons must redact credentials');

  await PersistentProviderFailureMemory.clear('nvidia', 'ai:test-model', fingerprint);
  assert.equal(await PersistentProviderFailureMemory.shouldSuppress('nvidia', 'ai:test-model', fingerprint), false);

  await new Promise((resolve) => setTimeout(resolve, 400));
  fs.rmSync(runDir, { recursive: true, force: true });
  console.log('provider_failure_memory_persistence: 6 assertions passed');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
