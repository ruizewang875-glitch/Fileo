import {isActiveFile} from './file-lifecycle.js';

// Preview queues inherit their current project/filter scope from the caller.
// A stale clicked ID must never silently open an unrelated file.
export function createPreviewQueue(files,startId){
 const ids=[...new Set((Array.isArray(files)?files:[]).filter(isActiveFile).map(file=>file?.id).filter(id=>typeof id==='string'&&id))];
 if(!ids.length)return {ids:[],index:0};
 const index=startId===undefined?0:ids.indexOf(startId);
 return index<0?{ids:[],index:0}:{ids,index};
}

// Two or more selected files explicitly switch the primary action to bulk mode.
// Otherwise it acts on the file currently being previewed, never a hidden selection.
export function previewTrashTargets(files,currentId,selectedIds){
 const valid=new Set((Array.isArray(files)?files:[]).filter(isActiveFile).map(file=>file?.id));
 const selected=[...new Set(selectedIds||[])].filter(id=>valid.has(id));
 if(selected.length>=2)return {ids:selected,batch:true};
 return {ids:valid.has(currentId)?[currentId]:[],batch:false};
}

// Continue within the snapshot the user opened, never the newly ranked list.
// Prefer the following remaining file; at the end, use the nearest previous one.
export function previewAfterTrash(queueIds,currentId,files){
 const valid=new Set((Array.isArray(files)?files:[]).filter(isActiveFile).map(file=>file?.id));
 const queue=[...new Set(queueIds||[])],ids=queue.filter(id=>valid.has(id));
 if(!ids.length)return {ids:[],index:0};
 const oldIndex=queue.indexOf(currentId);
 const nextId=queue.slice(oldIndex+1).find(id=>valid.has(id))||[...queue.slice(0,Math.max(oldIndex,0))].reverse().find(id=>valid.has(id))||ids[0];
 return {ids,index:ids.indexOf(nextId)};
}
