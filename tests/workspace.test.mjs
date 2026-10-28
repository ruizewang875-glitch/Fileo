import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorkspace} from '../dist/workspace.js';
const NOW=Date.parse('2026-10-21T12:00:00Z');
const memory=()=>{const m=new Map();return {getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v),map:m};};
const make=(storage=memory())=>createWorkspace({storage,now:()=>NOW});
const input=(name,extra={})=>({name,size:1200000,lastModified:NOW-86400000,type:'application/octet-stream',...extra});

test('fresh workspace starts signed out with no fabricated files',()=>{
 const ws=make();assert.equal(ws.getState().session.signedIn,false);assert.deepEqual(ws.getState().files,[]);
 assert.equal(ws.login('  '),false);assert.equal(ws.login('  Taylor  '),true);assert.equal(ws.getState().session.name,'Taylor');
});
test('sample import is resumable, deterministic and idempotent',()=>{
 const ws=make(),first=ws.loadDemo();assert.equal(first.added,21);assert.equal(ws.getState().analysis.status,'pending');
 ws.setAnalysisStep(2);assert.equal(ws.getState().analysis.step,2);ws.finishAnalysis();assert.equal(ws.getState().analysis.status,'done');
 assert.deepEqual(ws.loadDemo(),{added:0,skipped:21,ids:[]});assert.equal(ws.getState().files.length,21);
 assert.deepEqual(new Set(ws.getState().files.map(f=>f.bucket)),new Set(['keep','archive','trash','undecided']));
});
test('metadata import handles native files without unrelated sample images',()=>{
 const ws=make();const result=ws.importFiles([input('chair.3dm',{relativePath:'Furniture/chair.3dm'}),input('sketch.psd'),input('notes.txt',{lastModified:0}),input('shot.png',{type:'image/png',previewData:'data:image/png;base64,YWJj'})]);
 assert.equal(result.added,4);const [native,psd,notes,image]=ws.getState().files;
 assert.equal(native.app,'Rhino');assert.equal(native.project,'Furniture');assert.equal(native.image,undefined);assert.equal(psd.image,undefined);assert.equal(native.size,1.2);
 assert.equal(native.bucket,'keep');assert.equal(notes.bucket,'undecided');assert.equal(image.previewData,'data:image/png;base64,YWJj');
});
test('same path, size and modification date deduplicate across sessions',()=>{
 const storage=memory(),ws=make(storage),file=input('chair.3dm');ws.importFiles([file,file]);
 assert.equal(ws.getState().files.length,1);assert.equal(make(storage).importFiles([file]).skipped,1);
 assert.equal(ws.importFiles([input('chair.3dm',{relativePath:'Other/chair.3dm'})]).added,1);
});
test('recommendations admit metadata limits and never infer duplicate contents',()=>{
 const ws=make();ws.importFiles([input('photo_copy.psd'),input('old_photo.psd'),input('final_poster.ai',{lastModified:NOW-200*86400000}),input('unknown.blend',{lastModified:NOW-200*86400000})]);
 assert.deepEqual(ws.getState().files.map(f=>f.bucket),['trash','archive','archive','undecided']);assert.match(ws.getState().files[0].reason,/Contents were not compared/);
});
test('invalid inputs are skipped; arbitrary HTML and SVG data are not previews',()=>{
 const ws=make();const r=ws.importFiles([null,{name:'',size:10},input('bad.ai',{size:-1}),input('ok.ai',{previewData:'data:text/html;base64,YWJj'}),input('icon.svg',{previewData:'data:image/svg+xml;base64,YWJj'})]);
 assert.equal(r.skipped,3);assert.equal(r.added,2);assert.ok(ws.getState().files.every(f=>!f.previewData));
});
test('user decisions preserve AI recommendation and undo restores the previous state',()=>{
 const ws=make();ws.loadDemo();ws.finishAnalysis();const original=ws.getState().files.find(f=>f.id==='file-2');
 const event=ws.decide(['file-2'],'keep');assert.equal(ws.getState().files.find(f=>f.id==='file-2').bucket,'trash');assert.equal(ws.canUndo(event.id),true);
 const undo=ws.undo(event.id);const restored=ws.getState().files.find(f=>f.id==='file-2');assert.equal(restored.decision,'pending');assert.equal(restored.bucket,original.bucket);assert.equal(ws.canUndo(event.id),false);assert.equal(undo.action,'restore');assert.equal(ws.getState().history[0].action,'restore');
});
test('stale bulk undo cannot overwrite a newer decision on any member',()=>{
 const ws=make();ws.loadDemo();const bulk=ws.decide(['file-1','file-4'],'archive');ws.decide(['file-1'],'keep');
 assert.equal(ws.canUndo(bulk.id),false);assert.equal(ws.undo(bulk.id),null);assert.equal(ws.getState().files.find(f=>f.id==='file-4').decision,'archive');
});
test('clarification persists context, preserves Undecided badge and is reversible',()=>{
 const ws=make();ws.loadDemo();const e=ws.decide(['file-5'],'archive',{use:'later',value:'reference'});
 const file=ws.getState().files.find(f=>f.id==='file-5');assert.equal(e.action,'clarify');assert.equal(file.bucket,'undecided');assert.equal(file.decision,'archive');assert.deepEqual(file.clarification,{use:'later',value:'reference'});
 ws.undo(e.id);assert.equal(ws.getState().files.find(f=>f.id==='file-5').clarification,null);
});
test('sign out, reload and sign in preserve file progress and resume target',()=>{
 const storage=memory(),ws=make(storage);ws.login('Alex');ws.loadDemo();ws.finishAnalysis();ws.setResume('file-5');ws.decide(['file-1'],'keep');ws.toggleSaved('file-4');ws.touchRecent('file-5');ws.logout();
 const resumed=make(storage);assert.equal(resumed.getState().session.signedIn,false);resumed.login('Alex');assert.equal(resumed.getState().resumeId,'file-5');assert.equal(resumed.getState().files[0].decision,'keep');assert.deepEqual(resumed.getState().saved,['file-4']);assert.deepEqual(resumed.getState().recent,['file-5']);
});
test('storage denial is reported while the current session remains usable',()=>{
 const ws=make({getItem:()=>null,setItem:()=>{throw Error('Quota exceeded');}});ws.login('Alex');ws.loadDemo();assert.equal(ws.getState().storageError,true);assert.equal(ws.getState().files.length,21);
});
test('malformed persisted data does not crash or revive missing IDs',()=>{
 const storage=memory();storage.setItem('fileo-workspace-v2','{broken');assert.deepEqual(make(storage).getState().files,[]);
 storage.setItem('fileo-workspace-v2',JSON.stringify({version:2,files:[{id:'bad',file:'x',bucket:'invalid',size:3}],saved:['bad'],recent:['bad'],resumeId:'bad'}));const ws=make(storage);assert.deepEqual(ws.getState().files,[]);assert.deepEqual(ws.getState().saved,[]);assert.equal(ws.getState().resumeId,null);
});
test('returned state and events cannot silently mutate internal records',()=>{
 const ws=make();ws.loadDemo();const state=ws.getState();state.files[0].bucket='trash';assert.equal(ws.getState().files[0].bucket,'keep');
 const e=ws.decide('file-1','archive');e.before[0].decision='trash';ws.undo(e.id);assert.equal(ws.getState().files[0].decision,'pending');
});

test('history records immutable results after later decisions and restoration',()=>{
 const ws=make();ws.loadDemo();
 const clarified=ws.decide('file-5','archive',{use:'later'});ws.decide('file-5','keep');
 const entry=ws.getState().history.find(e=>e.id===clarified.id);
 assert.equal(entry.after[0].decision,'archive');assert.deepEqual(entry.after[0].clarification,{use:'later'});
 assert.equal(ws.getState().files.find(f=>f.id==='file-5').decision,'keep');
});
test('undoing the latest decision re-enables the previous action across reload',()=>{
 const storage=memory(),ws=make(storage);ws.loadDemo();
 const a=ws.decide('file-1','keep'),b=ws.decide('file-1','archive');
 assert.equal(ws.canUndo(a.id),false);const restore=ws.undo(b.id);
 assert.equal(restore.after[0].decision,'keep');assert.equal(ws.canUndo(restore.id),false);assert.equal(ws.canUndo(a.id),true);
 const resumed=make(storage);assert.equal(resumed.canUndo(a.id),true);resumed.undo(a.id);
 assert.equal(resumed.getState().files.find(f=>f.id==='file-1').decision,'pending');
 assert.equal(resumed.getState().history.find(e=>e.id===a.id).after[0].decision,'keep');
});
test('bulk actions can unwind after every newer affected decision is undone',()=>{
 const ws=make();ws.loadDemo();const a=ws.decide(['file-1','file-4'],'keep');
 const b=ws.decide('file-1','archive'),c=ws.decide('file-4','trash');
 ws.undo(b.id);assert.equal(ws.canUndo(a.id),false);ws.undo(c.id);assert.equal(ws.canUndo(a.id),true);
 ws.undo(a.id);assert.ok(ws.getState().files.filter(f=>['file-1','file-4'].includes(f.id)).every(f=>f.decision==='pending'));
});
test('a newer equivalent decision does not make an older action undoable',()=>{
 const ws=make();ws.loadDemo();const a=ws.decide('file-1','keep'),b=ws.decide('file-1','archive'),c=ws.decide('file-1','keep');
 assert.equal(ws.canUndo(a.id),false);assert.equal(ws.canUndo(b.id),false);assert.equal(ws.canUndo(c.id),true);
 ws.undo(c.id);assert.equal(ws.canUndo(b.id),true);assert.equal(ws.canUndo(a.id),false);
});
test('early persisted histories without after snapshots recover their original results',()=>{
 const storage=memory(),ws=make(storage);ws.loadDemo();const a=ws.decide('file-5','archive',{use:'later'}),b=ws.decide('file-5','keep');
 const old=ws.getState();old.history.forEach(e=>delete e.after);storage.setItem('fileo-workspace-v2',JSON.stringify(old));
 const migrated=make(storage);assert.equal(migrated.getState().history.find(e=>e.id===a.id).after[0].decision,'archive');
 assert.equal(migrated.canUndo(b.id),true);migrated.undo(b.id);assert.equal(migrated.canUndo(a.id),true);
});

test('email and Google prototype identities validate and persist without claiming authentication',()=>{
 const storage=memory(),ws=make(storage);
 assert.equal(ws.login({email:'bad-address',provider:'email'}),false);
 assert.equal(ws.login({email:'a'.repeat(250)+'@example.com',provider:'email'}),false);
 assert.equal(ws.login({email:'alex@example.com',provider:'unknown'}),false);
 assert.equal(ws.login({email:'  Alex.Design@Example.COM  ',provider:'email'}),true);
 assert.equal(ws.getState().session.email,'alex.design@example.com');assert.equal(ws.getState().session.name,'alex design');
 assert.equal(ws.getState().session.authMode,'prototype');
 ws.logout();const again=make(storage);
 assert.equal(again.getState().session.signedIn,false);assert.equal(again.getState().session.provider,'email');
 assert.equal(again.login({email:'designer@example.com',provider:'google',name:'Demo Designer'}),true);
 const profile=make(storage).getState().session;assert.equal(profile.provider,'google');assert.equal(profile.name,'Demo Designer');assert.equal(profile.authMode,'prototype');
});
test('older name-only identities migrate to explicit prototype fields',()=>{
 const storage=memory();storage.setItem('fileo-workspace-v2',JSON.stringify({version:2,files:[],session:{signedIn:true,name:'Taylor',sort:'size',autoplay:false}}));
 const p=make(storage).getState().session;assert.equal(p.email,'');assert.equal(p.provider,'demo');assert.equal(p.authMode,'prototype');assert.equal(p.name,'Taylor');assert.equal(p.signedIn,true);
});
test('ordered review queues preserve scope, focus, cursor and deferred files across reload',()=>{
 const storage=memory(),ws=make(storage);ws.loadDemo();ws.finishAnalysis();
 const review=ws.startReview(['file-5','missing','file-2','file-5','file-4'],{focusId:'file-2',returnTo:'#files?bucket=trash'});
 assert.deepEqual(review.ids,['file-5','file-2','file-4']);assert.equal(review.cursor,1);assert.equal(ws.getState().resumeId,'file-2');
 assert.equal(ws.deferReview('file-5'),true);assert.equal(ws.deferReview('missing'),false);assert.equal(ws.deferReview('file-5'),false);
 ws.setReviewCursor(2);const resumed=make(storage);assert.deepEqual(resumed.getState().review,{ids:['file-5','file-2','file-4'],cursor:2,returnTo:'#files?bucket=trash',deferred:['file-5']});
 assert.equal(resumed.getState().resumeId,'file-4');resumed.resetReviewDeferrals();assert.deepEqual(resumed.getState().review.deferred,[]);
});
test('review cursor has explicit boundaries and completed sentinel rather than wrapping',()=>{
 const ws=make();ws.loadDemo();ws.startReview(['file-1','file-2']);
 assert.equal(ws.setReviewCursor(NaN),false);assert.equal(ws.setReviewCursor(1.2),false);
 ws.setReviewCursor(-1);assert.equal(ws.getState().review.cursor,0);
 ws.setReviewCursor(100);assert.equal(ws.getState().review.cursor,2);
 assert.equal(ws.getState().resumeId,'file-1');
 ws.decide('file-1','keep');ws.setReviewCursor(0);assert.equal(ws.getState().resumeId,'file-2');
});
test('review migration discards foreign IDs and unsafe return routes while preserving selected files',()=>{
 const storage=memory(),ws=make(storage);ws.loadDemo();const raw=ws.getState();
 raw.review={ids:['missing','file-2','file-1'],cursor:2,returnTo:'javascript:alert(1)',deferred:['missing','file-2','file-8']};storage.setItem('fileo-workspace-v2',JSON.stringify(raw));
 const review=make(storage).getState().review;assert.deepEqual(review,{ids:['file-2','file-1'],cursor:1,returnTo:'#files',deferred:['file-2']});
});
test('duplicate re-import repairs thumbnails without resetting decisions, analysis or history',()=>{
 const storage=memory(),ws=make(storage),original=input('large-photo.JPG',{type:'',size:7000000});
 const first=ws.importFiles([original]);ws.finishAnalysis();const id=first.ids[0],event=ws.decide(id,'archive',{use:'later'});
 const thumbnail='data:image/webp;base64,YWJj',repair=ws.importFiles([{...original,previewData:thumbnail,previewKey:'preview-key',previewStatus:'ready',width:4000,height:3000,previewVolatile:false}]);
 assert.deepEqual(repair,{added:0,skipped:1,ids:[],repaired:1,repairedIds:[id]});
 const current=ws.getState();assert.equal(current.analysis.status,'done');assert.equal(current.history.length,1);assert.equal(current.files[0].decision,'archive');assert.equal(current.files[0].bucket,'keep');assert.equal(current.files[0].app,'Image');assert.equal(current.files[0].previewData,thumbnail);assert.equal(ws.canUndo(event.id),true);
 const persisted=make(storage).getState().files[0];assert.equal(persisted.previewKey,'preview-key');assert.equal(persisted.width,4000);assert.equal(persisted.height,3000);assert.equal(persisted.previewStatus,'ready');
 assert.equal(ws.importFiles([{...original,previewData:thumbnail,previewKey:'preview-key',previewStatus:'ready',width:4000,height:3000,previewVolatile:false}]).repaired,0);
});
test('failed preview retries preserve existing previews and unsafe preview metadata is rejected',()=>{
 const ws=make(),original=input('photo.png',{type:'image/png',previewData:'data:image/png;base64,YWJj',previewStatus:'ready'});ws.importFiles([original]);ws.finishAnalysis();
 const result=ws.importFiles([{...original,previewData:null,previewStatus:'unreadable',previewError:'Could not read image.'}]);assert.equal(result.repaired,0);assert.equal(ws.getState().files[0].previewStatus,'ready');
 ws.importFiles([input('broken.heic',{previewStatus:'unsupported',previewError:'This browser cannot preview HEIC.',width:-1,height:Infinity,previewData:'data:image/svg+xml;base64,YWJj'})]);
 const file=ws.getState().files[1];assert.equal(file.previewData,undefined);assert.equal(file.width,undefined);assert.equal(file.previewStatus,'unsupported');assert.equal(file.app,'Image');
});

test('older demo image assets migrate to WebP without changing local previews or saved decisions',()=>{
 const storage=memory(),ws=make(storage);ws.loadDemo();ws.finishAnalysis();
 const decision=ws.decide('file-4','archive');ws.toggleSaved('file-1');
 const imported=ws.importFiles([input('chair.png',{type:'image/png',previewData:'data:image/png;base64,YWJj',previewStatus:'ready'})]);
 const raw=ws.getState();
 for(const [id,image] of [['file-1','landscape.png'],['file-4','chair.png'],['file-10','sculpture.png'],['file-7','custom.png']])raw.files.find(f=>f.id===id).image=image;
 raw.files.find(f=>f.id===imported.ids[0]).image='chair.png';
 storage.setItem('fileo-workspace-v2',JSON.stringify(raw));
 const restored=make(storage),state=restored.getState(),lookup=id=>state.files.find(f=>f.id===id);
 assert.equal(lookup('file-1').image,'landscape.webp');assert.equal(lookup('file-4').image,'chair.webp');assert.equal(lookup('file-10').image,'sculpture.webp');
 assert.equal(lookup('file-7').image,'custom.png');
 assert.equal(lookup(imported.ids[0]).image,undefined);assert.equal(lookup(imported.ids[0]).previewData,'data:image/png;base64,YWJj');
 assert.equal(lookup('file-4').decision,'archive');assert.deepEqual(state.saved,['file-1']);assert.equal(restored.canUndo(decision.id),true);
});
