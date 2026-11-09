import test from 'node:test';
import assert from 'node:assert/strict';
import {buildRibbonLayout} from '../dist/bubble-ring.js';

const TAU=Math.PI*2,R=214;
const ids=['keep','archive','trash','undecided'];
const labels=['Keep','Archive','Trash','Undecided'];
const groups=shares=>shares.map((share,i)=>({id:ids[i],label:labels[i],count:share>0?1:0,size:share>0?share*100:0,share}));
const near=(a,b,tolerance=1e-7)=>assert.ok(Math.abs(a-b)<=tolerance,`${a} is not near ${b}`);

function assertFinite(layout){
 for(const s of layout){
  for(const key of ['share','displayShare','start','end','headX','headY','headRadius','headDepth','arrowRotation','fontSize'])assert.ok(Number.isFinite(s[key]),`${s.id}.${key} must remain finite`);
  for(const key of ['bodyPath','headPath','headEdgePath','labelPath'])assert.ok(typeof s[key]==='string'&&!/NaN|Infinity/.test(s[key]),`${s.id}.${key} must be valid SVG path data`);
  assert.ok(s.share>=0&&s.share<=1);
  assert.ok(s.displayShare>=0&&s.displayShare<=1);
  assert.ok(s.headX-s.headRadius>=0&&s.headX+s.headRadius<=1000);
  assert.ok(s.headY-s.headRadius>=0&&s.headY+s.headRadius<=580);
 }
}

function assertReadableRoundedSegments(layout){
 const active=layout.filter(s=>s.displayShare>0);
 near(active.reduce((sum,s)=>sum+s.displayShare,0),active.length?1:0);
 for(let i=0;i<layout.length;i++){
  const s=layout[i];
  near(s.end-s.start,s.displayShare*TAU);
  if(i)near(s.start,layout[i-1].end);
  if(!s.displayShare){assert.equal(s.bodyPath,'');assert.equal(s.headPath,'');assert.equal(s.labelPath,'');continue;}
  assert.ok(s.bodyPath);
  assert.ok(s.labelFits,'Every visible category keeps its name on the ring');
  assert.ok(s.fontSize>=20,'A small category must not become unreadable');
  near(s.headX,500+R*Math.cos(s.end));near(s.headY,288+R*Math.sin(s.end));
  if(active.length===1){assert.equal(s.headPath,'');continue;}
  assert.equal(s.headRadius,36,'Every partial segment retains the same round head');
  assert.equal(s.headDepth,36,'Neighboring small categories must not flatten a head');
  assert.ok(/A36 36(?:\s|$)/.test(s.headPath),'The cap must be circular, not elliptical');
  assert.ok(s.headPath.endsWith(' Z'));
  const points=[...s.labelPath.matchAll(/(?:^M| )([-\d.]+) ([-\d.]+)(?= A|$)/g)];
  assert.ok(points.length>=2,'Label path exposes both ends');
  const angles=points.map(match=>{
   const x=Number(match[1])-500,y=Number(match[2])-288;
   assert.ok(Math.hypot(x,y)>178&&Math.hypot(x,y)<250,'Text remains inside its own ribbon');
   return ((Math.atan2(y,x)-s.start)%TAU+TAU)%TAU;
  });
  const low=Math.min(...angles),high=Math.max(...angles),span=s.end-s.start;
  assert.ok(low>=.20-1e-5,'Text clears the previous category’s round cap');
  assert.ok(span-high>=.12-1e-5,'Text clears the arrow centered on its own head');
  const sweep=/ A[\d.]+ [\d.]+ 0 [01] ([01]) /.exec(s.labelPath);
  assert.equal(Number(sweep[1]),s.reverse?0:1);
  near(s.arrowRotation,s.end*180/Math.PI+90+(s.reverse?45:-45));
 }
}

test('normal categories retain true numeric shares and form one continuous, readable ring',()=>{
 const shares=[.42,.187,.27,.123],input=groups(shares),before=input.map(g=>({...g}));
 const layout=buildRibbonLayout(input);assertFinite(layout);assertReadableRoundedSegments(layout);
 assert.deepEqual(input,before);
 for(let i=0;i<layout.length;i++)near(layout[i].share,shares[i]);
 near(layout.at(-1).end-layout[0].start,TAU);
 assert.deepEqual(layout.map(s=>s.reverse),[true,true,false,false],'The familiar four labels retain their intended reading directions');
});

test('the 2.1% Undecided case retains round heads, an arrow and an on-ring label without changing data',()=>{
 const sizes=[627.967,430.83,404.2,31.503],counts=[15,12,5,5],total=sizes.reduce((sum,n)=>sum+n,0);
 const input=groups(sizes.map(size=>size/total)).map((g,i)=>({...g,count:counts[i],size:sizes[i]}));
 const layout=buildRibbonLayout(input);assertFinite(layout);assertReadableRoundedSegments(layout);
 const undecided=layout[3];near(undecided.share,.02107929073268651);
 assert.equal(undecided.count,5);assert.equal(undecided.size,31.503);
 assert.ok(undecided.displayExpanded);assert.ok(undecided.displayShare>undecided.share);
 for(let i=0;i<layout.length;i++){
  near(layout[i].share,input[i].share);assert.equal(layout[i].count,counts[i]);assert.equal(layout[i].size,sizes[i]);
 }
 assert.equal(layout[2].headDepth,36,'Trash stays fully rounded beside Undecided');
});

test('tiny slices stay rounded and readable at every boundary, including three adjacent tiny categories',()=>{
 const cases=[[.9997,.0001,.0001,.0001],[.99,0,.01,0],[0,.99,0,.01],[.01,0,.99,0]];
 for(let tinyIndex=0;tinyIndex<4;tinyIndex++){const shares=[.33,.33,.33,.33];shares[tinyIndex]=.01;cases.push(shares);}
 for(const shares of cases){
  const input=groups(shares),layout=buildRibbonLayout(input);assertFinite(layout);assertReadableRoundedSegments(layout);
  layout.forEach((s,i)=>{near(s.share,shares[i]);if(shares[i]>0&&shares[i]<.02)assert.ok(s.displayExpanded);});
 }
});

test('empty categories stay empty and single-category projects remain full annuli',()=>{
 for(const shares of [[0,0,0,0],[1,0,0,0],[0,1,0,0],[0,0,1,0],[0,0,0,1]]){
  const layout=buildRibbonLayout(groups(shares));assertFinite(layout);assertReadableRoundedSegments(layout);
  layout.forEach((s,i)=>{
   near(s.share,shares[i]);near(s.displayShare,shares[i]);
   if(!shares[i]){assert.equal(s.labelFits,false);assert.equal(s.headRadius,0);}
   else assert.equal((s.bodyPath.match(/ A/g)||[]).length,4,'A full annulus needs two arcs for each edge');
  });
 }
});

test('invalid and extreme finite values cannot corrupt geometry or mutate input data',()=>{
 for(const shares of [[NaN,Infinity,-.5,.25],[Number.MAX_VALUE,Number.MAX_VALUE,1,0],[1e-300,1e-300,1e-300,1e-300]]){
  const input=groups(shares),before=input.map(g=>({...g})),layout=buildRibbonLayout(input);assertFinite(layout);
  assert.deepEqual(input,before);near(layout.reduce((sum,s)=>sum+s.share,0),1);
  near(layout.reduce((sum,s)=>sum+s.displayShare,0),1);
 }
 assert.deepEqual(buildRibbonLayout(null),[]);assert.deepEqual(buildRibbonLayout([]),[]);
});
