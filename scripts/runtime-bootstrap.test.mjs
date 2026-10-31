import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'edgeview-owner-pipe-'));
const children = new Set();
async function waitFor(check) {
  const end = Date.now() + 10_000;
  while (Date.now() < end) { if (check()) return; await new Promise(resolve => setTimeout(resolve, 20)); }
  throw new Error('Owned bootstrap fixture timed out');
}
try {
  for (const mode of ['explicit', 'early', 'owner-end', 'save-failure']) {
    const app = path.join(root, mode); fs.mkdirSync(path.join(app, 'dist'), { recursive: true });
    fs.copyFileSync('packaging/windows/runtime-bootstrap.cjs', path.join(app, 'runtime-bootstrap.cjs'));
    fs.writeFileSync(path.join(app, 'dist/server.cjs'), `
      const fs = require('node:fs');
      fs.writeFileSync(${JSON.stringify(path.join(app, 'mode'))}, String(process.env.EDGEVIEW_DEV_SERVER));
      setTimeout(() => {
        process.once('SIGTERM', () => {
          fs.writeFileSync(${JSON.stringify(path.join(app, 'shutdown'))}, 'saved');
          process.exit(${mode === 'save-failure' ? 1 : 0});
        });
        process.stdout.write('ready\\n');
      }, 150);
    `);
    const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => /^(PATH|SystemRoot|WINDIR|TEMP|TMP)$/i.test(key)));
    env.EDGEVIEW_DEV_SERVER = '1'; // An installed runtime must not inherit developer mode.
    const child = spawn(process.execPath, [path.join(app, 'runtime-bootstrap.cjs')], { env, stdio: ['pipe', 'pipe', 'pipe'] });
    children.add(child); let output = '';
    child.stdout.on('data', data => { output = (output + data).slice(-100); });
    const ended = once(child, 'exit', { signal: AbortSignal.timeout(10_000) });
    if (mode === 'early') child.stdin.end('shutdown\nshutdown\n');
    else if (mode === 'owner-end') child.stdin.end();
    else {
      await waitFor(() => output.includes('ready'));
      child.stdin.write('x'.repeat(256 * 1024) + '\nnot-shutdown\nshutdown; command\n');
      await new Promise(resolve => setTimeout(resolve, 50));
      assert.equal(child.exitCode, null, 'invalid/oversized input cannot become a command');
      assert.equal(fs.existsSync(path.join(app, 'shutdown')), false);
      child.stdin.end('shutdown\r\n');
    }
    const [code] = await ended; children.delete(child);
    assert.equal(code, mode === 'save-failure' ? 1 : 0, 'backend exit code must remain truthful');
    assert.equal(fs.readFileSync(path.join(app, 'shutdown'), 'utf8'), 'saved');
    assert.equal(fs.readFileSync(path.join(app, 'mode'), 'utf8'), '0', 'packaged bootstrap must fence developer mode before loading backend');
  }
  console.log('PASS launcher pipe shutdown, early startup close, owner loss, bounded command framing and nonzero backend failure');
} finally {
  for (const child of children) child.kill();
  await Promise.all([...children].map(child => child.exitCode !== null || child.signalCode !== null ? undefined : once(child, 'exit', { signal: AbortSignal.timeout(5000) })));
  if (path.dirname(fs.realpathSync(root)) !== fs.realpathSync(os.tmpdir())) throw new Error('Unsafe fixture cleanup');
  fs.rmSync(root, { recursive: true, force: true });
}
