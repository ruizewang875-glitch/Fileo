import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorkspace} from '../dist/workspace.js';
import {allTypePermissions} from '../dist/privacy.js';
import {getOverview} from '../dist/data.js';
import {isActiveFile} from '../dist/file-lifecycle.js';
import {buildRibbonLayout} from '../dist/bubble-ring.js';

const NOW=Date.UTC(2026,10,9),PROJECT='Studio semester';
const near=(a,b,tolerance=1e-7)=>assert.ok(Math.abs(a-b)<=tolerance,`${a} is not near ${b}`);
function setup(){
 const values=new Map(),storage={getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)};
 const ws=createWorkspace({storage,now:()=>NOW});
 ws.setPrivacy(allTypePermissions(true));ws.loadDemo();ws.finishAnalysis();
 return {ws,storage};
}
function scene(ws){
 const files=ws.getState().files.filter(f=>f.project===PROJECT&&isActiveFile(f));
 const overview=getOverview(files);
 const groups=overview.buckets.map(b=>({...b,share:b.spacePercent/100}));
 const layout=buildRibbonLayout(groups);
 for(let i=0;i<groups.length;i++){
  const data=groups[i],segment=layout[i];
  near(segment.share,data.share);assert.equal(segment.count,data.count);near(segment.size,data.size);
  if(data.count){
   assert.equal(segment.headRadius,36);assert.equal(segment.headDepth,36);
   assert.ok(segment.labelFits,'Preference changes must retain a readable on-ring category name');
  }
 }
 near(layout.reduce((sum,s)=>sum+s.displayShare,0),1);
 return {overview,layout,byId:Object.fromEntries(layout.map(s=>[s.id,s]))};
}
const geometry=({layout})=>layout.map(({id,displayShare,bodyPath,headPath,labelPath})=>({id,displayShare,bodyPath,headPath,labelPath}));

test('saved preferences visibly resize both small categories, and toggling back or reloading retains the right geometry',()=>{
 const {ws,storage}=setup();
 ws.setProjectPreferences(PROJECT,['Preserve drafts']);
 const before=scene(ws);
 near(before.byId.archive.size,87.83);near(before.byId.undecided.size,81.503);
 assert.equal(before.byId.archive.count,8);assert.equal(before.byId.undecided.count,5);

 ws.setProjectPreferences(PROJECT,['Preserve drafts','Free up space']);
 const after=scene(ws);
 near(after.overview.totalSize,before.overview.totalSize);
 assert.equal(after.overview.totalCount,before.overview.totalCount);
 near(after.byId.archive.size,155.83);near(after.byId.undecided.size,13.503);
 assert.equal(after.byId.archive.count,9);assert.equal(after.byId.undecided.count,4);
 assert.ok(after.byId.archive.share>before.byId.archive.share);
 assert.ok(after.byId.undecided.share<before.byId.undecided.share);
 assert.ok(after.byId.archive.displayShare>before.byId.archive.displayShare,'The archive increase must remain visible even below its readable-width allowance');
 assert.ok(after.byId.undecided.displayShare<before.byId.undecided.displayShare,'The Undecided decrease must not disappear behind a hard visual floor');
 for(const id of ['archive','undecided'])assert.notEqual(after.byId[id].bodyPath,before.byId[id].bodyPath,`${id} must redraw after its recommendation totals change`);

 const restored=createWorkspace({storage,now:()=>NOW});
 assert.deepEqual(restored.getProjectPreferences(PROJECT),['Preserve drafts','Free up space']);
 assert.deepEqual(geometry(scene(restored)),geometry(after),'Reload uses the saved preferences and matching ring geometry');

 restored.setProjectPreferences(PROJECT,['Preserve drafts']);
 const reverted=scene(restored);
 assert.deepEqual(geometry(reverted),geometry(before),'Removing the preference restores the earlier ring without stale layout state');
 const restoredAgain=createWorkspace({storage,now:()=>NOW});
 assert.deepEqual(geometry(scene(restoredAgain)),geometry(before));
});

test('a preference that adds context without changing demo categories does not manufacture ring movement',()=>{
 const {ws,storage}=setup(),before=scene(ws);
 ws.setProjectPreferences(PROJECT,['Keep final work']);
 const after=scene(ws);
 assert.deepEqual(after.overview,before.overview,'The demo final files were already Keep');
 assert.deepEqual(geometry(after),geometry(before),'Stable category totals must produce stable geometry');
 const restored=createWorkspace({storage,now:()=>NOW});
 assert.deepEqual(restored.getProjectPreferences(PROJECT),['Keep final work']);
 assert.deepEqual(geometry(scene(restored)),geometry(before));
});
