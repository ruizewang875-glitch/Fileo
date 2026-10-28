import {BUCKETS,FILES,searchFiles,getOverview,formatStorage} from './data.js';

// Equal angular gaps keep the four sections distinct; labels use exact shares.
export function ringSegmentPath(start,end){
 if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start)return '';
 // A small gap also makes a single-category, 100% ring a valid SVG arc.
 const span=Math.min(360,end-start),gap=Math.min(1.6,span/5),a=start+gap/2,b=start+span-gap/2;
 const point=(radius,angle)=>{const r=angle*Math.PI/180;return `${(220+radius*Math.cos(r)).toFixed(3)} ${(220+radius*Math.sin(r)).toFixed(3)}`;};
 const large=b-a>180?1:0;
 return `M ${point(190,a)} A 190 190 0 ${large} 1 ${point(190,b)} L ${point(136,b)} A 136 136 0 ${large} 0 ${point(136,a)} Z`;
}

export function createDashboard({onNavigate,onSort,renderRows,getRecords=()=>FILES}){
 const $=s=>document.querySelector(s),segments=new Map(),legends=new Map();
 let state={bucket:'',metric:'files',q:'',sort:'modified'};
 const go=changes=>onNavigate({bucket:state.bucket,metric:state.metric,q:state.q,...changes});
 const selectBucket=id=>go({bucket:state.bucket===id?'':id,q:''});
 for(const bucket of BUCKETS){
  const path=document.createElementNS('http://www.w3.org/2000/svg','path');
  path.setAttribute('class','ring-segment');path.setAttribute('fill',`url(#ring-${bucket.id})`);path.setAttribute('role','button');path.setAttribute('tabindex','0');path.setAttribute('aria-controls','dashboard-file-list');path.setAttribute('data-bucket',bucket.id);
  path.addEventListener('click',()=>selectBucket(bucket.id));path.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();selectBucket(bucket.id);}});
  $('#ring-segments').append(path);segments.set(bucket.id,path);
  const button=document.createElement('button');button.className='bucket-stat';button.type='button';button.dataset.bucket=bucket.id;button.setAttribute('aria-controls','dashboard-file-list');button.style.setProperty('--bucket-color',bucket.color);
  button.innerHTML=`<span class="bucket-stat-label"><i aria-hidden="true"></i>${bucket.label}</span><strong class="bucket-stat-percent"></strong><span class="bucket-stat-detail"></span>`;
  button.addEventListener('click',()=>selectBucket(bucket.id));$('#bucket-legend').append(button);legends.set(bucket.id,button);
 }
 for(const metric of ['files','space'])$('#metric-'+metric).addEventListener('click',()=>go({metric}));
 $('#ring-reset').addEventListener('click',()=>go({bucket:'',q:''}));
 $('#dashboard-clear').addEventListener('click',()=>go({bucket:'',q:''}));
 $('#review-trash').addEventListener('click',()=>go({bucket:'trash',q:''}));
 $('#dashboard-search').addEventListener('submit',e=>{e.preventDefault();go({q:$('#dashboard-query').value.trim()});});
 $('#dashboard-reset-search').addEventListener('click',()=>go({q:''}));
 $('#dashboard-sort').addEventListener('change',e=>onSort(e.target.value));
 function render(next={}){
  state={...state,...next};
  const records=getRecords(),overview=getOverview(records),bySpace=state.metric==='space',selected=overview.buckets.find(b=>b.id===state.bucket),pctKey=bySpace?'spacePercent':'filePercent';
  $('#overview-ring').setAttribute('data-selection',state.bucket);
  let angle=-90;
  for(const bucket of overview.buckets){
   const percentage=bucket[pctKey],end=angle+percentage*3.6,path=segments.get(bucket.id),button=legends.get(bucket.id),pressed=state.bucket===bucket.id;
   path.setAttribute('d',percentage?ringSegmentPath(angle,end):'');path.setAttribute('aria-pressed',String(pressed));path.setAttribute('aria-label',`${bucket.label}: ${percentage.toFixed(1)}% of ${bySpace?'storage':'files'}, ${bucket.count} files, ${formatStorage(bucket.size)}. Show files.`);
   path.setAttribute('tabindex',percentage?'0':'-1');angle=end;
   button.setAttribute('aria-pressed',String(pressed));button.querySelector('.bucket-stat-percent').textContent=`${percentage.toFixed(1)}%`;button.querySelector('.bucket-stat-detail').textContent=`${bucket.count} files · ${formatStorage(bucket.size)}`;
  }
  for(const metric of ['files','space'])$('#metric-'+metric).setAttribute('aria-pressed',String(state.metric===metric));
  $('#ring-label').textContent=selected?selected.label:bySpace?'Total storage':'Total files';
  $('#ring-value').textContent=selected?`${selected[pctKey].toFixed(1)}%`:bySpace?formatStorage(overview.totalSize):String(overview.totalCount);
  $('#ring-value').setAttribute('data-format',selected?'percent':bySpace?'storage':'count');
  $('#ring-detail').textContent=selected?`${selected.count} files · ${formatStorage(selected.size)}`:bySpace?`${overview.totalCount} files`:formatStorage(overview.totalSize);$('#ring-reset').hidden=!selected;
  const [amount,unit]=formatStorage(overview.releasableSize).split(' ');
  $('#release-value').textContent=amount;$('#release-unit').textContent=unit;$('#release-note').textContent='Estimate only · originals stay on your device.';
  const found=searchFiles(state.q,records.filter(file=>!state.bucket||file.bucket===state.bucket));
  found.sort((a,b)=>state.sort==='name'?a.file.localeCompare(b.file):state.sort==='size'?b.size-a.size:String(b.modified).localeCompare(String(a.modified)));
  $('#dashboard-list-title').textContent=selected?`${selected.label} files`:'All files';
  $('#dashboard-file-count').textContent=`${found.length} ${found.length===1?'file':'files'} · ${formatStorage(found.reduce((sum,f)=>sum+f.size,0))}`;
  $('#dashboard-clear').hidden=!state.bucket&&!state.q;$('#dashboard-query').value=state.q;$('#dashboard-sort').value=state.sort;$('#dashboard-empty').hidden=found.length>0;
  renderRows(found);
 }
 return {render};
}
