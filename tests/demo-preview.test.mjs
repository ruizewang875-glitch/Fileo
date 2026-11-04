import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {FILES,TYPES,typeForExtension} from '../dist/data.js';
import {demoPreview} from '../dist/demo-preview.js';

test('every shipped demo file and carousel representative resolves to a real content asset',()=>{
 for(const f of [...FILES,...TYPES]){
  const p=demoPreview(f);assert.ok(p?.detail&&p.alt,f.file);
  assert.ok(existsSync(new URL('../dist/'+p.src,import.meta.url)),f.file+' → '+p.src);
 }
});
test('the model study has distinct views but the copied artwork has the same rendered preview',()=>{
 const find=name=>demoPreview(FILES.find(f=>f.file===name));
 assert.equal(find('off_grid_poster_copy.ai').key,find('off_grid_poster.ai').key);
 const models=FILES.filter(f=>f.type==='3dm').map(demoPreview);
 assert.equal(new Set(models.map(m=>m.family)).size,1);
 assert.equal(new Set(models.map(m=>m.key)).size,3);
 assert.equal(demoPreview({source:'local',file:'off_grid_poster.ai'}),null);
});
test('old and new common file extensions share the correct browse group',()=>{
 for(const [ext,id] of [['DOC','doc'],['.docx','doc'],['ppt','ppt'],['.PPTX','ppt'],['XLS','xls'],['.xlsx','xls'],['.txt','txt'],['.TXL','txl'],['.PDF','pdf'],['.png','png'],['JPEG','jpg'],['.jpg','jpg']])assert.equal(typeForExtension(ext)?.id,id,ext);
});
