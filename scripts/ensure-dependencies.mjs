import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

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
  const userConfig = process.platform === 'win32' ? 'NUL' : '/dev/null';
  const npmArgs = [
    'ci', '--omit=dev', '--ignore-scripts', '--no-audit', '--no-fund',
    '--cache', '.npm-cache', `--userconfig=${userConfig}`,
  ];
  if (process.platform === 'win32') {
    const command = ['npm.cmd', ...npmArgs].join(' ');
    return spawnSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', command], { cwd: root, stdio: 'inherit', env });
  }
  return spawnSync('npm', npmArgs, { cwd: root, stdio: 'inherit', env });
}) {
  const marker = path.join(root, 'node_modules', '.edgeview-install.json');
  const fingerprint = dependencyFingerprint(root);
  const dependenciesExist = () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
    const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
    return Object.keys(manifest.dependencies || {}).every(name => {
      const actual = JSON.parse(fs.readFileSync(path.join(root, 'node_modules', name, 'package.json'), 'utf8'));
      return actual.version === lock.packages?.[`node_modules/${name}`]?.version;
    });
  };
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
  try { ensureDependencies(process.cwd()); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
