import {TYPES,BUCKETS,FILES,searchFiles,formatStorage} from './data.js';
import {art} from './art.js';
import {createCarousel} from './carousel.js';
import {createQuickMode} from './quick-mode.js';
import {createExploreMode} from './explore-mode.js';
import {projectFiles} from './mode-model.js';
import {registerOriginal,openOriginal} from './original-files.js';
import {createActivity} from './activity.js';
import {createWorkspace} from './workspace.js';
import {preparePreview,getPreviewUrl,imageKind} from './previews.js';
import {getSessionSummary,nextPendingIndex,adjacentReviewIndex,validReturnRoute} from './review-flow.js';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)],ws=createWorkspace();
const state=()=>ws.getState(),records=()=>state().files,esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const paths={files:'M8 3h9l4 4v13H8z M17 3v5h4 M4 7H3v15h13',folder:'M3 6h7l2 3h9v11H3z M3 6V4h7l2 2h8v3',upload:'M12 16V3m-5 5 5-5 5 5 M4 15v6h16v-6',keep:'m5 12 4 4L19 6',archive:'M4 7h16v14H4z M3 3h18v4H3z M9 11h6',trash:'M4 6h16 M9 6V3h6v3 M6 6l1 15h10l1-15 M10 10v7m4-7v7',undecided:'M9 8a3 3 0 1 1 5 2c-2 1-2 2-2 4 M12 18h.01',restore:'M4 9h10a6 6 0 0 1 0 12 M8 5 4 9l4 4',check:'m5 12 4 4L19 6'};
const icon=(name)=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]||paths.files}"/></svg>`;
$$('[data-icon]').forEach(n=>n.innerHTML=icon(n.dataset.icon));
const badge=f=>`<span class="ai-badge" data-bucket="${f.bucket}" aria-label="AI suggestion: ${f.bucket}">✦ AI · ${BUCKETS.find(b=>b.id===f.bucket)?.label||'Undecided'}</span>`;
const decisionLabels={pending:'To review',keep:'Kept',archive:'Archived',trash:'In Trash'};
const pill=f=>`<span class="decision-pill" data-decision="${f.decision}">${decisionLabels[f.decision]}</span>`;
const prettySize=f=>f.size<0.001?`${Math.round(f.size*1e6)} B`:f.size<1?`${Math.round(f.size*1000)} KB`:formatStorage(Math.round(f.size*100)/100);
const currentFiles=()=>projectFiles(records(),state().session.project);
const modeHome=()=>({page:state().session.mode==='explore'?'explore':'quick'});
const pending=()=>currentFiles().filter(f=>f.decision==='pending');
const previewUrls=new Map();
let importBusy=false,originalRepairId=null,repairId=null,authEmail='',authIntent={page:'import'},lastPage='',routeGeneration=0,renderedHash=null;
let route={},sort=state().session.sort,previewId=null,reviewId=state().resumeId,queue=[],loginNext='import',analysisTimer=null,analysisPaused=false,toastEvent=null,toastTimer=null,confirmFn=null,clarifyId=null,clarifyChoice=null;
function hash(params={}){let {page='browse',...rest}=params;const p=new URLSearchParams();for(const[k,v]of Object.entries(rest))if(v)p.set(k,v);return '#'+(page==='home'?'':page)+(p.size?'?'+p:'');}
function readRoute(){const[page='',params='']=location.hash.slice(1).split('?'),p=Object.fromEntries(new URLSearchParams(params));return {page:page||'home',type:'',view:'',bucket:'',project:'',q:'',metric:'files',group:p.group==='project'||(!p.group&&p.project)?'project':'type',...p};}
function navigate(params={},options={}){
 const next=typeof params==='string'?params:hash(params);
 if(options.replace){history.replaceState(null,'',next);renderRoute();}
 else{if((location.hash||'#')!==next)history.pushState(null,'',next);renderRoute();}
}
function closeDialogs(){for(const d of $$('dialog[open]'))d.close();confirmFn=null;clarifyId=null;clarifyChoice=null;}
const carousel=createCarousel({getFiles:()=>state().session.signedIn?currentFiles():FILES,onSelect:type=>{if(guard({page:'browse',type}))navigate({page:'browse',type});},isEnabled:()=>!$('#home-view').hidden&&!$('dialog[open]'),autoplay:state().session.autoplay});

function notify(message,event=null){clearTimeout(toastTimer);$('#toast-message').textContent=message;toastEvent=event?.id||null;$('#toast-undo').hidden=!event||!ws.canUndo(event.id);$('#toast').hidden=false;toastTimer=setTimeout(()=>$('#toast').hidden=true,7000);}
function syncHeader(){const s=state(),initials=s.session.name.trim().split(/\s+/).map(v=>Array.from(v)[0]||'').slice(0,2).join('').toUpperCase();$('#header-avatar').textContent=s.session.signedIn?initials:'↗';$('#account-button').setAttribute('aria-label',s.session.signedIn?`${s.session.name} — account settings`:'Log in');$('#account-button').dataset.signedIn=String(s.session.signedIn);$('#storage-alert').hidden=!s.storageError;}
ws.subscribe(syncHeader);
function guard(next={page:'browse'}){if(!state().session.signedIn){openLogin(next);return false;}if(!records().length){navigate({page:'import'});return false;}return true;}
function showAuthStep(step){for(const id of ['auth-options','email-step','google-step'])$('#'+id).hidden=id!==step;$('#auth-error').hidden=true;}
function openLogin(next={page:'import'}){
 authIntent=typeof next==='string'?{page:next}:next;showAuthStep('auth-options');
 $('#login-email').value=state().session.email||'';$('#login-code').value='';
 $('#login-dialog').showModal();
}
function completeLogin(identity){
 if(!ws.login(identity)){showAuthStep('auth-options');$('#auth-error').textContent='Enter a valid email address.';$('#auth-error').hidden=false;$('#login-email').focus();return;}
 $('#login-dialog').close();sort=state().session.sort;carousel.setAutoplay(state().session.autoplay);
 const intent=authIntent;
 if(intent.page==='demo'){loadDemo();return;}
 if(!records().length){navigate({page:'import'},{replace:route.page==='home'});return;}
 navigate(intent.page==='import'&&intent.resume?{page:'home'}:intent);
}
$('#login-form').addEventListener('submit',e=>{
 e.preventDefault();authEmail=$('#login-email').value.trim().toLowerCase();
 if(!$('#login-email').checkValidity())return $('#login-email').reportValidity();
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(authEmail)){$('#auth-error').textContent='Enter a valid email address, such as name@example.com.';$('#auth-error').hidden=false;return;}
 showAuthStep('email-step');$('#email-destination').textContent=authEmail;$('#login-code').value='';$('#login-code').focus();
});
$('#code-form').addEventListener('submit',e=>{
 e.preventDefault();if($('#login-code').value!=='123456'){$('#auth-error').textContent='Use the demo code 123456.';$('#auth-error').hidden=false;$('#login-code').focus();return;}
 completeLogin({email:authEmail,provider:'email'});
});
$('#login-code').addEventListener('input',()=>{$('#login-code').value=$('#login-code').value.replace(/\D/g,'').slice(0,6);$('#auth-error').hidden=true;});
$('#google-login').onclick=()=>showAuthStep('google-step');
$('#google-demo-account').onclick=()=>completeLogin({name:'Demo Designer',email:'designer@example.com',provider:'google'});
$('#email-back').onclick=$('#google-back').onclick=()=>showAuthStep('auth-options');
function renderHome(){
 const s=state(),files=currentFiles(),has=s.session.signedIn&&files.length;
 $('#home-dock').hidden=!has;$('#welcome-actions').hidden=!!has;$('#resume-card').hidden=!has;$('#home-view').classList.toggle('has-workspace',!!has);$('#home-workspace-actions').hidden=!has;
 $('#welcome-primary').innerHTML=s.session.signedIn?'Choose files <span>↗</span>':'Log in & add files <span>↗</span>';$('#welcome-secondary').textContent=s.session.signedIn?'Read a local folder →':'Explore a demo →';
 carousel.refresh?.();if(!has)return;
 const left=pending().length,done=files.length-left,pct=Math.round(done/files.length*100);
 $('#resume-orbit').style.setProperty('--progress',pct+'%');$('#resume-detail').textContent=`${done} of ${files.length} considered · ${left} to explore`;
 $('#resume-button').innerHTML=(left?'Continue exploring':'Browse your files')+' <span>→</span>';
 $('#suggestion-chips').innerHTML=BUCKETS.map(b=>`<button class="suggestion-chip" data-bucket="${b.id}" style="--bucket-color:${b.color}"><i class="suggestion-dot" aria-hidden="true"></i>${b.label}<span>${files.filter(f=>f.bucket===b.id).length}</span></button>`).join('');
 $$('#suggestion-chips button').forEach(b=>b.onclick=()=>navigate({page:'browse',bucket:b.dataset.bucket}));
}
$('#welcome-primary').onclick=()=>{if(!state().session.signedIn)openLogin({page:'import',resume:!!records().length});else navigate({page:'import'});};
$('#welcome-secondary').onclick=()=>{if(!state().session.signedIn)openLogin('demo');else{navigate({page:'import'});$('#folder-input').click();}};
function beginReview(ids,focusId=null,returnTo=location.hash||'#files',replace=false){
 ws.startReview(ids,{focusId,returnTo:validReturnRoute(returnTo)});reviewId=null;navigate({page:'review'},{replace});
}
function continueReview(){
 const current=state().review,available=pending();
 if(!available.length){navigate({page:'browse'});return;}
 const inScope=available.filter(f=>current.ids.includes(f.id));
 const ids=inScope.length?current.ids.filter(id=>currentFiles().some(f=>f.id===id)):available.map(f=>f.id);
 const focus=inScope.some(f=>f.id===state().resumeId)?state().resumeId:(inScope[0]||available[0]).id;
 beginReview(ids,focus,inScope.length?current.returnTo:'#explore');
}
$('#resume-button').onclick=()=>continueReview();
$('#header-import').onclick=()=>{if(state().session.signedIn)navigate({page:'import'});else openLogin('import');};

function thumb(f){if(f.source==='local')return f.previewData?`<img src="${esc(f.previewData)}" alt="" loading="lazy">`:`<span class="file-format">${esc(f.ext||'FILE')}</span>`;return f.image?`<img src="assets/${esc(f.image)}" alt="" loading="lazy">`:`<span class="file-format">${esc(f.ext)}</span>`;}
function fileArt(f){
 if(f.source==='demo')return art(f);
 const src=previewUrls.get(f.id)||f.previewData;
 if(src)return `<img class="local-preview" data-preview-id="${esc(f.id)}" src="${esc(src)}" alt="Preview of ${esc(f.file)}">`;
 const isImage=imageKind({name:f.file,type:f.type}).isImage;
 return `<div class="native-preview"><span class="native-file-icon">${esc(f.ext||'FILE')}</span><strong>${isImage?'Image preview unavailable':'Native file'}</strong><span>${esc(f.previewError||(isImage?'Select this image again to create its preview.':'Open in '+f.app+' to view its contents.'))}</span>${isImage?`<button class="secondary-button" data-repair="${esc(f.id)}">Select image again ↗</button>`:''}</div>`;
}
function hydrateArt(container,f){
 container.querySelectorAll('[data-repair]').forEach(b=>b.onclick=()=>{repairId=f.id;$('#file-input').click();});
 if(f.source!=='local'||!f.previewKey)return;
 getPreviewUrl(f).then(url=>{if(!url)return;previewUrls.set(f.id,url);const img=container.querySelector('[data-preview-id]');if(img?.dataset.previewId===f.id)img.src=url;});
}
function syncContext(){
 const s=state(),projects=[...new Set(records().map(f=>f.project))],has=s.session.signedIn&&records().length;
 $('.mode-switch').hidden=!has;$('#history-toggle').hidden=!has;
 $('#workspace-context').hidden=!has||!['quick','explore','browse'].includes(route.page);
 $('#project-select').innerHTML=projects.map(name=>`<option value="${esc(name)}" ${name===s.session.project?'selected':''}>${esc(name)}</option>`).join('');
 $('#project-total').textContent=`${currentFiles().length} files`;
 $$('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===s.session.mode)));
}
function renderRoute(){
 clearTimeout(analysisTimer);routeGeneration++;closeDialogs();route={...readRoute()};
 const alias={files:'browse',projects:'explore',dashboard:'quick',activity:state().session.mode};
 const wantsHistory=route.page==='activity';if(alias[route.page])route.page=alias[route.page];
 if(!['home','quick','explore','browse','import','analysis','review'].includes(route.page))route.page='home';
 let authTarget=null;
 if(!state().session.signedIn&&route.page!=='home'){authTarget={...route};route.page='home';}
 if(state().session.signedIn){
  if(!records().length&&route.page!=='home')route.page='import';
  if(records().length&&route.page==='home')route={...route,...modeHome()};
  if(state().analysis.status==='pending'&&!['import','analysis'].includes(route.page))route.page='analysis';
  if(route.page==='analysis'&&state().analysis.status!=='pending')route={...route,...modeHome()};
 }
 if(route.page==='quick')ws.updateProfile({mode:'quick'});
 if(['explore','browse'].includes(route.page))ws.updateProfile({mode:'explore'});
 if((location.hash||'#')!==hash(route))history.replaceState(null,'',hash(route));
 const focused=['import','analysis','review'].includes(route.page);document.body.dataset.focus=String(focused);document.body.dataset.page=route.page;
 $('#flow-exit').hidden=!focused;$('#flow-stepper').hidden=!focused;$$('[data-step]').forEach(el=>el.setAttribute('aria-current',el.dataset.step===route.page?'step':'false'));
 for(const id of ['home','quick','browse','import','analysis','review'])$('#'+id+'-view').hidden=id==='home'?!['home','explore'].includes(route.page):id!==route.page;
 if(route.page!=='quick')quickUI.deactivate();
 if(['home','explore'].includes(route.page))renderHome();if(route.page==='quick')quickUI.render({enter:lastPage!=='quick'});if(route.page==='browse')exploreUI.render(route);
 if(route.page==='import'){$('#import-project-name').value=state().session.project||'My project';renderQueue();}
 if(route.page==='analysis'){analysisPaused=false;startAnalysis();}if(route.page==='review')renderReview();
 syncHeader();syncContext();carousel.resetClock();document.title=({home:'Files in order. Ideas in motion.',quick:'Quick Clear',explore:'Explore & Decide',browse:'Explore files',import:'Add files',analysis:'Preparing suggestions',review:'Explore & Decide'}[route.page])+' — FILEO';
 if(lastPage!==route.page){window.scrollTo({top:0,behavior:'instant'});$('#main').focus({preventScroll:true});}lastPage=route.page;
 renderedHash=location.hash;if(authTarget)openLogin(authTarget);if(wantsHistory&&state().session.signedIn)openHistory();
}
function onHistoryRoute(){if(renderedHash!==location.hash)renderRoute();}
window.addEventListener('hashchange',onHistoryRoute);window.addEventListener('popstate',onHistoryRoute);
$('#flow-exit').onclick=()=>{analysisPaused=true;clearTimeout(analysisTimer);if(state().analysis.status==='pending'){navigate({page:'import'});}else navigate(modeHome());};
$$('[data-mode]').forEach(b=>b.onclick=()=>{ws.updateProfile({mode:b.dataset.mode});quickUI.clearSelection();exploreUI.clearSelection();navigate({page:b.dataset.mode});});
$('#project-select').onchange=e=>{ws.setProject(e.target.value);quickUI.clearSelection();exploreUI.clearSelection();navigate(modeHome());};
$('#home-search').onsubmit=e=>{e.preventDefault();navigate({page:'browse',q:$('#search').value});};
$('#suggestions-toggle').onclick=()=>{const closed=!$('#suggestion-chips').hidden;$('#suggestion-chips').hidden=closed;$('#suggestions-toggle').setAttribute('aria-expanded',!closed);};
$('#resume-analysis').onclick=()=>navigate({page:'analysis'});$('#import-consent').onchange=renderQueue;$('#import-project-name').oninput=renderQueue;
// Decode images as local thumbnails before committing a captured import selection.
$('#choose-files').onclick=()=>{repairId=null;originalRepairId=null;$('#file-input').click();};$('#choose-folder').onclick=()=>$('#folder-input').click();
function addQueue(files){
 if(importBusy)return;const values=[...files].filter(f=>f.name&&!f.name.startsWith('.'));let skipped=0;
 for(const f of values){
  const key=[f.webkitRelativePath||f.name,f.size,f.lastModified].join('|');if(queue.some(x=>x.key===key)){skipped++;continue;}
  queue.push({key,file:f,preview:null,preparing:true});
 }
 $('#import-error').hidden=true;renderQueue();if(skipped)notify(`${skipped} already selected`);
 if(!values.length){$('#import-error').textContent='No readable files selected. Choose another folder.';$('#import-error').hidden=false;}
 processQueuePreviews();
}
let previewWorkers=0;
function processQueuePreviews(){
 while(previewWorkers<2){const item=queue.find(i=>i.preparing&&!i.started);if(!item)break;item.started=true;previewWorkers++;
 preparePreview(item.file).then(result=>{item.preview=result;}).catch(()=>{item.preview={previewStatus:'unreadable',previewError:'Could not create a preview. Select this image again.'};}).finally(()=>{item.preparing=false;previewWorkers--;if(route.page==='import')renderQueue();processQueuePreviews();});}
}
function descriptor(item){const f=item.file;return {name:f.name,size:f.size,lastModified:f.lastModified,type:f.type,relativePath:f.webkitRelativePath||'',...item.preview};}
async function repairPreview(id,file){
 const original=records().find(f=>f.id===id);if(!original)return;
 if(file.name!==original.file||file.size!==original.bytes){notify('Choose the same original image to restore its preview.');return;}
 notify('Creating preview…');const preview=await preparePreview(file);
 const result=ws.importFiles([{name:original.file,size:original.bytes,lastModified:original.lastModified,type:file.type,relativePath:original.path,...preview}],{project:original.project});
 previewUrls.delete(id);refreshCurrent();if($('#preview-dialog').open&&previewId===id)updatePreview();notify(result.repaired?'Preview updated.':preview.previewError||'Preview already available.');
}
$('#file-input').onchange=async e=>{const files=[...e.target.files],target=repairId,originalTarget=originalRepairId;repairId=null;originalRepairId=null;e.target.value='';if(!files.length)return;if(originalTarget){const record=records().find(f=>f.id===originalTarget);if(!record||files[0].name!==record.file||files[0].size!==record.bytes){notify('Select the same original file.');return;}await registerOriginal(record.id,files[0]);await openOriginal(record.id,record);return;}if(target){repairPreview(target,files[0]);return;}addQueue(files);};
$('#folder-input').onchange=e=>{const files=[...e.target.files];e.target.value='';if(files.length)addQueue(files);};
const drop=$('#drop-zone');for(const type of ['dragover','dragenter'])drop.addEventListener(type,e=>{e.preventDefault();if(!importBusy)drop.classList.add('drag-over');});drop.addEventListener('dragleave',()=>drop.classList.remove('drag-over'));drop.addEventListener('drop',e=>{e.preventDefault();drop.classList.remove('drag-over');if(!importBusy)addQueue(e.dataTransfer.files);});
function renderQueue(){
 $('#resume-analysis').hidden=state().analysis.status!=='pending';
 const preparing=queue.some(i=>i.preparing);$('#import-queue').hidden=!queue.length;$('#begin-analysis').disabled=!queue.length||preparing||importBusy||!$('#import-consent').checked||!$('#import-project-name').value.trim();
 $('#begin-analysis').innerHTML=(importBusy?'Adding…':preparing?'Preparing previews…':'Analyze files')+' <span>→</span>';
 for(const id of ['choose-files','choose-folder','clear-queue','import-demo'])$('#'+id).disabled=importBusy;
 $('#queue-title').textContent=`${queue.length} ${queue.length===1?'file':'files'}`;
 $('#queue-list').innerHTML=queue.map((item,i)=>`<div class="queue-row"><span class="queue-thumbnail">${item.preview?.previewData?`<img src="${esc(item.preview.previewData)}" alt="">`:icon(item.preparing?'undecided':'files')}</span><span class="queue-file"><strong>${esc(item.file.webkitRelativePath||item.file.name)}</strong>${item.preparing?'<small>Preparing preview…</small>':item.preview?.previewError?`<small>${esc(item.preview.previewError)}</small>`:''}</span><small>${prettySize({size:item.file.size/1e6})}</small><button class="icon-button" data-index="${i}" aria-label="Remove ${esc(item.file.name)}" ${importBusy?'disabled':''}>×</button></div>`).join('');
 $$('#queue-list button').forEach(b=>b.onclick=()=>{if(importBusy)return;queue.splice(Number(b.dataset.index),1);renderQueue();});
}
$('#clear-queue').onclick=()=>{if(importBusy)return;queue=[];renderQueue();};
$('#begin-analysis').onclick=async()=>{
 if(importBusy||!queue.length||queue.some(i=>i.preparing)||!state().session.signedIn||!$('#import-consent').checked||!$('#import-project-name').value.trim())return;
 importBusy=true;renderQueue();const selected=[...queue];
 try{
  const project=$('#import-project-name').value.trim(),result=ws.importFiles(selected.map(descriptor),{project});ws.setProject(project);await Promise.all(selected.map(async item=>{const record=records().find(f=>f.project===project&&f.path===(item.file.webkitRelativePath||item.file.name)&&f.file===item.file.name&&f.bytes===item.file.size&&f.lastModified===item.file.lastModified);if(record)await registerOriginal(record.id,item.file);}));queue=queue.filter(i=>!selected.includes(i));
  for(const id of result.repairedIds||[])previewUrls.delete(id);
  if(result.added){notify(`${result.added} added${result.repaired?` · ${result.repaired} previews repaired`:''}`);navigate({page:'analysis'});}
  else if(result.repaired){notify(`${result.repaired} previews repaired`);navigate(modeHome());}
  else{notify('Already in your workspace.');navigate(modeHome());}
 }catch{$('#import-error').textContent='Could not add these files. Please try again.';$('#import-error').hidden=false;}
 finally{importBusy=false;if(route.page==='import')renderQueue();}
};
function loadDemo(){if(!state().session.signedIn)return openLogin({page:'demo'});const result=ws.loadDemo();if(result.added)navigate({page:'analysis'});else navigate(modeHome());}
$('#import-demo').onclick=loadDemo;
function startAnalysis(){
 const s=state(),generation=routeGeneration;if(s.analysis.status!=='pending')return;
 const names=['Reading files','Finding signals','Preparing suggestions'];$('#analysis-count').textContent=`${s.analysis.ids.length} ${s.analysis.ids.length===1?'file':'files'}`;
 $('#analysis-progress').value=s.analysis.step;$('#analysis-steps').innerHTML=names.map((n,i)=>`<div class="analysis-step ${i<s.analysis.step?'done':i===s.analysis.step?'active':''}"><span>${i<s.analysis.step?'✓':String(i+1).padStart(2,'0')}</span>${n}</div>`).join('');
 analysisTimer=setTimeout(()=>{if(analysisPaused||route.page!=='analysis'||generation!==routeGeneration||!state().session.signedIn)return;
  if(state().analysis.step>=3){ws.finishAnalysis();navigate(modeHome(),{replace:true});}
  else{ws.setAnalysisStep(state().analysis.step+1);startAnalysis();}
 },600);
}
$('#pause-analysis').onclick=()=>{analysisPaused=true;clearTimeout(analysisTimer);navigate({page:'import'});};
function recommendation(f){return `<div class="recommendation-card">${badge(f)}<p>${esc(f.reason)}</p></div>`;}
function buttons(f){return ['keep','archive','trash','undecided'].map(d=>`<button class="decision-button ${f.decision===d?'is-selected':''}" data-decision="${d}" aria-label="${d==='undecided'?'Clarify':d[0].toUpperCase()+d.slice(1)} ${esc(f.file)}">${icon(d)}<span>${d==='undecided'?'Clarify':d[0].toUpperCase()+d.slice(1)}</span></button>`).join('');}
function bindDecisions(container,id,advance){container.querySelectorAll('button.decision-button[data-decision]').forEach(b=>b.onclick=()=>chooseDecision(id,b.dataset.decision,advance));}
function activeReviewFile(){const r=state().review;return records().find(f=>f.id===r.ids[r.cursor]);}
function latestReviewUndo(){return state().history.find(e=>ws.canUndo(e.id)&&e.fileIds.some(id=>state().review.ids.includes(id)));}
function renderReview(){
 let session=state().review;
 const projectIds=new Set(currentFiles().map(f=>f.id));
 if(session.ids.some(id=>!projectIds.has(id))){const ids=pending().map(f=>f.id);ws.startReview(ids,{focusId:ids[0],returnTo:'#explore'});session=state().review;}
 if(!session.ids.length&&pending().length){ws.startReview(pending().map(f=>f.id),{focusId:state().resumeId,returnTo:'#explore'});session=state().review;}
 const files=records(),summary=getSessionSummary(session,files),f=files.find(f=>f.id===session.ids[session.cursor]);reviewId=f?.id||null;
 $('#review-back').href=validReturnRoute(session.returnTo);$('#review-count').textContent=`${summary.reviewed} / ${summary.total} reviewed`;
 $('#review-progress').value=summary.total?summary.reviewed/summary.total*100:100;$('#review-position').textContent=f?`${session.cursor+1} / ${summary.total}`:'';
 $('#review-prev').disabled=session.cursor<=0;$('#review-next').disabled=session.cursor>=session.ids.length-1;
 $('#review-undo').disabled=!latestReviewUndo();
 if(!f){
  $('#review-content').innerHTML=`<div class="review-complete"><span>${icon('check')}</span><h2>${summary.deferred||summary.remaining?'Saved for later':'All reviewed'}</h2><p>${summary.reviewed} reviewed${summary.deferred?` · ${summary.deferred} deferred`:''}${summary.remaining?` · ${summary.remaining} remaining`:''}</p><div class="dialog-actions"><a href="#explore" class="primary-button">Back to your project ↗</a><a href="${esc(validReturnRoute(session.returnTo))}" class="secondary-button">Done ✓</a>${summary.deferred||summary.remaining?'<button id="review-again" class="text-button">Continue reviewing →</button>':''}</div></div>`;
  if($('#review-again'))$('#review-again').onclick=()=>{const ids=session.ids.filter(id=>files.some(f=>f.id===id&&f.decision==='pending'));beginReview(ids,ids[0],session.returnTo,true);};return;
 }
 $('#review-content').innerHTML=`<div class="review-layout"><div class="review-art">${fileArt(f)}</div><div class="review-details"><div class="review-file-heading">${pill(f)}<span>${esc(f.ext)} · ${prettySize(f)}</span></div><h2>${esc(f.file)}</h2><p class="review-file-meta">${esc(f.project)} · ${esc(f.modified)}</p>${recommendation(f)}<div class="decision-actions">${buttons(f)}</div><div class="review-secondary"><button id="review-open-original" class="text-button">Open original ↗</button><button id="review-later" class="text-button">Later →</button><button id="review-star" class="text-button" aria-pressed="${state().saved.includes(f.id)}">${state().saved.includes(f.id)?'★ Memory pinned':'☆ Pin memory'}</button></div></div></div>`;
 bindDecisions($('#review-content'),f.id,true);hydrateArt($('#review-content .review-art'),f);
 $('#review-open-original').onclick=()=>openSourceFile(f.id);$('#review-later').onclick=()=>deferCurrent();$('#review-star').onclick=()=>{ws.toggleSaved(f.id);renderReview();};
}
function advanceReview(){const r=state().review;ws.setReviewCursor(nextPendingIndex(r,records(),r.cursor));renderReview();}
function deferCurrent(){const f=activeReviewFile();if(!f)return;if(f.decision==='pending')ws.deferReview(f.id);advanceReview();}
function nextReview(direction=1){const r=state().review;ws.setReviewCursor(adjacentReviewIndex(r,direction));renderReview();}
$('#review-prev').onclick=()=>nextReview(-1);$('#review-next').onclick=()=>nextReview(1);$('#review-history').onclick=openHistory;
$('#review-undo').onclick=()=>{const event=latestReviewUndo();if(event)undo(event.id);};
function chooseDecision(id,decision,advance=false){if(decision==='undecided'){openClarify(id,advance);return;}if(decision==='trash'){const f=records().find(f=>f.id===id);$('#confirm-description').innerHTML=`${esc(f.file)}<br>${badge(f)}`;confirmFn=()=>applyDecision(id,'trash',null,advance);$('#confirm-dialog').showModal();return;}applyDecision(id,decision,null,advance);}
function applyDecision(id,decision,clarification=null,advance=false){
 const event=ws.decide([id],decision,clarification);
 if(event)notify(`${decision==='keep'?'Kept':decision==='archive'?'Archived':'Moved to Trash'}`,event);
 if(advance){advanceReview();}else refreshCurrent();
 if($('#preview-dialog').open)updatePreview();
}
$('#confirm-action').onclick=()=>{$('#confirm-dialog').close();const action=confirmFn;confirmFn=null;action?.();};
let clarifyAdvance=false;
function openClarify(id,advance){clarifyId=id;clarifyAdvance=advance;clarifyChoice=null;const f=records().find(f=>f.id===id);$('#clarify-name').textContent=f.file;$('#clarify-dialog .ai-badge').outerHTML=badge(f);$('#clarify-result').hidden=true;$$('[data-clarify]').forEach(b=>b.setAttribute('aria-pressed','false'));$('#clarify-dialog').showModal();}
$$('[data-clarify]').forEach(b=>b.onclick=()=>{clarifyChoice=b.dataset.clarify;$$('[data-clarify]').forEach(n=>n.setAttribute('aria-pressed',String(n===b)));$('#clarify-result').hidden=false;$('#clarify-result-text').textContent=`Your choice → ${BUCKETS.find(v=>v.id===clarifyChoice).label}`;$('#clarify-apply').textContent=clarifyChoice==='trash'?'Confirm & move to Trash →':'Confirm '+BUCKETS.find(v=>v.id===clarifyChoice).label+' →';});
$('#clarify-apply').onclick=()=>{if(!clarifyChoice)return;const answers={keep:'Still in progress',archive:'Worth keeping for later',trash:'No longer needed'};$('#clarify-dialog').close();applyDecision(clarifyId,clarifyChoice,{answer:answers[clarifyChoice],choice:clarifyChoice},clarifyAdvance);};
$('#clarify-later').onclick=()=>{$('#clarify-dialog').close();notify('Decision deferred. Your progress is saved.');if(clarifyAdvance)deferCurrent();};
function openPreview(id){previewId=id;ws.touchRecent(id);updatePreview();$('#preview-dialog').showModal();}
function updatePreview(){const f=records().find(f=>f.id===previewId);if(!f)return;$('#preview-art').innerHTML=fileArt(f);hydrateArt($('#preview-art'),f);$('#preview-title').textContent=f.file;$('#preview-app').textContent=f.app+(f.source==='demo'?' · Demo preview':'');$('#preview-meta').textContent=`${f.project} · ${prettySize(f)} · ${f.modified}`;$('#preview-recommendation').innerHTML=pill(f)+recommendation(f);$('#preview-decisions').innerHTML=buttons(f);bindDecisions($('#preview-decisions'),f.id,false);$('#preview-save').textContent=state().saved.includes(f.id)?'Saved ★':'Save ☆';$('#preview-save').setAttribute('aria-pressed',state().saved.includes(f.id));let undoButton=$('#preview-undo');if(!undoButton){undoButton=document.createElement('button');undoButton.id='preview-undo';undoButton.className='text-button';$('#preview-save').after(undoButton);}const event=state().history.find(e=>e.fileIds.includes(f.id)&&ws.canUndo(e.id));undoButton.hidden=!event;undoButton.textContent='↶ Undo';undoButton.onclick=()=>event&&undo(event.id);}
$('#preview-close').onclick=()=>$('#preview-dialog').close();$('#preview-save').onclick=()=>{ws.toggleSaved(previewId);updatePreview();};$('#preview-similar').onclick=()=>{const f=records().find(f=>f.id===previewId);$('#preview-dialog').close();navigate({type:f.type});};
const activityUI=createActivity({getState:()=>{const s=state(),files=currentFiles(),ids=new Set(files.map(f=>f.id));return {...s,files,history:s.history.filter(e=>e.fileIds.some(id=>ids.has(id)))};},canUndo:id=>ws.canUndo(id),onPreview:openPreview,onUndo:undo,thumb,badge,escapeHtml:esc});
function renderActivity(){activityUI.render();$('#history-project').textContent=state().session.project;}
function openHistory(){if(!state().session.signedIn)return;renderActivity();$('#history-drawer').showModal();}
$('#history-toggle').onclick=openHistory;
function undo(id){
 const event=state().history.find(e=>e.id===id),result=ws.undo(id);
 if(result){if(route.page==='review'&&event){const index=state().review.ids.indexOf(event.fileIds[0]);if(index>=0)ws.setReviewCursor(index);}notify('Restored');refreshCurrent();if($('#preview-dialog').open)updatePreview();}
 else notify('Restore the latest decision first.');
}
function refreshCurrent(){syncHeader();syncContext();if(route.page==='review')renderReview();if(route.page==='quick')quickUI.render();if(route.page==='browse')exploreUI.render();if(['home','explore'].includes(route.page))renderHome();if($('#history-drawer').open)renderActivity();}
function batchDecision(ids,decision){
 const allowed=new Set(currentFiles().map(f=>f.id)),valid=[...new Set(ids)].filter(id=>allowed.has(id));if(!valid.length)return;
 if(decision==='undecided'){openClarify(valid[0],false);return;}
 const apply=()=>{const event=ws.decide(valid,decision);if(event){notify(`${event.fileIds.length} ${event.fileIds.length===1?'file':'files'} ${decision==='trash'?'moved to Trash':decision==='keep'?'kept':'archived'}`,event);quickUI.clearSelection();refreshCurrent();}};
 if(decision==='trash'){$('#confirm-description').textContent=`${valid.length} ${valid.length===1?'file':'files'} · ${prettySize({size:currentFiles().filter(f=>valid.includes(f.id)).reduce((sum,f)=>sum+f.size,0)})}`;confirmFn=apply;$('#confirm-dialog').showModal();}else apply();
}
async function openSourceFile(id){const f=records().find(f=>f.id===id);if(!f)return;if(f.source==='demo'){notify('Demo preview only. Add an original file to open it.');return;}const result=await openOriginal(id,f);if(!result.ok){originalRepairId=id;notify('Select the original file to reconnect it.');$('#file-input').click();}else if(result.kind==='download')notify(`Downloaded — open with ${f.app}.`);}
const quickUI=createQuickMode({root:$('#quick-view'),getFiles:currentFiles,getState:state,thumb,badge,fileArt,hydrateArt,prettySize,escapeHtml:esc,onDecide:batchDecision});
const exploreUI=createExploreMode({root:$('#browse-view'),getFiles:currentFiles,getState:state,thumb,badge,fileArt,hydrateArt,prettySize,escapeHtml:esc,onDecide:batchDecision,onReview:(ids,focus,filters)=>beginReview(ids,focus,hash({...route,...filters})),onOpenFile:openSourceFile,onBack:()=>navigate({page:'explore'}),onSave:id=>{ws.toggleSaved(id);refreshCurrent();}});
$('#toast-undo').onclick=()=>undo(toastEvent);$('#toast-close').onclick=()=>$('#toast').hidden=true;
$('#account-button').onclick=()=>{if(!state().session.signedIn)return openLogin({page:'home'});const p=state().session;$('#account-name').textContent=p.name;$('#account-email').textContent=p.email||'Prototype workspace';$('#account-avatar').textContent=$('#header-avatar').textContent;$('#display-name').value=p.name;$('#account-sort').value=p.sort;$('#account-autoplay').checked=p.autoplay;$('#account-save-status').textContent='';$('#account-panel').showModal();};$('#account-close').onclick=()=>$('#account-panel').close();$('#account-form').onsubmit=e=>{e.preventDefault();const name=$('#display-name').value.trim();if(!name)return;ws.updateProfile({name,sort:$('#account-sort').value,autoplay:$('#account-autoplay').checked});sort=state().session.sort;carousel.setAutoplay(state().session.autoplay);$('#account-name').textContent=name;$('#account-save-status').textContent='Saved';refreshCurrent();};$('#logout-button').onclick=()=>{closeDialogs();ws.logout();navigate({page:'home'});$('#toast').hidden=true;};
$('#assistant-button').onclick=()=>{if(!guard(modeHome()))return;$('#assistant-panel').showModal();};$('#assistant-close').onclick=()=>$('#assistant-panel').close();$('#assistant-form').onsubmit=e=>{e.preventDefault();navigate({page:'browse',q:$('#assistant-query').value.trim()});};$$('[data-assistant-query]').forEach(b=>b.onclick=()=>navigate({page:'browse',q:b.dataset.assistantQuery}));$$('[data-assistant-view]').forEach(b=>b.onclick=()=>navigate({page:'browse',view:b.dataset.assistantView}));
$$('[data-close]').forEach(b=>b.onclick=()=>$('#'+b.dataset.close).close());for(const d of $$('dialog'))d.addEventListener('click',e=>{if(e.target!==d)return;const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();});document.addEventListener('keydown',e=>{if(!['import','analysis','review'].includes(route.page)&&(e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'&&state().session.signedIn&&records().length){e.preventDefault();closeDialogs();navigate({});setTimeout(()=>$('#browse-view input[type=search]')?.focus(),0);}});
document.addEventListener('keydown',e=>{if(route.page!=='review'||$('dialog[open]')||/INPUT|TEXTAREA|SELECT/.test(e.target.tagName))return;if(e.key==='ArrowLeft'&&!$('#review-prev').disabled){e.preventDefault();nextReview(-1);}if(e.key==='ArrowRight'&&!$('#review-next').disabled){e.preventDefault();nextReview(1);}});
syncHeader();renderRoute();
