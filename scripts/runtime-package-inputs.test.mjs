import assert from 'node:assert/strict';
import { runtimePackageInputs, verifyRuntimeLock, runtimeSourceNotices, verifyRuntimeManifest } from './runtime-package-inputs.mjs';
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
  fs.mkdirSync(path.join(scratch,'server'));
  fs.writeFileSync(path.join(scratch,'server/fatal_reporter.ts'),'export {};');
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

const notices = runtimeSourceNotices(process.cwd(), input);
assert.ok(notices.document.includes('react@'+input.canonicalLock.packages['node_modules/react'].version), 'compiled frontend React notices must survive Node dependency pruning');
assert.ok(notices.capture.components.some(item=>item.name==='react' && item.version===input.canonicalLock.packages['node_modules/react'].version && item.capture==='TEXT CAPTURED'),'actual React license text must be captured, not only an unresolved package name');
assert.ok(notices.document.includes('Scope: canonical source-build dependencies'));
assert.ok(notices.document.includes('Status: NOT VERIFIED'), 'mechanical capture must not imply legal clearance');
assert.ok(!notices.document.includes(process.cwd()), 'source host path must not enter customer notices');
assert.throws(()=>runtimeSourceNotices(process.cwd(),{...input,canonicalLock:{}}), /RUNTIME_SOURCE_LOCK_CHANGED/);
console.log(JSON.stringify({status:'PASS',noticesBytes:Buffer.byteLength(notices.document),sourceLockSha256:notices.sourceLockSha256,captureStatus:notices.capture.status,scope:'Compiled-frontend notice retention; no legal clearance'}));

const noticeRoot=fs.mkdtempSync(path.join(os.tmpdir(),'edgeview-frontend-notice-'));
try {
 const lock={name:'synthetic',version:'1.0.0',lockfileVersion:3,packages:{'':{},'node_modules/frontend-widget':{version:'1.0.0',license:'MIT'}}};
 fs.writeFileSync(path.join(noticeRoot,'package-lock.json'),JSON.stringify(lock));
 fs.mkdirSync(path.join(noticeRoot,'node_modules/frontend-widget'),{recursive:true});
 fs.writeFileSync(path.join(noticeRoot,'node_modules/frontend-widget/package.json'),JSON.stringify({name:'frontend-widget',version:'1.0.0'}));
 fs.writeFileSync(path.join(noticeRoot,'node_modules/frontend-widget/LICENSE'),'UNIQUE_SYNTHETIC_FRONTEND_NOTICE_TEXT');
 const bundle=runtimeSourceNotices(noticeRoot,{canonicalLock:lock,manifest:{name:'synthetic',version:'1.0.0',dependencies:{}}});
 assert.ok(bundle.document.includes('UNIQUE_SYNTHETIC_FRONTEND_NOTICE_TEXT'),'frontend notice body survives even when not an installed runtime root');
} finally {assert.equal(path.dirname(fs.realpathSync(noticeRoot)),fs.realpathSync(os.tmpdir()));fs.rmSync(noticeRoot,{recursive:true,force:true});}
console.log('PASS unique frontend notice text remains independently of runtime dependency roots');

const manifestRoundTrip=JSON.parse(JSON.stringify(input.manifest));
assert.equal(verifyRuntimeManifest(input,manifestRoundTrip),true);
assert.throws(()=>verifyRuntimeManifest(input,{...manifestRoundTrip,scripts:{postinstall:'unreviewed'}}),/RUNTIME_MANIFEST_DRIFT/);
assert.throws(()=>verifyRuntimeManifest(input,{...manifestRoundTrip,overrides:{}}),/RUNTIME_MANIFEST_DRIFT/);
console.log('PASS runtime manifest admits JSON round-trip and refuses added lifecycle/override drift');
