import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
export const REQUIRED_GATES = Object.freeze(['A','B','C','D','E','F','G','H','I','J','K']);
const STATES = new Set(['PASS','WARN','FAIL','SKIPPED','NOT VERIFIED']);

function evidenceFile(root, relative) {
  if (typeof relative !== 'string' || !relative.startsWith('evidence/') || /[\\:\u0000-\u001f]/u.test(relative)
    || relative.split('/').some(part => !part || part === '.' || part === '..')) throw new Error('Unsafe evidence path.');
  let cursor = root;
  for (const part of relative.split('/')) {
    cursor = path.join(cursor, part);
    if (fs.lstatSync(cursor).isSymbolicLink()) throw new Error('Evidence links are not accepted.');
  }
  const stat = fs.statSync(cursor);
  if (!stat.isFile() || stat.size > 32 * 1024 * 1024) throw new Error('Evidence must be a bounded regular file.');
  return cursor;
}
export async function verifyReleaseEvidence(manifest, evidenceRoot, expectedCommit) {
  if (manifest?.format !== 1 || !/^[a-f0-9]{40}$/u.test(expectedCommit || '') || manifest.commit !== expectedCommit) throw new Error('Exact expected commit required.');
  if (!Array.isArray(manifest.gates) || manifest.gates.length !== REQUIRED_GATES.length) throw new Error('All A–K gates must be explicit.');
  const root = fs.realpathSync(evidenceRoot);
  const seen = new Set();
  let references = 0;
  for (const gate of manifest.gates) {
    if (!REQUIRED_GATES.includes(gate.id) || seen.has(gate.id) || !STATES.has(gate.status)) throw new Error('Unknown/duplicate gate or state.');
    seen.add(gate.id);
    if (typeof gate.note !== 'string' || !gate.note.trim() || gate.note.length > 2000) throw new Error('Every gate needs a bounded factual note.');
    if (!Array.isArray(gate.evidence) || (gate.status === 'PASS' && !gate.evidence.length)) throw new Error('PASS requires evidence references.');
    for (const entry of gate.evidence) {
      if (++references > 256 || !/^[a-f0-9]{64}$/u.test(entry.sha256 || '')) throw new Error('Invalid/excess evidence references.');
      const target = evidenceFile(root, entry.path);
      const hash = crypto.createHash('sha256');
      for await (const chunk of fs.createReadStream(target)) hash.update(chunk);
      if (hash.digest('hex') !== entry.sha256) throw new Error('Evidence digest mismatch.');
    }
  }
  const open = manifest.gates.filter(gate => gate.status !== 'PASS').map(gate => ({ id: gate.id, status: gate.status }));
  return { commit: expectedCommit, consistency: 'PASS', openGates: open,
    acceptance: 'NOT VERIFIED', limitation: 'Hashes establish submitted bytes only. Human review must establish authenticity, execution, privacy, environment and relevance. This tool never authorizes READY or promotion.' };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [manifestFile, commit] = process.argv.slice(2);
    if (!manifestFile || !commit) throw new Error('Usage: node scripts/verify-release-evidence.mjs <manifest.json> <exact-commit>');
    const filename = path.resolve(manifestFile);
    if (fs.statSync(filename).size > 1024 * 1024) throw new Error('Manifest exceeds limit.');
    const report = await verifyReleaseEvidence(JSON.parse(fs.readFileSync(filename, 'utf8')), path.dirname(filename), commit);
    console.log(JSON.stringify(report, null, 2));
    if (report.openGates.length) process.exitCode = 1;
  } catch {
    console.error('Release evidence rejected: invalid/incomplete manifest, unsafe reference or mismatched artifact. No promotion authorized.');
    process.exitCode = 1;
  }
}
