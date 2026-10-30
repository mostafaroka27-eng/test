import {roomPlanSvg,alignToUnit} from './room.mjs';
import {createKitchenLayout} from './layout.mjs';
import {DEFAULT_COSTING,validateCosting,estimateProjectCost,costingCsv} from './costing.mjs';
import {applyLanguage,getLanguage,t} from './i18n.mjs';
import {saveRevision,listRevisions,loadRevision,deleteRevision} from './revisions.mjs';

const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fields={Currency:'currency',EdgeRate:'edgeRate',WastePercent:'wastePercent',LaborHours:'laborHours',HourlyRate:'hourlyRate',HardwareCost:'hardwareCost',OverheadPercent:'overheadPercent',ProfitMarginPercent:'profitMarginPercent'};
const labels={material:'Material',edge:'Edges',labor:'Labor',hardware:'Hardware',overhead:'Overhead',production:'Production cost',selling:'Selling price',profit:'Estimated profit'};

/** Complete numeric planning and estimate tools; model commits are owned by the app. */
export function initWorkspace({getProject,getSelectedId,select,commit,download,onError}){
 const $=id=>document.getElementById(id);
 let quote=null;
 const act=callback=>{try{callback()}catch(error){onError(error.message)}};
 function refresh(){
  const project=getProject(),settings=validateCosting(project.costing??DEFAULT_COSTING);
  $('planDrawing').innerHTML=roomPlanSvg(project.room,project.units);
  const selected=getSelectedId();
  $('planDrawing').querySelectorAll('[data-unit]').forEach(node=>{node.setAttribute('aria-pressed',String(node.dataset.unit===selected));if(node.dataset.unit===selected)node.classList.add('selected-unit')});
  const previousReference=$('alignReference').value;
  $('alignReference').replaceChildren(...project.units.filter(unit=>unit.id!==selected).map(unit=>new Option(`${unit.id} · ${unit.name}`,unit.id)));
  if(project.units.some(unit=>unit.id===previousReference&&unit.id!==selected))$('alignReference').value=previousReference;
  $('applyAlignment').disabled=project.units.length<2;
  for(const [suffix,key] of Object.entries(fields))$('cost'+suffix).value=settings[key]??'';
  try{quote=estimateProjectCost(project.units,settings)}catch(error){
   // A failed estimate must never prevent a valid design from opening or being edited.
   quote=estimateProjectCost(project.units,{...DEFAULT_COSTING,currency:settings.currency});
   quote.rows.forEach(row=>{row.rate=settings.materials.find(rate=>rate.material===row.material&&rate.thickness===row.thickness)?.pricePerM2??null});
   Object.keys(quote.totals).forEach(key=>{quote.totals[key]=null});quote.complete=false;
   quote.missing=['Calculation unavailable: '+error.message];quote.basis='Adjust the price settings to calculate this estimate. Design data remains available.';
  }
  $('costMaterials').innerHTML=quote.rows.map((row,index)=>`<tr><td data-i18n-skip>${escape(row.material)}</td><td>${row.thickness}</td><td>${row.areaM2.toFixed(3)}</td><td><input data-material-rate="${index}" aria-label="${escape(row.material)} / ${row.thickness} mm" type="number" min="0" step="any" value="${row.rate??''}"></td><td>${row.cost===null?'—':row.cost.toFixed(quote.precision)}</td></tr>`).join('');
  $('costStatus').textContent=quote.complete?'Estimate complete · user-entered rates':'Estimate incomplete · missing rates';
  $('costMissing').textContent=quote.missing.length?quote.missing.join(' · '):'';
  $('costTotals').innerHTML=Object.entries(labels).map(([key,label])=>`<div><small>${escape(t(label))}</small><strong data-total="${key}">${quote.totals[key]===null?'—':quote.totals[key].toFixed(quote.precision)+' '+quote.currency}</strong></div>`).join('');
  $('costBasis').textContent=quote.basis;
  refreshRevisions();
  applyLanguage(getLanguage());
 }
 function refreshRevisions(){
  try{
   const selected=$('revisionList').value,entries=listRevisions(localStorage);
   $('revisionList').replaceChildren(new Option('Choose a saved revision…',''),...entries.slice().reverse().map(entry=>new Option(`${entry.label} · ${new Date(entry.createdAt).toLocaleString()}`,entry.id)));
   if(entries.some(entry=>entry.id===selected))$('revisionList').value=selected;
   $('revisionCount').textContent=`${entries.length} / 10 saved locally · export JSON for a portable copy`;
  }catch(error){$('revisionCount').textContent=error.message}
 }
 function savePrices(event){
  const project=getProject(),settings=structuredClone(project.costing??DEFAULT_COSTING);
  if(event.target.matches('[data-material-rate]')){
   const row=quote.rows[Number(event.target.dataset.materialRate)];
   const value=event.target.value.trim()===''?null:Number(event.target.value);
   settings.materials=settings.materials.filter(rate=>rate.material!==row.material||rate.thickness!==row.thickness);
   settings.materials.push({material:row.material,thickness:row.thickness,pricePerM2:value});
  }else{
   for(const [suffix,key] of Object.entries(fields))if(event.target.id==='cost'+suffix){
    settings[key]=key==='currency'?event.target.value.trim().toUpperCase():event.target.value.trim()===''&&['edgeRate','hourlyRate'].includes(key)?null:Number(event.target.value);
   }
  }
  commit({...project,costing:validateCosting(settings)});
 }
 $('costingPanel').addEventListener('change',event=>{try{savePrices(event)}catch(error){refresh();onError(error.message)}});
 $('costExport').onclick=()=>act(()=>download('rokadex-cost-ESTIMATE.csv',costingCsv(quote),'text/csv;charset=utf-8'));
 $('costRecalculate').onclick=()=>act(refresh);
 $('saveRevision').onclick=()=>act(()=>{saveRevision(localStorage,getProject(),{label:$('revisionLabel').value});refreshRevisions()});
 $('loadRevision').onclick=()=>act(()=>{commit(loadRevision(localStorage,$('revisionList').value))});
 $('deleteRevision').onclick=()=>act(()=>{
  if(!$('revisionList').value)throw Error('Choose a saved revision');
  if(confirm('Delete this saved revision? / حذف هذه المراجعة المحفوظة؟')){deleteRevision(localStorage,$('revisionList').value);refreshRevisions()}
 });
 $('generateKitchen').onclick=()=>act(()=>{
  const project=getProject();
  const units=createKitchenLayout(project.room,{shape:$('kitchenShape').value,count:Number($('kitchenCount').value),width:Number($('kitchenWidth').value),depth:Number($('kitchenDepth').value),height:Number($('kitchenHeight').value),gap:Number($('kitchenGap').value)});
  if(!confirm('Replace the current cabinets with this kitchen layout? Undo is available. / استبدال الوحدات الحالية بتوزيع المطبخ؟ يمكنك التراجع.'))return;
  commit({...project,units});
 });
 $('applyAlignment').onclick=()=>act(()=>{
  const project=structuredClone(getProject()),unit=project.units.find(unit=>unit.id===getSelectedId()),reference=project.units.find(unit=>unit.id===$('alignReference').value);
  if(!reference)throw Error('Choose a reference unit');
  Object.assign(unit,alignToUnit(unit,reference,$('alignSide').value,Number($('alignGap').value)));
  commit(project);
 });
 $('snapGrid').onclick=()=>act(()=>{
  const step=Number($('gridStep').value);if(!Number.isFinite(step)||step<=0||step>1000)throw Error('Grid step must be 1–1000 mm');
  const project=structuredClone(getProject()),unit=project.units.find(unit=>unit.id===getSelectedId());
  unit.x=Math.round(unit.x/step)*step;unit.z=Math.round(unit.z/step)*step;commit(project);
 });
 const selectPlan=event=>{const target=event.target.closest('[data-unit]');if(target){select(target.dataset.unit);refresh()}};
 $('planDrawing').addEventListener('click',selectPlan);
 $('planDrawing').addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();selectPlan(event)}});
 refresh();
 return {refresh};
}
