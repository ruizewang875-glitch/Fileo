import {FILES, typeForExtension} from './data.js';
import {assessRecommendation,normalizeSuggestionFeedback,PREFERENCE_PRESETS} from './recommendation.js';
import {PRIVACY_VERSION,freshPrivacy,normalizePrivacy,isReadingAllowed} from './privacy.js';
import {isActiveFile,isExpiredTrash} from './file-lifecycle.js';

// The prototype stores a catalog, never modifies source files on disk.
const KEY = 'fileo-workspace-v2';
const BUCKETS = new Set(['keep', 'archive', 'trash', 'undecided']);
const DECISIONS = new Set(['pending', 'keep', 'archive', 'trash']);
const SORTS = new Set(['modified', 'name', 'size']);
const MODES = new Set(['quick', 'explore']);
const DEMO_PROJECT = 'Studio semester';
const DEMO_FILES = new Map(FILES.map(f=>[f.id,f]));
const LEGACY_DEMO_IMAGES = Object.freeze({'landscape.png':'landscape.webp','chair.png':'chair.webp','sculpture.png':'sculpture.webp'});
const PROVIDERS = new Set(['email', 'google', 'demo']);
const PREVIEW_STATUSES = new Set(['ready', 'unsupported', 'unreadable', 'not-image']);
const DAY = 86400000;
const clone = value => JSON.parse(JSON.stringify(value));
const cleanText = (value, limit = 300) => typeof value === 'string' ? value.trim().slice(0, limit) : '';
// Store tags independently from files so a new project's goals can be set before importing.
export function normalizePreferenceTags(values) {
 if (!Array.isArray(values)) return [];
 const tags=[],seen=new Set();
 for(const value of values){
  if(typeof value!=='string')continue;
  const clean=Array.from(value.normalize('NFKC').replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/gu,' ').trim()).slice(0,48).join('').trim();
  const key=clean.toLowerCase();if(!key||seen.has(key))continue;
  seen.add(key);tags.push(PREFERENCE_PRESETS.find(tag=>tag.toLowerCase()===key)||clean);
  if(tags.length===12)break;
 }
 return tags;
}
const validEmail = value => typeof value === 'string' && value.trim().length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) ? value.trim().toLowerCase() : '';
const returnRoute = value => typeof value === 'string' && value.length <= 2048 && /^#(?:files|projects|dashboard|activity|quick|explore|browse)?(?:\?[^<>]*)?$/.test(value) ? value : '#files';
const freshReview = () => ({ids:[],cursor:0,returnTo:'#files',deferred:[]});
const fresh = () => ({version:2, session:{signedIn:false,name:'Designer',email:'',provider:'demo',authMode:'prototype',sort:'modified',autoplay:true,mode:'quick',project:''},privacy:freshPrivacy(),projectPreferences:Object.create(null),files:[],history:[],purgedDemoIds:[],pendingPurgedFiles:[],analysis:{status:'idle',step:0,ids:[]},review:freshReview(),resumeId:null,saved:[],recent:[],storageError:false});
const snapshot = file => ({id:file.id,decision:file.decision,clarification:clone(file.clarification),revision:file.revision,archivedAt:file.archivedAt??null,trashedAt:file.trashedAt??null});
const validActionTime = value => Number.isFinite(value)&&value>=0;
function applyLifecycle(file,decision,clock,previous=null){
 delete file.archivedAt;delete file.trashedAt;
 if(decision==='archive')file.archivedAt=validActionTime(previous?.archivedAt)?previous.archivedAt:clock;
 if(decision==='trash')file.trashedAt=validActionTime(previous?.trashedAt)?previous.trashedAt:clock;
}
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
function recommendationBaseline(file) {
 const baseBucket=BUCKETS.has(file.baseBucket)?file.baseBucket:file.bucket;
 return {baseBucket,baseReason:cleanText(file.baseReason,4000)||cleanText(file.reason,4000)||sampleReasons[baseBucket]};
}
function makeDemoRecord(sample,now){
 const baseReason=sampleReasons[sample.bucket];
 return {...clone(sample),collection:sample.project,project:DEMO_PROJECT,decision:'pending',clarification:null,revision:0,source:'demo',baseBucket:sample.bucket,baseReason,reason:baseReason,importedAt:now};
}
function refreshRecommendations(state,clock,projects=null){
 const groups=new Map();
 for(const file of state.files){
  if(projects&&!projects.has(file.project))continue;
  if(!groups.has(file.project))groups.set(file.project,[]);
  groups.get(file.project).push(file);
 }
 for(const [project,files] of groups){
  const tags=state.projectPreferences[project]||[];
  const results=files.map(file=>{
   // File metadata remains available for browsing, but AI rules run only with consent.
   if(file.source==='local'&&isReadingAllowed(file,state.privacy)){
    const baseline=metadataRecommendation({name:file.file,lastModified:file.lastModified},clock);
    file.baseBucket=baseline.bucket;file.baseReason=baseline.reason;
   }
   return assessRecommendation(file,{files,tags,now:clock,privacy:state.privacy});
  });
  files.forEach((file,i)=>{const result=results[i];file.bucket=result.bucket;file.reason=result.reason;file.reasonTags=[...result.tags];file.reasonSignals=result.reasonSignals.map(signal=>({...signal}));file.readAccess=result.readAccess;});
 }
}
function restoreState(raw,clock) {
 const state=fresh();
 if (!raw || raw.version!==2 || !Array.isArray(raw.files)) return state;
 state.privacy=normalizePrivacy(raw.privacy);
 state.purgedDemoIds=Array.isArray(raw.purgedDemoIds)?[...new Set(raw.purgedDemoIds.filter(id=>DEMO_FILES.has(id)))]:[];
 const purgedDemoIds=new Set(state.purgedDemoIds);
 state.pendingPurgedFiles=Array.isArray(raw.pendingPurgedFiles)?[...new Map(raw.pendingPurgedFiles.filter(file=>file&&typeof file.id==='string').map(file=>[file.id,{id:file.id,...(cleanText(file.previewKey,500)?{previewKey:cleanText(file.previewKey,500)}:{})}])).values()]:[];
 const session=raw.session||{};
 state.session={signedIn:session.signedIn===true,name:cleanText(session.name,40)||'Designer',email:validEmail(session.email),provider:PROVIDERS.has(session.provider)?session.provider:'demo',authMode:'prototype',sort:SORTS.has(session.sort)?session.sort:'modified',autoplay:session.autoplay!==false,mode:MODES.has(session.mode)?session.mode:'quick',project:cleanText(session.project,300)};
 if(raw.projectPreferences&&typeof raw.projectPreferences==='object'&&!Array.isArray(raw.projectPreferences)){
  for(const [name,values] of Object.entries(raw.projectPreferences)){
   const project=cleanText(name,300),tags=normalizePreferenceTags(values);
   if(project&&tags.length)state.projectPreferences[project]=tags;
  }
 }
 const seen=new Set(),upgradedCodeIds=new Set();
 for (const f of raw.files) {
  if (!f || typeof f.id!=='string' || purgedDemoIds.has(f.id) || seen.has(f.id) || typeof f.file!=='string' || !BUCKETS.has(f.bucket) || !Number.isFinite(f.size) || f.size<0) continue;
  const record={...f,project:cleanText(f.project,300)||'Imported files',decision:DECISIONS.has(f.decision)?f.decision:'pending',clarification:safeClarification(f.clarification),revision:Number.isSafeInteger(f.revision)&&f.revision>=0?f.revision:0,source:f.source==='demo'?'demo':'local'};
  const feedback=normalizeSuggestionFeedback(f.suggestionFeedback,clock);
  delete record.suggestionFeedback;if(feedback)record.suggestionFeedback=feedback;
  if(record.source==='local'){
   delete record.image;
   const type=typeForExtension(record.ext);
   if(type){record.type=type.id;record.kind=type.kind;record.app=type.app;record.category=type.category;}
   Object.assign(record,recommendationBaseline(record));
  }else{
   const sample=DEMO_FILES.get(record.id);
   if(sample){
    // Refresh authored metadata and preview references, never review or action state.
    const wasDemoTXL=sample.type==='jsonl'&&record.type==='txl'&&record.file==='rename_rules.txl';
    if(wasDemoTXL)upgradedCodeIds.add(record.id);
    const project=record.project===sample.project||(wasDemoTXL&&record.project==='Studio tools')?DEMO_PROJECT:record.project;
    Object.assign(record,sample,{project,collection:sample.project,baseBucket:sample.bucket,baseReason:sampleReasons[sample.bucket]});
   }else Object.assign(record,recommendationBaseline(record));
   if(Object.hasOwn(LEGACY_DEMO_IMAGES,record.image))record.image=LEGACY_DEMO_IMAGES[record.image];
  }
  for(const field of ['previewData','previewKey','previewStatus','previewError','previewVolatile','width','height'])delete record[field];
  Object.assign(record,previewFields(record.source==='demo'&&DEMO_FILES.has(record.id)?DEMO_FILES.get(record.id):f));
  seen.add(f.id);state.files.push(record);
 }
 state.session.project=state.files.some(f=>f.project===state.session.project)?state.session.project:(state.files[0]?.project||'');
 const validIds=values=>Array.isArray(values)?[...new Set(values.filter(id=>seen.has(id)))]:[];
 state.saved=validIds(raw.saved);state.recent=validIds(raw.recent).slice(0,50);
 state.resumeId=seen.has(raw.resumeId)?raw.resumeId:null;
 const review=raw.review||{},reviewIds=validIds(review.ids),selectedId=Array.isArray(review.ids)?review.ids[review.cursor]:null;
 const selectedIndex=reviewIds.indexOf(selectedId),reviewCursor=selectedIndex>=0?selectedIndex:Number.isInteger(review.cursor)?Math.max(0,Math.min(reviewIds.length,review.cursor)):0;
 state.review={ids:reviewIds,cursor:reviewCursor,returnTo:returnRoute(review.returnTo),deferred:validIds(review.deferred).filter(id=>reviewIds.includes(id))};
 if(reviewIds.some(id=>upgradedCodeIds.has(id))){
  const [target,query='']=state.review.returnTo.split('?'),filters=new URLSearchParams(query);
  if(filters.get('type')==='txl'){filters.set('type','jsonl');state.review.returnTo=target+'?'+filters;}
 }
 const analysis=raw.analysis||{};
 state.analysis={status:['idle','pending','done'].includes(analysis.status)?analysis.status:'idle',step:Number.isInteger(analysis.step)?Math.max(0,Math.min(3,analysis.step)):0,ids:validIds(analysis.ids)};
 state.history=Array.isArray(raw.history)?raw.history.filter(e=>e&&typeof e.id==='string'&&typeof e.action==='string'&&Array.isArray(e.fileIds)&&e.fileIds.every(id=>seen.has(id))&&Array.isArray(e.before)&&e.before.every(b=>b&&seen.has(b.id)&&DECISIONS.has(b.decision))&&e.afterRevision&&typeof e.afterRevision==='object').map(e=>({...e,undone:e.undone===true})):[];
 // Migrate early prototype histories by recovering their result at the recorded revision.
 for(const event of state.history){
  event.after=event.fileIds.map(id=>{
   const stored=Array.isArray(event.after)?event.after.find(a=>a?.id===id&&DECISIONS.has(a.decision)):null;
   const revision=event.afterRevision[id],file=state.files.find(f=>f.id===id);
   const recovered=stored||state.history.flatMap(e=>e.before).find(b=>b.id===id&&b.revision===revision)||(file?.revision===revision?file:null);
   return recovered?{id,decision:recovered.decision,clarification:safeClarification(recovered.clarification),revision:recovered.revision,...(Object.hasOwn(recovered,'archivedAt')?{archivedAt:recovered.archivedAt}:{}),...(Object.hasOwn(recovered,'trashedAt')?{trashedAt:recovered.trashedAt}:{})}:null;
  }).filter(Boolean);
 }
 // Keep a stable retention clock across reloads, including pre-retention workspaces.
 const recordedTime=(id,decision,before=Infinity)=>{
  const event=state.history.find(event=>validActionTime(event.at)&&event.at<=clock&&event.at<=before&&event.after?.some(item=>item.id===id&&item.decision===decision));
  if(!event)return undefined;
  const entry=event.after.find(item=>item.id===id),stored=entry[decision==='trash'?'trashedAt':'archivedAt'];
  return validActionTime(stored)&&stored<=clock?stored:event.at;
 };
 for(const event of state.history){
  for(const entry of event.before){
   if(entry.decision==='archive'&&!validActionTime(entry.archivedAt))entry.archivedAt=recordedTime(entry.id,'archive',event.at)??clock;
   if(entry.decision==='trash'&&!validActionTime(entry.trashedAt))entry.trashedAt=recordedTime(entry.id,'trash',event.at)??clock;
  }
  for(const entry of event.after){
   if(entry.decision==='archive'&&!validActionTime(entry.archivedAt))entry.archivedAt=validActionTime(event.at)?event.at:clock;
   if(entry.decision==='trash'&&!validActionTime(entry.trashedAt))entry.trashedAt=validActionTime(event.at)?event.at:clock;
  }
 }
 for(const file of state.files){
  const field=file.decision==='archive'?'archivedAt':file.decision==='trash'?'trashedAt':null;
  const existing=field&&validActionTime(file[field])?Math.min(file[field],clock):null;
  const recovered=field?(recordedTime(file.id,file.decision)??(validActionTime(file.updatedAt)?Math.min(file.updatedAt,clock):clock)):clock;
  applyLifecycle(file,file.decision,existing??recovered);
 }
 // Extend only a previously loaded sample project. Do not attach samples to personal imports,
 // reset a paused scan, or add new files to an existing review queue.
 if(state.files.some(f=>f.source==='demo'&&f.project===DEMO_PROJECT&&DEMO_FILES.has(f.id))){
  for(const file of FILES){if(!seen.has(file.id)&&!purgedDemoIds.has(file.id))state.files.push(makeDemoRecord(file,clock));}
 }
 refreshRecommendations(state,clock);
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
 const timestamp=()=>{const n=Number(now());return Number.isFinite(n)?n:Date.now();};
 let restoredRaw=null;
 try {const raw=storage?.getItem(KEY);if(raw){restoredRaw=JSON.parse(raw);state=restoreState(restoredRaw,timestamp());}} catch {state.storageError=true;}
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
  refreshRecommendations(state,timestamp(),new Set(records.map(f=>f.project)));
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
   return file&&!isExpiredTrash(file,timestamp())&&!isExpiredTrash(event.before.find(b=>b.id===id),timestamp())&&latestActiveEvent(id)?.id===event.id&&file.revision===event.afterRevision[id]&&sameResult(file,after)&&event.before.some(b=>b.id===id);
  });
 }
 function purgeExpiredTrash(){
  const clock=timestamp(),expired=state.files.filter(file=>isExpiredTrash(file,clock));
  if(!expired.length)return [];
  const ids=new Set(expired.map(file=>file.id)),projects=new Set(expired.map(file=>file.project));
  state.pendingPurgedFiles=[...new Map([...state.pendingPurgedFiles,...expired.map(file=>({id:file.id,...(file.previewKey?{previewKey:file.previewKey}:{})}))].map(file=>[file.id,file])).values()];
  state.purgedDemoIds=[...new Set([...state.purgedDemoIds,...expired.filter(file=>file.source==='demo').map(file=>file.id)])];
  state.files=state.files.filter(file=>!ids.has(file.id));
  state.history=state.history.map(event=>({...event,fileIds:event.fileIds.filter(id=>!ids.has(id)),before:event.before.filter(file=>!ids.has(file.id)),after:(event.after||[]).filter(file=>!ids.has(file.id)),afterRevision:Object.fromEntries(Object.entries(event.afterRevision).filter(([id])=>!ids.has(id)))})).filter(event=>event.fileIds.length);
  state.saved=state.saved.filter(id=>!ids.has(id));state.recent=state.recent.filter(id=>!ids.has(id));
  state.analysis.ids=state.analysis.ids.filter(id=>!ids.has(id));
  const current=state.review.ids[state.review.cursor],position=state.review.cursor;
  state.review.ids=state.review.ids.filter(id=>!ids.has(id));state.review.deferred=state.review.deferred.filter(id=>!ids.has(id));
  state.review.cursor=state.review.ids.includes(current)?state.review.ids.indexOf(current):Math.min(position,state.review.ids.length);
  if(!state.files.some(file=>file.project===state.session.project))state.session.project=state.files[0]?.project||'';
  chooseNext();refreshRecommendations(state,clock,projects);persist();return clone(expired);
 }
 function chooseNext() {
  if(!state.files.some(f=>f.id===state.resumeId&&f.decision==='pending'))state.resumeId=state.files.find(f=>f.decision==='pending')?.id||null;
 }
 const purgedOnStart=purgeExpiredTrash();
 // Persist recovered timestamps once so legacy items do not receive a fresh deadline each visit.
 if(!purgedOnStart.length&&restoredRaw&&JSON.stringify(restoredRaw)!==JSON.stringify(state))persist();
 return {
  getState,
  purgeExpiredTrash,
  // Cleanup is retryable: callers acknowledge only after IndexedDB deletion succeeds.
  takePurgedFiles(){return clone(state.pendingPurgedFiles);},
  ackPurgedFiles(ids){const done=new Set(Array.isArray(ids)?ids:[ids]),remaining=state.pendingPurgedFiles.filter(file=>!done.has(file.id));if(remaining.length!==state.pendingPurgedFiles.length){state.pendingPurgedFiles=remaining;persist();}},
  getPrivacy(){return clone(state.privacy);},
  setPrivacy(types){
   if(!types||typeof types!=='object'||Array.isArray(types))return clone(state.privacy);
   state.privacy=normalizePrivacy({acceptedVersion:PRIVACY_VERSION,acceptedAt:timestamp(),types});
   refreshRecommendations(state,timestamp());persist();return clone(state.privacy);
  },
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
  getProjectPreferences(value=state.session.project){
   return [...(state.projectPreferences[cleanText(value,300)]||[])];
  },
  setProjectPreferences(value,values){
   const project=cleanText(value,300);if(!project||!Array.isArray(values))return [];
   const tags=normalizePreferenceTags(values),previous=state.projectPreferences[project]||[];
   if(tags.length===previous.length&&tags.every((tag,i)=>tag===previous[i]))return [...tags];
   if(tags.length)state.projectPreferences[project]=tags;else delete state.projectPreferences[project];
   refreshRecommendations(state,timestamp(),new Set([project]));persist();return [...tags];
  },
  setProject(value){
   const project=cleanText(value,300);
   if(!project||!state.files.some(f=>f.project===project))return false;
   state.session.project=project;persist();return true;
  },
  loadDemo({reanalyze=false}={}){
   purgeExpiredTrash();
   const existing=new Set(state.files.filter(f=>f.source==='demo').map(f=>f.id));
   for(const file of state.files.filter(f=>f.source==='demo')){file.collection=file.collection||file.project;file.project=DEMO_PROJECT;}
   state.session.project=DEMO_PROJECT;
   const records=FILES.filter(f=>!existing.has(f.id)&&!state.purgedDemoIds.includes(f.id)).map(f=>makeDemoRecord(f,timestamp()));
   const result=addRecords(records,FILES.length-records.length);
   if(!records.length)refreshRecommendations(state,timestamp(),new Set([DEMO_PROJECT]));
   // Choosing the demo explicitly starts its preparation view again without
   // restoring archived/deleted files or resetting any user choices.
   if(reanalyze)state.analysis={status:'pending',step:0,ids:state.files.filter(f=>f.source==='demo'&&f.project===DEMO_PROJECT&&isActiveFile(f)).map(f=>f.id)};
   if(!records.length||reanalyze)persist();
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
    const extension=name.includes('.')?name.slice(name.lastIndexOf('.')).toLowerCase():'',type=typeForExtension(extension),clock=timestamp(),recommendation=isReadingAllowed({file:name,ext:extension,type:type?.id},state.privacy)?metadataRecommendation({name,lastModified:modified},clock):{bucket:'undecided',reason:'',duplicate:''};
    const imageMime=/^image\//.test(raw.type||'')||/\.(?:jpe?g|png|webp|gif|avif|bmp|svg|tiff?|heic|heif)$/i.test(name);
    const record={id:uid('local'),file:name,name:name.replace(/\.[^.]+$/,'').replaceAll('_',' '),ext:extension||'file',type:type?.id||extension.slice(1)||'other',kind:type?.kind||'generic',app:type?.app||(imageMime?'Image':extension==='.pdf'?'PDF document':'File'),category:type?.category||(imageMime?'Images':'Documents'),tags:`${extension.slice(1)} ${imageMime?'image photo picture':''}`,project,modified:new Date(modified||clock).toISOString().slice(0,10),lastModified:modified,size:bytes/1000000,bytes,status:'work',forgotten:modified>0&&clock-modified>180*DAY,...recommendation,baseBucket:recommendation.bucket,baseReason:recommendation.reason,decision:'pending',clarification:null,revision:0,source:'local',path,fingerprint,importedAt:clock};
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
  setSuggestionFeedback(id,value){
   if(typeof id!=='string'||!value||typeof value!=='object'||Array.isArray(value)||!['good','bad'].includes(value.rating))return null;
   const hasCorrection=Object.hasOwn(value,'correctedBucket');
   if(hasCorrection&&(value.rating!=='bad'||!BUCKETS.has(value.correctedBucket)))return null;
   const file=state.files.find(file=>file.id===id&&file.project===state.session.project&&isActiveFile(file));
   if(!file)return null;
   const clock=timestamp(),previous=normalizeSuggestionFeedback(file.suggestionFeedback,clock);
   // Feedback updates the recommendation, independently of file placement and
   // its action revision. A subsequent rating keeps a confirmed correction.
   file.suggestionFeedback={...(previous||{}),rating:value.rating,at:clock};
   if(hasCorrection)Object.assign(file.suggestionFeedback,{correctedBucket:value.correctedBucket,correctedAt:clock,correctedFrom:file.bucket});
   if(hasCorrection)refreshRecommendations(state,clock,new Set([file.project]));persist();return clone(file);
  },
  decide(ids,decision,clarification=null){
   purgeExpiredTrash();
   if(!DECISIONS.has(decision))return null;
   const idSet=new Set(Array.isArray(ids)?ids:[ids]),context=safeClarification(clarification);
   const files=state.files.filter(f=>idSet.has(f.id)&&(f.decision!==decision||JSON.stringify(f.clarification)!==JSON.stringify(context)));
   if(!files.length)return null;
   const event={id:uid('event'),at:timestamp(),fileIds:files.map(f=>f.id),action:context?'clarify':decision,before:files.map(snapshot),afterRevision:{},undone:false};
   for(const file of files){applyLifecycle(file,decision,event.at,file.decision===decision?{archivedAt:file.archivedAt,trashedAt:file.trashedAt}:null);file.decision=decision;file.clarification=context?clone(context):null;file.revision++;file.updatedAt=event.at;event.afterRevision[file.id]=file.revision;}
   event.after=files.map(snapshot);
   state.history.unshift(event);refreshRecommendations(state,timestamp(),new Set(files.map(f=>f.project)));chooseNext();persist();return clone(event);
  },
  restoreFiles(ids){
   purgeExpiredTrash();
   const chosen=new Set(Array.isArray(ids)?ids:[ids]),files=state.files.filter(file=>chosen.has(file.id)&&!isActiveFile(file));
   if(!files.length)return null;
   const event={id:uid('event'),at:timestamp(),fileIds:files.map(file=>file.id),action:'restore-files',before:files.map(snapshot),afterRevision:{},undone:false};
   for(const file of files){applyLifecycle(file,'pending',event.at);file.decision='pending';file.revision++;file.updatedAt=event.at;event.afterRevision[file.id]=file.revision;}
   event.after=files.map(snapshot);state.history.unshift(event);refreshRecommendations(state,timestamp(),new Set(files.map(file=>file.project)));chooseNext();persist();return clone(event);
  },
  canUndo,
  undo(eventId){
   purgeExpiredTrash();
   if(!canUndo(eventId))return null;
   const event=state.history.find(e=>e.id===eventId),files=event.fileIds.map(id=>state.files.find(f=>f.id===id));
   const restore={id:uid('event'),at:timestamp(),fileIds:[...event.fileIds],action:'restore',sourceEventId:event.id,before:files.map(snapshot),afterRevision:{},undone:false};
   for(const file of files){const previous=event.before.find(b=>b.id===file.id);applyLifecycle(file,previous.decision,restore.at,previous);file.decision=previous.decision;file.clarification=safeClarification(previous.clarification);file.revision++;file.updatedAt=restore.at;restore.afterRevision[file.id]=file.revision;}
   restore.after=files.map(snapshot);event.undone=true;state.history.unshift(restore);
   // Rebase only the immediately preceding active action onto the restored revision.
   // Its original result snapshot remains immutable for the activity timeline.
   for(const file of files){const previous=latestActiveEvent(file.id);if(previous&&sameResult(file,previous.after?.find(a=>a.id===file.id)))previous.afterRevision[file.id]=file.revision;}
   refreshRecommendations(state,timestamp(),new Set(files.map(f=>f.project)));chooseNext();persist();return clone(restore);
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
