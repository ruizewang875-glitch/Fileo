import {demoPreview} from './demo-preview.js';

// Editorial card art is deliberately distinct from the full preview used for
// decisions. Nothing here changes preview keys, comparison evidence or uploads.
const styles={
 ai:['Off / Grid poster artwork','50% 46%'],fig:['Unwind landscape interface cover','50% 50%'],
 indd:['Field Notes contour atlas','50% 45%'],prproj:['Alpine film and editing tracks','50% 58%'],
 doc:['Studio research brief cover','50% 46%'],ppt:['Nora chair presentation cover','50% 49%'],
 txt:['Studio interview quotation','50% 48%'],jsonl:['Material sample data cover','50% 50%'],
 xls:['Nora material budget graphic','50% 48%'],pdf:['Nora assembly drawing','50% 48%'],
 png:['Nora exploded chair artwork','50% 46%']
};
const primary={
 'previews/offgrid.svg':'ai','previews/unwind-desktop.svg':'fig','previews/field-02.svg':'indd',
 'previews/film-edit.svg':'prproj','previews/brief.svg':'doc','previews/deck-review.svg':'ppt',
 'previews/notes.svg':'txt','previews/material-samples.svg':'jsonl','previews/budget.svg':'xls',
 'previews/assembly.svg':'pdf','previews/exploded.svg':'png'
};
const variants=new Set(['field-01','field-cover','deck-pitch','film-rough','film-alpine','outline','estimate','catalogue','lockup']);
const focal={
 'chair.webp':'49% 60%','nora-oak-final.webp':'52% 60%','nora-frame-study.webp':'49% 59%',
 'sculpture.webp':'50% 52%','loop-study.webp':'50% 54%','landscape.webp':'50% 43%','dawn-grade-study.webp':'50% 43%'
};
const coverURL=path=>'assets/'+path;
export function exploreCover(file,{typeCard=false}={}){
 const p=demoPreview(file);if(!p)return null;
 const kind=typeCard&&Object.hasOwn(styles,file.type||file.id)?(file.type||file.id):primary[p.path];
 if(kind){const path='covers/'+kind+'.svg';return {src:coverURL(path),path,alt:styles[kind][0],focus:styles[kind][1]};}
 const stem=p.path.replace(/^previews\//,'').replace(/\.svg$/,'');
 if(variants.has(stem)){const path='covers/variants/'+stem+'.svg';return {src:coverURL(path),path,alt:p.alt+' cover',focus:'50% 50%'};}
 return {...p,focus:focal[p.path]||'50% 50%'};
}
