import assert from 'node:assert/strict';
import { processBirthIdentity, recordedOwnerWasReused } from '../process_identity';

assert.equal(recordedOwnerWasReused({ pid: 42, birth: 'windows:100000000000' }, 42, 'windows:200000000000'), true);
assert.equal(recordedOwnerWasReused({ pid: 42, birth: 'corrupt-token' }, 42, 'windows:200000000000'), false);
assert.equal(recordedOwnerWasReused({ pid: 42, birth: 'windows:100000000000' }, 42, 'windows:100000000000'), false);
assert.equal(recordedOwnerWasReused({ pid: 41, birth: 'windows:100000000000' }, 42, 'windows:200000000000'), false);
for (const record of [null, {}, 42, '42', { pid: 42 }, { pid: 42, birth: '' }]) {
  assert.equal(recordedOwnerWasReused(record, 42, 'windows:200000000000'), false);
}
assert.equal(recordedOwnerWasReused({ pid: 42, birth: 'windows:100000000000' }, 42, null), false);
assert.equal(processBirthIdentity(-1), null);
assert.equal(processBirthIdentity(Number.NaN), null);
if (['win32', 'linux'].includes(process.platform)) {
  const birth = processBirthIdentity(process.pid);
  assert.ok(birth, 'real current-process birth must be available on the acceptance host');
  assert.equal(processBirthIdentity(process.pid), birth);
  const oldBirth = process.platform === 'win32' ? 'windows:100000000000' : 'linux:00000000-0000-0000-0000-000000000000:1';
  assert.equal(recordedOwnerWasReused({ pid: process.pid, birth: oldBirth }, process.pid, birth), true);
}
console.log('PASS process birth identity, actual host inspection and conservative PID-reuse decisions');
