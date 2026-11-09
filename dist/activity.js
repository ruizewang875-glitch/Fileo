import {formatStorage} from './data.js';
import {TRASH_RETENTION_DAYS,trashExpiresAt,trashDaysRemaining} from './file-lifecycle.js';

const SPACES=[
 {id:'archive',label:'Archive',path:'M3 4h14v3H3z M4.5 7v9h11V7 M8 10h4',note:'Stored without deletion. Restore files to view them again.'},
 {id:'trash',label:'Recycle bin',path:'M3 6h14 M7.5 6V3.5h5V6 M5.5 6l.8 10.5h7.4L14.5 6 M8.5 9v5m3-5v5',note:`Files are permanently cleared after ${TRASH_RETENTION_DAYS} days. Restore them before time runs out.`}
];
const restoreIcon='<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 7H2.5V3.5M2.7 7a7 7 0 1 1-.2 6M2.5 7h3"/></svg>';
const spaceIcon=path=>`<svg viewBox="0 0 20 20" aria-hidden="true"><path d="${path}"/></svg>`;
const dateLabel=value=>{const date=new Date(value);return Number.isFinite(date.getTime())?date.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}):'—';};

/** The drawer contains recoverable file spaces, never file previews or an event log. */
export function createActivity({getState,onRestore,escapeHtml:esc}){
 let active='archive',project=null,busy=false,error='',selected=new Set();
 const summary=()=>document.querySelector('#activity-summary');
 const panel=()=>document.querySelector('#activity-list');
 function snapshot(){
  const state=getState(),currentProject=state.session?.project||'';
  if(project!==currentProject){project=currentProject;selected.clear();error='';}
  const now=Date.now(),files=state.files.filter(file=>(!project||file.project===project)&&(file.decision==='archive'||file.decision==='trash')).filter(file=>file.decision!=='trash'||(trashExpiresAt(file)??Infinity)>now);
  const visible=files.filter(file=>file.decision===active).sort((a,b)=>Number(b[active==='trash'?'trashedAt':'archivedAt']||0)-Number(a[active==='trash'?'trashedAt':'archivedAt']||0));
  const ids=new Set(visible.map(file=>file.id));selected=new Set([...selected].filter(id=>ids.has(id)));
  return {files,visible,now};
 }
 function updateSelection(){
  const {visible}=snapshot(),root=panel(),chosen=visible.filter(file=>selected.has(file.id));
  root.querySelectorAll('[data-space-select]').forEach(input=>{input.checked=selected.has(input.dataset.spaceSelect);input.disabled=busy;input.closest('.history-file-row').classList.toggle('is-selected',input.checked);});
  const all=root.querySelector('[data-space-all]');if(all){all.checked=visible.length>0&&chosen.length===visible.length;all.indeterminate=chosen.length>0&&chosen.length<visible.length;all.disabled=busy||!visible.length;}
  const total=root.querySelector('.history-selection-count');if(total)total.textContent=chosen.length?`${chosen.length} selected`:'Select files to restore';
  const restore=root.querySelector('[data-space-restore-selected]');if(restore){restore.disabled=busy||!chosen.length;restore.innerHTML=`${restoreIcon}<span>${busy?'Restoring…':'Restore selected'}</span>`;}
  root.querySelectorAll('[data-space-restore]').forEach(button=>button.disabled=busy);
 }
 async function restore(ids){
  if(busy)return;
  const valid=new Set(snapshot().visible.map(file=>file.id)),chosen=[...new Set(ids)].filter(id=>valid.has(id));
  if(!chosen.length)return;
  busy=true;error='';updateSelection();
  try{await onRestore(chosen);chosen.forEach(id=>selected.delete(id));}
  catch{error='Could not restore these files. Please try again.';}
  finally{busy=false;render();(panel().querySelector('[data-space-all]')||summary().querySelector('[aria-selected=true]'))?.focus();}
 }
 function setSpace(id,{focus=false}={}){
  if(!SPACES.some(space=>space.id===id))return;
  if(id!==active){active=id;selected.clear();error='';}
  render();if(focus)summary().querySelector(`[data-history-space="${id}"]`)?.focus();
 }
 function render(){
  const {files,visible,now}=snapshot(),space=SPACES.find(item=>item.id===active),rail=summary(),root=panel();
  rail.setAttribute('role','tablist');rail.setAttribute('aria-label','Recovery spaces');
  rail.innerHTML=SPACES.map(item=>{
   const count=files.filter(file=>file.decision===item.id).length;
   return `<button type="button" id="history-tab-${item.id}" class="history-space-tab" data-history-space="${item.id}" role="tab" aria-selected="${active===item.id}" aria-controls="activity-list" tabindex="${active===item.id?'0':'-1'}"><span class="history-space-icon">${spaceIcon(item.path)}</span><span class="history-space-label">${item.label}</span><strong>${count}</strong></button>`;
  }).join('');
  rail.querySelectorAll('[data-history-space]').forEach(button=>{
   button.onclick=()=>setSpace(button.dataset.historySpace);
   button.onkeydown=event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const next=event.key==='Home'?'archive':event.key==='End'?'trash':active==='archive'?'trash':'archive';setSpace(next,{focus:true});};
  });
  root.setAttribute('role','tabpanel');root.setAttribute('aria-labelledby',`history-tab-${active}`);root.dataset.space=active;
  root.innerHTML=`<div class="history-space-description"><p>${space.note}</p><span>${visible.length} ${visible.length===1?'file':'files'}<span aria-hidden="true"> · </span>${esc(formatStorage(visible.reduce((sum,file)=>sum+file.size,0)))}</span></div>${error?`<p class="history-restore-error" role="alert">${esc(error)}</p>`:''}
  ${visible.length?`<div class="history-list-heading"><label class="history-select-all"><input type="checkbox" data-space-all aria-label="Select all files in ${esc(space.label)}"><span>Select all</span></label><span>${active==='trash'?'Time to restore':'Saved files'}</span></div><ul class="history-space-files">${visible.map(file=>{
   const stamp=active==='trash'?file.trashedAt:file.archivedAt,days=active==='trash'?trashDaysRemaining(file,now):null;
   const ext=(file.ext||file.file?.split('.').pop()||'FILE').replace(/^\./,'').slice(0,7).toUpperCase();
   return `<li class="history-file-row${selected.has(file.id)?' is-selected':''}"><input type="checkbox" data-space-select="${esc(file.id)}" aria-label="Select ${esc(file.file)}"${selected.has(file.id)?' checked':''}><span class="history-file-type" aria-hidden="true"><svg viewBox="0 0 32 40"><path d="M5 1h14l8 8v29H5z"/><path d="M19 1v9h8"/></svg><span>${esc(ext)}</span></span><div class="history-file-copy"><h3>${esc(file.file)}</h3><p>${esc(file.app||ext)}<span aria-hidden="true"> · </span>${esc(formatStorage(file.size))}</p><span class="history-file-date">${active==='trash'?'Deleted':'Archived'} ${esc(dateLabel(stamp))}</span></div><div class="history-file-tools">${days!==null?`<span class="history-days-left${days<=14?' is-urgent':''}" title="Permanently cleared ${esc(dateLabel(trashExpiresAt(file)))}">${days===1?'1 day left':`${days} days left`}</span>`:''}<button type="button" class="history-restore-file" data-space-restore="${esc(file.id)}" aria-label="Restore ${esc(file.file)}">${restoreIcon}<span>Restore</span></button></div></li>`;
  }).join('')}</ul><div class="history-restore-bar"><span class="history-selection-count" role="status" aria-live="polite"></span><button type="button" class="history-restore-selected" data-space-restore-selected disabled>${restoreIcon}<span>Restore selected</span></button></div>`:`<div class="history-space-empty"><span class="history-empty-icon">${spaceIcon(space.path)}</span><h3>${active==='archive'?'Your archive is empty':'Your recycle bin is empty'}</h3><p>${active==='archive'?'Archived files will be stored here.':'Deleted files will stay here for 180 days.'}</p></div>`}`;
  root.querySelector('[data-space-all]')?.addEventListener('change',event=>{snapshot().visible.forEach(file=>event.target.checked?selected.add(file.id):selected.delete(file.id));updateSelection();});
  root.querySelectorAll('[data-space-select]').forEach(input=>input.onchange=()=>{input.checked?selected.add(input.dataset.spaceSelect):selected.delete(input.dataset.spaceSelect);updateSelection();});
  root.querySelectorAll('[data-space-restore]').forEach(button=>button.onclick=()=>restore([button.dataset.spaceRestore]));
  root.querySelector('[data-space-restore-selected]')?.addEventListener('click',()=>restore([...selected]));
  updateSelection();
 }
 return {render,setSpace};
}
