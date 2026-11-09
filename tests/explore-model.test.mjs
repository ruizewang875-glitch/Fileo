import test from 'node:test';
import assert from 'node:assert/strict';
import {similarFiles,comparisonFinding,timelineGroups} from '../dist/explore-model.js';
import {FILES} from '../dist/data.js';

const demo=FILES.map(file=>({...file,collection:file.project,project:'Studio semester',source:'demo',decision:'pending'}));
const file=name=>demo.find(item=>item.file===name);

test('automatic comparison keeps the current file first and includes related formats beyond three',()=>{
 const current=file('nora_lounge_v04.3dm'),original=[...demo];
 const related=similarFiles(current,demo);
 assert.equal(related[0].id,current.id);
 assert.equal(related.length,9);
 assert.ok(related.slice(0,3).every(item=>item.type==='3dm'));
 assert.ok(related.some(item=>item.ext==='.pdf'));
 assert.ok(related.some(item=>item.ext==='.png'));
 assert.ok(related.some(item=>item.ext==='.pptx'));
 assert.ok(related.every(item=>item.collection==='Nora furniture'));
 assert.deepEqual(demo,original);
});

test('exact previews rank before variants and same-collection metadata',()=>{
 const related=similarFiles(file('soft_collision_backup.blend'),demo);
 assert.equal(related[0].file,'soft_collision_backup.blend');
 assert.equal(related[1].file,'soft_collision.blend');
 assert.ok(related.findIndex(item=>item.file==='soft_collision.blend')<related.findIndex(item=>item.file==='glass_loop_early.blend'));
 assert.equal(related.length,6);
});

test('similarity excludes closed files, other projects and unrelated files',()=>{
 const current=file('nora_lounge_v04.3dm');
 const peers=[current,{...file('nora_frame_test.3dm'),decision:'archive'},{...file('nora_lounge_final.3dm'),decision:'trash'},{...file('nora_exploded_view.png'),project:'Other'},file('unwind_components.fig')];
 assert.deepEqual(similarFiles(current,peers),[current]);
 assert.deepEqual(similarFiles({...current,decision:'archive'},[{...current,decision:'archive'}]),[]);
 assert.deepEqual(similarFiles(current,[]),[]);
});

test('local versions compare by filenames without pretending preview data was read',()=>{
 const current={id:'a',file:'client_brand_v01.fig',project:'Client',source:'local'};
 const copy={id:'b',file:'client_brand_copy.fig',project:'Client',source:'local'};
 const unrelated={id:'c',file:'client_notes.docx',project:'Client',source:'local'};
 assert.deepEqual(similarFiles(current,[current,copy,unrelated]),[current,copy]);
 const finding=comparisonFinding([current,copy]);
 assert.match(finding,/contents have not been compared/);
 assert.doesNotMatch(finding,/matches the preview/);
});

test('AI reading off prevents preview-based matching and content claims',()=>{
 const a={...file('alpine_afterglow.psd'),collection:'',file:'a.psd',readAccess:{status:'disabled'}};
 const b={...file('alpine_afterglow_copy.psd'),collection:'',file:'b.psd'};
 assert.deepEqual(similarFiles(a,[a,b]),[a]);
 assert.doesNotMatch(comparisonFinding([a,b]),/matches the preview|share a preview/);
});

test('comparison finding distinguishes matching copy previews from visible variants',()=>{
 const finding=comparisonFinding(similarFiles(file('alpine_afterglow_copy.psd'),demo));
 assert.match(finding,/alpine_afterglow_copy.psd/);
 assert.match(finding,/check editable source contents before removing the copy/);
 assert.match(finding,/cool dawn grade/);
 assert.match(finding,/sources and exports can serve different roles/);
});

test('user-corrected Keep copies are not suggested for removal in the summary',()=>{
 const main=file('alpine_afterglow.psd'),copy={...file('alpine_afterglow_copy.psd'),bucket:'keep',suggestionFeedback:{rating:'bad',correctedBucket:'keep'}};
 const finding=comparisonFinding([main,copy]);
 assert.match(finding,/share a preview/);
 assert.doesNotMatch(finding,/removing the copy/);
});

test('cross-format reused art is not classified as a redundant copy',()=>{
 const finding=comparisonFinding([file('soft_collision.blend'),file('material_study_copy.jpg')]);
 assert.match(finding,/different roles/);
 assert.doesNotMatch(finding,/removing the copy|share a preview/);
});

test('visible-page findings stay concise and describe three Nora variants without forcing Undecided',()=>{
 const finding=comparisonFinding(similarFiles(file('nora_lounge_v04.3dm'),demo).slice(0,3));
 assert.match(finding,/burgundy lounge/);
 assert.match(finding,/sage lounge/);
 assert.match(finding,/tubular frame study/);
 assert.match(finding,/Review the Undecided/);
 assert.ok(finding.split(/\s+/).length<=70);
 assert.ok(comparisonFinding(similarFiles(file('alpine_afterglow_copy.psd'),demo)).split(/\s+/).length<=70);
});

test('timeline is chronological, keeps every date and excludes archived or deleted files',()=>{
 const input=[{id:'late',project:'A',modified:'2026-11-03',file:'late'}, {id:'early',project:'A',modified:'2026-04-01',file:'early'}, {id:'same',project:'A',modified:'2026-11-03',file:'same'}, {id:'archive',project:'A',modified:'2026-06-01',decision:'archive'}, {id:'trash',project:'A',modified:'2026-06-02',decision:'trash'}, {id:'other',project:'B',modified:'2026-01-01'}, {id:'unknown',project:'A',modified:'invalid'}];
 const groups=timelineGroups(input,{project:'A'});
 assert.deepEqual(groups.map(group=>group.date),['2026-04-01','2026-11-03','Unknown date']);
 assert.deepEqual(groups[1].files.map(item=>item.id),['late','same']);
 assert.equal(groups.flatMap(group=>group.files).length,4);
 assert.equal(input[0].id,'late');
});

test('timeline falls back to valid imported timestamps and deduplicates IDs',()=>{
 const imported={id:'local',project:'A',modified:'',lastModified:Date.UTC(2026,9,21),file:'new'};
 const groups=timelineGroups([imported,imported,{id:'bad',modified:'2026-02-30'},{id:'bad-month',modified:'2026-99-99'}]);
 assert.deepEqual(groups.map(group=>group.date),['2026-10-21','Unknown date']);
 assert.equal(groups[0].files.length,1);
});
