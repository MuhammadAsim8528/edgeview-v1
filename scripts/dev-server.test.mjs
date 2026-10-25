import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

// The dev launcher is pinned here without ever starting the real server: the entry point is a stub
// that records what it was launched with and exits, so no loopback port is bound. It sits under
// .test-cache so `--import tsx` resolves through the repository's own node_modules.
const launcher = path.resolve('scripts/dev-server.mjs');
const fixtureRoot = path.join(process.cwd(), '.test-cache');
fs.mkdirSync(fixtureRoot, { recursive: true });
const fixture = fs.realpathSync.native(fs.mkdtempSync(path.join(fixtureRoot, 'dev-server-')));
assert.notEqual(fixture, process.cwd(), 'the stub must not run in the real project root');

// The enum is deliberate: Node's own type stripping refuses it, so this entry only runs if a real
// TypeScript loader is in front of it, which is what a developer's `npm run dev` depends on.
const stub = `import { writeFileSync } from 'node:fs';
enum LaunchPhase { recorded = 1 }
const record: any = { argv: process.argv, pid: process.pid, phase: LaunchPhase.recorded, nodeEnv: process.env.NODE_ENV ?? null, devFlag: process.env.EDGEVIEW_DEV_SERVER ?? null, pathSeen: Boolean(process.env.PATH ?? process.env.Path) };
writeFileSync(process.env.DEV_MARKER!, JSON.stringify(record));
console.log('STUB_DEV_OUTPUT');
if (process.env.DEV_HOLD) setTimeout(() => {}, 60000);
else process.exit(Number(process.env.DEV_EXIT ?? '0'));
`;
fs.writeFileSync(path.join(fixture, 'server.ts'), stub);

const launch = (env = {}) => {
  const marker = path.join(fixture, `marker-${Object.keys(env).join('-') || 'plain'}.json`);
  fs.rmSync(marker, { force: true });
  const run = spawnSync(process.execPath, [launcher], {
    cwd: fixture,
    env: { ...process.env, DEV_MARKER: marker, ...env },
    encoding: 'utf8',
    timeout: 60000,
  });
  const output = `${run.stdout ?? ''}${run.stderr ?? ''}`;
  const recorded = fs.existsSync(marker) ? JSON.parse(fs.readFileSync(marker, 'utf8')) : null;
  return { run, output, recorded };
};

try {
  // 1. the launcher starts the entry point under this Node binary with the development environment
  const started = launch();
  assert.equal(started.run.status, 0, `the dev launcher must start its entry point: ${started.output}`);
  assert.match(started.output, /STUB_DEV_OUTPUT/, 'the dev server log stays visible to whoever launched it');
  assert.doesNotMatch(started.output, /EINVAL|spawn ENOENT|Cannot find module/, 'the launch must not die on how it resolves tsx');
  assert.ok(started.recorded, 'the stub must have run and recorded its launch');
  assert.equal(path.basename(started.recorded.argv[1]), 'server.ts', 'the app entry point is the one that runs');
  assert.equal(started.recorded.argv[0], process.execPath, 'the app runs on the same Node binary, not through a shell wrapper');
  assert.equal(started.recorded.nodeEnv, 'development', 'NODE_ENV must be development for the dev launcher');
  assert.equal(started.recorded.devFlag, '1', 'the dev-server flag must reach the app');
  assert.equal(started.recorded.pathSeen, true, 'the developer environment is inherited, not replaced');

  // 2. the app's exit status is handed back to whoever ran npm run dev
  const failing = launch({ DEV_EXIT: '5' });
  assert.equal(failing.run.status, 5, `the app exit status must pass through: ${failing.output}`);
  assert.ok(failing.recorded, 'the failing stub still ran, so the status came from the app');

  // 3. an app terminated from outside must not be reported as a clean exit
  const holdMarker = path.join(fixture, 'marker-hold.json');
  fs.rmSync(holdMarker, { force: true });
  const held = spawn(process.execPath, [launcher], { cwd: fixture, env: { ...process.env, DEV_MARKER: holdMarker, DEV_HOLD: '1' }, stdio: 'pipe' });
  let heldOutput = '';
  held.stdout?.on('data', chunk => { heldOutput += chunk; });
  held.stderr?.on('data', chunk => { heldOutput += chunk; });
  let appPid = null;
  let heldStatus;
  try {
    const deadline = Date.now() + 30000;
    while (!fs.existsSync(holdMarker)) {
      assert.ok(Date.now() < deadline, `the dev launcher must start the app: ${heldOutput}`);
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    appPid = JSON.parse(fs.readFileSync(holdMarker, 'utf8')).pid;
    process.kill(appPid);
    heldStatus = await new Promise(resolve => held.once('exit', code => resolve(code)));
  } finally {
    if (appPid) { try { process.kill(appPid); } catch {} }
    held.kill();
  }
  assert.equal(heldStatus, 1, `a dev server terminated by a signal must not look like a clean exit: ${heldStatus} / ${heldOutput}`);
  assert.ok(appPid, 'the app reached the point where it could be terminated');

  console.log('PASS the dev launcher starts server.ts on this Node binary with the development environment, passes the app exit status through, and reports a killed dev server as a failure');
} finally {
  fs.rmSync(fixture, { recursive: true, force: true });
}
