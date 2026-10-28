import { TYPES, BUCKETS, searchFiles } from './data.js';

/** Project-scoped, deliberate browsing. Recommendations never overwrite a decision. */
export function createExploreMode({root,getFiles,getState,thumb,badge,fileArt,hydrateArt,prettySize,escapeHtml,onDecide,onReview,onOpenFile,onBack,onSave}) {
  const esc=escapeHtml;
  const selected=new Set();
  let filters={type:'',bucket:'',q:'',view:''},scope=null,detailId=null,compareOpen=false;
  const stateLabels={pending:'To review',keep:'Kept',archive:'Archived',trash:'In Trash'};
  const viewLabels={...stateLabels,saved:'Pinned files',recent:'Recently opened',continue:'To review',duplicates:'Suggested duplicates'};
  const icons={
    keep:'m5 12 4 4L19 6', archive:'M4 7h16v14H4z M3 3h18v4H3z M9 11h6',
    trash:'M4 6h16 M9 6V3h6v3 M6 6l1 15h10l1-15 M10 10v7m4-7v7',
    undecided:'M9 8a3 3 0 1 1 5 2c-2 1-2 2-2 4 M12 18h.01',
    compare:'M3 4h7v16H3z M14 4h7v16h-7z',open:'M14 3h7v7 M21 3 10 14 M10 4H4v16h16v-6',
    pin:'m8 3 8 0-1 6 4 4H5l4-4-1-6 M12 13v8',search:'M17 17l4 4 M19 10.5a8.5 8.5 0 1 1-17 0 8.5 8.5 0 0 1 17 0'
  };
  const icon=name=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${icons[name]}"/></svg>`;
  const currentFiles=()=>getFiles();
  const lookup=id=>currentFiles().find(f=>f.id===id);
  const decision=f=>`<span class="explore-decision" data-state="${esc(f.decision)}">${stateLabels[f.decision]||'To review'}</span>`;
  const relevantFiles=()=>{
    const state=getState(),view=filters.view;
    const matchesView=f=>!view||(['pending','keep','archive','trash'].includes(view)?f.decision===view:view==='continue'?f.decision==='pending':view==='saved'?state.saved?.includes(f.id):view==='recent'?state.recent?.includes(f.id):view==='duplicates'?f.bucket==='trash':true);
    const found=searchFiles(filters.q,currentFiles().filter(f=>(!filters.type||f.type===filters.type)&&(!filters.bucket||f.bucket===filters.bucket)&&matchesView(f)));
    return found.sort((a,b)=>view==='recent'?(state.recent||[]).indexOf(a.id)-(state.recent||[]).indexOf(b.id):(a.decision==='trash')-(b.decision==='trash')||b.modified.localeCompare(a.modified)||a.file.localeCompare(b.file));
  };
  const q=selector=>root.querySelector(selector);
  const cardArt=f=>fileArt(f).replace(/<button\b[^>]*data-repair=[\s\S]*?<\/button>/gi,'');

  root.classList.add('explore-workspace');
  root.innerHTML=`<div class="explore-top"><button class="explore-back" type="button">← Explore</button><form class="explore-search" role="search">${icon('search')}<input type="search" placeholder="Find a file…" aria-label="Search project files"><button type="submit" aria-label="Search project files">↗</button></form></div>
  <div class="explore-heading"><div><h1></h1><span class="explore-count"></span><button class="explore-view-chip" type="button" hidden></button></div><button class="explore-review-all" type="button">Review at your pace <span>→</span></button></div>
  <div class="explore-filters" role="group" aria-label="Filter by AI suggestion"></div>
  <div class="explore-grid"></div><div class="explore-empty" hidden><span>⌕</span><p>No matching files</p><button class="secondary-button" type="button">Clear filters</button></div>
  <div class="explore-selection" hidden><div class="explore-selection-files"></div><span class="explore-selection-count"></span><button class="explore-clear" type="button">Clear</button><button class="explore-review-selection" type="button">Review selection →</button><button class="explore-compare" type="button">${icon('compare')}<span>Compare</span></button></div>
  <p class="explore-status sr-only" role="status" aria-live="polite"></p>
  <dialog class="explore-detail-dialog" aria-labelledby="explore-detail-title"><div class="explore-dialog-top"><span class="explore-detail-position"></span><div class="explore-dialog-navigation"><button type="button" data-detail-prev aria-label="Previous file">←</button><button type="button" data-detail-next aria-label="Next file">→</button><button type="button" data-detail-close aria-label="Close file details">×</button></div></div><div class="explore-detail-body"></div></dialog>
  <dialog class="explore-compare-dialog" aria-labelledby="explore-compare-title"><div class="explore-compare-heading"><div><h2 id="explore-compare-title">Side by side</h2><span class="explore-compare-summary"></span></div><button class="explore-modal-close" type="button" data-compare-close aria-label="Close comparison">×</button></div><div class="explore-compare-columns"></div></dialog>`;

  const detailDialog=q('.explore-detail-dialog'),compareDialog=q('.explore-compare-dialog');
  q('.explore-back').onclick=()=>onBack?.();
  q('.explore-view-chip').onclick=()=>{filters.view='';render();};
  q('.explore-search').onsubmit=e=>{e.preventDefault();filters.q=q('.explore-search input').value.trim();render();};
  q('.explore-search input').onsearch=()=>{if(!q('.explore-search input').value){filters.q='';render();}};
  q('.explore-empty button').onclick=()=>{filters={...filters,bucket:'',q:'',view:''};render();};
  q('.explore-review-all').onclick=()=>{const files=relevantFiles().filter(f=>f.decision!=='trash');if(files.length)onReview?.(files.map(f=>f.id),files[0].id,{...filters});};
  q('.explore-clear').onclick=()=>{selected.clear();render();};
  q('.explore-review-selection').onclick=()=>{const files=currentFiles().filter(f=>selected.has(f.id));if(files.length)onReview?.(files.map(f=>f.id),files[0].id,{...filters});};
  q('.explore-compare').onclick=()=>{if(selected.size<2)return;compareOpen=true;renderComparison();compareDialog.showModal();};
  q('[data-detail-close]').onclick=()=>detailDialog.close();
  q('[data-compare-close]').onclick=()=>compareDialog.close();
  detailDialog.addEventListener('close',()=>{detailId=null;});
  compareDialog.addEventListener('close',()=>{compareOpen=false;});
  for(const dialog of [detailDialog,compareDialog])dialog.addEventListener('click',e=>{if(e.target!==dialog)return;const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();});
  q('[data-detail-prev]').onclick=()=>moveDetail(-1);
  q('[data-detail-next]').onclick=()=>moveDetail(1);
  detailDialog.addEventListener('keydown',e=>{if(/INPUT|TEXTAREA|SELECT/.test(e.target.tagName))return;if(e.key==='ArrowLeft'){e.preventDefault();moveDetail(-1);}if(e.key==='ArrowRight'){e.preventDefault();moveDetail(1);}});

  function select(id,checked) {
    if(checked&&selected.size>=3&&!selected.has(id)){q('.explore-status').textContent='Compare up to three files at a time.';return false;}
    if(checked)selected.add(id);else selected.delete(id);
    renderSelection();
    root.querySelectorAll('[data-select]').forEach(input=>{input.checked=selected.has(input.dataset.select);input.closest('.explore-file-card')?.classList.toggle('is-selected',input.checked);});
    return true;
  }
  function renderSelection(){
    const files=currentFiles().filter(f=>selected.has(f.id));
    q('.explore-selection').hidden=!files.length;
    q('.explore-selection-count').textContent=`${files.length} selected`;
    q('.explore-selection-files').innerHTML=files.map(f=>`<span class="explore-mini" title="${esc(f.file)}">${thumb(f)}</span>`).join('');
    q('.explore-compare').disabled=files.length<2;
    q('.explore-compare span').textContent=files.length<2?'Compare':'Compare '+files.length;
  }
  function actions(f,clarify=true){return `<div class="explore-file-actions">${(clarify?['keep','archive','trash','undecided']:['keep','archive','trash']).map(name=>`<button type="button" data-decision="${name}" data-id="${esc(f.id)}" aria-label="${name==='undecided'?'Clarify':name[0].toUpperCase()+name.slice(1)} ${esc(f.file)}" class="${f.decision===name?'is-current':''}">${icon(name)}<span>${name==='undecided'?'Clarify':name[0].toUpperCase()+name.slice(1)}</span></button>`).join('')}</div>`;}
  function bindActions(container){
    container.querySelectorAll('[data-decision]').forEach(button=>button.onclick=()=>{onDecide?.([button.dataset.id],button.dataset.decision);render();});
    container.querySelectorAll('[data-original]').forEach(button=>button.onclick=()=>onOpenFile?.(button.dataset.original));
    container.querySelectorAll('[data-save]').forEach(button=>button.onclick=()=>{onSave?.(button.dataset.save);render();});
  }
  function showDetail(id){
    detailId=id;renderDetail();
    if(!detailDialog.open)detailDialog.showModal();
  }
  function moveDetail(direction){
    const files=relevantFiles(),index=files.findIndex(f=>f.id===detailId),next=files[index+direction];
    if(next){detailId=next.id;renderDetail();}
  }
  function renderDetail(){
    const f=lookup(detailId);if(!f){if(detailDialog.open)detailDialog.close();return;}
    const files=relevantFiles(),index=files.findIndex(v=>v.id===f.id),saved=getState().saved?.includes(f.id);
    q('.explore-detail-position').textContent=index>=0?`${index+1} / ${files.length}`:'';
    q('[data-detail-prev]').disabled=index<=0;q('[data-detail-next]').disabled=index<0||index>=files.length-1;
    q('.explore-detail-body').innerHTML=`<div class="explore-detail-art explore-art">${fileArt(f)}</div><div class="explore-detail-copy"><div class="explore-file-state">${decision(f)}${onSave?`<button class="explore-save" data-save="${esc(f.id)}" aria-pressed="${!!saved}" aria-label="${saved?'Unpin':'Pin'} ${esc(f.file)}">${icon('pin')}<span>${saved?'Pinned':'Pin'}</span></button>`:''}</div><h2 id="explore-detail-title">${esc(f.file)}</h2><p class="explore-file-location">${esc(f.project)}${f.collection?' / '+esc(f.collection):''}</p><div class="explore-metadata"><span>${esc(f.app)}</span><span>${prettySize(f)}</span><span>${esc(f.modified)}</span></div><div class="explore-insight">${badge(f)}<p>${esc(f.reason||'Your context matters. Choose what to keep.')}</p></div>${actions(f)}<div class="explore-detail-links"><button class="explore-original" type="button" data-original="${esc(f.id)}">${icon('open')} Open file</button><button class="explore-add-compare" type="button" aria-pressed="${selected.has(f.id)}">${icon('compare')} ${selected.has(f.id)?'Selected for comparison':'Add to comparison'}</button></div><div class="explore-detail-compare-link" ${selected.size<2?'hidden':''}><button type="button">Compare ${selected.size} files →</button></div></div>`;
    hydrateArt?.(q('.explore-detail-art'),f);bindActions(q('.explore-detail-body'));
    q('.explore-add-compare').onclick=()=>{if(select(f.id,!selected.has(f.id)))renderDetail();};
    q('.explore-detail-compare-link button').onclick=()=>{detailDialog.close();compareOpen=true;renderComparison();compareDialog.showModal();};
  }
  function renderComparison(){
    const files=currentFiles().filter(f=>selected.has(f.id));
    if(files.length<2){if(compareDialog.open)compareDialog.close();return;}
    const latest=[...files].sort((a,b)=>b.modified.localeCompare(a.modified))[0];
    const sizes=files.map(f=>f.size),sizeDifference=Math.max(...sizes)-Math.min(...sizes);
    const allSameDate=files.every(f=>f.modified===latest.modified);
    q('.explore-compare-summary').textContent=`${files.length} files · ${allSameDate?'Same modified date':'Most recent: '+latest.modified}${sizeDifference>0?' · '+prettySize({size:sizeDifference})+' size difference':''}`;
    const columns=q('.explore-compare-columns');columns.style.setProperty('--compare-columns',files.length);
    columns.innerHTML=files.map(f=>`<article class="explore-compare-file"><div class="explore-compare-art explore-art" data-art="${esc(f.id)}">${fileArt(f)}</div><div class="explore-compare-file-heading"><h3>${esc(f.file)}</h3>${decision(f)}</div><dl class="explore-compare-meta"><div><dt>Size</dt><dd>${prettySize(f)}</dd></div><div><dt>Modified</dt><dd>${esc(f.modified)}${!allSameDate&&f.id===latest.id?'<span class="explore-newest">Latest</span>':''}</dd></div><div><dt>Format</dt><dd>${esc(f.app)} · ${esc(f.ext)}</dd></div></dl><div class="explore-insight">${badge(f)}<p>${esc(f.reason||'Choose what fits this project.')}</p></div>${actions(f,false)}<button class="explore-original" type="button" data-original="${esc(f.id)}">${icon('open')} Open file</button></article>`).join('');
    columns.querySelectorAll('[data-art]').forEach(el=>hydrateArt?.(el,lookup(el.dataset.art)));bindActions(columns);
  }
  function render(options){
    const files=currentFiles(),nextScope=getState().session?.project||files[0]?.project||'';
    if(scope!==null&&scope!==nextScope){clearSelection();filters={type:'',bucket:'',q:'',view:''};}scope=nextScope;
    if(options)for(const name of ['type','bucket','q','view'])if(Object.hasOwn(options,name))filters[name]=options[name]||'';
    for(const id of selected)if(!files.some(f=>f.id===id))selected.delete(id);
    const found=relevantFiles(),type=TYPES.find(t=>t.id===filters.type);
    q('.explore-heading h1').textContent=filters.type?(type?.app||'.'+filters.type)+' files':'Your project, up close';
    q('.explore-count').textContent=found.length+' '+(found.length===1?'file':'files');
    q('.explore-view-chip').hidden=!filters.view;
    q('.explore-view-chip').textContent=(viewLabels[filters.view]||filters.view)+' ×';
    q('.explore-view-chip').setAttribute('aria-label','Clear '+(viewLabels[filters.view]||filters.view)+' filter');
    q('.explore-search input').value=filters.q;
    q('.explore-review-all').disabled=!found.some(f=>f.decision!=='trash');
    q('.explore-filters').innerHTML='<span>AI suggestion</span>'+[{id:'',label:'All'},...BUCKETS].map(b=>`<button type="button" data-filter="${b.id}" aria-pressed="${filters.bucket===b.id}">${b.id?`<i data-bucket="${b.id}"></i>`:''}${esc(b.label)}</button>`).join('');
    q('.explore-filters').querySelectorAll('button').forEach(button=>button.onclick=()=>{filters.bucket=button.dataset.filter;render();});
    q('.explore-grid').innerHTML=found.map(f=>`<article class="explore-file-card ${selected.has(f.id)?'is-selected':''}" data-file="${esc(f.id)}"><div class="explore-card-image"><button type="button" class="explore-open-detail" data-open="${esc(f.id)}" aria-label="View details of ${esc(f.file)}"><span class="explore-card-art explore-art">${cardArt(f)}</span><span class="explore-card-enter" aria-hidden="true">↗</span></button><label class="explore-select"><input type="checkbox" data-select="${esc(f.id)}" ${selected.has(f.id)?'checked':''} aria-label="Select ${esc(f.file)} for comparison"><span aria-hidden="true">✓</span></label>${getState().saved?.includes(f.id)?'<span class="explore-pinned" title="Pinned">'+icon('pin')+'</span>':''}</div><div class="explore-card-copy"><button type="button" data-open="${esc(f.id)}" class="explore-card-name">${esc(f.file)}</button><div class="explore-card-meta"><span>${prettySize(f)}</span><span>${esc(f.modified)}</span></div><div class="explore-card-labels">${badge(f)}${decision(f)}</div></div></article>`).join('');
    q('.explore-empty').hidden=!!found.length;
    q('.explore-grid').querySelectorAll('[data-open]').forEach(button=>button.onclick=()=>showDetail(button.dataset.open));
    q('.explore-grid').querySelectorAll('[data-select]').forEach(input=>input.onchange=()=>{if(!select(input.dataset.select,input.checked))input.checked=false;});
    q('.explore-grid').querySelectorAll('.explore-file-card').forEach(card=>hydrateArt?.(card.querySelector('.explore-card-art'),lookup(card.dataset.file)));
    renderSelection();if(detailId&&detailDialog.open)renderDetail();if(compareOpen&&compareDialog.open)renderComparison();
  }
  function clearSelection(){selected.clear();detailId=null;compareOpen=false;if(detailDialog.open)detailDialog.close();if(compareDialog.open)compareDialog.close();renderSelection();}
  return {render,clearSelection};
}
