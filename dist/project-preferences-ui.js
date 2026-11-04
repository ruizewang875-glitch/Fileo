import {PREFERENCE_PRESETS} from './recommendation.js';

const clean = s => String(s ?? '').trim().replace(/\s+/g,' ').slice(0,48).trim();
const key = s => clean(s).toLowerCase();
const presetKeys = new Set(PREFERENCE_PRESETS.map(key));

// The workspace owns persistence and scoring. This editor only commits an
// explicit Save/Continue, so Escape / Skip never commit a half-edited draft.
export function createProjectPreferencesUI({getTags,setTags,onSaved=()=>{}}) {
  const byId = id => document.getElementById(id);
  const dialog = byId('prefs-dialog'), form = byId('prefs-form');
  const custom = byId('prefs-custom'), add = byId('prefs-add'), feedback = byId('prefs-feedback');
  const chips = byId('prefs-presets'), customList = byId('prefs-custom-list');
  const accountEdit = byId('prefs-account-edit');
  let accountProject = '', active = null, tags = [];
  const picked = tag => tags.some(t=>key(t)===key(tag));

  function announce(message='') {
    feedback.textContent=message;
    feedback.hidden=!message;
  }
  function draw() {
    for(const btn of chips.children) btn.setAttribute('aria-pressed',String(picked(btn.dataset.tag)));
    customList.replaceChildren();
    const customs=tags.filter(t=>!presetKeys.has(key(t)));
    for(const tag of customs){
      const btn=document.createElement('button');
      btn.type='button';btn.className='prefs-custom-tag';btn.textContent=tag;
      btn.setAttribute('aria-label',`Remove preference: ${tag}`);
      btn.addEventListener('click',()=>{tags=tags.filter(t=>key(t)!==key(tag));draw();announce();custom.focus();});
      customList.append(btn);
    }
    customList.hidden=customs.length===0;
    add.disabled=!clean(custom.value);
  }
  function insert(tag) {
    const normalized=clean(tag);
    if(!normalized)return true;
    if(picked(normalized))return true;
    if(tags.length>=12){announce('Choose up to 12 tags. Remove one to add another.');return false;}
    tags.push(PREFERENCE_PRESETS.find(p=>key(p)===key(normalized))||normalized);
    return true;
  }
  function addCustom() {
    if(!insert(custom.value)){custom.focus();return false;}
    custom.value='';draw();announce();return true;
  }
  for(const label of PREFERENCE_PRESETS){
    const btn=document.createElement('button');
    btn.className='prefs-preset';btn.type='button';btn.dataset.tag=label;btn.textContent=label;
    btn.setAttribute('aria-pressed','false');
    btn.addEventListener('click',()=>{
      announce();
      if(picked(label))tags=tags.filter(t=>key(t)!==key(label));else if(!insert(label))return;
      draw();
    });
    chips.append(btn);
  }
  add.addEventListener('click',()=>{addCustom();custom.focus();});
  custom.addEventListener('input',()=>{add.disabled=!clean(custom.value);announce();});
  custom.addEventListener('keydown',e=>{
    if(e.key==='Enter'&&!e.isComposing){e.preventDefault();addCustom();}
  });

  function syncAccount(project) {
    accountProject=String(project||'').trim();
    byId('account-project-preferences').hidden=!accountProject;
    if(!accountProject)return;
    const list=getTags(accountProject)||[],rest=list.length-2;
    byId('prefs-account-project').textContent=accountProject;
    byId('prefs-account-summary').textContent=list.length?list.slice(0,2).join(' · ')+(rest>0?` · +${rest}`:''):'Add preferences';
    accountEdit.setAttribute('aria-label',`Edit project preferences for ${accountProject}`);
  }
  function finish(outcome) {
    if(!active)return;
    const request=active;active=null;
    if(dialog.open)dialog.close();
    request.resolve(outcome);
  }
  function open(project,mode) {
    project=String(project||'').trim();
    if(!project)return Promise.resolve('back');
    if(active) return active.promise;
    let resolve;
    const promise=new Promise(r=>{resolve=r;});
    active={project,mode,promise,resolve};
    tags=[...(getTags(project)||[])];
    custom.value='';draw();announce();
    byId('prefs-project-name').textContent=project;
    byId('prefs-title').textContent=mode==='edit'?'Project preferences':'What matters for this project?';
    byId('prefs-skip').textContent=mode==='edit'?'Cancel':'Skip for now';
    byId('prefs-submit-label').textContent=mode==='edit'?'Save preferences':'Continue';
    byId('prefs-cancel').setAttribute('aria-label',mode==='edit'?'Close project preferences':'Back to project setup');
    dialog.showModal();byId('prefs-title').focus({preventScroll:true});
    return promise;
  }
  form.addEventListener('submit',e=>{
    e.preventDefault();if(!active||!addCustom())return;
    const {project,mode}=active;
    setTags(project,[...tags]);finish('continue');
    if(mode==='edit'){syncAccount(project);onSaved(project);}
  });
  byId('prefs-skip').addEventListener('click',()=>finish(active?.mode==='edit'?'back':'skip'));
  byId('prefs-cancel').addEventListener('click',()=>finish('back'));
  dialog.addEventListener('cancel',e=>{e.preventDefault();finish('back');});
  dialog.addEventListener('close',()=>{if(!dialog.open&&active)finish('back');});
  accountEdit.addEventListener('click',()=>{if(accountProject)open(accountProject,'edit');});
  return {setup:project=>open(project,'setup'),syncAccount};
}
