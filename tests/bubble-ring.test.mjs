import test from 'node:test';
import assert from 'node:assert/strict';
import {buildRibbonLayout} from '../dist/bubble-ring.js';

const ids=['keep','archive','trash','undecided'];
const labels=['Keep','Archive','Trash','Undecided'];
const groups=shares=>shares.map((share,i)=>({id:ids[i],label:labels[i],count:share>0?1:0,size:share>0?share*100:0,share}));
const near=(a,b,tolerance=1e-7)=>assert.ok(Math.abs(a-b)<=tolerance,`${a} is not near ${b}`);

function assertFinite(layout){
 for(const segment of layout){
  for(const key of ['share','start','end','headX','headY','headRadius','arrowRotation','fontSize'])assert.ok(Number.isFinite(segment[key]),`${segment.id}.${key} must remain finite`);
  for(const key of ['bodyPath','headPath','headEdgePath','labelPath'])assert.ok(typeof segment[key]==='string'&&!/NaN|Infinity/.test(segment[key]),`${segment.id}.${key} must be valid SVG path data`);
  assert.ok(segment.share>=0&&segment.share<=1);
  assert.ok(segment.headX-segment.headRadius>=0&&segment.headX+segment.headRadius<=1000,'Rounded heads must fit horizontally');
  assert.ok(segment.headY-segment.headRadius>=0&&segment.headY+segment.headRadius<=580,'Rounded heads must fit vertically');
 }
}

test('ribbon bodies retain true data proportions while rounded heads overlap only the boundary',()=>{
 const shares=[.42,.187,.27,.123],layout=buildRibbonLayout(groups(shares));assertFinite(layout);
 near(layout.reduce((sum,s)=>sum+s.share,0),1);
 for(let i=0;i<layout.length;i++){
  const s=layout[i];near(s.share,shares[i]);near(s.end-s.start,shares[i]*Math.PI*2);
  if(i)near(s.start,layout[i-1].end);
  near(Math.hypot(s.headX-500,s.headY-288),214);
  near(s.headX,500+214*Math.cos(s.end));near(s.headY,288+214*Math.sin(s.end));
  assert.equal(s.headRadius,36);assert.ok(s.headPath.endsWith(' Z'));assert.ok(s.labelFits);
 }
 near(layout.at(-1).end-layout[0].start,Math.PI*2);
});

test('head arrows and curved labels follow the user-marked Keep, Archive, Trash and Undecided directions',()=>{
 const layout=buildRibbonLayout(groups([.42,.187,.27,.123]));
 assert.deepEqual(layout.map(s=>s.reverse),[true,true,false,false]);
 for(const s of layout){
  near(s.arrowRotation,s.end*180/Math.PI+90+(s.reverse?45:-45));
  const first=/^M([-\d.]+) ([-\d.]+)/.exec(s.labelPath);
  assert.ok(first,'Each visible label needs a curved path');
  const labelX=Number(first[1])-500,labelY=Number(first[2])-288;
  const turn=Math.PI*2,span=s.end-s.start;
  const fromStart=((Math.atan2(labelY,labelX)-s.start)%turn+turn)%turn;
  assert.ok(fromStart>0&&fromStart<span,'The label path must start inside its own category');
  assert.ok(s.reverse?span-fromStart<fromStart:fromStart<span-fromStart,
   s.reverse?'Reversed text must start nearer the rounded head':'Forward text must start nearer the tail');
  assert.ok(Math.hypot(labelX,labelY)>178&&Math.hypot(labelX,labelY)<250,'Text must stay within the colored ribbon');
  const sweep=/ A[\d.]+ [\d.]+ 0 [01] ([01]) /.exec(s.labelPath);
  assert.equal(Number(sweep[1]),s.reverse?0:1,'Reversed labels must travel counterclockwise');
 }
 // Default arrows follow the four annotations, not a global northeast icon.
 assert.ok(layout[0].arrowRotation>180&&layout[0].arrowRotation<225);
 assert.ok(layout[1].arrowRotation>250&&layout[1].arrowRotation<280);
 assert.ok(layout[2].arrowRotation>260&&layout[2].arrowRotation<290);
 near(layout[3].arrowRotation,315);
});

test('zero and tiny categories do not grow fake shares or lose the fallback label; full-circle projects remain drawable',()=>{
 const cases=[[0,0,0,0],[1,0,0,0],[0,1,0,0],[0,0,1,0],[0,0,0,1],[.9997,.0001,.0001,.0001]];
 for(const shares of cases){
  const layout=buildRibbonLayout(groups(shares));assertFinite(layout);
  near(layout.reduce((sum,s)=>sum+s.share,0),shares.some(Boolean)?1:0);
  layout.forEach((s,i)=>{
   if(!shares[i]){near(s.share,0);assert.equal(s.bodyPath,'');assert.equal(s.headPath,'');assert.equal(s.labelFits,false);}
   else if(s.share===1){assert.equal((s.bodyPath.match(/ A/g)||[]).length,4,'A full annulus needs two arcs for each edge');assert.equal(s.headPath,'');assert.ok(s.labelFits);}
   else if(s.share<.001){assert.ok(s.bodyPath);assert.equal(s.headRadius,0);assert.equal(s.headPath,'');assert.equal(s.labelFits,false);assert.equal(s.labelPath,'');}
  });
 }
});

test('invalid or extreme finite shares cannot corrupt geometry, lose valid evidence or mutate supplied data',()=>{
 for(const shares of [[NaN,Infinity,-.5,.25],[Number.MAX_VALUE,Number.MAX_VALUE,1,0],[1e-300,1e-300,1e-300,1e-300]]){
  const input=groups(shares),before=input.map(g=>({...g})),layout=buildRibbonLayout(input);assertFinite(layout);
  assert.deepEqual(input,before);near(layout.reduce((sum,s)=>sum+s.share,0),1);
 }
 assert.deepEqual(buildRibbonLayout(null),[]);
 assert.deepEqual(buildRibbonLayout([]),[]);
});
