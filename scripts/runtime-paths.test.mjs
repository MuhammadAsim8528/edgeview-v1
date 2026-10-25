import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
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
 console.log('PASS runtime root preserves legacy defaults, allows disjoint opt-in, rejects relative/overlap/link/file ancestors and never migrates.');
} finally {fs.rmSync(temp,{recursive:true,force:true});}
