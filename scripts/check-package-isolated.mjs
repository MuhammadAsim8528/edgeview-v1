import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { sourceDigest, artifactDigest, readBuildIdentity } from '../shared/build_identity.mjs';
import { verifyPackage } from './verify-package.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export function ownedPackagePaths(scratch) {
  const project = path.join(scratch, 'workspace', 'edgeview');
  const output = path.resolve(project, '..', '..', 'outputs');
  if (path.dirname(output) !== path.resolve(scratch)) throw new Error('Output isolation failed.');
  return { project, output, stage: path.join(output, 'EdgeView-V1-Windows'), zip: path.join(output, 'EdgeView-V1-Windows.zip') };
}
export function checkPackageIsolated(projectRoot = root) {
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => /^(PATH|SystemRoot|WINDIR|COMSPEC|HOME|USERPROFILE|TEMP|TMP|APPDATA|LOCALAPPDATA)$/i.test(key)));
  const execute = (program, args, cwd, input) => {
    const result = spawnSync(program, args, { cwd, env, input, timeout: 120_000, maxBuffer: 64 * 1024 * 1024, windowsHide: true });
    if (result.error || result.status !== 0) throw new Error(`Isolated package check command failed: ${program}`);
    return result.stdout;
  };
  // Tracked edits cannot silently enter a committed-source packaging claim.
  execute('git', ['diff', '--exit-code', 'HEAD', '--'], projectRoot);
  execute('git', ['diff', '--cached', '--exit-code', 'HEAD', '--'], projectRoot);
  const commit = execute('git', ['rev-parse', 'HEAD'], projectRoot).toString().trim();
  const identity = readBuildIdentity(projectRoot);
  if (!identity.available || identity.gitCommit !== commit || identity.sourceHash !== sourceDigest(projectRoot)
    || identity.artifactHash !== artifactDigest(projectRoot)) throw new Error('Build the exact current commit before isolated packaging.');
  const tempParent = fs.realpathSync(os.tmpdir());
  const scratch = fs.mkdtempSync(path.join(tempParent, 'edgeview-isolated-package-'));
  try {
    const locations = ownedPackagePaths(scratch);
    fs.mkdirSync(locations.project, { recursive: true });
    // Copy only tracked inputs, preserving the native bytes used by this build.
    // Git archive/checkout filters can change mixed LF/CRLF working-tree bytes.
    const tracked = execute('git', ['ls-files', '-z'], projectRoot).toString('utf8').split('\0').filter(Boolean);
    for (const relative of tracked) {
      if (path.isAbsolute(relative) || relative.includes('\\') || relative.includes(':') || relative.split('/').some(part => part === '..' || part === '.')) throw new Error('Unsafe tracked input path.');
      const source = path.join(projectRoot, relative);
      const target = path.join(locations.project, relative);
      if (!fs.lstatSync(source).isFile()) throw new Error('Tracked input must be a regular file.');
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(source, target);
    }
    execute('git', ['diff', '--exit-code', 'HEAD', '--'], projectRoot);
    if (execute('git', ['rev-parse', 'HEAD'], projectRoot).toString().trim() !== commit) throw new Error('Source commit changed during snapshot.');
    fs.cpSync(path.join(projectRoot, 'dist'), path.join(locations.project, 'dist'), { recursive: true, errorOnExist: true, force: false });
    // Also detects runtime-affecting untracked files omitted by git archive.
    if (sourceDigest(locations.project) !== identity.sourceHash || artifactDigest(locations.project) !== identity.artifactHash) throw new Error('Committed snapshot/build content mismatch.');
    execute(process.execPath, ['scripts/package-windows.mjs'], locations.project);
    const verified = verifyPackage(locations.stage, { rejectUnexpected: true });
    execute(process.execPath, ['scripts/package-launch-check.test.mjs', locations.stage], locations.project);
    const manifest = JSON.parse(fs.readFileSync(path.join(locations.stage, 'PACKAGE_MANIFEST.json'), 'utf8'));
    const privacyUnexpected = manifest.files.filter(item => /(^|\/)(?:\.env(?:\..*)?|config(?:\.prev)?\.json|edgeview_db\.json|.*\.db(?:[-.].*)?|\.git|data|uploads|logs|backups)(?:\/|$)/i.test(item.path));
    if (privacyUnexpected.length) throw new Error('Runtime/private files entered the isolated package.');
    const developmentFiles = manifest.files.filter(item => /^(?:src\/|server\/|docs\/)|^EDGEVIEW_.*(?:AUDIT|QA).*\.md$|\.(?:ts|tsx)$/i.test(item.path)).map(item => item.path);
    return { qaOnly: true, commit, buildId: identity.buildId, manifest: verified,
      zipSha256: crypto.createHash('sha256').update(fs.readFileSync(locations.zip)).digest('hex'),
      unchangedLaunchCheck: 'PASS', privacyFileCheck: 'PASS', customerRuntimeReady: false,
      developmentFileCount: developmentFiles.length,
      limitation: 'Disposable developer ZIP verified, then removed. Contains source/development inputs and requires installed Node/npm; not customer-only, clean Windows, installer, browser or update acceptance.' };
  } finally {
    // Generated and canonicalized above, never supplied by a request or manifest.
    if (path.dirname(scratch) !== tempParent || !path.basename(scratch).startsWith('edgeview-isolated-package-')) throw new Error('Unexpected cleanup boundary; scratch retained.');
    fs.rmSync(scratch, { recursive: true, force: true });
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(JSON.stringify(checkPackageIsolated(), null, 2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
