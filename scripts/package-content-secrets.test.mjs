import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { gzipSync, brotliCompressSync } from 'node:zlib';
import JSZip from 'jszip';
import { verifyArchive, VERSION } from './scan-history-gitleaks.mjs';

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'edgeview-package-content-'));
const project = path.join(scratch, 'workspace', 'project');
const outputs = path.join(scratch, 'outputs');
const script = path.resolve('scripts/package-windows.mjs');
try {
  // Fetch the pinned official archive once for this regression. Every real
  // bootstrap invocation still checks its hash/version; cache is test-only.
  const releaseURL = `https://github.com/gitleaks/gitleaks/releases/download/v${VERSION}/gitleaks_${VERSION}_windows_x64.zip`;
  const response = await fetch(releaseURL, { signal: AbortSignal.timeout(60000) });
  assert.ok(response.ok && response.body, 'official scanner download must succeed');
  const chunks = []; let size = 0;
  for await (const chunk of response.body) {
    size += chunk.length; assert.ok(size <= 32 * 1024 * 1024, 'bounded test download'); chunks.push(chunk);
  }
  const archive = Buffer.concat(chunks); verifyArchive(archive);
  const cachedArchive = path.join(scratch, 'verified-scanner.zip');
  fs.writeFileSync(cachedArchive, archive);
  const cachedDownload = path.join(scratch, 'cached-download.mjs');
  fs.writeFileSync(cachedDownload, `import fs from 'node:fs';globalThis.fetch=async input=>{if(String(input)!==${JSON.stringify(releaseURL)})throw new Error('unexpected test URL');return new Response(fs.readFileSync(${JSON.stringify(cachedArchive)}));};`);
  fs.mkdirSync(project, { recursive: true });
  for (const dir of ['assets', 'dist', 'public', 'server', 'shared', 'src', 'docs', 'scripts'])
    { fs.mkdirSync(path.join(project, dir)); fs.writeFileSync(path.join(project, dir, 'ordinary.txt'), '普通の値\n'); }
  const implementation = fs.readFileSync(script, 'utf8');
  const files = implementation.match(/const includedFiles = \[([\s\S]*?)\];/)[1].match(/'([^']+)'/g).map(item => item.slice(1, -1));
  for (const file of files) fs.writeFileSync(path.join(project, file), 'ordinary release fixture\n');
  for (const file of ['build-if-needed.mjs', 'verify-package.mjs', 'dev-server.mjs', 'ensure-dependencies.mjs', 'doctor.mjs', 'backup-runtime.mjs', 'build-metadata.mjs'])
    fs.writeFileSync(path.join(project, 'scripts', file), '// ordinary fixture\n');
  const env = Object.fromEntries(Object.entries(process.env).filter(([name]) =>
    /^(PATH|SYSTEMROOT|WINDIR|COMSPEC|USERPROFILE|HOME|TEMP|TMP|APPDATA|LOCALAPPDATA)$/i.test(name)));
  const run = (args = []) => spawnSync(process.execPath, ['--import', pathToFileURL(cachedDownload).href, ...args, script], { cwd: project, env, windowsHide: true,
    encoding: 'utf8', timeout: 180_000, maxBuffer: 1024 * 1024 });
  assert.equal(run().status, 0, 'ordinary multilingual release must still publish');
  const zip = path.join(outputs, 'EdgeView-V1-Windows.zip');
  const priorZip = fs.readFileSync(zip);
  const manifest = path.join(outputs, 'EdgeView-V1-Windows', 'PACKAGE_MANIFEST.json');
  const priorManifest = fs.readFileSync(manifest);
  // Fresh untracked generated content: history scanning cannot cover this.
  const canary = ['gh', 'p_'].join('') + randomBytes(18).toString('hex');
  for (const file of ['dist/app.js', 'dist/app.js.map', 'README.md', 'package-lock.json', 'public/drawing.svg', 'dist/jquery.min.js', 'public/utf16.txt', 'public/utf16be.txt', 'public/utf16-nobom.txt', 'public/utf16be-nobom.txt', 'dist/app.js.gz', 'dist/renamed.bin', 'public/nested.zip', 'dist/app.js.br']) {
    const original = fs.existsSync(path.join(project, file)) ? fs.readFileSync(path.join(project, file)) : null;
    const content = file.endsWith('.json') ? JSON.stringify({ token: canary })
      : file.endsWith('.svg') ? `<svg xmlns="http://www.w3.org/2000/svg"><text>${canary}</text></svg>`
      : `const token = "${canary}"; // gitleaks:allow\n`;
    const payload = file.endsWith('.gz') || file.endsWith('renamed.bin') ? gzipSync(Buffer.from(content))
      : file.endsWith('.zip') ? await new JSZip().file('payload.js', content).generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
      : file.endsWith('.br') ? brotliCompressSync(Buffer.from(content))
      : file.endsWith('utf16.txt')
      ? Buffer.concat([Buffer.from([255, 254]), Buffer.from(content, 'utf16le')])
      : file.endsWith('utf16be.txt') ? Buffer.concat([Buffer.from([254, 255]), Buffer.from(content, 'utf16le').swap16()])
      : file.endsWith('utf16be-nobom.txt') ? Buffer.from(content, 'utf16le').swap16()
      : file.endsWith('utf16-nobom.txt') ? Buffer.from(content, 'utf16le') : Buffer.from(content);
    if (file.includes('utf16')) assert.ok(payload.includes(0), 'encoding cases must actually contain UTF-16 bytes');
    fs.writeFileSync(path.join(project, file), payload);
    const result = run();
    assert.notEqual(result.status, 0, 'a credential in allowed content must prevent publication');
    assert.ok(/PACKAGE_SECRET_SCAN_REJECTED/.test(result.stderr), 'rejection must come from the content gate');
    assert.ok(!`${result.stdout}${result.stderr}`.includes(canary), 'no scanner match may reach output');
    assert.deepEqual(fs.readFileSync(zip), priorZip, 'prior ZIP must survive content rejection');
    assert.deepEqual(fs.readFileSync(manifest), priorManifest, 'prior stage must survive content rejection');
    if (original) fs.writeFileSync(path.join(project, file), original);
    else fs.unlinkSync(path.join(project, file));
  }
  for (const fault of [
    "globalThis.fetch = async () => { throw new Error('SYNTHETIC_PRIVATE_SCAN_FAILURE'); };",
    "globalThis.fetch = async () => new Response('SYNTHETIC_PRIVATE_SCAN_FAILURE', { status: 503 });",
    "globalThis.fetch = async () => new Response('SYNTHETIC_PRIVATE_SCAN_FAILURE', { status: 200 });",
    "Object.defineProperty(process, 'arch', { value: 'arm64' });",
  ]) {
    const preload = path.join(scratch, 'scanner-failure.mjs');
    fs.writeFileSync(preload, fault);
    const result = run(['--import', pathToFileURL(preload).href]);
    assert.notEqual(result.status, 0, 'offline/HTTP/download-integrity failures must stop publication');
    assert.match(result.stderr, /PACKAGE_SECRET_SCAN_REJECTED/);
    assert.ok(!`${result.stdout}${result.stderr}`.includes('SYNTHETIC_PRIVATE_SCAN_FAILURE'));
    assert.deepEqual(fs.readFileSync(zip), priorZip);
    assert.deepEqual(fs.readFileSync(manifest), priorManifest);
  }
  assert.ok(fs.readdirSync(outputs).every(name => !name.startsWith('.edgeview-package-')));
  console.log('PASS benign package, credential/encoding canaries, scanner failures, prior-artifact preservation and no disclosure');
} finally {
  assert.equal(path.dirname(fs.realpathSync(scratch)), fs.realpathSync(os.tmpdir()));
  fs.rmSync(scratch, { recursive: true, force: true });
}
