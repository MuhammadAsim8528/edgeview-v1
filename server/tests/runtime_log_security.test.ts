import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { installRuntimeLogging, readRuntimeLogs } from '../runtime_log';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'edgeview-log-redaction-'));
const original = { log: console.log, warn: console.warn, error: console.error };
const captured: string[] = [];
try {
  console.log = (...args: unknown[]) => { captured.push(args.join(' ')); };
  console.warn = console.log;
  console.error = console.log;
  const logPath = installRuntimeLogging(root);
  const markers = ['gsk_synthetic_private_credential_123456', 'nvapi-synthetic_private_credential_123456', 'synthetic-bearer-credential', 'synthetic-query-credential', 'synthetic-field-credential', 'synthetic-cookie-credential', 'synthetic-basic-credential'];
  console.log(markers[0]);
  console.warn(markers[1]);
  console.error(`Authorization: Bearer ${markers[2]}`);
  console.error(`https://provider.example/account?api_key=${markers[3]}&operation=test`);
  console.log({ apiKey: markers[4], operation: 'safe-operation' });
  console.log(`Cookie: session=${markers[5]}; preference=local`);
  console.log({ Authorization: `Basic ${markers[6]}` });
  const file = fs.readFileSync(logPath, 'utf8');
  const output = captured.join('\n');
  const api = JSON.stringify(readRuntimeLogs(100));
  for (const marker of markers) {
    assert.ok(!file.includes(marker), 'runtime file must redact secrets');
    assert.ok(!output.includes(marker), 'stdout/stderr must redact secrets');
    assert.ok(!api.includes(marker), 'log API must redact secrets');
  }
  assert.match(output, /safe-operation/, 'useful non-secret context must remain');
  assert.match(file, /REDACTED/);
  const oldMarker = 'gsk_historical_synthetic_private_credential';
  fs.appendFileSync(logPath, JSON.stringify({ timestamp: new Date().toISOString(), level: 'ERROR', message: oldMarker }) + '\n');
  assert.ok(!JSON.stringify(readRuntimeLogs(100)).includes(oldMarker), 'legacy stored entries must be redacted at the API boundary');
} finally {
  Object.assign(console, original);
  fs.rmSync(root, { recursive: true, force: true });
}
console.log('PASS secret redaction across runtime file, console sinks and log API.');
