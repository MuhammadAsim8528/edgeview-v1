import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { sourceDigest, artifactDigest, readBuildIdentity } from '../shared/build_identity.mjs';
import { runtimePackageInputs, verifyRuntimeLock, runtimeSourceNotices, verifyRuntimeManifest } from './runtime-package-inputs.mjs';

// Internal factory only. Never installs, signs, trusts a certificate or publishes.
const factoryEnvironment = () => Object.fromEntries(Object.entries(process.env).filter(([key]) => /^(PATH|SystemRoot|WINDIR|COMSPEC|USERPROFILE|TEMP|TMP|APPDATA|LOCALAPPDATA)$/i.test(key)));
export function prototypeNpmArgs(output) {
  // npm refuses one file loaded as both scopes. Match the existing bootstrap's
  // distinct, empty, invocation-owned configs; never read the owner's npmrc.
  const user = path.join(output, 'user.npmrc'), global = path.join(output, 'global.npmrc');
  fs.writeFileSync(user, '', { flag: 'wx' }); fs.writeFileSync(global, '', { flag: 'wx' });
  return ['ci', '--omit=dev', '--ignore-scripts', '--no-audit', '--no-fund', '--registry=https://registry.npmjs.org',
    `--userconfig=${user}`, `--globalconfig=${global}`, `--cache=${path.join(output, 'npm-cache')}`];
}
export function prototypePreflight(root) {
  const env = factoryEnvironment();
  const git = spawnSync('git', ['status', '--porcelain', '--untracked-files=normal'], { cwd: root, env, encoding: 'utf8', timeout: 15_000, windowsHide: true });
  if (git.status !== 0 || git.stdout.trim()) throw new Error('MSIX_PROTOTYPE_REQUIRES_CLEAN_SOURCE');
  const commit = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, env, encoding: 'utf8', timeout: 15_000, windowsHide: true }).stdout?.trim();
  const identity = readBuildIdentity(root);
  if (!/^[a-f0-9]{40}$/.test(commit || '') || !identity.available || identity.gitCommit !== commit
    || identity.sourceHash !== sourceDigest(root) || identity.artifactHash !== artifactDigest(root)) {
    throw new Error('MSIX_PROTOTYPE_BUILD_IDENTITY_MISMATCH');
  }
  return { commit, identity };
}
function digest(file) {
  const hash = crypto.createHash('sha256'), buffer = Buffer.alloc(256 * 1024), fd = fs.openSync(file, 'r');
  try { for (let count; (count = fs.readSync(fd, buffer)) > 0;) hash.update(buffer.subarray(0, count)); }
  finally { fs.closeSync(fd); }
  return hash.digest('hex');
}
function copyRegular(source, destination) {
  const stat = fs.lstatSync(source);
  if (stat.isSymbolicLink()) throw new Error('MSIX_PROTOTYPE_SOURCE_LINK_REJECTED');
  if (stat.isDirectory()) {
    fs.mkdirSync(destination, { recursive: true });
    for (const name of fs.readdirSync(source)) copyRegular(path.join(source, name), path.join(destination, name));
  } else if (stat.isFile()) { fs.mkdirSync(path.dirname(destination), { recursive: true }); fs.copyFileSync(source, destination); }
  else throw new Error('MSIX_PROTOTYPE_SPECIAL_FILE_REJECTED');
}
async function boundedLicense(version) {
  const response = await fetch(`https://raw.githubusercontent.com/nodejs/node/${version}/LICENSE`, { redirect: 'error', signal: AbortSignal.timeout(30_000) });
  if (!response.ok || !response.body) throw new Error('MSIX_NODE_LICENSE_UNAVAILABLE');
  const chunks = []; let bytes = 0;
  for await (const chunk of response.body) { bytes += chunk.length; if (bytes > 2 * 1024 * 1024) throw new Error('MSIX_NODE_LICENSE_TOO_LARGE'); chunks.push(Buffer.from(chunk)); }
  const result = Buffer.concat(chunks);
  if (!result.toString('utf8').includes('Permission is hereby granted')) throw new Error('MSIX_NODE_LICENSE_INVALID');
  return result;
}
export async function buildMsixPrototype(root) {
  if (process.platform !== 'win32') throw new Error('MSIX_PROTOTYPE_REQUIRES_WINDOWS');
  const { commit, identity } = prototypePreflight(root);
  const sdk = path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Windows Kits', '10', 'bin');
  const makeappx = fs.readdirSync(sdk).filter(value => /^\d+\.\d+\.\d+\.\d+$/.test(value))
    .sort((a, b) => b.localeCompare(a, undefined, { numeric: true })).map(value => path.join(sdk, value, 'x64', 'makeappx.exe')).find(fs.existsSync);
  if (!makeappx) throw new Error('MSIX_SDK_UNAVAILABLE');
  const windows = process.env.SystemRoot || 'C:\\Windows';
  const env = factoryEnvironment();
  const node = fs.realpathSync(process.execPath), encoded = Buffer.from(node).toString('base64');
  const signature = spawnSync(path.join(windows, 'System32/WindowsPowerShell/v1.0/powershell.exe'), ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command',
    `$s=Get-AuthenticodeSignature -LiteralPath ([Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encoded}'))); [Console]::Out.Write([string]$s.Status+'|'+[string]$s.SignerCertificate.Subject)`],
  { env, encoding: 'utf8', timeout: 30_000, windowsHide: true });
  if (signature.status !== 0 || !/^Valid\|.*(?:OpenJS Foundation|Node\.js Foundation)/i.test(signature.stdout.trim())) throw new Error('MSIX_NODE_SIGNATURE_NOT_VERIFIED');
  const version = process.version;
  if (!/^v\d+\.\d+\.\d+$/.test(version)) throw new Error('MSIX_NODE_VERSION_INVALID');
  const license = await boundedLicense(version);
  const output = fs.mkdtempSync(path.join(os.tmpdir(), 'edgeview-msix-candidate-'));
  const app = path.join(output, 'app'); fs.mkdirSync(app);
  const execute = (executable, args, cwd, label) => {
    const log = fs.openSync(path.join(output, `${label}.log`), 'wx');
    let result;
    try { result = spawnSync(executable, args, { cwd, env, stdio: ['ignore', log, log], windowsHide: true, timeout: 600_000 }); }
    finally { fs.closeSync(log); }
    if (result.status !== 0) throw new Error(`MSIX_PROTOTYPE_${label.toUpperCase()}_FAILED`);
  };
  try {
    // Explicit source allowlist. No source config/database/identity/log/evidence
    // directory is copied; npm lifecycle scripts and customer registry config are disabled.
    const inputs = await runtimePackageInputs(root);
    const notices = runtimeSourceNotices(root, inputs);
    fs.writeFileSync(path.join(app, 'package.json'), JSON.stringify(inputs.manifest, null, 2));
    fs.writeFileSync(path.join(app, 'package-lock.json'), JSON.stringify(inputs.seedLock, null, 2));
    fs.writeFileSync(path.join(app, 'THIRD_PARTY_NOTICES.txt'), notices.document);
    const distNames = new Set(['index.html', 'server.cjs', 'server.cjs.map', 'build-info.json', 'edgeview-mark.png', 'assets']);
    for (const name of fs.readdirSync(path.join(root, 'dist'))) {
      if (!distNames.has(name)) throw new Error('MSIX_UNREVIEWED_BUILD_OUTPUT');
      if (name === 'assets') {
        for (const asset of fs.readdirSync(path.join(root, 'dist/assets'))) {
          if (!/^index-[A-Za-z0-9_-]+\.(?:js|css)$/.test(asset)) throw new Error('MSIX_UNREVIEWED_BUILD_ASSET');
          copyRegular(path.join(root, 'dist/assets', asset), path.join(app, 'dist/assets', asset));
        }
      } else copyRegular(path.join(root, 'dist', name), path.join(app, 'dist', name));
    }
    copyRegular(path.join(root, 'packaging/windows/runtime-bootstrap.cjs'), path.join(app, 'runtime-bootstrap.cjs'));
    copyRegular(node, path.join(app, 'runtime/node.exe'));
    fs.writeFileSync(path.join(app, 'runtime/NODE_LICENSE.txt'), license);
    copyRegular(path.join(root, 'public/edgeview-mark.png'), path.join(app, 'Assets/PrototypeLogo.png'));
    const npm = path.join(path.dirname(node), 'node_modules/npm/bin/npm-cli.js');
    if (!fs.existsSync(npm)) throw new Error('MSIX_FACTORY_NPM_UNAVAILABLE');
    const npmArgs = prototypeNpmArgs(output);
    execute(node, [npm, 'install', '--package-lock-only', ...npmArgs.slice(1)], app, 'runtime-lock');
    verifyRuntimeManifest(inputs, JSON.parse(fs.readFileSync(path.join(app, 'package.json'), 'utf8')));
    const runtimeLock = JSON.parse(fs.readFileSync(path.join(app, 'package-lock.json'), 'utf8'));
    const runtimeLockEvidence = verifyRuntimeLock(inputs, runtimeLock);
    execute(node, [npm, ...npmArgs], app, 'dependencies');
    verifyRuntimeManifest(inputs, JSON.parse(fs.readFileSync(path.join(app, 'package.json'), 'utf8')));
    const runtimeLockSha256 = digest(path.join(app, 'package-lock.json'));
    verifyRuntimeLock(inputs, JSON.parse(fs.readFileSync(path.join(app, 'package-lock.json'), 'utf8')));
    const compiler = path.join(windows, 'Microsoft.NET/Framework64/v4.0.30319/csc.exe');
    execute(compiler, ['/nologo', '/target:winexe', '/platform:x64', '/reference:System.Windows.Forms.dll', '/reference:System.Drawing.dll',
      '/reference:System.Web.Extensions.dll', `/out:${path.join(app, 'EdgeView.exe')}`, path.join(root, 'packaging/windows/EdgeViewLauncher.cs')], root, 'launcher');
    let manifest = fs.readFileSync(path.join(root, 'packaging/prototype-msix/AppxManifest.xml'), 'utf8');
    manifest = manifest.replace('Version="0.0.0.1"', 'Version="0.0.0.2"').replace('Executable="runtime\\node.exe"', 'Executable="EdgeView.exe"')
      .replace(/\s+uap11:Parameters="[^"]*"/, '');
    fs.writeFileSync(path.join(app, 'AppxManifest.xml'), manifest);
    const files = [];
    const visit = (relative = '') => {
      for (const entry of fs.readdirSync(path.join(app, relative), { withFileTypes: true })) {
        const child = relative ? `${relative}/${entry.name}` : entry.name;
        if (child === 'node_modules/mammoth/test') continue; // SDK-invalid vendor fixture, previously reproduced.
        if (entry.isSymbolicLink()) throw new Error('MSIX_PAYLOAD_LINK_REJECTED');
        if (entry.isDirectory()) visit(child);
        else if (entry.isFile()) {
          if (/^(?:config(?:\.prev)?\.json|edgeview(?:_db\.json|\.db(?:\..*)?)|\.env(?:\..*)?)$/i.test(entry.name)) throw new Error('MSIX_PRIVATE_STATE_REJECTED');
          files.push({ path: child, bytes: fs.statSync(path.join(app, child)).size, sha256: digest(path.join(app, child)) });
        } else throw new Error('MSIX_PAYLOAD_SPECIAL_FILE_REJECTED');
      }
    };
    visit();
    const mapping = path.join(output, 'mapping.txt');
    fs.writeFileSync(mapping, '[Files]\r\n' + files.map(file => `"${path.join(app, file.path)}" "${file.path.replaceAll('/', '\\')}"`).join('\r\n') + '\r\n');
    const name = `EdgeView-${identity.version}-${commit.slice(0, 7)}-UNSIGNED.msix`, archive = path.join(output, name);
    execute(makeappx, ['pack', '/f', mapping, '/p', archive, '/no', '/ml', '536870912'], root, 'makeappx');
    const report = { status: 'UNSIGNED_INTERNAL_NOT_RELEASE_READY', customerRuntimeReady: false, commit, build: identity,
      manifestVersion: '0.0.0.2', runtimeInputs: { ...runtimeLockEvidence, runtimeLockSha256, excludedBuildRoots: inputs.excludedBuildRoots, sourceLockSha256: notices.sourceLockSha256, noticesSha256: notices.noticesSha256, noticeCapture: notices.capture }, runtime: { version, sha256: digest(node), authenticode: 'VALID_VENDOR_SIGNATURE', licenseSha256: crypto.createHash('sha256').update(license).digest('hex') },
      package: { name, sha256: digest(archive), files: files.length }, files,
      blockers: ['Publisher/trusted signing absent', 'Native launcher not executed by this factory', 'Installed/clean-Windows/update/rollback acceptance absent',
        'Current Node release/security assessment required', 'Runtime dependency/test/source-map minimization and full OSS/security clearance pending',
        'Company truthsets, migration/recovery and final visual acceptance incomplete', 'Prototype monitoring deliberately disabled'] };
    fs.writeFileSync(path.join(output, 'release-info.json'), JSON.stringify(report, null, 2));
    fs.writeFileSync(path.join(output, 'SHA256SUMS.txt'), `${report.package.sha256}  ${name}\n`);
    return { output, archive, sha256: report.package.sha256, files: files.length, status: report.status };
  } catch (error) {
    fs.writeFileSync(path.join(output, 'FAILED.json'), JSON.stringify({ status: 'FAILED_NOT_A_RELEASE', code: error.message }));
    throw error;
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 2) throw new Error('Prototype factory accepts no runtime path, destination or shell input.');
  console.log(JSON.stringify(await buildMsixPrototype(process.cwd())));
}
