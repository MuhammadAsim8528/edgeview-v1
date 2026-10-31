import assert from 'node:assert/strict';
import { runtimePackageInputs, verifyRuntimeLock } from './runtime-package-inputs.mjs';
const input = await runtimePackageInputs(process.cwd());
for (const name of ['express','sql.js','pdfkit','exceljs','@sentry/node','posthog-node']) assert.ok(input.manifest.dependencies[name]);
for (const name of ['vite','react','react-dom','lucide-react','@tailwindcss/vite','esbuild']) assert.ok(!input.manifest.dependencies[name]);
assert.deepEqual(input.manifest.overrides, JSON.parse((await import('node:fs')).readFileSync('package.json','utf8')).overrides);
assert.equal(input.manifest.scripts,undefined);assert.equal(input.manifest.devDependencies,undefined);
for (const [name,version] of Object.entries(input.manifest.dependencies)) assert.equal(version,input.canonicalLock.packages[`node_modules/${name}`].version);
const root={dependencies:{express:'1.0.0'}};
const item={version:'1.0.0',resolved:'https://registry.npmjs.org/express/-/express-1.0.0.tgz',integrity:'sha512-synthetic'};
const fixture={manifest:root,canonicalLock:{packages:{'':root,'node_modules/express':item}}};
const good={lockfileVersion:3,packages:{'':root,'node_modules/express':item}};
assert.equal(verifyRuntimeLock(fixture,good).components,1);
assert.throws(()=>verifyRuntimeLock(fixture,{lockfileVersion:3,packages:{'':root}}), /RUNTIME_DIRECT_PACKAGE_MISSING/);
for(const changed of [{...item,version:'2.0.0'},{...item,integrity:'different'},{...item,resolved:'https://unreviewed.test/pkg'},{...item,link:true},{...item,dev:true}]) assert.throws(()=>verifyRuntimeLock(fixture,{...good,packages:{...good.packages,'node_modules/express':changed}}));
assert.throws(()=>verifyRuntimeLock(fixture,{...good,packages:{...good.packages,'':{dependencies:{react:'1'}}}}));
assert.throws(()=>verifyRuntimeLock(fixture,{...good,packages:{...good.packages,'node_modules/../outside':item}}));
console.log(JSON.stringify({status:'PASS',directPackages:Object.keys(input.manifest.dependencies).length,excludedBuildRoots:input.excludedBuildRoots,scope:'Graph derivation and locked-byte guards; actual npm install/runtime and license gates still required'}));

const fs = await import('node:fs'); const os = await import('node:os'); const path = await import('node:path');
const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'edgeview-runtime-graph-'));
try {
  fs.writeFileSync(path.join(scratch,'package.json'),JSON.stringify({name:'synthetic',version:'1.0.0',dependencies:{vite:'1.0.0'}}));
  fs.writeFileSync(path.join(scratch,'package-lock.json'),JSON.stringify({lockfileVersion:3,packages:{'':{},'node_modules/vite':{version:'1.0.0'}}}));
  fs.writeFileSync(path.join(scratch,'server.ts'),"import 'vite';");
  await assert.rejects(runtimePackageInputs(scratch),/RUNTIME_VITE_REQUIRES_REVIEW/);
  fs.writeFileSync(path.join(scratch,'server.ts'),"import 'unreviewed-runtime-module';");
  await assert.rejects(runtimePackageInputs(scratch),/RUNTIME_EXTERNAL_UNDECLARED/);
  fs.writeFileSync(path.join(scratch,'server.ts'),"export const developmentOnly=()=>import('vite');");
  assert.deepEqual(Object.keys((await runtimePackageInputs(scratch)).manifest.dependencies),[]);
} finally {
  assert.equal(path.dirname(fs.realpathSync(scratch)),fs.realpathSync(os.tmpdir()));
  fs.rmSync(scratch,{recursive:true,force:true});
}
console.log('PASS real graph refuses unconditional Vite/new undeclared runtime module; dynamic development import remains explicit exception');
