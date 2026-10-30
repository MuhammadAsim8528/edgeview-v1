import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// A generated view of the authoritative ledger, never another planning store.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const destination = process.argv[2];
if (!destination || !path.isAbsolute(destination) || !destination.endsWith('.html')) {
  throw new Error('Provide an absolute HTML output path');
}
const ledger = fs.readFileSync(path.join(root, 'docs/OUTSTANDING_WORK.md'), 'utf8');
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const escape = value => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const capabilities = ledger.split(/\r?\n/).filter(line => /^\| [A-Z]+\d+ P\d/.test(line));
const rows = capabilities.map(line => '<tr>' + line.split('|').slice(1, -1).map(cell => `<td>${escape(cell.trim())}</td>`).join('') + '</tr>').join('\n');
const current = ledger.match(/^Current active task: (.+)$/m)?.[1] || 'No current task recorded; inspect the authoritative ledger.';
// New checkpoint notes are prepended; older evidence was appended. Show both.
const latest = ledger.split(/^## Authoritative implementation ledger/m)[0]
  + '\nEarlier checkpoint evidence\n' + ledger.split(/(?=^### )/m).slice(-3).join('\n');
const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>EdgeView progress</title>
<style>body{font:17px/1.55 system-ui,sans-serif;background:#f5f7fa;color:#182331;margin:0}main{max-width:1200px;margin:auto;padding:32px}h1,h2{line-height:1.2}header,section{background:white;padding:24px;margin-bottom:20px;border:1px solid #d5dce5;border-radius:10px}.status{font-weight:700;color:#a02d19}table{width:100%;border-collapse:collapse;font-size:14px}td,th{border:1px solid #d5dce5;padding:12px;text-align:left;vertical-align:top}th{background:#eaf0f6}pre{white-space:pre-wrap;font:15px/1.6 system-ui}code{overflow-wrap:anywhere}@media(max-width:700px){main{padding:12px}section{overflow:auto}table{min-width:780px}}</style>
<main><header><h1>EdgeView progress workspace</h1><p class="status">NOT READY for customer release</p><p>Updated ${escape(new Date().toISOString())} · Source <code>${escape(commit)}</code></p><p>This page is regenerated at work checkpoints. It does not update while this session is stopped. Reload after an update. The repository goal ledger remains the authority.</p></header>
<section><h2>Working now</h2><p>${escape(current)}</p><h2>Priority and timing</h2><p>Release blockers first: incorrect company and country facts, lost data, privacy and secrets, unsafe recovery, installation and essential workflows. Optional improvements go to follow-up patches. No guaranteed hourly ship promise.</p><p>Existing planning targets remain November 2 for a private candidate and November 6 for the release decision, conditional on prerequisites. Signing, clean Windows and final visual acceptance remain gates. Microsoft Store setup and public shipping are deferred.</p></section>
<section><h2>Capability checklist</h2><p>Evidence and remaining criteria are copied from the canonical ledger. A test result does not establish whole-product correctness.</p><table><thead><tr><th>Goal</th><th>State</th><th>Existing evidence</th><th>Still required</th></tr></thead><tbody>${rows}</tbody></table></section>
<section><h2>Latest completed work and checks</h2><pre>${escape(latest)}</pre></section></main></html>`;
fs.mkdirSync(path.dirname(destination), { recursive: true });
fs.writeFileSync(destination, html, 'utf8');
console.log(`Progress workspace refreshed: ${capabilities.length} capability records`);
