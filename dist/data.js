import {demoPreview} from './demo-preview.js';
export const TYPES = [
 {id:'psd',kind:'photoshop',app:'Photoshop',ext:'.psd',name:'Alpine afterglow',file:'alpine_afterglow.psd',category:'Photography',image:'landscape.webp',tags:'landscape mountain photo photography purple lavender dusk sky blue teal 风景 摄影 雪山 紫色 蓝色'},
 {id:'3dm',kind:'rhino',app:'Rhino',ext:'.3dm',name:'Nora lounge',file:'nora_lounge_v04.3dm',category:'Product design',image:'chair.webp',tags:'3d models model product furniture red burgundy chair chrome lounge render modeling 红色 椅子 家具 建模 产品 渲染'},
 {id:'ai',kind:'illustrator',app:'Illustrator',ext:'.ai',name:'Off / Grid',file:'off_grid_poster.ai',category:'Graphic design',tags:'poster graphic typography vector brand beige red cream design 海报 平面 排版 矢量 品牌'},
 {id:'blend',kind:'blender',app:'Blender',ext:'.blend',name:'Soft collision',file:'soft_collision.blend',category:'3D & materials',image:'sculpture.webp',tags:'3d models model materials glass chrome sculpture render experiment purple soft transparent 玻璃 金属 材质 三维 建模 渲染'},
 {id:'fig',kind:'figma',app:'Figma',ext:'.fig',name:'Unwind',file:'unwind_explorations.fig',category:'Interface design',tags:'ui ux interface website app prototype component wireframe mobile design 界面 交互 原型 网页 应用'},
 {id:'indd',kind:'indesign',app:'InDesign',ext:'.indd',name:'Field notes',file:'field_notes_02.indd',category:'Editorial design',tags:'editorial book publication magazine layout print landscape design 编辑 书籍 杂志 出版 排版'},
 {id:'prproj',kind:'premierepro',app:'Premiere Pro',ext:'.prproj',name:'Between places',file:'between_places_edit.prproj',category:'Film & motion',tags:'video film motion edit movie landscape mountain sequence 视频 电影 动态 剪辑'},
 {id:'doc',kind:'word',app:'Word',ext:'.docx',extensions:['.doc','.docx'],name:'Studio research brief',file:'studio_research_brief.docx',category:'Documents',tags:'word research document brief interview writing 文档 报告 访谈'},
 {id:'ppt',kind:'powerpoint',app:'PowerPoint',ext:'.pptx',extensions:['.ppt','.pptx'],name:'Nora design review',file:'nora_design_review.pptx',category:'Presentations',tags:'presentation deck slides pitch review 幻灯片 汇报 演示'},
 {id:'txt',kind:'plaintext',app:'Plain text',ext:'.txt',name:'Interview notes',file:'interview_notes.txt',category:'Notes',tags:'notes plain text transcript research 笔记 文本 访谈'},
 {id:'jsonl',kind:'sourcecode',app:'JSON Lines',ext:'.jsonl',name:'Material samples',file:'material_samples.jsonl',category:'Structured data',tags:'jsonl json lines structured dataset code materials finish gloss 数据集 材料 代码'},
 {id:'xls',kind:'excel',app:'Excel',ext:'.xlsx',extensions:['.xls','.xlsx'],name:'Material budget',file:'nora_material_budget.xlsx',category:'Spreadsheets',tags:'spreadsheet excel budget cost materials table 表格 预算 材料'},
 {id:'pdf',kind:'pdf',app:'PDF',ext:'.pdf',name:'Assembly sheet',file:'nora_assembly_sheet.pdf',category:'Documents',tags:'pdf export assembly catalogue document drawing 导出 文档 装配'},
 {id:'png',kind:'png',app:'PNG',ext:'.png',name:'Exploded view',file:'nora_exploded_view.png',category:'Graphics',tags:'image png export diagram design graphic 图片 图解'},
 {id:'jpg',kind:'jpeg',app:'JPEG',ext:'.jpg',extensions:['.jpg','.jpeg'],name:'Material study',file:'material_study.jpg',category:'Photography',tags:'jpg jpeg photo picture image photography 照片 摄影'}
];
const typeIndex=new Map(TYPES.flatMap(t=>(t.extensions||[t.ext]).map(ext=>[ext,t])));
export function typeForExtension(value){return typeIndex.get('.'+String(value||'').trim().replace(/^\./,'').toLowerCase());}
const SEEDS = [
 ['psd','alpine_afterglow','Alpine studies','2026-10-12',248,'ready','photo-a',false,'keep'],
 ['psd','alpine_afterglow_copy','Alpine studies','2026-10-11',248,'ready','photo-a',false,'trash'],
 ['psd','dawn_grading_v02','Alpine studies','2025-11-21',186,'work','','forgotten','archive'],
 ['3dm','nora_lounge_v04','Nora furniture','2026-10-13',42,'work','',false,'keep'],
 ['3dm','nora_frame_test','Nora furniture','2026-05-04',18,'work','','forgotten','undecided'],
 ['3dm','nora_lounge_final','Nora furniture','2026-09-28',64,'ready','',false,'keep'],
 ['ai','off_grid_poster','Off / Grid','2026-10-08',24,'ready','poster-a',false,'keep'],
 ['ai','orbital_marks','Off / Grid','2025-12-12',9,'work','','forgotten','undecided'],
 ['ai','off_grid_poster_copy','Off / Grid','2026-10-06',24,'ready','poster-a',false,'trash'],
 ['blend','soft_collision','Material lab','2026-10-10',126,'work','glass-a',false,'keep'],
 ['blend','glass_loop_early','Material lab','2026-02-17',83,'work','','forgotten','undecided'],
 ['blend','soft_collision_backup','Material lab','2026-10-09',126,'ready','glass-a',false,'trash'],
 ['fig','unwind_explorations','Unwind','2026-10-14',15,'work','',false,'keep'],
 ['fig','unwind_mobile','Unwind','2026-07-03',21,'ready','',false,'archive'],
 ['fig','unwind_components','Unwind','2026-10-01',8,'ready','',false,'archive'],
 ['indd','field_notes_02','Field notes','2026-09-24',72,'ready','',false,'keep'],
 ['indd','field_notes_01','Field notes','2025-10-12',68,'ready','','forgotten','undecided'],
 ['indd','field_notes_cover','Field notes','2026-09-23',32,'ready','',false,'archive'],
 ['prproj','between_places_edit','Between places','2026-10-07',7,'work','',false,'keep'],
 ['prproj','alpine_sequence','Between places','2026-01-09',4,'ready','','forgotten','undecided'],
 ['prproj','between_places_roughcut','Between places','2026-09-18',6,'ready','',false,'archive'],
 ['doc','studio_research_brief','Studio research','2026-10-19',1.4,'ready','brief-a',false,'keep'],
 ['doc','studio_research_outline','Studio research','2026-04-07',0.5,'work','','forgotten','undecided','.doc'],
 ['doc','studio_research_brief_copy','Studio research','2026-10-17',1.4,'ready','brief-a',false,'trash'],
 ['ppt','nora_design_review','Nora furniture','2026-10-20',18,'ready','',false,'keep'],
 ['ppt','nora_concept_pitch','Nora furniture','2026-09-07',12,'ready','',false,'archive','.ppt'],
 ['txt','interview_notes','Studio research','2026-10-18',0.007,'work','',false,'keep'],
 ['jsonl','material_samples','Material lab','2025-12-07',0.003,'work','','forgotten','undecided'],
 ['xls','nora_material_budget','Nora furniture','2026-10-17',0.16,'work','',false,'keep'],
 ['xls','nora_cost_estimate','Nora furniture','2026-05-11',0.12,'ready','','forgotten','archive','.xls'],
 ['pdf','nora_assembly_sheet','Nora furniture','2026-10-18',2.4,'ready','',false,'keep'],
 ['pdf','field_catalogue','Field notes','2026-06-14',5.6,'ready','',false,'archive'],
 ['png','nora_exploded_view','Nora furniture','2026-10-16',3.2,'ready','',false,'keep'],
 ['png','off_grid_lockup','Off / Grid','2026-09-14',0.91,'ready','',false,'archive'],
 ['jpg','material_study','Material lab','2026-10-18',4.8,'ready','material-a',false,'keep'],
 ['jpg','material_study_copy','Material lab','2026-10-17',4.8,'ready','material-a',false,'trash'],
 ['jpg','north_ridge','Alpine studies','2026-03-19',8.2,'ready','',false,'archive','.jpeg']
];
export const FILES = SEEDS.map(([type,base,project,modified,size,status,duplicate,forgotten,bucket,extension],i)=>{
 const t=TYPES.find(x=>x.id===type),ext=extension||t.ext,file=base+ext,p=demoPreview({file});return {...t,ext,image:p.path,previewKey:p.key,previewFamily:p.family,previewNote:p.detail,id:`file-${i+1}`,type,name:base.replaceAll('_',' '),file,project,modified,size,status,duplicate,forgotten:!!forgotten,bucket};
});
export const PROJECTS=[...new Set(FILES.map(f=>f.project))].map(name=>{
 const files=FILES.filter(f=>f.project===name).sort((a,b)=>b.modified.localeCompare(a.modified));
 return {id:name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''),name,files,cover:files[0],modified:files[0].modified};
}).sort((a,b)=>b.modified.localeCompare(a.modified));
export const INITIAL_SAVED=['file-1','file-4','file-13'];
export const INITIAL_RECENT=['file-13','file-4','file-1'];
export const BUCKETS=[
 {id:'keep',label:'Keep',color:'#598f8c'},
 {id:'archive',label:'Archive',color:'#9474b8'},
 {id:'trash',label:'Trash',color:'#bd778c'},
 {id:'undecided',label:'Undecided',color:'#8290ab'}
];
export const SUGGESTIONS=BUCKETS.map(b=>({bucket:b.id,label:b.label,count:FILES.filter(f=>f.bucket===b.id).length}));
export function formatStorage(mb){if(mb>0&&mb<0.001)return Math.round(mb*1e6)+' B';if(mb>=0.001&&mb<1)return Math.round(mb*1000)+' KB';return mb>=1000?`${(mb/1000).toFixed(2)} GB`:`${mb.toLocaleString('en-US',{maximumFractionDigits:1})} MB`;}
export function getOverview(files=FILES){
 const totalCount=files.length,totalSize=files.reduce((sum,file)=>sum+file.size,0);
 const buckets=BUCKETS.map(b=>{const group=files.filter(f=>f.bucket===b.id),size=group.reduce((sum,f)=>sum+f.size,0);return {...b,count:group.length,size,filePercent:totalCount?group.length/totalCount*100:0,spacePercent:totalSize?size/totalSize*100:0};});
 return {totalCount,totalSize,buckets,releasableSize:buckets.find(b=>b.id==='trash').size};
}
const STOP=new Set(['a','an','the','find','me','my','some','all','files','file','with','of','for','and','show']);
const ALIASES={ps:'psd',photos:'photo',pictures:'photo',images:'photo',chairs:'chair',models:'model',videos:'video',posters:'poster',purple:'purple',unfinished:'work',wip:'work','3d':'3d',三维:'3d'};
export function searchFiles(query,files=FILES){
 const terms=query.trim().toLowerCase().replace(/[.,!?，。！？]/g,' ').split(/\s+/).filter(t=>t&&!STOP.has(t)).map(t=>ALIASES[t]||t);
 if(!terms.length)return [...files];
 return files.filter(file=>{
  const hay=[file.file,file.app,file.category,file.project,file.tags,file.status,file.ext].join(' ').toLowerCase();
  return terms.every(t=>hay.includes(t));
 });
}
export function getFiles({type='',q='',view='',project='',bucket='',sort='modified'}={},saved=INITIAL_SAVED,recent=INITIAL_RECENT){
 const projectName=PROJECTS.find(p=>p.id===project)?.name;
 let found=FILES.filter(f=>(!type||f.type===type)&&(!projectName||f.project===projectName)&&(!bucket||f.bucket===bucket));
 if(view==='saved')found=found.filter(f=>saved.includes(f.id));
 if(view==='recent')found=found.filter(f=>recent.includes(f.id));
 if(view==='continue')found=found.filter(f=>f.status==='work');
 if(view==='rediscover')found=found.filter(f=>f.forgotten);
 if(view==='duplicates')found=found.filter(f=>f.duplicate);
 found=searchFiles(q,found);
 if(view==='recent'&&sort==='modified')return found.sort((a,b)=>recent.indexOf(a.id)-recent.indexOf(b.id));
 if(view==='duplicates'&&sort==='modified')return found.sort((a,b)=>a.duplicate.localeCompare(b.duplicate)||a.file.localeCompare(b.file));
 return found.sort((a,b)=>sort==='name'?a.file.localeCompare(b.file):sort==='size'?b.size-a.size:b.modified.localeCompare(a.modified));
}
export function parseRoute(hash){
 const [page='',params='']=hash.replace(/^#/,'').split('?');
 const p=new URLSearchParams(params),type=p.get('type')||'',view=p.get('view')||'',project=p.get('project')||'',bucket=p.get('bucket')||'';
 return {page:['files','projects','dashboard'].includes(page)?page:'home',type:TYPES.some(t=>t.id===type)?type:'',view:['saved','recent','continue','rediscover','duplicates'].includes(view)?view:'',project:PROJECTS.some(item=>item.id===project)?project:'',bucket:BUCKETS.some(b=>b.id===bucket)?bucket:'',metric:p.get('metric')==='space'?'space':'files',q:p.get('q')||''};
}
export function routeHash({page='files',type='',view='',project='',bucket='',metric='files',q=''}={}){
 const p=new URLSearchParams();if(type)p.set('type',type);if(view)p.set('view',view);if(project)p.set('project',project);if(bucket)p.set('bucket',bucket);if(metric==='space'&&page==='dashboard')p.set('metric',metric);if(q.trim())p.set('q',q.trim());return (['projects','dashboard'].includes(page)?'#'+page:'#files')+(p.size?'?'+p.toString():'');
}
