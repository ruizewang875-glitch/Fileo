const choices={keep:'Keep',archive:'Archive',trash:'Trash',undecided:'Undecided'};
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const key=file=>Object.hasOwn(choices,file?.bucket)?file.bucket:'undecided';
const arrow='<svg aria-hidden="true" viewBox="0 0 16 16" fill="none"><path d="m4 6 4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const info='<svg class="rec-info" aria-hidden="true" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="5.75" stroke="currentColor" stroke-width="1.25"/><path d="M8 7.25v3.25" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><circle cx="8" cy="5.3" r=".75" fill="currentColor"/></svg>';
const evidence=f=>Array.isArray(f.reasonTags)&&f.reasonTags.some(t=>typeof t==='string'&&t.trim())?f.reasonTags.filter(t=>typeof t==='string'&&t.trim()).slice(0,4):['File metadata'];
const tagsHTML=f=>'<span class="rec-tags">'+evidence(f).map(t=>'<span class="rec-tag'+(t.startsWith('Preference: ')?' rec-tag-pref':'')+'">'+escape(t)+'</span>').join('')+'</span>';
const reason=f=>f.reason||f.baseReason||'There is not enough evidence to make a stronger recommendation.';
export function suggestionBadge(file,{interactive=false}={}){
 const bucket=key(file),label=choices[bucket],copy='<span aria-hidden="true">✦</span><span>AI · '+label+'</span>';
 if(!interactive)return '<span class="ai-badge rec-static-badge" data-bucket="'+bucket+'" aria-label="AI suggestion: '+label+'">'+copy+'</span>';
 return '<button type="button" class="ai-badge rec-badge" data-bucket="'+bucket+'" data-rec-file="'+escape(file.id)+'" aria-label="Why AI suggests '+label+' for '+escape(file.file)+'" aria-expanded="false" aria-haspopup="dialog">'+copy+info+'</button>';
}
export function recommendationDetails(file,{showBadge=true}={}){
 return '<section class="rec-evidence" aria-label="Recommendation evidence">'+(showBadge?suggestionBadge(file):'')+
 '<details class="rec-disclosure"><summary>'+tagsHTML(file)+'<span class="rec-disclose-label">Why? '+arrow+'</span><span class="sr-only">Show reasoning for '+escape(file.file)+'</span></summary><p>'+escape(reason(file))+'</p></details></section>';
}
// Delegate once: lists are rerendered for filtering, decisions and project changes.
export function installSuggestionPopovers({getFile}){
 let anchor=null,pop=null,observer=null,frame=0,keyboard=false,restoring=false;
 function close({restore=false}={}){
  const old=anchor;
  if(frame)cancelAnimationFrame(frame);frame=0;observer?.disconnect();observer=null;
  anchor=null;
  if(pop){pop.remove();pop=null;}
  if(old){old.setAttribute('aria-expanded','false');old.removeAttribute('aria-controls');old.removeAttribute('aria-describedby');}
  if(restore&&old?.isConnected){restoring=true;old.focus({preventScroll:true});restoring=false;}
 }
 function place(){
  frame=0;if(!anchor||!pop)return;
  if(!anchor.isConnected||!anchor.getClientRects().length||anchor.closest('[hidden],[inert]')){close();return;}
  const a=anchor.getBoundingClientRect(),width=document.documentElement.clientWidth,height=window.innerHeight,pad=12,gap=10;
  if(a.bottom<=0||a.top>=height||a.right<=0||a.left>=width){close();return;}
  const box=pop.getBoundingClientRect(),above=height-a.bottom-gap<box.height&&a.top>height-a.bottom;
  const x=Math.max(pad,Math.min(width-box.width-pad,a.left+a.width/2-box.width/2));
  pop.style.left=x+'px';pop.style.top=Math.max(pad,Math.min(height-box.height-pad,above?a.top-gap-box.height:a.bottom+gap))+'px';
  pop.style.setProperty('--rec-tip',Math.max(16,Math.min(box.width-16,a.left+a.width/2-x))+'px');
  pop.dataset.above=String(above);
 }
 function onMove(){if(anchor&&!frame)frame=requestAnimationFrame(place);}
 function open(button){
  const f=getFile?.(button.dataset.recFile);if(!f)return;
  close();anchor=button;pop=document.createElement('aside');pop.className='rec-popover';pop.id='fileo-suggestion-bubble';pop.setAttribute('role','dialog');pop.setAttribute('aria-labelledby','fileo-suggestion-title');
  pop.innerHTML='<div class="rec-pop-head"><strong id="fileo-suggestion-title">Why '+choices[key(f)]+'?</strong><button type="button" class="rec-pop-close" aria-label="Close explanation">×</button></div>'+tagsHTML(f)+'<p id="fileo-suggestion-reason">'+escape(reason(f))+'</p>';
  const host=button.closest('dialog[open]')||document.body;
  if(typeof pop.showPopover==='function')pop.setAttribute('popover','manual');
  host.append(pop);
  if(pop.hasAttribute('popover')){try{pop.showPopover();}catch{pop.removeAttribute('popover');}}
  button.setAttribute('aria-expanded','true');button.setAttribute('aria-controls',pop.id);button.setAttribute('aria-describedby','fileo-suggestion-reason');
  place();if(!pop)return;
  observer=new MutationObserver(()=>{if(!anchor?.isConnected||anchor.closest('[hidden],[inert]')||!anchor.getClientRects().length)close();else onMove();});
  observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden','inert','open']});
 }
 function onClick(event){
  const target=event.target;if(!(target instanceof Element))return;
  const trigger=target.closest('button[data-rec-file]');
  if(trigger){event.stopPropagation();if(trigger===anchor)close();else open(trigger);return;}
  if(pop?.contains(target)){if(target.closest('.rec-pop-close')){event.stopPropagation();close({restore:true});}return;}
  if(anchor)close();
 }
 function onFocus(event){
  const el=event.target;if(!(el instanceof Element)||restoring)return;
  if(el===anchor||pop?.contains(el))return;
  if(anchor)close();
  if(keyboard&&el.matches('button[data-rec-file]:focus-visible'))open(el);
 }
 function onKey(event){
  if(event.key==='Tab')keyboard=true;
  if(event.key==='Escape'&&pop){event.preventDefault();event.stopPropagation();close({restore:true});}
 }
 function onPointer(){keyboard=false;}
 document.addEventListener('click',onClick,true);document.addEventListener('focusin',onFocus);document.addEventListener('keydown',onKey,true);document.addEventListener('pointerdown',onPointer,true);document.addEventListener('scroll',onMove,true);window.addEventListener('resize',onMove);
 return {close,destroy(){close();document.removeEventListener('click',onClick,true);document.removeEventListener('focusin',onFocus);document.removeEventListener('keydown',onKey,true);document.removeEventListener('pointerdown',onPointer,true);document.removeEventListener('scroll',onMove,true);window.removeEventListener('resize',onMove);}};
}
