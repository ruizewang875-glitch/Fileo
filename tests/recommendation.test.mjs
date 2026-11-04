import test from 'node:test';
import assert from 'node:assert/strict';
import {assessRecommendation} from '../dist/recommendation.js';
import {suggestionBadge,recommendationDetails} from '../dist/recommendation-ui.js';
const file={id:'candidate',source:'demo',project:'Studio',file:'lounge_copy.3dm',ext:'.3dm',type:'3dm',app:'Rhino',bucket:'trash',baseBucket:'trash',size:18,modified:'2026-01-01',previewKey:'lounge',previewFamily:'nora'};
const peer={...file,id:'version',file:'lounge.3dm',bucket:'keep',baseBucket:'keep'};
const when=Date.UTC(2026,10,1);
const review=(f,files=[],tags=[])=>assessRecommendation(f,{files,tags,now:when});
test('matching demo assets identify the actual source format and never prove binary identity',()=>{
 const jpeg={...peer,id:'export',file:'lounge.jpg',ext:'.jpg',type:'jpg'};
 const result=review(file,[jpeg,peer]);assert.match(result.reason,/“lounge\.3dm”/);assert.doesNotMatch(result.reason,/lounge\.jpg/);assert.match(result.reason,/do not establish/);assert.ok(result.tags.includes('Matching preview'));
 assert.equal(review(file,[{...peer,decision:'trash'},jpeg]).bucket,'undecided');
 assert.doesNotMatch(review(file,[{...peer,project:'Other'}]).reason,/preview matches/);
});
test('related authored versions explain visible difference and ignore unrelated projects',()=>{
 const draft={...file,file:'frame_test.3dm',previewKey:'wireframe',previewNote:'Tubular frame study without upholstered seats',baseBucket:'undecided'};
 const result=review(draft,[peer,{...peer,project:'Other',id:'foreign',file:'other.3dm'}],['Preserve drafts']);
 assert.equal(result.bucket,'keep');assert.match(result.reason,/Tubular frame/);assert.match(result.reason,/preview differs/);assert.doesNotMatch(result.reason,/other\.3dm/);
 assert.ok(result.tags.includes('Preference: Preserve drafts'));
});
test('real-file evidence admits filename inference; matching custom topics protect a copy for review',()=>{
 const local={...file,source:'local',previewNote:'DO NOT READ',baseBucket:'trash',lastModified:when};
 const result=review(local,[{...peer,source:'local'}],['犀牛']);assert.equal(result.bucket,'undecided');assert.match(result.reason,/Contents were not compared/);assert.match(result.reason,/rhino/);assert.doesNotMatch(result.reason,/DO NOT READ|This demo preview/);
});
test('custom language-aware topics match metadata and irrelevant tags never affect recommendations',()=>{
 const local={...file,source:'local',file:'student_interview.doc',app:'Word',ext:'.doc',baseBucket:'undecided',lastModified:when};
 assert.equal(review(local,[],['访谈']).bucket,'keep');assert.equal(review(local,[],['Archive interviews']).bucket,'archive');
 assert.deepEqual(review(local,[],['unrelated']),review(local));assert.equal(review(local,[],['delete interviews']).bucket,'undecided');
});
test('preferring space can archive older large uncertain files but size cannot justify Trash',()=>{
 const old={...file,source:'local',file:'study.3dm',baseBucket:'undecided',size:380,lastModified:Date.UTC(2025,2,1)};
 assert.equal(review(old,[],['Free up space']).bucket,'archive');
 assert.equal(review({...old,lastModified:when},[],['Free up space']).bucket,'undecided');
});
test('recommendation markup escapes untrusted filenames, tags and rationale and hides detail by default',()=>{
 const f={...file,id:'x" autofocus="y',file:'a <b>',reasonTags:['<script>x</script>'],reason:'<style>input{}</style>'};
 const button=suggestionBadge(f,{interactive:true});assert.match(button,/aria-expanded="false"/);assert.doesNotMatch(button,/ autofocus="/);assert.match(button,/&lt;b&gt;/);
 const html=recommendationDetails(f);assert.doesNotMatch(html,/<script>|<style>|<details[^>]* open/);assert.match(html,/<summary>[\s\S]*&lt;script&gt;/);assert.match(html,/<\/summary><p>&lt;style&gt;/);
});
