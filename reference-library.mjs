import {referenceFacts,referenceRoomPresets,applyReferenceRoom} from './reference-data.mjs';
import {applyLanguage,getLanguage} from './i18n.mjs';

// These JSON files contain extracted facts and independently authored schemas, never uploaded JS.
const documents=import.meta.glob('./analysis/*.json',{eager:true,import:'default'});
const reports=import.meta.glob('./analysis/*.md',{eager:true,query:'?url',import:'default'});
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function initReferenceLibrary({getProject,commit,download,onError}){
 const $=id=>document.getElementById(id),entries=Object.entries(documents).sort(([a],[b])=>a.localeCompare(b));
 $('referenceSource').replaceChildren(...entries.map(([path])=>new Option(path.split('/').at(-1),path)));
 let page=0,filtered=[];
 function render(){
  try{
   const data=documents[$('referenceSource').value],query=$('referenceSearch').value.trim().toLocaleLowerCase();
   const all=referenceFacts(data);filtered=all.filter(fact=>!query||(fact.path+' '+fact.path.replace(/\.value\./g,'.')+' '+fact.value).toLocaleLowerCase().includes(query));
   const pages=Math.max(1,Math.ceil(filtered.length/60));page=Math.min(page,pages-1);
   $('referenceRows').innerHTML=filtered.slice(page*60,(page+1)*60).map(fact=>`<tr><td data-i18n-skip>${escape(fact.path)}</td><td data-i18n-skip>${escape(fact.value)}</td></tr>`).join('');
   $('referenceStatus').textContent=`${filtered.length} / ${all.length} reference facts · ${page+1} / ${pages}`;
   $('referencePrev').disabled=page===0;$('referenceNext').disabled=page===pages-1;
   applyLanguage(getLanguage());
  }catch(error){onError(error.message)}
 }
 $('referenceSource').onchange=()=>{page=0;render()};$('referenceSearch').oninput=()=>{page=0;render()};
 $('referencePrev').onclick=()=>{page--;render()};$('referenceNext').onclick=()=>{page++;render()};
 $('referenceDownload').onclick=()=>download($('referenceSource').value.split('/').at(-1),JSON.stringify(documents[$('referenceSource').value],null,2),'application/json');
 const roomSource=documents['./analysis/room-planner-data.json'],presets=referenceRoomPresets(roomSource);
 $('referenceRoomPreset').replaceChildren(...presets.map(preset=>new Option(`${preset.name} · ${preset.width} × ${preset.depth} mm`,preset.id)));
 $('applyReferenceRoom').onclick=()=>{
  try{
   const project=getProject(),preset=presets.find(entry=>entry.id===$('referenceRoomPreset').value);
   if(!confirm('Apply these room dimensions? Existing cabinets remain and conflicts are reported. / تطبيق أبعاد الغرفة؟ تبقى الوحدات الحالية وتظهر التعارضات.'))return;
   commit({...project,room:applyReferenceRoom(project.room,preset)});
  }catch(error){onError(error.message)}
 };
 $('referenceReports').replaceChildren(...Object.entries(reports).map(([path,url])=>{
  const link=document.createElement('a');link.href=url;link.textContent=path.split('/').at(-1);link.download=link.textContent;return link;
 }));
 render();
}
