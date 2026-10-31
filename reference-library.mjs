import {referenceCatalog} from './reference-catalog.mjs';
import {applyReferenceRoom} from './reference-data.mjs';
import {applyLanguage,getLanguage} from './i18n.mjs';
import ncd from './analysis/ncd-data.json';
import planner from './analysis/room-planner-data.json';

const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/** The reference files are not shown as raw data; their content feeds the library, finishes and room templates. */
export function initReferenceLibrary({getProject,addUnit,commit,onError}){
 const $=id=>document.getElementById(id);
 let catalog;
 try{catalog=referenceCatalog({ncd,planner})}catch(error){onError(error.message);return}
 const ar=()=>getLanguage()==='ar';
 $('referenceTemplates').replaceChildren(...catalog.templates.map(template=>{
  const button=document.createElement('button');button.className='library-item';button.dataset.template=template.id;button.dataset.i18nSkip='';
  const {width,height,depth}=template.config;
  button.innerHTML=`<span class="item-icon" aria-hidden="true">▥</span><span><b data-en="${escape(template.nameEn)}" data-ar="${escape(template.name)}">${escape(template.nameEn)}</b><small>${width} × ${height} × ${depth} mm</small></span><span aria-hidden="true">＋</span>`;
  button.onclick=()=>{try{addUnit(ar()?template.name:template.nameEn,structuredClone(template.config),template.finish)}catch(error){onError(error.message)}};
  return button;
 }));
 $('referenceSkipped').dataset.i18nSkip='';
 const GROUP_AR={'Finishes':'تشطيبات','Colours':'ألوان','Room colours':'ألوان الغرف'};
 const finish=$('finish');
 for(const group of catalog.finishes){
  const node=document.createElement('optgroup');node.label=group.label;node.dataset.en=group.label;
  node.append(...group.finishes.map(entry=>{const option=new Option(entry.name,entry.color);option.dataset.i18nSkip='';option.style.background=entry.color;return option}));
  finish.append(node);
 }
 $('referenceRoomPreset').replaceChildren(...catalog.rooms.map(room=>new Option(`${room.name} · ${room.width} × ${room.depth} mm`,room.id)));
 $('applyReferenceRoom').onclick=()=>{
  try{
   const project=getProject(),preset=catalog.rooms.find(entry=>entry.id===$('referenceRoomPreset').value);
   if(!confirm('Apply these room dimensions? Existing cabinets remain and conflicts are reported. / تطبيق أبعاد الغرفة؟ تبقى الوحدات الحالية وتظهر التعارضات.'))return;
   commit({...project,room:applyReferenceRoom(project.room,preset)});
  }catch(error){onError(error.message)}
 };
 const relabel=()=>{
  document.querySelectorAll('#referenceTemplates b[data-en]').forEach(node=>{node.textContent=ar()?node.dataset.ar:node.dataset.en});
  document.querySelectorAll('#finish optgroup[data-en]').forEach(node=>{node.label=ar()?GROUP_AR[node.dataset.en]||node.dataset.en:node.dataset.en});
  const skipped=catalog.skipped.map(item=>ar()?item.name:item.nameEn).join('، ');
  $('referenceSkipped').textContent=!skipped?'':ar()?`غير متاح بعد: ${skipped} (المحرك يدعم قضيب تعليق واحد لكل حجرة).`:`Not available yet: ${skipped} (one hanging rail per bay).`;
 };
 relabel();new MutationObserver(relabel).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
 applyLanguage(getLanguage());
 return catalog;
}
