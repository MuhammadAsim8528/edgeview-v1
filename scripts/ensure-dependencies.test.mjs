import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ensureDependencies, nodeVersionSupported, assertSupportedNode, NODE_RANGE, lockedDependencyClosure, productionLockIntegrityGaps, installedProductionDependenciesMatch } from './ensure-dependencies.mjs';

// These cases include versions accepted by the old Vite-only guard but rejected
// by the actual locked monitoring/development toolchain. Prereleases abstain.
for (const version of ['20.20.0', '20.30.0', '22.22.0', '22.30.1', '24.0.0', '24.19.0', 'v24.19.0']) {
  assert.equal(nodeVersionSupported(version), true, `${version} must be accepted`);
}
for (const version of ['18.20.4', '20.19.9', '21.7.3', '22.12.0', '22.21.9', '23.2.0', '24', '20.20', '24.0.0-rc.1', '', 'twenty']) {
  assert.equal(nodeVersionSupported(version), false, `${version} must be rejected`);
}
assert.doesNotThrow(() => assertSupportedNode('24.18.0'));
assert.throws(() => assertSupportedNode('20.18.3'), (err) => {
  assert.ok(err.message.includes('20.18.3'), `message must name the found version: ${err.message}`);
  assert.ok(err.message.includes(NODE_RANGE), `message must state the range: ${err.message}`);
  assert.ok(err.message.includes('nodejs.org'), `message must tell the operator where to go: ${err.message}`);
  return true;
});

const integrityFixture = { lockfileVersion: 3, packages: {
  '': { dependencies: { parent: '1.0.0' } },
  'node_modules/parent': { version: '1.0.0', dependencies: { child: '1.0.0' } },
  'node_modules/child': { version: '1.0.0' },
} };
assert.deepEqual([...lockedDependencyClosure(integrityFixture).keys()], ['node_modules/parent', 'node_modules/child']);
assert.deepEqual(productionLockIntegrityGaps(integrityFixture), ['node_modules/parent', 'node_modules/child']);
for (const item of Object.values(integrityFixture.packages)) {
  if (item.version) Object.assign(item, { resolved: `https://registry.npmjs.org/fixture/-/fixture-${item.version}.tgz`, integrity: 'sha512-synthetic' });
}
assert.deepEqual(productionLockIntegrityGaps(integrityFixture), []);
const nestedFixture = structuredClone(integrityFixture);
nestedFixture.packages['node_modules/parent'].dependencies.child = '2.0.0';
nestedFixture.packages['node_modules/parent/node_modules/child'] = { version: '2.0.0', resolved: 'https://registry.npmjs.org/child/-/child-2.0.0.tgz', integrity: 'sha512-nested' };
assert.ok(lockedDependencyClosure(nestedFixture).has('node_modules/parent/node_modules/child'), 'nested dependency resolution must precede the root version');
const incomplete = structuredClone(nestedFixture);
delete incomplete.packages['node_modules/parent/node_modules/child'];
delete incomplete.packages['node_modules/child'];
assert.throws(() => lockedDependencyClosure(incomplete), /DEPENDENCY_LOCK_INCOMPLETE/);

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'edgeview-install-recovery-'));
const marker = path.join(root, 'node_modules', '.edgeview-install.json');
let installs = 0;
const write = (name, value) => fs.writeFileSync(path.join(root, name), JSON.stringify(value));
const install = () => {
  installs++;
  for (const name of ['fixture', 'child']) {
    fs.mkdirSync(path.join(root, 'node_modules', name), { recursive: true });
    write(`node_modules/${name}/package.json`, { version: '1.0.0' });
  }
  return { status: 0 };
};
try {
  write('package.json', { dependencies: { fixture: '1.0.0' } });
  write('package-lock.json', { lockfileVersion: 3, packages: {
    '': { dependencies: { fixture: '1.0.0' } },
    'node_modules/fixture': { version: '1.0.0', dependencies: { child: '1.0.0' } },
    'node_modules/child': { version: '1.0.0' },
  } });
  fs.mkdirSync(path.join(root, 'node_modules'));
  assert.throws(() => ensureDependencies(root, () => ({ status: 1 })), /failed/);
  assert.equal(fs.existsSync(marker), false, 'failed installation cannot certify an existing node_modules folder');
  ensureDependencies(root, install);
  ensureDependencies(root, install);
  assert.equal(installs, 1, 'completed unchanged installation is reused');
  write('package.json', { dependencies: { fixture: '1.0.0' }, description: 'changed manifest' });
  assert.throws(() => ensureDependencies(root, () => ({ status: 1 })), /failed/);
  assert.equal(fs.existsSync(marker), false, 'stale success is withdrawn before a failed update');
  ensureDependencies(root, install);
  fs.unlinkSync(path.join(root, 'node_modules/fixture/package.json'));
  ensureDependencies(root, install);
  assert.equal(installs, 3, 'missing installed package is repaired even with matching marker');
  write('node_modules/fixture/package.json', { version: '9.9.9' });
  ensureDependencies(root, install);
  assert.equal(installs, 4, 'wrong installed version is repaired');
  fs.writeFileSync(path.join(root, 'node_modules/fixture/package.json'), '{broken');
  ensureDependencies(root, install);
  assert.equal(installs, 5, 'corrupt installed metadata is repaired');
  fs.writeFileSync(marker, '{broken');
  ensureDependencies(root, install);
  assert.equal(installs, 6, 'corrupt completion marker is repaired');
  fs.unlinkSync(path.join(root, 'node_modules/child/package.json'));
  ensureDependencies(root, install);
  assert.equal(installs, 7, 'a missing transitive dependency invalidates an otherwise matching marker');
  write('node_modules/child/package.json', { version: '9.9.9' });
  ensureDependencies(root, install);
  assert.equal(installs, 8, 'a wrong transitive version is repaired');
  console.log('PASS dependency closure, nested resolution, integrity reporting and installation recovery controls');
} finally { fs.rmSync(root, { recursive: true, force: true }); }

const nativeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'edgeview-native-closure-'));
try {
  const nativeName = `@esbuild/${process.platform}-${process.arch}`, version = '1.2.3';
  const nativeLocation = `node_modules/${nativeName}`;
  fs.writeFileSync(path.join(nativeRoot, 'package.json'), JSON.stringify({ dependencies: { esbuild: version } }));
  fs.writeFileSync(path.join(nativeRoot, 'package-lock.json'), JSON.stringify({ lockfileVersion: 3, packages: {
    '': { dependencies: { esbuild: version } },
    'node_modules/esbuild': { version, optionalDependencies: { [nativeName]: version } },
    [nativeLocation]: { version, optional: true, os: [process.platform], cpu: [process.arch] },
  } }));
  for (const location of ['node_modules/esbuild', nativeLocation]) {
    fs.mkdirSync(path.join(nativeRoot, location), { recursive: true });
    fs.writeFileSync(path.join(nativeRoot, location, 'package.json'), JSON.stringify({ version }));
  }
  const executable = path.join(nativeRoot, nativeLocation, process.platform === 'win32' ? 'esbuild.exe' : 'bin/esbuild');
  fs.mkdirSync(path.dirname(executable), { recursive: true }); fs.writeFileSync(executable, 'synthetic executable placeholder');
  assert.equal(installedProductionDependenciesMatch(nativeRoot, {}, file => {
    assert.equal(file, executable); return { status: 0, stdout: `${version}\n` };
  }), true, 'matching native binary is accepted without ESBUILD_BINARY_PATH');
  assert.equal(installedProductionDependenciesMatch(nativeRoot, {}, () => ({ status: 0, stdout: '9.9.9\n' })), false, 'a native binary from another esbuild release invalidates the closure');
  fs.unlinkSync(executable);
  assert.equal(installedProductionDependenciesMatch(nativeRoot), false, 'a missing native binary invalidates the closure');
  console.log('PASS native esbuild package/binary version closure requires no manual binary override');
} finally { fs.rmSync(nativeRoot, { recursive: true, force: true }); }

// End-to-end: an unsupported runtime must be refused before npm is spawned, not after it fails.
// process.versions.node is overridden in a preload so the real CLI path runs on this machine's Node.
const script = fileURLToPath(new URL('./ensure-dependencies.mjs', import.meta.url));
const guardRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'edgeview-node-floor-'));
try {
  const preload = path.join(guardRoot, 'fake-node.cjs');
  for (const unsupported of ['20.18.3', '20.19.9', '22.12.0', '22.21.9', '23.2.0']) {
    fs.writeFileSync(preload, `Object.defineProperty(process.versions, 'node', { value: '${unsupported}', configurable: true });\n`);
    const denied = spawnSync(process.execPath, ['--require', preload, script], { cwd: guardRoot, encoding: 'utf8', timeout: 60_000 });
    const output = `${denied.stdout ?? ''}${denied.stderr ?? ''}`;
    assert.equal(denied.status, 1, `an unsupported Node must exit non-zero, got ${denied.status}: ${output}`);
    assert.ok(output.includes('EdgeView needs ') && output.includes('(found ' + unsupported + ')'), 'the refusal must name the version it found');
    assert.ok(!output.includes('Installing or repairing'), 'the check must run before dependency installation');
    assert.equal(fs.existsSync(path.join(guardRoot, 'node_modules')), false, 'the check must run before anything touches node_modules');
  }
  console.log('PASS unsupported Node is refused before dependency installation, naming the version and the supported range');
} finally { fs.rmSync(guardRoot, { recursive: true, force: true }); }
