import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { resolveRuntimeDataRoot } from '../shared/runtime_paths.mjs';
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'edgeview-paths-'));
try {
 const app=path.join(temp,'app'),data=path.join(temp,'data');fs.mkdirSync(app);fs.mkdirSync(data);
 assert.equal(resolveRuntimeDataRoot(app,{}),app);
 assert.equal(resolveRuntimeDataRoot(app,{EDGEVIEW_DATA_DIR:data}),data);
 for(const bad of ['relative',app,path.join(app,'data'),temp,' '+data]) assert.throws(()=>resolveRuntimeDataRoot(app,{EDGEVIEW_DATA_DIR:bad}));
 const future=path.join(temp,'new','data');assert.equal(resolveRuntimeDataRoot(app,{EDGEVIEW_DATA_DIR:future}),future);assert.ok(!fs.existsSync(future),'resolution cannot create or migrate data');
 const link=path.join(temp,'linked');fs.symlinkSync(data,link,process.platform==='win32'?'junction':'dir');
 assert.throws(()=>resolveRuntimeDataRoot(app,{EDGEVIEW_DATA_DIR:path.join(link,'child')}),'ancestor links must be refused');
 fs.writeFileSync(path.join(data,'not-directory'),'x');assert.throws(()=>resolveRuntimeDataRoot(app,{EDGEVIEW_DATA_DIR:path.join(data,'not-directory','child')}));
 fs.writeFileSync(path.join(data,'migration.json'),'{"format":1,"status":"INCOMPLETE"}');
 assert.throws(()=>resolveRuntimeDataRoot(app,{EDGEVIEW_DATA_DIR:data}),/MIGRATION_INCOMPLETE/);
 for(const value of ['{', '{}', '{"format":1,"status":"COPIED_NOT_ACTIVATED","manifestSha256":"bad"}', 'x'.repeat(4097)]){
  fs.writeFileSync(path.join(data,'migration.ready.json'),value);
  assert.throws(()=>resolveRuntimeDataRoot(app,{EDGEVIEW_DATA_DIR:data}),/MIGRATION_INCOMPLETE/);
 }
 const manifest=JSON.stringify({format:1,status:'COPIED_NOT_ACTIVATED',files:[]});
 fs.writeFileSync(path.join(data,'migration.complete.json'),manifest);
 fs.writeFileSync(path.join(data,'migration.ready.json'),JSON.stringify({format:1,status:'COPIED_NOT_ACTIVATED',manifestSha256:createHash('sha256').update(manifest).digest('hex')}));
 assert.equal(resolveRuntimeDataRoot(app,{EDGEVIEW_DATA_DIR:data}),data,'bounded preparation marker permits explicit root selection, not installed-update acceptance');
 fs.writeFileSync(path.join(data,'migration.complete.json'),'altered');
 assert.throws(()=>resolveRuntimeDataRoot(app,{EDGEVIEW_DATA_DIR:data}),/MIGRATION_INCOMPLETE/);
 console.log('PASS runtime root preserves legacy defaults, allows disjoint opt-in, rejects relative/overlap/link/file ancestors and never migrates.');
} finally {fs.rmSync(temp,{recursive:true,force:true});}
