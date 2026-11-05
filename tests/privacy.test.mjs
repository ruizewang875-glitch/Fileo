import test from 'node:test';
import assert from 'node:assert/strict';
import {PRIVACY_VERSION,PRIVACY_TYPES,freshPrivacy,normalizePrivacy,allTypePermissions,privacyTypeFor,readAccessFor} from '../dist/privacy.js';
import {createWorkspace} from '../dist/workspace.js';
import {assessRecommendation} from '../dist/recommendation.js';
import {TYPES} from '../dist/data.js';
const NOW=Date.parse('2026-11-05T10:00:00Z');
const memory=()=>{const m=new Map();return {getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v)};};
const make=(storage=memory())=>createWorkspace({storage,now:()=>NOW});
const consent=types=>({acceptedVersion:PRIVACY_VERSION,acceptedAt:NOW,types});
const source={name:'private_copy.docx',size:12000,lastModified:NOW-86400000};

test('all known file types have explicit scopes; no default or malformed consent enables reading',()=>{
 assert.equal(PRIVACY_TYPES.length,TYPES.length+1);
 for(const type of TYPES)assert.equal(privacyTypeFor(type).id,type.id);
 assert.equal(privacyTypeFor({file:'PHOTO.JPEG'}).id,'jpg');
 assert.equal(privacyTypeFor({file:'notes.custom'}).id,'other');
 assert.ok(Object.values(freshPrivacy().types).every(x=>x===false));
 for(const raw of [null,{types:allTypePermissions(true)},consent([]),{...consent(allTypePermissions(true)),acceptedVersion:'old'},{...consent(allTypePermissions(true)),acceptedAt:'now'}])assert.deepEqual(normalizePrivacy(raw),freshPrivacy());
 const p=normalizePrivacy(consent({...allTypePermissions(false),doc:'true',png:true}));
 assert.equal(p.types.doc,false);assert.equal(p.types.png,true);assert.equal(p.types.other,false);
});

test('unconsented imports and demo samples stay pending and do not produce AI analysis',()=>{
 const ws=make();ws.importFiles([source]);ws.loadDemo();
 assert.ok(ws.getState().files.every(f=>f.bucket==='undecided'&&f.readAccess.status==='pending'&&f.readAccess.items.length===0));
 assert.equal(ws.getPrivacy().acceptedVersion,null);
 assert.ok(ws.getState().files.every(f=>!f.reason.includes('preview matches')&&!f.reason.includes('copy or backup')));
 ws.setPrivacy(allTypePermissions(false));
 assert.equal(ws.getPrivacy().acceptedVersion,PRIVACY_VERSION);
 assert.ok(ws.getState().files.every(f=>f.readAccess.status==='disabled'&&f.reasonTags[0]==='AI reading off'));
});

test('explicit per-type consent permits only that type and accurately distinguishes demo from imported files',()=>{
 const ws=make();ws.importFiles([source]);ws.loadDemo();ws.setPrivacy({...allTypePermissions(false),doc:true});
 const files=ws.getState().files,docs=files.filter(f=>f.type==='doc');assert.ok(docs.length>1);
 assert.ok(files.filter(f=>f.type!=='doc').every(f=>f.bucket==='undecided'&&f.readAccess.status==='disabled'));
 const imported=docs.find(f=>f.source==='local');assert.equal(imported.bucket,'trash');assert.equal(imported.readAccess.status,'limited');assert.equal(imported.readAccess.demo,false);
 assert.deepEqual(imported.readAccess.items,['Filename','File type','File size','Modified date']);
 assert.doesNotMatch(imported.readAccess.items.join(' '),/keywords|Document text|pixels/);
 assert.ok(docs.filter(f=>f.source==='demo').every(f=>f.readAccess.status==='success'&&f.readAccess.demo===true&&f.readAccess.items.includes('Document text, headings and keywords')));
});

test('revoking a type refreshes all projects without undoing human choices or breaking History',()=>{
 const store=memory(),ws=make(store);ws.setPrivacy(allTypePermissions(true));ws.loadDemo();
 const a=ws.importFiles([source],{project:'A'}).ids[0],b=ws.importFiles([source],{project:'B'}).ids[0];
 const e=ws.decide(a,'archive'),lookup=id=>ws.getState().files.find(f=>f.id===id);
 ws.setPrivacy({...allTypePermissions(true),doc:false});
 for(const id of [a,b]){assert.equal(lookup(id).bucket,'undecided');assert.deepEqual(lookup(id).readAccess.items,[]);assert.doesNotMatch(lookup(id).reason,/copy or backup|preview matches/);}
 assert.equal(lookup(a).decision,'archive');assert.ok(ws.canUndo(e.id));
 assert.equal(ws.getState().files.find(f=>f.type==='psd').readAccess.status,'success');
 const reloaded=make(store);assert.equal(reloaded.getPrivacy().types.doc,false);assert.equal(reloaded.getState().files.find(f=>f.id===a).readAccess.status,'disabled');
 reloaded.undo(e.id);assert.equal(reloaded.getState().files.find(f=>f.id===a).decision,'pending');
 reloaded.setPrivacy(allTypePermissions(true));assert.equal(reloaded.getState().files.find(f=>f.id===a).bucket,'trash');
});

test('legacy workspaces re-consent rather than silently inherit access or display old cached rationale',()=>{
 const store=memory(),ws=make(store);ws.setPrivacy(allTypePermissions(true));ws.loadDemo();const action=ws.decide('file-1','keep');
 const old=ws.getState();delete old.privacy;store.setItem('fileo-workspace-v2',JSON.stringify(old));
 const migrated=make(store),s=migrated.getState();assert.equal(s.privacy.acceptedVersion,null);
 assert.ok(s.files.every(f=>f.readAccess.status==='pending'&&f.bucket==='undecided'));
 assert.equal(s.files.find(f=>f.id==='file-1').decision,'keep');assert.ok(migrated.canUndo(action.id));
});

test('denied analysis short-circuits before touching rationale fields and filters forbidden comparison peers',()=>{
 const denied={source:'demo',file:'private.docx',ext:'.docx',type:'doc',get previewNote(){throw Error('Content was read');},get baseBucket(){throw Error('Scoring ran');}};
 const policy=consent({...allTypePermissions(true),doc:false});
 const r=assessRecommendation(denied,{privacy:policy});assert.equal(r.bucket,'undecided');
 const jpeg={source:'demo',id:'a',project:'P',file:'image_copy.jpg',ext:'.jpg',type:'jpg',size:12,baseBucket:'trash',previewKey:'same',previewFamily:'photo',modified:'2026-10-01'};
 const badPeer={id:'b',project:'P',source:'demo',type:'doc',ext:'.docx',file:'private.docx',get previewKey(){throw Error('Disabled peer compared');}};
 assert.doesNotThrow(()=>assessRecommendation(jpeg,{privacy:policy,files:[badPeer],now:NOW}));
 assert.equal(readAccessFor({...jpeg,source:'local',lastModified:0},policy).items.includes('Modified date'),false);
});
