import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Real npm, no registry/package downloads and no changes to the user's npmrc.
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'edgeview-npm-policy-'));
const bootstrap = fileURLToPath(new URL('./ensure-dependencies.mjs', import.meta.url));
const manifest = { name: 'edgeview-policy-fixture', version: '1.0.0', dependencies: {} };
try {
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify(manifest));
  fs.writeFileSync(path.join(root, 'package-lock.json'), JSON.stringify({ name: manifest.name, version: manifest.version, lockfileVersion: 3, requires: true, packages: { '': manifest } }));
  const npmrc = path.join(root, 'unrelated-user.npmrc');
  fs.writeFileSync(npmrc, 'allow-scripts=@anthropic-ai/claude-code\n');
  const globalrc = path.join(root, 'unrelated-global.npmrc');
  fs.writeFileSync(globalrc, 'allow-scripts=@unrelated/tool\n');
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/API_KEY|SECRET|TOKEN|PASSWORD|COOKIE|AUTH|^EDGEVIEW_|^npm_config_/i.test(key)));
  Object.assign(env, { npm_config_allow_scripts: '@anthropic-ai/claude-code', npm_config_userconfig: npmrc, npm_config_globalconfig: globalrc, npm_config_offline: 'true' });
  const run = () => spawnSync(process.execPath, [bootstrap], { cwd: root, env, encoding: 'utf8', timeout: 60000, maxBuffer: 1024 * 1024, windowsHide: true });
  fs.mkdirSync(path.join(root, 'node_modules'));
  const first = run();
  if (first.status !== 0) console.error(first.stdout, first.stderr);
  assert.equal(first.status, 0, 'real offline npm install must ignore unrelated user/global script policy');
  assert.ok(fs.existsSync(path.join(root, 'node_modules/.edgeview-install.json')));
  const restart = run();
  assert.equal(restart.status, 0);
  assert.match(restart.stdout, /up to date/, 'restart reuses repaired installation');
  fs.unlinkSync(npmrc); fs.unlinkSync(globalrc);
  fs.unlinkSync(path.join(root, 'node_modules/.edgeview-install.json'));
  assert.equal(run().status, 0, 'missing user/global config does not block repair');
  console.log('PASS real offline npm policy isolation, missing config and restart after repair');
} finally { fs.rmSync(root, { recursive: true, force: true }); }
