import {TYPES,FILES} from './data.js';
import {art} from './art.js';
export function createCarousel({onSelect,isEnabled=()=>true,autoplay=true,getFiles}){
 const stage=document.querySelector('#stage'),pool=document.querySelector('#card-pool'),playback=document.querySelector('#playback');
 const reduced=matchMedia('(prefers-reduced-motion: reduce)'),mod=(n,m)=>(n%m+m)%m;
 let position=1,target=1,autoplayEnabled=autoplay,paused=!autoplayEnabled||reduced.matches,hovering=false,focused=false,drag=null;
 let width=0,height=0,cardWidth=0,cardHeight=0,lastTime=performance.now(),lastAdvance=lastTime,activeIndex=-1,wheelAt=-1000,suppressClickUntil=0;
 const cards=[],status=document.querySelector('#carousel-status'),controls=[...stage.querySelectorAll('.stage-control')];
 const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const iconKinds=new Set(TYPES.map(file=>file.kind));
 let entries=[];
 function timestamp(value){const result=typeof value==='number'?value:Date.parse(value);return Number.isFinite(result)?result:0;}
 function readEntries(){
  if(typeof getFiles!=='function')return TYPES.map(file=>({file,type:file.id,demo:true}));
  const grouped=new Map(),files=getFiles();
  for(const original of Array.isArray(files)?files:[]){
   if(!original||typeof original!=='object')continue;
   const type=String(original.type||original.ext||String(original.file||'').split('.').slice(1).pop()||'other').replace(/^\./,'').toLowerCase();
   const known=TYPES.find(file=>file.id===type),file={...known,...original,type};
   file.ext=original.ext||known?.ext||(type==='other'?'FILE':'.'+type);file.app=original.app||known?.app||file.ext.toUpperCase();file.kind=original.kind||known?.kind||'generic';
   const updated=timestamp(original.lastModified)||timestamp(original.modified)||timestamp(original.importedAt),imported=timestamp(original.importedAt);
   const previous=grouped.get(type);
   if(!previous||updated>previous.updated||updated===previous.updated&&imported>=previous.imported)grouped.set(type,{file,type,updated,imported,demo:original.source==='demo'||FILES.includes(original)});
  }
  return [...grouped.values()];
 }
 function nativeTile(file){return `<div class="native-preview" aria-hidden="true"><span class="native-file-icon">${escape(file.ext)}</span></div>`;}
 function fillCard(card,absoluteIndex){
  const i=mod(absoluteIndex,entries.length),entry=entries[i],file=entry.file;card.dataset.absolute=absoluteIndex;
  if(card.dataset.file===String(i))return;
  card.dataset.file=i;card.dataset.type=entry.type;card.setAttribute('aria-label',`Browse ${file.app} files, ${file.ext}`);
  const preview=typeof file.previewData==='string'&&/^(data:image\/(?:png|jpe?g|webp|gif|avif|bmp);base64,|blob:)/i.test(file.previewData)?file.previewData:'';
  const artwork=preview?`<img src="${escape(preview)}" alt="Preview of ${escape(file.file)}" draggable="false">`:entry.demo?art(file):nativeTile(file);
  const kind=iconKinds.has(file.kind)?file.kind:'generic';
  const badge=kind==='indesign'?'Id':kind!=='generic'?`<img src="assets/${kind}.svg" alt="${escape(file.app)}" draggable="false">`:'<svg viewBox="0 0 24 24" width="23" height="23" fill="none" stroke="#eee4f3" stroke-width="1.5" aria-hidden="true"><path d="M6 3h8l4 4v14H6z M14 3v5h4 M9 12h6 M9 16h6"/></svg>';
  card.innerHTML=`<div class="card-surface"><div class="card-art">${artwork}</div><span class="app-badge ${kind}">${badge}</span><span class="file-ext">${escape(file.ext)}</span><div class="card-caption"><h2>${escape(file.file||file.name||file.app)}</h2><span class="caption-arrow" aria-hidden="true">↗</span></div><div class="card-shine"></div></div>`;
  if(preview)card.querySelector('.card-art>img').addEventListener('error',()=>{card.querySelector('.card-art').innerHTML=nativeTile(file);},{once:true});
 }
 function refresh(){
  if(drag){const id=drag.id;drag=null;if(stage.hasPointerCapture(id))stage.releasePointerCapture(id);stage.classList.remove('dragging');}
  entries=readEntries();pool.replaceChildren();cards.length=0;position=target=entries.length>2?1:0;activeIndex=-1;
  lastAdvance=lastTime=performance.now();wheelAt=-1000;suppressClickUntil=0;focused=stage.contains(document.activeElement);
  pool.hidden=!entries.length;controls.forEach(control=>{control.hidden=entries.length<2;});stage.style.cursor=entries.length>1?'':'default';
  stage.setAttribute('aria-label',entries.length>1?'File types. Drag or use arrow keys to browse. Select a card to see similar files.':entries.length?'File type. Select the card to see similar files.':'No files in this project.');
  status.textContent=entries.length?`${Math.round(position)+1} of ${entries.length}: ${entries[Math.round(position)].file.app} files`:'No files in this project.';
  for(let i=0;i<Math.min(3,entries.length);i++){
   const card=document.createElement('button');card.className='file-card';card.type='button';
   card.addEventListener('click',()=>{if(performance.now()<suppressClickUntil)return;onSelect(card.dataset.type);});pool.append(card);cards.push(card);
  }
  resize();renderCards(lastTime);
 }
 function resize(){
  const w=stage.clientWidth,h=stage.clientHeight;if(!w||!h)return;width=w;height=h;
  cardWidth=Math.min(width<700?width*.43:width*.305,height*.70,370);cardHeight=cardWidth*1.23;
  stage.style.setProperty('--card-w',`${cardWidth}px`);stage.style.setProperty('--card-h',`${cardHeight}px`);
 }
 new ResizeObserver(resize).observe(stage);resize();
 function go(delta){if(drag||entries.length<2)return;target=entries.length===2?mod(Math.round(target)+delta,2):Math.round(target)+delta;lastAdvance=performance.now();if(reduced.matches)position=target;}
 function syncPlayback(){
  playback.setAttribute('aria-pressed',String(paused));playback.setAttribute('aria-label',paused?'Play automatic rotation':'Pause automatic rotation');
  playback.innerHTML=paused?'<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m5 3 7 5-7 5Z" fill="currentColor"/></svg>':'<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 4v8m6-8v8" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
 }
 playback.addEventListener('click',()=>{paused=!paused;lastAdvance=performance.now();syncPlayback();});syncPlayback();
 reduced.addEventListener('change',()=>{paused=!autoplayEnabled||reduced.matches;lastAdvance=performance.now();syncPlayback();});
 document.querySelector('#previous').addEventListener('click',()=>go(-1));document.querySelector('#next').addEventListener('click',()=>go(1));
 stage.addEventListener('mouseenter',()=>hovering=true);stage.addEventListener('mouseleave',()=>{hovering=false;lastAdvance=performance.now();});
 stage.addEventListener('focusin',()=>focused=true);stage.addEventListener('focusout',e=>{if(!stage.contains(e.relatedTarget)){focused=false;lastAdvance=performance.now();}});
 stage.addEventListener('keydown',e=>{if(entries.length>1&&(e.key==='ArrowRight'||e.key==='ArrowLeft')){e.preventDefault();go(e.key==='ArrowRight'?1:-1);}});
 stage.addEventListener('wheel',e=>{
  if(e.ctrlKey||entries.length<2)return;const delta=Math.abs(e.deltaX)>Math.abs(e.deltaY)?e.deltaX:e.deltaY;if(Math.abs(delta)<3)return;
  e.preventDefault();const now=performance.now();if(now-wheelAt<530)return;wheelAt=now;go(Math.sign(delta));
 },{passive:false});
 stage.addEventListener('pointerdown',e=>{
  if(entries.length<2||e.button!==0||e.target.closest('.stage-control'))return;
  drag={id:e.pointerId,x:e.clientX,y:e.clientY,start:position,lastX:e.clientX,lastTime:performance.now(),velocity:0,moved:false};lastAdvance=performance.now();
 });
 stage.addEventListener('pointermove',e=>{
  if(!drag||e.pointerId!==drag.id)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
  if(!drag.moved&&Math.abs(dy)>Math.abs(dx)&&Math.abs(dy)>10){drag=null;return;}
  if(Math.abs(dx)>6&&!drag.moved){drag.moved=true;stage.setPointerCapture(e.pointerId);stage.classList.add('dragging');}
  if(!drag.moved)return;const now=performance.now(),dt=Math.max(now-drag.lastTime,8);
  drag.velocity=(e.clientX-drag.lastX)/dt;drag.lastX=e.clientX;drag.lastTime=now;position=drag.start-dx/Math.max(width*.30,140);if(entries.length===2)position=Math.max(-.2,Math.min(1.2,position));target=position;
 });
 function finishDrag(e){
  if(!drag||e.pointerId!==drag.id)return;const id=drag.id;
  if(drag.moved){const v=performance.now()-drag.lastTime<100?drag.velocity:0;target=Math.round(position-Math.max(-.7,Math.min(.7,v*.20)));suppressClickUntil=performance.now()+300;}else target=Math.round(position);
  if(entries.length===2)target=Math.max(0,Math.min(1,target));
  drag=null;if(stage.hasPointerCapture(id))stage.releasePointerCapture(id);stage.classList.remove('dragging');lastAdvance=performance.now();
 }
 window.addEventListener('pointerup',finishDrag);window.addEventListener('pointercancel',finishDrag);stage.addEventListener('lostpointercapture',finishDrag);
 document.addEventListener('visibilitychange',()=>{lastTime=performance.now();lastAdvance=lastTime;});
 function renderCards(now){
  if(!entries.length)return;
  const center=Math.round(position),index=mod(center,entries.length);
  if(index!==activeIndex){activeIndex=index;if(paused||focused||hovering)status.textContent=`${index+1} of ${entries.length}: ${entries[index].file.app} files`;}
  const small=width<700,spacing=width*(small?.315:.30),baseY=height*.48,arc=height*.08;
  const first=entries.length<3?0:center-1,last=entries.length<3?entries.length-1:center+1;
  for(let i=first;i<=last;i++){
   const card=cards[entries.length<3?i:mod(i,3)];fillCard(card,i);const t=i-position,a=Math.abs(t),fade=Math.max(0,Math.min(1,(1.5-a)/.29)),opacity=fade*fade*(3-2*fade);
   const scale=1-.17*Math.min(a,1.5),float=reduced.matches?0:Math.sin(now*.00075+i*1.8)*6;
   const x=width*.5+t*spacing-cardWidth/2,y=baseY+arc*(1-t*t)-t*height*.035-cardHeight/2+float,rotation=-3+15*t+(reduced.matches?0:Math.sin(now*.00041+i)*.65);
   card.style.transform=`translate3d(${x}px,${y}px,0) rotate(${rotation}deg) scale(${scale})`;card.style.opacity=opacity;card.style.zIndex=String(10-Math.round(a*4));
   card.style.pointerEvents=opacity>.25?'auto':'none';card.tabIndex=a<.51?0:-1;card.setAttribute('aria-hidden',String(opacity<.05));
  }
 }
 function frame(now){
  const dt=Math.min(now-lastTime,50);lastTime=now;
  if(!document.hidden&&isEnabled()&&entries.length){
   if(entries.length>1&&!paused&&!hovering&&!focused&&!drag&&now-lastAdvance>4700)go(1);
   if(!drag){position=reduced.matches?target:position+(target-position)*(1-Math.exp(-dt/180));if(Math.abs(target-position)<.0001)position=target;}
   renderCards(now);
  }else lastAdvance=now;
  requestAnimationFrame(frame);
 }
 refresh();requestAnimationFrame(frame);return {refresh,resetClock(){lastAdvance=performance.now();resize();},setAutoplay(enabled){autoplayEnabled=enabled;paused=!enabled||reduced.matches;lastAdvance=performance.now();syncPlayback();}};
}
