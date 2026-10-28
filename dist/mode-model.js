import {BUCKETS} from './data.js';

const PRIORITY = {trash:0,archive:1,undecided:2,keep:3};
const sizeOf = file => Number.isFinite(file?.size) && file.size > 0 ? file.size : 0;
const isPending = file => !file.decision || file.decision === 'pending';

// An empty/unknown project never broadens a query to the whole workspace.
export function projectFiles(files, project) {
 if(typeof project!=='string'||!project.trim())return [];
 return (Array.isArray(files)?files:[]).filter(file=>file.project===project);
}

// Stable ordering: suggested cleanup comes first; completed decisions stay at the end.
export function rankFiles(files) {
 return (Array.isArray(files)?files:[]).map((file,index)=>({file,index})).sort((a,b)=>{
  const phaseA=isPending(a.file)?0:1,phaseB=isPending(b.file)?0:1;
  return phaseA-phaseB||(PRIORITY[a.file.bucket]??4)-(PRIORITY[b.file.bucket]??4)||sizeOf(b.file)-sizeOf(a.file)||a.index-b.index;
 }).map(entry=>entry.file);
}

export function calculateStats(files) {
 const entries=Array.isArray(files)?files:[],totalCount=entries.length,totalSize=entries.reduce((sum,file)=>sum+sizeOf(file),0);
 const buckets=BUCKETS.map(bucket=>{
  const group=entries.filter(file=>file.bucket===bucket.id),size=group.reduce((sum,file)=>sum+sizeOf(file),0);
  return {...bucket,count:group.length,size,filePercent:totalCount?group.length/totalCount*100:0,spacePercent:totalSize?size/totalSize*100:0};
 });
 const sumWhere=predicate=>entries.filter(predicate).reduce((sum,file)=>sum+sizeOf(file),0);
 const pendingCount=entries.filter(isPending).length;
 return {
  totalCount,totalSize,buckets,byBucket:Object.fromEntries(buckets.map(bucket=>[bucket.id,bucket])),
  pendingCount,reviewedCount:totalCount-pendingCount,
  potentialTrash:sumWhere(file=>isPending(file)&&file.bucket==='trash'),
  potentialArchive:sumWhere(file=>isPending(file)&&file.bucket==='archive'),
  inTrashSize:sumWhere(file=>file.decision==='trash'),
  archivedSize:sumWhere(file=>file.decision==='archive')
 };
}
