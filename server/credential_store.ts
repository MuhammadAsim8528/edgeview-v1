import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { createHash } from 'node:crypto';

const FIELD = '_edgeview_credentials';
export const CREDENTIAL_FIELDS = ['serper', 'firecrawl', 'nvidia', 'groq', 'gemini', 'hunter', 'tavily', 'exa', 'linkup', 'apify'].map(p => `${p}_api_key`);
const cache = new Map<string, Record<string, string>>();
export class CredentialStorageError extends Error {
  constructor() { super('Saved credentials could not be protected or opened for this Windows user. Configuration was not replaced.'); }
}

function crypt(input: string, operation: 'Protect' | 'Unprotect'): string {
  if (process.platform !== 'win32' || input.length > 262144) throw new CredentialStorageError();
  // Fixed code/absolute executable; secrets travel only through redirected pipes.
  const script = `$ErrorActionPreference='Stop'; Add-Type -AssemblyName System.Security; try { $b=[Convert]::FromBase64String([Console]::In.ReadToEnd()); $e=[Text.Encoding]::UTF8.GetBytes('EdgeView.credentials.v1'); $r=[Security.Cryptography.ProtectedData]::${operation}($b,$e,[Security.Cryptography.DataProtectionScope]::CurrentUser); [Console]::Out.Write([Convert]::ToBase64String($r)) } catch { exit 1 }`;
  const env: NodeJS.ProcessEnv = {};
  for (const name of ['SystemRoot', 'WINDIR', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'TEMP', 'TMP']) {
    if (process.env[name]) env[name] = process.env[name];
  }
  const result = spawnSync(path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'),
    ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', script],
    { input, encoding: 'utf8', env, windowsHide: true, timeout: 10000, maxBuffer: 1024 * 1024 });
  const output = result.stdout?.trim();
  if (result.error || result.status !== 0 || !output || !/^[A-Za-z0-9+/]+={0,2}$/.test(output)) throw new CredentialStorageError();
  return output;
}

export function decodeCredentials(value: Record<string, unknown>): Record<string, unknown> {
  if (!Object.hasOwn(value, FIELD)) return value;
  try {
    if (CREDENTIAL_FIELDS.some(key => Object.hasOwn(value, key))) throw new CredentialStorageError();
    const envelope = value[FIELD] as Record<string, unknown>;
    if (!envelope || envelope.version !== 1 || envelope.kind !== 'windows-dpapi-current-user' || typeof envelope.ciphertext !== 'string') throw new CredentialStorageError();
    const ciphertext = envelope.ciphertext;
    const digest = createHash('sha256').update(ciphertext).digest('hex');
    let secrets = cache.get(digest);
    if (!secrets) {
      const parsed = JSON.parse(Buffer.from(crypt(ciphertext, 'Unprotect'), 'base64').toString('utf8'));
      if (!parsed || CREDENTIAL_FIELDS.some(key => typeof parsed[key] !== 'string') || Object.keys(parsed).length !== CREDENTIAL_FIELDS.length) throw new CredentialStorageError();
      secrets = parsed;
      if (cache.size >= 4) cache.delete(cache.keys().next().value!);
      cache.set(digest, secrets!);
    }
    const result = { ...value, ...secrets };
    delete result[FIELD];
    return result;
  } catch { throw new CredentialStorageError(); }
}

export function encodeCredentials(value: object): Record<string, unknown> {
  const result: Record<string, unknown> = { ...value };
  const secrets: Record<string, string> = {};
  for (const key of CREDENTIAL_FIELDS) {
    if (typeof result[key] !== 'string') throw new CredentialStorageError();
    secrets[key] = result[key] as string;
  }
  if (!Object.values(secrets).some(Boolean)) return result;
  const ciphertext = crypt(Buffer.from(JSON.stringify(secrets), 'utf8').toString('base64'), 'Protect');
  // Verify recovery before the caller promotes any file.
  const envelope = { version: 1, kind: 'windows-dpapi-current-user', ciphertext };
  const recovered = decodeCredentials({ [FIELD]: envelope });
  if (CREDENTIAL_FIELDS.some(key => recovered[key] !== secrets[key])) throw new CredentialStorageError();
  for (const key of CREDENTIAL_FIELDS) delete result[key];
  result[FIELD] = envelope;
  return result;
}
