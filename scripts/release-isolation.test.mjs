import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';

let mutations = 0;
const unrelated = http.createServer((request, response) => {
  if (request.method !== 'GET') mutations += 1;
  response.setHeader('content-type', 'application/json');
  response.end(JSON.stringify({ status: 'ok', app: { pid: process.pid } }));
});
await new Promise((resolve, reject) => { unrelated.once('error', reject); unrelated.listen(0, '127.0.0.1', resolve); });
try {
  const port = unrelated.address().port;
  const child = spawn(process.execPath, ['scripts/release-smoke.mjs'], { env: { ...process.env, EDGEVIEW_RELEASE_TEST_PORT: String(port) }, stdio: ['ignore','pipe','pipe'] });
  let output = '';
  child.stdout.on('data', chunk => { output = (output + chunk).slice(-8000); });
  child.stderr.on('data', chunk => { output = (output + chunk).slice(-8000); });
  const exit = await new Promise(resolve => child.once('exit', resolve));
  assert.notEqual(exit, 0);
  assert.match(output, /different process/);
  assert.equal(mutations, 0, 'a port collision must never send mutations to the unrelated server');
  console.log('PASS release tests refuse a healthy unrelated port owner before sending any mutation.');
} finally { await new Promise(resolve => unrelated.close(resolve)); }
