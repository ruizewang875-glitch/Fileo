export const GENERAL_SETTINGS_KEY = 'fileo-general-settings-v1';
export const GENERAL_SETTINGS_DEFAULTS = Object.freeze({textSize:'standard',appearance:'light',reducedMotion:false,compatibility:false});

export function normalizeGeneralSettings(value) {
  const v=value&&typeof value==='object'?value:{};
  return {textSize:['standard','large','larger'].includes(v.textSize)?v.textSize:'standard',appearance:['light','dark','system'].includes(v.appearance)?v.appearance:'light',reducedMotion:v.reducedMotion===true,compatibility:v.compatibility===true};
}
export function readGeneralSettings(storage) {
  try{return normalizeGeneralSettings(JSON.parse(storage.getItem(GENERAL_SETTINGS_KEY)||'null'));}catch{return {...GENERAL_SETTINGS_DEFAULTS};}
}
export function saveGeneralSettings(storage,value) {
  const settings=normalizeGeneralSettings(value);
  try{storage.setItem(GENERAL_SETTINGS_KEY,JSON.stringify(settings));return {settings,saved:true};}catch{return {settings,saved:false};}
}

export function createGeneralSettings({onChange=()=>{},onSaved=()=>{}}={}) {
  let storage;
  try{storage=window.localStorage;}catch{storage=null;}
  let settings=readGeneralSettings(storage);
  const darkQuery=window.matchMedia('(prefers-color-scheme: dark)'), motionQuery=window.matchMedia('(prefers-reduced-motion: reduce)');
  const dialog=document.createElement('dialog');
  dialog.id='general-settings-dialog';dialog.className='general-settings-dialog';dialog.setAttribute('aria-labelledby','general-settings-title');
  dialog.innerHTML=`<header class="general-settings-heading"><div><span class="general-settings-eyebrow">Make yourself at home</span><h2 id="general-settings-title">General settings</h2></div><button type="button" class="general-settings-close" aria-label="Close general settings">×</button></header>
  <div class="general-settings-body">
    <section class="general-settings-section"><h3>Text size</h3><div class="general-options general-text-options" role="group" aria-label="Text size"><button type="button" data-text-size="standard"><b>Aa</b><span>Standard</span></button><button type="button" data-text-size="large"><b>Aa</b><span>Large</span></button><button type="button" data-text-size="larger"><b>Aa</b><span>Larger</span></button></div><p class="general-text-preview">A little more room to read.</p></section>
    <section class="general-settings-section"><h3>Appearance</h3><div class="general-options general-theme-options" role="group" aria-label="Appearance"><button type="button" data-appearance="light"><span class="general-theme-swatch theme-light" aria-hidden="true"></span><span>Light</span></button><button type="button" data-appearance="dark"><span class="general-theme-swatch theme-dark" aria-hidden="true"></span><span>Dark</span></button><button type="button" data-appearance="system"><span class="general-theme-swatch theme-system" aria-hidden="true"></span><span>System</span></button></div></section>
    <section class="general-settings-section general-settings-access"><h3>Comfort &amp; compatibility</h3><label class="general-switch"><span><strong>Reduce motion</strong><small>Pause automatic card motion and animated effects.</small></span><input id="general-reduced-motion" type="checkbox" role="switch"><i aria-hidden="true"></i></label><label class="general-switch"><span><strong>Compatibility mode</strong><small>Use simpler effects for smoother browsing.</small></span><input id="general-compatibility" type="checkbox" role="switch"><i aria-hidden="true"></i></label></section>
  </div><footer class="general-settings-footer"><span id="general-settings-status" role="status" aria-live="polite"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 10 3 3 7-7"/></svg>Changes save automatically</span></footer>`;
  document.body.append(dialog);
  const $=s=>dialog.querySelector(s);
  function effective(){return {...settings,reducedMotion:settings.reducedMotion||motionQuery.matches};}
  function apply(){
    const root=document.documentElement,prefs=effective();
    root.dataset.theme=settings.appearance==='system'?(darkQuery.matches?'dark':'light'):settings.appearance;
    root.dataset.textSize=settings.textSize;
    root.dataset.reduceMotion=String(prefs.reducedMotion||prefs.compatibility);
    root.dataset.compatibility=String(prefs.compatibility);
    root.style.colorScheme=root.dataset.theme;
    dialog.querySelectorAll('button[data-text-size]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.textSize===settings.textSize)));
    dialog.querySelectorAll('button[data-appearance]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.appearance===settings.appearance)));
    $('#general-reduced-motion').checked=settings.reducedMotion;$('#general-compatibility').checked=settings.compatibility;
    onChange(prefs);window.dispatchEvent(new CustomEvent('fileo:settings-changed',{detail:prefs}));
  }
  function update(patch,label){
    const result=saveGeneralSettings(storage,{...settings,...patch});settings=result.settings;apply();
    const status=$('#general-settings-status');status.dataset.error=String(!result.saved);
    status.innerHTML=result.saved?`<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 10 3 3 7-7"/></svg>${label} updated`:'Applied for this visit. Browser storage is unavailable.';
    if(result.saved)onSaved({settings:{...settings},label});
  }
  dialog.addEventListener('click',e=>{
    const button=e.target.closest('button[data-text-size],button[data-appearance]');
    if(!button||!dialog.contains(button))return;
    if(button.hasAttribute('data-text-size'))update({textSize:button.dataset.textSize},'Text size');
    else update({appearance:button.dataset.appearance},'Appearance');
  });
  $('#general-reduced-motion').addEventListener('change',e=>update({reducedMotion:e.target.checked},'Motion preference'));
  $('#general-compatibility').addEventListener('change',e=>update({compatibility:e.target.checked},'Compatibility preference'));
  $('.general-settings-close').addEventListener('click',()=>dialog.close());
  darkQuery.addEventListener?.('change',()=>{if(settings.appearance==='system')apply();});motionQuery.addEventListener?.('change',apply);
  window.addEventListener('storage',e=>{if(e.key===GENERAL_SETTINGS_KEY){settings=readGeneralSettings(storage);apply();}});
  apply();
  return {open(){if(!dialog.open)dialog.showModal();},state(){return {...settings};},effective,destroy(){dialog.remove();}};
}
