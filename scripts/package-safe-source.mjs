import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const outputDir = join(root, '.agent', 'packages');
mkdirSync(outputDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const output = join(outputDir, `edgeview-safe-source-${stamp}.zip`);
const excludes = [
  '.env', '.env.*', 'config.json', 'config.prev.json', 'EDGEVIEW_SECURITY_AUDIT_FULL.md', '*.db', '*.db-*', '*.db.*', 'edgeview_db.json',
  '.git', '.archive', '.edgeview-build-backup-*', 'node_modules', 'dist', 'data', 'uploads', 'backups', 'snapshots', 'logs', '.npm-cache', '.test-cache', '.antigravity', '.agent',
  '*.log', '*.bak', '*.backup', '*.backup.*', '*.pid', '*.err', '*.lock', 'v1-coverage-audit.json',
];
const args = ['-a', '-c', '-f', output, ...excludes.map((value) => `--exclude=${value}`), '.'];
const created = spawnSync('tar', args, { cwd: root, encoding: 'utf8' });
if (created.status !== 0) throw new Error(`Safe package creation failed: ${created.stderr || 'tar failed'}`);

const listed = spawnSync('tar', ['-tf', output], { cwd: root, encoding: 'utf8' });
if (listed.status !== 0) {
  rmSync(output, { force: true });
  throw new Error(`Safe package verification failed: ${listed.stderr || 'tar listing failed'}`);
}
const unsafe = listed.stdout.split(/\r?\n/).filter((entry) => /(^|\/)(?:\.env(?:\.|$)|config(?:\.prev)?\.json$|EDGEVIEW_SECURITY_AUDIT_FULL\.md$|(?:\.git|\.archive|node_modules|data|uploads|backups|snapshots|logs|\.npm-cache|\.test-cache|\.agent)\/|[^/]+\.db(?:[-.].*)?$|edgeview_db\.json(?:\.|$)|[^/]+\.backup(?:\.|$))/i.test(entry));
if (unsafe.length) {
  rmSync(output, { force: true });
  throw new Error(`Safe package verification rejected ${unsafe.length} prohibited path(s)`);
}
console.log(output);
