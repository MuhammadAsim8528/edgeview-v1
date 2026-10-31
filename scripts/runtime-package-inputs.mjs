import fs from 'node:fs';
import path from 'node:path';
import { builtinModules } from 'node:module';
import { isDeepStrictEqual } from 'node:util';
import { build } from 'esbuild';
import crypto from 'node:crypto';
import { collectLicenseTexts } from './collect-license-texts.mjs';
import { renderThirdPartyNotices } from './generate-third-party-notices.mjs';

const builtins = new Set(builtinModules.map(name => name.replace(/^node:/, '')));
const packageName = specifier => specifier.startsWith('@') ? specifier.split('/').slice(0, 2).join('/') : specifier.split('/')[0];
const lockedName = (location, item) => item.name || location.slice(location.lastIndexOf('node_modules/') + 13);
const identity = (name, item) => JSON.stringify([name, item.version, item.resolved ?? null, item.integrity ?? null]);

// Runtime roots come from the real server build, not a second handwritten list.
// Vite is the sole reviewed exception: the packaged bootstrap must force static mode.
export async function runtimePackageInputs(root) {
  const source = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
  if (lock.lockfileVersion !== 3 || !lock.packages?.['']) throw new Error('RUNTIME_LOCK_FORMAT');
  const graph = await build({ absWorkingDir: root, entryPoints: ['server.ts'], bundle: true, platform: 'node', format: 'cjs', packages: 'external', metafile: true, write: false, logLevel: 'silent' });
  const externals = Object.values(graph.metafile.outputs).flatMap(output => output.imports.filter(item => item.external));
  if (externals.some(item => packageName(item.path) === 'vite' && item.kind !== 'dynamic-import')) throw new Error('RUNTIME_VITE_REQUIRES_REVIEW');
  const imports = [...new Set(externals.map(item => item.path))];
  const names = [...new Set(imports.filter(name => !builtins.has(name.replace(/^node:/, ''))).map(name => {
    if (!/^(@[a-z0-9._-]+\/)?[a-z0-9._-]+(?:\/[^\s]*)?$/i.test(name)) throw new Error('RUNTIME_EXTERNAL_UNREVIEWED');
    return packageName(name);
  }))].sort();
  const dependencies = Object.create(null);
  for (const name of names) {
    if (name === 'vite') continue;
    const locked = lock.packages[`node_modules/${name}`];
    if (!Object.hasOwn(source.dependencies || {}, name) || !locked?.version || locked.link) throw new Error('RUNTIME_EXTERNAL_UNDECLARED');
    dependencies[name] = locked.version;
  }
  return {
    manifest: { name: source.name, version: source.version, private: true, ...(source.type ? { type: source.type } : {}), ...(source.engines ? { engines: source.engines } : {}), ...(source.overrides ? { overrides: source.overrides } : {}), dependencies },
    seedLock: { ...lock, packages: { ...lock.packages, '': { name: source.name, version: source.version, dependencies } } },
    canonicalLock: lock, backendImports: names, excludedBuildRoots: Object.keys(source.dependencies || {}).filter(name => !Object.hasOwn(dependencies, name)).sort(),
  };
}

// npm may relocate transitive packages, but may not introduce different bytes,
// versions, registries or dependencies outside the reviewed canonical lock.
export function verifyRuntimeLock(inputs, generated) {
  if (generated?.lockfileVersion !== 3 || !generated.packages?.['']) throw new Error('RUNTIME_LOCK_FORMAT');
  const actual = generated.packages[''].dependencies || {};
  if (JSON.stringify(Object.entries(actual).sort()) !== JSON.stringify(Object.entries(inputs.manifest.dependencies).sort()) || generated.packages[''].devDependencies) throw new Error('RUNTIME_ROOT_MISMATCH');
  for (const [name, version] of Object.entries(actual)) {
    if (generated.packages[`node_modules/${name}`]?.version !== version) throw new Error('RUNTIME_DIRECT_PACKAGE_MISSING');
  }
  const allowed = new Set(Object.entries(inputs.canonicalLock.packages).filter(([location]) => location).map(([location, item]) => identity(lockedName(location, item), item)));
  let count = 0;
  for (const [location, item] of Object.entries(generated.packages)) {
    if (!location) continue;
    if (!/^node_modules(?:\/[^\\:\x00-\x1f]+)+$/.test(location) || location.split('/').some(part => !part || part === '..' || part === '.') || item.link || item.dev) throw new Error('RUNTIME_LOCK_ENTRY_REJECTED');
    if (!allowed.has(identity(lockedName(location, item), item))) throw new Error('RUNTIME_LOCK_DRIFT');
    count++;
  }
  return { components: count, directPackages: Object.keys(actual).length, canonicalVersionsOnly: true };
}

// Runtime npm pruning must not erase notices for code already bundled into the UI.
// Capture from the canonical build tree and explicitly label the broader scope.
export function runtimeSourceNotices(root, inputs) {
  const bytes = fs.readFileSync(path.join(root, 'package-lock.json'));
  if (JSON.stringify(JSON.parse(bytes)) !== JSON.stringify(inputs.canonicalLock)) throw new Error('RUNTIME_SOURCE_LOCK_CHANGED');
  const sourceLockSha256 = crypto.createHash('sha256').update(bytes).digest('hex');
  const collection = collectLicenseTexts(inputs.canonicalLock, root, { includeText: true });
  const document = 'Scope: canonical source-build dependencies, including bundled frontend code and some build-only tools.\nThe separate runtime package lock describes installed Node dependencies.\n\n'
    + renderThirdPartyNotices(collection, { lockSha256: sourceLockSha256, application: `${inputs.manifest.name}@${inputs.manifest.version}` });
  return { document, sourceLockSha256, noticesSha256: crypto.createHash('sha256').update(document).digest('hex'),
    capture: { status: collection.status, counts: collection.counts, scope: 'Canonical source build; mechanical capture, not legal clearance',
      components: collection.components.map(item => ({ name: item.name, version: item.version, capture: item.capture, files: item.files.map(file => ({ name: file.name, sha256: file.sha256 })) })) } };
}

export function verifyRuntimeManifest(inputs, actual) {
  if (!isDeepStrictEqual(actual, JSON.parse(JSON.stringify(inputs.manifest)))) throw new Error('RUNTIME_MANIFEST_DRIFT');
  return true;
}
