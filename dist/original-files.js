// Originals stay in this browser. This module never sends files to a server or
// tries to launch an installed application through an untrusted URL scheme.
export const ORIGINAL_LIMITS=Object.freeze({persistentBytes:50*1024*1024});
const memory=new Map(),persistence=new Map(),objectUrls=new Set();
const RASTER_TYPES={jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',gif:'image/gif',avif:'image/avif',bmp:'image/bmp'};
const TEXT_EXTENSIONS=new Set(['txt','md','csv','json','log','yaml','yml','xml','js','ts','css','py']);
const UNSAFE_EXTENSIONS=new Set(['svg','svgz','html','htm','xhtml','mhtml','mht']);
let databasePromise;
const validId=id=>typeof id==='string'&&id.length>0&&id.length<=500;
const mimeOf=file=>String(file?.type||'').toLowerCase().split(';')[0].trim();

// A known MIME is applied again before opening a Blob URL. HTML and SVG are
// always downloads, including when their extension or supplied MIME disagrees.
export function originalDisposition(file={}){
 const name=String(file.name||file.file||''),extension=name.includes('.')?name.split('.').pop().toLowerCase():'';
 const mime=mimeOf(file);
 if(UNSAFE_EXTENSIONS.has(extension)||/^(?:text\/html|application\/xhtml\+xml|image\/svg\+xml)$/.test(mime))return {kind:'download',mime:'application/octet-stream'};
 if(RASTER_TYPES[extension])return {kind:'view',mime:RASTER_TYPES[extension]};
 if(extension==='pdf')return {kind:'view',mime:'application/pdf'};
 if(TEXT_EXTENSIONS.has(extension))return {kind:'view',mime:'text/plain;charset=utf-8'};
 return {kind:'download',mime:'application/octet-stream'};
}
function openDatabase(){
 if(databasePromise)return databasePromise;
 databasePromise=new Promise(resolve=>{
  let done=false;
  const finish=db=>{if(done){db?.close();return;}done=true;clearTimeout(timer);resolve(db);};
  const timer=setTimeout(()=>finish(null),2500);
  try{
   if(!globalThis.indexedDB)return finish(null);
   const request=indexedDB.open('fileo-originals-v1',1);
   request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains('files'))request.result.createObjectStore('files');};
   request.onsuccess=()=>{const db=request.result;db.onversionchange=()=>{db.close();databasePromise=null;};finish(db);};
   request.onerror=request.onblocked=()=>finish(null);
  }catch{finish(null);}
 });
 return databasePromise;
}
async function save(id,file){
 const db=await openDatabase();if(!db)return false;
 return new Promise(resolve=>{
  let done=false,tx;
  const finish=value=>{if(done)return;done=true;clearTimeout(timer);resolve(value);};
  const timer=setTimeout(()=>{try{tx?.abort();}catch{}finish(false);},3000);
  try{tx=db.transaction('files','readwrite');tx.objectStore('files').put({blob:file,name:file.name||'file',lastModified:file.lastModified||0},id);tx.oncomplete=()=>finish(true);tx.onerror=tx.onabort=()=>finish(false);}catch{finish(false);}
 });
}
async function read(id){
 if(memory.has(id))return memory.get(id);
 const db=await openDatabase();if(!db)return null;
 return new Promise(resolve=>{
  let done=false;
  const finish=value=>{if(done)return;done=true;clearTimeout(timer);resolve(value);};
  const timer=setTimeout(()=>finish(null),3000);
  try{
   const request=db.transaction('files','readonly').objectStore('files').get(id);
   request.onsuccess=()=>{
    const value=request.result;
    if(value?.blob instanceof Blob){memory.set(id,value);persistence.set(id,true);finish(value);}else finish(null);
   };
   request.onerror=()=>finish(null);
  }catch{finish(null);}
 });
}
export async function registerOriginal(id,file){
 if(!validId(id)||!(file instanceof Blob))return {persisted:false,reason:'invalid-file'};
 memory.set(id,{blob:file,name:file.name||'file',lastModified:file.lastModified||0});
 persistence.set(id,false);
 if(file.size>ORIGINAL_LIMITS.persistentBytes)return {persisted:false,reason:'session-only-large-file'};
 const persisted=await save(id,file);persistence.set(id,persisted);
 return {persisted,reason:persisted?'saved-on-this-device':'session-only-storage-unavailable'};
}
function matchesRecord(value,record){
 if(!record)return true;
 if(record.file&&record.file!==value.name)return false;
 if(Number.isFinite(record.bytes)&&record.bytes!==value.blob.size)return false;
 if(record.lastModified>0&&value.lastModified>0&&record.lastModified!==value.lastModified)return false;
 return true;
}
export async function originalAvailability(id,record){
 const value=validId(id)?await read(id):null;
 return {available:!!value&&matchesRecord(value,record),persisted:persistence.get(id)===true};
}
function closeWindow(target){try{target?.close();}catch{}}
function rememberUrl(blob){const url=URL.createObjectURL(blob);objectUrls.add(url);return url;}
function download(url,name){
 const link=document.createElement('a');link.href=url;link.download=String(name||'file').replace(/[\x00-\x1f\x7f/\\]/g,'_');link.rel='noopener';link.hidden=true;document.body.append(link);link.click();link.remove();
 // Give the browser time to read the download before releasing the URL.
 setTimeout(()=>{URL.revokeObjectURL(url);objectUrls.delete(url);},60000);
}
export async function openOriginal(id,record={}){
 // Reserve the tab within the click handler, before any IndexedDB await.
 let target;
 try{target=globalThis.window?.open('about:blank','_blank');if(target){target.opener=null;target.document.title='Opening file…';}}catch{}
 const value=validId(id)?await read(id):null;
 if(!value||!matchesRecord(value,record)){closeWindow(target);return {ok:false,kind:'missing',reason:'Select the original file again to open it.'};}
 const file={name:value.name,type:value.blob.type},disposition=originalDisposition(file);
 try{
  const blob=value.blob.slice(0,value.blob.size,disposition.mime),url=rememberUrl(blob);
  if(disposition.kind==='view'&&target&&!target.closed){target.location.replace(url);return {ok:true,kind:'view',persisted:persistence.get(id)===true};}
  closeWindow(target);download(url,value.name);
  return {ok:true,kind:'download',persisted:persistence.get(id)===true,reason:disposition.kind==='view'?'Browser blocked the tab; downloaded the original instead.':'Open this downloaded file in its design application.'};
 }catch{closeWindow(target);return {ok:false,kind:'missing',reason:'Could not open this file. Select the original again.'};}
}
export function revokeOriginalUrls(){for(const url of objectUrls)URL.revokeObjectURL(url);objectUrls.clear();}
if(typeof globalThis.addEventListener==='function')globalThis.addEventListener('pagehide',revokeOriginalUrls);
