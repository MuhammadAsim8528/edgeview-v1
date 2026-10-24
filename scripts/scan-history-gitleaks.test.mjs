import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { verifyArchive, withScanner } from './scan-history-gitleaks.mjs';

assert.throws(() => verifyArchive(Buffer.from('modified archive')), /INTEGRITY_FAILED/);
const root = await mkdtemp(join(tmpdir(), 'edgeview-secret-controls-'));
function git(directory, ...args) {
  const result = spawnSync('git', args, { cwd: directory, encoding: 'utf8', windowsHide: true });
  assert.equal(result.status, 0, 'Disposable Git operation must succeed');
  return result.stdout;
}
try {
  git(root, 'init');
  git(root, 'config', 'user.name', 'Synthetic Test');
  git(root, 'config', 'user.email', 'test@example.invalid');
  await writeFile(join(root, 'ordinary.js'), 'const api_key = "not-a-key";\nconst name = "普通の値";\n');
  git(root, 'add', '.');
  git(root, 'commit', '-m', 'benign control');
  await withScanner(async scan => {
    assert.equal((await scan(root)).findings, 0, 'Ordinary source must pass');
    const originalBranch = git(root, 'branch', '--show-current').trim();
    git(root, 'checkout', '-b', 'clean-side');
    await writeFile(join(root, 'ordinary.js'), 'const name = "side";\n');
    git(root, 'commit', '-am', 'clean side');
    git(root, 'checkout', originalBranch);
    await writeFile(join(root, 'ordinary.js'), 'const name = "main";\n');
    git(root, 'commit', '-am', 'clean main');
    const merge = spawnSync('git', ['merge', 'clean-side'], { cwd: root, encoding: 'utf8', windowsHide: true });
    assert.equal(merge.status, 1, 'Fixture must require conflict resolution');
    const mergeCanary = ['gh', 'p_'].join('') + randomBytes(18).toString('hex');
    await writeFile(join(root, 'ordinary.js'), `const token = "${mergeCanary}";\n`);
    git(root, 'add', 'ordinary.js');
    git(root, 'commit', '-m', 'merge-only synthetic canary');
    const mergeDetected = await scan(root);
    assert.ok(mergeDetected.findings > 0, 'A canary introduced only in a merge must be detected');
    assert.ok(!JSON.stringify(mergeDetected).includes(mergeCanary));
    // Reset this disposable fixture to its known benign commit for the independent controls.
    git(root, 'checkout', '--orphan', 'separate-controls');
    git(root, 'rm', '-rf', '.');
    await writeFile(join(root, 'ordinary.js'), 'const api_key = "not-a-key";\n');
    git(root, 'add', '.');
    git(root, 'commit', '-m', 'benign separate controls');
    git(root, 'branch', '-D', originalBranch, 'clean-side');
    assert.equal((await scan(root)).findings, 0);
    // Random, never-issued canary; it is never printed, retained or used for authentication.
    const canary = ['gh', 'p_'].join('') + randomBytes(18).toString('hex');
    await writeFile(join(root, 'credential.txt'), `token = "${canary}" // gitleaks:allow\n`);
    await writeFile(join(root, '.gitleaks.toml'), '[allowlist]\npaths = [\'\'\'.*\'\'\']\n');
    await writeFile(join(root, '.gitleaksignore'), '*\n');
    git(root, 'add', '.');
    git(root, 'commit', '-m', 'synthetic negative control');
    const oldGate = spawnSync(process.execPath, [fileURLToPath(new URL('./audit-git-secrets.mjs', import.meta.url))],
      { cwd: root, encoding: 'utf8', windowsHide: true });
    assert.equal(oldGate.status, 0, 'Negative control must demonstrate the existing pattern gap');
    assert.ok(!`${oldGate.stdout}${oldGate.stderr}`.includes(canary));
    const detected = await scan(root);
    assert.ok(detected.findings > 0, 'Repository config/ignore/inline allow must not suppress canary');
    assert.ok(!JSON.stringify(detected).includes(canary), 'Public summary must not disclose canary');
    git(root, 'rm', 'credential.txt');
    git(root, 'commit', '-m', 'delete synthetic canary');
    assert.ok((await scan(root)).findings > 0, 'Deleted-file history must still be scanned');
    const shallow = join(root, 'shallow-copy');
    git(root, 'clone', '--depth=1', `file:///${root.replaceAll('\\', '/')}`, shallow);
    await assert.rejects(scan(shallow), /SHALLOW_HISTORY/);
  });
  console.log('Pinned history scanner: benign, merge-only canary, deletion, ignore bypass, shallow and integrity controls PASS');
} finally {
  await rm(root, { recursive: true, force: true });
}
