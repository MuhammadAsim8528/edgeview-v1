import assert from 'node:assert/strict';
import { requiresOperationalDatabase as requiresDb } from '../storage_mutation_guard';
for (const path of ['/api/enrich/company', '/api/enrich/batch', '/api/enrich/jobs', '/api/enrich/job/example/start', '/api/files/upload', '/api/files/example/save-to-history', '/api/stats/save-to-history', '/api/upload', '/upload', '/files/upload', '/API/FILES/UPLOAD/']) {
  assert.equal(requiresDb('POST', path), true, path);
  assert.equal(requiresDb('GET', path), false, 'reads are not data mutations');
}
assert.equal(requiresDb('DELETE', '/api/files/example'), true);
for (const path of ['/api/enrich/job/example/stop', '/api/settings', '/api/settings/test', '/api/system/health/test', '/api/export', '/api/export/csv', '/api/ai/models', '/api/v1/runs/example', '/api/companies/example/enrich']) {
  assert.equal(requiresDb('POST', path), false, path);
}
console.log('PASS operational mutation classification preserves stop/recovery/diagnostics and read access');
