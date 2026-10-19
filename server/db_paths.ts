import fs from 'fs';
import path from 'path';

function resolveProjectRoot(): string {
  const entry = process.argv[1] ? path.resolve(process.argv[1]) : '';
  const starts = [entry ? path.dirname(entry) : '', process.cwd()].filter(Boolean);
  for (const start of starts) {
    let current = path.resolve(start);
    while (true) {
      const packagePath = path.join(current, 'package.json');
      if (fs.existsSync(packagePath)) {
        try {
          const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
          if (packageJson?.name === 'edgeview') return current;
        } catch (_) {}
      }
      const parent = path.dirname(current);
      if (parent === current) break;
      current = parent;
    }
  }
  throw new Error('Unable to resolve the EdgeView application root from the executable path.');
}

const PROJECT_ROOT = resolveProjectRoot();

export function getProjectRoot(): string {
  return PROJECT_ROOT;
}

export function getBackendLockPath(): string {
  return `${getSqlitePath()}.lock`;
}

export function isTestProcess(): boolean {
  if (process.env.NODE_ENV === 'test') return true;
  const mode = process.env.EDGEVIEW_TEST_MODE;
  if (mode === '1' || mode === 'true') return true;
  const args = process.argv.slice(1).map((a) => a.replace(/\\/g, '/'));
  for (const a of args) {
    if (/\/server\/tests\//.test(a)) return true;
    if (/\.(test|spec)\.(ts|js|mjs|cjs)$/.test(a)) return true;
  }
  return false;
}

function ensureWritablePath(p: string): string {
  const dir = path.dirname(p);
  if (dir && !fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return p;
}

function testOverrideOrIsolated(envKey: string, prodPath: string, fileName: string, refuseMsg: string): string {
  const override = process.env[envKey];
  if (override && override.trim()) {
    const resolved = path.resolve(override);
    if (path.resolve(prodPath) === resolved) {
      throw new Error(refuseMsg);
    }
    return ensureWritablePath(resolved);
  }
  const dir = process.env.EDGEVIEW_TEST_DB_DIR || path.join(process.cwd(), '.test-cache');
  return ensureWritablePath(path.join(dir, fileName));
}

export function getSqlitePath(): string {
  const prodPath = path.join(PROJECT_ROOT, 'edgeview.db');
  if (isTestProcess()) {
    return testOverrideOrIsolated(
      'EDGEVIEW_SQLITE_DB',
      prodPath,
      `edgeview-test-${process.pid}.db`,
      'REFUSING TEST WRITE TO PRODUCTION DATABASE'
    );
  }
  return prodPath;
}

export function getJsonPersistencePath(): string {
  const prodPath = path.join(PROJECT_ROOT, 'edgeview_db.json');
  if (isTestProcess()) {
    return testOverrideOrIsolated(
      'EDGEVIEW_JSON_DB',
      prodPath,
      `edgeview-test-${process.pid}.json`,
      'REFUSING TEST WRITE TO PRODUCTION JSON PERSISTENCE'
    );
  }
  return prodPath;
}

export function getJsonLegacyPersistencePath(): string {
  if (isTestProcess()) return '';
  return path.join(PROJECT_ROOT, 'pharma_db.json');
}
