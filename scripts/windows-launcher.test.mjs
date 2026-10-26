import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { unusedTestPort } from './test-server-port.mjs';

if (process.platform !== 'win32') { console.log('SKIPPED Windows launcher requires Windows/.NET Framework build tools'); process.exit(0); }
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'edgeview-launcher-test-'));
const children = new Set(); const hash = 'a'.repeat(64);
const systemEnvironment = Object.fromEntries(Object.entries(process.env).filter(([key]) => /^(SystemRoot|WINDIR|COMSPEC|USERPROFILE|TEMP|TMP|APPDATA|LOCALAPPDATA)$/i.test(key)));
let foreign;
try {
  const app = path.join(root, 'app'); fs.mkdirSync(path.join(app, 'runtime'), { recursive: true }); fs.mkdirSync(path.join(app, 'dist'));
  const executable = path.join(app, 'EdgeView.exe');
  const compiler = path.join(process.env.SystemRoot, 'Microsoft.NET', 'Framework64', 'v4.0.30319', 'csc.exe');
  const compiled = spawnSync(compiler, ['/nologo', '/target:winexe', '/platform:x64', '/reference:System.Windows.Forms.dll', '/reference:System.Drawing.dll', '/reference:System.Web.Extensions.dll', '/out:' + executable, path.resolve('packaging/windows/EdgeViewLauncher.cs')], { env: systemEnvironment, encoding: 'utf8', timeout: 30000, windowsHide: true });
  assert.equal(compiled.status, 0, compiled.stdout + compiled.stderr);
  fs.copyFileSync(process.execPath, path.join(app, 'runtime/node.exe'));
  fs.copyFileSync('packaging/windows/runtime-bootstrap.cjs', path.join(app, 'runtime-bootstrap.cjs'));
  fs.writeFileSync(path.join(app, 'dist/build-info.json'), JSON.stringify({ buildId: hash }));
  for (const mode of ['normal', 'failure', 'foreign']) {
    const state = path.join(root, mode); fs.mkdirSync(state);
    const port = await unusedTestPort();
    if (mode === 'foreign') {
      foreign = http.createServer((_req, res) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ app: { pid: process.pid, build: { buildId: hash } } })); });
      await new Promise(resolve => foreign.listen(port, '127.0.0.1', resolve));
    }
    fs.writeFileSync(path.join(app, 'dist/server.cjs'), `
      const fs = require('node:fs'), http = require('node:http');
      const server = http.createServer((_req,res) => { res.setHeader('Content-Type','application/json'); res.end(JSON.stringify({app:{pid:process.pid,build:{buildId:${JSON.stringify(hash)}}}})); });
      server.on('error', () => process.exit(1));
      process.once('SIGTERM', () => { fs.writeFileSync(${JSON.stringify(path.join(state, 'saved'))},'saved'); server.close(() => process.exit(${mode === 'failure' ? 1 : 0})); });
      server.listen(Number(process.env.PORT),'127.0.0.1');
    `);
    const env = { ...systemEnvironment };
    Object.assign(env, { PORT: String(port), EDGEVIEW_DATA_DIR: state, PATH: path.join(process.env.SystemRoot, 'System32') });
    const child = spawn(executable, ['--verify-runtime'], { env, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
    children.add(child); let output = '';
    child.stdout.on('data', data => { output = (output + data.toString()).slice(-1024); }); child.stderr.on('data', () => {}); child.stdin.on('error', () => {});
    const ended = once(child, 'exit', { signal: AbortSignal.timeout(60000) });
    if (mode !== 'foreign') {
      const end = Date.now() + 15000;
      while (!output.includes('READY ') && Date.now() < end && child.exitCode === null) await new Promise(resolve => setTimeout(resolve, 50));
      assert.match(output, /READY \d+/, 'headless factory path must wait for its own matching runtime');
      child.stdin.end('\n');
    }
    const [code] = await ended; children.delete(child);
    assert.equal(code, mode === 'normal' ? 0 : 1, 'child failure/startup refusal cannot become successful close');
    if (mode === 'foreign') {
      assert.ok(!output.includes('READY '), 'matching build on a foreign PID must not be adopted');
      assert.equal((await fetch('http://127.0.0.1:' + port + '/api/health')).status, 200, 'non-owned listener must remain untouched');
      await new Promise(resolve => foreign.close(resolve)); foreign = null;
    } else assert.equal(fs.readFileSync(path.join(state, 'saved'), 'utf8'), 'saved');
  }
  console.log('PASS compiled Windows launcher: bundled executable, owned-PID/build readiness, durable close, nonzero failure and foreign-listener refusal; rendered GUI NOT VERIFIED');
} finally {
  if (foreign) await new Promise(resolve => foreign.close(resolve));
  // Close the owner pipe so the real bridge can finish the owned runtime too.
  for (const child of children) child.stdin.end();
  await Promise.all([...children].map(child => child.exitCode !== null || child.signalCode !== null ? undefined : once(child, 'exit', { signal: AbortSignal.timeout(25000) })));
  if (path.dirname(fs.realpathSync(root)) !== fs.realpathSync(os.tmpdir())) throw new Error('Unsafe fixture cleanup');
  fs.rmSync(root, { recursive: true, force: true });
}
