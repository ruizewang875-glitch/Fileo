import test from 'node:test';
import assert from 'node:assert/strict';
import {GENERAL_SETTINGS_KEY,normalizeGeneralSettings,readGeneralSettings,saveGeneralSettings} from '../dist/general-settings.js';

test('display settings survive a browser storage round-trip and cannot include a sorting preference',()=>{
 const values=new Map(),storage={getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)};
 const prefs={textSize:'larger',appearance:'dark',reducedMotion:true,compatibility:true};
 assert.equal(saveGeneralSettings(storage,{...prefs,sort:'name'}).saved,true);
 assert.deepEqual(readGeneralSettings(storage),prefs);
 assert.equal(JSON.parse(values.get(GENERAL_SETTINGS_KEY)).sort,undefined);
});
test('corrupt or unavailable storage falls back safely without claiming a save',()=>{
 const broken={getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}};
 assert.deepEqual(readGeneralSettings(broken),{textSize:'standard',appearance:'light',reducedMotion:false,compatibility:false});
 assert.equal(saveGeneralSettings(broken,{appearance:'dark'}).saved,false);
 assert.equal(readGeneralSettings({getItem:()=>'{broken'}).appearance,'light');
});
test('unsupported persisted values never activate arbitrary theme or motion classes',()=>{
 assert.deepEqual(normalizeGeneralSettings({textSize:'huge',appearance:'sepia',reducedMotion:'false',compatibility:1}),{textSize:'standard',appearance:'light',reducedMotion:false,compatibility:false});
 assert.equal(normalizeGeneralSettings({appearance:'system',textSize:'large'}).appearance,'system');
});
