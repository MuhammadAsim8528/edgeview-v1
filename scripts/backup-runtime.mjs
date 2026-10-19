import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const destination = path.join(root, 'backups', `EdgeView-${stamp}`);
const included = ['edgeview.db', 'edgeview_db.json', 'config.json', 'data', 'uploads'];
const manifest = { format: 1, created_at: new Date().toISOString(), files: [] };

async function sha256File(file) {
  const hash = crypto.createHash('sha256');
  for await (const chunk of fs.createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}

async function copyTree(source, target, relative) {
  const stat = fs.statSync(source);
  if (stat.isDirectory()) {
    fs.mkdirSync(target, { recursive: true });
    for (const entry of fs.readdirSync(source)) await copyTree(path.join(source, entry), path.join(target, entry), `${relative}/${entry}`);
    return;
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target, fs.constants.COPYFILE_EXCL);
  manifest.files.push({ path: relative.replace(/\\/g, '/'), bytes: stat.size, sha256: await sha256File(target) });
}

fs.mkdirSync(path.dirname(destination), { recursive: true });
fs.mkdirSync(destination, { recursive: false });
for (const item of included) {
  const source = path.join(root, item);
  if (fs.existsSync(source)) await copyTree(source, path.join(destination, item), item);
}
if (!manifest.files.length) throw new Error('No EdgeView runtime files were found to back up.');
fs.writeFileSync(path.join(destination, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
console.log(JSON.stringify({ backup: destination, files: manifest.files.length, bytes: manifest.files.reduce((sum, file) => sum + file.bytes, 0) }));
