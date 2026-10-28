// Local raster previews: a small catalog thumbnail plus a larger IndexedDB image.
// Original files are neither uploaded nor retained. Source files above 100 MiB or
// decoded images above 60 MP receive an explicit fallback instead of exhausting memory.
export const PREVIEW_LIMITS=Object.freeze({sourceBytes:100*1024*1024,pixels:60000000,thumbnailEdge:360,previewEdge:1600,thumbnailChars:150000});
const MIME_BY_EXT={jpg:'image/jpeg',jpeg:'image/jpeg',jpe:'image/jpeg',png:'image/png',webp:'image/webp',gif:'image/gif',avif:'image/avif',bmp:'image/bmp',svg:'image/svg+xml',tif:'image/tiff',tiff:'image/tiff',heic:'image/heic',heif:'image/heif'};
const RASTER_MIMES=new Set(['image/jpeg','image/png','image/webp','image/gif','image/avif','image/bmp','image/x-ms-bmp']);
const SUPPORTED_MIMES=new Set([...RASTER_MIMES,'image/svg+xml']);
const memory=new Map(),urls=new Map(),pendingReads=new Map();
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
 memory.set(key,blob);
 const db=await openDB();if(!db)return false;
 return new Promise(resolve=>{
  let settled=false;const finish=value=>{if(settled)return;settled=true;clearTimeout(timer);resolve(value);};
  const timer=setTimeout(()=>finish(false),2500);
  try{const tx=db.transaction('previews','readwrite');tx.objectStore('previews').put(blob,key);tx.oncomplete=()=>finish(true);tx.onerror=()=>finish(false);tx.onabort=()=>finish(false);}catch{finish(false);}
 });
}
async function readBlob(key){
 if(memory.has(key))return memory.get(key);
 const db=await openDB();if(!db)return null;
 return new Promise(resolve=>{
  let settled=false;const finish=value=>{if(settled)return;settled=true;clearTimeout(timer);resolve(value);};
  const timer=setTimeout(()=>finish(null),2500);
  try{const request=db.transaction('previews','readonly').objectStore('previews').get(key);request.onsuccess=()=>{const blob=request.result;if(blob instanceof Blob&&/^image\/(webp|jpeg|png)$/.test(blob.type)){memory.set(key,blob);finish(blob);}else finish(null);};request.onerror=()=>finish(null);}catch{finish(null);}
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
 const kind=imageKind(file);if(!kind.isImage)return {previewStatus:'not-image'};
 const previewKey=await previewKeyFor(file);
 const failure=(previewStatus,previewError)=>({previewKey,previewStatus,previewError});
 if(!kind.supported)return failure('unsupported',`${kind.extension.toUpperCase()||'This image format'} needs a JPEG or PNG export for preview.`);
 if(Number(file.size)>PREVIEW_LIMITS.sourceBytes)return failure('unsupported','Image exceeds 100 MB. Choose a smaller export for preview.');
 let decoded,canvas;
 try{
  decoded=await decode(file,kind.mime);
  if(decoded.width*decoded.height>PREVIEW_LIMITS.pixels)return failure('unsupported','Image exceeds 60 megapixels. Choose a smaller export for preview.');
  const previewData=thumbnail(decoded),result={previewData,previewKey,previewStatus:'ready',width:decoded.width,height:decoded.height};
  try{
   canvas=makeCanvas(decoded,PREVIEW_LIMITS.previewEdge);const blob=await encodeBlob(canvas);
   result.previewVolatile=!(await saveBlob(previewKey,blob));
   if(urls.has(previewKey)){URL.revokeObjectURL(urls.get(previewKey));urls.delete(previewKey);}
  }catch{result.previewVolatile=true;}
  return result;
 }catch{return failure('unreadable','Could not decode this image. Try selecting it again or export a JPEG / PNG.');}
 finally{decoded?.dispose();if(canvas)canvas.width=canvas.height=1;}
}
export async function getPreviewUrl(record={}){
 const key=record.previewKey;if(!key)return record.previewData||null;
 if(urls.has(key))return urls.get(key);
 if(!pendingReads.has(key))pendingReads.set(key,(async()=>{
  const blob=await readBlob(key);
  if(!blob||typeof URL.createObjectURL!=='function')return null;
  const value=URL.createObjectURL(blob);urls.set(key,value);return value;
 })().finally(()=>pendingReads.delete(key)));
 return await pendingReads.get(key)||record.previewData||null;
}
export function revokePreviewUrls(){for(const value of urls.values())URL.revokeObjectURL(value);urls.clear();}
if(typeof globalThis.addEventListener==='function')globalThis.addEventListener('pagehide',revokePreviewUrls);
