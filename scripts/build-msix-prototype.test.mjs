import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { prototypePreflight } from './build-msix-prototype.mjs';
import { writeBuildMetadata } from './build-metadata.mjs';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'edgeview-msix-preflight-'));
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => /^(PATH|SystemRoot|WINDIR|COMSPEC|USERPROFILE|TEMP|TMP|APPDATA|LOCALAPPDATA)$/i.test(key)));
Object.assign(env, { GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: path.join(root, '.git/empty-global-config') });
const git = args => {
  const result = spawnSync('git', ['-c', 'user.name=Synthetic Fixture', '-c', 'user.email=fixture@example.test', '-c', 'commit.gpgsign=false', '-c', `core.hooksPath=${path.join(root, '.git/empty-hooks')}`, ...args],
    { cwd: root, env, encoding: 'utf8', windowsHide: true });
  assert.equal(result.status, 0, 'owned fixture Git command failed');
  return result.stdout.trim();
};
try {
  fs.mkdirSync(path.join(root, 'dist'));
  fs.writeFileSync(path.join(root, 'package.json'), '{"name":"edgeview","version":"1.0.0-rc.2"}');
  fs.writeFileSync(path.join(root, '.gitignore'), 'dist/\n');
  fs.writeFileSync(path.join(root, 'dist/index.html'), '<html>Synthetic fixture</html>');
  fs.writeFileSync(path.join(root, 'dist/server.cjs'), '/* synthetic fixture */');
  git(['init']); git(['add', '--', 'package.json', '.gitignore']); git(['commit', '-m', 'synthetic fixture']);
  const commit = git(['rev-parse', 'HEAD']);
  writeBuildMetadata(root, commit);
  assert.equal(prototypePreflight(root).commit, commit);
  fs.writeFileSync(path.join(root, 'unreviewed.txt'), 'unreviewed fixture change');
  assert.throws(() => prototypePreflight(root), /MSIX_PROTOTYPE_REQUIRES_CLEAN_SOURCE/);
  fs.unlinkSync(path.join(root, 'unreviewed.txt'));
  fs.writeFileSync(path.join(root, 'dist/server.cjs'), '/* changed after build */');
  assert.throws(() => prototypePreflight(root), /MSIX_PROTOTYPE_BUILD_IDENTITY_MISMATCH/);
  fs.writeFileSync(path.join(root, 'dist/server.cjs'), '/* synthetic fixture */');
  writeBuildMetadata(root, 'f'.repeat(40));
  assert.throws(() => prototypePreflight(root), /MSIX_PROTOTYPE_BUILD_IDENTITY_MISMATCH/);
  console.log('PASS actual Git/build preflight: clean exact commit accepted; dirty, changed artifact and wrong commit refused');
} finally {
  const resolved = fs.realpathSync(root), prefix = fs.realpathSync(os.tmpdir()) + path.sep + 'edgeview-msix-preflight-';
  if (!resolved.startsWith(prefix) || fs.lstatSync(root).isSymbolicLink()) throw new Error('Refuse fixture cleanup outside owned temporary root');
  fs.rmSync(root, { recursive: true, force: true });
}
