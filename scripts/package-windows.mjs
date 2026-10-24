import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { verifyPackage } from './verify-package.mjs';

const root = process.cwd();
const deliverables = path.resolve(root, '..', '..', 'outputs');
const destinationStage = path.join(deliverables, 'EdgeView-V1-Windows');
const destinationZip = path.join(deliverables, 'EdgeView-V1-Windows.zip');
const excludedNames = new Set([
  '.git', '.agent', '.antigravity', '.vscode', '.npm-cache', '.test-cache', 'node_modules', 'data', 'uploads', 'backups', 'logs', 'AGENTS.md', 'docs',
  'config.json', 'edgeview.db', 'edgeview.db.lock', 'edgeview_db.json',
]);
const excludedPatterns = [/^\.env(?:\.|$)/i, /^edgeview\.db(?:[-.].*)?$/i, /\.log$/i, /\.tmp$/i];
// The internal docs tree is a developer map, not operator guidance; EDGEVIEW_OPERATIONS.md ships instead.
const includedDirectories = ['assets', 'dist', 'public', 'server', 'shared', 'src'];
const includedFiles = [
  '.gitignore', 'EDGEVIEW_ARCHITECTURE.md', 'EDGEVIEW_ENGINEERING_AUDIT.md', 'EDGEVIEW_CONTROL_AUDIT.md', 'EDGEVIEW_LICENSING_DESIGN.md', 'EDGEVIEW_OPERATIONS.md',
  'EDGEVIEW_QA_REPORT.md', 'EDGEVIEW_SECURITY_AUDIT.md', 'EDGEVIEW_V1_VERIFICATION.md', 'EdgeView.bat', 'README.md', 'index.html',
  'package-lock.json', 'package.json', 'tsconfig.json', 'vite.config.ts', 'server.ts', 'eslint.config.js',
];

function copyFile(source, target) {
  fs.copyFileSync(source, target);
  const stat = fs.statSync(source);
  fs.utimesSync(target, stat.atime, stat.mtime);
}

function copyTree(source, target, relative = '') {
  fs.mkdirSync(target, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    if (excludedNames.has(entry.name) || excludedPatterns.some(pattern => pattern.test(entry.name))) continue;
    const childRelative = relative ? `${relative}/${entry.name}` : entry.name;
    if (childRelative === 'server/tests' || childRelative.startsWith('server/tests/') || childRelative === 'src/components/Settings.tsx' || childRelative === 'src/components/SettingsTab.tsx') continue;
    if (childRelative === 'dist/server-proof.cjs' || childRelative === 'dist/server-meta.json') continue;
    const from = path.join(source, entry.name);
    const to = path.join(target, entry.name);
    if (entry.isDirectory()) copyTree(from, to, childRelative);
    else if (entry.isFile()) copyFile(from, to);
  }
  const stat = fs.statSync(source);
  fs.utimesSync(target, stat.atime, stat.mtime);
}

fs.mkdirSync(deliverables, { recursive: true });
if (fs.existsSync(destinationStage)) verifyPackage(destinationStage, { rejectUnexpected: true });
const buildRoot = fs.mkdtempSync(path.join(deliverables, '.edgeview-package-'));
const stage = path.join(buildRoot, 'EdgeView-V1-Windows');
const zip = path.join(buildRoot, 'EdgeView-V1-Windows.zip');
let retainRecovery = false;
try {
fs.mkdirSync(stage, { recursive: true });
for (const directory of includedDirectories) copyTree(path.join(root, directory), path.join(stage, directory), directory);
fs.mkdirSync(path.join(stage, 'scripts'), { recursive: true });
for (const script of ['build-if-needed.mjs','verify-package.mjs','dev-server.mjs','ensure-dependencies.mjs','doctor.mjs','backup-runtime.mjs','build-metadata.mjs']) copyFile(path.join(root,'scripts',script), path.join(stage,'scripts',script));
for (const file of includedFiles) copyFile(path.join(root, file), path.join(stage, file));

const prohibited = [];
function audit(directory, relative = '') {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const child = relative ? `${relative}/${entry.name}` : entry.name;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) audit(absolute, child);
    else if (/(^|\/)config\.json$|(^|\/)\.env(?:\.|$)|\.db(?:[-.].*)?$|(^|\/)edgeview_db\.json$/i.test(child)) prohibited.push(child);
  }
}
audit(stage);
if (prohibited.length) throw new Error(`Package contains prohibited sensitive/state files: ${prohibited.join(', ')}`);

// A shipped document must not hand the build machine's layout to the operator's machine.
const builderPaths = [...new Set([os.homedir(), process.env.USERPROFILE, process.env.HOME, root]
  .filter(Boolean).map(directory => path.resolve(directory)).filter(directory => directory.length > 3))];
// Both separators are searched: a document may quote the path as C:\Users\... or C:/Users/... or file:///C:/Users/...
const needleForms = builderPaths.flatMap(directory => [directory.replace(/\\/g, '/'), directory.replace(/\//g, '\\')].map(needle => needle.toLowerCase()));
const textFile = /\.(?:md|txt|json|map|ts|tsx|js|mjs|cjs|html|htm|css|svg|xml|yml|yaml|bat|cmd|ps1|csv|ini|gitignore|editorconfig)$/i;
const leaked = [];
function scanForBuilderPaths(directory, relative = '') {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const child = relative ? `${relative}/${entry.name}` : entry.name;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) scanForBuilderPaths(absolute, child);
    else if (entry.isFile() && textFile.test(entry.name)) {
      const bytes = fs.readFileSync(absolute);
      // UTF-16 text decodes to NUL-padded bytes under utf8, so both decodings are searched.
      const haystacks = [bytes.toString('utf8'), bytes.toString('utf16le')].map(text => text.toLowerCase());
      if (haystacks.some(text => needleForms.some(needle => text.includes(needle)))) leaked.push(child);
    }
  }
}
scanForBuilderPaths(stage);
if (leaked.length) throw new Error(`Package leaks a build-machine path in: ${leaked.join(', ')}. Remove the absolute path before packaging.`);

const manifest = [];
function hashTree(directory, relative = '') {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const child = relative ? `${relative}/${entry.name}` : entry.name;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) hashTree(absolute, child);
    else if (entry.isFile()) {
      const bytes = fs.readFileSync(absolute);
      manifest.push({ path: child.replace(/\\/g, '/'), bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex') });
    }
  }
}
hashTree(stage);
fs.writeFileSync(path.join(stage, 'PACKAGE_MANIFEST.json'), `${JSON.stringify({ format: 1, files: manifest }, null, 2)}\n`, 'utf8');

const systemTar = path.join(process.env.SystemRoot ?? '', 'System32', 'tar.exe');
// A bash-flavoured PATH can put GNU tar first, which reads C:\... as a remote share and, on other
// hosts, silently writes an uncompressed tarball behind the .zip name.
const archiver = process.platform === 'win32' && fs.existsSync(systemTar) ? systemTar : 'tar';
const archived = spawnSync(archiver, ['-a', '-c', '-f', zip, '-C', buildRoot, path.basename(stage)], { encoding: 'utf8' });
if (archived.status !== 0) throw new Error(archived.stderr || `Failed to create Windows ZIP with ${archiver}`);
if (fs.statSync(zip).size < 4) throw new Error('Windows ZIP is too small to be an archive.');
const descriptor = fs.openSync(zip, 'r');
const signature = Buffer.alloc(4);
try { fs.readSync(descriptor, signature, 0, 4, 0); } finally { fs.closeSync(descriptor); }
if (signature.readUInt32LE(0) !== 0x04034b50) throw new Error(`${archiver} produced an archive without a ZIP local-file header; refusing to publish it as a ZIP.`);
verifyPackage(stage, { rejectUnexpected: true });
if (fs.existsSync(destinationStage)) verifyPackage(destinationStage, { rejectUnexpected: true });
const oldStage = path.join(buildRoot, 'previous-stage');
const oldZip = path.join(buildRoot, 'previous.zip');
let publishedStage = false;
try {
  if (fs.existsSync(destinationStage)) fs.renameSync(destinationStage, oldStage);
  if (fs.existsSync(destinationZip)) fs.renameSync(destinationZip, oldZip);
  fs.renameSync(stage, destinationStage); publishedStage = true;
  fs.renameSync(zip, destinationZip);
} catch (error) {
  retainRecovery = true;
  if (publishedStage) fs.renameSync(destinationStage, stage);
  if (fs.existsSync(oldStage)) fs.renameSync(oldStage, destinationStage);
  if (fs.existsSync(oldZip)) fs.renameSync(oldZip, destinationZip);
  retainRecovery = false;
  throw error;
}
console.log(JSON.stringify({ stage: destinationStage, zip: destinationZip, archiver }));
} finally {
  if (!retainRecovery) fs.rmSync(buildRoot, { recursive: true, force: true });
  else console.error(`Packaging recovery files retained at ${buildRoot}`);
}
