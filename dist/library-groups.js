import {TYPES} from './data.js';

export function renderLibraryGroups({container,files,mode,thumb,escapeHtml:esc,hrefFor}) {
 const groups=new Map();
 for(const file of files){const key=mode==='project'?file.project:file.type;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(file);}
 container.innerHTML=[...groups].map(([key,items])=>{
  const type=mode==='type'?TYPES.find(t=>t.id===key):null;
  const cover=items.find(f=>f.previewData||f.image)||items[0];
  const title=mode==='project'?key:type?.app||key.toUpperCase();
  const mark=type&&type.kind!=='indesign'?`<img src="assets/${esc(type.kind)}.svg" alt="">`:type?.kind==='indesign'?'<span class="group-id-mark">Id</span>':null;
  const visual=mode==='type'&&mark?mark:thumb(cover);
  return `<a class="library-group-card" data-group-value="${esc(key)}" href="${esc(hrefFor(key))}"><span class="library-group-visual ${mode==='type'&&mark?'software-visual':''}" aria-hidden="true">${visual}</span><span class="library-group-copy"><strong>${esc(title)}</strong><span>${mode==='type'?'.'+esc(key)+' · ':''}${items.length} ${items.length===1?'file':'files'}</span></span><span class="library-group-arrow" aria-hidden="true">↗</span></a>`;
 }).join('');
}
