// Narrow consistency checks for the current operator guidance. This is not a
// runtime/provider/browser acceptance test and cannot certify every prose claim.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {nodeVersionSupported} from './ensure-dependencies.mjs';

const root=process.cwd();
const read=relative=>fs.readFileSync(path.join(root,relative),'utf8');
const docs=['README.md','EDGEVIEW_ARCHITECTURE.md','EDGEVIEW_OPERATIONS.md'];
const paths=new Set(), scripts=new Set();
for(const doc of docs){
 const body=read(doc);
 for(const inline of body.matchAll(/`([^`\n]+)`/g))for(const word of inline[1].trim().split(/\s+/)){
  const relative=word.replace(/[.,;:)]+$/,'');
  if(/[*<>]/.test(relative)||!(/\.(?:ts|tsx|mjs|cjs|bat)$/.test(relative)))continue;
  if(/[/\\]/.test(relative)||['server.ts','EdgeView.bat'].includes(relative))paths.add(relative);
 }
 for(const match of body.matchAll(/npm run ([\w:.-]+)/g))scripts.add(match[1]);
}
assert.ok(paths.size>=20,'source ownership-map scan must still find substantive guidance');
for(const relative of paths)assert.ok(fs.existsSync(path.join(root,relative.replace(/\\/g,'/'))),`guidance names missing source: ${relative}`);
const manifest=JSON.parse(read('package.json'));
for(const name of scripts)assert.ok(Object.hasOwn(manifest.scripts,name),`guidance names missing npm script: ${name}`);

const architecture=read('EDGEVIEW_ARCHITECTURE.md'), operations=read('EDGEVIEW_OPERATIONS.md'), panel=read('src/components/SystemHealthPanel.tsx');
for(const label of ['Unknown','Rate Limited','Authentication Failed','Timed Out','Degraded']){
 assert.ok(panel.includes(`'${label}'`),`health panel must still render ${label}`);
 assert.ok(operations.includes(`**${label}**`),`operator guide must name displayed health label ${label}`);
}
assert.ok(!/`(?:RATE_LIMITED|AUTH_FAILED)`/.test(operations),'enum tokens must not replace operator-facing health labels');
assert.match(architecture,/removed from active source on 2026-10-19/i);
assert.match(architecture,/archive is not part of this package/i);
assert.ok(!/still contains older experimental/i.test(architecture),'removed architecture is historical, not an unfinished active feature');
assert.ok(architecture.includes('edgeview_db.json')&&architecture.includes('SQLite v1_contact_enrichment')&&architecture.includes('SQLite research_jobs'),'guidance must distinguish dataset, overlay and job authorities');
assert.ok(architecture.includes('do not update that installation or an already-running process'),'source changes in another worktree are not deployment');
assert.ok(architecture.includes('Separately configurable Sentry')&&architecture.includes('PostHog'),'monitoring is a distinct disclosed egress path');

// Exercise the default through the settings API on an empty synthetic config,
// without reading real config or passing inherited provider keys to the child.
const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'edgeview-doc-contract-'));
try{
 const config=path.join(temporary,'config.json');fs.writeFileSync(config,'{}');
 const environment=Object.fromEntries(Object.entries(process.env).filter(([key])=>/^(PATH|SystemRoot|WINDIR|COMSPEC|USERPROFILE|TEMP|TMP|APPDATA|LOCALAPPDATA)$/i.test(key)));
 const result=spawnSync(process.execPath,['--import','tsx','--input-type=module','-e',
  "import {getAppSettingsFromPath} from './server/settings.ts'; console.log(getAppSettingsFromPath(process.argv[1]).primary_ai_provider);",config],
 {cwd:root,env:environment,encoding:'utf8',timeout:30000,windowsHide:true});
 assert.equal(result.error,undefined,'isolated settings default probe must terminate');
 assert.equal(result.status,0,`isolated settings default probe failed: ${result.stderr}`);
 const actualDefault=result.stdout.trim();
 assert.equal(actualDefault,'NVIDIA','product default must not change without reviewing the operator claim');
 assert.match(architecture,/shipped default is NVIDIA NIM primary/,'architecture must describe the actual default');
 assert.match(architecture,/configured AI priority controls query generation and evidence extraction/i,'default is configurable, not a universal forced routing order');
 assert.ok(architecture.includes('deterministic company-country queries'),'query fallback is distinct from invented facts');
}finally{
 assert.equal(path.dirname(fs.realpathSync(temporary)),fs.realpathSync(os.tmpdir()));
 fs.rmSync(temporary,{recursive:true,force:true});
}

// The independent support policy and boundary cases must agree with the
// manifest, displayed documentation and actual bootstrap predicate.
assert.equal(manifest.engines.node,'^20.20.0 || ^22.22.0 || >=24.0.0');
for(const doc of ['README.md','EDGEVIEW_OPERATIONS.md'])assert.ok(read(doc).includes('20.20+ on 20.x, 22.22+ on 22.x, or 24+'),`${doc} must state the current supported runtime range`);
for(const version of ['20.20.0','22.22.0','24.0.0','24.19.0'])assert.equal(nodeVersionSupported(version),true,`${version} is documented as supported`);
for(const version of ['20.19.9','22.21.9','23.2.0','24.0.0-rc.1'])assert.equal(nodeVersionSupported(version),false,`${version} must not be accepted by a weaker Vite-only floor`);
console.log(`PASS shipped guidance contract: ${docs.length} docs, ${paths.size} source paths, ${scripts.size} scripts, displayed health labels, actual isolated settings default and Node support boundary; runtime/UI acceptance separate`);
