import test from 'node:test';
import assert from 'node:assert/strict';
import {createPreviewQueue,previewTrashTargets} from '../dist/quick-preview-model.js';

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
