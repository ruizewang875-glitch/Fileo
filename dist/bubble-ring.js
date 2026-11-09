import {formatStorage} from './data.js';

const NS='http://www.w3.org/2000/svg',TAU=Math.PI*2,CX=500,CY=288,R=214,W=72;
const colors={keep:['#92b9aa','#c1d8cc','#a3c5b6'],archive:['#ad94c6','#d1bfe1','#b9a3d0'],trash:['#ca8da5','#dfadc0','#d69cb3'],undecided:['#98a9c8','#c7d1e5','#acbbd7']};
const safe=n=>Number.isFinite(n)&&n>0?n:0;
const muted=color=>'#'+[1,3,5].map((offset,i)=>Math.round(parseInt(color.slice(offset,offset+2),16)*.18+[249,247,250][i]*.82).toString(16).padStart(2,'0')).join('');
const point=(radius,angle)=>[CX+radius*Math.cos(angle),CY+radius*Math.sin(angle)];
const p=xy=>xy.map(n=>Number(n.toFixed(4))).join(' ');
function arc(radius,start,end,sweep=1){
 const span=Math.abs(end-start),a=point(radius,start),b=point(radius,end);
 if(span>=TAU-.000001){const mid=point(radius,start+(sweep?1:-1)*Math.PI);return `M${p(a)} A${radius} ${radius} 0 1 ${sweep} ${p(mid)} A${radius} ${radius} 0 1 ${sweep} ${p(b)}`;}
 return `M${p(a)} A${radius} ${radius} 0 ${span>Math.PI?1:0} ${sweep} ${p(b)}`;
}
function body(start,end){
 if(end<=start)return '';
 return `${arc(R+W/2,start,end)} L${p(point(R-W/2,end))} ${arc(R-W/2,end,start,0).replace(/^M[^A]+/,'')} Z`;
}

// The ring is also a four-way selector. Give every nonempty category enough
// visual arc for a circular head, its arrow and a readable name. Keep `share`
// untouched: summaries and accessible labels always report the actual data.
const TAIL_CLEARANCE=.20,HEAD_CLEARANCE=.12,MIN_FONT=20,MAX_FONT=25;
function visualShares(list,shares){
 const active=list.map((g,i)=>shares[i]>0||safe(g.count)>0?i:-1).filter(i=>i>=0),visual=shares.map(()=>0);
 const floors=list.map(g=>Math.min((TAIL_CLEARANCE+HEAD_CLEARANCE+(String(g.label||g.id||'').length*.56*MIN_FONT+12)/(R-8))/TAU,.9/Math.max(1,active.length)));
 if(active.length===1){visual[active[0]]=1;return visual;}
 // Reserve only the space needed for the heads/labels, then distribute ALL
 // remaining space from the current data. A hard floor hid changes whenever
 // two small categories traded files while the larger categories stayed equal.
 const reserved=active.reduce((sum,i)=>sum+floors[i],0),remaining=1-reserved;
 const totalShare=active.reduce((sum,i)=>sum+shares[i],0);
 const totalCount=active.reduce((sum,i)=>sum+safe(list[i].count),0);
 for(const i of active){
  const weight=totalShare?shares[i]/totalShare:totalCount?safe(list[i].count)/totalCount:1/active.length;
  visual[i]=floors[i]+remaining*weight;
 }
 return visual;
}
export function buildRibbonLayout(groups=[]){
 const list=Array.isArray(groups)?groups:[],max=Math.max(0,...list.map(g=>safe(g.share)));
 const total=list.reduce((sum,g)=>sum+(max?safe(g.share)/max:0),0);
 const shares=list.map(g=>total?(safe(g.share)/max)/total:0),displayShares=visualShares(list,shares);
 let angle=-Math.PI/2;
 return list.map((g,index)=>{
  const share=shares[index],displayShare=displayShares[index],start=angle,end=start+displayShare*TAU,span=end-start;angle=end;
  const labelUnits=Math.max(1,String(g.label||g.id||'').length*.56);
  const available=Math.max(0,(span-TAIL_CLEARANCE-HEAD_CLEARANCE)*(R-8));
  const fontSize=Math.min(MAX_FONT,available/labelUnits);
  const labelCenter=end-HEAD_CLEARANCE-(labelUnits*fontSize)/(2*R);
  const reverse=Math.sin(labelCenter)>0,head=point(R,end),outer=point(R+W/2,end),inner=point(R-W/2,end);
  const hasCap=displayShare>0&&span<TAU-.000001;
  const headDepth=hasCap?W/2:0;
  const capArc=`A${W/2} ${W/2} 0 0 1 ${p(inner)}`;
  const headEdgePath=hasCap?`M${p(outer)} ${capArc}`:'';
  // The slight inward overlap removes antialiasing seams without changing the
  // circular silhouette. A shared opaque gradient keeps head and body uniform.
  const joinStart=end-.008;
  const headPath=hasCap?`${arc(R+W/2,joinStart,end)} ${capArc} ${arc(R-W/2,end,joinStart,0).replace(/^M[^A]+/,'')} Z`:'';
  const labelStart=start+TAIL_CLEARANCE,labelEnd=end-HEAD_CLEARANCE;
  const labelFits=displayShare>0&&fontSize>=MIN_FONT-.000001;
  const labelRadius=R+(reverse?8:-8);
  const labelPath=labelFits?arc(labelRadius,reverse?labelEnd:labelStart,reverse?labelStart:labelEnd,reverse?0:1):'';
  return {...g,share,displayShare,displayExpanded:displayShare>share+1e-7,start,end,reverse,bodyPath:body(start,end),headPath,headEdgePath,headX:head[0],headY:head[1],headRadius:hasCap?W/2:0,headDepth,arrowRotation:end*180/Math.PI+90+(reverse?45:-45),labelPath,labelFits,fontSize};
 });
}

let serial=0;
export function createRibbonRing({root,onSelect=()=>{}}){
 const uid='fileo-ribbon-'+(++serial);
 let state={groups:[],selected:'',metric:'space',phase:'ready',totalCount:0,totalSize:0},destroyed=false;
 const nodes=new Map();root.classList.add('br-root');
 root.innerHTML=`<div class="br-stage"><svg class="br-svg" viewBox="0 0 1000 580" role="group" aria-label="Filter files by AI suggestion"><defs><radialGradient id="${uid}-center"><stop stop-color="#faf8fc"/><stop offset="1" stop-color="#eae3f1" stop-opacity=".25"/></radialGradient><filter id="${uid}-shadow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="3"/></filter></defs><circle cx="500" cy="288" r="178" fill="url(#${uid}-center)"/><circle class="br-track" cx="500" cy="288" r="214" fill="none" stroke="#eae5ed" stroke-width="72"/><g class="br-art"><g class="br-bodies"></g><g class="br-heads" aria-hidden="true"></g><g class="br-labels" aria-hidden="true"></g></g><circle class="br-scanner" cx="500" cy="288" r="214" fill="none" stroke="#b5a2c5" stroke-width="72" stroke-linecap="round" stroke-dasharray="180 1165" aria-hidden="true"/></svg><div class="br-center"><span class="br-center-label"></span><strong class="br-center-value"></strong><span class="br-center-detail"></span></div></div>`;
 const $=s=>root.querySelector(s),defs=$('defs');
 const add=(tag,attrs,parent)=>{const n=document.createElementNS(NS,tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);parent.append(n);return n;};
 function activate(id){if(['resolved','ready'].includes(state.phase)&&nodes.get(id)?.group.count)onSelect(id);}
 function hover(id){root.dataset.hover=id;}
 function unhover(){delete root.dataset.hover;}
 function create(g){
  const palette=colors[g.id]||['#baa9cd','#e3dbee','#cbbbdc'];
  const gradient=add('linearGradient',{id:`${uid}-${g.id}`,gradientUnits:'userSpaceOnUse',x1:320,y1:510,x2:660,y2:60},defs);
  // Opaque shared stops bake the satin light into one surface: no translucent
  // overlays that could double the highlight where the cap overlaps the body.
  palette.forEach((color,i)=>add('stop',{offset:[0,.58,1][i],'stop-color':color},gradient));
  const mutedGradient=add('linearGradient',{id:`${uid}-${g.id}-muted`,gradientUnits:'userSpaceOnUse',x1:320,y1:510,x2:660,y2:60},defs);
  palette.forEach((color,i)=>add('stop',{offset:[0,.58,1][i],'stop-color':muted(color)},mutedGradient));
  const labelPath=add('path',{id:`${uid}-${g.id}-label`},defs);
  const path=add('path',{'class':'br-segment','data-bucket':g.id,fill:`url(#${uid}-${g.id})`,role:'button',tabindex:0},$('.br-bodies'));
  const title=add('title',{},path);
  const head=add('g',{'class':'br-head','data-bucket':g.id},$('.br-heads'));
  const headTitle=add('title',{},head);
  const shadow=add('path',{'class':'br-head-shadow',fill:'none',stroke:'#85758c','stroke-width':4,opacity:.11,filter:`url(#${uid}-shadow)`},head);
  const cap=add('path',{fill:`url(#${uid}-${g.id})`},head);
  const label=add('g',{'class':'br-label','data-bucket':g.id},$('.br-labels'));
  const arrow=add('path',{'class':'br-arrow',d:'M-10 0 H9 M1 -8 L9 0 L1 8',fill:'none','stroke-linecap':'round','stroke-linejoin':'round','stroke-width':2.7},label);
  const text=add('text',{'class':'br-arc-text'},label),textPath=add('textPath',{href:`#${uid}-${g.id}-label`},text);
  path.addEventListener('click',()=>activate(g.id));head.addEventListener('click',()=>activate(g.id));
  path.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();activate(g.id);}});
  [path,head].forEach(n=>{n.addEventListener('pointerenter',()=>hover(g.id));n.addEventListener('pointerleave',unhover);});
  path.addEventListener('focus',()=>hover(g.id));path.addEventListener('blur',unhover);
  const n={group:g,path,title,head,headTitle,shadow,cap,label,arrow,text,textPath,labelPath,gradient,mutedGradient};nodes.set(g.id,n);return n;
 }
 function fitLabels(){
  if(destroyed)return;
  for(const n of nodes.values())if(n.group.labelFits){
   n.text.setAttribute('font-size',n.group.fontSize);
   const available=n.labelPath.getTotalLength()-5,measured=n.text.getComputedTextLength();
   if(measured>available)n.text.setAttribute('font-size',n.group.fontSize*available/measured);
  }
 }
 document.fonts?.ready.then(fitLabels);
 function update(next){
  state={...state,...next};const layout=buildRibbonLayout(state.groups),present=new Set(layout.map(g=>g.id));
  for(const[id,n]of nodes)if(!present.has(id)){[n.path,n.head,n.label,n.labelPath,n.gradient,n.mutedGradient].forEach(el=>el.remove());nodes.delete(id);}
  layout.forEach(g=>{
   const n=nodes.get(g.id)||create(g);n.group=g;const selected=state.selected===g.id;
   n.path.setAttribute('d',g.bodyPath);n.shadow.setAttribute('d',g.headEdgePath);n.cap.setAttribute('d',g.headPath);
   const fill=`url(#${uid}-${g.id}${state.selected&&!selected?'-muted':''})`;n.path.setAttribute('fill',fill);n.cap.setAttribute('fill',fill);
   n.labelPath.setAttribute('d',g.labelPath);n.textPath.textContent=g.label;n.textPath.setAttribute('startOffset',g.reverse?'0%':'100%');n.text.setAttribute('text-anchor',g.reverse?'start':'end');n.text.setAttribute('font-size',g.fontSize);n.label.style.display=g.labelFits?'':'none';
   n.arrow.setAttribute('transform',`translate(${g.headX} ${g.headY}) rotate(${g.arrowRotation})`);
   const expansion=Math.abs(g.displayShare-g.share)>1e-7?' Arc spacing reserves room for labels; percentage reflects actual data.':'';
   n.path.setAttribute('aria-label',`${g.label}, ${(g.share*100).toFixed(1)}%, ${g.count} files. ${selected?'Selected. Scroll to view files.':'Click to view files.'}${expansion}`);n.path.dataset.expanded=String(g.displayExpanded);n.path.setAttribute('aria-pressed',String(selected));
   n.title.textContent=`${g.label} · ${(g.share*100).toFixed(1)}% · ${selected?'Selected · Scroll to view files':'Click to view files'}${expansion}`;
   n.headTitle.textContent=n.title.textContent;
   [n.path,n.head,n.label].forEach(el=>{el.classList.toggle('is-muted',!!state.selected&&!selected);el.classList.toggle('is-selected',selected);});

  });
  $('.br-center-label').textContent=state.metric==='files'?'Project files':'Project storage';
  $('.br-center-value').textContent=state.metric==='files'?String(state.totalCount):formatStorage(state.totalSize);
  $('.br-center-detail').textContent=state.metric==='files'?formatStorage(state.totalSize):`${state.totalCount} files`;
  root.dataset.selection=state.selected||'';fitLabels();setPhase(state.phase);
 }
 function setPhase(phase){
  state.phase=phase;root.dataset.phase=phase;const enabled=['resolved','ready'].includes(phase);
  for(const n of nodes.values()){
   n.path.setAttribute('tabindex',enabled&&n.group.displayShare&&n.group.count?'0':'-1');n.path.setAttribute('aria-disabled',String(!enabled||!n.group.count));
  }
  if(!enabled)unhover();
 }
 return {update,setPhase,destroy(){destroyed=true;nodes.clear();root.innerHTML='';delete root.dataset.hover;}};
}
