import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { sourceDigest, artifactDigest } from '../shared/build_identity.mjs';
import { unusedTestPort } from './test-server-port.mjs';
import { runtimePackageInputs, verifyRuntimeLock, verifyRuntimeManifest } from './runtime-package-inputs.mjs';
import JSZip from 'jszip';

// Factory acceptance, not an installer/updater or a test of the owner's live app.
const root = path.resolve(process.argv[2] || '');
const expectedSha256 = process.argv[3];
if (process.platform !== 'win32' || process.argv.length !== 4 || fs.lstatSync(root).isSymbolicLink()) throw new Error('Specify the internal candidate directory and independently recorded factory SHA256 on Windows.');
assert.match(expectedSha256 || '', /^[a-f0-9]{64}$/);
const reportFile = path.join(root, 'release-info.json');
inspectAncestors(reportFile);
if (fs.statSync(reportFile).size > 8 * 1024 * 1024) throw new Error('Candidate report exceeds inspection bound.');
const report = JSON.parse(fs.readFileSync(reportFile, 'utf8'));
assert.equal(report.status, 'UNSIGNED_INTERNAL_NOT_RELEASE_READY');
assert.match(report.package.name, /^EdgeView-[a-zA-Z0-9.-]+-UNSIGNED\.msix$/);
const hash = file => {
  const h = crypto.createHash('sha256'), bytes = Buffer.alloc(256 * 1024), fd = fs.openSync(file, 'r');
  try { for (let count; (count = fs.readSync(fd, bytes)) > 0;) h.update(bytes.subarray(0, count)); }
  finally { fs.closeSync(fd); }
  return h.digest('hex');
};
function inspectAncestors(file) {
  let cursor = path.resolve(file);
  while (true) {
    if (fs.lstatSync(cursor).isSymbolicLink()) throw new Error('Candidate inspection refuses linked ancestors.');
    const parent = path.dirname(cursor); if (parent === cursor) break; cursor = parent;
  }
}
inspectAncestors(root);
assert.equal(report.package.sha256, expectedSha256);
assert.equal(hash(path.join(root, report.package.name)), expectedSha256);
// Re-extract that exact archive rather than trusting a mutable previous unpack.
// The independent expected hash is a factory evidence input, not publisher trust
// or a safe updater design for arbitrary Internet packages.
const inspection = fs.mkdtempSync(path.join(root, 'package-inspection-'));
const app = path.join(inspection, 'app');
const sdk = path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Windows Kits/10/bin');
const makeappx = fs.readdirSync(sdk).filter(value => /^\d+\.\d+\.\d+\.\d+$/.test(value))
  .sort((a, b) => b.localeCompare(a, undefined, { numeric: true })).map(value => path.join(sdk, value, 'x64/makeappx.exe')).find(fs.existsSync);
assert.ok(makeappx, 'SDK extraction tool required');
const inspectionEnv = Object.fromEntries(Object.entries(process.env).filter(([key]) => /^(PATH|SystemRoot|WINDIR|COMSPEC|USERPROFILE|TEMP|TMP|APPDATA|LOCALAPPDATA)$/i.test(key)));
const log = fs.openSync(path.join(inspection, 'unpack.log'), 'wx');
try {
  const unpacked = spawnSync(makeappx, ['unpack', '/p', path.join(root, report.package.name), '/d', app, '/no'],
    { env: inspectionEnv, stdio: ['ignore', log, log], windowsHide: true, timeout: 600_000 });
  assert.equal(unpacked.status, 0, 'SDK must finish before runtime can start');
} finally { fs.closeSync(log); }
inspectAncestors(app);
assert.equal(sourceDigest(process.cwd()), report.build.sourceHash, 'candidate must match the reviewed source currently under test');
assert.equal(artifactDigest(app), report.build.artifactHash, 'extracted build differs from the exact compiled artifact');
// An untrusted manifest alone cannot authorize executing a binary. This factory
// only runs the byte-identical vendor Node already executing this verifier.
assert.equal(hash(path.join(app, 'runtime/node.exe')), hash(process.execPath));
assert.equal(report.runtime.sha256, hash(process.execPath));
for (const entry of report.files) {
  assert.ok(typeof entry.path === 'string' && !entry.path.includes('\\') && !entry.path.split('/').some(part => !part || part === '..' || part === '.') && !/[:\x00-\x1f]/.test(entry.path));
  const file = path.resolve(app, entry.path);
  assert.ok(file.startsWith(app + path.sep)); inspectAncestors(file);
  assert.ok(fs.lstatSync(file).isFile());
  assert.equal(fs.statSync(file).size, entry.bytes); assert.equal(hash(file), entry.sha256);
}
assert.equal(fs.existsSync(path.join(app, 'node_modules/mammoth/test')), false);
assert.ok(fs.statSync(path.join(app, 'dist/fatal-reporter.cjs')).isFile());
for (const name of ['config.json', 'config.prev.json', '.env', 'edgeview.db', 'edgeview_db.json', 'data', 'logs', 'uploads', 'backups']) {
  assert.equal(fs.existsSync(path.join(app, name)), false, 'package must not carry customer state');
}
const inputs = await runtimePackageInputs(process.cwd());
verifyRuntimeManifest(inputs, JSON.parse(fs.readFileSync(path.join(app, 'package.json'), 'utf8')));
assert.ok(report.runtimeInputs, 'runtime dependency/notice evidence is required');
verifyRuntimeLock(inputs, JSON.parse(fs.readFileSync(path.join(app, 'package-lock.json'), 'utf8')));
assert.equal(hash(path.join(app, 'package-lock.json')), report.runtimeInputs.runtimeLockSha256);
assert.equal(hash(path.join(process.cwd(), 'package-lock.json')), report.runtimeInputs.sourceLockSha256);
assert.equal(hash(path.join(app, 'THIRD_PARTY_NOTICES.txt')), report.runtimeInputs.noticesSha256);
assert.ok(report.runtimeInputs.noticeCapture.components.some(item => item.name === 'react' && item.version === inputs.canonicalLock.packages['node_modules/react'].version && item.capture === 'TEXT CAPTURED'));
for (const name of ['vite', 'react', 'react-dom', 'lucide-react', '@vitejs/plugin-react', '@tailwindcss/vite']) assert.equal(fs.existsSync(path.join(app, 'node_modules', name)), false, 'build package must not return to runtime payload');
const state = fs.mkdtempSync(path.join(root, 'runtime-acceptance-'));
fs.writeFileSync(path.join(state, 'config.json'), JSON.stringify({ serper_enabled: false, hunter_enabled: false, nvidia_enabled: false, groq_enabled: false }));
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => /^(SystemRoot|WINDIR|COMSPEC|USERPROFILE|TEMP|TMP|APPDATA|LOCALAPPDATA)$/i.test(key)));
Object.assign(env, { PATH: path.join(process.env.SystemRoot || 'C:\\Windows', 'System32'), NODE_ENV: 'production', NODE_PATH: '', NODE_OPTIONS: '',
  EDGEVIEW_DATA_DIR: state, EDGEVIEW_DEV_SERVER: '1', EDGEVIEW_MONITORING_ENABLED: '0', PORT: String(await unusedTestPort()) });
const base = `http://127.0.0.1:${env.PORT}`;
let child;
async function start() {
  child = spawn(path.join(app, 'runtime/node.exe'), [path.join(app, 'runtime-bootstrap.cjs')], { cwd: app, env, stdio: ['pipe', 'ignore', 'pipe'] });
  child.stderr.on('data', () => {}); child.stdin.on('error', () => {});
  for (const until = Date.now() + 45_000; Date.now() < until;) {
    if (child.exitCode !== null) throw new Error('EXTRACTED_RUNTIME_EXITED');
    try {
      const response = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(1500) });
      const health = await response.json();
      assert.equal(health.app.pid, child.pid, 'not the owned process: do not mutate');
      assert.equal(path.resolve(health.app.project_root), app);
      assert.equal(health.app.build.buildId, report.build.buildId);
      assert.equal(health.app.build.gitCommit, report.commit);
      if (response.ok) return health;
    } catch (error) { if (error.code === 'ERR_ASSERTION') throw error; }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('EXTRACTED_RUNTIME_READINESS_TIMEOUT');
}
async function stop() {
  if (child && child.exitCode === null && child.signalCode === null) {
    const done = once(child, 'exit', { signal: AbortSignal.timeout(25_000) });
    child.stdin.end('shutdown\n');
    try { assert.equal((await done)[0], 0, 'durable owner-pipe shutdown must return0'); }
    catch (error) { child.kill(); throw error; } // Failed disposable probe cleanup, never normal-close proof.
  }
  child = null;
}
try {
  const first = await start();
  const companies = () => fetch(`${base}/api/companies`).then(response => response.json());
  assert.equal((await companies()).length, 0); assert.match(first.app.installation_id, /^[a-f0-9-]{36}$/i);
  const form = new FormData();
  form.set('file', new Blob(['Date,Importer,Country,Exporter,Item,TOT_FC\n2026-01-01,Synthetic Package Buyer,Kenya,Synthetic Supplier,Product,10\n2026-01-02,Synthetic Package Buyer,Pakistan,Synthetic Supplier,Product,20']), 'synthetic-package.csv');
  const uploadResponse = await fetch(`${base}/api/files/upload`, { method: 'POST', body: form });
  assert.equal(uploadResponse.status, 201);
  const upload = await uploadResponse.json(); const fileId = upload.data?.id || upload.id; assert.ok(fileId);
  const shellResponse = await fetch(base); assert.equal(shellResponse.status, 200);
  const shell = await shellResponse.text(); assert.ok(shell.includes('id="root"') && !shell.includes('/@vite/client') && !shell.includes('react-refresh'));
  for (const format of ['csv','xlsx','docx','pdf','all']) {
    const response = await fetch(`${base}/api/export/file/${encodeURIComponent(fileId)}`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({dataset:'files',format,title:'Package Fixture',view:{country:'Kenya'}})});
    assert.equal(response.status,200,'packaged export '+format);assert.equal(response.headers.get('x-export-failed-formats'),null);
    const bytes=Buffer.from(await response.arrayBuffer());
    if(format==='csv'){assert.ok(bytes.toString().includes('Kenya')&&!bytes.toString().includes('Pakistan'));}
    else if(format==='pdf')assert.equal(bytes.subarray(0,5).toString(),'%PDF-');
    else {const zip=await JSZip.loadAsync(bytes);if(format==='xlsx'||format==='docx')assert.ok((await zip.file(format==='xlsx'?'xl/sharedStrings.xml':'word/document.xml').async('string')).includes('Synthetic Package Buyer'));else for(const extension of ['csv','xlsx','docx','pdf'])assert.ok(Object.keys(zip.files).some(name=>name.endsWith('.'+extension)));}
  }
  const matching = (await companies()).filter(contact => contact.company_name === 'Synthetic Package Buyer');
  assert.equal(matching.length, 2); assert.notEqual(matching[0].id, matching[1].id);
  const buyer = matching.find(contact => contact.country === 'Kenya'); assert.ok(buyer);
  assert.equal((await fetch(`${base}/api/enrich/company`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: buyer.id, company_name: buyer.company_name, country: buyer.country }) })).status, 503);
  const exported = await fetch(`${base}/api/export/blocks`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ company_ids: [buyer.id] }) });
  assert.equal(exported.status, 200); const html = await exported.text();
  assert.ok(html.includes('Synthetic Package Buyer') && html.includes('Kenya') && !html.includes('Pakistan'));
  const support = await fetch(`${base}/api/diagnostics/support`); assert.equal(support.status, 200);
  const diagnostics = await support.text();
  for (const privateValue of [root, app, state, process.cwd(), 'Synthetic Package Buyer']) assert.ok(!diagnostics.includes(privateValue));
  await stop(); const second = await start();
  assert.equal(second.app.installation_id, first.app.installation_id);
  assert.ok((await companies()).some(contact => contact.id === buyer.id)); await stop();
  for (const name of ['config.json', 'edgeview.db', 'edgeview_db.json', 'data', 'logs', 'uploads']) assert.equal(fs.existsSync(path.join(app, name)), false);
  const result = { status: 'EXTRACTED_RUNTIME_SCOPED_PASS', commit: report.commit, build: report.build.buildId, packageSha256: report.package.sha256,
    bundledNodeUsed: true, runtimeDependencyRoots: Object.keys(inputs.manifest.dependencies).length, buildPackagesOmitted: true, frontendNoticesRetained: true, fiveFormats: true, staticModeDespiteHostDevFlag: true, globalNodeOnPath: false, NODE_PATH: '', firstLaunchEmpty: true, syntheticCountryIdentityUploadExport: true,
    missingProvider503: true, durableOwnerPipeClose: true, restartIdentityData: true, diagnosticPrivateMarkersAbsent: true, appRootWrites: false,
    nativeLauncher: 'NOT EXECUTED', installedActivation: 'NOT VERIFIED', cleanWindows: 'NOT VERIFIED', updatesRollback: 'NOT VERIFIED',
    realCompanyResearch: 'NOT VERIFIED BY THIS PROBE', monitoring: 'DISABLED IN PROTOTYPE', finalVerdict: 'NOT READY' };
  fs.writeFileSync(path.join(state, 'result.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ ...result, evidence: path.join(state, 'result.json') }));
} finally { await stop(); }
