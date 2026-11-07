import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

for (const trigger of [
  "setImmediate(() => { throw new Error('controlled fatal test'); });",
  "Promise.reject(new Error('controlled rejection test'));",
]) {
  const child = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e',
    `import { installFatalErrorHandlers } from './server/fatal_errors.ts'; installFatalErrorHandlers(); ${trigger} setTimeout(() => console.log('UNSAFE_CONTINUATION'), 200);`,
  ], { cwd: process.cwd(), encoding: 'utf8', timeout: 10000 });
  assert.equal(child.status, 1, child.stderr);
  assert.match(child.stderr, /restart required/);
  assert.doesNotMatch(child.stdout, /UNSAFE_CONTINUATION/);
}
console.log('PASS: unknown exceptions and rejections terminate before subsequent work.');

// Reporter receives a fixed discriminator only, and cannot suppress termination.
for (const report of [
  `kind => { console.log('SAFE_KIND=' + kind); }`,
  `() => { throw new Error('reporter rejected'); }`,
]) {
  const child = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e',
    `import { installFatalErrorHandlers } from './server/fatal_errors.ts'; installFatalErrorHandlers(${report});
     Promise.reject(new Error('private exception fixture')); setTimeout(() => console.log('UNSAFE_CONTINUATION'), 10);`,
  ], { cwd: process.cwd(), encoding: 'utf8', timeout: 10000 });
  assert.equal(child.status, 1);
  assert.doesNotMatch(child.stdout, /UNSAFE_CONTINUATION|private exception fixture/);
  if (report.includes('SAFE_KIND')) assert.equal(child.stdout.trim(), 'SAFE_KIND=unhandled rejection');
}
console.log('PASS fixed fatal kind and fail-closed reporter callback');
