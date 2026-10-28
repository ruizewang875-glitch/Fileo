import test from 'node:test';
import assert from 'node:assert/strict';
import {imageKind,fitDimensions,previewKeyFor,preparePreview,getPreviewUrl,PREVIEW_LIMITS} from '../dist/previews.js';

test('common image extensions work when browsers supply no MIME',()=>{
 for(const name of ['photo.JPG','photo.jpeg','screen.png','scene.webp','loop.gif','scene.avif','drawing.bmp','icon.svg']){
  const kind=imageKind({name,type:''});assert.equal(kind.isImage,true,name);assert.equal(kind.supported,true,name);
 }
 assert.equal(imageKind({name:'download',type:'image/jpeg'}).supported,true);
 assert.equal(imageKind({name:'x.jpg',type:'application/octet-stream'}).mime,'image/jpeg');
});
test('native design formats are not falsely treated as raster images',()=>{
 for(const name of ['work.psd','product.3dm','layout.ai','project.blend'])assert.equal(imageKind({name,type:''}).isImage,false,name);
 assert.equal(imageKind({name:'camera.HEIC',type:'image/heic'}).supported,false);
 assert.equal(imageKind({name:'print.tiff',type:'image/tiff'}).isImage,true);
});
test('preview sizing respects aspect ratio and never upscales',()=>{
 assert.deepEqual(fitDimensions(6000,4000,1600),{width:1600,height:1067});
 assert.deepEqual(fitDimensions(4000,6000,360),{width:240,height:360});
 assert.deepEqual(fitDimensions(120,80,360),{width:120,height:80});
 assert.deepEqual(fitDimensions(200000,1,360),{width:360,height:1});
 assert.equal(fitDimensions(0,20,360),null);assert.equal(fitDimensions(NaN,20,360),null);
});
test('preview keys survive reload and distinguish source versions and paths',async()=>{
 const original={name:'photo.jpg',size:5000000,lastModified:12,webkitRelativePath:'Project/photo.jpg'};
 assert.equal(await previewKeyFor(original),await previewKeyFor({...original}));
 assert.notEqual(await previewKeyFor(original),await previewKeyFor({...original,lastModified:13}));
 assert.notEqual(await previewKeyFor(original),await previewKeyFor({...original,webkitRelativePath:'Other/photo.jpg'}));
 assert.ok(!(await previewKeyFor(original)).includes('Project'));
});
test('unsupported formats and oversize images return specific visible fallbacks',async()=>{
 const heic=await preparePreview({name:'portrait.heic',type:'image/heic',size:4000000,lastModified:1});
 assert.equal(heic.previewStatus,'unsupported');assert.match(heic.previewError,/JPEG or PNG/);
 const giant=await preparePreview({name:'print.png',type:'image/png',size:PREVIEW_LIMITS.sourceBytes+1,lastModified:1});
 assert.equal(giant.previewStatus,'unsupported');assert.match(giant.previewError,/100 MB/);
 assert.deepEqual(await preparePreview({name:'model.3dm',type:'',size:1000000}),{previewStatus:'not-image'});
});
test('missing image decoding APIs fail per file instead of rejecting imports',async()=>{
 const broken=await preparePreview({name:'broken.png',type:'image/png',size:4000000,lastModified:3});
 assert.equal(broken.previewStatus,'unreadable');assert.match(broken.previewError,/decode/);
});
test('persistent thumbnail remains available when full preview storage is unavailable',async()=>{
 const thumbnail='data:image/webp;base64,YWJj';
 assert.equal(await getPreviewUrl({previewData:thumbnail}),thumbnail);
 assert.equal(await getPreviewUrl({previewKey:'nonexistent',previewData:thumbnail}),thumbnail);
 assert.equal(await getPreviewUrl({previewKey:'nonexistent'}),null);
});
