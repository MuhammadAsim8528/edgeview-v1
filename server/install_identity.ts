import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { getJsonPersistencePath, getRuntimeDataRoot, isTestProcess } from './db_paths';

const INSTALLATION_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Anonymous installation identity for local diagnostics correlation. A random
// UUID v4 per installation — never hardware-derived — created once and reset
// only by deleting the identity file.
export function readOrCreateInstallationId(filePath: string): string {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (typeof parsed.installation_id === 'string' && INSTALLATION_ID_PATTERN.test(parsed.installation_id)) {
      return parsed.installation_id;
    }
  } catch { /* first boot or unreadable/corrupt file: create a fresh identity */ }
  const installationId = crypto.randomUUID();
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const tmp = `${filePath}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, `${JSON.stringify({ installation_id: installationId, created_at: new Date().toISOString() }, null, 2)}\n`, { flag: 'wx' });
    fs.renameSync(tmp, filePath);
  } catch { /* identity stays in memory for this process when storage refuses */ }
  return installationId;
}

let cachedInstallationId: string | null = null;

// A test process must never mint an identity inside the real installation, so the
// identity follows the same isolation as the rest of the writable runtime files.
export function getInstallationIdentityPath(): string {
  if (isTestProcess()) return path.join(path.dirname(getJsonPersistencePath()), 'installation.json');
  return path.join(getRuntimeDataRoot(), 'data', 'installation.json');
}

export function getInstallationId(): string {
  if (!cachedInstallationId) {
    cachedInstallationId = readOrCreateInstallationId(getInstallationIdentityPath());
  }
  return cachedInstallationId;
}
