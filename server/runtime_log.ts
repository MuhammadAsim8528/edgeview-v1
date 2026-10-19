import fs from 'fs';
import path from 'path';
import util from 'util';

const MAX_LOG_BYTES = 10 * 1024 * 1024;
const MAX_ARCHIVES = 3;
let runtimeLogPath = '';
let installed = false;

function redact(value: string): string {
  return value
    .replace(/((?:proxy-)?authorization["']?\s*[:=]\s*["']?)(?:[A-Za-z]+\s+)?[^\s,"'}]+/gi, '$1[REDACTED]')
    .replace(/((?:set-cookie|cookie)["']?\s*[:=]\s*)[^\r\n]+/gi, '$1[REDACTED_COOKIE]')
    .replace(/((?:api[_-]?key|access[_-]?token|password|secret|token)\s*["']?\s*[:=]\s*["']?)[^\s,"'}&]+/gi, '$1[REDACTED]')
    .replace(/([?&](?:api_key|key|token|access_token)=)[^&\s]+/gi, '$1[REDACTED]')
    .replace(/\b(?:sk-|gsk[-_]|nvapi[-_]|tvly[-_]|apify_api_|fc-)[A-Za-z0-9_.-]{12,}\b/g, '[REDACTED_KEY]');
}

function rotateIfNeeded(extraBytes: number): void {
  if (!runtimeLogPath || !fs.existsSync(runtimeLogPath)) return;
  if (fs.statSync(runtimeLogPath).size + extraBytes <= MAX_LOG_BYTES) return;
  for (let index = MAX_ARCHIVES; index >= 1; index -= 1) {
    const source = index === 1 ? runtimeLogPath : `${runtimeLogPath}.${index - 1}`;
    const target = `${runtimeLogPath}.${index}`;
    if (!fs.existsSync(source)) continue;
    if (fs.existsSync(target)) fs.unlinkSync(target);
    fs.renameSync(source, target);
  }
}

function serializeArg(value: unknown): string {
  if (value instanceof Error) return `${value.name}: ${value.message}\n${value.stack || ''}`;
  if (typeof value === 'string') return value;
  return util.inspect(value, { depth: 5, maxArrayLength: 50, maxStringLength: 4000, breakLength: 160 });
}

function append(level: 'INFO' | 'WARNING' | 'ERROR', args: unknown[]): void {
  if (!runtimeLogPath) return;
  try {
    const entry = JSON.stringify({ timestamp: new Date().toISOString(), level, message: redact(args.map(serializeArg).join(' ')).slice(0, 16_000) }) + '\n';
    rotateIfNeeded(Buffer.byteLength(entry));
    fs.appendFileSync(runtimeLogPath, entry, 'utf8');
  } catch { /* logging must never take down EdgeView */ }
}

export function installRuntimeLogging(projectRoot: string): string {
  if (installed) return runtimeLogPath;
  runtimeLogPath = path.join(projectRoot, 'logs', 'edgeview_runtime.log');
  fs.mkdirSync(path.dirname(runtimeLogPath), { recursive: true });
  const original = { log: console.log.bind(console), warn: console.warn.bind(console), error: console.error.bind(console) };
  // The launcher may capture stdout/stderr in separate files. Those sinks need
  // the same redaction as the structured runtime file.
  const printable = (args: unknown[]) => redact(args.map(serializeArg).join(' ')).slice(0, 16_000);
  console.log = (...args: unknown[]) => { append('INFO', args); original.log(printable(args)); };
  console.warn = (...args: unknown[]) => { append('WARNING', args); original.warn(printable(args)); };
  console.error = (...args: unknown[]) => { append('ERROR', args); original.error(printable(args)); };
  installed = true;
  append('INFO', [{ event: 'runtime_logging_started', max_bytes: MAX_LOG_BYTES, archives: MAX_ARCHIVES }]);
  return runtimeLogPath;
}

export function readRuntimeLogs(limit = 500): Array<{ id: string; timestamp: string; level: string; subsystem: string; message: string; details?: string }> {
  if (!runtimeLogPath || !fs.existsSync(runtimeLogPath)) return [];
  const stat = fs.statSync(runtimeLogPath);
  const bytesToRead = Math.min(stat.size, 1024 * 1024);
  const buffer = Buffer.alloc(bytesToRead);
  const handle = fs.openSync(runtimeLogPath, 'r');
  try { fs.readSync(handle, buffer, 0, bytesToRead, stat.size - bytesToRead); }
  finally { fs.closeSync(handle); }
  let text = buffer.toString('utf8');
  if (stat.size > bytesToRead) text = text.replace(/^[^\n]*\n/, '');
  const lines = text.split(/\r?\n/).filter(Boolean).slice(-Math.max(1, Math.min(1000, limit)));
  return lines.map((line, index) => {
    try {
      const entry = JSON.parse(line);
      // Older files may predate the current redaction rules. Enforce the
      // boundary again when returning historical entries to the frontend.
      let message = redact(String(entry.message || 'Runtime event'));
      let subsystem = 'API';
      let details: string | undefined;
      try {
        const nested = JSON.parse(message);
        if (nested?.event) {
          subsystem = /startup/i.test(nested.event) ? 'STARTUP' : /database|persist|storage/i.test(nested.event) ? 'DATABASE' : /security|origin|host/i.test(nested.event) ? 'SECURITY' : 'API';
          message = String(nested.event).replace(/_/g, ' ');
          details = JSON.stringify(nested);
        }
      } catch { /* ordinary text message */ }
      return { id: `runtime-${stat.mtimeMs}-${index}`, timestamp: entry.timestamp || '', level: entry.level || 'INFO', subsystem, message, ...(details ? { details } : {}) };
    } catch {
      return { id: `runtime-${stat.mtimeMs}-${index}`, timestamp: '', level: 'WARNING', subsystem: 'API', message: redact(line).slice(0, 4000) };
    }
  });
}
