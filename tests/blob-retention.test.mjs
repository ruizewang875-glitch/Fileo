import test from 'node:test';
import assert from 'node:assert/strict';

function fakeIndexedDB(seed={}){
 const databases=new Map(Object.entries(seed).map(([name,entries])=>[name,new Map(Object.entries(entries))]));
 const pending=[];let delayReads=false;
 const api={open(name){
  const request={};if(!databases.has(name))databases.set(name,new Map());const data=databases.get(name);
  const db={close(){},objectStoreNames:{contains:()=>true},transaction(_store,mode){
   const tx={abort(){tx.onabort?.();},objectStore(){return {
    get(key){const req={},value=data.get(key),finish=()=>{req.result=value;req.onsuccess?.();};if(delayReads)pending.push(finish);else queueMicrotask(finish);return req;},
    put(value,key){data.set(key,value);},delete(key){data.delete(key);}
   };}};
   if(mode==='readwrite')setImmediate(()=>tx.oncomplete?.());return tx;
  }};
  setImmediate(()=>{request.result=db;request.onsuccess?.();});return request;
 }};
 return {api,databases,pending,set delayReads(value){delayReads=value;},flush(){pending.splice(0).forEach(fn=>fn());}};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function mockGlobal(t,name,value){const previous=Object.getOwnPropertyDescriptor(globalThis,name);Object.defineProperty(globalThis,name,{value,writable:true,configurable:true});t.after(()=>{if(previous)Object.defineProperty(globalThis,name,previous);else delete globalThis[name];});}

test('expired previews revoke only their URLs and preserve keys referenced by other records',async t=>{
 const blob=new Blob(['preview'],{type:'image/webp'}),db=fakeIndexedDB({'fileo-previews-v1':{expired:blob,shared:blob,untouched:blob}});
 mockGlobal(t,'indexedDB',db.api);
 const revoked=[];t.mock.method(URL,'revokeObjectURL',url=>revoked.push(url));
 const {getPreviewUrl,deleteStoredPreviews}=await import('../dist/previews.js?retention=keys');
 const expired=await getPreviewUrl({id:'expired-id',previewKey:'expired'}),shared=await getPreviewUrl({id:'active-shared-id',previewKey:'shared'});
 const result=await deleteStoredPreviews([{id:'expired-id',previewKey:'expired'},{id:'removed-shared-id',previewKey:'shared'},{id:'inline-id'}],{retainKeys:['shared']});
 assert.equal(result.ok,true);assert.equal(result.deleted,1);
 assert.deepEqual(revoked,[expired]);assert.ok(!revoked.includes(shared));
 assert.equal(db.databases.get('fileo-previews-v1').has('expired'),false);
 assert.equal(db.databases.get('fileo-previews-v1').has('shared'),true);
 assert.equal(db.databases.get('fileo-previews-v1').has('untouched'),true);
 assert.equal(await getPreviewUrl({id:'expired-id',previewKey:'expired',previewData:'data:image/png;base64,YQ=='}),null);
 assert.equal(await getPreviewUrl({id:'removed-shared-id',previewKey:'shared'}),null);
 assert.equal(await getPreviewUrl({id:'inline-id',previewData:'data:image/png;base64,YQ=='}),null);
 assert.equal(await getPreviewUrl({id:'active-shared-id',previewKey:'shared'}),shared);
});

test('a preview read already in flight cannot resurrect a purged Blob',async t=>{
 const db=fakeIndexedDB({'fileo-previews-v1':{expired:new Blob(['preview'],{type:'image/webp'})}});db.delayReads=true;
 mockGlobal(t,'indexedDB',db.api);
 const {getPreviewUrl,deleteStoredPreviews}=await import('../dist/previews.js?retention=race');
 const pending=getPreviewUrl({id:'late',previewKey:'expired'});await tick();await tick();
 assert.equal(db.pending.length,1);
 await deleteStoredPreviews([{id:'late',previewKey:'expired'}]);db.flush();
 assert.equal(await pending,null);
 assert.equal(await getPreviewUrl({id:'late',previewKey:'expired'}),null);
});

test('expired originals are removed from IndexedDB, session cache and their open Blob URLs',async t=>{
 const file=new File(['original'],'notes.txt',{type:'text/plain',lastModified:123});
 const value={blob:file,name:file.name,lastModified:123},db=fakeIndexedDB({'fileo-originals-v1':{expired:value,keep:value}});
 mockGlobal(t,'indexedDB',db.api);
 const revoked=[];t.mock.method(URL,'revokeObjectURL',url=>revoked.push(url));
 let openedUrl;mockGlobal(t,'window',{open(){return {document:{},closed:false,location:{replace(url){openedUrl=url;}},close(){}};}});
 const {originalAvailability,openOriginal,deleteStoredOriginals}=await import('../dist/original-files.js?retention=originals');
 assert.equal((await originalAvailability('keep')).available,true);
 assert.equal((await openOriginal('expired',{file:'notes.txt'})).ok,true);
 const result=await deleteStoredOriginals(['expired']);
 assert.equal(result.ok,true);assert.deepEqual(revoked,[openedUrl]);
 assert.equal(db.databases.get('fileo-originals-v1').has('expired'),false);
 assert.equal(db.databases.get('fileo-originals-v1').has('keep'),true);
 assert.equal((await originalAvailability('expired')).available,false);
 assert.equal((await originalAvailability('keep')).available,true);
 assert.equal((await openOriginal('expired',{file:'notes.txt'})).ok,false);
});

test('an original read already in flight cannot repopulate the cache after expiry',async t=>{
 const db=fakeIndexedDB({'fileo-originals-v1':{expired:{blob:new Blob(['original']),name:'notes.txt'}}});db.delayReads=true;
 mockGlobal(t,'indexedDB',db.api);
 const {originalAvailability,deleteStoredOriginals}=await import('../dist/original-files.js?retention=lateoriginal');
 const pending=originalAvailability('expired');await tick();await tick();
 assert.equal(db.pending.length,1);await deleteStoredOriginals(['expired']);db.flush();
 assert.equal((await pending).available,false);
 assert.equal((await originalAvailability('expired')).available,false);
});
