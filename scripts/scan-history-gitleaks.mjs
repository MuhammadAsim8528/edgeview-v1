import { createHash } from 'node:crypto';
import { mkdtemp, writeFile, readFile, rm, readdir, lstat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import JSZip from 'jszip';
import { Readable } from 'node:stream';

// Development/CI only. Never copied into the runtime script whitelist.
export const VERSION = '8.30.1';
const URL = `https://github.com/gitleaks/gitleaks/releases/download/v${VERSION}/gitleaks_${VERSION}_windows_x64.zip`;
const SHA256 = 'd29144deff3a68aa93ced33dddf84b7fdc26070add4aa0f4513094c8332afc4e';
const LIMIT = 32 * 1024 * 1024;
function environment() {
  return Object.fromEntries(Object.entries(process.env).filter(([name]) =>
    /^(PATH|SYSTEMROOT|WINDIR|COMSPEC|USERPROFILE|HOME|TEMP|TMP|APPDATA|LOCALAPPDATA)$/i.test(name)));
}
function execute(file, args, cwd, allowed = [0]) {
  const result = spawnSync(file, args, { cwd, env: environment(), encoding: 'utf8',
    windowsHide: true, timeout: 180_000, maxBuffer: 2 * 1024 * 1024 });
  if (result.error || !allowed.includes(result.status)) throw new Error('SECRET_SCAN_PROCESS_FAILED');
  return result;
}
export function verifyArchive(bytes) {
  if (bytes.length > LIMIT || createHash('sha256').update(bytes).digest('hex') !== SHA256) {
    throw new Error('SECRET_SCAN_ARCHIVE_INTEGRITY_FAILED');
  }
}
export async function withScanner(operation) {
  if (process.platform !== 'win32' || process.arch !== 'x64') throw new Error('SECRET_SCAN_PLATFORM_UNSUPPORTED');
  const directory = await mkdtemp(join(tmpdir(), 'edgeview-secret-scan-'));
  try {
    const response = await fetch(URL, { signal: AbortSignal.timeout(60_000) });
    if (!response.ok || !response.body) throw new Error('SECRET_SCAN_DOWNLOAD_FAILED');
    const chunks = [];
    let size = 0;
    for await (const chunk of response.body) {
      size += chunk.length;
      if (size > LIMIT) throw new Error('SECRET_SCAN_DOWNLOAD_LIMIT');
      chunks.push(chunk);
    }
    const bytes = Buffer.concat(chunks);
    verifyArchive(bytes);
    const archive = await JSZip.loadAsync(bytes);
    const entry = archive.file('gitleaks.exe');
    if (!entry) throw new Error('SECRET_SCAN_EXECUTABLE_MISSING');
    const executable = join(directory, 'gitleaks.exe');
    // Only this fixed member is extracted; archive paths never become filesystem paths.
    let extracted = 0;
    const executableChunks = [];
    for await (const chunk of new Readable().wrap(entry.nodeStream())) {
      extracted += chunk.length;
      if (extracted > LIMIT) throw new Error('SECRET_SCAN_EXECUTABLE_LIMIT');
      executableChunks.push(chunk);
    }
    await writeFile(executable, Buffer.concat(executableChunks), { flag: 'wx' });
    if (execute(executable, ['version'], directory).stdout.trim() !== VERSION) throw new Error('SECRET_SCAN_VERSION_MISMATCH');
    const config = join(directory, 'rules.toml');
    const ignore = join(directory, 'empty-ignore');
    await writeFile(config, '[extend]\nuseDefault = true\n', { flag: 'wx' });
    await writeFile(ignore, '', { flag: 'wx' });
    const directoryScan = async directoryToScan => {
      const root = resolve(directoryToScan);
      // Default upstream path allowlists exclude lockfiles/SVG/vendor names.
      // Scan every staged regular file under neutral names, without altering the
      // bytes which will be packaged. Bound memory/disk and reject links.
      const payload = await mkdtemp(join(directory, 'payload-'));
      let count = 0; let total = 0;
      const copy = async source => {
        const info = await lstat(source);
        if (info.isSymbolicLink()) throw new Error('SECRET_SCAN_LINK_REJECTED');
        if (info.isDirectory()) {
          for (const entry of await readdir(source)) await copy(join(source, entry));
          return;
        }
        if (!info.isFile() || ++count > 10_000 || info.size > 64 * 1024 * 1024
          || (total += info.size) > 256 * 1024 * 1024) throw new Error('SECRET_SCAN_PAYLOAD_LIMIT');
        const bytes = await readFile(source);
        if (bytes.length !== info.size) throw new Error('SECRET_SCAN_PAYLOAD_CHANGED');
        // This deliverable has no compressed runtime inputs. Do not certify
        // opaque containers as credential-free or expand untrusted archives.
        const archiveMagic = ['504b0304', '504b0506', '504b0708', '1f8b', '377abcaf271c',
          '526172211a07', '425a68', 'fd377a585a00', '28b52ffd', '04224d18', '1f9d'];
        const prefix = bytes.subarray(0, 8).toString('hex');
        if (/\.(?:zip|gz|tgz|br|7z|tar|rar|bz2|xz|zst|lz4|z)$/i.test(source)
          || archiveMagic.some(magic => prefix.startsWith(magic))
          || bytes.subarray(257, 262).toString('ascii') === 'ustar') throw new Error('SECRET_SCAN_UNSUPPORTED_ARCHIVE');
        await writeFile(join(payload, `${count}.txt`), bytes, { flag: 'wx' });
        // Known ASCII credential formats must also be visible in BOM-less
        // UTF-16/32 text. The valid UTF-8 projection removes NUL padding without
        // changing shipped bytes; derived copies count toward the scan budget.
        if (bytes.includes(0)) {
          const unpadded = bytes.toString('utf8').replace(/\0/g, '');
          total += Buffer.byteLength(unpadded);
          if (total > 256 * 1024 * 1024) throw new Error('SECRET_SCAN_PAYLOAD_LIMIT');
          await writeFile(join(payload, `${count}-unpadded.txt`), unpadded, { flag: 'wx' });
        }
        if (bytes.length >= 2 && ((bytes[0] === 255 && bytes[1] === 254) || (bytes[0] === 254 && bytes[1] === 255))) {
          if (bytes.length % 2) throw new Error('SECRET_SCAN_INVALID_UTF16');
          const decoded = Buffer.from(bytes.subarray(2));
          if (bytes[0] === 254) decoded.swap16();
          const text = decoded.toString('utf16le');
          total += Buffer.byteLength(text);
          if (total > 256 * 1024 * 1024) throw new Error('SECRET_SCAN_PAYLOAD_LIMIT');
          await writeFile(join(payload, `${count}-utf16.txt`), text, { flag: 'wx' });
        }
      };
      await copy(root);
      const report = join(directory, 'directory-report.json');
      await rm(report, { force: true });
      const result = execute(executable, ['dir', payload, '--config', config, '--gitleaks-ignore-path', ignore,
        '--ignore-gitleaks-allow', '--redact=100', '--no-banner', '--log-level', 'fatal', '--timeout', '120',
        '--max-decode-depth', '2', '--report-format', 'json', '--report-path', report], root, [0, 1]);
      const stat = await import('node:fs/promises').then(fs => fs.stat(report));
      if (stat.size > 8 * 1024 * 1024) throw new Error('SECRET_SCAN_REPORT_LIMIT');
      const findings = JSON.parse(await readFile(report, 'utf8'));
      if (!Array.isArray(findings) || (result.status === 0) !== (findings.length === 0)) throw new Error('SECRET_SCAN_REPORT_INVALID');
      await rm(payload, { recursive: true, force: true });
      return { scanner: 'gitleaks', version: VERSION, scope: 'staged directory content', filesScanned: count, findings: findings.length };
    };
    await operation(async repository => {
      const root = resolve(repository);
      if (execute('git', ['rev-parse', '--is-shallow-repository'], root).stdout.trim() !== 'false') throw new Error('SECRET_SCAN_SHALLOW_HISTORY');
      const report = join(directory, 'report.json');
      await rm(report, { force: true });
      const result = execute(executable, ['git', root, '--config', config, '--gitleaks-ignore-path', ignore,
        '--ignore-gitleaks-allow', '--redact=100', '--no-banner', '--log-level', 'fatal', '--timeout', '120',
        '--log-opts=--all --full-history -m --no-ext-diff --no-textconv', '--report-format', 'json', '--report-path', report], root, [0, 1]);
      const stat = await import('node:fs/promises').then(fs => fs.stat(report));
      if (stat.size > 8 * 1024 * 1024) throw new Error('SECRET_SCAN_REPORT_LIMIT');
      const findings = JSON.parse(await readFile(report, 'utf8'));
      if (!Array.isArray(findings) || (result.status === 0) !== (findings.length === 0)) throw new Error('SECRET_SCAN_REPORT_INVALID');
      // No secret, match, author, path or arbitrary scanner diagnostics leave this boundary.
      return { scanner: 'gitleaks', version: VERSION, scope: 'all locally available Git refs', findings: findings.length };
    }, directoryScan);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    await withScanner(async scan => {
      const summary = await scan(process.cwd());
      console.log(JSON.stringify(summary));
      if (summary.findings) process.exitCode = 1;
    });
  } catch {
    console.error('Secret scanning could not complete. Release gate failed; no scanner output disclosed.');
    process.exitCode = 2;
  }
}
