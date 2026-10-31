import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const names=['P0 BLOCKERS','P1 HIGH-RISK','P2 MEDIUM-RISK','CUSTOMER EXPERIENCE','OBSERVABILITY / SUPPORT','PACKAGING / UPDATE','CLEAN-WINDOWS ACCEPTANCE','FINAL RELEASE GATES','NEW HIGH/MEDIUM FINDINGS'];
const labels={' ':'Not started','~':'In progress',x:'Verified','!':'Blocked'};
const symbols={' ':'☐','~':'◐',x:'✓','!':'!'};
const escape=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[char]);
export function safeStatusText(value){
 return String(value).replace(/https?:\/\/\S+/gi,'[link omitted]')
  .replace(/(?:\b[A-Za-z]:[\\/]|\\\\|\/(?:Users|home)\/).*$/gm,'[local path omitted]')
  .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,'[email omitted]')
  .replace(/\b(?:nvapi|gsk|sk|phc|phx)[_-][A-Za-z0-9_-]{8,}/g,'[credential omitted]')
  .replace(/\b(?:api[_-]?key|authorization|secret|token|password)\s*[:=]\s*\S+/gi,'[private value omitted]')
  .replace(/\s+/g,' ').trim().slice(0,600);
}
function tasksFrom(text){
 return text.split(/\r?\n/).flatMap(line=>{const match=line.match(/^(\s*)- \[([ x~!])\] (.+)$/);return match?[{state:match[2],text:safeStatusText(match[3]),nested:match[1].length>0}]:[];});
}
export function progressModel(ledger,metadata){
 const board=ledger.match(/## Live customer-readiness board[^\n]*\n([\s\S]*?)(?=\n## )/)?.[1]||'';
 const sections=[];let active;
 for(const line of board.split(/\r?\n/)){
  if(line.startsWith('### ')){const title=line.slice(4).trim();active=names.includes(title)?{title,items:[]}:undefined;if(active)sections.push(active);}
  else if(active)active.items.push(...tasksFrom(line));
 }
 if(sections.length!==names.length||new Set(sections.map(section=>section.title)).size!==names.length)throw Error('Expected all nine ledger queue sections');
 const items=sections.flatMap(section=>section.items);
 if(items.length>250)throw Error('Board exceeds its supported display bound; no partial dashboard generated');
 const evidence=new Map();
 for(const line of ledger.split(/\r?\n/).filter(line=>/^\| [A-Z]+\d+ P\d/.test(line))){const cells=line.split('|').slice(1,-1).map(cell=>cell.trim());evidence.set(cells[0].split(' ')[0],safeStatusText(cells[2]||''));}
 for(const item of items){const id=item.text.match(/\b[A-Z]+\d+\b/)?.[0];item.evidence=id?evidence.get(id)||'':'';item.commits=[...new Set((item.text+' '+item.evidence).match(/\b[a-f0-9]{7,40}\b/g)||[])].slice(0,4);}
 const counts=Object.fromEntries(Object.keys(labels).map(state=>[state,items.filter(item=>item.state===state).length]));
 const acceptance=tasksFrom(ledger.match(/## Full owner acceptance checklist\r?\n([\s\S]*?)(?=\n## )/)?.[1]||'');
 const verdict=ledger.match(/^Current readiness verdict: (.+)$/m)?.[1]?.trim()||'NOT VERIFIED';
 return{...metadata,verdict:safeStatusText(verdict),current:safeStatusText(ledger.match(/^Current active task: (.+)$/m)?.[1]||'No current task recorded'),sections,counts,acceptance,
  findings:sections.find(section=>section.title==='NEW HIGH/MEDIUM FINDINGS').items.filter(item=>item.state!=='x').length};
}
export function progressHtml(model){
 const task=(item,priority='')=>`<article class="task ${item.nested?'nested':''}" data-status="${item.state}"><div><span class="badge s${item.state===' '?'n':item.state==='!'?'b':item.state==='~'?'p':'v'}">${symbols[item.state]} ${labels[item.state]}</span>${priority?` <small>${escape(priority)}</small>`:''}</div><p>${escape(item.text)}</p>${item.evidence?`<details><summary>Evidence / checks</summary><p>${escape(item.evidence)}</p></details>`:''}${item.commits?.length?`<small>Referenced commits: ${item.commits.map(escape).join(' · ')}</small>`:''}</article>`;
 const css=`*{box-sizing:border-box}body{margin:0;background:#10151d;color:#e6edf5;font:14px/1.5 system-ui,sans-serif}main{max-width:1400px;margin:auto;padding:24px}header,.panel{border:1px solid #303c4c;background:#171f2b;border-radius:10px;padding:18px;margin-bottom:16px}h1{font-size:25px;margin:0 0 8px}h2{font-size:15px;letter-spacing:.04em;margin:0 0 12px}p{margin:7px 0}small,.muted{color:#aebccd}code{overflow-wrap:anywhere;color:#b7d7ff}.counts,.grid{display:grid;gap:12px}.counts{grid-template-columns:repeat(auto-fit,minmax(135px,1fr));margin:16px 0}.count{background:#202c3b;padding:10px;border-radius:7px}.count strong{font-size:23px;display:block}.grid{grid-template-columns:repeat(auto-fit,minmax(350px,1fr))}.task{border-top:1px solid #303c4c;padding:12px 0}.task p{overflow-wrap:anywhere}.nested{padding-left:15px;border-left:2px solid #40546a}.badge{display:inline-block;border-radius:4px;padding:2px 7px;font-size:12px;font-weight:700}.sn{background:#394252}.sp{background:#604a17;color:#ffe6a6}.sv{background:#174a35;color:#aff4c7}.sb{background:#623035;color:#ffd2d7}.verdict{color:#ffd297;font-weight:bold}button{background:#263f5c;border:1px solid #4c7199;color:white;padding:7px 11px;border-radius:5px;cursor:pointer}button:focus-visible,summary:focus-visible{outline:2px solid #8cc8ff;outline-offset:3px}summary{cursor:pointer;color:#a9cfff}.legend{font-size:12px;color:#b7c5d8}@media(max-width:600px){main{padding:12px}.grid{grid-template-columns:1fr}}`;
 const script=`(()=>{const button=document.getElementById('auto'),status=document.getElementById('auto-state');let paused=false;try{paused=sessionStorage.getItem('edgeview-progress-paused')==='true';window.scrollTo(0,Number(sessionStorage.getItem('edgeview-progress-scroll'))||0)}catch{}function render(){button.textContent=paused?'Resume automatic refresh':'Pause automatic refresh';button.setAttribute('aria-pressed',String(paused));status.textContent=paused?'Automatic refresh paused':'Reloads saved checkpoints every30seconds; pauses while selecting text or using controls'}button.addEventListener('click',()=>{paused=!paused;try{sessionStorage.setItem('edgeview-progress-paused',String(paused))}catch{}render()});document.getElementById('refresh').addEventListener('click',()=>location.reload());render();setInterval(()=>{if(paused||document.hidden||String(getSelection()||'')||document.activeElement?.tagName==='BUTTON')return;try{sessionStorage.setItem('edgeview-progress-scroll',String(scrollY))}catch{}location.reload()},30000)})();`;
 const digest=text=>crypto.createHash('sha256').update(text).digest('base64');
 const summary=[['Verified',model.counts.x],['In progress',model.counts['~']],['Not started',model.counts[' ']],['Blocked',model.counts['!']],['New findings queue',model.findings]];
 return`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'sha256-${digest(css)}'; script-src 'sha256-${digest(script)}'; connect-src 'none'; base-uri 'none'; form-action 'none'"><title>EdgeView local progress</title><style>${css}</style></head><body><main>
 <header><h1>EdgeView customer-readiness</h1><p class="verdict">${escape(model.verdict)} — owner review required before shipping</p><p>App ${escape(model.version)} · Branch <code>${escape(model.branch)}</code><br>Saved HEAD <code>${escape(model.commit)}</code>${model.dirty?' · Uncommitted work is present':''}</p><p class="muted">Refreshed ${escape(model.refreshed)} PKT · Read-only view of docs/OUTSTANDING_WORK.md</p><p>${escape(model.current)}</p><button id="refresh" type="button">Refresh now</button> <button id="auto" type="button" aria-pressed="false">Pause automatic refresh</button><p id="auto-state" role="status"></p><p class="legend">Board-entry counts are not a percentage of customer acceptance. Parent tasks stay open until required sub-items pass. Work stops when the session stops. No logs, datasets, credentials or runtime behavior are read or changed.</p></header>
 <div class="counts">${summary.map(([title,count])=>`<div class="count"><strong>${count}</strong>${escape(title)}</div>`).join('')}</div>
 <div class="grid">${model.sections.map(section=>`<section class="panel"><h2>${escape(section.title)}</h2>${section.items.map(item=>task(item,section.title.match(/^P\d/)?.[0]||'Acceptance / scope above')).join('')}</section>`).join('')}</div>
 <section class="panel"><details><summary>Full original acceptance checklist (${model.acceptance.length} items)</summary>${model.acceptance.map(item=>task(item)).join('')}</details></section>
 </main><script>${script}</script></body></html>`;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const destination=process.argv[2];if(!destination||!path.isAbsolute(destination)||!destination.endsWith('.html'))throw Error('Provide an absolute HTML output path');
 const source=path.join(root,'docs/OUTSTANDING_WORK.md');if(fs.statSync(source).size>1024*1024)throw Error('Ledger exceeds supported projection budget');
 const environment=Object.fromEntries(Object.entries(process.env).filter(([key])=>/^(PATH|SystemRoot|WINDIR|COMSPEC|USERPROFILE|TEMP|TMP|APPDATA|LOCALAPPDATA)$/i.test(key)));
 const git=args=>execFileSync('git',args,{cwd:root,env:environment,encoding:'utf8'}).trim();
 const model=progressModel(fs.readFileSync(source,'utf8'),{version:JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')).version,branch:safeStatusText(git(['branch','--show-current'])),commit:git(['rev-parse','HEAD']),dirty:Boolean(git(['status','--porcelain'])),refreshed:new Date().toLocaleString('en-GB',{timeZone:'Asia/Karachi'})});
 fs.mkdirSync(path.dirname(destination),{recursive:true});fs.writeFileSync(destination,progressHtml(model),'utf8');
 console.log(`Progress workspace refreshed: ${model.sections.length} queues, ${model.acceptance.length} acceptance items; no second status authority`);
}
