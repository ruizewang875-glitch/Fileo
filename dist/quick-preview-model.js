// Preview queues inherit their current project/filter scope from the caller.
// A stale clicked ID must never silently open an unrelated file.
export function createPreviewQueue(files,startId){
 const ids=[...new Set((Array.isArray(files)?files:[]).map(file=>file?.id).filter(id=>typeof id==='string'&&id))];
 if(!ids.length)return {ids:[],index:0};
 const index=startId===undefined?0:ids.indexOf(startId);
 return index<0?{ids:[],index:0}:{ids,index};
}

// Two or more selected files explicitly switch the primary action to bulk mode.
// Otherwise it acts on the file currently being previewed, never a hidden selection.
export function previewTrashTargets(files,currentId,selectedIds){
 const valid=new Set((Array.isArray(files)?files:[]).filter(file=>file?.decision!=='trash').map(file=>file?.id));
 const selected=[...new Set(selectedIds||[])].filter(id=>valid.has(id));
 if(selected.length>=2)return {ids:selected,batch:true};
 return {ids:valid.has(currentId)?[currentId]:[],batch:false};
}
