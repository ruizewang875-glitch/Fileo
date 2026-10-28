import test from 'node:test';
import assert from 'node:assert/strict';
import {originalDisposition,registerOriginal,originalAvailability,ORIGINAL_LIMITS} from '../dist/original-files.js';

test('HTML and SVG cannot be opened as same-origin active documents',()=>{
 for(const name of ['drawing.svg','drawing.SVGZ','index.html','page.xhtml'])assert.equal(originalDisposition({name,type:'text/plain'}).kind,'download');
 assert.equal(originalDisposition({name:'portrait.png',type:'text/html'}).kind,'download');
 assert.equal(originalDisposition({name:'notes.txt',type:'image/svg+xml'}).kind,'download');
});
test('browser-readable formats use explicit safe MIME; native formats download',()=>{
 assert.deepEqual(originalDisposition({name:'notes.md',type:'text/htmlx'}),{kind:'view',mime:'text/plain;charset=utf-8'});
 assert.deepEqual(originalDisposition({name:'portrait.PNG',type:''}),{kind:'view',mime:'image/png'});
 assert.deepEqual(originalDisposition({name:'review.pdf'}),{kind:'view',mime:'application/pdf'});
 assert.equal(originalDisposition({name:'model.3dm',type:'image/png'}).kind,'download');
 assert.equal(originalDisposition({name:'poster.psd'}).kind,'download');
});
test('storage failure retains original in session and mismatched record cannot open',async()=>{
 const file=new File(['hello'],'notes.txt',{type:'text/plain',lastModified:1234});
 const result=await registerOriginal('notes-test',file);
 assert.equal(result.persisted,false);
 assert.deepEqual(await originalAvailability('notes-test',{file:'notes.txt',bytes:5,lastModified:1234}),{available:true,persisted:false});
 assert.equal((await originalAvailability('notes-test',{file:'other.txt'})).available,false);
 assert.equal((await originalAvailability('notes-test',{bytes:10})).available,false);
});
test('large original has explicit session-only status',async()=>{
 const file=new Blob([new Uint8Array(ORIGINAL_LIMITS.persistentBytes+1)]);
 assert.deepEqual(await registerOriginal('large-test',file),{persisted:false,reason:'session-only-large-file'});
 assert.equal((await originalAvailability('large-test')).available,true);
});
