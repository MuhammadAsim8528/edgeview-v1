import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { verifyPackage } from './verify-package.mjs';

const source = process.cwd();
const zip = path.resolve('../../outputs/EdgeView-V1-Windows.zip');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'edgeview-package-cold-runtime-'));
const disk = fs.statfsSync(root);
if (Number(disk.bavail) * Number(disk.bsize) < 1.5 * 1024 ** 3) {
  fs.rmdirSync(root); throw new Error('Cold install verification requires at least 1.5 GiB free.');
}
async function runNode(args, cwd, timeoutMs) {
  const child = spawn(process.execPath, args, { cwd, stdio: ['ignore','pipe','pipe'] });
  let output = '';
  child.stdout.on('data', chunk => { output = (output + chunk).slice(-16000); });
  child.stderr.on('data', chunk => { output = (output + chunk).slice(-16000); });
  console.log(JSON.stringify({ phase: args.includes('ci') ? 'locked dependency installation' : 'isolated package smoke', pid: child.pid }));
  const began = performance.now();
  const heartbeat = setInterval(() => console.log(JSON.stringify({ phase: args.includes('ci') ? 'installing' : 'verifying', pid: child.pid, elapsedSeconds: Math.round((performance.now() - began) / 1000) })), 30000);
  let timedOut = false;
  const timeout = setTimeout(() => { timedOut = true; child.kill('SIGTERM'); }, timeoutMs);
  try {
    const exit = await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', resolve); });
    const codes = [...new Set([...output.matchAll(/npm (?:error|warn)[^\r\n]*\b(E[A-Z_]{3,})\b/g)].map(match => match[1]))];
    assert.equal(timedOut, false, `Verification timed out; codes: ${codes.join(',')}`);
    assert.equal(exit, 0, `Verification failed; codes: ${codes.join(',')}. No live installation was modified.`);
    return output;
  } finally { clearTimeout(timeout); clearInterval(heartbeat); }
}
try {
  const extraction = spawnSync('tar', ['-xf',zip,'-C',root], { encoding: 'utf8' });
  assert.equal(extraction.status, 0, extraction.stderr);
  const installed = path.join(root,'EdgeView-V1-Windows');
  verifyPackage(installed, { rejectUnexpected: true });
  assert.equal(fs.existsSync(path.join(installed,'node_modules')), false);
  const npm = [process.env.npm_execpath,
    path.join(path.dirname(process.execPath),'node_modules/npm/bin/npm-cli.js'),
    path.resolve(path.dirname(process.execPath),'../lib/node_modules/npm/bin/npm-cli.js'),
  ].find(candidate => candidate && fs.existsSync(candidate));
  assert.ok(npm, 'Node/npm must be installed to verify the Windows source distribution.');
  const installStart = performance.now();
  await runNode([npm,'ci','--omit=dev','--ignore-scripts','--cache','.npm-cache'], installed, 600000);
  const installMs = performance.now() - installStart;
  const unchanged = spawnSync(process.execPath, ['scripts/build-if-needed.mjs'], { cwd: installed, encoding: 'utf8' });
  assert.equal(unchanged.status, 0, unchanged.stderr);
  assert.match(unchanged.stdout, /up to date/);
  const smokeStart = performance.now();
  const output = await runNode([path.join(source,'scripts/release-smoke.mjs')], installed, 90000);
  assert.match(output, /PASS EdgeView production release smoke/);
  verifyPackage(installed); // Runtime-created dependencies/data are expected extras now.
  const smokeMs = performance.now() - smokeStart;
  const rebuildStart = performance.now();
  await runNode([npm,'run','build'], installed, 90000);
  const rebuildMs = performance.now() - rebuildStart;
  const rebuiltSmokeStart = performance.now();
  assert.match(await runNode([path.join(source,'scripts/release-smoke.mjs')], installed, 90000), /PASS EdgeView production release smoke/);
  console.log(JSON.stringify({ passed: true, node: process.version, platform: process.platform,
    dependencyInstallMs: Math.round(installMs), isolatedSmokeMs: Math.round(smokeMs), productionRebuildMs: Math.round(rebuildMs), rebuiltSmokeMs: Math.round(performance.now() - rebuiltSmokeStart),
    manifestVerifiedAfterRun: true, caveat: 'Fresh extracted package + locked install + API workflow; no browser interaction or fixed-port .bat cold start.' }));
} finally { fs.rmSync(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }); }
