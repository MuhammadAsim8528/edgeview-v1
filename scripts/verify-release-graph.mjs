import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { build } from 'esbuild';
import JSZip from 'jszip';
import ts from 'typescript';

const root = process.cwd();
const manifest = fs.readFileSync('docs/LEGACY_ARCHIVE_MANIFEST.md', 'utf8');
const retired = [...manifest.matchAll(/^\| `([^`]+)` \|[^|]+\|\s*(\d+)\s*\| `([a-f0-9]{64})`/gm)]
  .map(match => ({ path: match[1], bytes: Number(match[2]), sha256: match[3] }));
if (!retired.length) throw new Error('Legacy manifest has no parseable file inventory.');
const graphs = {};
for (const [name, entry, platform] of [['backend','server.ts','node'], ['frontend','src/main.tsx','browser']]) {
  const result = await build({ entryPoints: [entry], bundle: true, platform, packages: 'external',
    write: false, metafile: true, logLevel: 'silent', format: 'esm', loader: { '.css': 'empty' } });
  const inputs = Object.keys(result.metafile.inputs).map(file => file.replace(/\\/g, '/')).sort();
  for (const file of inputs.filter(file => /\.[cm]?[jt]sx?$/.test(file))) {
    const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
    const visit = node => {
      if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword
        && (!node.arguments[0] || !ts.isStringLiteralLike(node.arguments[0]))) {
        throw new Error(`Computed dynamic import requires explicit dependency review: ${file}`);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  for (const file of retired) {
    if (inputs.includes(file.path)) throw new Error(`Retired module is reachable: ${file.path}`);
  }
  graphs[name] = { files: inputs, count: inputs.length,
    lines: inputs.reduce((sum, file) => sum + fs.readFileSync(file,'utf8').split(/\r?\n/).length, 0) };
}
for (const file of retired) if (fs.existsSync(path.join(root, file.path))) throw new Error(`Retired source restored into active tree: ${file.path}`);
const archivePath = '.archive/edgeview-pre-v1-legacy-2026-10-19.zip';
let archive = { verified: false, reason: 'Local archive not present; CI still verifies no retired imports or source paths.' };
if (fs.existsSync(archivePath)) {
  const bytes = fs.readFileSync(archivePath);
  const expected = manifest.match(/Archive SHA-256: `([a-f0-9]{64})`/)?.[1];
  const digest = crypto.createHash('sha256').update(bytes).digest('hex');
  if (digest !== expected) throw new Error('Legacy archive digest mismatch.');
  const zip = await JSZip.loadAsync(bytes, { checkCRC32: true });
  const allowed = new Set([...retired.map(file => file.path), 'ARCHIVE_README.txt']);
  for (const name of Object.keys(zip.files)) if (!zip.files[name].dir && !allowed.has(name)) throw new Error(`Unexpected archived file: ${name}`);
  for (const file of retired) {
    const entry = zip.file(file.path);
    if (!entry) throw new Error(`Archive missing ${file.path}`);
    const content = await entry.async('nodebuffer');
    if (content.length !== file.bytes || crypto.createHash('sha256').update(content).digest('hex') !== file.sha256) throw new Error(`Archived file integrity mismatch: ${file.path}`);
  }
  archive = { verified: true, files: retired.length, sha256: digest };
}
const report = { generated_at: new Date().toISOString(), ...graphs, retired_inputs: 0, archive,
  note: 'esbuild dependency closure including literal dynamic imports; CSS excluded from source line count. No runtime data read.' };
fs.writeFileSync('docs/ACTIVE_DEPENDENCY_GRAPH.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ backend: graphs.backend.count, frontend: graphs.frontend.count, retired_inputs: 0, archive }));
