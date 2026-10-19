import { spawnSync } from 'node:child_process';

function git(args, allowed = [0]) {
  const result = spawnSync('git', args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  if (!allowed.includes(result.status)) throw new Error(`Git history audit command failed (exit ${result.status}).`);
  return result.stdout.trim();
}
const commits = git(['rev-list', '--all']).split(/\r?\n/).filter(Boolean);
if (!commits.length) throw new Error('No committed history available for audit.');
const paths = [...new Set(git(['log','--all','--format=','--name-only']).split(/\r?\n/).filter(Boolean))];
const prohibited = paths.filter(file => /(^|\/)(?:config(?:\.prev)?\.json|edgeview_db\.json|[^/]+\.db(?:[-.].*)?|\.env(?:\..*)?)$/i.test(file)
  && !/(^|\/)\.env\.example$/i.test(file));
// Only filenames are requested from git grep; matched credential text is never
// returned to this process or printed. This is a pattern gate, not an entropy scan.
const patterns = [
  'nvapi-[A-Za-z0-9_-]{50,}', 'gsk_[A-Za-z0-9]{45,}',
  'sk-proj-[A-Za-z0-9_-]{60,}', 'AIza[A-Za-z0-9_-]{30,}',
  'apify_api_[A-Za-z0-9]{25,}',
  '-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----',
];
const findings = new Set();
// Bound command-line size even on long-lived Windows repositories.
for (let start = 0; start < commits.length; start += 20) {
  const matches = git(['grep','-I','-l','-E', ...patterns.flatMap(pattern => ['-e',pattern]), ...commits.slice(start,start + 20), '--'], [0,1]);
  for (const match of matches.split(/\r?\n/).filter(Boolean)) findings.add(match);
}
console.log(JSON.stringify({ commitsScanned: commits.length, historicalPaths: paths.length,
  prohibitedPaths: prohibited, credentialPatternFileMatches: [...findings],
  limitation: 'Known provider/private-key patterns in text blobs only; no entropy scan, ignored local files, or unavailable pre-baseline history.' }, null, 2));
if (prohibited.length || findings.size) process.exitCode = 1;
