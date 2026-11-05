// Permission scopes describe the proposed analysis, not a promise that this
// browser prototype can parse every native design format. Demo receipts are
// explicitly simulated; real imports only expose metadata to local rules.
export const PRIVACY_VERSION = '2026-11-05';
const meta = 'Filename, format, size and modified date';
const entry = (id,label,extensions,reads,method)=>Object.freeze({id,label,extensions:Object.freeze(extensions),reads:Object.freeze(reads),method});
export const PRIVACY_TYPES = Object.freeze([
 entry('doc','Word',['.doc','.docx'],['Document text, headings and keywords'], 'A document parser extracts readable text. Compare key phrases and version changes; protected or unreadable content needs review.'),
 entry('ppt','PowerPoint',['.ppt','.pptx'],['Slide text, titles and rendered slide images'], 'Extract slide text and render slides. Compare sequence, layout and visible changes; hidden notes are outside this scope.'),
 entry('pdf','PDF',['.pdf'],['Page text, keywords and rendered pages'], 'Extract selectable text or use OCR on page images, then compare pages. Scans and OCR errors may require review.'),
 entry('txt','Plain text',['.txt'],['Text and keywords'], 'Compare readable text and changed passages. The text is treated as file content, never as instructions to the app.'),
 entry('jsonl','JSON Lines',['.jsonl'],['Field names, record values and structure'], 'Parse records and compare fields and values. Do not execute code or follow instructions in the data.'),
 entry('xls','Excel',['.xls','.xlsx'],['Sheet names, cell values and formulas'], 'A spreadsheet parser compares tables and formulas. Never execute macros or refresh external links.'),
 entry('png','PNG images',['.png'],['Image pixels, dimensions and visible differences'], 'Compare rendered pixels, composition and visible objects. Similar appearance alone does not establish identical source content; embedded location metadata is excluded.'),
 entry('jpg','JPEG images',['.jpg','.jpeg'],['Image pixels, dimensions and visible differences'], 'Compare rendered pixels, composition and visible objects. Compression and edits may cause differences; embedded location metadata is excluded.'),
 entry('psd','Photoshop',['.psd'],['Composite preview and exported layer information'], 'A compatible adapter renders the composite and exposes available layer information. Compare visible edits; a matching preview does not prove layers are identical.'),
 entry('ai','Illustrator',['.ai'],['Rendered artboard, visible text and exported object information'], 'Use a compatible export or adapter. Compare artboards and accessible vector objects; do not assume a preview contains every editable object.'),
 entry('indd','InDesign',['.indd'],['Exported page text, layout and page previews'], 'Use a compatible export or adapter to compare page text and layout. Linked content is read only when separately selected and permitted.'),
 entry('fig','Figma',['.fig'],['Exported frames, visible text and component information'], 'Use a compatible export or adapter to compare frames and components. Do not access a remote Figma account or private comments.'),
 entry('3dm','Rhino',['.3dm'],['Rendered model views and exported geometry information'], 'A model adapter renders views and exposes available geometry. Compare form and structural differences; visual similarity is not proof of identical geometry.'),
 entry('blend','Blender',['.blend'],['Rendered scene views and exported object or material information'], 'Use a scene adapter to compare objects, materials and rendered views. Never run embedded scripts.'),
 entry('prproj','Premiere Pro',['.prproj'],['Exported sequence structure and selected media previews'], 'Compare available sequence structure and supplied frame previews. Linked media needs its own selection and permission; no automatic access to external media.'),
 entry('other','Other file types',[],['Basic file metadata only'], 'Unsupported content is not opened or analyzed. Use basic metadata to suggest manual review; file size or age alone never proves redundancy.')
]);
const byId = new Map(PRIVACY_TYPES.map(t=>[t.id,t]));
const byExt = new Map(PRIVACY_TYPES.flatMap(t=>t.extensions.map(ext=>[ext,t])));
export function allTypePermissions(allowed=false) {
 return Object.fromEntries(PRIVACY_TYPES.map(t=>[t.id,allowed===true]));
}
export function freshPrivacy() {
 return {acceptedVersion:null,acceptedAt:null,types:allTypePermissions(false)};
}
export function normalizePrivacy(raw) {
 const fresh=freshPrivacy();
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||raw.acceptedVersion!==PRIVACY_VERSION||!Number.isFinite(raw.acceptedAt)||raw.acceptedAt<=0||!raw.types||typeof raw.types!=='object'||Array.isArray(raw.types))return fresh;
 return {acceptedVersion:PRIVACY_VERSION,acceptedAt:raw.acceptedAt,types:Object.fromEntries(PRIVACY_TYPES.map(t=>[t.id,Object.hasOwn(raw.types,t.id)&&raw.types[t.id]===true]))};
}
export function privacyTypeFor(file) {
 const f=file||{},name=String(f.file||f.name||''),ext=String(f.ext||name.slice(name.lastIndexOf('.'))).trim().toLowerCase();
 return byExt.get(ext.startsWith('.')?ext:'.'+ext)||byId.get(f.type)||byId.get('other');
}
export function isReadingAllowed(file,privacy) {
 const p=normalizePrivacy(privacy);
 return p.acceptedVersion===PRIVACY_VERSION&&p.types[privacyTypeFor(file).id]===true;
}
export function readAccessFor(file,privacy) {
 const f=file||{},p=normalizePrivacy(privacy),demo=f.source==='demo';
 if(p.acceptedVersion!==PRIVACY_VERSION)return {status:'pending',label:'Awaiting your choice',items:[],demo};
 if(!p.types[privacyTypeFor(f).id])return {status:'disabled',label:'AI reading off',items:[],demo};
 if(demo)return {status:'success',label:'Successfully read',items:[meta,...privacyTypeFor(f).reads],demo:true};
 const items=['Filename','File type','File size'];
 if(Number.isFinite(f.lastModified)&&f.lastModified>0)items.push('Modified date');
 return {status:'limited',label:'Metadata only',items,demo:false};
}
