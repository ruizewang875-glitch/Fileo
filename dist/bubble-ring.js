import {formatStorage} from './data.js';

const NS='http://www.w3.org/2000/svg',TAU=Math.PI*2,CX=500,CY=286,OUTER=192,INNER=139;
const ids=['keep','archive','trash','undecided'];
const fallback=[-.25,1.65,3.1,4.33];
const colors={keep:['#6b9e91','#b6d9c9'],archive:['#9a7cba','#cfbae5'],trash:['#bc718e','#eeb2bc'],undecided:['#7f8daf','#b9c7df']};
const safe=n=>Number.isFinite(n)&&n>0?n:0;
const point=(r,a)=>[CX+r*Math.cos(a),CY+r*Math.sin(a)];
function segment(start,end){
 const span=end-start;if(span<=0)return '';
 const gap=Math.min(.0279,span/5),a=start+gap/2,b=end-gap/2,p=point(OUTER,a),q=point(OUTER,b),r=point(INNER,b),s=point(INNER,a),large=b-a>Math.PI?1:0;
 return `M${p} A${OUTER} ${OUTER} 0 ${large} 1 ${q} L${r} A${INNER} ${INNER} 0 ${large} 0 ${s} Z`;
}

// The visual positions follow sector midpoints, with circular separation so tiny
// categories remain distinct and clickable even beside one dominant segment.
export function buildBubbleLayout(groups=[]){
 const values=Array.isArray(groups)?groups:[],total=values.reduce((n,g)=>n+safe(g.share),0);
 let angle=-Math.PI/2;
 const list=values.map((g,i)=>{const share=total?safe(g.share)/total:0,start=angle,end=start+share*TAU;angle=end;const mid=share?(start+end)/2:fallback[ids.indexOf(g.id)]??i*TAU/Math.max(1,values.length);return {...g,share,start,end,angle:mid,orbit:((mid%TAU)+TAU)%TAU,radius:70,path:segment(start,end)};});
 const ordered=[...list].sort((a,b)=>a.orbit-b.orbit),gap=Math.min(1.08,TAU/Math.max(1,ordered.length));
 if(ordered.length>1)for(let pass=0;pass<80;pass++)for(let i=0;i<ordered.length;i++){
  const a=ordered[i],b=ordered[(i+1)%ordered.length],distance=b.orbit+(i===ordered.length-1?TAU:0)-a.orbit;
  if(distance<gap){const push=(gap-distance)/2;a.orbit-=push;b.orbit+=push;}
 }
 return list.map(g=>{const [anchorX,anchorY]=point((OUTER+INNER)/2,g.angle);return {...g,x:CX+320*Math.cos(g.orbit),y:CY+215*Math.sin(g.orbit),anchorX,anchorY};});
}

let serial=0;
export function createBubbleRing({root,onSelect=()=>{}}){
 const uid='fileo-orbit-'+(++serial),mq=matchMedia('(prefers-reduced-motion: reduce)');
 let state={groups:[],selected:'',metric:'space',phase:'ready',totalCount:0,totalSize:0},nodes=new Map(),frame=0,last=0,destroyed=false,visible=true,paused=false,clock=0,hovered='',suppressFocusTip=false;
 root.classList.add('br-root');
 root.innerHTML=`<div class="br-stage"><svg class="br-svg" viewBox="0 0 1000 590" aria-label="AI suggestion categories"><defs><filter id="${uid}-mist" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="12"/></filter><filter id="${uid}-join" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur in="SourceGraphic" stdDeviation="7" result="blur"/><feColorMatrix in="blur" type="matrix" values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 9 -3"/><feGaussianBlur stdDeviation="2"/></filter><radialGradient id="${uid}-center"><stop stop-color="#faf7fc"/><stop offset="1" stop-color="#eae3f1" stop-opacity=".28"/></radialGradient></defs><circle class="br-center-wash" cx="500" cy="286" r="143" fill="url(#${uid}-center)"/><g class="br-connections" aria-hidden="true"></g><circle class="br-track" cx="500" cy="286" r="165.5" fill="none" stroke="#e8e2ec" stroke-width="53"/><g class="br-segments"></g><circle class="br-scanner" cx="500" cy="286" r="165.5" fill="none" stroke="#b5a2c5" stroke-width="53" stroke-linecap="round" stroke-dasharray="132 908" aria-hidden="true"/></svg><div class="br-center"><span class="br-center-label"></span><strong class="br-center-value"></strong><span class="br-center-detail"></span><button class="br-reset" type="button" hidden>Show all ↗</button></div><div class="br-bubbles" role="group" aria-label="Filter by AI suggestion"></div><div class="br-tooltip" role="tooltip" hidden><strong></strong><span></span></div></div><button class="br-motion" type="button" aria-pressed="false" aria-label="Pause bubble motion"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 4v8M11 4v8"/></svg><span>Pause motion</span></button>`;
 const $=s=>root.querySelector(s),stage=$('.br-stage'),svg=$('.br-svg'),defs=svg.querySelector('defs'),connections=$('.br-connections'),segments=$('.br-segments'),bubbles=$('.br-bubbles'),tip=$('.br-tooltip');
 const add=(tag,attrs,parent)=>{const n=document.createElementNS(NS,tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);parent.append(n);return n;};
 function showTip(id){
  hovered=id;const n=nodes.get(id);if(!n||!n.group.count){hideTip();return;}
  tip.querySelector('strong').textContent=n.group.label+' · '+(n.group.share*100).toFixed(1)+'%';
  tip.querySelector('span').textContent=state.selected===id?'Click to show all files':'Click to view files';
  tip.hidden=false;root.dataset.hover=id;
 }
 function hideTip(){hovered='';tip.hidden=true;delete root.dataset.hover;}
 function create(g,i){
  const palette=colors[g.id]||['#9980ad','#d0bddf'];
  const gradient=add('linearGradient',{id:uid+'-'+g.id,x1:'0',y1:'1',x2:'1',y2:'0'},defs);
  add('stop',{'stop-color':palette[0]},gradient);add('stop',{offset:'1','stop-color':palette[1]},gradient);
  const cloud=add('g',{'class':'br-cloud','data-bucket':g.id},connections);
  const neck=add('path',{fill:palette[0],filter:`url(#${uid}-mist)`,opacity:'.2'},cloud);
  const goo=add('g',{fill:palette[1],filter:`url(#${uid}-join)`,opacity:'.48'},cloud);
  const anchor=add('circle',{r:'31'},goo),orb=add('ellipse',{rx:'64',ry:'54'},goo);
  const path=add('path',{'class':'br-segment',fill:`url(#${uid}-${g.id})`,'data-bucket':g.id,role:'button',tabindex:'0'},segments);
  const button=document.createElement('button');button.className='br-bubble';button.type='button';button.dataset.bucket=g.id;button.style.setProperty('--br-color',palette[0]);button.style.setProperty('--br-pale',palette[1]);
  button.innerHTML='<span class="br-bubble-name"></span><strong class="br-bubble-percent"></strong><span class="br-bubble-arrow" aria-hidden="true">↗</span>';
  bubbles.append(button);
  const activate=()=>{if(nodes.get(g.id)?.group.count&&['resolved','ready'].includes(state.phase)){hideTip();onSelect(g.id);}};
  button.addEventListener('click',activate);path.addEventListener('click',activate);path.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();activate();}if(e.key==='Escape')hideTip();});
  path.addEventListener('pointerenter',()=>showTip(g.id));path.addEventListener('pointerleave',hideTip);path.addEventListener('focus',()=>{if(!suppressFocusTip&&path.matches(':focus-visible'))showTip(g.id);});path.addEventListener('blur',hideTip);
  button.addEventListener('pointerenter',()=>{root.dataset.hover=g.id;});button.addEventListener('pointerleave',()=>{delete root.dataset.hover;});
  const n={group:g,index:i,path,button,cloud,neck,anchor,orb,p:1,velocity:0,target:0,x:g.x,y:g.y};nodes.set(g.id,n);return n;
 }
 function paint(n){
  const g=n.group,p=Math.max(0,Math.min(1,n.p)),moving=!mq.matches&&!paused,freedom=1-p;
  const dx=moving?Math.sin(clock/(3600+n.index*690)+n.index*1.8)*(5+n.index*.6):0;
  const dy=moving?Math.sin(clock/(2900+n.index*910)+n.index*2.4)*(4+n.index*.8):0;
  const x=g.x+(g.anchorX-g.x)*p+dx*freedom,y=g.y+(g.anchorY-g.y)*p+dy*freedom,scale=1-p*.72;
  n.x=x;n.y=y;
  n.button.style.left=(x/10)+'%';n.button.style.top=(y/5.9)+'%';
  n.button.style.transform=`translate(-50%,-50%) scale(${scale})`;
  n.button.style.opacity=String(Math.max(0,1-p*2.15));
  n.button.style.setProperty('--br-text-opacity',String(Math.max(0,1-p*4)));
  n.anchor.setAttribute('cx',g.anchorX);n.anchor.setAttribute('cy',g.anchorY);
  n.orb.setAttribute('cx',x);n.orb.setAttribute('cy',y);n.orb.setAttribute('rx',64*scale);n.orb.setAttribute('ry',54*scale);
  const vx=x-g.anchorX,vy=y-g.anchorY,length=Math.hypot(vx,vy)||1,nx=-vy/length,ny=vx/length,a=26,b=24*scale,mx=g.anchorX+vx*.57,my=g.anchorY+vy*.57;
  n.neck.setAttribute('d',`M${g.anchorX+nx*a} ${g.anchorY+ny*a} Q${mx} ${my} ${x+nx*b} ${y+ny*b} L${x-nx*b} ${y-ny*b} Q${mx} ${my} ${g.anchorX-nx*a} ${g.anchorY-ny*a} Z`);
  n.cloud.style.opacity=String((g.share?1:0)*(1-p*.95));
 }
 function step(now){
  frame=0;if(destroyed)return;
  const dt=Math.min(.035,last?(now-last)/1000:1/60);last=now;clock+=dt*1000;
  let unsettled=false;
  for(const n of nodes.values()){
   if(mq.matches){n.p=n.target;n.velocity=0;}else{
    n.velocity+=((n.target-n.p)*190-n.velocity*26)*dt;n.p+=n.velocity*dt;
    if(Math.abs(n.p-n.target)<.0005&&Math.abs(n.velocity)<.004){n.p=n.target;n.velocity=0;}else unsettled=true;
   }
   paint(n);
  }
  if(shouldRun()&&(!paused||unsettled))frame=requestAnimationFrame(step);
 }
 function shouldRun(){return !destroyed&&visible&&!document.hidden&&!mq.matches&&['ready','resolved'].includes(state.phase);}
 function kick(){if(shouldRun()&&!frame){last=0;frame=requestAnimationFrame(step);}else if(mq.matches||!visible||document.hidden){for(const n of nodes.values()){n.p=n.target;n.velocity=0;paint(n);}}}
 function update(next){
  state={...state,...next};const layout=buildBubbleLayout(state.groups),present=new Set(layout.map(g=>g.id));
  for(const[id,n]of nodes)if(!present.has(id)){n.path.remove();n.cloud.remove();n.button.remove();nodes.delete(id);}
  layout.forEach((g,i)=>{
   const n=nodes.get(g.id)||create(g,i);n.group=g;n.index=i;n.target=state.selected===g.id?1:0;
   const selected=state.selected===g.id,active=!!g.count&&['resolved','ready'].includes(state.phase);
   n.path.setAttribute('d',g.path);n.path.setAttribute('aria-pressed',String(selected));n.path.setAttribute('aria-label',`${g.label}: ${(g.share*100).toFixed(1)} percent, ${g.count} files. ${selected?'Show all files.':'Click to view files.'}`);n.path.setAttribute('tabindex',active&&g.share?'0':'-1');n.path.setAttribute('aria-disabled',String(!active));n.path.classList.toggle('is-muted',!!state.selected&&!selected);n.path.classList.toggle('is-selected',selected);
   n.button.querySelector('.br-bubble-name').textContent=g.label;n.button.querySelector('.br-bubble-percent').textContent=(g.share*100).toFixed(1)+'%';
   n.button.setAttribute('aria-label',`${g.label}, ${(g.share*100).toFixed(1)} percent, ${g.count} files. Click to view files.`);
   if(selected&&document.activeElement===n.button){suppressFocusTip=true;n.path.focus({preventScroll:true});suppressFocusTip=false;}
   n.button.disabled=!active||selected;n.button.setAttribute('aria-hidden',String(selected));n.button.dataset.empty=String(!g.count);
   if(mq.matches){n.p=n.target;n.velocity=0;}paint(n);
  });
  const selected=layout.find(g=>g.id===state.selected);
  $('.br-center-label').textContent=selected?selected.label:state.metric==='files'?'Project files':'Project storage';
  $('.br-center-value').textContent=selected?(selected.share*100).toFixed(1)+'%':state.metric==='files'?String(state.totalCount):formatStorage(state.totalSize);
  $('.br-center-detail').textContent=selected?`${selected.count} files`:state.metric==='files'?formatStorage(state.totalSize):`${state.totalCount} files`;
  $('.br-reset').hidden=!selected;root.dataset.selection=state.selected||'';
  setPhase(state.phase);if(hovered)showTip(hovered);kick();
 }
 function setPhase(phase){
  state.phase=phase;root.dataset.phase=phase;const enabled=['resolved','ready'].includes(phase);bubbles.inert=!enabled;
  for(const n of nodes.values()){n.button.disabled=!enabled||!n.group.count||state.selected===n.group.id;n.path.setAttribute('tabindex',enabled&&n.group.share&&n.group.count?'0':'-1');n.path.setAttribute('aria-disabled',String(!enabled||!n.group.count));}
  if(!enabled){if(frame)cancelAnimationFrame(frame);frame=0;hideTip();}else kick();
 }
 $('.br-reset').onclick=()=>onSelect('');
 const motion=$('.br-motion');motion.onclick=()=>{paused=!paused;motion.setAttribute('aria-pressed',String(paused));motion.setAttribute('aria-label',paused?'Resume bubble motion':'Pause bubble motion');motion.querySelector('span').textContent=paused?'Resume motion':'Pause motion';if(paused){if(frame)cancelAnimationFrame(frame);frame=0;}kick();};
 const visibility=()=>{if(document.hidden){if(frame)cancelAnimationFrame(frame);frame=0;}else kick();};
 const preference=()=>{if(frame)cancelAnimationFrame(frame);frame=0;motion.hidden=mq.matches;for(const n of nodes.values()){n.p=n.target;n.velocity=0;paint(n);}kick();};
 document.addEventListener('visibilitychange',visibility);mq.addEventListener?.('change',preference);motion.hidden=mq.matches;
 const observer=typeof IntersectionObserver==='function'?new IntersectionObserver(entries=>{visible=entries[0]?.isIntersecting!==false;if(!visible){if(frame)cancelAnimationFrame(frame);frame=0;}else kick();},{threshold:.05}):null;observer?.observe(root);
 return {update,setPhase,destroy(){destroyed=true;if(frame)cancelAnimationFrame(frame);frame=0;observer?.disconnect();mq.removeEventListener?.('change',preference);document.removeEventListener('visibilitychange',visibility);nodes.clear();root.innerHTML='';}};
}
