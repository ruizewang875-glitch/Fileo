import test from 'node:test';
import assert from 'node:assert/strict';
import {createPreviewQueue,previewTrashTargets,previewAfterTrash} from '../dist/quick-preview-model.js';
import {createWorkspace} from '../dist/workspace.js';

const files=[{id:'first',decision:'pending'},{id:'second',decision:'archive'},{id:'current',decision:'pending'},{id:'trashed',decision:'trash'}];

test('individual preview starts at the clicked file and retains the filtered list order',()=>{
 const scope=[files[1],files[2]];
 const queue=createPreviewQueue(scope,'current');
 assert.deepEqual(queue,{ids:['second','current'],index:1});
 assert.deepEqual(createPreviewQueue(scope,'first'),{ids:[],index:0});
 assert.deepEqual(createPreviewQueue([],undefined),{ids:[],index:0});
 assert.deepEqual(scope,[files[1],files[2]]);
});

test('selection preview preserves its starting queue even when caller selection changes',()=>{
 const selection=[files[0],files[1]];
 const queue=createPreviewQueue(selection);
 selection.pop();
 assert.deepEqual(queue,{ids:['first','second'],index:0});
});

test('bulk deletion targets only selected files, excluding the current unselected preview',()=>{
 assert.deepEqual(previewTrashTargets(files,'current',['first','second']),{ids:['first','second'],batch:true});
 assert.deepEqual(previewTrashTargets(files,'trashed',['first','second']),{ids:['first','second'],batch:true});
});

test('zero or one valid selection acts on the current file and filters stale or trashed IDs',()=>{
 assert.deepEqual(previewTrashTargets(files,'current',[]),{ids:['current'],batch:false});
 assert.deepEqual(previewTrashTargets(files,'current',['first']),{ids:['current'],batch:false});
 assert.deepEqual(previewTrashTargets(files,'current',['first','first','trashed','other-project']),{ids:['current'],batch:false});
 assert.deepEqual(previewTrashTargets(files,'trashed',['first']),{ids:[],batch:false});
 assert.deepEqual(previewTrashTargets([], 'current',['first','second']),{ids:[],batch:false});
});

test('after deletion, preview advances in its original scope and skips unavailable files',()=>{
 const queue=['first','second','gone','current','trashed'];
 const updated=files.map(file=>file.id==='second'?{...file,decision:'trash'}:file);
 assert.deepEqual(previewAfterTrash(queue,'second',updated),{ids:['first','current'],index:1});
 assert.deepEqual(queue,['first','second','gone','current','trashed']);
 // Different project/ranking additions must not enter an existing preview.
 assert.deepEqual(previewAfterTrash(['second','current'],'second',[{id:'outside',decision:'pending'},...updated]),{ids:['current'],index:0});
});

test('deleting the last item continues at the nearest previous file, then completes inside the preview',()=>{
 const updated=files.map(file=>file.id==='current'?{...file,decision:'trash'}:file);
 assert.deepEqual(previewAfterTrash(['first','second','current'],'current',updated),{ids:['first','second'],index:1});
 assert.deepEqual(previewAfterTrash(['current'],'current',updated),{ids:[],index:0});
 assert.deepEqual(previewAfterTrash(['missing'],'missing',updated),{ids:[],index:0});
});

test('real workspace Trash updates supply the next preview and remain undoable',()=>{
 const data=new Map(),ws=createWorkspace({storage:{getItem:key=>data.get(key)||null,setItem:(key,value)=>data.set(key,value)}});
 const imported=ws.importFiles([{name:'first.png',size:1000,lastModified:1,type:'image/png'},{name:'second.png',size:2000,lastModified:2,type:'image/png'}],{project:'Preview'});
 ws.finishAnalysis();
 const [first,second]=imported.ids;
 const event=ws.decide([first],'trash');
 assert.ok(event);
 assert.deepEqual(previewAfterTrash(imported.ids,first,ws.getState().files),{ids:[second],index:0});
 assert.equal(ws.getState().files.find(file=>file.id===second).decision,'pending');
 assert.ok(ws.undo(event.id));
 assert.equal(ws.getState().files.find(file=>file.id===first).decision,'pending');
});
