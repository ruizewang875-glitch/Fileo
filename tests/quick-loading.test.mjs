import test from 'node:test';
import assert from 'node:assert/strict';
import {createOverviewSequence} from '../dist/quick-loading.js';

function harness(){
 let time=0,nextId=0;const timers=new Map(),events=[];
 const controller=createOverviewSequence({onPhase:phase=>events.push({phase,time}),onScan:scan=>events.push({scan,time}),setTimer:(fn,delay)=>{const id=++nextId;timers.set(id,{fn,at:time+delay});return id;},clearTimer:id=>timers.delete(id)});
 function advance(end){for(;;){const next=[...timers].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;timers.delete(next[0]);time=next[1].at;next[1].fn();}time=end;}
 return {controller,events,advance,timers};
}
test('overview precedes file preparation; totals resolve before list reveal',()=>{
 const h=harness(),files=Array.from({length:21},(_,i)=>({id:String(i)}));h.controller.start(files);
 assert.equal(h.events[0].phase,'overview');h.advance(2199);
 assert.deepEqual(h.events.filter(e=>e.phase).map(e=>e.phase),['overview','scanning']);
 const scans=h.events.filter(e=>e.scan).map(e=>e.scan);
 assert.equal(scans.at(-1).checked,21);assert.equal(scans.at(-1).file,files[20]);
 assert.ok(scans.every((s,i)=>i===0||s.checked>scans[i-1].checked));
 h.advance(2200);assert.equal(h.events.at(-1).phase,'resolved');
 h.advance(2520);assert.equal(h.events.at(-1).phase,'ready');assert.equal(h.timers.size,0);
});
test('leaving cancels every phase and changing project rejects old scan updates',()=>{
 const h=harness();h.controller.start([{id:'old'}]);h.advance(400);h.controller.cancel();
 const count=h.events.length;h.advance(5000);assert.equal(h.events.length,count);
 h.controller.start([{id:'new'}]);h.advance(5400);h.controller.start([{id:'latest'}]);h.events.length=0;
 h.advance(9000);assert.ok(h.events.filter(e=>e.scan).every(e=>e.scan.file.id==='latest'));
 assert.equal(h.events.filter(e=>e.phase==='ready').length,1);
});
test('reduced motion and empty projects expose data immediately without timers',()=>{
 for(const [files,options] of [[[{id:'x'}],{reducedMotion:true}],[[],{}]]){
  const h=harness();h.controller.start(files,options);assert.deepEqual(h.events,[{phase:'ready',time:0}]);assert.equal(h.timers.size,0);
 }
});
