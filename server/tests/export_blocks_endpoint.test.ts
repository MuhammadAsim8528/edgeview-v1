import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { unusedTestPort } from '../../scripts/test-server-port.mjs';

// Actual server route; seed ONLY this child process's isolated in-memory map.
// No test mutation endpoint or successful provider-result injection is added.
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'edgeview-block-export-'));
const port = await unusedTestPort();
const base = `http://127.0.0.1:${port}`;
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => /^(PATH|SystemRoot|WINDIR|COMSPEC|USERPROFILE|TEMP|TMP|APPDATA|LOCALAPPDATA)$/i.test(key)));
const child = spawn(process.execPath, ['--import', 'tsx', '--input-type=module', '--eval', `
  const { db } = await import('./server/db.ts');
  process.on('message', contacts => {
    db.contacts.clear();
    for (const contact of contacts) db.contacts.set(contact.id, contact);
    process.send('seeded');
  });
  await import('./server.ts');
`], { cwd: process.cwd(), env: { ...env, NODE_ENV: 'test', PORT: String(port), EDGEVIEW_TEST_MODE: '1', EDGEVIEW_TEST_DB_DIR: root,
  EDGEVIEW_JSON_DB: path.join(root, 'rows.json'), EDGEVIEW_SQLITE_DB: path.join(root, 'operational.db'),
  EDGEVIEW_V1_DATA_DIR: path.join(root, 'runs'), EDGEVIEW_CONFIG: path.join(root, 'config.json') }, stdio: ['ignore', 'ignore', 'pipe', 'ipc'] });
let diagnostics = '';
child.stderr?.on('data', chunk => { diagnostics = (diagnostics + String(chunk)).slice(-2000); });
const post = (body: unknown) => fetch(`${base}/api/export/blocks`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(10_000) });
async function seed(contacts: unknown[]) {
  const ack = once(child, 'message', { signal: AbortSignal.timeout(10_000) });
  child.send(contacts);
  assert.equal((await ack)[0], 'seeded');
}
try {
  let ready = false;
  for (const deadline = Date.now() + 60_000; Date.now() < deadline;) {
    assert.equal(child.exitCode, null, `isolated server exited: ${diagnostics}`);
    try {
      const response = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(1000) });
      const health = await response.json();
      assert.equal(health.app?.pid, child.pid, 'test must own the server before seeding');
      ready = true; break;
    } catch { await new Promise(resolve => setTimeout(resolve, 100)); }
  }
  assert.ok(ready, 'isolated actual server must become healthy');
  const hostile = '<img src=x onerror="alert(1)"><script>bad()</script>&\'"';
  const ordinary = '医薬品 شركة دواء Équipe & Sons';
  await seed([
    { id: 'hostile', company_name: hostile, industry: hostile, email: hostile, phone: hostile, address: hostile, website: 'JaVaScRiPt:alert(1)', linkedin: 'data:text/html,<script>bad()</script>', first_seen: hostile },
    { id: 'ordinary', company_name: ordinary, industry: 'Santé', email: 'office@example.test', phone: '+94 11 234 5678', address: '東京 / كولومبو', website: 'https://example.test/" onclick="bad()', linkedin: 'HtTpS://example.test/team?q=one&lang=中文', first_seen: '2026-01-01' },
    { id: 'control', company_name: 'Control', website: 'https://example.test/\nattack', linkedin: 'https://example.test/\u0000attack' },
  ]);
  const response = await post({});
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') || '', /^text\/html; charset=utf-8/i);
  assert.match(response.headers.get('content-disposition') || '', /attachment;.*edgeview_blocks\.html/);
  const html = await response.text();
  assert.ok(!/<(?:img|script)\b/i.test(html), 'no dataset markup may become executable elements');
  assert.equal((html.match(/&lt;img src=x/g) || []).length, 5, 'all five text fields retain escaped hostile content');
  assert.ok(html.includes(ordinary.replace('&', '&amp;')), 'multilingual company is retained');
  assert.ok(html.includes('東京 / كولومبو'));
  assert.ok(!/href="(?:javascript|data):/i.test(html));
  assert.ok(!html.includes('href="https://example.test/\nattack"'));
  assert.ok(!html.includes('href="https://example.test/\u0000attack"'));
  const anchors = [...html.matchAll(/<a\s+([^>]+)>/g)].map(match => match[1]);
  assert.equal(anchors.length, 2, 'only the two ordinary http(s) values become links');
  for (const anchor of anchors) {
    assert.match(anchor, /rel="noopener noreferrer"/);
    assert.ok(!/\s(?:onclick|onerror)="/.test(anchor), 'URL quote must not break out of href');
  }
  const selected = await (await post({ company_ids: ['ordinary'] })).text();
  assert.equal((selected.match(/class="card-title"/g) || []).length, 1);
  assert.ok(!selected.includes('&lt;img src=x'), 'selection excludes unrelated contacts');
  assert.ok(!(await (await post({ company_ids: [] })).text()).includes('class="card-title"'));
  for (const company_ids of ['ordinary', null, ['ordinary', 'missing'], ['missing'], ['ordinary', 'ordinary'], [null], {}]) {
    const rejected = await post({ company_ids });
    assert.equal(rejected.status, 400, 'malformed/stale HTML selection must not silently widen or partially export');
    assert.equal((await rejected.json()).code, 'INVALID_EXPORT_REQUEST');
  }
  await seed([
    { id: 'local-rich', company_name: 'Shared Synthetic Group', country: 'Kenya', type: 'Importer',
      email: 'office@synthetic.test', emails_list: ['office@synthetic.test', 'sales@synthetic.test'],
      phone: '+254 20 1234567', phones_list: ['+254 20 1234567', '+254 700 123456'],
      address: 'First Nairobi office', addresses: [
        { address: 'First Nairobi office', type: 'Head office', source_url: 'https://synthetic.test/kenya' },
        { address: 'Second Kisumu office', source_url: 'https://synthetic.test/kenya/branches' }],
      contact_persons: [{ name: 'Synthetic Director', designation: 'Managing Director', email: 'director@synthetic.test', phone: '+254 711 123456',
        country: 'Kenya', source_url: 'https://synthetic.test/team/" onclick="bad()', linkedin_url: 'JaVaScRiPt:alert(1)' },
        { name: hostile, designation: hostile, department: hostile, source_url: 'data:text/html,bad' }],
      socials: [{ platform: 'Published social', url: 'https://social.test/local', source_url: 'https://synthetic.test/kenya' }],
      sources: [{ url: 'https://synthetic.test/kenya', title: 'Kenyan office' }],
      unscoped_facts: [{ field: 'email', value: 'unproven@parent.test', scope: 'unknown' }] },
    { id: 'foreign-rich', company_name: 'Shared Synthetic Group', country: 'Pakistan', email: 'foreign@parent.test',
      contact_persons: [{ name: 'Foreign Parent Director', designation: 'CEO' }] },
  ]);
  const complete = await (await post({ company_ids: ['local-rich'] })).text();
  for (const value of ['Kenya', 'sales@synthetic.test', '+254 700 123456', 'Second Kisumu office', 'Synthetic Director',
    'Managing Director', 'director@synthetic.test', '+254 711 123456', 'https://social.test/local', 'https://synthetic.test/kenya/branches']) {
    assert.ok(complete.includes(value), `saved accepted value missing from actual export: ${value}`);
  }
  assert.equal((complete.match(/office@synthetic.test/g) || []).length, 1, 'scalar/list duplicate appears once');
  assert.ok(!complete.includes('foreign@parent.test') && !complete.includes('Foreign Parent Director'));
  assert.ok(!complete.includes('unproven@parent.test'), 'unscoped evidence must not be promoted to contact facts');
  assert.ok(!/<(?:img|script)\b/i.test(complete), 'nested people fields remain escaped');
  assert.ok(!/href="(?:javascript|data):/i.test(complete));
  for (const [, attributes] of complete.matchAll(/<a\s+([^>]+)>/g)) {
    assert.match(attributes, /rel="noopener noreferrer"/);
    assert.ok(!/\s(?:onclick|onerror)="/.test(attributes));
  }
  await seed([
    { id: 'fresh', company_name: 'Fresh', type: 'Importer', country: 'Kenya' },
    { id: 'details', company_name: 'Details', type: 'Importer', country: 'Kenya', edgeview_v1_run_id: 'r1', website: 'https://company.test' },
    { id: 'weak', company_name: 'Weak', type: 'Importer', country: 'Kenya', edgeview_v1_run_id: 'r2' },
    { id: 'excluded', company_name: 'Excluded', type: 'Exporter', country: 'Pakistan' },
    { id: 'historical-exporter', company_name: 'Historical exporter', type: 'Exporter', country: 'Pakistan', edgeview_v1_run_id: 'r3', email: 'office@company.test' },
  ]);
  const summary = await (await fetch(`${base}/api/summary`, { signal: AbortSignal.timeout(10_000) })).json();
  assert.equal(summary.total_companies, 5);
  assert.equal(summary.excluded_exporters, 2, 'historically researched Pakistan exporter remains excluded without deleting its record');
  assert.equal(summary.researched_companies, 2);
  assert.equal(summary.contacts_found, 1);
  assert.equal(summary.unresolved_after_research, 1);
  assert.equal(summary.not_researched, 1);
  assert.equal(summary.research_scope, 3);
  assert.equal((await (await post({})).text()).match(/class="card-title"/g)?.length, 5, 'scope exclusion does not erase exportable history');
  await seed([{ id: 'invalid', company_name: null }, { id: 'invalid2', company_name: {} }]);
  const failed = await post({});
  assert.equal(failed.status, 500);
  assert.deepEqual(await failed.json(), { success: false, code: 'EXPORT_BLOCKS_FAILED', message: 'Failed to export contact blocks.', recoverable: true });
  console.log('PASS actual HTML export endpoint: hostile fields, URL/control safety, multilingual values, selection, headers and sanitized failure; rendered download NOT VERIFIED');
} finally {
  if (child.exitCode === null) {
    const stopped = once(child, 'exit');
    child.kill();
    const timer = setTimeout(() => child.kill('SIGKILL'), 5000);
    await stopped; clearTimeout(timer);
  }
  fs.rmSync(root, { recursive: true, force: true });
}
