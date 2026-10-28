import {FILES, TYPES} from './data.js';

// The prototype stores a catalog, never modifies source files on disk.
const KEY = 'fileo-workspace-v2';
const BUCKETS = new Set(['keep', 'archive', 'trash', 'undecided']);
const DECISIONS = new Set(['pending', 'keep', 'archive', 'trash']);
const SORTS = new Set(['modified', 'name', 'size']);
const MODES = new Set(['quick', 'explore']);
const DEMO_PROJECT = 'Studio semester';
const LEGACY_DEMO_IMAGES = Object.freeze({'landscape.png':'landscape.webp','chair.png':'chair.webp','sculpture.png':'sculpture.webp'});
const PROVIDERS = new Set(['email', 'google', 'demo']);
const PREVIEW_STATUSES = new Set(['ready', 'unsupported', 'unreadable', 'not-image']);
const DAY = 86400000;
const clone = value => JSON.parse(JSON.stringify(value));
const cleanText = (value, limit = 300) => typeof value === 'string' ? value.trim().slice(0, limit) : '';
const validEmail = value => typeof value === 'string' && value.trim().length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) ? value.trim().toLowerCase() : '';
const returnRoute = value => typeof value === 'string' && value.length <= 2048 && /^#(?:files|projects|dashboard|activity|quick|explore|browse)?(?:\?[^<>]*)?$/.test(value) ? value : '#files';
const freshReview = () => ({ids:[],cursor:0,returnTo:'#files',deferred:[]});
const fresh = () => ({version:2, session:{signedIn:false,name:'Designer',email:'',provider:'demo',authMode:'prototype',sort:'modified',autoplay:true,mode:'quick',project:''},files:[],history:[],analysis:{status:'idle',step:0,ids:[]},review:freshReview(),resumeId:null,saved:[],recent:[],storageError:false});
const snapshot = file => ({id:file.id,decision:file.decision,clarification:clone(file.clarification),revision:file.revision});
const sameResult = (a,b) => !!a&&!!b&&a.decision===b.decision&&JSON.stringify(a.clarification??null)===JSON.stringify(b.clarification??null);
const sampleReasons = {
 keep:'Active project work. Keep it within reach.',
 archive:'Completed work with future value. Keep it for another day.',
 trash:'A possible duplicate. Check it before moving it to Trash.',
 undecided:'The next step needs your context. Is this work still useful?'
};
function safeClarification(value) {
 if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
 try {const text=JSON.stringify(value);return text.length<=4000?JSON.parse(text):null;} catch {return null;}
}
function previewFields(raw) {
 const result={};
 if(typeof raw.previewData==='string'&&raw.previewData.length<=600000&&/^data:image\/(?:png|jpeg|webp|gif);base64,/.test(raw.previewData))result.previewData=raw.previewData;
 const key=cleanText(raw.previewKey,500);if(key)result.previewKey=key;
 if(PREVIEW_STATUSES.has(raw.previewStatus))result.previewStatus=raw.previewStatus;
 const error=cleanText(raw.previewError,300);if(error)result.previewError=error;
 for(const dimension of ['width','height'])if(Number.isSafeInteger(raw[dimension])&&raw[dimension]>0&&raw[dimension]<=1000000)result[dimension]=raw[dimension];
 if(typeof raw.previewVolatile==='boolean')result.previewVolatile=raw.previewVolatile;
 return result;
}
function restoreState(raw) {
 const state=fresh();
 if (!raw || raw.version!==2 || !Array.isArray(raw.files)) return state;
 const session=raw.session||{};
 state.session={signedIn:session.signedIn===true,name:cleanText(session.name,40)||'Designer',email:validEmail(session.email),provider:PROVIDERS.has(session.provider)?session.provider:'demo',authMode:'prototype',sort:SORTS.has(session.sort)?session.sort:'modified',autoplay:session.autoplay!==false,mode:MODES.has(session.mode)?session.mode:'quick',project:cleanText(session.project,300)};
 const seen=new Set();
 for (const f of raw.files) {
  if (!f || typeof f.id!=='string' || seen.has(f.id) || typeof f.file!=='string' || !BUCKETS.has(f.bucket) || !Number.isFinite(f.size) || f.size<0) continue;
  const record={...f,project:cleanText(f.project,300)||'Imported files',decision:DECISIONS.has(f.decision)?f.decision:'pending',clarification:safeClarification(f.clarification),revision:Number.isSafeInteger(f.revision)&&f.revision>=0?f.revision:0,source:f.source==='demo'?'demo':'local'};
  if (record.source==='local') delete record.image;
  if (record.source==='demo') {
   record.reason=sampleReasons[record.bucket];
   if(Object.hasOwn(LEGACY_DEMO_IMAGES,record.image))record.image=LEGACY_DEMO_IMAGES[record.image];
  }
  for(const field of ['previewData','previewKey','previewStatus','previewError','previewVolatile','width','height'])delete record[field];
  Object.assign(record,previewFields(f));
  seen.add(f.id);state.files.push(record);
 }
 state.session.project=state.files.some(f=>f.project===state.session.project)?state.session.project:(state.files[0]?.project||'');
 const validIds=values=>Array.isArray(values)?[...new Set(values.filter(id=>seen.has(id)))]:[];
 state.saved=validIds(raw.saved);state.recent=validIds(raw.recent).slice(0,50);
 state.resumeId=seen.has(raw.resumeId)?raw.resumeId:null;
 const review=raw.review||{},reviewIds=validIds(review.ids),selectedId=Array.isArray(review.ids)?review.ids[review.cursor]:null;
 const selectedIndex=reviewIds.indexOf(selectedId),reviewCursor=selectedIndex>=0?selectedIndex:Number.isInteger(review.cursor)?Math.max(0,Math.min(reviewIds.length,review.cursor)):0;
 state.review={ids:reviewIds,cursor:reviewCursor,returnTo:returnRoute(review.returnTo),deferred:validIds(review.deferred).filter(id=>reviewIds.includes(id))};
 const analysis=raw.analysis||{};
 state.analysis={status:['idle','pending','done'].includes(analysis.status)?analysis.status:'idle',step:Number.isInteger(analysis.step)?Math.max(0,Math.min(3,analysis.step)):0,ids:validIds(analysis.ids)};
 state.history=Array.isArray(raw.history)?raw.history.filter(e=>e&&typeof e.id==='string'&&typeof e.action==='string'&&Array.isArray(e.fileIds)&&e.fileIds.every(id=>seen.has(id))&&Array.isArray(e.before)&&e.before.every(b=>b&&seen.has(b.id)&&DECISIONS.has(b.decision))&&e.afterRevision&&typeof e.afterRevision==='object').map(e=>({...e,undone:e.undone===true})):[];
 // Migrate early prototype histories by recovering their result at the recorded revision.
 for(const event of state.history){
  event.after=event.fileIds.map(id=>{
   const stored=Array.isArray(event.after)?event.after.find(a=>a?.id===id&&DECISIONS.has(a.decision)):null;
   const revision=event.afterRevision[id],file=state.files.find(f=>f.id===id);
   const recovered=stored||state.history.flatMap(e=>e.before).find(b=>b.id===id&&b.revision===revision)||(file?.revision===revision?file:null);
   return recovered?{id,decision:recovered.decision,clarification:safeClarification(recovered.clarification),revision:recovered.revision}:null;
  }).filter(Boolean);
 }
 return state;
}
function metadataRecommendation(descriptor, clock) {
 const name=descriptor.name.toLowerCase(),modified=descriptor.lastModified;
 if (/(?:^|[\s_.()\-])(copy|backup|duplicate)(?:[\s_.()\-\d]|$)/i.test(name)) return {bucket:'trash',reason:'The filename suggests a copy or backup. Contents were not compared; verify before deleting.',duplicate:'possible-copy'};
 if (/(?:^|[\s_.()\-])(archive|archived|old)(?:[\s_.()\-\d]|$)/i.test(name)) return {bucket:'archive',reason:'The filename suggests older or archived work. Keep it available for later.',duplicate:''};
 if (modified>0 && clock-modified>180*DAY && /(?:^|[\s_.()\-])(final|completed)(?:[\s_.()\-\d]|$)/i.test(name)) return {bucket:'archive',reason:'The filename suggests finished work, last modified over six months ago. Confirm it is no longer active.',duplicate:''};
 if (modified>0 && clock-modified>=0 && clock-modified<=90*DAY) return {bucket:'keep',reason:'Modified within the last 90 days. Recent activity suggests this may still be useful.',duplicate:''};
 return {bucket:'undecided',reason:'File metadata alone does not tell us whether this is still useful. Add your context.',duplicate:''};
}

export function createWorkspace(options={}) {
 let storage;
 try {storage=Object.hasOwn(options,'storage')?options.storage:globalThis.localStorage;} catch {storage=null;}
 const now=typeof options.now==='function'?options.now:()=>Date.now();
 let state=fresh(),serial=0;
 const listeners=new Set();
 try {const raw=storage?.getItem(KEY);if(raw)state=restoreState(JSON.parse(raw));} catch {state.storageError=true;}
 const timestamp=()=>{const n=Number(now());return Number.isFinite(n)?n:Date.now();};
 const uid=prefix=>`${prefix}-${timestamp().toString(36)}-${globalThis.crypto?.randomUUID?.()||(++serial).toString(36)+'-'+Math.random().toString(36).slice(2,9)}`;
 const getState=()=>clone(state);
 const emit=()=>{for(const fn of listeners){try{fn(getState());}catch(error){console.error('FILEO workspace listener failed',error);}}};
 function persist() {
  state.storageError=false;
  try {if(!storage?.setItem)throw new Error('Storage unavailable');storage.setItem(KEY,JSON.stringify(state));} catch {state.storageError=true;}
  emit();
 }
 function addRecords(records, skipped) {
  if(!records.length)return {added:0,skipped,ids:[]};
  state.files.push(...records);
  if(!state.files.some(f=>f.project===state.session.project))state.session.project=records[0].project;
  const ids=records.map(f=>f.id);
  state.analysis={status:'pending',step:0,ids:[...new Set([...(state.analysis.status==='pending'?state.analysis.ids:[]),...ids])]};
  if(!state.resumeId)state.resumeId=ids[0];
  persist();return {added:ids.length,skipped,ids};
 }
 function latestActiveEvent(id){return state.history.find(e=>e.action!=='restore'&&!e.undone&&e.fileIds.includes(id));}
 function canUndo(eventId) {
  const event=state.history.find(e=>e.id===eventId);
  return !!event&&event.action!=='restore'&&!event.undone&&event.fileIds.length>0&&event.fileIds.every(id=>{
   const file=state.files.find(f=>f.id===id),after=event.after?.find(a=>a.id===id);
   return file&&latestActiveEvent(id)?.id===event.id&&file.revision===event.afterRevision[id]&&sameResult(file,after)&&event.before.some(b=>b.id===id);
  });
 }
 function chooseNext() {
  if(!state.files.some(f=>f.id===state.resumeId&&f.decision==='pending'))state.resumeId=state.files.find(f=>f.decision==='pending')?.id||null;
 }
 return {
  getState,
  subscribe(fn){if(typeof fn!=='function')return ()=>{};listeners.add(fn);return ()=>listeners.delete(fn);},
  login(identity){
   if(typeof identity==='string'){
    const name=cleanText(identity,40);if(!name)return false;
    state.session={...state.session,signedIn:true,name,authMode:'prototype'};
   }else{
    if(!identity||typeof identity!=='object'||!PROVIDERS.has(identity.provider))return false;
    const email=validEmail(identity.email);if(!email)return false;
    const name=cleanText(identity.name,40)||email.split('@')[0].replace(/[._-]+/g,' ').slice(0,40)||'Designer';
    state.session={...state.session,signedIn:true,name,email,provider:identity.provider,authMode:'prototype'};
   }
   persist();return true;
  },
  logout(){state.session.signedIn=false;persist();},
  updateProfile(patch={}){
   if(cleanText(patch.name,40))state.session.name=cleanText(patch.name,40);
   if(SORTS.has(patch.sort))state.session.sort=patch.sort;
   if(typeof patch.autoplay==='boolean')state.session.autoplay=patch.autoplay;
   if(MODES.has(patch.mode))state.session.mode=patch.mode;
   const project=cleanText(patch.project,300);
   if(project&&state.files.some(f=>f.project===project))state.session.project=project;
   persist();
  },
  setProject(value){
   const project=cleanText(value,300);
   if(!project||!state.files.some(f=>f.project===project))return false;
   state.session.project=project;persist();return true;
  },
  loadDemo(){
   const existing=new Set(state.files.filter(f=>f.source==='demo').map(f=>f.id));
   for(const file of state.files.filter(f=>f.source==='demo')){file.collection=file.collection||file.project;file.project=DEMO_PROJECT;}
   state.session.project=DEMO_PROJECT;
   const records=FILES.filter(f=>!existing.has(f.id)).map(f=>({...clone(f),collection:f.project,project:DEMO_PROJECT,decision:'pending',clarification:null,revision:0,source:'demo',reason:sampleReasons[f.bucket],importedAt:timestamp()}));
   const result=addRecords(records,FILES.length-records.length);
   if(!records.length)persist();
   return result;
  },
  importFiles(descriptors,{project:requestedProject}={}){
   if(!Array.isArray(descriptors))return {added:0,skipped:0,ids:[],repaired:0,repairedIds:[]};
   const selectedProject=cleanText(requestedProject,300);
   const known=new Map(state.files.filter(f=>f.fingerprint).map(f=>[JSON.stringify([f.project,f.fingerprint]),f])),records=[],repairedIds=new Set();let skipped=0;
   for(const raw of descriptors){
    const name=cleanText(raw?.name,512),bytes=Number(raw?.size);
    if(!name||!Number.isFinite(bytes)||bytes<0){skipped++;continue;}
    const path=cleanText(raw.relativePath,2000)||name,modified=Number.isFinite(Number(raw.lastModified))&&Number(raw.lastModified)>0&&Number(raw.lastModified)<=8640000000000000?Number(raw.lastModified):0;
    const relativeParts=path.split('/').filter(Boolean),project=selectedProject||(relativeParts.length>1?relativeParts[0]:'Imported files');
    const fingerprint=JSON.stringify([path,bytes,modified]),projectFingerprint=JSON.stringify([project,fingerprint]);
    if(known.has(projectFingerprint)){
     skipped++;const existing=known.get(projectFingerprint),patch=previewFields(raw);
     // Re-selecting an older import upgrades its preview, never its AI label or decision.
     // A failed retry must not replace an already usable thumbnail.
     if(Object.keys(patch).length&&!(existing.previewData&&!patch.previewData&&patch.previewStatus!=='ready')){
      const before=JSON.stringify(previewFields(existing));
      Object.assign(existing,patch);
      if(patch.previewStatus==='ready')delete existing.previewError;
      if(before!==JSON.stringify(previewFields(existing)))repairedIds.add(existing.id);
     }
     continue;
    }
    const extension=name.includes('.')?name.slice(name.lastIndexOf('.')).toLowerCase():'',type=TYPES.find(t=>t.ext===extension),clock=timestamp(),recommendation=metadataRecommendation({name,lastModified:modified},clock);
    const imageMime=/^image\//.test(raw.type||'')||/\.(?:jpe?g|png|webp|gif|avif|bmp|svg|tiff?|heic|heif)$/i.test(name);
    const record={id:uid('local'),file:name,name:name.replace(/\.[^.]+$/,'').replaceAll('_',' '),ext:extension||'file',type:type?.id||extension.slice(1)||'other',kind:type?.kind||'generic',app:type?.app||(imageMime?'Image':extension==='.pdf'?'PDF document':'File'),category:type?.category||(imageMime?'Images':'Documents'),tags:`${extension.slice(1)} ${imageMime?'image photo picture':''}`,project,modified:new Date(modified||clock).toISOString().slice(0,10),lastModified:modified,size:bytes/1000000,bytes,status:'work',forgotten:modified>0&&clock-modified>180*DAY,...recommendation,decision:'pending',clarification:null,revision:0,source:'local',path,fingerprint,importedAt:clock};
    Object.assign(record,previewFields(raw));
    known.set(projectFingerprint,record);
    records.push(record);
   }
   if(selectedProject&&(records.length||state.files.some(f=>f.project===selectedProject)))state.session.project=selectedProject;
   const result=addRecords(records,skipped);
   if(!records.length&&(repairedIds.size||selectedProject))persist();
   return {...result,repaired:repairedIds.size,repairedIds:[...repairedIds]};
  },
  setAnalysisStep(step){if(state.analysis.status!=='pending')return;state.analysis.step=Math.max(0,Math.min(3,Number.isFinite(Number(step))?Math.floor(Number(step)):0));persist();},
  finishAnalysis(){if(state.analysis.status==='idle')return;state.analysis.status='done';state.analysis.step=3;chooseNext();persist();},
  decide(ids,decision,clarification=null){
   if(!DECISIONS.has(decision))return null;
   const idSet=new Set(Array.isArray(ids)?ids:[ids]),context=safeClarification(clarification);
   const files=state.files.filter(f=>idSet.has(f.id)&&(f.decision!==decision||JSON.stringify(f.clarification)!==JSON.stringify(context)));
   if(!files.length)return null;
   const event={id:uid('event'),at:timestamp(),fileIds:files.map(f=>f.id),action:context?'clarify':decision,before:files.map(snapshot),afterRevision:{},undone:false};
   for(const file of files){file.decision=decision;file.clarification=context?clone(context):null;file.revision++;file.updatedAt=event.at;event.afterRevision[file.id]=file.revision;}
   event.after=files.map(snapshot);
   state.history.unshift(event);chooseNext();persist();return clone(event);
  },
  canUndo,
  undo(eventId){
   if(!canUndo(eventId))return null;
   const event=state.history.find(e=>e.id===eventId),files=event.fileIds.map(id=>state.files.find(f=>f.id===id));
   const restore={id:uid('event'),at:timestamp(),fileIds:[...event.fileIds],action:'restore',sourceEventId:event.id,before:files.map(snapshot),afterRevision:{},undone:false};
   for(const file of files){const previous=event.before.find(b=>b.id===file.id);file.decision=previous.decision;file.clarification=safeClarification(previous.clarification);file.revision++;file.updatedAt=restore.at;restore.afterRevision[file.id]=file.revision;}
   restore.after=files.map(snapshot);event.undone=true;state.history.unshift(restore);
   // Rebase only the immediately preceding active action onto the restored revision.
   // Its original result snapshot remains immutable for the activity timeline.
   for(const file of files){const previous=latestActiveEvent(file.id);if(previous&&sameResult(file,previous.after?.find(a=>a.id===file.id)))previous.afterRevision[file.id]=file.revision;}
   chooseNext();persist();return clone(restore);
  },
  setResume(id){if(id===null||state.files.some(f=>f.id===id)){state.resumeId=id;persist();}},
  startReview(ids,{focusId=null,returnTo='#files'}={}){
   const valid=new Set(state.files.map(f=>f.id)),ordered=Array.isArray(ids)?[...new Set(ids.filter(id=>valid.has(id)))]:[];
   const cursor=Math.max(0,ordered.indexOf(focusId));
   state.review={ids:ordered,cursor,returnTo:returnRoute(returnTo),deferred:[]};
   const target=state.files.find(f=>f.id===ordered[cursor]);
   if(target?.decision==='pending')state.resumeId=target.id;
   persist();return clone(state.review);
  },
  setReviewCursor(index){
   if(!Number.isInteger(index))return false;
   state.review.cursor=Math.max(0,Math.min(state.review.ids.length,index));
   const target=state.files.find(f=>f.id===state.review.ids[state.review.cursor]);
   // Completed/previous cards do not replace the pending-file resume pointer.
   if(target?.decision==='pending')state.resumeId=target.id;
   persist();return true;
  },
  deferReview(id){if(!state.review.ids.includes(id)||state.review.deferred.includes(id))return false;state.review.deferred.push(id);persist();return true;},
  resetReviewDeferrals(){state.review.deferred=[];persist();},
  toggleSaved(id){if(!state.files.some(f=>f.id===id))return;state.saved=state.saved.includes(id)?state.saved.filter(v=>v!==id):[id,...state.saved];persist();},
  touchRecent(id){if(!state.files.some(f=>f.id===id))return;state.recent=[id,...state.recent.filter(v=>v!==id)].slice(0,50);persist();}
 };
}
