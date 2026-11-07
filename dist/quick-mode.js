import {recommendationDetails,recommendationTags} from './recommendation-ui.js';
import {BUCKETS, formatStorage, searchFiles} from './data.js';
import {rankFiles} from './mode-model.js';
import {createRibbonRing} from './bubble-ring.js';
import {createOverviewSequence} from './quick-loading.js';

// Quick Clear deliberately exposes a preview, not the detailed decision workspace.
export function createQuickMode({root,getFiles,getState,thumb,badge,fileArt,hydrateArt,prettySize,escapeHtml:esc,onDecide}) {
 let metric='space',bucket='',query='',project=null,selected=new Set(),previewIds=[],previewIndex=0,previewBatch=false;
 const decisionName={pending:'To review',keep:'Kept',archive:'Archived',trash:'In Trash'};
 const $=s=>root.querySelector(s);
 let ringUI=null;
 const number=(value,extra='')=>`<span class="qc-loadable ${extra}"><span class="qc-final-value">${value}</span><span class="qc-number-spinner" aria-hidden="true"></span></span>`;
 function setPhase(phase){
  root.dataset.phase=phase;
  ringUI?.setPhase(phase);
  const loading=phase==='overview'||phase==='scanning',ready=phase==='ready';
  root.setAttribute('aria-busy',String(!ready));
  if($('.qc-overview'))$('.qc-overview').inert=loading;
  if($('.qc-scroll-cue'))$('.qc-scroll-cue').disabled=!ready;
  if($('.qc-results')){$('.qc-results').inert=!ready;$('.qc-results').setAttribute('aria-hidden',String(!ready));}
  if($('.qc-selection-bar')){$('.qc-selection-bar').inert=!ready;$('.qc-selection-bar').setAttribute('aria-hidden',String(!ready));}
  root.querySelectorAll('.qc-final-value,.qc-final-meta').forEach(el=>{if(loading)el.setAttribute('aria-hidden','true');else el.removeAttribute('aria-hidden');});
  if($('.qc-loading-status'))$('.qc-loading-status').textContent=ready?'Overview ready. Files are available.':phase==='resolved'?'Categories ready.':phase==='scanning'?'Preparing file categories.':'Preparing project overview.';
 }
 const sequence=createOverviewSequence({onPhase:setPhase,onScan:({checked,total,file})=>{
  if($('.qc-scan-file')){$('.qc-scan-file').textContent=file.file;$('.qc-scan-file').title=file.file;}
  if($('.qc-scan-count'))$('.qc-scan-count').textContent=`${checked} / ${total}`;
 }});
 const dialog=document.createElement('dialog');
 dialog.className='qc-preview-dialog';dialog.setAttribute('aria-labelledby','qc-preview-name');document.body.append(dialog);
 dialog.addEventListener('click',e=>{if(e.target!==dialog)return;const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();});
 dialog.addEventListener('keydown',e=>{if(/INPUT|TEXTAREA/.test(e.target.tagName))return;if(e.key==='ArrowLeft'&&previewIndex>0){e.preventDefault();previewIndex--;renderPreview();}if(e.key==='ArrowRight'&&previewIndex<previewIds.length-1){e.preventDefault();previewIndex++;renderPreview();}});
 const files=()=>rankFiles(getFiles());
 const selectable=f=>f.decision!=='trash';
 const visible=()=>searchFiles(query,files().filter(f=>!bucket||f.bucket===bucket));
 const choiceFiles=()=>files().filter(f=>selected.has(f.id)&&selectable(f));
 function syncSelection(){
  const nextProject=getState().session.project||getFiles()[0]?.project||'';
  if(project!==nextProject){selected.clear();bucket='';query='';project=nextProject;if(dialog.open)dialog.close();}
  const valid=new Set(files().filter(selectable).map(f=>f.id));selected=new Set([...selected].filter(id=>valid.has(id)));
 }
 function setSelected(id,checked){if(checked)selected.add(id);else selected.delete(id);updateSelection();}
 function takeAction(ids,decision){
  const valid=new Set(getFiles().filter(selectable).map(f=>f.id));const chosen=[...new Set(ids)].filter(id=>valid.has(id));
  if(!chosen.length)return;if(dialog.open)dialog.close();onDecide(chosen,decision);
 }
 function openPreview(ids,batch=false){
  const valid=new Set(getFiles().map(f=>f.id));previewIds=[...new Set(ids)].filter(id=>valid.has(id));previewIndex=0;previewBatch=batch;
  if(!previewIds.length)return;renderPreview();dialog.showModal();
 }
 function renderPreview(){
  const all=files(),f=all.find(item=>item.id===previewIds[previewIndex]);if(!f){dialog.close();return;}
  const current=choiceFiles();
  dialog.dataset.fileId=f.id;
  dialog.innerHTML=`<div class="qc-preview-top"><span>${previewBatch?'Check selection':'Quick preview'}${previewIds.length>1?` <b>${previewIndex+1} / ${previewIds.length}</b>`:''}</span><button type="button" class="qc-icon" data-close aria-label="Close preview">×</button></div>
   <div class="qc-preview-art">${fileArt(f)}</div>
   <div class="qc-preview-caption"><div><h2 id="qc-preview-name">${esc(f.file)}</h2><p>${esc(f.app||f.ext)} <span>·</span> ${esc(prettySize(f))} <span>·</span> ${esc(f.modified||'')}</p></div>${badge(f)}</div>
   <div class="qc-preview-insight">${recommendationDetails(f,{showBadge:false})}</div>
   <div class="qc-preview-controls"><button type="button" class="qc-icon" data-prev aria-label="Previous preview" ${previewIndex===0?'disabled':''}>←</button>
    <label class="qc-preview-select"><input type="checkbox" data-preview-select ${selected.has(f.id)?'checked':''} ${!selectable(f)?'disabled':''}><span>${!selectable(f)?'In Trash':'Select this file'}</span></label>
    <button type="button" class="qc-icon" data-next aria-label="Next preview" ${previewIndex>=previewIds.length-1?'disabled':''}>→</button></div>
   <div class="qc-preview-actions"><span>${previewBatch?`${current.length} selected · ${formatStorage(current.reduce((n,item)=>n+item.size,0))}`:esc(decisionName[f.decision]||'To review')}</span><button type="button" class="qc-button" data-archive ${previewBatch?!current.length?'disabled':'':!selectable(f)?'disabled':''}>${previewBatch?'Archive selected':'Archive'}</button><button type="button" class="qc-button qc-primary" data-trash ${previewBatch?!current.length?'disabled':'':!selectable(f)?'disabled':''}>${previewBatch?'Trash selected':'Move to Trash'}</button></div>`;
  hydrateArt?.(dialog.querySelector('.qc-preview-art'),f);
  dialog.querySelector('[data-close]').onclick=()=>dialog.close();
  dialog.querySelector('[data-prev]').onclick=()=>{if(previewIndex>0){previewIndex--;renderPreview();}};
  dialog.querySelector('[data-next]').onclick=()=>{if(previewIndex<previewIds.length-1){previewIndex++;renderPreview();}};
  dialog.querySelector('[data-preview-select]').onchange=e=>{setSelected(f.id,e.target.checked);renderPreview();};
  dialog.querySelector('[data-archive]').onclick=()=>takeAction(previewBatch?choiceFiles().map(x=>x.id):[f.id],'archive');
  dialog.querySelector('[data-trash]').onclick=()=>takeAction(previewBatch?choiceFiles().map(x=>x.id):[f.id],'trash');
 }
 function updateSelection(){
  const shown=visible().filter(selectable),chosen=choiceFiles();
  root.querySelectorAll('[data-qc-select]').forEach(input=>{input.checked=selected.has(input.dataset.qcSelect);input.closest('.qc-row').classList.toggle('is-selected',input.checked);});
  const all=$('[data-qc-all]');if(all){all.checked=shown.length>0&&shown.every(f=>selected.has(f.id));all.indeterminate=shown.some(f=>selected.has(f.id))&&!all.checked;all.disabled=!shown.length;}
  const bar=$('.qc-selection-bar');if(!bar)return;bar.hidden=!chosen.length;
  $('.qc-selection-total').textContent=`${chosen.length} selected`;
  $('.qc-selection-size').textContent=formatStorage(chosen.reduce((n,f)=>n+f.size,0));
 }
 function renderRows(){
  const shown=visible();
  $('.qc-list-heading h2').textContent=bucket?BUCKETS.find(b=>b.id===bucket).label:'Ready to review';
  $('.qc-list-count').textContent=`${shown.length} ${shown.length===1?'file':'files'}`;
  $('.qc-filter-clear').hidden=!bucket&&!query;
  $('.qc-list-body').innerHTML=shown.length?shown.map(f=>{
   const chosen=selected.has(f.id),completed=f.decision!=='pending',category=BUCKETS.find(b=>b.id===f.bucket)||BUCKETS.find(b=>b.id==='undecided');
   return `<div class="qc-row ${chosen?'is-selected':''} ${f.decision==='trash'?'is-trashed':''}" data-bucket="${category.id}">
    <input type="checkbox" data-qc-select="${esc(f.id)}" aria-label="Select ${esc(f.file)}" ${chosen?'checked':''} ${!selectable(f)?'disabled':''}>
    <button type="button" class="qc-file" data-qc-preview="${esc(f.id)}" aria-label="Preview ${esc(f.file)}" title="${esc(f.file)}">
     <span class="qc-thumbnail-frame"><svg class="qc-frame-outline" viewBox="0 0 76 76" aria-hidden="true"><path d="M74 51V12Q74 2 64 2H12Q2 2 2 12V64Q2 74 12 74H52"/></svg><span class="qc-thumbnail">${thumb(f)}</span><svg class="qc-frame-spark" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1c1.4 6.3 4.7 9.6 11 11-6.3 1.4-9.6 4.7-11 11C10.6 16.7 7.3 13.4 1 12 7.3 10.6 10.6 7.3 12 1Z"/></svg></span>
     <span class="qc-file-copy"><strong>${esc(f.file)}</strong><span class="qc-file-subline"><span class="qc-inline-category" aria-label="AI suggestion: ${category.label}">AI · ${category.label}</span>${completed?`<span class="qc-file-state">${esc(decisionName[f.decision])}</span>`:''}</span></span>
    </button>
    <div class="qc-recommendation">${recommendationTags(f)}</div><span class="qc-size">${esc(prettySize(f))}</span><span class="qc-modified">${esc(f.modified||'')}</span>
   </div>`;
  }).join(''):`<div class="qc-empty"><span>Nothing here yet.</span><button type="button" class="qc-button" data-show-all>Show all files</button></div>`;
  root.querySelectorAll('[data-qc-select]').forEach(input=>input.onchange=e=>setSelected(input.dataset.qcSelect,e.target.checked));
  root.querySelectorAll('[data-qc-preview]').forEach(button=>button.onclick=()=>openPreview([button.dataset.qcPreview]));
  $('[data-show-all]')?.addEventListener('click',clearFilters);updateSelection();
 }
 function overviewData(){
  const all=files(),totalSize=all.reduce((n,f)=>n+f.size,0),totalCount=all.length;
  const groups=BUCKETS.map(b=>{const group=all.filter(f=>f.bucket===b.id),size=group.reduce((n,f)=>n+f.size,0);return {...b,count:group.length,size,share:metric==='space'?(totalSize?size/totalSize:0):(totalCount?group.length/totalCount:0)};});
  const pendingTrash=all.filter(f=>f.bucket==='trash'&&f.decision==='pending');
  return {groups,totalSize,totalCount,pendingTrash,potential:pendingTrash.reduce((n,f)=>n+f.size,0)};
 }
 function updateOverview(){
  const data=overviewData(),active=data.groups.find(b=>b.id===bucket);
  ringUI?.update({...data,selected:bucket,metric,phase:root.dataset.phase||'ready'});
  $('.qc-summary').dataset.bucket=bucket;
  $('.qc-summary-copy').innerHTML=active?`<div class="qc-summary-values" aria-label="${esc(active.label)}"><span class="qc-final-meta qc-summary-percent">${(active.share*100).toFixed(1)}%</span><strong class="qc-summary-storage">${number(esc(formatStorage(active.size)))}</strong><span class="qc-final-meta">${active.count} ${active.count===1?'file':'files'}</span></div>`:`<strong>${number(esc(formatStorage(data.potential)))}</strong><span>potential to clear</span>`;
  const suggested=$('[data-qc-suggested]');suggested.disabled=!data.pendingTrash.length;suggested.hidden=!!bucket&&bucket!=='trash';suggested.innerHTML=`Select suggested Trash <span class="qc-final-meta">(${data.pendingTrash.length})</span><span aria-hidden="true">↘</span>`;
  root.querySelectorAll('[data-qc-metric]').forEach(b=>b.setAttribute('aria-pressed',String(metric===b.dataset.qcMetric)));
 }
 function selectBucket(id){if(bucket===id)return;bucket=id;updateOverview();renderRows();}
 function clearFilters(){bucket='';query='';$('#qc-search-input').value='';updateOverview();renderRows();}
 function render({enter=false}={}){
  const previousProject=project;
  sequence.cancel();ringUI?.destroy();ringUI=null;
  syncSelection();
  const animate=enter||previousProject!==project,all=files();
  root.dataset.phase=animate?'overview':'ready';
  root.innerHTML=`<div class="qc-overview">
   <div class="qc-metric" role="group" aria-label="Measure storage or file count"><button type="button" data-qc-metric="space" aria-pressed="${metric==='space'}">Storage</button><button type="button" data-qc-metric="files" aria-pressed="${metric==='files'}">Files</button></div>
   <div class="qc-orbit"></div>
   <div class="qc-scan-caption" aria-hidden="true"><span class="qc-scan-file">Preparing overview</span><span class="qc-scan-count"></span></div>
   <div class="qc-summary"><div class="qc-summary-copy" role="status" aria-live="polite" aria-atomic="true"></div><button class="qc-scroll-cue" type="button">Scroll to view files <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 3v13M5 11l5 5 5-5"/></svg></button></div>
  </div>
  <span class="sr-only qc-loading-status" role="status" aria-live="polite"></span><div class="qc-results"><div class="qc-results-inner"><div class="qc-list-toolbar"><div class="qc-list-heading"><h2>${bucket?esc(BUCKETS.find(b=>b.id===bucket).label):'Ready to review'}</h2><span class="qc-list-count"></span><button type="button" class="qc-filter-clear">Clear filter ×</button></div><div class="qc-list-tools"><button type="button" class="qc-button qc-soft" data-qc-suggested></button><form class="qc-search" role="search"><label class="sr-only" for="qc-search-input">Search project files</label><input id="qc-search-input" type="search" placeholder="Find a file…" value="${esc(query)}"><button type="submit" aria-label="Search project files">↗</button></form></div></div>
  <div class="qc-table" role="group" aria-label="Files by cleanup priority"><div class="qc-table-head"><input type="checkbox" data-qc-all aria-label="Select all visible files"><span>File</span><span class="qc-reasons-heading">AI reasoning</span><span class="qc-size-heading">Size</span><span class="qc-modified-heading">Modified</span></div><div class="qc-list-body"></div></div>
  </div></div><div class="qc-selection-bar" hidden><div><strong class="qc-selection-total" aria-live="polite"></strong><span class="qc-selection-size"></span></div><button type="button" class="qc-selection-clear" aria-label="Clear selection">×</button><span class="qc-selection-divider" aria-hidden="true"></span><button type="button" class="qc-button" data-qc-check>Preview selection <span aria-hidden="true">↗</span></button><button type="button" class="qc-button" data-qc-archive>Archive</button><button type="button" class="qc-button qc-primary" data-qc-trash>Move to Trash</button></div>`;
  ringUI=createRibbonRing({root:$('.qc-orbit'),onSelect:selectBucket});
  updateOverview();
  root.querySelectorAll('[data-qc-metric]').forEach(b=>b.onclick=()=>{metric=b.dataset.qcMetric;updateOverview();});
  $('.qc-scroll-cue').onclick=()=>{const heading=$('.qc-list-heading h2');heading.setAttribute('tabindex','-1');heading.focus({preventScroll:true});$('.qc-list-toolbar').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});};
  $('[data-qc-suggested]').onclick=()=>{selected=new Set(overviewData().pendingTrash.map(f=>f.id));updateSelection();$('.qc-selection-bar').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'nearest'});};
  $('.qc-search').onsubmit=e=>{e.preventDefault();query=$('#qc-search-input').value.trim();renderRows();};
  $('.qc-filter-clear').onclick=clearFilters;
  $('[data-qc-all]').onchange=e=>{visible().filter(selectable).forEach(f=>e.target.checked?selected.add(f.id):selected.delete(f.id));updateSelection();};
  $('.qc-selection-clear').onclick=()=>{selected.clear();updateSelection();};
  $('[data-qc-check]').onclick=()=>openPreview(choiceFiles().map(f=>f.id),true);
  $('[data-qc-archive]').onclick=()=>takeAction([...selected],'archive');
  $('[data-qc-trash]').onclick=()=>takeAction([...selected],'trash');
  renderRows();
  if(animate)sequence.start(all,{reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches});else setPhase('ready');
 }
 return {render,deactivate(){sequence.cancel();ringUI?.destroy();ringUI=null;setPhase('ready');},clearSelection(){selected.clear();if(dialog.open)dialog.close();updateSelection();},closePreview(){if(dialog.open)dialog.close();}};
}
