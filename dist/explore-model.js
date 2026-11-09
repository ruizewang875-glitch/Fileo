import {isActiveFile} from './file-lifecycle.js';
import {demoPreview} from './demo-preview.js';

// Similarity in this prototype uses the authored demo catalog or visible file
// metadata. It does not claim to inspect the contents of an imported file.
const text=value=>String(value||'').normalize('NFKC').trim();
const lower=value=>text(value).toLowerCase();
const copyMarker=/(?:^|[\s_.()\-])(copy|backup|duplicate|副本|备份)(?:[\s_.()\-\d]|$)/i;
const canUsePreview=file=>file?.source==='demo'&&!['pending','disabled'].includes(file.readAccess?.status);
const sameProject=(a,b)=>text(a?.project)===text(b?.project);
const stamp=file=>Number.isFinite(file.lastModified)&&file.lastModified>0?file.lastModified:Date.parse(file.modified)||0;
const byRecent=(a,b)=>stamp(b)-stamp(a)||text(a.file).localeCompare(text(b.file))||text(a.id).localeCompare(text(b.id));
const filenameWords=file=>lower(file?.file).replace(/\.[^.]+$/,'').replace(/(?:^|[\s_.()\-])(?:copy|backup|duplicate|final|draft|roughcut|rough|early|test|wip|v\d+|\d+)(?=[\s_.()\-]|$)/g,' ').split(/[\s_.()\-]+/).filter(Boolean);
const matchingPreview=(a,b)=>canUsePreview(a)&&canUsePreview(b)&&!!a.previewKey&&a.previewKey===b.previewKey;

function similarity(current,other){
 if(!sameProject(current,other))return 0;
 let score=0;
 if(matchingPreview(current,other))score=100+Number(current.previewFamily===other.previewFamily)*20+Number(current.type===other.type)*10;
 if(canUsePreview(current)&&canUsePreview(other)&&current.previewFamily&&current.previewFamily===other.previewFamily)score=Math.max(score,80+Number(current.type===other.type)*10);
 const a=filenameWords(current),b=filenameWords(other);
 if(a.length&&a.join(' ')===b.join(' '))score=Math.max(score,70);
 else if(a.length>=2&&b.length>=2&&a[0]===b[0]&&a[1]===b[1])score=Math.max(score,55);
 // A collection is an explicit sub-project relationship, not just membership
 // in a workspace. Different formats can be useful context without being copies.
 if(text(current.collection)&&lower(current.collection)===lower(other.collection))score=Math.max(score,40+Number(current.type===other.type)*5);
 return score;
}

export function similarFiles(current,files=[]){
 const available=new Map((Array.isArray(files)?files:[]).filter(isActiveFile).map(file=>[file.id,file]));
 const anchor=current&&available.get(current.id);
 if(!anchor)return [];
 return [anchor,...[...available.values()].filter(file=>file.id!==anchor.id).map(file=>({file,score:similarity(anchor,file)})).filter(item=>item.score>0).sort((a,b)=>b.score-a.score||byRecent(a.file,b.file)).map(item=>item.file)];
}

function exactGroups(files){
 const groups=new Map();
 for(const file of files){
  if(!canUsePreview(file)||!file.previewKey)continue;
  // Reused representative art across formats is not evidence of redundant
  // source files. Only compare like-for-like preview records as copy candidates.
  const key=[file.project,file.type,file.ext,file.previewFamily,file.previewKey].join('\u0000');
  if(!groups.has(key))groups.set(key,[]);
  groups.get(key).push(file);
 }
 return [...groups.values()].filter(group=>group.length>1);
}

export function comparisonFinding(input=[]){
 const files=[...new Map((Array.isArray(input)?input:[]).filter(isActiveFile).map(file=>[file.id,file])).values()];
 if(!files.length)return 'No active files remain in this comparison.';
 if(files.length===1)return 'No related active files were found. Review this file on its own before deciding.';
 const sentences=[],groups=exactGroups(files),formats=new Set(files.map(file=>lower(file.type||file.ext)).filter(Boolean));
 const shortPreview=file=>{
  const label=text(demoPreview(file)?.alt||file.previewNote).replace(/[.!?]+$/,'');
  return label.split(/\s+/).slice(0,12).join(' ').replace(/^./,letter=>letter.toLowerCase());
 };
 const group=groups.find(items=>items.some(file=>copyMarker.test(file.file)&&file.bucket==='trash'))||groups[0];
 if(group){
  const source=[...group].sort((a,b)=>Number(copyMarker.test(a.file))-Number(copyMarker.test(b.file))||Number(b.bucket==='keep')-Number(a.bucket==='keep')||byRecent(a,b))[0];
  const candidate=group.find(file=>file.id!==source.id&&copyMarker.test(file.file)&&file.bucket==='trash');
  if(candidate)sentences.push(`“${candidate.file}” matches “${source.file}”; check editable source contents before removing the copy.`);
  else sentences.push(`“${group[0].file}” and “${group[1].file}” share a preview, but their editable source data may differ.`);
 }
 const demo=files.filter(canUsePreview),keys=new Set(demo.map(file=>file.previewKey).filter(Boolean));
 const variants=[...new Map(demo.filter(file=>file.previewKey&&(!group||file.previewKey!==group[0].previewKey)&&shortPreview(file)).map(file=>[file.previewKey,file])).values()].slice(0,group?1:3);
 if(keys.size>1&&variants.length){
  const detail=group?'The other version shows '+shortPreview(variants[0]):'Visible differences: '+variants.map(shortPreview).join('; ');
  sentences.push(detail+(formats.size>1?'; sources and exports can serve different roles.':'.'));
 }
 if(!group){
  if(!sentences.length)sentences.push('These files are related by their names or collection; their contents have not been compared.');
  if(formats.size>1&&!sentences.some(line=>line.includes('different roles')))sentences.push('Sources and exports can serve different roles; matching artwork alone does not justify deletion.');
  else if(files.some(file=>!canUsePreview(file)))sentences.push('Imported files and files with AI reading off use metadata only; check them before removal.');
  else if(files.some(file=>file.bucket==='undecided'))sentences.push('Review the Undecided versions before cleanup; the other variants may preserve useful design changes.');
  else if(files.some(file=>file.bucket==='archive'))sentences.push('Archive suggestions retain earlier work for later; keep the versions you still use.');
  else sentences.push('Keep the versions you still use; visual differences alone do not justify deletion.');
 }else if(sentences.length===1&&files.some(file=>!canUsePreview(file)))sentences.push('Imported files and files with AI reading off use metadata only.');
 return sentences.slice(0,2).join(' ');
}

function fileDay(file){
 const value=text(file.modified).slice(0,10);
 const parsed=new Date(value+'T00:00:00Z');
 if(/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(parsed.getTime())&&parsed.toISOString().slice(0,10)===value)return value;
 if(Number.isFinite(file.lastModified)&&file.lastModified>0){const date=new Date(file.lastModified);if(Number.isFinite(date.getTime()))return date.toISOString().slice(0,10);}
 return 'Unknown date';
}

/** Chronological, project-scoped input; unknown dates stay visible at the end. */
export function timelineGroups(files=[],{project}={}){
 const groups=new Map();
 for(const file of new Map((Array.isArray(files)?files:[]).filter(file=>isActiveFile(file)&&(project===undefined||file.project===project)).map(file=>[file.id,file])).values()){
  const date=fileDay(file);if(!groups.has(date))groups.set(date,[]);groups.get(date).push(file);
 }
 return [...groups].sort(([a],[b])=>a==='Unknown date'?1:b==='Unknown date'?-1:a.localeCompare(b)).map(([date,items])=>({date,files:items.sort((a,b)=>stamp(a)-stamp(b)||text(a.file).localeCompare(text(b.file))||text(a.id).localeCompare(text(b.id)))}));
}
