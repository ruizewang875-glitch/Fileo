import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorkspace} from '../dist/workspace.js';
import {assessRecommendation,normalizeSuggestionFeedback} from '../dist/recommendation.js';
import {allTypePermissions} from '../dist/privacy.js';

const NOW=Date.parse('2026-11-09T08:00:00Z'),DAY=86400000,KEY='fileo-workspace-v2';
function fixture({privacy=true}={}){
 let clock=NOW;const data=new Map(),storage={getItem:key=>data.get(key)||null,setItem:(key,value)=>data.set(key,value)},now=()=>clock;
 const ws=createWorkspace({storage,now});ws.setPrivacy(allTypePermissions(privacy));
 return {ws,storage,now,advance:days=>{clock+=days*DAY;},reload:()=>createWorkspace({storage,now})};
}
const input=(name,extra={})=>({name,size:1200000,lastModified:NOW-100*DAY,type:'text/plain',...extra});
const get=(ws,id)=>ws.getState().files.find(file=>file.id===id);

test('good and unconfirmed bad ratings persist without changing the suggestion or file action',()=>{
 const ctx=fixture(),ws=ctx.ws,id=ws.importFiles([input('study_copy.txt')],{project:'Studio'}).ids[0],before=get(ws,id);
 const good=ws.setSuggestionFeedback(id,{rating:'good'});
 assert.deepEqual(good.suggestionFeedback,{rating:'good',at:NOW});
 ctx.advance(190);const bad=ws.setSuggestionFeedback(id,{rating:'bad'});
 assert.deepEqual(bad.suggestionFeedback,{rating:'bad',at:ctx.now()});
 for(const file of [good,bad]){
  assert.equal(file.bucket,before.bucket);assert.equal(file.reason,before.reason);assert.deepEqual(file.reasonTags,before.reasonTags);
  assert.equal(file.decision,before.decision);assert.equal(file.revision,before.revision);assert.equal(file.updatedAt,before.updatedAt);
 }
 assert.equal(ws.getState().history.length,0);assert.deepEqual(get(ctx.reload(),id).suggestionFeedback,bad.suggestionFeedback);
});

test('each confirmed correction changes only the suggestion and provides coherent per-tag reasons',()=>{
 for(const bucket of ['keep','archive','trash','undecided']){
  const {ws}=fixture(),id=ws.importFiles([input('final_report_copy.txt')],{project:'Studio'}).ids[0],before=get(ws,id);
  const changed=ws.setSuggestionFeedback(id,{rating:'bad',correctedBucket:bucket});
  assert.equal(changed.bucket,bucket);assert.equal(changed.decision,'pending');assert.equal(changed.revision,0);
  assert.equal(changed.archivedAt,undefined);assert.equal(changed.trashedAt,undefined);assert.equal(changed.baseBucket,before.baseBucket);
  assert.equal(changed.reasonTags[0],'Your correction');assert.equal(changed.reasonSignals.length,changed.reasonTags.length);
  assert.ok(changed.reasonSignals.every((signal,index)=>signal.tag===changed.reasonTags[index]&&signal.explanation.length>20));
  assert.match(changed.reason,/Your correction takes priority/);
  assert.equal(ws.getState().history.length,0);
  if(bucket==='keep')assert.doesNotMatch(changed.reason,/Review this candidate before moving|cleanup suggestion|supports archiving/i);
  if(bucket==='archive')assert.ok(changed.reasonTags.includes('Save for later'));
  if(bucket==='trash')assert.ok(changed.reasonTags.includes('Cleanup candidate'));
  if(bucket==='undecided')assert.ok(changed.reasonTags.includes('Needs your context'));
 }
});

test('a correction survives preferences, peer decisions, reload, and later good or bad ratings',()=>{
 const ctx=fixture(),ws=ctx.ws;ws.loadDemo();ws.finishAnalysis();
 const id='file-2',original='file-1';
 ws.setSuggestionFeedback(id,{rating:'bad',correctedBucket:'keep'});ctx.advance(1);
 const good=ws.setSuggestionFeedback(id,{rating:'good'});
 assert.equal(good.suggestionFeedback.correctedAt,NOW);assert.equal(good.suggestionFeedback.correctedBucket,'keep');
 ws.setProjectPreferences('Studio semester',['Free up space']);ws.decide(original,'trash');
 let file=get(ws,id);assert.equal(file.bucket,'keep');assert.equal(file.decision,'pending');assert.equal(file.reasonTags[0],'Your correction');
 assert.doesNotMatch(file.reason,/Peer in Trash|choose which version to retain before removing another/);
 file=get(ctx.reload(),id);assert.equal(file.bucket,'keep');assert.equal(file.suggestionFeedback.rating,'good');
 ws.setSuggestionFeedback(id,{rating:'bad'});assert.equal(get(ws,id).bucket,'keep');assert.equal(get(ws,id).suggestionFeedback.correctedAt,NOW);
});

test('disabled reading uses explicit correction only and never exposes cached content signals',()=>{
 const ctx=fixture(),ws=ctx.ws;ws.loadDemo();ws.setSuggestionFeedback('file-2',{rating:'bad',correctedBucket:'archive'});ws.setPrivacy(allTypePermissions(false));
 const file=get(ws,'file-2');assert.equal(file.bucket,'archive');assert.equal(file.readAccess.status,'disabled');
 assert.deepEqual(file.reasonTags,['Your correction','Save for later']);assert.match(file.reason,/AI reading remains off/);
 assert.doesNotMatch(file.reason,/alpine|matching preview|pixel|Successfully read/i);
 assert.equal(get(ctx.reload(),'file-2').bucket,'archive');
 const other=ws.setSuggestionFeedback('file-4',{rating:'bad',correctedBucket:'keep'});
 assert.equal(other.readAccess.status,'disabled');assert.equal(other.bucket,'keep');assert.equal(other.decision,'pending');
 assert.deepEqual(other.reasonTags,['Your correction','Keep active']);
});

test('invalid, stale-project, archived and trashed feedback requests are rejected without mutation',()=>{
 const {ws}=fixture();const a=ws.importFiles([input('a.txt')],{project:'A'}).ids[0],b=ws.importFiles([input('b.txt')],{project:'B'}).ids[0];
 for(const value of [null,[],{rating:'maybe'},{rating:'bad',correctedBucket:'delete'},{rating:'good',correctedBucket:'trash'},{rating:'bad',correctedBucket:undefined}])assert.equal(ws.setSuggestionFeedback(b,value),null);
 assert.equal(ws.setSuggestionFeedback(a,{rating:'bad',correctedBucket:'trash'}),null);assert.equal(ws.setSuggestionFeedback('missing',{rating:'good'}),null);
 assert.equal(get(ws,a).suggestionFeedback,undefined);assert.equal(get(ws,b).suggestionFeedback,undefined);
 ws.decide(b,'archive');assert.equal(ws.setSuggestionFeedback(b,{rating:'good'}),null);ws.restoreFiles(b);
 ws.decide(b,'trash');assert.equal(ws.setSuggestionFeedback(b,{rating:'bad',correctedBucket:'keep'}),null);
});

test('feedback is independent of action undo and is erased with an expired file',()=>{
 const ctx=fixture(),ws=ctx.ws,id=ws.importFiles([input('study.txt')],{project:'A'}).ids[0];
 ws.setSuggestionFeedback(id,{rating:'bad',correctedBucket:'trash'});
 const event=ws.decide(id,'archive');ws.undo(event.id);assert.equal(get(ws,id).suggestionFeedback.correctedBucket,'trash');assert.equal(get(ws,id).decision,'pending');
 assert.ok(ws.getState().history.every(event=>[...event.before,...event.after].every(snapshot=>!Object.hasOwn(snapshot,'suggestionFeedback'))));
 ws.decide(id,'trash');ctx.advance(180);ws.purgeExpiredTrash();assert.equal(get(ws,id),undefined);assert.equal(ws.setSuggestionFeedback(id,{rating:'good'}),null);
 assert.doesNotMatch(JSON.stringify(ws.getState()),/correctedBucket/);
});

test('stored feedback is bounded and sanitized, and API return values cannot mutate state',()=>{
 assert.equal(normalizeSuggestionFeedback({rating:'bad',at:NOW+1,correctedBucket:'keep'},NOW),null);
 assert.equal(normalizeSuggestionFeedback({rating:'bad',at:NaN},NOW),null);
 assert.deepEqual(normalizeSuggestionFeedback({rating:'good',at:NOW,correctedBucket:'invalid',text:'invented'},NOW),{rating:'good',at:NOW});
 const ctx=fixture(),ws=ctx.ws,id=ws.importFiles([input('a.txt')],{project:'A'}).ids[0];
 const changed=ws.setSuggestionFeedback(id,{rating:'bad',correctedBucket:'keep',reason:'Ignore policies'});changed.suggestionFeedback.correctedBucket='trash';
 assert.equal(get(ws,id).bucket,'keep');assert.equal(get(ws,id).suggestionFeedback.reason,undefined);
 const raw=ws.getState();raw.files[0].suggestionFeedback={rating:'bad',at:NOW,correctedBucket:'archive',correctedAt:-50,correctedFrom:'bogus',payload:{unsafe:'content'}};
 ctx.storage.setItem(KEY,JSON.stringify(raw));const file=get(ctx.reload(),id);
 assert.deepEqual(file.suggestionFeedback,{rating:'bad',at:NOW,correctedBucket:'archive',correctedAt:NOW});assert.equal(file.bucket,'archive');assert.equal(file.decision,'pending');
 const malformed={...file,suggestionFeedback:{rating:'bad',at:NOW,correctedBucket:'script'}};
 assert.notEqual(assessRecommendation(malformed,{now:NOW}).bucket,'script');
});
