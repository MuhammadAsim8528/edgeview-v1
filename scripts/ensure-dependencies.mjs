import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// The supported development/bootstrap range must cover the whole locked stack,
// including PostHog (20.20 / 22.22) and ESLint (no Node 23), not only Vite.
export const NODE_RANGE = 'Node.js 20.20+ on 20.x, 22.22+ on 22.x, or 24+';

export function nodeVersionSupported(version = process.versions.node) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(String(version).trim());
  if (!match) return false;
  const major = Number(match[1]);
  const minor = Number(match[2]);
  if (major === 20) return minor >= 20;
  if (major === 22) return minor >= 22;
  return major >= 24;
}

export function assertSupportedNode(version = process.versions.node) {
  if (nodeVersionSupported(version)) return;
  throw new Error(`EdgeView needs ${NODE_RANGE} (found ${version}). Install a current Node.js LTS from https://nodejs.org and launch EdgeView again.`);
}

function compatible(item, platform, arch) {
  return (!Array.isArray(item.os) || item.os.includes(platform)) && (!Array.isArray(item.cpu) || item.cpu.includes(arch));
}

function resolveLocked(lock, from, name) {
  let base = from;
  while (base) {
    const nested = `${base}/node_modules/${name}`;
    if (lock.packages?.[nested]) return nested;
    const parent = base.lastIndexOf('/node_modules/');
    base = parent >= 0 ? base.slice(0, parent) : '';
  }
  const root = `node_modules/${name}`;
  return lock.packages?.[root] ? root : null;
}

// Resolve the actual lock graph, including nested dependencies and non-optional
// peers. A direct-root version check alone can certify an incomplete installation.
export function lockedDependencyClosure(lock, roots = Object.keys(lock.packages?.['']?.dependencies || {}), { platform = process.platform, arch = process.arch } = {}) {
  if (lock?.lockfileVersion !== 3 || !lock.packages?.['']) throw new Error('DEPENDENCY_LOCK_FORMAT');
  const pending = roots.map(name => ({ from: '', name }));
  const closure = new Map();
  while (pending.length) {
    const { from, name } = pending.shift();
    const location = resolveLocked(lock, from, name);
    if (!location) throw new Error('DEPENDENCY_LOCK_INCOMPLETE');
    if (closure.has(location)) continue;
    const item = lock.packages[location];
    closure.set(location, item);
    const required = { ...(item.dependencies || {}) };
    for (const [peer] of Object.entries(item.peerDependencies || {})) {
      if (item.peerDependenciesMeta?.[peer]?.optional !== true && !Object.hasOwn(required, peer)) required[peer] = true;
    }
    for (const dependency of Object.keys(required)) {
      if (!resolveLocked(lock, location, dependency)) throw new Error('DEPENDENCY_LOCK_INCOMPLETE');
      pending.push({ from: location, name: dependency });
    }
    for (const [dependency] of Object.entries(item.optionalDependencies || {})) {
      const resolved = resolveLocked(lock, location, dependency);
      if (resolved && compatible(lock.packages[resolved], platform, arch)) pending.push({ from: location, name: dependency });
    }
  }
  return closure;
}

export function productionLockIntegrityGaps(lock) {
  const gaps = [];
  for (const [location, item] of lockedDependencyClosure(lock)) {
    if (!item.link && (!item.resolved || !item.integrity)) gaps.push(location);
  }
  return gaps;
}

export function installedEsbuildBinariesMatch(root, lock, closure, execute = file => spawnSync(file, ['--version'], { encoding: 'utf8', timeout: 10_000, windowsHide: true })) {
  for (const [location, item] of closure) {
    if (location.split('/node_modules/').pop() !== 'esbuild') continue;
    const nativeName = Object.keys(item.optionalDependencies || {}).find(name => {
      const resolved = resolveLocked(lock, location, name);
      return resolved && compatible(lock.packages[resolved], process.platform, process.arch);
    });
    if (!nativeName) return false;
    const nativeLocation = resolveLocked(lock, location, nativeName);
    if (!nativeLocation || lock.packages[nativeLocation].version !== item.version) return false;
    const executable = path.join(root, nativeLocation, process.platform === 'win32' ? 'esbuild.exe' : 'bin/esbuild');
    const stat = fs.lstatSync(executable);
    if (!stat.isFile() || stat.isSymbolicLink()) return false;
    const result = execute(executable);
    if (result.error || result.status !== 0 || String(result.stdout || '').trim() !== item.version) return false;
  }
  return true;
}

export function installedProductionDependenciesMatch(root, options, execute) {
  try {
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
    const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
    const closure = lockedDependencyClosure(lock, Object.keys(manifest.dependencies || {}), options);
    for (const [location, item] of closure) {
      const actual = JSON.parse(fs.readFileSync(path.join(root, location, 'package.json'), 'utf8'));
      if (actual.version !== item.version) return false;
    }
    return installedEsbuildBinariesMatch(root, lock, closure, execute);
  } catch { return false; }
}

export function dependencyFingerprint(root) {
  return crypto.createHash('sha256').update(fs.readFileSync(path.join(root, 'package-lock.json')))
    .update(fs.readFileSync(path.join(root, 'package.json')))
    .update(`${process.platform}/${process.arch}/${process.versions.node.split('.')[0]}/omit-dev-ignore-scripts-v1`).digest('hex');
}

export function ensureDependencies(root, install = () => {
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (key.toLowerCase() === 'npm_config_allow_scripts') delete env[key];
  }
  // npm rejects loading one path as both user and global config. Use distinct
  // empty files owned by this invocation, not the user's npmrc or a shared file.
  const configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edgeview-npm-config-'));
  const userConfig = path.join(configDir, 'user.npmrc');
  const globalConfig = path.join(configDir, 'global.npmrc');
  fs.writeFileSync(userConfig, ''); fs.writeFileSync(globalConfig, '');
  const npmArgs = [
    'ci', '--omit=dev', '--ignore-scripts', '--no-audit', '--no-fund',
    '--cache', '.npm-cache', `--userconfig=${userConfig}`, `--globalconfig=${globalConfig}`,
  ];
  try {
    if (process.platform === 'win32') {
      const command = ['npm.cmd', ...npmArgs.map(arg => `"${arg}"`)].join(' ');
      return spawnSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', command], { cwd: root, stdio: 'inherit', env, windowsVerbatimArguments: true });
    }
    return spawnSync('npm', npmArgs, { cwd: root, stdio: 'inherit', env });
  } finally { fs.rmSync(configDir, { recursive: true, force: true }); }
}) {
  const marker = path.join(root, 'node_modules', '.edgeview-install.json');
  const fingerprint = dependencyFingerprint(root);
  const dependenciesExist = () => installedProductionDependenciesMatch(root);
  try {
    if (JSON.parse(fs.readFileSync(marker, 'utf8')).fingerprint === fingerprint && dependenciesExist()) {
      console.log('EdgeView dependencies are up to date.');
      return;
    }
  } catch { /* Missing/corrupt/partial installation must be repaired. */ }
  // Remove stale success before npm starts: a failure must not certify a partial tree.
  fs.rmSync(marker, { force: true });
  console.log('Installing or repairing locked EdgeView dependencies...');
  const result = install();
  if (result.error || result.status !== 0) throw new Error('Dependency installation failed. Launch again to retry; no successful-install marker was saved.');
  if (!dependenciesExist()) throw new Error('Dependency installation is incomplete; no successful-install marker was saved.');
  const temporary = `${marker}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(temporary, JSON.stringify({ fingerprint }), { flag: 'wx' });
    fs.renameSync(temporary, marker);
  } finally { fs.rmSync(temporary, { force: true }); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { assertSupportedNode(); ensureDependencies(process.cwd()); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
