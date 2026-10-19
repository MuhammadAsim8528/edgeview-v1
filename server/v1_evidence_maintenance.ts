import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { getBackendLockPath, isTestProcess } from './db_paths';

function atomicJson(file: string, value: unknown): void {
  const temporary = `${file}.${crypto.randomBytes(6).toString('hex')}.tmp`;
  let handle: number | undefined;
  try {
    handle = fs.openSync(temporary, 'wx');
    fs.writeFileSync(handle, JSON.stringify(value, null, 2) + '\n');
    fs.fsyncSync(handle); fs.closeSync(handle); handle = undefined;
    fs.renameSync(temporary, file);
  } finally {
    if (handle !== undefined) fs.closeSync(handle);
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
}
interface InvalidRun { file: string; bytes: number; sha256: string; reason: string; moved: boolean }
/** Read-only by default. Apply mode is for a stopped application, never startup.
 * Only invalid final JSON/identity records are quarantined; blob availability is
 * a separate integrity audit and is not grounds to move otherwise valid runs.
 */
export function auditV1Evidence(directory: string, applyQuarantine = false) {
  if (applyQuarantine && !isTestProcess() && fs.existsSync(getBackendLockPath())) throw new Error('Stop EdgeView before applying evidence quarantine or rebuilding its index.');
  const root = path.resolve(directory);
  const files = fs.readdirSync(root).filter(file => /^run-[a-z0-9-]+\.json$/i.test(file)).sort();
  const invalid: InvalidRun[] = [];
  const headers: Array<Record<string, unknown>> = [];
  let bytes = 0;
  for (const file of files) {
    const content = fs.readFileSync(path.join(root, file));
    bytes += content.length;
    let reason = '';
    try {
      if (!content.length) throw new Error('ZERO_BYTE');
      const run = JSON.parse(content.toString('utf8'));
      if (!run || run.id !== file.slice(0, -5) || typeof run.company_name !== 'string' || typeof run.country !== 'string'
        || typeof run.started_at !== 'string' || !Array.isArray(run.queries)) throw new Error('INVALID_RUN_IDENTITY');
      headers.push({ id: run.id, company_name: run.company_name, country: run.country, status: run.status,
        started_at: run.started_at, ...(run.completed_at ? { completed_at: run.completed_at } : {}), query_count: run.queries.length });
    } catch (error) {
      reason = error instanceof SyntaxError ? 'INVALID_JSON' : error instanceof Error ? error.message : 'INVALID_RUN';
    }
    if (reason) invalid.push({ file, bytes: content.length, sha256: crypto.createHash('sha256').update(content).digest('hex'), reason, moved: false });
  }
  let quarantine: string | null = null;
  if (applyQuarantine) {
    if (invalid.length) {
      quarantine = path.join(root, 'quarantine', `${new Date().toISOString().replace(/[:.]/g,'-')}-${crypto.randomBytes(4).toString('hex')}`);
      fs.mkdirSync(quarantine, { recursive: true });
      // Record planned source/destination mappings before any move. A crash can
      // therefore be recovered even if the following manifest update fails.
      const manifest = { format: 1, created_at: new Date().toISOString(), files: invalid };
      const manifestPath = path.join(quarantine, 'manifest.json');
      atomicJson(manifestPath, manifest);
      for (const item of invalid) {
        const source = path.join(root, item.file);
        const current = fs.readFileSync(source);
        if (crypto.createHash('sha256').update(current).digest('hex') !== item.sha256) throw new Error('Evidence changed during audit; no further quarantine moves allowed.');
        fs.renameSync(source, path.join(quarantine, item.file));
        item.moved = true;
        atomicJson(manifestPath, manifest);
      }
    }
    headers.sort((a,b) => String(b.started_at).localeCompare(String(a.started_at)));
    const index = path.join(root, 'identity-index.jsonl');
    const temporary = `${index}.${crypto.randomBytes(6).toString('hex')}.tmp`;
    let handle: number | undefined;
    try {
      handle = fs.openSync(temporary, 'wx');
      for (const header of headers) fs.writeSync(handle, JSON.stringify(header) + '\n');
      fs.fsyncSync(handle); fs.closeSync(handle); handle = undefined;
      fs.renameSync(temporary, index);
    } finally {
      if (handle !== undefined) fs.closeSync(handle);
      if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
    }
  }
  return { examined: files.length, valid: headers.length, bytes, invalid, quarantine, indexRebuilt: applyQuarantine,
    validation: 'JSON syntax and run identity header; referenced blob integrity is not checked by this maintenance pass.' };
}
