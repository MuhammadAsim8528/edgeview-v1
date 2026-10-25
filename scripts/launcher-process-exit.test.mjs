import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

if (process.platform !== 'win32') {
  console.log('SKIPPED Windows batch exit-routing test: Windows cmd.exe required.');
} else {
  const source = fs.readFileSync('EdgeView.bat', 'utf8');
  const probe = source.split(/\r?\n/).filter(line => line.startsWith('powershell ') && line.includes('Invoke-RestMethod'));
  const opener = source.split(/\r?\n/).filter(line => line.startsWith('start "" /b powershell ') && line.includes('Invoke-WebRequest'));
  assert.equal(probe.length, 1, 'fixture must replace exactly one external health decision');
  assert.equal(opener.length, 1, 'fixture must suppress exactly one background browser waiter');
  // Exercise the product's actual step/error routing. Replace external health
  // decision and browser opener only; no listener, browser or live app is touched.
  const isolated = source.replace(probe[0], 'cmd /d /c exit 1').replace(opener[0], 'rem isolated fixture: no browser waiter');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'edgeview-launch-exit-'));
  try {
    fs.mkdirSync(path.join(root, 'scripts')); fs.mkdirSync(path.join(root, 'dist'));
    fs.writeFileSync(path.join(root, 'EdgeView.bat'), isolated);
    const run = (install, build, server) => {
      fs.writeFileSync(path.join(root, 'scripts', 'ensure-dependencies.mjs'), `console.log('FIXTURE INSTALL');process.exit(${install});`);
      fs.writeFileSync(path.join(root, 'scripts', 'build-if-needed.mjs'), `console.log('FIXTURE BUILD');process.exit(${build});`);
      fs.writeFileSync(path.join(root, 'dist', 'server.cjs'), `console.log('FIXTURE SERVER');process.exit(${server});`);
      const result = spawnSync('cmd.exe', ['/d', '/c', 'EdgeView.bat'], { cwd: root, input: '\n', encoding: 'utf8', timeout: 15000, windowsHide: true });
      assert.equal(result.error, undefined, 'batch test must terminate without timeout');
      return { status: result.status, output: `${result.stdout}${result.stderr}` };
    };
    const crashed = run(0, 0, 3);
    assert.match(crashed.output, /FIXTURE INSTALL[\s\S]*FIXTURE BUILD[\s\S]*FIXTURE SERVER/);
    assert.match(crashed.output, /EdgeView stopped unexpectedly with error level 3\./);
    assert.equal(crashed.status, 1, 'server failure remains a failed launch');
    const stopped = run(0, 0, 0);
    assert.equal(stopped.status, 0);
    assert.doesNotMatch(stopped.output, /unexpectedly|could not start/);
    const buildFailed = run(0, 7, 0);
    assert.equal(buildFailed.status, 1);
    assert.match(buildFailed.output, /EdgeView could not start/);
    assert.doesNotMatch(buildFailed.output, /FIXTURE SERVER/);
    const installFailed = run(9, 0, 0);
    assert.equal(installFailed.status, 1);
    assert.doesNotMatch(installFailed.output, /FIXTURE BUILD|FIXTURE SERVER/);
    console.log('PASS actual batch step routing: crash visible/nonzero, normal exit clean, preparation failures stop launch; no health probe/browser/server port exercised');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
}
