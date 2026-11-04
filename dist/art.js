import {demoPreview} from './demo-preview.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function art(file){
 const preview=demoPreview(file);
 if(preview)return `<img src="${esc(preview.src)}" alt="${esc(preview.alt)}" draggable="false">`;
 return '<div class="native-preview" aria-hidden="true"></div>';
}
