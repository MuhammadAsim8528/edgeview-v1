import assert from 'node:assert/strict';
import { fetchAllFileRows } from '../../src/utils/safeFetch';
const rows = Array.from({ length: 1503 }, (_, id) => ({ id }));
let calls = 0;
global.fetch = (async input => {
  const url = new URL(String(input), 'http://fixture.local');
  assert.ok(url.pathname.includes('file%2Ffixture'));
  assert.equal(url.searchParams.get('limit'), '1000');
  const offset = Number(url.searchParams.get('offset')); calls++;
  return Response.json({ rows: rows.slice(offset, offset + 1000), total_count: rows.length });
}) as typeof fetch;
assert.deepEqual((await fetchAllFileRows('file/fixture')).data?.rows, rows);
assert.equal(calls, 2);
calls = 0;
global.fetch = (async () => ++calls === 1 ? Response.json({ rows: rows.slice(0, 1000), total_count: 1503 }) : new Response('{}', { status: 500 })) as typeof fetch;
const failed = await fetchAllFileRows('fixture');
assert.equal(failed.ok, false); assert.equal(failed.data, null, 'failed later page cannot become a partial successful export');
for (const payload of [{ rows: [], total_count: 3 }, { rows: [], total_count: 1_000_001 }, { rows: [{ id: 1 }], total_count: 0 }, { rows: {}, total_count: 1 }]) {
  global.fetch = (async () => Response.json(payload)) as typeof fetch;
  assert.equal((await fetchAllFileRows('fixture')).code, 'INCOMPLETE_EXPORT_DATA');
}
calls = 0;
global.fetch = (async () => Response.json({ rows: [{ id: calls }], total_count: ++calls === 1 ? 3 : 4 })) as typeof fetch;
assert.equal((await fetchAllFileRows('fixture')).ok, false, 'changing totals abort instead of mixing dataset snapshots');
global.fetch = (async () => Response.json({ rows: [], total_count: 0 })) as typeof fetch;
assert.deepEqual((await fetchAllFileRows('fixture')).data, { rows: [], total_count: 0 });
console.log('PASS bounded export paging retains all rows and rejects partial/changing responses');
