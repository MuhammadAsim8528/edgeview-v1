import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const deliverables = path.resolve(root, '..', '..', 'outputs');
const stage = path.join(deliverables, 'EdgeView-V1-Windows');
const zip = path.join(deliverables, 'EdgeView-V1-Windows.zip');
const excludedNames = new Set([
  '.git', '.agent', '.antigravity', '.vscode', '.npm-cache', '.test-cache', 'node_modules', 'data', 'uploads', 'backups', 'logs', 'AGENTS.md',
  'config.json', 'edgeview.db', 'edgeview.db.lock', 'edgeview_db.json',
]);
const excludedPatterns = [/^\.env(?:\.|$)/i, /^edgeview\.db(?:[-.].*)?$/i, /\.log$/i, /\.tmp$/i];
const includedDirectories = ['assets', 'dist', 'public', 'server', 'shared', 'src', 'docs'];
const includedFiles = [
  '.gitignore', 'EDGEVIEW_ARCHITECTURE.md', 'EDGEVIEW_CONTROL_AUDIT.md', 'EDGEVIEW_LICENSING_DESIGN.md', 'EDGEVIEW_OPERATIONS.md',
  'EDGEVIEW_QA_REPORT.md', 'EDGEVIEW_SECURITY_AUDIT.md', 'EDGEVIEW_V1_VERIFICATION.md', 'EdgeView.bat', 'README.md', 'index.html',
  'package-lock.json', 'package.json', 'tsconfig.json', 'vite.config.ts',
];

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
    else if (entry.isFile()) fs.copyFileSync(from, to);
  }
}

fs.mkdirSync(deliverables, { recursive: true });
fs.rmSync(stage, { recursive: true, force: true });
fs.rmSync(zip, { force: true });
fs.mkdirSync(stage, { recursive: true });
for (const directory of includedDirectories) copyTree(path.join(root, directory), path.join(stage, directory), directory);
fs.mkdirSync(path.join(stage, 'scripts'), { recursive: true });
fs.copyFileSync(path.join(root, 'scripts', 'build-if-needed.mjs'), path.join(stage, 'scripts', 'build-if-needed.mjs'));
fs.copyFileSync(path.join(root, 'scripts', 'verify-package.mjs'), path.join(stage, 'scripts', 'verify-package.mjs'));
for (const file of includedFiles) fs.copyFileSync(path.join(root, file), path.join(stage, file));

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

const archived = spawnSync('tar', ['-a', '-c', '-f', zip, '-C', deliverables, path.basename(stage)], { encoding: 'utf8' });
if (archived.status !== 0) throw new Error(archived.stderr || 'Failed to create Windows ZIP');
console.log(JSON.stringify({ stage, zip }));
