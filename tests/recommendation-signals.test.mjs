import test from 'node:test';
import assert from 'node:assert/strict';
import {assessRecommendation} from '../dist/recommendation.js';
import {PRIVACY_VERSION,allTypePermissions} from '../dist/privacy.js';

const now=Date.UTC(2026,10,7);
const file={id:'copy',source:'demo',project:'Studio',file:'lounge_backup.3dm',ext:'.3dm',type:'3dm',app:'Rhino',baseBucket:'trash',size:18,modified:'2026-10-17',previewKey:'lounge',previewFamily:'nora'};
const peer={...file,id:'original',file:'lounge.3dm',baseBucket:'keep'};
const assess=(f=file,options={})=>assessRecommendation(f,{files:[file,peer],now,...options});
const signal=(result,tag)=>result.reasonSignals.find(item=>item.tag===tag)?.explanation;

test('visible signals match tags exactly and explain separate evidence rather than repeating the entire rationale',()=>{
 const result=assess();
 assert.deepEqual(result.reasonSignals.map(item=>item.tag),result.tags);
 assert.equal(new Set(result.reasonSignals.map(item=>item.explanation)).size,result.tags.length);
 for(const item of result.reasonSignals){assert.ok(item.explanation.trim());assert.notEqual(item.explanation,result.reason);}
 assert.match(signal(result,'Matching preview'),/“lounge\.3dm”/);
 assert.match(signal(result,'Matching preview'),/editable source data.*may still differ/);
 assert.match(signal(result,'Same size'),/18 MB/);
 assert.match(signal(result,'Same size'),/do not prove/);
 assert.match(signal(result,'Copy in filename'),/marker “backup”/);
 assert.doesNotMatch(signal(result,'Copy in filename'),/18 MB|lounge\.3dm/);
});

test('per-tag comparisons use only relevant peers and update with their evidence',()=>{
 const exported={...peer,id:'export',file:'lounge.jpg',type:'jpg',ext:'.jpg'};
 const renamed={...peer,file:'chair_master.3dm',size:24};
 const result=assess(file,{files:[exported,renamed]});
 assert.match(signal(result,'Matching preview'),/chair_master\.3dm/);
 assert.doesNotMatch(signal(result,'Matching preview'),/lounge\.jpg/);
 assert.ok(!result.tags.includes('Same size'));
 const foreign=assess(file,{files:[{...peer,project:'Other'}]});
 assert.ok(!foreign.tags.includes('Matching preview'));
});

test('a peer moved to Trash remains a visible decisive signal, including with a project preference',()=>{
 const trashed={...peer,decision:'trash'};
 for(const source of ['demo','local']){
  const candidate={...file,source,lastModified:now};
  const counterpart={...trashed,source};
  for(const tags of [[],['Keep Rhino']]){
   const result=assess(candidate,{files:[counterpart],tags});
   assert.equal(result.bucket,tags.length?'keep':'undecided');
   assert.equal(result.tags[0],'Peer in Trash');
   assert.ok(result.tags.length<=3);
   assert.match(signal(result,'Peer in Trash'),/“lounge\.3dm” is already in Trash/);
   assert.match(signal(result,'Peer in Trash'),/choose which version to retain/);
   if(tags.length)assert.ok(result.tags.includes('Preference: Keep Rhino'));
  }
 }
});

test('version and date signals provide the specific change and recorded edit date',()=>{
 const draft={...file,file:'frame_test.3dm',previewKey:'wireframe',previewNote:'Tubular frame without upholstered seats',baseBucket:'undecided'};
 const result=assess(draft);
 assert.match(signal(result,'Distinct version'),/Tubular frame without upholstered seats/);
 assert.match(signal(result,'Working iteration'),/frame_test\.3dm/);
 assert.match(signal(result,'Recent edit'),/2026-10-17/);
 assert.match(signal(result,'Recent edit'),/does not show when it was last opened/);
});

test('preference explanations update with the current preference and resulting recommendation',()=>{
 const draft={...file,file:'frame_test.3dm',previewKey:'wireframe',baseBucket:'undecided'};
 const preserve=assess(draft,{tags:['Preserve drafts']});
 assert.equal(preserve.bucket,'keep');
 assert.match(signal(preserve,'Preference: Preserve drafts'),/draft, test or numbered iteration/);
 assert.match(signal(preserve,'Preference: Preserve drafts'),/keeping this file/);
 const archive=assess(draft,{tags:['Archive Rhino']});
 assert.equal(archive.bucket,'archive');
 assert.match(signal(archive,'Preference: Archive Rhino'),/“rhino” matches/);
 assert.match(signal(archive,'Preference: Archive Rhino'),/archiving this file/);
 assert.ok(!archive.reasonSignals.some(item=>item.tag==='Preference: Preserve drafts'));
});

test('real imports describe filename relationships and never claim their preview was compared',()=>{
 const local={...file,source:'local',lastModified:now,previewNote:'Hidden author text'};
 const result=assess(local,{files:[{...peer,source:'local'}]});
 assert.ok(result.tags.includes('Related filename'));
 assert.match(signal(result,'Related filename'),/contents were not compared/);
 assert.doesNotMatch(result.reasonSignals.map(item=>item.explanation).join(' '),/Hidden author text|demo file|visible result matches/);
});

test('disabled reading short-circuits signal generation without leaking cached evidence',()=>{
 const denied={source:'demo',file:'private.docx',ext:'.docx',type:'doc',get previewNote(){throw Error('Content accessed');},get baseBucket(){throw Error('Scoring accessed');}};
 const privacy={acceptedVersion:PRIVACY_VERSION,acceptedAt:now,types:{...allTypePermissions(true),doc:false}};
 const result=assess(denied,{privacy});
 assert.deepEqual(result.reasonSignals.map(item=>item.tag),['AI reading off']);
 assert.match(result.reasonSignals[0].explanation,/No AI recommendation is generated/);
 assert.doesNotMatch(result.reasonSignals[0].explanation,/Successfully read|preview matches/);
});
