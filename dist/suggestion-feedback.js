const labels={keep:'Keep',archive:'Archive',trash:'Trash',undecided:'Undecided'};
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const thumbPath='M7 10v11H3V10h4Zm0 0 5-7c.6-.9 2-.5 2 .6V9h5.2c1.2 0 2.1 1.1 1.8 2.3l-1.7 7.9c-.2 1-1.1 1.8-2.2 1.8H7';
const upIcon=(filled=false)=>'<svg class="sf-thumb'+(filled?' sf-thumb-filled':'')+'" viewBox="0 0 24 24" aria-hidden="true"><path d="'+thumbPath+'"/></svg>';
const downIcon=(filled=false)=>'<svg class="sf-thumb sf-thumb-down'+(filled?' sf-thumb-filled':'')+'" viewBox="0 0 24 24" aria-hidden="true"><path d="'+thumbPath+'"/></svg>';
const neutralIcon='<span class="sf-thumb-pair" aria-hidden="true">'+upIcon()+downIcon()+'</span>';
const closeIcon='<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 5 10 10M15 5 5 15"/></svg>';
const categoryPaths={keep:'m5 12 4 4L19 6',archive:'M4 7h16v14H4z M3 3h18v4H3z M9 11h6',trash:'M4 6h16 M9 6V3h6v3 M6 6l1 15h10l1-15 M10 10v7m4-7v7',undecided:'M9 8a3 3 0 1 1 5 2c-2 1-2 2-2 4 M12 18h.01'};
const categoryIcon=id=>'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="'+categoryPaths[id]+'"/></svg>';
const ratingOf=file=>['good','bad'].includes(file?.suggestionFeedback?.rating)?file.suggestionFeedback.rating:'';
const controlCopy=(file,rating=ratingOf(file))=>rating==='good'?'Good suggestion — change feedback for '+file.file:rating==='bad'?'Bad suggestion — change feedback for '+file.file:'Give feedback on the AI suggestion for '+file.file;
const ratingIcon=rating=>rating==='good'?upIcon(true):rating==='bad'?downIcon(true):neutralIcon;
export function feedbackControl(file){
 const rating=ratingOf(file);
 return '<button type="button" class="suggestion-feedback-button" data-feedback-file="'+escape(file.id)+'" data-feedback-rating="'+rating+'" aria-label="'+escape(controlCopy(file,rating))+'" title="'+(rating==='good'?'Good suggestion':rating==='bad'?'Bad suggestion':'Give feedback')+'" aria-haspopup="menu" aria-expanded="false">'+ratingIcon(rating)+'</button>';
}

// Feedback changes the suggestion only. The workspace remains responsible for actual file actions.
export function installSuggestionFeedback({getFile,onRate,onCorrect,onApplied,notify}={}){
 let anchor=null,menu=null,observer=null,frame=0,clarify=null,clarifyAnchor=null,clarifyId=null,choice=null,busy=false,operation=0,notice=null,noticeTimer=0;
 const activeFile=id=>{const file=getFile?.(id);return file&&!['archive','trash'].includes(file.decision)?file:null;};
 function visibleControl(id){return [...document.querySelectorAll('button[data-feedback-file]')].find(button=>button.dataset.feedbackFile===id&&button.getClientRects().length&&!button.closest('[hidden],[inert]'));}
 function restoreFocus(id,original){const target=original?.isConnected&&original.getClientRects().length?original:visibleControl(id);target?.focus({preventScroll:true});}
 function syncControls(file){
  if(!file)return;
  const rating=ratingOf(file);
  for(const button of document.querySelectorAll('button[data-feedback-file]'))if(button.dataset.feedbackFile===file.id){button.dataset.feedbackRating=rating;button.innerHTML=ratingIcon(rating);button.setAttribute('aria-label',controlCopy(file,rating));button.title=rating==='good'?'Good suggestion':rating==='bad'?'Bad suggestion':'Give feedback';}
 }
 function clearNotice(){clearTimeout(noticeTimer);noticeTimer=0;notice?.remove();notice=null;}
 function showNotice(message){
  clearNotice();notice=document.createElement('div');notice.className='sf-toast';notice.setAttribute('role','status');notice.setAttribute('aria-live','polite');notice.innerHTML='<span aria-hidden="true">✓</span><span>'+escape(message)+'</span>';
  const host=[...document.querySelectorAll('dialog[open]')].at(-1)||document.body;
  if(typeof notice.showPopover==='function')notice.setAttribute('popover','manual');host.append(notice);
  if(notice.hasAttribute('popover')){try{notice.showPopover();}catch{notice.removeAttribute('popover');}}
  noticeTimer=setTimeout(clearNotice,4200);
 }
 function closeMenu({restore=false}={}){
  const old=anchor,id=old?.dataset.feedbackFile;anchor=null;
  if(frame)cancelAnimationFrame(frame);frame=0;observer?.disconnect();observer=null;
  menu?.remove();menu=null;
  if(old){old.setAttribute('aria-expanded','false');old.removeAttribute('aria-controls');}
  if(restore)restoreFocus(id,old);
 }
 function place(){
  frame=0;if(!anchor||!menu)return;
  if(!anchor.isConnected||!anchor.getClientRects().length||anchor.closest('[hidden],[inert]')){closeMenu();return;}
  const a=anchor.getBoundingClientRect(),box=menu.getBoundingClientRect(),width=document.documentElement.clientWidth,height=window.innerHeight,pad=12,gap=9;
  if(a.bottom<=0||a.top>=height||a.right<=0||a.left>=width){closeMenu();return;}
  const above=height-a.bottom-gap<box.height&&a.top>height-a.bottom;
  menu.style.left=Math.max(pad,Math.min(width-box.width-pad,a.left))+'px';menu.style.top=Math.max(pad,Math.min(height-box.height-pad,above?a.top-gap-box.height:a.bottom+gap))+'px';
 }
 function onMove(){if(anchor&&!frame)frame=requestAnimationFrame(place);}
 function setBusy(value){busy=value;if(!clarify)return;clarify.setAttribute('aria-busy',String(value));for(const button of clarify.querySelectorAll('button'))button.disabled=value;const submit=clarify.querySelector('[data-sf-apply]');submit.disabled=value||!choice;submit.textContent=value?'Applying…':'Apply correction';}
 function cleanupClarify({restore=true}={}){
  const old=clarify,id=clarifyId,origin=clarifyAnchor;clarify=null;clarifyId=null;clarifyAnchor=null;choice=null;busy=false;
  for(const preview of document.querySelectorAll('.sf-preview-obscured'))preview.classList.remove('sf-preview-obscured');
  if(old){if(old.open)old.close();old.remove();}
  if(restore)restoreFocus(id,origin);
 }
 function close({restore=false}={}){operation++;closeMenu({restore});cleanupClarify({restore});clearNotice();}
 async function applyCorrection(){
  if(!clarify||!choice||busy)return;
  const id=clarifyId,bucket=choice,dialog=clarify,origin=clarifyAnchor,token=++operation;
  const error=dialog.querySelector('[data-sf-error]');error.hidden=true;setBusy(true);
  try{
   if(!activeFile(id))throw Error('This file is no longer available for feedback.');
   const result=await onCorrect?.(id,bucket);if(token!==operation||clarify!==dialog)return;
   if(!result)throw Error('The correction could not be saved. Please try again.');
   const file=result.id?result:activeFile(id);if(!file)throw Error('This file is no longer available for feedback.');
   cleanupClarify({restore:false});syncControls(file);await onApplied?.(file);
   if(token!==operation)return;
   restoreFocus(id,origin);showNotice('Changes applied. Suggestion updated.');
  }catch(error){if(token!==operation||clarify!==dialog)return;setBusy(false);const message=dialog.querySelector('[data-sf-error]');message.textContent=error?.message||'The correction could not be saved. Please try again.';message.hidden=false;}
 }
 function openClarify(file,origin){
  cleanupClarify({restore:false});clarifyId=file.id;clarifyAnchor=origin;choice=null;
  clarify=document.createElement('dialog');clarify.className='sf-clarify-dialog';clarify.id='suggestion-clarify-dialog';clarify.setAttribute('aria-labelledby','sf-clarify-title');clarify.setAttribute('aria-describedby','sf-clarify-copy');
  clarify.innerHTML='<header class="sf-clarify-heading"><span>Clarify</span><button type="button" class="sf-close" data-sf-close aria-label="Close Clarify">'+closeIcon+'</button></header><h2 id="sf-clarify-title">Sorry, we missed the mark.</h2><p id="sf-clarify-copy">Which category fits this file?</p><div class="sf-category-options" role="group" aria-label="Correct suggestion category">'+Object.entries(labels).map(([id,label])=>'<button type="button" class="sf-category" data-sf-category="'+id+'" aria-pressed="false">'+categoryIcon(id)+'<span>'+label+'</span><span class="sf-category-check" aria-hidden="true">✓</span></button>').join('')+'</div><p class="sf-clarify-error" data-sf-error role="alert" hidden></p><footer class="sf-clarify-actions"><button type="button" class="sf-cancel" data-sf-close>Cancel</button><button type="button" class="sf-apply" data-sf-apply disabled>Apply correction</button></footer>';
  for(const preview of document.querySelectorAll('dialog[open]'))preview.classList.add('sf-preview-obscured');
  document.body.append(clarify);
  for(const button of clarify.querySelectorAll('[data-sf-close]'))button.onclick=()=>{if(!busy){operation++;cleanupClarify();}};
  for(const button of clarify.querySelectorAll('[data-sf-category]'))button.onclick=()=>{if(busy)return;choice=button.dataset.sfCategory;for(const option of clarify.querySelectorAll('[data-sf-category]'))option.setAttribute('aria-pressed',String(option===button));clarify.querySelector('[data-sf-apply]').disabled=false;};
  clarify.querySelector('[data-sf-apply]').onclick=applyCorrection;
  clarify.addEventListener('cancel',event=>{event.preventDefault();event.stopPropagation();if(!busy){operation++;cleanupClarify();}});
  clarify.addEventListener('close',()=>{if(clarify&&!clarify.open)cleanupClarify();});
  clarify.showModal();clarify.querySelector('[data-sf-close]').focus({preventScroll:true});
 }
 async function rate(rating){
  const origin=anchor,id=origin?.dataset.feedbackFile,token=++operation;if(!id)return;
  const file=activeFile(id);if(!file){closeMenu();return;}
  if(menu)for(const button of menu.querySelectorAll('button'))button.disabled=true;
  try{
   const result=await onRate?.(id,rating);if(token!==operation)return;
   if(!result)throw Error('Your feedback could not be saved. Please try again.');
   const updated=result.id?result:activeFile(id);if(!updated)throw Error('This file is no longer available for feedback.');
   closeMenu();syncControls(updated);
   if(rating==='good'){restoreFocus(id,origin);showNotice('Thanks for your feedback. We’ll keep improving.');}
   else openClarify(updated,origin);
  }catch(error){if(token!==operation)return;closeMenu({restore:true});showNotice(error?.message||'Your feedback could not be saved. Please try again.');}
 }
 function openMenu(button){
  const file=activeFile(button.dataset.feedbackFile);if(!file)return;
  closeMenu();clearNotice();anchor=button;menu=document.createElement('div');menu.className='sf-feedback-menu';menu.id='fileo-feedback-menu';menu.setAttribute('role','menu');menu.setAttribute('aria-label','AI suggestion feedback');
  menu.innerHTML='<button type="button" role="menuitem" data-sf-rating="good">'+upIcon()+'<span>Good suggestion</span></button><button type="button" role="menuitem" data-sf-rating="bad">'+downIcon()+'<span>Bad suggestion</span></button>';
  for(const item of menu.querySelectorAll('[data-sf-rating]'))item.onclick=()=>rate(item.dataset.sfRating);
  const host=button.closest('dialog[open]')||document.body;if(typeof menu.showPopover==='function')menu.setAttribute('popover','manual');host.append(menu);
  if(menu.hasAttribute('popover')){try{menu.showPopover();}catch{menu.removeAttribute('popover');}}
  button.setAttribute('aria-expanded','true');button.setAttribute('aria-controls',menu.id);place();menu?.querySelector('button')?.focus({preventScroll:true});
  observer=new MutationObserver(()=>{if(anchor&&(!anchor.isConnected||anchor.closest('[hidden],[inert]')||!anchor.getClientRects().length))closeMenu();else onMove();});observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden','inert','open']});
 }
 function onClick(event){
  if(!(event.target instanceof Element))return;
  const trigger=event.target.closest('button[data-feedback-file]');
  if(trigger){event.preventDefault();event.stopPropagation();if(trigger===anchor)closeMenu({restore:true});else openMenu(trigger);return;}
  if(menu&&!menu.contains(event.target))closeMenu();
 }
 function onFocus(event){if(menu&&event.target!==anchor&&!menu.contains(event.target))closeMenu();}
 function onKey(event){
  if(clarify?.open&&event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();if(!busy){operation++;cleanupClarify();}return;}
  if(!menu)return;
  if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();closeMenu({restore:true});return;}
  const items=[...menu.querySelectorAll('button:not(:disabled)')],index=items.indexOf(document.activeElement);
  if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){event.preventDefault();event.stopPropagation();const next=event.key==='Home'?0:event.key==='End'?items.length-1:(index+(event.key==='ArrowUp'?-1:1)+items.length)%items.length;items[next]?.focus();}
  else if(['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();event.stopPropagation();}
  else if(event.key==='Tab'){event.preventDefault();closeMenu({restore:true});}
 }
 document.addEventListener('click',onClick,true);document.addEventListener('focusin',onFocus);document.addEventListener('keydown',onKey,true);document.addEventListener('scroll',onMove,true);window.addEventListener('resize',onMove);
 return {close,destroy(){close();document.removeEventListener('click',onClick,true);document.removeEventListener('focusin',onFocus);document.removeEventListener('keydown',onKey,true);document.removeEventListener('scroll',onMove,true);window.removeEventListener('resize',onMove);}};
}
