import fs from 'node:fs';
import crypto from 'node:crypto';
import JSZip from 'jszip';

const archive = '.archive/edgeview-retired-provider-source-2026-10-19.zip';
if (fs.existsSync(archive)) throw new Error('Refusing to overwrite a historical source archive.');
const files = ['server/settings.ts', 'server/apify.ts'];
const zip = new JSZip();
const manifest = [];
for (const file of files) {
  const content = fs.readFileSync(file);
  zip.file(file, content);
  manifest.push({ path: file, bytes: content.length, sha256: crypto.createHash('sha256').update(content).digest('hex'),
    description: file.endsWith('settings.ts') ? 'Complete source context before retiring five unused provider test functions; active settings code remains.' : 'Unused Apify adapter retained through the settings import.',
    reason: 'Public V1 routes allow only Serper, Hunter, NVIDIA and Groq; these retired implementations have no supported caller.' });
}
zip.file('ARCHIVE_README.txt', 'HISTORICAL SOURCE ONLY. DO NOT IMPORT OR RESTORE TO THE ACTIVE BUILD. Includes source code only; no configuration, credentials or customer data.\n');
zip.file('MANIFEST.json', JSON.stringify(manifest, null, 2));
fs.mkdirSync('.archive', { recursive: true });
const bytes = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
fs.writeFileSync(archive, bytes, { flag: 'wx' });
const verified = await JSZip.loadAsync(fs.readFileSync(archive), { checkCRC32: true });
for (const entry of manifest) {
  const restored = await verified.file(entry.path).async('nodebuffer');
  if (restored.length !== entry.bytes || crypto.createHash('sha256').update(restored).digest('hex') !== entry.sha256) throw new Error('Archive verification failed; do not remove source.');
}
const result = { archive, archive_sha256: crypto.createHash('sha256').update(bytes).digest('hex'), files: manifest,
  retired_symbols: ['testTavilyKey','testExaKey','testLinkupKey','testFirecrawlKey','testApifyKey'],
  note: 'Supplement to the separately verified 148-file pre-V1 archive. settings.ts is context, not a file to remove.' };
fs.writeFileSync('docs/RETIRED_PROVIDER_SOURCE.json', JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ verified: true, archive, files: manifest.length, sha256: result.archive_sha256 }));
