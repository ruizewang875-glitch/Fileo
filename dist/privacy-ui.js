import {PRIVACY_TYPES,PRIVACY_VERSION,allTypePermissions} from './privacy.js';

const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const chevron='<svg aria-hidden="true" viewBox="0 0 16 16" fill="none"><path d="m4 6 4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const shield='<svg aria-hidden="true" viewBox="0 0 24 24" fill="none"><path d="M12 3 4.5 6v6c0 4.4 4.8 7.7 7.5 9 2.7-1.3 7.5-4.6 7.5-9V6L12 3Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="m8.5 11.6 2.2 2.2 4.8-4.9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

// One shared consent editor serves first-use and account settings. A draft is
// committed only by a named consent/save action; closing never grants permission.
export function createPrivacyUI({getPrivacy,setPrivacy,onSaved=()=>{}}){
 const dialog=document.createElement('dialog');
 dialog.id='privacy-dialog';dialog.className='privacy-dialog';
 dialog.setAttribute('aria-labelledby','privacy-title');
 dialog.innerHTML=`<form id="privacy-form">
  <header class="privacy-header"><span class="privacy-symbol">${shield}</span><div><h2 id="privacy-title" tabindex="-1">Privacy &amp; AI access</h2><p id="privacy-intro">Choose which file types FILEO may use for AI suggestions.</p></div><button type="button" class="privacy-close" id="privacy-close" aria-label="Close privacy settings">×</button></header>
  <div class="privacy-body" id="privacy-body">
   <section class="privacy-notice" aria-label="About this prototype"><strong>Your files. Your permission.</strong><p>These switches control AI suggestions. Browsing, previewing and manually organizing your selected files remain available with AI turned off.</p></section>
   <section class="privacy-policy" aria-labelledby="privacy-policy-title"><h3 id="privacy-policy-title">How FILEO uses your information</h3>
    <div class="privacy-policy-item"><h4>What is read</h4><p>For enabled types, the demo uses prepared sample information to show the intended AI experience. Green “Successfully read” receipts on sample files are simulated. Real uploads are currently assessed from file names, types, sizes and modified dates, not extracted document text or image pixels.</p></div>
    <div class="privacy-policy-item"><h4>Where it stays</h4><p>This prototype runs its recommendation rules in your browser. It does not send selected file contents to an AI model. It has no live model connection. A future model service would need a separate disclosure before any upload.</p></div>
    <div class="privacy-policy-item"><h4>What is stored</h4><p>Your demo profile, file metadata, project preferences, choices and history are saved on this browser. Copies of the original files you select and generated preview thumbnails may also be saved locally so you can reopen them after a refresh. Choosing a file or folder gives FILEO access only to the items you select; these AI switches do not grant access to the rest of your device.</p></div>
    <div class="privacy-policy-item"><h4>How a suggestion is made</h4><p>FILEO combines the permitted evidence with your project preferences. Similar previews, copy-like names, age or size can suggest what to review; none proves that a file is safe to delete. Uncertain cases stay Undecided. You choose whether to keep, archive or move a file to Trash.</p></div>
    <div class="privacy-policy-item"><h4>Change your mind</h4><p>Turn a type off and save to stop its AI suggestions and clear the evidence shown for that type. This does not delete locally saved original files, thumbnails, decisions or history. History contains Archive and Recycle bin. Archived files leave the active workspace and cannot be opened until restored; they have no expiry. Recycle bin files can be restored for 180 days after deletion. At expiry, FILEO permanently removes its catalog record and locally stored copies and previews, so it cannot restore them. This browser-only prototype checks expiry when opened and while running; it has no background server. Original files on your device stay untouched. Clearing this site's browser data removes its saved local workspace.</p></div>
   </section>
   <section class="privacy-types" aria-labelledby="privacy-types-title"><div class="privacy-types-heading"><div><h3 id="privacy-types-title">Allow AI by file type</h3><p>Sample reading scope and how each type is assessed.</p></div><div class="privacy-bulk"><button type="button" id="privacy-all-types">Allow all</button><span aria-hidden="true">·</span><button type="button" id="privacy-no-types">Turn all off</button></div></div>
    <div id="privacy-type-list"></div>
   </section>
   <p class="privacy-policy-version">FILEO prototype · Policy ${escape(PRIVACY_VERSION)}</p>
  </div>
  <footer class="privacy-footer"><div class="privacy-selection"><span id="privacy-selection-count" role="status" aria-live="polite"></span><span id="privacy-save-error" role="alert" hidden></span></div><div id="privacy-onboarding-actions" class="privacy-actions"><button type="button" id="privacy-reject">Continue without AI</button><button type="submit" id="privacy-selected">Use selected</button><button type="button" id="privacy-accept">Allow all &amp; continue</button></div><div id="privacy-settings-actions" class="privacy-actions" hidden><button type="button" id="privacy-cancel">Cancel</button><button type="submit" id="privacy-save">Save choices</button></div></footer>
 </form>`;
 document.body.append(dialog);
 const $=s=>dialog.querySelector(s),list=$('#privacy-type-list'),scroll=$('#privacy-body');
 let active=null,draft=allTypePermissions(false);
 for(const type of PRIVACY_TYPES){
  const row=document.createElement('article');row.className='privacy-type';row.dataset.type=type.id;
  const exts=Array.isArray(type.extensions)?type.extensions.join(' · '):String(type.extensions||'');
  row.innerHTML=`<div class="privacy-type-header"><label for="privacy-type-${escape(type.id)}"><strong>${escape(type.label)}</strong><span>${escape(exts)}</span></label><label class="privacy-switch"><input id="privacy-type-${escape(type.id)}" data-privacy-type="${escape(type.id)}" type="checkbox" role="switch" aria-label="Allow AI to read ${escape(type.label)} files"><span aria-hidden="true"></span></label></div><p class="privacy-read-scope">${(type.reads||[]).map(escape).join(' · ')}</p><details class="privacy-method"><summary>How this is assessed ${chevron}</summary><p>${escape(type.method)}</p></details>`;
  row.querySelector('input').addEventListener('change',e=>{draft[type.id]=e.target.checked;updateSelection();});
  list.append(row);
 }
 function updateSelection(){
  const count=PRIVACY_TYPES.filter(t=>draft[t.id]===true).length;
  $('#privacy-selection-count').textContent=count?`${count} of ${PRIVACY_TYPES.length} file types allowed`:'AI reading is off for all file types';
  for(const row of list.children)row.dataset.allowed=String(draft[row.dataset.type]===true);
 }
 function draw(){
  for(const input of list.querySelectorAll('[data-privacy-type]'))input.checked=draft[input.dataset.privacyType]===true;
  updateSelection();
 }
 function syncAccount(){
  const state=getPrivacy(),count=PRIVACY_TYPES.filter(t=>state?.types?.[t.id]===true).length;
  const label=document.getElementById('privacy-account-summary');
  if(label)label.textContent=state?.acceptedVersion===PRIVACY_VERSION?(count?`${count} file types allowed`:'AI reading off'):'Choose what AI can read';
 }
 function finish(saved){
  if(!active)return;
  const request=active;active=null;
  if(dialog.open)dialog.close();
  if(request.opener?.isConnected&&request.opener.closest('dialog')?.open!==false)request.opener.focus({preventScroll:true});
  request.resolve(saved);
 }
 function commit(types){
  if(!active||active.mode==='policy')return;
  $('#privacy-save-error').hidden=true;
  try{
   if(setPrivacy({...types})===false)throw new Error('save failed');
   syncAccount();finish(true);
   try{onSaved();}catch(error){console.error('FILEO privacy refresh failed',error);}
  }catch{
   $('#privacy-save-error').textContent='Your choices could not be saved. Please try again.';
   $('#privacy-save-error').hidden=false;
  }
 }
 $('#privacy-form').addEventListener('submit',event=>{event.preventDefault();commit(draft);});
 $('#privacy-accept').addEventListener('click',()=>commit(allTypePermissions(true)));
 $('#privacy-reject').addEventListener('click',()=>commit(allTypePermissions(false)));
 $('#privacy-all-types').addEventListener('click',()=>{draft=allTypePermissions(true);draw();});
 $('#privacy-no-types').addEventListener('click',()=>{draft=allTypePermissions(false);draw();});
 $('#privacy-close').addEventListener('click',()=>finish(false));
 $('#privacy-cancel').addEventListener('click',()=>finish(false));
 dialog.addEventListener('cancel',event=>{event.preventDefault();finish(false);});
 dialog.addEventListener('close',()=>{if(active)finish(false);});
 dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const b=dialog.getBoundingClientRect();if(event.clientX<b.left||event.clientX>b.right||event.clientY<b.top||event.clientY>b.bottom)finish(false);});
 function open({mode='settings'}={}){
  if(active)return active.promise;
  let resolve;const promise=new Promise(r=>{resolve=r;});
  active={resolve,promise,opener:document.activeElement,mode};
  const stored=getPrivacy(),onboarding=mode==='onboarding',readOnly=mode==='policy';
  draft=allTypePermissions(false);
  if(stored?.acceptedVersion===PRIVACY_VERSION)for(const type of PRIVACY_TYPES)draft[type.id]=stored.types?.[type.id]===true;
  dialog.dataset.mode=mode;
  $('#privacy-title').textContent=readOnly?'Privacy policy':onboarding?'Before FILEO reads':'Privacy & AI access';
  $('#privacy-intro').textContent=readOnly?'Review the reading scope below. You will choose your permissions when you continue signing in.':onboarding?'Choose what AI may use. You can change this later in your account.':'Choose which file types FILEO may use for AI suggestions.';
  $('#privacy-onboarding-actions').hidden=!onboarding;$('#privacy-settings-actions').hidden=onboarding;
  $('#privacy-save').hidden=readOnly;$('#privacy-cancel').textContent=readOnly?'Close':'Cancel';
  $('.privacy-bulk').hidden=readOnly;$('.privacy-selection').hidden=readOnly;
  $('#privacy-types-title').textContent=readOnly?'Reading scope by file type':'Allow AI by file type';
  for(const input of list.querySelectorAll('[data-privacy-type]'))input.disabled=readOnly;
  $('#privacy-save-error').hidden=true;
  for(const d of list.querySelectorAll('details'))d.open=false;
  draw();dialog.showModal();scroll.scrollTop=0;$('#privacy-title').focus({preventScroll:true});
  return promise;
 }
 syncAccount();
 return {open,syncAccount};
}
