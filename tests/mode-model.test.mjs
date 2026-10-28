import test from 'node:test';
import assert from 'node:assert/strict';
import {projectFiles,rankFiles,calculateStats} from '../dist/mode-model.js';
import {createWorkspace} from '../dist/workspace.js';

const memory=()=>{const data=new Map();return {getItem:key=>data.get(key)||null,setItem:(key,value)=>data.set(key,value)};};
const NOW=Date.parse('2026-10-28T12:00:00Z');
const input=(name='chair.3dm')=>({name,size:1200000,lastModified:NOW,type:'application/octet-stream'});
const file=(id,bucket,size,decision='pending',project='A')=>({id,bucket,size,decision,project});

test('project filters never leak files when scope is missing or unknown',()=>{
 const files=[file('a','trash',5,'pending','A'),file('b','keep',8,'pending','B')];
 assert.deepEqual(projectFiles(files,'A').map(f=>f.id),['a']);
 assert.deepEqual(projectFiles(files,''),[]);assert.deepEqual(projectFiles(files,'missing'),[]);
});

test('cleanup ordering promotes pending trash and archive ahead of other files and completed work',()=>{
 const files=[file('kept','keep',10000),file('done','trash',100000,'trash'),file('archive','archive',300),file('smaller','trash',10),file('uncertain','undecided',500),file('larger','trash',50),file('same-size','trash',50)];
 const ordered=rankFiles(files);
 assert.deepEqual(ordered.map(f=>f.id),['larger','same-size','smaller','archive','uncertain','kept','done']);
 assert.equal(files[0].id,'kept');
});

test('potential cleanup excludes completed decisions and distinguishes recommendation from actual status',()=>{
 const stats=calculateStats([file('a','trash',20),file('b','trash',30,'keep'),file('c','trash',40,'trash'),file('d','archive',50),file('e','keep',60,'archive')]);
 assert.equal(stats.totalCount,5);assert.equal(stats.totalSize,200);
 assert.equal(stats.potentialTrash,20);assert.equal(stats.potentialArchive,50);
 assert.equal(stats.inTrashSize,40);assert.equal(stats.archivedSize,60);
 assert.equal(stats.pendingCount,2);assert.equal(stats.reviewedCount,3);
 assert.equal(stats.byBucket.trash.count,3);assert.equal(stats.byBucket.trash.size,90);
 assert.equal(stats.byBucket.trash.spacePercent,45);
 assert.ok(calculateStats([]).buckets.every(b=>b.filePercent===0&&b.spacePercent===0));
});

test('mode and selected project persist across signout and reload',()=>{
 const storage=memory(),ws=createWorkspace({storage,now:()=>NOW});
 assert.equal(ws.getState().session.mode,'quick');assert.equal(ws.getState().session.project,'');
 ws.login('Alex');ws.importFiles([input()],{project:'Furniture'});ws.finishAnalysis();
 ws.importFiles([input('poster.ai')],{project:'Graphics'});ws.finishAnalysis();
 ws.updateProfile({mode:'explore',project:'Furniture'});ws.logout();
 const again=createWorkspace({storage}).getState();
 assert.equal(again.session.mode,'explore');assert.equal(again.session.project,'Furniture');assert.equal(again.session.signedIn,false);
});

test('unknown modes and nonexistent project switches cannot broaden or corrupt scope',()=>{
 const storage=memory(),ws=createWorkspace({storage,now:()=>NOW});
 ws.importFiles([input()],{project:'Furniture'});
 ws.updateProfile({mode:'everything',project:'Missing'});
 assert.equal(ws.getState().session.mode,'quick');assert.equal(ws.getState().session.project,'Furniture');
 assert.equal(ws.setProject('Missing'),false);assert.equal(ws.setProject('Furniture'),true);
 const raw=ws.getState();raw.session.mode='invalid';raw.session.project='deleted';storage.setItem('fileo-workspace-v2',JSON.stringify(raw));
 const restored=createWorkspace({storage}).getState();assert.equal(restored.session.mode,'quick');assert.equal(restored.session.project,'Furniture');
});

test('same source file can be independently managed in different projects without resetting decisions',()=>{
 const ws=createWorkspace({storage:memory(),now:()=>NOW}),source=input();
 const a=ws.importFiles([source],{project:'A'});ws.finishAnalysis();ws.decide(a.ids,'keep');
 const b=ws.importFiles([source],{project:'B'});ws.finishAnalysis();
 assert.equal(b.added,1);assert.equal(ws.getState().files.length,2);
 assert.equal(ws.importFiles([source],{project:'A'}).added,0);
 assert.equal(ws.getState().files.find(f=>f.id===a.ids[0]).decision,'keep');
 assert.equal(ws.getState().files.find(f=>f.id===b.ids[0]).decision,'pending');
});

test('demo activates one coherent project and retains original collections',()=>{
 const storage=memory(),ws=createWorkspace({storage});ws.loadDemo();
 const s=ws.getState();assert.equal(s.session.project,'Studio semester');
 assert.ok(s.files.every(f=>f.project==='Studio semester'&&f.collection));
 assert.ok(new Set(s.files.map(f=>f.collection)).size>1);
 ws.finishAnalysis();ws.updateProfile({mode:'explore'});ws.loadDemo();
 const restored=createWorkspace({storage}).getState();assert.equal(restored.session.mode,'explore');assert.equal(restored.analysis.status,'done');
});

test('new mode routes survive persisted review and cross-project history remains safely undoable',()=>{
 const storage=memory(),ws=createWorkspace({storage,now:()=>NOW});
 const a=ws.importFiles([input()],{project:'A'}),b=ws.importFiles([input()],{project:'B'});
 ws.startReview(a.ids,{returnTo:'#browse?type=3dm'});
 const first=ws.decide(a.ids,'archive');ws.setProject('B');const second=ws.decide(b.ids,'trash');
 const restored=createWorkspace({storage});assert.equal(restored.getState().review.returnTo,'#browse?type=3dm');
 assert.equal(restored.canUndo(first.id),true);restored.undo(first.id);
 assert.equal(restored.getState().files.find(f=>f.id===b.ids[0]).decision,'trash');assert.equal(restored.canUndo(second.id),true);
});
