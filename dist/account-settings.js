// Account changes are independent: no global save and no hidden draft commits.
export function createAccountSettings({getSession,saveName,onNameSaved=()=>{}}){
 const $=id=>document.getElementById(id),input=$('display-name'),save=$('account-name-save');
 const dialog=document.createElement('dialog');
 dialog.id='account-feedback';dialog.className='account-feedback';
 dialog.setAttribute('aria-labelledby','account-feedback-title');
 dialog.setAttribute('aria-describedby','account-feedback-description');
 dialog.innerHTML=`<span class="account-feedback-mark" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="m5 12 4 4L19 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></span><h2 id="account-feedback-title"></h2><p id="account-feedback-description"></p><div class="account-feedback-actions"><button type="button" id="account-feedback-cancel">Cancel</button><button type="button" id="account-feedback-confirm">Done</button></div>`;
 document.body.append(dialog);
 let action=null,opener=null;
 function sync(){
  const p=getSession();$('account-name').textContent=p.name;input.value=p.name;
  $('account-email').textContent=p.email||'Prototype workspace';
  $('account-avatar').textContent=p.name.trim().split(/\s+/).map(v=>Array.from(v)[0]||'').slice(0,2).join('').toUpperCase();
  syncSave();
 }
 function syncSave(){save.hidden=input.value.trim()===getSession().name;save.disabled=!input.value.trim();}
 function show(title,description,{confirm='Done',onConfirm=null}={}){
  action=onConfirm;if(!dialog.open)opener=document.activeElement;
  $('account-feedback-title').textContent=title;$('account-feedback-description').textContent=description;
  $('account-feedback-cancel').hidden=!onConfirm;$('account-feedback-confirm').textContent=confirm;
  dialog.dataset.kind=onConfirm?'confirm':'success';
  if(!dialog.open)dialog.showModal();$('account-feedback-confirm').focus();
 }
 function dismiss(){action=null;dialog.close();if(opener?.isConnected&&opener.getClientRects().length)opener.focus({preventScroll:true});else if($('account-panel').open)input.focus({preventScroll:true});}
 $('account-feedback-cancel').onclick=dismiss;
 $('account-feedback-confirm').onclick=()=>{
  if(!action){dismiss();return;}
  const apply=action;action=null;apply();
 };
 dialog.addEventListener('cancel',e=>{e.preventDefault();dismiss();});
 input.addEventListener('input',syncSave);
 $('account-form').addEventListener('submit',e=>{
  e.preventDefault();const name=input.value.trim().replace(/\s+/g,' ');
  if(!name||name===getSession().name)return;
  show('Update your display name?',`Your name will appear as “${name}”.`,{confirm:'Save name',onConfirm:()=>{
   const saved=saveName(name);sync();onNameSaved();
   show(saved===false?'Saved for this visit':'Name updated',saved===false?'Browser storage is unavailable. Your new name may not remain after you close this page.':'Your new name is saved and ready to use.');
  }});
 });
 return {sync,show};
}
