import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { readBuildIdentity, sourceDigest, artifactDigest } from '../shared/build_identity.mjs';
import { resolveRuntimeDataRoot } from '../shared/runtime_paths.mjs';

const installation = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export async function runDoctor({ root = installation, full = false, request = fetch, execute, environment = process.env } = {}) {
  const checks = [];
  const add = (id, status, message) => checks.push({ id, status, message });
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
    if (manifest.name !== 'edgeview') throw new Error();
    add('installation', 'PASS', `EdgeView ${manifest.version}`);
  } catch {
    add('installation', 'FAIL', 'Expected EdgeView installation manifest is missing or invalid.');
    return { format: 1, checks, exitCode: 1 };
  }
  add('runtime', Number(process.versions.node.split('.')[0]) >= 22 ? 'PASS' : 'FAIL', `Node ${process.versions.node}`);
  try {
    const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
    const canonical = value => JSON.stringify(Object.entries(value || {}).sort(([a], [b]) => a.localeCompare(b)));
    if (lock.name !== manifest.name || lock.version !== manifest.version || ['dependencies', 'devDependencies'].some(key => canonical(lock.packages?.['']?.[key]) !== canonical(manifest[key]))) throw new Error();
    add('dependency_lock', 'PASS', 'npm lock matches the application manifest.');
    const installed = Object.keys(manifest.dependencies || {}).every(name => {
      try { return JSON.parse(fs.readFileSync(path.join(root, 'node_modules', name, 'package.json'), 'utf8')).version === lock.packages?.[`node_modules/${name}`]?.version; }
      catch { return false; }
    });
    add('dependencies', installed ? 'PASS' : 'FAIL', installed ? 'Locked production dependencies are installed.' : 'Production dependencies are missing or differ from the lock; run the launcher repair.');
  } catch { add('dependency_lock', 'FAIL', 'Missing, invalid or inconsistent npm lock.'); }
  const built = ['dist/server.cjs', 'dist/index.html'].every(file => fs.existsSync(path.join(root, file)));
  add('build_presence', built ? 'PASS' : 'FAIL', built ? 'Frontend and backend artifacts exist; freshness is not inferred.' : 'Production build artifacts are missing.');
  const localBuild = readBuildIdentity(root);
  if (!localBuild.available) add('build_freshness', 'WARN', 'Build identity is unavailable; rebuild with the current tooling.');
  else {
    try {
      const matches = localBuild.version === manifest.version && localBuild.sourceHash === sourceDigest(root) && localBuild.artifactHash === artifactDigest(root);
      add('build_freshness', matches ? 'PASS' : 'FAIL', matches ? 'Recorded source and artifact digests match this installation.' : 'Source or artifacts differ from recorded build; rebuild before release.');
    } catch { add('build_freshness', 'FAIL', 'Source/artifact identity could not be verified.'); }
  }
  add('secret_store', 'SKIPPED', 'No credential file values are read or exported by doctor.');
  add('python_webview', 'SKIPPED', 'Current release is Node/React in a browser, not a Python/WebView host.');
  let dataRoot;
  try { dataRoot = resolveRuntimeDataRoot(root, environment); }
  catch { add('runtime_storage', 'FAIL', 'Configured writable data root is invalid or overlaps application files.'); return { format: 1, checks, exitCode: 1 }; }
  add('runtime_storage', 'PASS', dataRoot === path.resolve(root) ? 'Legacy application-root storage selected.' : 'Separate writable data root selected; migration is not inferred.');
  const identityFile = path.join(dataRoot, 'data', 'installation.json');
  const hasIdentityFile = fs.existsSync(identityFile);
  let identityId = null;
  try {
    const identity = JSON.parse(fs.readFileSync(identityFile, 'utf8'));
    identityId = typeof identity?.installation_id === 'string' ? identity.installation_id : null;
  } catch { identityId = null; }
  const isUuidV4 = typeof identityId === 'string' && identityId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  if (isUuidV4) add('device_identity', 'PASS', 'Anonymous per-installation identifier is present and well formed.');
  else if (hasIdentityFile) add('device_identity', 'FAIL', 'data/installation.json exists but does not hold a UUID v4 installation identifier.');
  else add('device_identity', 'WARN', 'No installation identifier yet; the backend creates data/installation.json on first start.');
  add('visual_e2e', 'SKIPPED', 'Rendered browser workflows require a separate authorized UI test.');

  try {
    const response = await request('http://127.0.0.1:3901/api/health', { signal: AbortSignal.timeout(5000), redirect: 'error' });
    if (!response.ok || !response.body) throw new Error();
    const reader = response.body.getReader(); const chunks = []; let size = 0;
    try {
      while (true) {
        const chunk = await reader.read(); if (chunk.done) break;
        size += chunk.value.byteLength;
        if (size > 256 * 1024) throw new Error();
        chunks.push(Buffer.from(chunk.value));
      }
    } finally { await reader.cancel().catch(() => {}); }
    const health = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    const normalize = value => process.platform === 'win32' ? path.resolve(value).toLowerCase() : path.resolve(value);
    const sameRoot = typeof health.app?.project_root === 'string' && normalize(health.app.project_root) === normalize(root);
    if (health.app?.name !== 'edgeview' || !sameRoot) throw new Error();
    add('local_backend', health.status === 'ok' ? 'PASS' : 'FAIL', 'Responding EdgeView backend belongs to this installation.');
    const matchingData = typeof health.app.data_root === 'string' ? normalize(health.app.data_root) === normalize(dataRoot) : null;
    add('running_storage', matchingData === null ? 'WARN' : matchingData ? 'PASS' : 'FAIL', matchingData === null ? 'Running data-root identity is unavailable.' : matchingData ? 'Running backend uses the selected writable data root.' : 'Running backend uses a different writable data root; do not migrate or back up based on this process.');
    const liveBuild = health.app?.build;
    add('running_build', !localBuild.available || !liveBuild?.available ? 'WARN' : localBuild.buildId === liveBuild.buildId ? 'PASS' : 'FAIL',
      !localBuild.available || !liveBuild?.available ? 'Live or local build identity is unavailable; deployment NOT VERIFIED.' : localBuild.buildId === liveBuild.buildId ? 'Running backend captured the current build identity at startup.' : 'Running backend belongs to a different build; normal restart required.');
    const databaseState = health.database?.status !== 'ok' ? 'FAIL' : health.database?.operational?.status === 'ok' ? 'PASS' : 'WARN';
    add('database', databaseState, databaseState === 'PASS' ? 'Backend reports dataset and operational database healthy.' : databaseState === 'WARN' ? 'Dataset projection responds; operational database health is not reported by this backend.' : 'Backend database status is degraded or unknown.');
    const resources = health.resources;
    const observedResources = resources?.status === 'PASS' && ['rssBytes', 'cpuPercent', 'systemTotalBytes', 'diskAvailableBytes'].every(key => typeof resources[key] === 'number' && Number.isFinite(resources[key]) && resources[key] >= 0);
    add('resources', observedResources ? 'PASS' : 'WARN', observedResources ? 'Backend reports measured process/system/disk resources; unsupported metrics remain unknown.' : 'Resource measurements are partial or unavailable; initial CPU sample needs a later refresh.');
    for (const provider of ['nvidia', 'groq', 'serper', 'hunter']) {
      const state = health.providers?.[provider];
      add(`provider_${provider}`, !state?.enabled ? 'SKIPPED' : 'WARN', !state?.enabled ? 'Disabled or unknown; no provider request made.' : state.configured ? 'Configured only; authentication/quota/reachability NOT VERIFIED.' : 'Enabled but not configured.');
    }
  } catch { add('local_backend', 'FAIL', 'Local backend unavailable, mismatched, oversized or invalid; no provider calls or mutations performed.'); }

  if (full) {
    const run = execute || ((script) => {
      const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/API_KEY|SECRET|TOKEN|PASSWORD|COOKIE|AUTH|^EDGEVIEW_/i.test(key)));
      // Fixed project scripts only; never execute a command supplied through UI.
      return spawnSync(`npm run ${script}`, { cwd: root, env, shell: true, encoding: 'utf8', timeout: 180000, maxBuffer: 1024 * 1024, windowsHide: true });
    });
    for (const script of ['check', 'build', 'test:release']) {
      let result;
      try { result = run(script); } catch { result = { status: null, error: true }; }
      add(`command_${script}`, result.status === 0 && !result.error ? 'PASS' : 'FAIL', result.status === 0 && !result.error ? `npm run ${script} passed.` : `npm run ${script} failed or exceeded its bound; raw command output is intentionally omitted.`);
      if (result.status !== 0 || result.error) break;
    }
  } else add('full_checks', 'SKIPPED', 'Use --full to run existing static/unit/build/isolated release checks; it rebuilds artifacts, not user data.');
  add('release_security_audit', 'SKIPPED', 'Read-only doctor does not replace dependency/security release audits.');
  return { format: 1, version: manifest.version, checkedAt: new Date().toISOString(), checks, exitCode: checks.some(check => check.status === 'FAIL') ? 1 : 0 };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.some(arg => !['--json', '--full'].includes(arg))) { console.error('Usage: npm run doctor -- [--json] [--full]'); process.exitCode = 2; }
  else {
    const report = await runDoctor({ full: args.includes('--full') });
    console.log(args.includes('--json') ? JSON.stringify(report, null, 2) : report.checks.map(check => `${check.status.padEnd(7)} ${check.id}: ${check.message}`).join('\n'));
    process.exitCode = report.exitCode;
  }
}
