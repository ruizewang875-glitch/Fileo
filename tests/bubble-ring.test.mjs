import test from 'node:test';
import assert from 'node:assert/strict';
import {buildBubbleLayout} from '../dist/bubble-ring.js';

const ids=['keep','archive','trash','undecided'];
const groups=shares=>shares.map((share,i)=>({id:ids[i],label:ids[i],color:'#9278b1',count:share>0?1:0,size:share>0?share*100:0,share}));
const near=(a,b,tolerance=1e-7)=>assert.ok(Math.abs(a-b)<=tolerance,`${a} is not near ${b}`);

function assertUsable(layout){
 assert.equal(layout.length,4);
 for(const bubble of layout){
  for(const key of ['x','y','anchorX','anchorY','radius','start','end','angle','share'])assert.ok(Number.isFinite(bubble[key]),`${bubble.id}.${key} must remain finite`);
  assert.ok(bubble.radius>=44,'Bubbles must remain substantial targets at desktop scale');
  assert.ok(bubble.x-bubble.radius>=0&&bubble.x+bubble.radius<=1000,`${bubble.id} clips horizontally`);
  assert.ok(bubble.y-bubble.radius>=0&&bubble.y+bubble.radius<=590,`${bubble.id} clips vertically`);
  assert.ok(bubble.share>=0&&bubble.share<=1);
  assert.ok(typeof bubble.path==='string'&&!/NaN|Infinity/.test(bubble.path));
 }
 for(let i=0;i<layout.length;i++)for(let j=i+1;j<layout.length;j++){
  const a=layout[i],b=layout[j];
  assert.ok(Math.hypot(a.x-b.x,a.y-b.y)>=a.radius+b.radius+2,`${a.id} and ${b.id} overlap`);
 }
}

test('donut sectors preserve project proportions and anchors stay on their own sector',()=>{
 const shares=[0.42,0.187,0.27,0.123],layout=buildBubbleLayout(groups(shares));
 assertUsable(layout);
 near(layout.reduce((sum,b)=>sum+b.share,0),1);
 for(let i=0;i<layout.length;i++){
  const b=layout[i];near(b.share,shares[i]);near(b.end-b.start,shares[i]*Math.PI*2);
  if(i)near(b.start,layout[i-1].end);
  const anchorAngle=Math.atan2(b.anchorY-286,b.anchorX-500),turn=Math.PI*2;
  const fromStart=((anchorAngle-b.start)%turn+turn)%turn;
  assert.ok(fromStart<=b.end-b.start+1e-7,`${b.id} neck points at another sector`);
 }
 near(layout.at(-1).end-layout[0].start,Math.PI*2);
});

test('empty, all-off, and overwhelmingly uneven projects retain separate visible category bubbles',()=>{
 const cases=[[0,0,0,0],[1,0,0,0],[0,1,0,0],[0,0,1,0],[0,0,0,1],[1,1,1,1],[.9997,.0001,.0001,.0001],[.0001,.4999,.0001,.4999]];
 for(const shares of cases){
  const layout=buildBubbleLayout(groups(shares));assertUsable(layout);
  layout.forEach((b,i)=>{if(shares[i]===0){near(b.share,0);assert.equal(b.path,'');}});
  near(layout.reduce((sum,b)=>sum+b.share,0),shares.some(Boolean)?1:0);
 }
});

test('changing project distributions cannot stack category bubbles or clip them outside the chart',()=>{
 let seed=731;
 const random=()=>{seed=(seed*16807)%2147483647;return (seed-1)/2147483646;};
 for(let sample=0;sample<120;sample++){
  const shares=ids.map(()=>random()<.2?0:random()**5);
  assertUsable(buildBubbleLayout(groups(shares)));
 }
});

test('invalid share evidence does not create broken SVG geometry or mutate the supplied categories',()=>{
 const input=groups([NaN,Infinity,-.5,.25]);
 const before=input.map(g=>({...g})),layout=buildBubbleLayout(input);assertUsable(layout);
 assert.deepEqual(input,before);
 assert.ok(layout.every(b=>Number.isFinite(b.share)));
 assert.ok(layout.some(b=>b.id==='undecided'&&b.share>0),'Valid data must survive invalid peers');
});
