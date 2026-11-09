import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorkspace} from '../dist/workspace.js';
import {FILES} from '../dist/data.js';
import {isActiveFile,isExpiredTrash,trashExpiresAt,trashDaysRemaining,TRASH_RETENTION_MS,TRASH_RETENTION_DAYS} from '../dist/file-lifecycle.js';

const START=Date.parse('2026-11-09T08:00:00Z'),DAY=86400000,KEY='fileo-workspace-v2';
function fixture(){
 let time=START;const data=new Map(),storage={getItem:key=>data.get(key)||null,setItem:(key,value)=>data.set(key,value)},now=()=>time;
 return {storage,now,ws:createWorkspace({storage,now}),advance:days=>{time+=days*DAY;},reload:()=>createWorkspace({storage,now})};
}
const input=name=>({name,size:100,lastModified:START,type:'text/plain'});
const find=(ws,id)=>ws.getState().files.find(file=>file.id===id);

test('lifecycle exposes active files and an exact 180-day recoverability deadline',()=>{
 assert.equal(TRASH_RETENTION_DAYS,180);assert.equal(isActiveFile({decision:'pending'}),true);assert.equal(isActiveFile({decision:'keep'}),true);
 assert.equal(isActiveFile({decision:'archive'}),false);assert.equal(isActiveFile({decision:'trash'}),false);assert.equal(isActiveFile(null),false);
 const file={decision:'trash',trashedAt:START};
 assert.equal(trashExpiresAt(file),START+TRASH_RETENTION_MS);assert.equal(trashDaysRemaining(file,START),180);
 assert.equal(trashDaysRemaining(file,START+TRASH_RETENTION_MS-1),1);assert.equal(isExpiredTrash(file,START+TRASH_RETENTION_MS-1),false);
 assert.equal(trashDaysRemaining(file,START+TRASH_RETENTION_MS),0);assert.equal(isExpiredTrash(file,START+TRASH_RETENTION_MS),true);
 assert.equal(trashExpiresAt({decision:'archive',trashedAt:START}),null);assert.equal(trashExpiresAt({decision:'trash'}),null);
});

test('bulk restore returns only the chosen stored files to active space without changing their AI categories',()=>{
 const ctx=fixture(),ws=ctx.ws;
 const [a,b]=ws.importFiles([input('a.txt'),input('b_copy.txt')],{project:'A'}).ids;
 const c=ws.importFiles([input('c.txt')],{project:'B'}).ids[0];
 const bulk=ws.decide([a,b],'archive');ws.decide(a,'trash');ws.decide(c,'archive');
 assert.equal(ws.canUndo(bulk.id),false);
 const buckets=[find(ws,a).bucket,find(ws,b).bucket],restored=ws.restoreFiles([a,b,a,'missing']);
 assert.deepEqual(restored.fileIds,[a,b]);assert.equal(restored.action,'restore-files');
 assert.ok([a,b].every(id=>isActiveFile(find(ws,id))));assert.deepEqual([find(ws,a).bucket,find(ws,b).bucket],buckets);
 assert.equal(find(ws,a).trashedAt,undefined);assert.equal(find(ws,b).archivedAt,undefined);assert.equal(find(ws,c).decision,'archive');
 assert.equal(ws.restoreFiles([a,b,'missing']),null);
});

test('archive has no retention deadline; restore and undo preserve the original stored-space dates',()=>{
 const ctx=fixture(),ws=ctx.ws,[a,b]=ws.importFiles([input('a.txt'),input('b.txt')]).ids;
 ws.decide(a,'archive');ws.decide(b,'trash');ctx.advance(12);
 const restored=ws.restoreFiles([a,b]);assert.equal(ws.canUndo(restored.id),true);
 ws.undo(restored.id);assert.equal(find(ws,a).archivedAt,START);assert.equal(find(ws,b).trashedAt,START);
 ctx.advance(169);ws.purgeExpiredTrash();assert.equal(find(ws,b),undefined);assert.equal(find(ws,a).decision,'archive');
 assert.equal(find(ctx.reload(),a).archivedAt,START);
});

test('re-trashing a restored file starts a new retention period while stale undo cannot revive expired Trash',()=>{
 const ctx=fixture(),ws=ctx.ws,id=ws.importFiles([input('a.txt')]).ids[0];
 ws.decide(id,'trash');ctx.advance(100);const restoration=ws.restoreFiles(id);ctx.advance(81);
 assert.equal(ws.canUndo(restoration.id),false);assert.equal(ws.undo(restoration.id),null);assert.equal(find(ws,id).decision,'pending');
 ws.decide(id,'trash');assert.equal(find(ws,id).trashedAt,START+181*DAY);assert.equal(trashDaysRemaining(find(ws,id),ctx.now()),180);
});

test('expiry removes catalog and every recovery reference, retaining cleanup work until acknowledged',()=>{
 const ctx=fixture(),ws=ctx.ws,[a,b]=ws.importFiles([{...input('a.txt'),previewKey:'preview:a'},input('b.txt')]).ids;
 ws.toggleSaved(a);ws.touchRecent(a);ws.startReview([a,b],{focusId:a});
 const action=ws.decide([a,b],'trash');ctx.advance(179);assert.deepEqual(ws.purgeExpiredTrash(),[]);
 // Restore just one member independently; the expiring member must not block its future work.
 ws.restoreFiles(b);ctx.advance(1);const removed=ws.purgeExpiredTrash();assert.deepEqual(removed.map(file=>file.id),[a]);
 const state=ws.getState();assert.equal(find(ws,a),undefined);assert.equal(find(ws,b).decision,'pending');assert.equal(ws.canUndo(action.id),false);
 assert.ok(state.history.every(event=>!event.fileIds.includes(a)&&!event.before.some(file=>file.id===a)&&!event.after.some(file=>file.id===a)&&!Object.hasOwn(event.afterRevision,a)));
 assert.ok(!state.saved.includes(a)&&!state.recent.includes(a)&&!state.review.ids.includes(a)&&!state.analysis.ids.includes(a)&&state.resumeId!==a);
 assert.deepEqual(ws.takePurgedFiles(),[{id:a,previewKey:'preview:a'}]);assert.deepEqual(ws.takePurgedFiles(),[{id:a,previewKey:'preview:a'}]);
 const again=ctx.reload();assert.deepEqual(again.takePurgedFiles(),[{id:a,previewKey:'preview:a'}]);again.ackPurgedFiles([a]);assert.deepEqual(ctx.reload().takePurgedFiles(),[]);
 assert.equal(again.restoreFiles(a),null);assert.equal(again.decide(a,'pending'),null);
});

test('startup removes expired Trash and tombstones stop authored demo files from silently reappearing',()=>{
 const ctx=fixture(),ws=ctx.ws;ws.loadDemo();const id=FILES[0].id;ws.decide(id,'trash');ctx.advance(180);
 const again=ctx.reload();assert.equal(find(again,id),undefined);assert.ok(again.getState().purgedDemoIds.includes(id));assert.equal(again.takePurgedFiles()[0].id,id);
 again.loadDemo();assert.equal(find(again,id),undefined);assert.equal(find(ctx.reload(),id),undefined);
 assert.equal(again.getState().files.length,FILES.length-1);
});

test('legacy Trash migrates from its recorded decision time, with a stable first-visit fallback when time is unknown',()=>{
 const ctx=fixture(),ws=ctx.ws,[a,b]=ws.importFiles([input('a.txt'),input('b.txt')]).ids;
 ws.decide(a,'trash');ws.decide(b,'trash');const raw=ws.getState();
 for(const file of raw.files){delete file.trashedAt;delete file.updatedAt;}
 raw.history=raw.history.filter(event=>event.fileIds.includes(a));raw.history.forEach(event=>{event.before.forEach(file=>delete file.trashedAt);event.after.forEach(file=>delete file.trashedAt);});
 ctx.storage.setItem(KEY,JSON.stringify(raw));ctx.advance(10);const again=ctx.reload();
 assert.equal(find(again,a).trashedAt,START);assert.equal(find(again,b).trashedAt,START+10*DAY);
 ctx.advance(10);assert.equal(find(ctx.reload(),b).trashedAt,START+10*DAY);
});

test('restore and undo guard the deadline even if the open-page cleanup timer has not run',()=>{
 const ctx=fixture(),ws=ctx.ws,id=ws.importFiles([input('a.txt')]).ids[0],event=ws.decide(id,'trash');
 ctx.advance(180);assert.equal(ws.canUndo(event.id),false);assert.equal(ws.restoreFiles(id),null);assert.equal(find(ws,id),undefined);assert.equal(ws.undo(event.id),null);
});
