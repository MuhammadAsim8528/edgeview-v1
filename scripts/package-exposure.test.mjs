import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

// The packager's own allowlists, repeated here as the contract the deliverable must honour.
const includedDirectories = ['assets', 'dist', 'public', 'server', 'shared', 'src'];
const includedFiles = ['.gitignore', 'EDGEVIEW_ARCHITECTURE.md', 'EDGEVIEW_ENGINEERING_AUDIT.md', 'EDGEVIEW_CONTROL_AUDIT.md', 'EDGEVIEW_LICENSING_DESIGN.md', 'EDGEVIEW_OPERATIONS.md', 'EDGEVIEW_QA_REPORT.md', 'EDGEVIEW_SECURITY_AUDIT.md', 'EDGEVIEW_V1_VERIFICATION.md', 'EdgeView.bat', 'README.md', 'index.html', 'package-lock.json', 'package.json', 'tsconfig.json', 'vite.config.ts', 'server.ts', 'eslint.config.js'];
const shippedScripts = ['build-if-needed.mjs', 'verify-package.mjs', 'dev-server.mjs', 'ensure-dependencies.mjs', 'doctor.mjs', 'backup-runtime.mjs', 'build-metadata.mjs'];
const CANARY = 'NEVER_SHIP_THIS_SENTINEL';

const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'edgeview-package-exposure-')));
const project = path.join(root, 'worktree', 'checkout', 'pharma');
const outputs = path.join(root, 'worktree', 'outputs');
const stage = path.join(outputs, 'EdgeView-V1-Windows');
const write = (relative, body) => { const target = path.join(project, relative); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, body); };
try {
  for (const directory of includedDirectories) write(`${directory}/.keep`, 'placeholder');
  for (const file of includedFiles) write(file, `${file} body`);
  write('docs/OUTSTANDING_WORK.md', `${CANARY} internal ledger`);
  write('docs/CREDENTIAL_STORAGE.md', `${CANARY} where the secrets live`);
  write('server/docs/NESTED.md', `${CANARY} nested developer map`);
  write('src/docs/DEEPER/INNER.md', `${CANARY} deep developer map`);
  write('public/data/private.json', `${CANARY} runtime data`);
  write('public/config.json', `${CANARY} dpapi wrapper`);
  write('public/.env.local', `${CANARY} provider key`);
  write('src/AGENTS.md', `${CANARY} agent instructions`);
  write('src/logs/retained.md', `${CANARY} runtime log folder`);
  write('src/uploads/document.pdf', `${CANARY} user document`);
  write('shared/backups/edgeview.db.json', `${CANARY} backup`);
  write('assets/node_modules/pkg/index.js', `${CANARY} vendored dependency`);
  write('public/.git/config', `${CANARY} repository metadata`);
  write('src/main.tsx', 'export const App = 1;');
  write('dist/server.cjs', 'console.log(1);');
  write('server/tests/secret.test.ts', `${CANARY} test source`);
  write('EdgeView.bat', '@echo off');
  for (const script of shippedScripts) write(`scripts/${script}`, '// shipped launcher helper');
  write('scripts/package-windows.mjs', '// the packager itself must not be a runtime dependency');
  write('scripts/generate-third-party-notices.mjs', `${CANARY} release engineering tool`);

  const systemTar = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe');
  const run = spawnSync(process.execPath, [path.resolve('scripts/package-windows.mjs')], { cwd: project, encoding: 'utf8' });
  assert.equal(run.status, 0, `packaging failed: ${run.stderr}`);
  if (process.platform === 'win32' && fs.existsSync(systemTar)) assert.equal(JSON.parse(run.stdout).archiver, systemTar, 'the Windows build must use the system archiver');
  assert.deepEqual([...fs.readFileSync(path.join(outputs, 'EdgeView-V1-Windows.zip')).subarray(0, 4)], [0x50, 0x4b, 0x03, 0x04], 'the published artifact really is a ZIP');
  assert.ok(fs.existsSync(stage) && fs.existsSync(path.join(outputs, 'EdgeView-V1-Windows.zip')));
  assert.equal(fs.existsSync(path.join(project, 'docs')), true, 'the source docs tree must still exist for the assertion to mean anything');

  const manifest = JSON.parse(fs.readFileSync(path.join(stage, 'PACKAGE_MANIFEST.json'), 'utf8'));
  const paths = manifest.files.map(item => item.path);
  assert.ok(paths.some(item => item === 'EDGEVIEW_OPERATIONS.md'), 'the operator guide still ships');
  assert.ok(paths.some(item => item === 'src/main.tsx') && paths.some(item => item === 'dist/server.cjs'), 'runtime inputs still ship');
  assert.deepEqual(paths.filter(item => /^docs\//.test(item)), [], 'the internal docs tree must not ship');
  assert.deepEqual(paths.filter(item => /(^|\/)docs\//.test(item)), [], 'no docs directory ships at any depth');
  assert.deepEqual(paths.filter(item => /(^|\/)(?:\.env|config\.json|data\/|logs\/|uploads\/|backups\/|node_modules\/|\.git\/|AGENTS\.md|tests\/|package-windows\.mjs|generate-third-party-notices\.mjs)/.test(item)), [], 'state, secrets, tests and release tooling stay out of the deliverable');
  assert.deepEqual(fs.readdirSync(path.join(stage, 'scripts')).sort(), [...shippedScripts].sort(), 'only the allowlisted launcher helpers ship');

  const scanned = [];
  const walk = (directory, relative = '') => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const child = relative ? `${relative}/${entry.name}` : entry.name;
      if (entry.isDirectory()) { assert.notEqual(entry.name, 'docs', `a docs directory entered the stage at ${child}`); walk(path.join(directory, entry.name), child); }
      else if (entry.isFile()) { if (fs.readFileSync(path.join(directory, entry.name), 'utf8').includes(CANARY)) scanned.push(child); }
    }
  };
  walk(stage);
  assert.deepEqual(scanned, [], 'no internal-document content is readable inside the deliverable');

  const listed = spawnSync(fs.existsSync(systemTar) ? systemTar : 'tar', ['-t', '-f', path.join(outputs, 'EdgeView-V1-Windows.zip')], { encoding: 'utf8' });
  assert.equal(listed.status, 0, listed.stderr);
  const archive = listed.stdout.split(/\r?\n/).filter(Boolean);
  assert.deepEqual(archive.filter(item => /(^|\/)docs\//.test(item)), [], 'the ZIP itself carries no docs path');
  assert.ok(archive.some(item => /(^|\/)EDGEVIEW_OPERATIONS\.md$/.test(item)), 'the ZIP still carries the operator guide');
  assert.ok(archive.some(item => /(^|\/)EdgeView\.bat$/.test(item)), 'the ZIP still carries the launcher');
  console.log(`PASS deliverable excludes the internal docs tree at every depth, keeps the operator guide, runtime inputs and allowlisted helpers, and publishes a real ZIP from the resolved archiver (manifest ${manifest.files.length} files)`);
} finally { fs.rmSync(root, { recursive: true, force: true }); }
