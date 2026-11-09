import {readDocumentPreview} from './document-previews.js';
// Local raster previews: a small catalog thumbnail plus a larger IndexedDB image.
// This module retains only rendered previews. Source files above 100 MiB or
// decoded images above 60 MP receive an explicit fallback instead of exhausting memory.
export const PREVIEW_LIMITS=Object.freeze({sourceBytes:100*1024*1024,pixels:60000000,thumbnailEdge:360,previewEdge:1600,thumbnailChars:150000});
const MIME_BY_EXT={jpg:'image/jpeg',jpeg:'image/jpeg',jpe:'image/jpeg',png:'image/png',webp:'image/webp',gif:'image/gif',avif:'image/avif',bmp:'image/bmp',svg:'image/svg+xml',tif:'image/tiff',tiff:'image/tiff',heic:'image/heic',heif:'image/heif'};
const RASTER_MIMES=new Set(['image/jpeg','image/png','image/webp','image/gif','image/avif','image/bmp','image/x-ms-bmp']);
const SUPPORTED_MIMES=new Set([...RASTER_MIMES,'image/svg+xml']);
const memory=new Map(),urls=new Map(),pendingReads=new Map(),deletedKeys=new Set(),deletedIds=new Set();
let dbPromise=null;

export function imageKind(file={}){
 const extension=String(file.name||file.file||'').split('.').pop().toLowerCase();
 const supplied=String(file.type||'').toLowerCase().split(';')[0].trim();
 const mime=MIME_BY_EXT[extension]||(supplied.startsWith('image/')?supplied:'');
 return {isImage:!!mime,mime,extension,supported:SUPPORTED_MIMES.has(mime)};
}
export function fitDimensions(width,height,maxEdge){
 width=Number(width);height=Number(height);maxEdge=Number(maxEdge);
 if(!Number.isFinite(width)||!Number.isFinite(height)||!Number.isFinite(maxEdge)||width<=0||height<=0||maxEdge<=0)return null;
 const ratio=Math.min(1,maxEdge/Math.max(width,height));
 return {width:Math.max(1,Math.round(width*ratio)),height:Math.max(1,Math.round(height*ratio))};
}
export async function previewKeyFor(file){
 const source=JSON.stringify([String(file.webkitRelativePath||file.relativePath||file.name||''),Number(file.size)||0,Number(file.lastModified)||0]);
 try{
  if(globalThis.crypto?.subtle){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(source));return 'preview-'+[...new Uint8Array(bytes)].map(b=>b.toString(16).padStart(2,'0')).join('');}
 }catch{/* A deterministic fallback also works on non-secure local previews. */}
 let first=2166136261,second=5381;for(let i=0;i<source.length;i++){first=Math.imul(first^source.charCodeAt(i),16777619);second=Math.imul(second,33)^source.charCodeAt(i);}
 return 'preview-'+(first>>>0).toString(16).padStart(8,'0')+(second>>>0).toString(16).padStart(8,'0');
}
function openDB(){
 if(dbPromise)return dbPromise;
 dbPromise=new Promise(resolve=>{
  let finished=false,request;
  const done=db=>{if(finished){db?.close();return;}finished=true;clearTimeout(timer);resolve(db);};
  const timer=setTimeout(()=>done(null),2500);
  try{
   if(!globalThis.indexedDB)return done(null);
   request=indexedDB.open('fileo-previews-v1',1);
   request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains('previews'))request.result.createObjectStore('previews');};
   request.onsuccess=()=>{const db=request.result;db.onversionchange=()=>{db.close();dbPromise=null;};done(db);};
   request.onerror=()=>done(null);request.onblocked=()=>done(null);
  }catch{done(null);}
 });
 return dbPromise;
}
async function saveBlob(key,blob){
 deletedKeys.delete(key);memory.set(key,blob);
 const db=await openDB();if(!db)return false;
 return new Promise(resolve=>{
  let settled=false;const finish=value=>{if(settled)return;settled=true;clearTimeout(timer);resolve(value);};
  const timer=setTimeout(()=>finish(false),2500);
  try{const tx=db.transaction('previews','readwrite');tx.objectStore('previews').put(blob,key);tx.oncomplete=()=>finish(true);tx.onerror=()=>finish(false);tx.onabort=()=>finish(false);}catch{finish(false);}
 });
}
async function readBlob(key){
 if(deletedKeys.has(key))return null;
 if(memory.has(key))return memory.get(key);
 const db=await openDB();if(!db||deletedKeys.has(key))return null;
 return new Promise(resolve=>{
  let settled=false;const finish=value=>{if(settled)return;settled=true;clearTimeout(timer);resolve(value);};
  const timer=setTimeout(()=>finish(null),2500);
  try{const request=db.transaction('previews','readonly').objectStore('previews').get(key);request.onsuccess=()=>{const blob=request.result;if(deletedKeys.has(key)){finish(null);return;}if(blob instanceof Blob&&/^image\/(webp|jpeg|png)$/.test(blob.type)){memory.set(key,blob);finish(blob);}else finish(null);};request.onerror=()=>finish(null);}catch{finish(null);}
 });
}
async function bitmap(file){
 if(typeof globalThis.createImageBitmap!=='function')return null;
 return new Promise(resolve=>{
  let settled=false;const timer=setTimeout(()=>{settled=true;resolve(null);},12000);
  Promise.resolve().then(()=>createImageBitmap(file)).then(value=>{if(settled){value.close?.();return;}settled=true;clearTimeout(timer);resolve({source:value,width:value.width,height:value.height,dispose:()=>value.close?.()});},()=>{if(settled)return;settled=true;clearTimeout(timer);resolve(null);});
 });
}
function imageElement(file){
 return new Promise((resolve,reject)=>{
  let image,url,timer,settled=false;
  const cleanup=()=>{clearTimeout(timer);if(url)URL.revokeObjectURL(url);};
  const fail=()=>{if(settled)return;settled=true;cleanup();if(image)image.src='';reject(new Error('decode'));};
  try{
   image=new Image();url=URL.createObjectURL(file);
   image.onload=()=>{if(settled)return;settled=true;clearTimeout(timer);const width=image.naturalWidth,height=image.naturalHeight;if(!width||!height){cleanup();reject(new Error('decode'));return;}resolve({source:image,width,height,dispose:()=>{cleanup();image.src='';}});};
   image.onerror=fail;timer=setTimeout(fail,12000);image.src=url;
  }catch{fail();}
 });
}
async function decode(file,mime){
 // SVG is decoded as an image and rasterized; its markup is never inserted into DOM.
 const typed=file.type||!file.slice?file:file.slice(0,file.size,mime);
 return (mime!=='image/svg+xml'&&await bitmap(typed))||await imageElement(typed);
}
function makeCanvas(decoded,edge){
 const size=fitDimensions(decoded.width,decoded.height,edge);if(!size)throw new Error('dimensions');
 const canvas=document.createElement('canvas');canvas.width=size.width;canvas.height=size.height;
 const context=canvas.getContext('2d');if(!context)throw new Error('canvas');
 context.drawImage(decoded.source,0,0,size.width,size.height);return canvas;
}
function thumbnail(decoded){
 let edge=PREVIEW_LIMITS.thumbnailEdge;
 for(let attempt=0;attempt<5;attempt++){
  const canvas=makeCanvas(decoded,edge);const value=canvas.toDataURL('image/webp',.77);
  canvas.width=canvas.height=1;
  if(/^data:image\/(?:webp|png|jpeg);base64,/.test(value)&&value.length<=PREVIEW_LIMITS.thumbnailChars)return value;
  edge=Math.round(edge*.7);
 }
 throw new Error('thumbnail');
}
function encodeBlob(canvas){
 return new Promise((resolve,reject)=>{
  let settled=false;const timer=setTimeout(()=>{settled=true;reject(new Error('encode'));},8000);
  try{canvas.toBlob(blob=>{if(settled)return;settled=true;clearTimeout(timer);if(blob&&/^image\/(webp|jpeg|png)$/.test(blob.type))resolve(blob);else reject(new Error('encode'));},'image/webp',.86);}catch(error){clearTimeout(timer);settled=true;reject(error);}
 });
}
export async function preparePreview(file){
 const kind=imageKind(file);
 let documentArt=null;
 if(!kind.isImage){documentArt=await readDocumentPreview(file);if(!documentArt)return {previewStatus:'not-image'};}
 const previewKey=await previewKeyFor(file);
 const failure=(previewStatus,previewError)=>({previewKey,previewStatus,previewError});
 if(!documentArt&&!kind.supported)return failure('unsupported',`${kind.extension.toUpperCase()||'This image format'} needs a JPEG or PNG export for preview.`);
 if(!documentArt&&Number(file.size)>PREVIEW_LIMITS.sourceBytes)return failure('unsupported','Image exceeds 100 MB. Choose a smaller export for preview.');
 let decoded,canvas;
 try{
  decoded=await decode(documentArt?.blob||file,documentArt?.mime||kind.mime);
  if(decoded.width*decoded.height>PREVIEW_LIMITS.pixels)return failure('unsupported','Image exceeds 60 megapixels. Choose a smaller export for preview.');
  const previewData=thumbnail(decoded),result={previewData,previewKey,previewStatus:'ready',width:decoded.width,height:decoded.height};
  try{
   canvas=makeCanvas(decoded,PREVIEW_LIMITS.previewEdge);const blob=await encodeBlob(canvas);
   result.previewVolatile=!(await saveBlob(previewKey,blob));
   if(urls.has(previewKey)){URL.revokeObjectURL(urls.get(previewKey));urls.delete(previewKey);}
  }catch{result.previewVolatile=true;}
  return result;
 }catch{return documentArt?{previewStatus:'not-image'}:failure('unreadable','Could not decode this image. Try selecting it again or export a JPEG / PNG.');}
 finally{decoded?.dispose();if(canvas)canvas.width=canvas.height=1;}
}
export async function getPreviewUrl(record={}){
 if(deletedIds.has(record.id))return null;
 const key=record.previewKey;if(deletedKeys.has(key))return null;if(!key)return record.previewData||null;
 if(urls.has(key))return urls.get(key);
 if(!pendingReads.has(key))pendingReads.set(key,(async()=>{
  const blob=await readBlob(key);
  if(!blob||deletedKeys.has(key)||typeof URL.createObjectURL!=='function')return null;
  const value=URL.createObjectURL(blob);urls.set(key,value);return value;
 })().finally(()=>pendingReads.delete(key)));
 const value=await pendingReads.get(key);return deletedIds.has(record.id)||deletedKeys.has(key)?null:value||record.previewData||null;
}
// Preview keys can be shared by multiple catalog records. Preserve keys still
// referenced by the remaining workspace while invalidating the expired IDs.
export async function deleteStoredPreviews(records=[],{retainKeys=[]}={}){
 const entries=Array.isArray(records)?records:[],retained=new Set(retainKeys);
 const keys=[...new Set(entries.map(file=>file?.previewKey).filter(key=>typeof key==='string'&&key.length>0&&key.length<=500&&!retained.has(key)))];
 for(const file of entries)if(typeof file?.id==='string')deletedIds.add(file.id);
 for(const key of keys){deletedKeys.add(key);memory.delete(key);pendingReads.delete(key);const url=urls.get(key);if(url)URL.revokeObjectURL(url);urls.delete(key);}
 if(!keys.length)return {ok:true,deleted:0,failedKeys:[]};
 const db=await openDB();
 if(!db){if(globalThis.indexedDB)dbPromise=null;return {ok:!globalThis.indexedDB,deleted:keys.length,failedKeys:globalThis.indexedDB?keys:[]};}
 const ok=await new Promise(resolve=>{
  let finished=false,tx;const done=value=>{if(finished)return;finished=true;clearTimeout(timer);resolve(value);};
  const timer=setTimeout(()=>{try{tx?.abort();}catch{}done(false);},3000);
  try{tx=db.transaction('previews','readwrite');const store=tx.objectStore('previews');for(const key of keys)store.delete(key);tx.oncomplete=()=>done(true);tx.onerror=tx.onabort=()=>done(false);}catch{done(false);}
 });
 return {ok,deleted:keys.length,failedKeys:ok?[]:keys};
}
export function revokePreviewUrls(){for(const value of urls.values())URL.revokeObjectURL(value);urls.clear();}
if(typeof globalThis.addEventListener==='function')globalThis.addEventListener('pagehide',revokePreviewUrls);
