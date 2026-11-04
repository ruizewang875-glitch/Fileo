// A transparent local policy for the prototype. The demo catalog supplies authored evidence
// about its artwork; real imports are assessed only from filename, type, date and size.
export const PREFERENCE_PRESETS = Object.freeze([
 'Free up space','Keep final work','Preserve drafts','Protect memories','Keep references'
]);
const validBuckets=new Set(['keep','archive','trash','undecided']);
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
export function assessRecommendation(file,{files=[],tags=[],now=Date.now()}={}){
 const f=file||{},base=validBuckets.has(f.baseBucket)?f.baseBucket:validBuckets.has(f.bucket)?f.bucket:'undecided';
 const c=contextOf(f,Array.isArray(files)?files:[],now),evidence=[],lines=[];
 let bucket=base;
 const add=(tag,sentence)=>{if(tag&&!evidence.includes(tag))evidence.push(tag);if(sentence)lines.push(sentence);};
 if(c.exact){
  add('Matching preview','Its preview matches “'+c.exact.file+'” in this project.');
  if(f.size===c.exact.size)add('Same size','Both files are listed at '+sizeLabel(f.size)+'.');
  if(c.isCopy)add('Copy in filename','Its filename marks it as a copy or backup.');
  if(!c.isCopy&&base==='keep')add('Primary version','This version has no copy or backup marker in its name.');
  if(base==='trash'&&c.exact.decision==='trash'){bucket='undecided';add('Peer in Trash','The matching version is already in Trash. Confirm which version to retain.');}
  if(base==='trash')lines.push('Matching previews do not establish that editable source data is identical.');
 }else if(!c.demo&&c.isCopy){
  add('Copy in filename','“'+c.filename+'” contains a copy or backup marker.');
  if(c.matchName){add('Related filename','“'+c.matchName.file+'” has the same name without that marker.');if(c.matchName.size===f.size)add('Same size','Both records show '+sizeLabel(f.size)+'.');}
  if(c.matchName?.decision==='trash'){bucket='undecided';add('Peer in Trash','The related file is already in Trash. Check which file should stay.');}
  lines.push('Contents were not compared; a filename alone does not prove duplication.');
 }else{
  if(c.variant)add('Distinct version','The preview differs from “'+c.variant.file+'”.');
  if(c.demo&&f.previewNote)lines.push(label(f.previewNote).replace(/[.!?]$/,'')+'.');
  if(c.final)add('Final in filename','The filename marks this as a final or approved version.');
  else if(c.draft)add('Working iteration','The filename identifies a draft, test or numbered iteration.');
  else if(c.reference)add('Reference material','Its name or catalog tags identify reference material.');
  const ageTag=c.age!==null&&c.age>=180?'Older edit':c.age!==null&&c.age>=0&&c.age<=90?'Recent edit':null;
  if(c.day)add(ageTag||dateTag(c.day),'Last edited on '+c.day+'.');
  if(!c.demo&&f.baseReason&&!c.final&&!c.draft&&!c.reference)lines.push(String(f.baseReason));
  if(c.demo&&!c.variant&&!c.exact&&!c.final&&!c.draft&&!c.reference)add(f.status==='work'?'Working file':f.status==='ready'?'Project deliverable':'Project file',f.collection?'It belongs to the '+f.collection+' collection.':'');
 }
 const goal=matchGoal(tags,f,c,bucket);
 if(goal){bucket=goal.outcome;lines.push('Project preference “'+goal.tag+'” applies: '+goal.explanation+'.');}
 if(!lines.length)lines.push(f.baseReason||'The available metadata does not establish how valuable this file is to your project.');
 lines.push(baseAfter[bucket]);
 if(!evidence.length)evidence.push(c.demo?'Sample metadata':'File metadata');
 const visible=goal?[...evidence.slice(0,2),'Preference: '+goal.tag]:evidence.slice(0,3);
 return {bucket,reason:lines.join(' '),tags:visible};
}
