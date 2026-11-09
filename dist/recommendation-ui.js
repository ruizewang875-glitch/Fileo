import {feedbackControl} from './suggestion-feedback.js';
const choices={keep:'Keep',archive:'Archive',trash:'Trash',undecided:'Undecided'};
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const key=file=>Object.hasOwn(choices,file?.bucket)?file.bucket:'undecided';
const info='<svg class="rec-info" aria-hidden="true" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="5.75" stroke="currentColor" stroke-width="1.25"/><path d="M8 7.25v3.25" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><circle cx="8" cy="5.3" r=".75" fill="currentColor"/></svg>';
const closeIcon='<svg aria-hidden="true" viewBox="0 0 16 16" fill="none"><path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
const evidence=f=>Array.isArray(f?.reasonTags)&&f.reasonTags.some(t=>typeof t==='string'&&t.trim())?f.reasonTags.filter(t=>typeof t==='string'&&t.trim()).slice(0,4):['File metadata'];
function signals(file){
 const supplied=Array.isArray(file?.reasonSignals)?file.reasonSignals:[];
 return evidence(file).map(tag=>{
  const signal=supplied.find(item=>item&&item.tag===tag&&typeof item.explanation==='string'&&item.explanation.trim());
  return {tag,explanation:signal?.explanation||(evidence(file).length===1?(file.reason||file.baseReason):null)||'This signal is included in the suggestion, but a separate explanation is not available. Review the file before deciding.'};
 });
}
export function recommendationTags(file){
 return '<span class="rec-tags" role="group" aria-label="AI recommendation reasons">'+signals(file).map((signal,index)=>'<button type="button" class="rec-tag'+(signal.tag.startsWith('Preference: ')?' rec-tag-pref':'')+'" data-rec-file="'+escape(file.id)+'" data-rec-signal="'+index+'" aria-label="Explain '+escape(signal.tag)+' for '+escape(file.file)+'" aria-expanded="false" aria-haspopup="dialog">'+escape(signal.tag)+'</button>').join('')+'</span>';
}
export function suggestionBadge(file,{interactive=false,variant='badge'}={}){
 const bucket=key(file),label=choices[bucket];
 if(variant==='tile')return '<span class="ai-badge rec-static-badge rec-category-tile" data-bucket="'+bucket+'" aria-label="AI suggestion: '+label+'"><span class="rec-tile-source"><span aria-hidden="true">✦</span> AI</span><strong>'+label+'</strong></span>';
 const copy='<span aria-hidden="true">✦</span><span>AI · '+label+'</span>';
 if(!interactive)return '<span class="ai-badge rec-static-badge" data-bucket="'+bucket+'" aria-label="AI suggestion: '+label+'">'+copy+'</span>';
 return '<button type="button" class="ai-badge rec-badge" data-bucket="'+bucket+'" data-rec-file="'+escape(file.id)+'" aria-label="Why AI suggests '+label+' for '+escape(file.file)+'" aria-expanded="false" aria-haspopup="dialog">'+copy+info+'</button>';
}
export function recommendationDetails(file,{showBadge=true,showFeedback=false}={}){
 const category=showBadge?suggestionBadge(file):'';
 return '<section class="rec-evidence" aria-label="Recommendation evidence">'+(showFeedback?'<div class="suggestion-with-feedback">'+category+feedbackControl(file)+'</div>':category)+recommendationTags(file)+'</section>';
}
// One delegated listener also covers filtered lists, preview dialogs and comparisons.
export function installSuggestionPopovers({getFile}){
 let anchor=null,pop=null,observer=null,frame=0;
 function close({restore=false}={}){
  const old=anchor;
  if(frame)cancelAnimationFrame(frame);frame=0;observer?.disconnect();observer=null;
  anchor=null;
  if(pop){pop.remove();pop=null;}
  if(old){old.setAttribute('aria-expanded','false');old.removeAttribute('aria-controls');}
  if(restore&&old?.isConnected)old.focus({preventScroll:true});
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
 function open(button,focusClose){
  const f=getFile?.(button.dataset.recFile);if(!f)return;
  const available=signals(f),index=button.dataset.recSignal,signal=index===undefined?null:available[Number(index)];
  if(index!==undefined&&!signal)return;
  const origin=button.closest('.rec-popover')?anchor:button;if(!origin)return;
  close();anchor=origin;pop=document.createElement('aside');pop.className='rec-popover';pop.id='fileo-suggestion-bubble';pop.setAttribute('role','dialog');pop.setAttribute('aria-labelledby','fileo-suggestion-title');
  if(signal)pop.setAttribute('aria-describedby','fileo-suggestion-reason');
  pop.innerHTML='<div class="rec-pop-heading"><strong id="fileo-suggestion-title">'+escape(signal?signal.tag:'AI · '+choices[key(f)])+'</strong><button type="button" class="rec-pop-close" aria-label="Close explanation">'+closeIcon+'</button></div>'+(signal?'<p class="rec-reason-copy" id="fileo-suggestion-reason">'+escape(signal.explanation)+'</p>':recommendationTags(f));
  const dismiss=pop.querySelector('.rec-pop-close');dismiss.onclick=()=>close({restore:true});
  const host=origin.closest('dialog[open]')||document.body;
  if(typeof pop.showPopover==='function')pop.setAttribute('popover','manual');
  host.append(pop);
  if(pop.hasAttribute('popover')){try{pop.showPopover();}catch{pop.removeAttribute('popover');}}
  origin.setAttribute('aria-expanded','true');origin.setAttribute('aria-controls',pop.id);
  place();if(!pop)return;
  if(focusClose||origin!==button)dismiss.focus({preventScroll:true});
  observer=new MutationObserver(()=>{if(!anchor?.isConnected||anchor.closest('[hidden],[inert]')||!anchor.getClientRects().length)close();else onMove();});
  observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden','inert','open']});
 }
 function onClick(event){
  const target=event.target;if(!(target instanceof Element))return;
  const trigger=target.closest('button[data-rec-file]');
  if(trigger){event.stopPropagation();if(trigger===anchor)close();else open(trigger,event.detail===0);return;}
  if(anchor&&!pop?.contains(target))close();
 }
 function onFocus(event){
  if(anchor&&event.target!==anchor&&!pop?.contains(event.target))close();
 }
 function onKey(event){
  if(!pop)return;
  if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close({restore:true});}
  else if(event.key==='Tab'&&pop.contains(event.target)){
   const controls=[...pop.querySelectorAll('button')].filter(b=>!b.disabled&&b.getClientRects().length);
   if(event.shiftKey&&event.target===controls[0]){event.preventDefault();close({restore:true});}
   else if(!event.shiftKey&&event.target===controls.at(-1))close({restore:true});
  }
  else if(event.key==='Tab'&&!event.shiftKey&&event.target===anchor){event.preventDefault();pop.querySelector('.rec-pop-close').focus({preventScroll:true});}
 }
 document.addEventListener('click',onClick,true);document.addEventListener('focusin',onFocus);document.addEventListener('keydown',onKey,true);document.addEventListener('scroll',onMove,true);window.addEventListener('resize',onMove);
 return {close,destroy(){close();document.removeEventListener('click',onClick,true);document.removeEventListener('focusin',onFocus);document.removeEventListener('keydown',onKey,true);document.removeEventListener('scroll',onMove,true);window.removeEventListener('resize',onMove);}};
}
