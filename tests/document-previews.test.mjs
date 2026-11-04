import test from 'node:test';
import assert from 'node:assert/strict';
import {deflateRawSync,deflateSync} from 'node:zlib';
import {readDocumentPreview,fileCover} from '../dist/document-previews.js';

function document(name,data){return new File([data],name);}
async function svg(name,data){const p=await readDocumentPreview(document(name,data));assert.equal(p?.mime,'image/svg+xml');return p.blob.text();}
function zip(entries){
 const local=[],directory=[];let offset=0;
 for(const [name,value] of entries){
  const file=Buffer.from(value),compressed=deflateRawSync(file),n=Buffer.from(name),h=Buffer.alloc(30),d=Buffer.alloc(46);
  h.writeUInt32LE(0x04034b50);h.writeUInt16LE(8,8);h.writeUInt32LE(compressed.length,18);h.writeUInt32LE(file.length,22);h.writeUInt16LE(n.length,26);
  d.writeUInt32LE(0x02014b50);d.writeUInt16LE(8,10);d.writeUInt32LE(compressed.length,20);d.writeUInt32LE(file.length,24);d.writeUInt16LE(n.length,28);d.writeUInt32LE(offset,42);
  local.push(h,n,compressed);directory.push(d,n);offset+=h.length+n.length+compressed.length;
 }
 const cd=Buffer.concat(directory),e=Buffer.alloc(22);e.writeUInt32LE(0x06054b50);e.writeUInt16LE(entries.length,8);e.writeUInt16LE(entries.length,10);e.writeUInt32LE(cd.length,12);e.writeUInt32LE(offset,16);return Buffer.concat([...local,cd,e]);
}
test('plain text and TXL produce a bounded excerpt of the real file; markup is escaped',async()=>{
 const art=await svg('notes.txl','<script>real note</script>\nSecond line');assert.match(art,/TEXT EXCERPT/);assert.match(art,/&lt;script&gt;real note/);assert.doesNotMatch(art,/<script>/);
 assert.equal(await readDocumentPreview(document('fake.txt',new Uint8Array([0,1,2,3]))),null);
});
test('Office extracts actual content from deflated documents, slides and worksheets',async()=>{
 const doc=await svg('report.docx',zip([['word/document.xml','<w:document><w:p><w:r><w:t>A &amp; B</w:t></w:r></w:p></w:document>']]));
 assert.match(doc,/A &amp; B/);assert.match(doc,/DOCUMENT EXCERPT/);
 const slide=await svg('deck.pptx',zip([['ppt/slides/slide2.xml','<a:p><a:r><a:t>Original slide title</a:t></a:r></a:p>']]));
 assert.match(slide,/Original slide title/);
 const sheet=await svg('budget.xlsx',zip([['xl/worksheets/sheet1.xml','<row><c t="s"><v>0</v></c><c><v>24</v></c></row>'],['xl/sharedStrings.xml','<sst><si><t>Materials</t></si></sst>']]));
 assert.match(sheet,/Materials\s+·\s+24/);
});
test('embedded Office thumbnail takes priority over excerpts; oversized entry is refused',async()=>{
 const jpeg=Buffer.from([255,216,255,219,0,5,1,2,3,255,217]);
 const art=await readDocumentPreview(document('model.docx',zip([['docProps/thumbnail.jpeg',jpeg]])));assert.equal(art.mime,'image/jpeg');assert.deepEqual(Buffer.from(await art.blob.arrayBuffer()),jpeg);
 const bomb=zip([['word/document.xml','<w:p><w:t>'+('x'.repeat(550000))+'</w:t></w:p>']]);
 assert.equal(await readDocumentPreview(document('huge.docx',bomb)),null);
});
test('PDF excerpts come from page content, avoiding encrypted or unmappable glyphs',async()=>{
 const stream=deflateSync(Buffer.from('BT /F1 12 Tf (Project sketch) Tj ET'));
 const pdf=Buffer.concat([Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Page /Contents 2 0 R >>\nendobj\n2 0 obj\n<< /Filter /FlateDecode >>\nstream\n'),stream,Buffer.from('\nendstream\nendobj\n3 0 obj\n<< /Type /Font /BaseFont /Helvetica >>\nendobj\n%%EOF')]);
 assert.match(await svg('brief.pdf',pdf),/Project sketch/);
 assert.equal(await readDocumentPreview(document('lock.pdf',Buffer.concat([pdf,Buffer.from(' /Encrypt ')]))),null);
});
test('unsupported formats use explicitly labelled metadata covers, not simulated content',async()=>{
 assert.equal(await readDocumentPreview(document('work.3dm','binary')),null);
 const a=fileCover({file:'sample <one>.3dm',bytes:1234567,ext:'.3dm',source:'local'});
 assert.match(a.alt,/File cover/);const svg=decodeURIComponent(a.src.split(',').slice(1).join(','));
 assert.match(svg,/1.2 MB/);assert.match(svg,/sample &lt;one&gt;\.3dm/);assert.match(svg,/FILE COVER/);assert.notEqual(a.src,fileCover({file:'other.3dm'}).src);
});
