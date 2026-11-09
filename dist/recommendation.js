import {readAccessFor,isReadingAllowed} from './privacy.js';
// A transparent local policy for the prototype. The demo catalog supplies authored evidence
// about its artwork; real imports are assessed only from filename, type, date and size.
export const PREFERENCE_PRESETS = Object.freeze([
 'Free up space','Keep final work','Preserve drafts','Protect memories','Keep references'
]);
const validBuckets=new Set(['keep','archive','trash','undecided']);
export function normalizeSuggestionFeedback(value,now=Date.now()){
 if(!value||typeof value!=='object'||Array.isArray(value)||!['good','bad'].includes(value.rating)||!Number.isFinite(value.at)||value.at<0||value.at>now)return null;
 const feedback={rating:value.rating,at:value.at};
 if(validBuckets.has(value.correctedBucket)){
  feedback.correctedBucket=value.correctedBucket;
  feedback.correctedAt=Number.isFinite(value.correctedAt)&&value.correctedAt>=0&&value.correctedAt<=value.at?value.correctedAt:value.at;
  if(validBuckets.has(value.correctedFrom))feedback.correctedFrom=value.correctedFrom;
 }
 return feedback;
}
const DAY=86400000;
const lower=v=>String(v||'').normalize('NFKC').trim().toLowerCase();
const words=v=>lower(v).replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const copyMarker=/(?:^|[\s_.()\-])(copy|backup|duplicate)(?:[\s_.()\-\d]|$)/i;
const draftMarker=/(?:^|[\s_.()\-])(v\d+|draft|roughcut|rough|sketch|test|early|wip|explorations?)(?:[\s_.()\-\d]|$)/i;
const finalMarker=/(?:^|[\s_.()\-])(final|approved|deliverable|completed)(?:[\s_.()\-\d]|$)/i;
const refMarker=/(?:^| )(?:references?|brief|research|reading|field notes?|moodboard|bibliography)(?: |$)|参考|调研/iu;
const memoryMarker=/(?:^| )(?:memories|family|personal|holiday|trip|vacation|travel)(?: |$)|回忆|家庭|旅行/iu;
const sameGroup=(a,b)=>a&&b&&a!==b&&a.id!==b.id&&!!a.project&&a.project===b.project;
const date=f=>{if(f.source==='demo')return /^\d{4}-\d{2}-\d{2}$/.test(f.modified)?f.modified:'';const d=new Date(f.lastModified);return Number.isFinite(f.lastModified)&&f.lastModified>0&&Number.isFinite(d.getTime())?d.toISOString().slice(0,10):'';};
function sourceName(f){return words(String(f.file||'').replace(/(?:[\s_.()\-]+)(copy|backup|duplicate|副本|备份)(?:[\s_.()\-]*\d+)?(?=\.|$)/gi,''));}
const sizeLabel=n=>n>=1000?(n/1000).toFixed(2)+' GB':n>=1?Number(n.toFixed(1))+' MB':n>=.001?Math.round(n*1000)+' KB':Math.round(n*1e6)+' B';
const label=v=>String(v||'').trim().slice(0,120);
const dateTag=d=>'Edited '+d;
const baseAfter={keep:'Keep it in the active project.',archive:'Archive it for reference without keeping it in the active set.',trash:'Review this candidate before moving it to Trash.',undecided:'Keep it under review until you decide whether it is still useful.'};
function contextOf(f,peers,now){
 const demo=f.source==='demo',filename=String(f.file||''),day=date(f),stamp=Date.parse(day),age=Number.isFinite(stamp)?Math.floor((now-stamp)/DAY):null;
 const candidates=peers.filter(x=>sameGroup(f,x)&&x.source===f.source);
 const best=items=>items.sort((a,b)=>(f.duplicate?Number(b.duplicate===f.duplicate)-Number(a.duplicate===f.duplicate):0)||Number(a.decision==='trash')-Number(b.decision==='trash')||Number(copyMarker.test(a.file))-Number(copyMarker.test(b.file))||String(b.modified||'').localeCompare(String(a.modified||'')))[0];
 const exact=demo&&f.previewKey?best(candidates.filter(x=>x.previewKey===f.previewKey&&x.previewFamily===f.previewFamily&&x.type===f.type&&x.ext===f.ext)):null;
 const variant=demo&&f.previewFamily&&f.previewKey?best(candidates.filter(x=>x.type===f.type&&x.previewFamily===f.previewFamily&&x.previewKey&&x.previewKey!==f.previewKey)):null;
 const matchName=!demo&&copyMarker.test(filename)?best(candidates.filter(x=>!copyMarker.test(x.file)&&sourceName(x)===sourceName(f))):null;
 const corpus=words([filename,f.ext,f.app,f.collection,f.category,f.tags,f.path,demo&&f.previewNote].filter(Boolean).join(' '));
 return {demo,filename,day,age,exact,variant,matchName,corpus,isCopy:copyMarker.test(filename),draft:draftMarker.test(filename)||/草稿|早期/.test(filename),final:finalMarker.test(filename)||/终稿|最终版/.test(filename),image:/^\.(?:jpe?g|png|heic|webp|gif|tiff?)$/i.test(f.ext)||f.kind==='image',reference:refMarker.test(corpus),memory:memoryMarker.test(corpus)};
}
const aliases=[
 ['free up space','save space','释放空间','节省空间'],
 ['keep final work','protect final work','保留最终版','保留成品'],
 ['preserve drafts','keep drafts','保留草稿','保留过程稿'],
 ['protect memories','keep memories','保留回忆','珍藏回忆'],
 ['keep references','preserve references','保留参考资料','保留参考']
];
// Known bilingual keywords are matched against actual metadata. Unknown topics never
// receive a fabricated meaning or a generic 'preference matched' explanation.
const topicGroups=[
 ['rhino','3dm','犀牛','犀牛模型'],['interviews','interview','访谈','采访'],['photoshop','psd','ps'],
 ['presentation','presentations','slide deck','ppt','pptx','演示文稿','幻灯片'],['spreadsheets','spreadsheet','xlsx','xls','表格'],
 ['landscape','landscapes','风景'],['drafts','draft','草稿'],['research','调研','研究'],['portfolio','作品集'],
 ['models','model','建模'],['photography','照片','摄影'],['references','reference','参考资料'],['source files','源文件']
];
function matchedTopic(topic,corpus){
 const forms=topicGroups.find(group=>group.includes(topic))||[topic];
 return forms.find(term=>/[\p{Script=Han}]/u.test(term)?corpus.includes(term):(' '+corpus+' ').includes(' '+term+' '));
}
function matchGoal(tags,f,c,base){
 const prefs=Array.isArray(tags)?[...new Set(tags.filter(t=>typeof t==='string').map(t=>t.trim().slice(0,64)).filter(Boolean))]:[];
 const canonical=index=>prefs.find(t=>aliases[index].includes(lower(t)));
 const goals=[
  [1,c.final,'the filename marks this as a final or approved version'],
  [2,c.draft,'the filename marks this as a draft, test or numbered iteration'],
  [3,c.image||c.memory,c.memory?'the file metadata includes a personal or travel theme':'its image format makes it a candidate for preservation; a format alone cannot establish sentimental value'],
  [4,c.reference,'the filename or project metadata identifies it as reference material']
 ];
 for(const [i,applies,explanation] of goals){const tag=canonical(i);if(applies&&tag)return {tag,outcome:base==='trash'?'undecided':'keep',explanation};}
 // Custom tags are topic matches, not arbitrary instructions to remove files. Recognise
 // simple keep/archive prefixes; a request to delete never establishes redundancy.
 for(const tag of prefs){
  if(aliases.some(group=>group.includes(lower(tag))))continue;
  const norm=words(tag);
  const archive=/^(?:archive |归档)/u.test(norm),remove=/^(?:delete |trash |remove |删除|清理)/u.test(norm);
  const topic=norm.replace(/^(?:(?:keep|save|protect|preserve|archive|delete|trash|remove)\s+|保留|保存|珍藏|归档|删除|清理)/u,'').trim();
  if(!topic||topic.length<( /[\p{Script=Han}]/u.test(topic)?2:3))continue;
  const matched=matchedTopic(topic,c.corpus);
  if(matched)return {tag,outcome:remove||base==='trash'?'undecided':archive?'archive':'keep',explanation:'“'+matched+'” matches this file’s name, type, path or catalog tags'};
 }
 const free=canonical(0);
 if(free&&base==='trash')return {tag:free,outcome:'trash',explanation:'reviewing this '+sizeLabel(f.size)+' candidate can help prioritize cleanup'};
 if(free&&base==='undecided'&&f.size>=25&&c.age!==null&&c.age>=180)return {tag:free,outcome:'archive',explanation:'this '+sizeLabel(f.size)+' file was last edited on '+c.day+'; move it out of the active set while retaining it'};
 return null;
}
function correctedRecommendation(f,feedback,{files,now,privacy,readAccess}){
 const bucket=feedback.correctedBucket,labels={keep:'Keep',archive:'Archive',trash:'Trash',undecided:'Undecided'};
 const correction='You '+(feedback.correctedFrom&&feedback.correctedFrom!==bucket?'changed the suggestion from '+labels[feedback.correctedFrom]+' to ':'set the suggestion to ')+labels[bucket]+'. Your correction takes priority over the earlier suggestion.';
 const intent={
  keep:['Keep active','This file belongs with your active work. Changing the suggestion does not archive or delete it.'],
  archive:['Save for later','Retain this file for later outside active work. Choose Archive to move it there; this feedback only changes the suggestion.'],
  trash:['Cleanup candidate','Review this file as a cleanup candidate. Choose Move to Trash to move it to the recycle bin; this feedback has not deleted it.'],
  undecided:['Needs your context','Leave this file open for further review until you have enough context. No file action has been applied.']
 }[bucket];
 const reasonSignals=[{tag:'Your correction',explanation:correction},{tag:intent[0],explanation:intent[1]}];
 const blocked=readAccess&&['pending','disabled'].includes(readAccess.status);
 if(blocked){
  reasonSignals[0].explanation+=' AI reading remains '+(readAccess.status==='disabled'?'off for this file type.':'unapproved for this file type.')+' Only your explicit correction is used here.';
 }else{
  // Only add a neutral, existing fact; old cleanup/preservation advice must not
  // contradict a user correction, and feedback never triggers a new content read.
  const peers=privacy===undefined?(Array.isArray(files)?files:[]):(Array.isArray(files)?files:[]).filter(peer=>isReadingAllowed(peer,privacy));
  const c=contextOf(f,peers,now);let fact=null;
  if(bucket==='trash'&&c.exact)fact={tag:'Matching preview',explanation:'Its preview matches “'+c.exact.file+'”. Editable source data may still differ.'};
  else if(bucket==='trash'&&c.isCopy)fact={tag:'Copy in filename',explanation:'The filename “'+c.filename+'” contains a copy or backup marker. A filename alone does not establish that the file is redundant.'};
  else if(bucket==='keep'&&c.final)fact={tag:'Final in filename',explanation:'The filename “'+c.filename+'” marks a final, approved or completed version. This provides context for keeping it, although the name does not verify approval.'};
  else if(bucket==='undecided'&&c.variant)fact={tag:'Distinct version',explanation:'Its preview differs from “'+c.variant.file+'” in the same visual series. That difference is a reason to compare the versions before deciding.'};
  else if(c.day)fact={tag:dateTag(c.day),explanation:'The recorded modified date is '+c.day+'. It helps place the file in the project timeline; it does not show when the file was last opened.'};
  else if(Number.isFinite(f.size))fact={tag:'File size',explanation:'The file is listed at '+sizeLabel(f.size)+'. Size alone does not establish usefulness or redundancy.'};
  if(fact)reasonSignals.push(fact);
 }
 return {bucket,reason:reasonSignals.map(signal=>signal.explanation).join(' '),tags:reasonSignals.map(signal=>signal.tag),reasonSignals,...(readAccess?{readAccess}:{})};
}
export function assessRecommendation(file,{files=[],tags=[],now=Date.now(),privacy}={}){
 const f=file||{};
 const readAccess=privacy===undefined?null:readAccessFor(f,privacy);
 const feedback=normalizeSuggestionFeedback(f.suggestionFeedback,now);
 if(feedback?.correctedBucket)return correctedRecommendation(f,feedback,{files,now,privacy,readAccess});
 if(readAccess&&['pending','disabled'].includes(readAccess.status)){
  const reason=readAccess.status==='pending'?'Choose which file types AI may read in Privacy & AI access. You can still review this file yourself.':'AI reading is off for this file type. No AI recommendation is generated. You can review and organize the file yourself, or change its permission in Privacy & AI access.';
  return {bucket:'undecided',reason,tags:[readAccess.label],reasonSignals:[{tag:readAccess.label,explanation:reason}],readAccess};
 }
 if(privacy!==undefined)files=(Array.isArray(files)?files:[]).filter(peer=>isReadingAllowed(peer,privacy));
 const base=validBuckets.has(f.baseBucket)?f.baseBucket:validBuckets.has(f.bucket)?f.bucket:'undecided';
 const c=contextOf(f,Array.isArray(files)?files:[],now),evidence=[],lines=[],signals=new Map();
 let bucket=base;
 const add=(tag,sentence,explanation=sentence)=>{if(tag&&!evidence.includes(tag)){evidence.push(tag);signals.set(tag,explanation||'This file needs your review.');}if(sentence)lines.push(sentence);};
 const copyWord=c.filename.match(copyMarker)?.[1]||'copy or backup';
 const copyExplanation='“'+c.filename+'” contains the marker “'+copyWord+'”. This suggests a copied or backup version, but the name alone cannot prove that its contents are redundant.';
 const sizeExplanation=peer=>'This file and “'+peer.file+'” are both listed at '+sizeLabel(f.size)+'. Equal file sizes support checking them together, but do not prove that their contents are identical.';
 if(c.exact){
  add('Matching preview','Its preview matches “'+c.exact.file+'” in this project.','This demo file shares its preview with “'+c.exact.file+'” in this project. The visible result matches; editable source data, layers or geometry may still differ. Review both before removing either.');
  if(f.size===c.exact.size)add('Same size','Both files are listed at '+sizeLabel(f.size)+'.',sizeExplanation(c.exact));
  if(c.isCopy)add('Copy in filename','Its filename marks it as a copy or backup.',copyExplanation);
  if(!c.isCopy&&base==='keep')add('Primary version','This version has no copy or backup marker in its name.','“'+c.filename+'” has no copy or backup marker, while a matching preview exists in the project. It is a candidate to retain as the main version; the filename does not establish which version is authoritative.');
  if(base==='trash'&&c.exact.decision==='trash'){bucket='undecided';add('Peer in Trash','The matching version is already in Trash. Confirm which version to retain.','The matching version “'+c.exact.file+'” is already in Trash. This suspends the earlier cleanup suggestion: choose which version to retain before removing another.');}
  if(base==='trash')lines.push('Matching previews do not establish that editable source data is identical.');
 }else if(!c.demo&&c.isCopy){
  add('Copy in filename','“'+c.filename+'” contains a copy or backup marker.',copyExplanation);
  if(c.matchName){add('Related filename','“'+c.matchName.file+'” has the same name without that marker.','Removing the copy or backup marker from “'+c.filename+'” matches the name of “'+c.matchName.file+'” in this project. Their contents were not compared, so this is a filename relationship only.');if(c.matchName.size===f.size)add('Same size','Both records show '+sizeLabel(f.size)+'.',sizeExplanation(c.matchName));}
  if(c.matchName?.decision==='trash'){bucket='undecided';add('Peer in Trash','The related file is already in Trash. Check which file should stay.','The related file “'+c.matchName.file+'” is already in Trash. This suspends the earlier cleanup suggestion: choose which version to retain. The filename relationship does not prove that their contents match.');}
  lines.push('Contents were not compared; a filename alone does not prove duplication.');
 }else{
  if(c.variant)add('Distinct version','The preview differs from “'+c.variant.file+'”.','This demo preview differs from “'+c.variant.file+'” in the same visual series.'+(f.previewNote?' This version shows: '+label(f.previewNote).replace(/[.!?]$/,'')+'.':'')+' The visible difference is a reason to compare the versions instead of treating this file as an identical copy.');
  if(c.demo&&f.previewNote)lines.push(label(f.previewNote).replace(/[.!?]$/,'')+'.');
  if(c.final)add('Final in filename','The filename marks this as a final or approved version.','“'+c.filename+'” includes a final, approved or completed-version marker. This suggests a deliverable worth retaining; the name alone cannot confirm approval or whether a newer version exists.');
  else if(c.draft)add('Working iteration','The filename identifies a draft, test or numbered iteration.','“'+c.filename+'” is named as a draft, test or numbered iteration. It may document an intermediate design decision; compare it with the other versions before deciding whether it is still useful.');
  else if(c.reference)add('Reference material','Its name or catalog tags identify reference material.','The filename or catalog metadata for “'+c.filename+'” includes a research, brief, reference or field-notes theme. It may be useful for future work even if it is no longer part of the active project.');
  const ageTag=c.age!==null&&c.age>=180?'Older edit':c.age!==null&&c.age>=0&&c.age<=90?'Recent edit':null;
  if(c.day)add(ageTag||dateTag(c.day),'Last edited on '+c.day+'.','The recorded modified date is '+c.day+'. '+(ageTag==='Older edit'?'It has been '+c.age+' days since that edit, which makes it worth checking for archival. Age alone does not mean the file is obsolete.':ageTag==='Recent edit'?'It was edited within the last 90 days, so it may still belong to your active work. This date does not show when it was last opened.':'This helps place the file in your project timeline; it does not establish when it was last opened or how valuable it is.'));
  if(!c.demo&&f.baseReason&&!c.final&&!c.draft&&!c.reference)lines.push(String(f.baseReason));
  if(c.demo&&!c.variant&&!c.exact&&!c.final&&!c.draft&&!c.reference)add(f.status==='work'?'Working file':f.status==='ready'?'Project deliverable':'Project file',f.collection?'It belongs to the '+f.collection+' collection.':'','The demo catalog identifies “'+c.filename+'” as '+(f.status==='work'?'work in progress':f.status==='ready'?'a project deliverable':'a project file')+(f.collection?' in the '+f.collection+' collection':'')+'. This project context helps you decide whether to keep it active or retain it in the archive.');
 }
 const goal=matchGoal(tags,f,c,bucket);
 if(goal){bucket=goal.outcome;lines.push('Project preference “'+goal.tag+'” applies: '+goal.explanation+'.');}
 if(!lines.length)lines.push(f.baseReason||'The available metadata does not establish how valuable this file is to your project.');
 lines.push(baseAfter[bucket]);
 if(!evidence.length){const tag=c.demo?'Sample metadata':'File metadata';evidence.push(tag);signals.set(tag,'The available record identifies “'+c.filename+'”'+(f.ext?' as a '+String(f.ext).replace(/^\./,'').toUpperCase()+' file':'')+(Number.isFinite(f.size)?' of '+sizeLabel(f.size):'')+'. There is not enough evidence to establish its value or redundancy; review it before making a decision.');}
 // A changed peer decision can invalidate a cleanup suggestion. Keep that decisive
 // signal visible even when the remaining evidence and a project preference compete.
 const ordered=evidence.includes('Peer in Trash')?['Peer in Trash',...evidence.filter(tag=>tag!=='Peer in Trash')]:evidence;
 const visible=goal?[...ordered.slice(0,2),'Preference: '+goal.tag]:ordered.slice(0,3);
 if(goal)signals.set('Preference: '+goal.tag,'Your project preference “'+goal.tag+'” applies because '+goal.explanation+'. '+(bucket==='keep'?'It supports keeping this file in your active project.':bucket==='archive'?'It supports archiving this file while retaining it for later.':bucket==='trash'?'It prioritizes this candidate for cleanup review; it does not establish that deletion is safe.':'It keeps this file Undecided so you can resolve its value before anything is removed.'));
 return {bucket,reason:lines.join(' '),tags:visible,reasonSignals:visible.map(tag=>({tag,explanation:signals.get(tag)})),...(readAccess?{readAccess}:{})};
}
