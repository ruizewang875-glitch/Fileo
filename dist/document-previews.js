// Read only small, useful parts of user-selected files. Embedded art and textual
// excerpts are content previews. Unsupported formats instead get a metadata cover.
const XML_LIMIT=480*1024, IMAGE_LIMIT=1400*1024, PDF_LIMIT=4*1024*1024;
const plain=new TextDecoder(), latin=new TextDecoder('latin1');
const extOf=f=>String(f.name||f.file||'').split('.').pop().toLowerCase();
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const clean=s=>String(s??'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g,' ').trim();
const hash=s=>{let h=5381;for(const c of s)h=(h*33+c.charCodeAt(0))>>>0;return h;};
const palettes=[['#e7e0eb','#5c426a','#ad92b6'],['#e2e9e5','#345e55','#8ea99b'],['#e3e8ef','#405476','#93a8bc'],['#ede4dd','#785849','#bfa292']];
const heading='font-family="system-ui, sans-serif"';
const mono='font-family="monospace"';
const uri=s=>'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(s.toWellFormed?s.toWellFormed():s);
const shorten=(s,max)=>Array.from(s).length>max?Array.from(s).slice(0,max-1).join('')+'…':s;
const sizeLabel=n=>!Number.isFinite(n)||n<0?'':n>=1e9?(n/1e9).toFixed(1)+' GB':n>=1e6?(n/1e6).toFixed(1)+' MB':n>=1e3?Math.round(n/1e3)+' KB':n+' B';
export function fileCover(f={}){
 const name=clean(f.file||f.name||'Untitled'),ext=shorten(clean(f.ext||extOf(f)).replace(/^\./,'').toUpperCase()||'FILE',8);
 const seed=hash(name),[base,ink,accent]=palettes[hash(ext)%palettes.length];
 const size=sizeLabel(Number.isFinite(f.bytes)?f.bytes:f.file?Number(f.size)*1e6:f.size),r=178+seed%83;
 const lines=Array.from({length:9},(_,i)=>`<circle cx="702" cy="162" r="${r+i*16}" fill="none" stroke="${accent}" stroke-width="${i===4?3:1.1}"/>`).join('');
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="570" viewBox="0 0 800 570"><rect width="800" height="570" fill="${base}"/>${lines}<path d="M43 68h28l10 10h28v21H43z" fill="none" stroke="${ink}" stroke-width="2.4"/><text x="45" y="135" ${mono} font-size="18" letter-spacing="3" fill="${ink}">FILE COVER</text><text x="36" y="345" ${heading} font-size="${ext.length>5?105:153}" font-weight="520" letter-spacing="-7" fill="${ink}">${esc(ext)}</text><path d="M45 400H755" stroke="${ink}" stroke-opacity=".34"/><text x="45" y="454" ${heading} font-size="31" fill="${ink}">${esc(shorten(name,35))}</text><text x="46" y="501" ${mono} font-size="18" fill="${ink}">${esc(size||'Local file')}</text></svg>`;
 return {src:uri(svg),alt:'File cover for '+name};
}
function wrap(s,limit=56){
 const rows=[];for(let line of s.split(/\r?\n/)){
  line=clean(line).replace(/\s+/g,' ');if(!line)continue;
  while(line.length>limit){let index=line.lastIndexOf(' ',limit);if(index<limit/2)index=limit;rows.push(line.slice(0,index));line=line.slice(index).trimStart();if(rows.length>=9)return rows;}
  if(line)rows.push(line);if(rows.length>=9)break;
 }return rows;
}
function excerpt(file,text,label){
 if(!clean(text))return null;
 const lines=wrap(text).slice(0,8);if(!lines.length)return null;
 const [base,ink,accent]=palettes[hash(extOf(file))%palettes.length];
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="960" height="690"><rect width="960" height="690" fill="${base}"/><rect x="42" y="34" width="876" height="622" rx="4" fill="#fdfbf8"/><rect x="82" y="74" width="9" height="23" fill="${accent}"/><text x="107" y="92" ${mono} font-size="17" letter-spacing="2" fill="${ink}">${esc(label.toUpperCase())}</text><text x="82" y="156" ${heading} font-size="33" font-weight="600" fill="${ink}">${esc(shorten(file.name,40))}</text><path d="M82 184H879" stroke="${accent}"/>${lines.map((s,i)=>`<text x="82" y="${241+i*45}" ${heading} font-size="22" fill="#413c44">${esc(s)}</text>`).join('')}</svg>`;
 return {blob:new Blob([svg],{type:'image/svg+xml'}),mime:'image/svg+xml'};
}
async function inflate(bytes,format,limit){
 if(typeof DecompressionStream!=='function')return null;
 const reader=new Blob([bytes]).stream().pipeThrough(new DecompressionStream(format)).getReader(),chunks=[];let size=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>limit){await reader.cancel();return null;}chunks.push(value);}}
 finally{reader.releaseLock();}
 const output=new Uint8Array(size);let offset=0;for(const chunk of chunks){output.set(chunk,offset);offset+=chunk.length;}return output;
}
const bytesOf=async(file,start,end)=>new Uint8Array(await file.slice(start,end).arrayBuffer());
const view=b=>new DataView(b.buffer,b.byteOffset,b.byteLength);
async function zipReader(file){
 if(file.size<22)return null;
 const tail=await bytesOf(file,Math.max(0,file.size-65557),file.size),v=view(tail);let p=tail.length-22;
 while(p>=0&&v.getUint32(p,true)!==0x06054b50)p--;
 if(p<0||v.getUint16(p+4,true)||v.getUint16(p+6,true))return null;
 const count=v.getUint16(p+10,true),length=v.getUint32(p+12,true),offset=v.getUint32(p+16,true);
 if(count>4096||length>512*1024||offset+length>file.size)return null;
 const dir=await bytesOf(file,offset,offset+length),d=view(dir),entries=new Map();p=0;
 for(let i=0;i<count;i++){
  if(p+46>dir.length||d.getUint32(p,true)!==0x02014b50)return null;
  const size=d.getUint16(p+28,true),end=p+46+size+d.getUint16(p+30,true)+d.getUint16(p+32,true);if(end>dir.length)return null;
  const name=plain.decode(dir.subarray(p+46,p+46+size));entries.set(name,{flags:d.getUint16(p+8,true),method:d.getUint16(p+10,true),packed:d.getUint32(p+20,true),expanded:d.getUint32(p+24,true),at:d.getUint32(p+42,true)});p=end;
 }
 async function get(name,limit){
  const e=entries.get(name);if(!e||e.flags&1||![0,8].includes(e.method)||e.packed>limit||e.expanded>limit||e.at+30>file.size)return null;
  const header=view(await bytesOf(file,e.at,e.at+30));if(header.getUint32(0,true)!==0x04034b50)return null;
  const start=e.at+30+header.getUint16(26,true)+header.getUint16(28,true);
  if(start+e.packed>file.size)return null;const packed=await bytesOf(file,start,start+e.packed);
  const out=e.method===0?packed:await inflate(packed,'deflate-raw',limit);return out?.length===e.expanded?out:null;
 }
 return {names:[...entries.keys()],get};
}
function entity(text){return text.replace(/&(amp|lt|gt|quot|apos|#x[0-9a-f]+|#\d+);/gi,(s,t)=>{
 if(t[0]!=='#')return {amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"}[t]??s;
 const n=t[1]==='x'?parseInt(t.slice(2),16):Number(t.slice(1));return n>0&&n<=0x10ffff?String.fromCodePoint(n):'';
});}
function nodes(xml,tag){return [...xml.matchAll(new RegExp('<(?:[\\w.-]+:)?'+tag+'(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:[\\w.-]+:)?'+tag+'>','g'))].map(m=>m[1]);}
const strings=xml=>nodes(xml,'t').map(t=>entity(t.replace(/<[^>]+>/g,''))).join('');
function embedded(bytes){
 if(!bytes)return null;
 const mime=bytes[0]===255&&bytes[1]===216&&bytes[2]===255?'image/jpeg':bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71?'image/png':null;
 return mime?{mime,blob:new Blob([bytes],{type:mime})}:null;
}
async function office(file,ext){
 const zip=await zipReader(file);if(!zip)return null;
 const thumbnail=zip.names.find(s=>/^docProps\/thumbnail\.(?:png|jpe?g)$/i.test(s));
 if(thumbnail){const art=embedded(await zip.get(thumbnail,IMAGE_LIMIT));if(art)return art;}
 const main=ext==='docx'?'word/document.xml':ext==='pptx'?zip.names.filter(s=>/^ppt\/slides\/slide\d+\.xml$/.test(s)).sort((a,b)=>parseInt(a.match(/\d+/)[0])-parseInt(b.match(/\d+/)[0]))[0]:zip.names.filter(s=>/^xl\/worksheets\/sheet\d+\.xml$/.test(s)).sort((a,b)=>parseInt(a.match(/\d+/)[0])-parseInt(b.match(/\d+/)[0]))[0];
 const bytes=await zip.get(main,XML_LIMIT);if(!bytes)return null;
 const xml=plain.decode(bytes);if(ext!=='xlsx')return excerpt(file,nodes(xml,'p').slice(0,40).map(strings).join('\n'),ext==='docx'?'Document excerpt':'Slide excerpt');
 const data=await zip.get('xl/sharedStrings.xml',XML_LIMIT),shared=data?nodes(plain.decode(data),'si').map(strings):[];
 const rows=nodes(xml,'row').slice(0,10).map(row=>[...row.matchAll(/<(?:[\w.-]+:)?c\b([^>]*?)(?<!\/)>([\s\S]*?)<\/(?:[\w.-]+:)?c>/g)].slice(0,5).map(m=>{
  const v=nodes(m[2],'v')[0]||'';if(/\bt=['"]s['"]/.test(m[1]))return shared[Number(v)]||'';
  if(/\bt=['"]inlineStr['"]/.test(m[1]))return strings(m[2]);return entity(v);
 }).join('   ·   '));
 return excerpt(file,rows.join('\n'),'Worksheet excerpt');
}
async function pdf(file){
 if(file.size>PDF_LIMIT)return null;
 const bytes=await bytesOf(file,0,file.size),source=latin.decode(bytes);
 if(!source.startsWith('%PDF-')||/\/Encrypt\b/.test(source))return null;
 const objects=new Map();let page=null;
 for(const m of source.matchAll(/(?:^|[\r\n])\s*(\d+)\s+(\d+)\s+obj\b/g)){
  if(objects.size>=6000)return null;const at=m.index+m[0].length,stop=source.indexOf('endobj',at);if(stop<0)break;
  const end=Math.min(stop,at+4096),head=source.slice(at,end).split(/\bstream(?:\r\n|\n|\r)/)[0],o={at,stop,head};objects.set(m[1]+' '+m[2],o);
  if(!page&&/\/Type\s*\/Page\b/.test(head))page=o;
 }
 if(!page)return null;
 function ref(head,key){const m=head.match(new RegExp('/'+key+'\\s*(?:\\[\\s*)?(\\d+)\\s+(\\d+)\\s+R\\b'));return m?objects.get(m[1]+' '+m[2]):null;}
 function stream(o,limit){
  if(!o)return null;const str=source.slice(o.at,Math.min(o.stop,o.at+4096)),m=/\bstream(?:\r\n|\n|\r)/.exec(str);
  if(!m)return null;const start=o.at+m.index+m[0].length;
  let end=source.indexOf('endstream',start);if(end>o.stop||end<=start||end-start>limit)return null;
  // A stream's terminal line break is a delimiter, not compressed payload.
  const declared=o.head.match(/\/Length\s+(\d+)\b(?!\s+\d+\s+R)/),n=declared?Number(declared[1]):0;
  if(n>0&&start+n<=end&&end-(start+n)<=2)end=start+n;
  else if(bytes[end-1]===10){end--;if(bytes[end-1]===13)end--;}else if(bytes[end-1]===13)end--;
  return bytes.subarray(start,end);
 }
 const thumb=ref(page.head,'Thumb');if(thumb&&/\/DCTDecode\b/.test(thumb.head)){const art=embedded(stream(thumb,IMAGE_LIMIT));if(art)return art;}
 // Without a font map, interpreting glyph IDs as text is misleading. Only show
 // common literal-text operators from simple standard-font PDFs.
 if(/\/ToUnicode\b/.test(source)||!/\/BaseFont\s*\/(?:Helvetica|Times-|Courier)/.test(source))return null;
 const o=ref(page.head,'Contents');let body=stream(o,XML_LIMIT);if(!body)return null;
 if(/\/Filter\b/.test(o.head)){if(!/\/Filter\s*(?:\[\s*)?\/FlateDecode\b/.test(o.head))return null;body=await inflate(body,'deflate',XML_LIMIT);if(!body)return null;}
 const chunks=[];for(const t of latin.decode(body).matchAll(/\(((?:\\[\s\S]|[^()\\]){1,1800})\)\s*Tj\b/g)){
  const s=t[1].replace(/\\([0-7]{1,3}|[()\\nrtbf])/g,(_,v)=>/^[0-7]/.test(v)?String.fromCharCode(parseInt(v,8)):({n:'\n',r:'\n',t:' ',b:'',f:''}[v]??v));
  if(/[a-zA-Z\d]/.test(s))chunks.push(s);if(chunks.length>=12)break;
 }return excerpt(file,chunks.join('\n'),'PDF text excerpt');
}
export async function readDocumentPreview(file){
 if(typeof file?.slice!=='function'||!Number.isFinite(file.size)||!file.size)return null;
 const ext=extOf(file);try{
  if(['docx','pptx','xlsx'].includes(ext))return await office(file,ext);
  if(ext==='pdf')return await pdf(file);
  if(['txt','txl','md','csv','log','rtx'].includes(ext)||file.type==='text/plain'){
   const data=await bytesOf(file,0,Math.min(24*1024,file.size)),utf16=data[0]===255&&data[1]===254?'utf-16le':data[0]===254&&data[1]===255?'utf-16be':'';
   const text=(utf16?new TextDecoder(utf16):plain).decode(data);
   if(/[\u0000\u0001\u0002\u0003]/.test(text)||text.split('\ufffd').length>4)return null;return excerpt(file,text,'Text excerpt');
  }
 }catch{/* Unreadable or unsupported native documents retain a metadata cover. */}
 return null;
}
