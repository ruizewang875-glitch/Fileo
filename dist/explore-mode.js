import {recommendationTags} from './recommendation-ui.js';
import {feedbackControl} from './suggestion-feedback.js';
import {TYPES, BUCKETS, searchFiles} from './data.js';
import {isActiveFile} from './file-lifecycle.js';
import {previewTrashTargets,previewAfterTrash} from './quick-preview-model.js';
import {similarFiles,comparisonFinding,timelineGroups,groupSimilarFiles} from './explore-model.js';

/** Deliberate, project-scoped browsing. Suggestions and file actions stay separate. */
export function createExploreMode({root,getFiles,getState,thumb,fileArt,hydrateArt,prettySize,escapeHtml:esc,onDecide,onOpenFile,onBack,onTypeChange}) {
  const selected=new Set();
  let filters={type:'',bucket:'',q:'',view:''},scope=null,detailId=null,detailIds=[];
  let timelineOpen=false,timelineAnchor=null,timelineFrame=0,compareIds=[],comparePage=0,compareOpen=false;
  const viewLabels={pending:'To review',keep:'Kept',saved:'Pinned files',recent:'Recently opened',continue:'To review',duplicates:'Suggested duplicates'};
  const paths={compare:'M4 3h6a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z M14 9h6a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-6a1 1 0 0 1-1-1V10a1 1 0 0 1 1-1Z M14 13l3-3 M14 18l6-6 M17 20l3-3',timeline:'M6 3v18 M10 5h10 M10 12h7 M10 19h10 M4 5h4 M4 12h4 M4 19h4',open:'M14 3h7v7 M21 3 10 14 M10 4H4v16h16v-6',search:'M17 17l4 4 M19 10.5a8.5 8.5 0 1 1-17 0 8.5 8.5 0 0 1 17 0',prev:'M20 12H4m7-7-7 7 7 7',next:'M4 12h16m-7-7 7 7-7 7',check:'m5 12 4 4L19 6'};
  const icon=name=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]}"/></svg>`;
  const spark='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1c1.4 6.3 4.7 9.6 11 11-6.3 1.4-9.6 4.7-11 11C10.6 16.7 7.3 13.4 1 12 7.3 10.6 10.6 7.3 12 1Z"/></svg>';
  const category=f=>{const b=BUCKETS.find(b=>b.id===f.bucket)||BUCKETS.find(b=>b.id==='undecided');return `<span class="explore-category" data-bucket="${b.id}" aria-label="AI suggestion: ${b.label}">${spark}<span>AI · ${b.label}</span></span>`;};
  const currentFiles=()=>getFiles().filter(isActiveFile);
  const lookup=id=>currentFiles().find(f=>f.id===id);
  const queueFiles=ids=>{const available=new Map(currentFiles().map(f=>[f.id,f]));return ids.map(id=>available.get(id)).filter(Boolean);};
  const q=selector=>root.querySelector(selector);
  const cardArt=f=>fileArt(f).replace(/<button\b[^>]*data-repair=[\s\S]*?<\/button>/gi,'');
  const metadata=f=>`<span>${esc(f.app||f.ext)}</span><span>${esc(prettySize(f))}</span><span>${esc(f.modified||'')}</span>`;
  const selectionControl=f=>`<label class="explore-preview-select" title="Select this file"><input type="checkbox" data-select="${esc(f.id)}" aria-label="Select ${esc(f.file)}" ${selected.has(f.id)?'checked':''}><span aria-hidden="true">${icon('check')}</span></label>`;
  const relevantFiles=()=>{
    const state=getState(),view=filters.view;
    const matchesView=f=>!view||(['pending','keep'].includes(view)?f.decision===view:view==='continue'?f.decision==='pending':view==='saved'?state.saved?.includes(f.id):view==='recent'?state.recent?.includes(f.id):view==='duplicates'?f.bucket==='trash':true);
    const found=searchFiles(filters.q,currentFiles().filter(f=>(!filters.type||f.type===filters.type)&&(!filters.bucket||f.bucket===filters.bucket)&&matchesView(f)));
    return view==='recent'?found.sort((a,b)=>(state.recent||[]).indexOf(a.id)-(state.recent||[]).indexOf(b.id)):groupSimilarFiles(found);
  };

  root.classList.add('explore-workspace');
  root.innerHTML=`<div class="explore-top"><button class="explore-back" type="button" aria-label="Back to Explore">${icon('prev')}Explore</button><form class="explore-search" role="search">${icon('search')}<input type="search" placeholder="Find a file…" aria-label="Search project files"><button type="submit" aria-label="Search project files">↗</button></form></div>
    <div class="explore-heading"><div><h1></h1><span class="explore-count"></span><button class="explore-view-chip" type="button" hidden></button></div><nav class="explore-type-nav" aria-label="Browse file types" hidden><button class="explore-prev-type" type="button" aria-label="Previous file type" title="Previous file type">${icon('prev')}</button><button class="explore-next-type" type="button" aria-label="Next file type" title="Next file type">${icon('next')}</button></nav></div>
    <div class="explore-filters" role="group" aria-label="Filter by AI suggestion"></div><div class="explore-grid"></div>
    <div class="explore-empty" hidden><span>⌕</span><p>No matching files</p><button class="secondary-button" type="button">Clear filters</button></div>
    <div class="explore-selection" hidden><div class="explore-selection-files"></div><span class="explore-selection-count"></span><button class="explore-clear" type="button">Clear</button><button class="explore-review-selection" type="button">Preview selection <span aria-hidden="true">↗</span></button><button class="explore-selection-archive explore-secondary" type="button">Archive</button><button class="explore-selection-trash explore-primary" type="button">Move to Trash</button></div>
    <p class="explore-status sr-only" role="status" aria-live="polite"></p>
    <dialog class="explore-detail-dialog" aria-labelledby="explore-detail-title"><div class="explore-preview-layout"><div class="explore-preview-main"></div><aside class="explore-timeline" aria-label="Project timeline" hidden><div class="explore-timeline-heading"><h3>Timeline</h3><button type="button" class="explore-modal-close" data-timeline-close aria-label="Close timeline">×</button></div><div class="explore-timeline-scroll" tabindex="0" aria-label="Scroll the project timeline"></div></aside></div></dialog>
    <dialog class="explore-compare-dialog" aria-labelledby="explore-compare-title"><div class="explore-compare-heading"><div><h2 id="explore-compare-title">Side by side</h2><span class="explore-compare-summary" role="status" aria-live="polite"></span></div><button class="explore-modal-close" type="button" data-compare-close aria-label="Close comparison">×</button></div><div class="explore-comparison-stage"><button class="explore-preview-nav explore-compare-prev" type="button" data-compare-prev aria-label="Previous comparison files">${icon('prev')}</button><div class="explore-compare-columns"></div><button class="explore-preview-nav explore-compare-next" type="button" data-compare-next aria-label="Next comparison files">${icon('next')}</button></div><div class="explore-compare-batch" hidden></div><div class="explore-comparison-finding">${spark}<div><span class="explore-finding-label">AI insight</span><p></p></div></div></dialog>`;
  const detailDialog=q('.explore-detail-dialog'),compareDialog=q('.explore-compare-dialog');
  let timelineHeight=0;
  const timelineScroll=q('.explore-timeline-scroll');
  const resizeTimeline=()=>{
    const height=timelineScroll.clientHeight;if(!height||height===timelineHeight)return;
    timelineHeight=height;timelineScroll.style.setProperty('--timeline-viewport-height',height+'px');
    if(timelineOpen&&detailDialog.open){if(timelineFrame)cancelAnimationFrame(timelineFrame);timelineFrame=requestAnimationFrame(()=>{timelineFrame=0;centerTimeline();});}
  };
  if(typeof ResizeObserver==='function')new ResizeObserver(resizeTimeline).observe(timelineScroll);
  function centerTimeline(){const scroll=timelineScroll,item=scroll.querySelector('.is-current');if(!timelineOpen||!detailDialog.open||!item)return;const r=item.getBoundingClientRect(),s=scroll.getBoundingClientRect();scroll.scrollTop+=r.top-s.top-(scroll.clientHeight-r.height)/2;timelineAnchor=detailId;}
  q('.explore-back').onclick=()=>onBack?.();
  q('.explore-view-chip').onclick=()=>{filters.view='';render();};
  q('.explore-search').onsubmit=e=>{e.preventDefault();filters.q=q('.explore-search input').value.trim();render();};
  q('.explore-search input').onsearch=()=>{if(!q('.explore-search input').value){filters.q='';render();}};
  q('.explore-empty button').onclick=()=>{filters={...filters,bucket:'',q:'',view:''};render();};
  q('.explore-clear').onclick=()=>{selected.clear();syncSelection();};
  q('.explore-review-selection').onclick=()=>{const files=queueFiles([...selected]);if(files.length)showDetail(files[0].id,files);};
  q('.explore-selection-archive').onclick=()=>takeAction([...selected],'archive');
  q('.explore-selection-trash').onclick=()=>takeAction([...selected],'trash');
  const switchType=direction=>{const type=adjacentType(direction);if(!type)return;clearSelection();filters={type:type.id,bucket:'',q:'',view:''};if(onTypeChange)onTypeChange(type.id);else render();};
  q('.explore-prev-type').onclick=()=>switchType(-1);
  q('.explore-next-type').onclick=()=>switchType(1);
  q('[data-compare-close]').onclick=()=>compareDialog.close();
  q('[data-compare-prev]').onclick=()=>moveComparison(-1);
  q('[data-compare-next]').onclick=()=>moveComparison(1);
  q('[data-timeline-close]').onclick=()=>toggleTimeline(false);
  detailDialog.addEventListener('close',()=>{detailId=null;detailIds=[];timelineOpen=false;timelineAnchor=null;});
  compareDialog.addEventListener('close',()=>{compareOpen=false;compareIds=[];if(detailDialog.open)renderDetail();});
  for(const dialog of [detailDialog,compareDialog])dialog.addEventListener('click',e=>{if(e.target!==dialog)return;const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();});
  detailDialog.addEventListener('keydown',e=>{if(compareDialog.open||/TEXTAREA|SELECT/.test(e.target.tagName)||(e.target.tagName==='INPUT'&&e.target.type!=='checkbox')||e.target.closest('.rec-popover'))return;if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();moveDetail(e.key==='ArrowLeft'?-1:1);}});
  compareDialog.addEventListener('keydown',e=>{if(e.target.closest('.rec-popover')||/INPUT|TEXTAREA|SELECT/.test(e.target.tagName))return;if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();moveComparison(e.key==='ArrowLeft'?-1:1);}});

  function select(id,checked){if(checked&&lookup(id))selected.add(id);else selected.delete(id);syncSelection();}
  function bindSelect(container){container.querySelectorAll('[data-select]').forEach(input=>input.onchange=()=>select(input.dataset.select,input.checked));}
  function syncSelection(){
    for(const id of selected)if(!lookup(id))selected.delete(id);
    const files=queueFiles([...selected]);
    q('.explore-selection').hidden=!files.length;
    q('.explore-selection-count').textContent=`${files.length} selected`;
    q('.explore-selection-files').innerHTML=files.slice(0,3).map(f=>`<span class="explore-mini" title="${esc(f.file)}">${thumb(f)}</span>`).join('');
    q('.explore-review-selection').disabled=!files.length;
    q('.explore-selection-archive').disabled=!files.length;q('.explore-selection-trash').disabled=!files.length;
    root.querySelectorAll('[data-select]').forEach(input=>{input.checked=selected.has(input.dataset.select);input.closest('.explore-file-card')?.classList.toggle('is-selected',input.checked);});
    const f=lookup(detailId),trash=q('[data-detail-trash]');
    if(f&&trash){const targets=previewTrashTargets(currentFiles(),f.id,selected);trash.textContent=targets.batch?`Move ${targets.ids.length} files to Trash`:'Move to Trash';trash.setAttribute('aria-label',targets.batch?`Move ${targets.ids.length} selected files to Trash`:`Move ${f.file} to Trash`);}
    renderCompareBatch();
  }
  function takeAction(ids,decision){
    const valid=ids.filter(id=>lookup(id));if(!valid.length)return;
    onDecide?.(valid,decision,{preservePreview:true,onApplied(){
      for(const id of valid)selected.delete(id);
      syncSelection();
      if(detailDialog.open&&!compareDialog.open)q('#explore-detail-title')?.focus({preventScroll:true});
    }});
  }
  function showDetail(id,files=relevantFiles()){
    if(!files.some(f=>f.id===id)||!lookup(id))return;
    detailIds=files.map(f=>f.id);detailId=id;timelineOpen=false;timelineAnchor=null;
    renderDetail();if(!detailDialog.open)detailDialog.showModal();
  }
  function moveDetail(direction){
    const files=queueFiles(detailIds),index=files.findIndex(f=>f.id===detailId),next=files[index+direction];
    if(next){detailId=next.id;renderDetail();q('#explore-detail-title')?.focus({preventScroll:true});}
  }
  function renderDetail(){
    let f=lookup(detailId);
    if(!f){const next=previewAfterTrash(detailIds,detailId,currentFiles());detailIds=next.ids;detailId=next.ids[next.index]||null;f=lookup(detailId);}
    const main=q('.explore-preview-main');
    if(!f){delete detailDialog.dataset.fileId;timelineOpen=false;detailDialog.classList.remove('has-timeline');q('.explore-timeline').hidden=true;main.innerHTML='<div class="explore-preview-top"><span></span><button type="button" class="explore-modal-close" data-detail-close aria-label="Close file details">×</button></div><div class="explore-complete"><h2 id="explore-detail-title" tabindex="-1">You’re all done here.</h2><p>No more files in this selection.</p></div>';q('[data-detail-close]').onclick=()=>detailDialog.close();return;}
    const files=queueFiles(detailIds),index=files.findIndex(item=>item.id===f.id);
    detailDialog.dataset.fileId=f.id;
    main.innerHTML=`<div class="explore-preview-top"><div class="suggestion-with-feedback">${category(f)}${feedbackControl(f)}</div><button type="button" class="explore-modal-close" data-detail-close aria-label="Close file details">×</button></div>
      <div class="explore-preview-stage"><button type="button" class="explore-preview-nav" data-detail-prev aria-label="Previous file" ${index<=0?'disabled':''}>${icon('prev')}</button><div class="explore-detail-art explore-art">${fileArt(f)}</div><button type="button" class="explore-preview-nav" data-detail-next aria-label="Next file" ${index<0||index>=files.length-1?'disabled':''}>${icon('next')}</button></div>
      <div class="explore-preview-caption"><div class="explore-preview-title-row"><h2 id="explore-detail-title" tabindex="-1">${esc(f.file)}</h2><button class="explore-original" type="button" data-original="${esc(f.id)}" aria-label="Open ${esc(f.file)}" title="Open original file">${icon('open')}</button></div><div class="explore-metadata">${metadata(f)}</div></div>
      <div class="explore-insight">${recommendationTags(f)}<p class="explore-reason-hint">Click a tag to see the reasoning.</p></div>
      <div class="explore-discover-actions"><button type="button" data-auto-compare>${icon('compare')}<span>Auto compare</span></button><button type="button" data-timeline-toggle aria-expanded="${timelineOpen}" aria-controls="explore-timeline-content">${icon('timeline')}<span>${timelineOpen?'Hide timeline':'View timeline'}</span></button></div>
      <div class="explore-preview-actions"><button type="button" class="explore-secondary" data-detail-archive>Archive</button><button type="button" class="explore-primary" data-detail-trash>Move to Trash</button>${selectionControl(f)}</div>
      <span class="sr-only" role="status" aria-live="polite">File ${index+1} of ${files.length}. ${esc(f.file)}</span>`;
    hydrateArt?.(q('.explore-detail-art'),f);
    q('[data-detail-close]').onclick=()=>detailDialog.close();
    q('[data-detail-prev]').onclick=()=>moveDetail(-1);q('[data-detail-next]').onclick=()=>moveDetail(1);
    q('[data-original]').onclick=()=>onOpenFile?.(f.id);
    q('[data-detail-archive]').onclick=()=>takeAction([f.id],'archive');
    q('[data-detail-trash]').onclick=()=>takeAction(previewTrashTargets(currentFiles(),f.id,selected).ids,'trash');
    q('[data-auto-compare]').onclick=()=>openComparison(similarFiles(f,currentFiles()),true);
    q('[data-timeline-toggle]').onclick=()=>toggleTimeline(!timelineOpen);
    bindSelect(main);renderTimeline();syncSelection();
  }
  function toggleTimeline(open){timelineOpen=open;timelineAnchor=null;renderDetail();q('[data-timeline-toggle]')?.focus({preventScroll:true});}
  function renderTimeline(){
    const panel=q('.explore-timeline'),scroll=q('.explore-timeline-scroll');panel.id='explore-timeline-content';panel.hidden=!timelineOpen;detailDialog.classList.toggle('has-timeline',timelineOpen);
    if(timelineFrame)cancelAnimationFrame(timelineFrame);timelineFrame=0;
    if(!timelineOpen)return;
    const position=scroll.scrollTop,shouldCenter=timelineAnchor!==detailId,groups=timelineGroups(currentFiles());
    scroll.innerHTML=groups.map(group=>`<section class="explore-timeline-day"><time>${esc(group.date)}</time><div>${group.files.map(f=>`<button type="button" class="explore-timeline-entry ${f.id===detailId?'is-current':''}" data-timeline-file="${esc(f.id)}" ${f.id===detailId?'aria-current="true"':''} aria-label="View ${esc(f.file)} from ${esc(group.date)}"><span class="explore-timeline-thumb">${thumb(f)}</span><span class="explore-timeline-info"><strong>${esc(f.file)}</strong><span>${esc(f.app)} · ${esc(prettySize(f))}</span></span></button>`).join('')}</div></section>`).join('');
    scroll.querySelectorAll('[data-timeline-file]').forEach(button=>button.onclick=()=>{detailIds=groups.flatMap(g=>g.files.map(f=>f.id));detailId=button.dataset.timelineFile;renderDetail();});
    timelineFrame=requestAnimationFrame(()=>{timelineFrame=0;if(!timelineOpen||!detailDialog.open)return;scroll.style.setProperty('--timeline-viewport-height',scroll.clientHeight+'px');timelineHeight=scroll.clientHeight;if(shouldCenter)centerTimeline();else scroll.scrollTop=position;});
  }
  function openComparison(files,automatic=false){
    compareIds=[...new Set(files.filter(isActiveFile).map(f=>f.id))];if(!compareIds.length)return;
    comparePage=0;compareOpen=true;compareDialog.dataset.automatic=String(automatic);renderComparison();if(!compareDialog.open)compareDialog.showModal();
  }
  function moveComparison(direction){const files=queueFiles(compareIds),pages=Math.ceil(files.length/3);comparePage=Math.max(0,Math.min(pages-1,comparePage+direction));renderComparison();}
  function renderCompareBatch(){
    const chosen=queueFiles(compareIds).filter(f=>selected.has(f.id)),bar=q('.explore-compare-batch');
    bar.hidden=!compareOpen||chosen.length<2;
    if(bar.hidden){bar.innerHTML='';return;}
    bar.innerHTML=`<button class="explore-secondary" type="button" data-compare-archive-selected>Archive ${chosen.length}</button><button class="explore-primary" type="button" data-compare-trash-selected>Move ${chosen.length} files to Trash</button><span>${chosen.length} selected</span>`;
    q('[data-compare-archive-selected]').onclick=()=>takeAction(chosen.map(f=>f.id),'archive');q('[data-compare-trash-selected]').onclick=()=>takeAction(chosen.map(f=>f.id),'trash');
  }
  function renderComparison(){
    const files=queueFiles(compareIds);comparePage=Math.max(0,Math.min(Math.ceil(files.length/3)-1,comparePage));
    const start=comparePage*3,visible=files.slice(start,start+3),columns=q('.explore-compare-columns');
    q('.explore-compare-summary').textContent=files.length?`${start+1}–${Math.min(start+3,files.length)} of ${files.length} files`: 'No files left in this comparison';
    q('[data-compare-prev]').disabled=comparePage===0;q('[data-compare-next]').disabled=start+3>=files.length;
    columns.style.setProperty('--compare-columns',Math.max(1,visible.length));
    columns.innerHTML=visible.map(f=>`<article class="explore-compare-file" data-file="${esc(f.id)}"><div class="suggestion-with-feedback">${category(f)}${feedbackControl(f)}</div><div class="explore-compare-art explore-art" data-art="${esc(f.id)}">${fileArt(f)}</div><div class="explore-compare-file-heading"><h3>${esc(f.file)}</h3><button class="explore-original" type="button" data-original="${esc(f.id)}" aria-label="Open ${esc(f.file)}">${icon('open')}</button></div><div class="explore-metadata">${metadata(f)}</div><div class="explore-insight">${recommendationTags(f)}<p class="explore-reason-hint">Click a tag to see the reasoning.</p></div><div class="explore-compare-actions"><button type="button" class="explore-secondary" data-compare-archive="${esc(f.id)}">Archive</button><button type="button" class="explore-primary" data-compare-trash="${esc(f.id)}">Move to Trash</button>${selectionControl(f)}</div></article>`).join('');
    columns.querySelectorAll('[data-art]').forEach(el=>hydrateArt?.(el,lookup(el.dataset.art)));
    columns.querySelectorAll('[data-original]').forEach(button=>button.onclick=()=>onOpenFile?.(button.dataset.original));
    columns.querySelectorAll('[data-compare-archive]').forEach(button=>button.onclick=()=>takeAction([button.dataset.compareArchive],'archive'));
    columns.querySelectorAll('[data-compare-trash]').forEach(button=>button.onclick=()=>takeAction([button.dataset.compareTrash],'trash'));
    bindSelect(columns);renderCompareBatch();
    q('.explore-comparison-finding p').textContent=files.length?comparisonFinding(visible):'These files have been moved out of your workspace. You can restore them from History.';
  }
  function adjacentType(direction){
    if(!filters.type)return null;
    const present=new Set(currentFiles().map(f=>f.type)),known=TYPES.filter(t=>present.has(t.id));
    const unknown=[...present].filter(id=>!TYPES.some(t=>t.id===id)).sort().map(id=>({id,app:currentFiles().find(f=>f.type===id)?.app||'.'+id}));
    const available=[...known,...unknown],index=available.findIndex(t=>t.id===filters.type);
    if(available.length<2)return null;
    if(index<0)return direction<0?available.at(-1):available[0];
    return available[(index+direction+available.length)%available.length];
  }
  function render(options){
    const files=currentFiles(),nextScope=getState().session?.project||files[0]?.project||'';
    if(scope!==null&&scope!==nextScope){clearSelection();filters={type:'',bucket:'',q:'',view:''};}scope=nextScope;
    if(options)for(const name of ['type','bucket','q','view'])if(Object.hasOwn(options,name))filters[name]=options[name]||'';
    for(const id of selected)if(!files.some(f=>f.id===id))selected.delete(id);
    const found=relevantFiles(),type=TYPES.find(t=>t.id===filters.type);
    q('.explore-heading h1').textContent=filters.type?(type?.app||'.'+filters.type)+' files':'Your project, up close';
    q('.explore-count').textContent=found.length+' '+(found.length===1?'file':'files');
    q('.explore-type-nav').hidden=!adjacentType(1);
    q('.explore-view-chip').hidden=!filters.view;q('.explore-view-chip').textContent=(viewLabels[filters.view]||filters.view)+' ×';
    q('.explore-search input').value=filters.q;
    q('.explore-filters').innerHTML='<span>AI suggestion</span>'+[{id:'',label:'All'},...BUCKETS].map(b=>`<button type="button" data-filter="${b.id}" aria-pressed="${filters.bucket===b.id}">${b.id?`<i data-bucket="${b.id}"></i>`:''}${esc(b.label)}</button>`).join('');
    q('.explore-filters').querySelectorAll('button').forEach(button=>button.onclick=()=>{filters.bucket=button.dataset.filter;render();});
    q('.explore-grid').innerHTML=found.map(f=>`<article class="explore-file-card ${selected.has(f.id)?'is-selected':''}" data-file="${esc(f.id)}" data-bucket="${esc(f.bucket)}"><div class="explore-card-image"><label class="explore-select"><input type="checkbox" data-select="${esc(f.id)}" ${selected.has(f.id)?'checked':''} aria-label="Select ${esc(f.file)}"><span aria-hidden="true">✓</span></label><button type="button" class="explore-open-detail" data-open="${esc(f.id)}" aria-label="View details of ${esc(f.file)}"><span class="explore-card-art explore-art">${cardArt(f)}</span></button></div><div class="explore-card-copy"><div class="explore-entry-row"><button type="button" data-open="${esc(f.id)}" class="explore-card-name" title="${esc(f.file)}"><span class="explore-filename">${esc(f.file)}</span></button></div><div class="explore-card-meta"><span>${esc(prettySize(f))}</span><span>${esc(f.modified)}</span></div><div class="explore-card-reasons">${recommendationTags(f)}</div></div><div class="explore-card-category">${category(f)}</div></article>`).join('');
    q('.explore-empty').hidden=!!found.length;
    q('.explore-grid').querySelectorAll('[data-open]').forEach(button=>button.onclick=()=>showDetail(button.dataset.open));bindSelect(q('.explore-grid'));
    q('.explore-grid').querySelectorAll('.explore-file-card').forEach(card=>hydrateArt?.(card.querySelector('.explore-card-art'),lookup(card.dataset.file)));
    syncSelection();if(detailDialog.open)renderDetail();if(compareOpen&&compareDialog.open)renderComparison();
  }
  function clearSelection(){selected.clear();detailId=null;detailIds=[];compareIds=[];compareOpen=false;timelineOpen=false;timelineAnchor=null;if(compareDialog.open)compareDialog.close();if(detailDialog.open)detailDialog.close();syncSelection();}
  return {render,clearSelection};
}
