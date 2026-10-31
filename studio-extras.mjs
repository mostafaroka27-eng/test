/**
 * 1.6 editors: unit details, lighting positions, interior spaces and accessories, material library,
 * kitchen templates, doors and windows, the room sheet and the hardware list.
 * Every model change goes through ctx.update / ctx.commit so undo, autosave and outputs stay in step.
 */
import {cabinet} from './engine.mjs';
import {ACCESSORIES,ACCESSORY_KEYS,accessoryName,spaceUse,SPACE_USES} from './accessories.mjs';
import {projectHardware,hardwareCsv} from './hardware.mjs';
import {KITCHEN_TEMPLATES,kitchenUnit} from './kitchen.mjs';
import {validateMaterial,newMaterialId,applyMaterial,MAX_TEXTURE_BYTES,MATERIAL_LINKS} from './materials.mjs';
import {validateRoom,roomAreaStats,unitFootprint,alignToUnit} from './room.mjs';
import {roomSheetHtml} from './room-sheet.mjs';

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const $=id=>document.getElementById(id);
const ar=()=>document.documentElement.lang==='ar';
const tr=(en,arText)=>ar()?arText:en;

export function initExtras(ctx){
 const act=fn=>{try{fn()}catch(error){ctx.warn(error.message)}};
 // ---------- unit details ----------
 function updateUnit(mutate,topology=false){const u=ctx.current();if(!u)return;const before=structuredClone(u.config);try{const next=structuredClone(u.config);mutate(next);ctx.update(u,next,topology);ctx.commit()}catch(error){u.config=before;ctx.warn(error.message);refresh()}}
 $('elevation').addEventListener('change',()=>{const u=ctx.current(),v=Number($('elevation').value);if(!Number.isFinite(v)||v<0||v>5000){ctx.warn(tr('Mounting height must be 0–5000 mm','ارتفاع التعليق من 0 إلى 5000 مم'));$('elevation').value=u.elevation??0;return}if(v)u.elevation=v;else delete u.elevation;ctx.render();ctx.commit()});

 function lightEditor(u,model){
  const set=new Set(u.config.lightPositions??[]);
  $('lightEditor').innerHTML=model.bays.map((bay,b)=>{
   const shelves=model.parts.filter(p=>p.kind==='shelf'&&p.bay===b).sort((x,y)=>y.position.y-x.position.y);
   const box=(key,label)=>`<label class="light-chip${set.has(key)?' on':''}"><input type="checkbox" data-light="${key}" ${set.has(key)?'checked':''}> ${label}</label>`;
   return `<div class="light-bay"><b>${tr('Bay','الحجرة')} ${b+1}</b>${box(`${b}:top`,tr('Under top','تحت السقف'))}${shelves.map(s=>box(`${b}:${s.slot}`,`${tr('Under shelf','تحت رف')} ${s.slot+1}`)).join('')}</div>`;
  }).join('');
  $('lightEditor').querySelectorAll('[data-light]').forEach(el=>el.onchange=()=>toggleLight(el.dataset.light,el.checked));
 }
 function toggleLight(key,on){updateUnit(c=>{const set=new Set(c.lightPositions??[]);on?set.add(key):set.delete(key);if(set.size)c.lightPositions=[...set].sort();else delete c.lightPositions})}

 function spaceTable(model){
  const lang=ar()?'ar':'en',uses=SPACE_USES[lang];
  const rows=model.spaces.map(s=>`<tr><td>${s.bay+1}</td><td>${s.kind==='drawer'?tr('Drawer','درج')+' '+(s.slot+1):s.rail?tr('Hanging','تعليق'):tr('Shelf space','مساحة رف')}</td><td>${Math.round(s.width)} × ${Math.round(s.clearHeight)} × ${Math.round(s.depth)}</td><td>${spaceUse(s).map(k=>uses[k]).join(ar()?'، ':', ')}</td></tr>`).join('');
  $('spaceTable').innerHTML=rows?`<table><thead><tr><th>${tr('Bay','حجرة')}</th><th>${tr('Space','المساحة')}</th><th>${tr('W × H × D clear','عرض × ارتفاع × عمق صافي')}</th><th>${tr('Fits','يناسب')}</th></tr></thead><tbody>${rows}</tbody></table>`:'';
 }
 function accessoryEditor(u,model){
  const bays=model.bays.length,prevBay=$('accessoryBay').value,prevType=$('accessoryType').value;
  $('accessoryBay').innerHTML=Array.from({length:bays},(_,b)=>`<option value="${b}">${tr('Bay','الحجرة')} ${b+1}</option>`).join('');
  if(Number(prevBay)<bays)$('accessoryBay').value=prevBay;
  const lang=ar()?'ar':'en',group=(g,label)=>`<optgroup label="${label}">${ACCESSORY_KEYS.filter(k=>ACCESSORIES[k].group===g).map(k=>`<option value="${k}">${esc(accessoryName(k,lang))}</option>`).join('')}</optgroup>`;
  $('accessoryType').innerHTML=group('wardrobe',tr('Wardrobe','دولاب'))+group('kitchen',tr('Kitchen','مطبخ'));
  if(prevType)$('accessoryType').value=prevType;
  const fittings=model.accessories.filter(a=>a.kind==='fitting');
  $('accessoryList').innerHTML=fittings.length?fittings.map(a=>`<div class="accessory-row${a.fits?'':' bad'}"><span>${a.fits?'✓':'⚠'} ${tr('Bay','حجرة')} ${a.bay+1} · ${esc(accessoryName(a.type,lang))}${a.level!==null?` · ${a.level} ${tr('mm','مم')}`:''}</span><button data-remove-accessory="${a.bay}:${a.index}" aria-label="${tr('Remove','حذف')}">✕</button></div>`).join(''):`<p class="note">${tr('No accessories yet.','لا توجد إكسسوارات بعد.')}</p>`;
  $('accessoryList').querySelectorAll('[data-remove-accessory]').forEach(btn=>btn.onclick=()=>{const [b,i]=btn.dataset.removeAccessory.split(':').map(Number);updateUnit(c=>{c.bayAccessories[b].splice(i,1);if(c.bayAccessories.every(l=>!l.length))delete c.bayAccessories})});
 }
 $('addAccessory').onclick=()=>{const b=Number($('accessoryBay').value),type=$('accessoryType').value,levelText=$('accessoryLevel').value.trim();
  updateUnit(c=>{const bays=c.partitions+1;const lists=c.bayAccessories?.length===bays?c.bayAccessories:Array.from({length:bays},()=>[]);const item={type};if(levelText!=='')item.level=Number(levelText);lists[b].push(item);c.bayAccessories=lists});
  const model=cabinet(ctx.current().config,ctx.current().id),last=model.accessories.filter(a=>a.kind==='fitting'&&a.bay===b).at(-1);
  if(last&&!last.fits)ctx.warn(model.warnings.filter(w=>w.code==='ACCESSORY_FIT').map(w=>w.message).join(' · '));
 };

 // Quick actions for the selected panel: light under a shelf or the top, straight from the 3D view.
 function contextActions(u,model){
  const part=model.parts.find(p=>p.id===ctx.selectedPart());let html='';
  if(part&&(part.kind==='shelf'||part.kind==='top')){
   const keys=part.kind==='shelf'?[`${part.bay}:${part.slot}`]:part.bay!==null&&part.bay!==undefined?[`${part.bay}:top`]:model.bays.map((_,b)=>`${b}:top`);
   const on=keys.every(k=>(u.config.lightPositions??[]).includes(k));
   html+=`<button id="ctxLight" class="${on?'':'primary'}">${on?tr('💡 Remove light here','💡 إزالة الإضاءة من هنا'):tr('💡 Add light under this','💡 إضافة إضاءة تحت ده')}</button>`;
   $('contextActions').innerHTML=html;
   $('ctxLight').onclick=()=>updateUnit(c=>{const set=new Set(c.lightPositions??[]);for(const k of keys)on?set.delete(k):set.add(k);if(set.size)c.lightPositions=[...set].sort();else delete c.lightPositions});
   return;
  }
  $('contextActions').innerHTML='';
 }

 // ---------- materials ----------
 let editing=null,pendingPhoto='';
 const materialById=id=>ctx.getMaterials().find(m=>m.id===id);
 function materialSelect(u){
  const list=ctx.getMaterials(),prev=$('unitMaterial').value;
  $('unitMaterial').innerHTML=list.length?list.map(m=>`<option value="${esc(m.id)}">${esc(m.name)} · ${m.thickness} ${tr('mm','مم')}</option>`).join(''):`<option value="">${tr('Add materials in the Materials tab','أضف خامات من تبويب الخامات')}</option>`;
  if(list.some(m=>m.id===prev))$('unitMaterial').value=prev;
  for(const id of ['applyCarcass','applyFronts','applyWorktop','applyGlass'])$(id).disabled=!list.length;
  const labels={materialId:tr('Carcass','الهيكل'),frontMaterialId:tr('Fronts','الواجهات'),worktopMaterialId:tr('Worktop','الرخامة'),glassMaterialId:tr('Glass','الزجاج')};
  $('materialLinks').textContent=MATERIAL_LINKS.filter(k=>u[k]).map(k=>`${labels[k]}: ${materialById(u[k])?.name??u[k]}`).join(' · ');
 }
 for(const [id,target] of [['applyCarcass','carcass'],['applyFronts','fronts'],['applyWorktop','worktop'],['applyGlass','glass']])$(id).onclick=()=>act(()=>{
  const u=ctx.current(),m=materialById($('unitMaterial').value);if(!m)return;
  const next=applyMaterial(u,m,target);cabinet(next.config,u.id);Object.assign(u,next);ctx.choose(u.id);ctx.commit();
 });
 function photoPreview(){$('matPhotoPreview').innerHTML=pendingPhoto?`<img src="${esc(pendingPhoto)}" alt="">`:'<span>—</span>'}
 function formLoad(m){
  editing=m?.id??null;$('materialFormTitle').textContent=m?tr('Edit material','تعديل خامة'):tr('New material','خامة جديدة');
  $('matName').value=m?.name??'';$('matCategory').value=m?.category??'board';$('matThickness').value=m?.thickness??18;$('matSheetLength').value=m?.sheetLength??'';$('matSheetWidth').value=m?.sheetWidth??'';
  $('matGrain').value=m?.grain??'vertical';$('matColor').value=m?.color??'#c7a47b';$('matTextureSize').value=m?.textureSize??1000;$('matSpec').value=m?.spec??'';pendingPhoto=m?.texture??'';photoPreview();$('materialError').textContent='';
 }
 // Photos are scaled to at most 1024 px and re-encoded as JPEG until they fit the size limit.
 async function shrink(file){
  const url=await new Promise((ok,fail)=>{const r=new FileReader();r.onload=()=>ok(String(r.result));r.onerror=()=>fail(Error('Photo could not be read'));r.readAsDataURL(file)});
  const img=await new Promise((ok,fail)=>{const i=new Image();i.onload=()=>ok(i);i.onerror=()=>fail(Error('Photo could not be opened'));i.src=url});
  const k=Math.min(1,1024/Math.max(img.width,img.height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.width*k));canvas.height=Math.max(1,Math.round(img.height*k));
  canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
  for(const q of [0.85,0.75,0.6,0.45,0.3]){const out=canvas.toDataURL('image/jpeg',q);if(out.length*0.75<MAX_TEXTURE_BYTES)return out}
  throw Error(tr('Photo is too detailed; use a smaller image','الصورة كبيرة جداً، استخدم صورة أصغر'));
 }
 $('matPhoto').onchange=async()=>{const f=$('matPhoto').files[0];$('matPhoto').value='';if(!f)return;try{pendingPhoto=await shrink(f);photoPreview();$('materialError').textContent=''}catch(e){$('materialError').textContent=e.message}};
 $('matPhotoRemove').onclick=()=>{pendingPhoto='';photoPreview()};
 $('matNew').onclick=()=>formLoad(null);
 $('matSave').onclick=()=>{
  try{
   const list=ctx.getMaterials(),num=id=>$(id).value.trim()===''?null:Number($(id).value);
   const m=validateMaterial({id:editing??newMaterialId(list),name:$('matName').value,category:$('matCategory').value,spec:$('matSpec').value,thickness:Number($('matThickness').value),sheetLength:num('matSheetLength'),sheetWidth:num('matSheetWidth'),grain:$('matGrain').value,color:$('matColor').value,textureSize:Number($('matTextureSize').value),texture:pendingPhoto});
   const next=editing?list.map(x=>x.id===editing?m:x):[...list,m];
   // Units already using an edited material take its new name and thickness.
   ctx.setMaterials(next);
   for(const u of ctx.getUnits())for(const [link,target] of [['materialId','carcass'],['frontMaterialId','fronts'],['worktopMaterialId','worktop'],['glassMaterialId','glass']])if(u[link]===m.id)Object.assign(u,applyMaterial(u,m,target));
   formLoad(null);ctx.choose(ctx.current().id);ctx.commit();refreshMaterials();
  }catch(e){$('materialError').textContent=e.message}
 };
 function refreshMaterials(){
  const list=ctx.getMaterials(),used=id=>ctx.getUnits().filter(u=>MATERIAL_LINKS.some(k=>u[k]===id)).length;
  $('materialList').innerHTML=list.length?list.map(m=>`<article class="material-card"><span class="material-swatch" style="background:${m.texture?`url(${m.texture}) center/cover`:m.color}"></span><div><b>${esc(m.name)}</b><small>${esc(m.spec)}</small><small>${m.thickness} ${tr('mm','مم')}${m.sheetLength?` · ${m.sheetLength} × ${m.sheetWidth}`:''} · ${tr('used by','مستخدمة في')} ${used(m.id)}</small></div><div class="material-actions"><button data-edit-material="${esc(m.id)}">${tr('Edit','تعديل')}</button><button data-delete-material="${esc(m.id)}" ${used(m.id)?'disabled':''}>${tr('Delete','حذف')}</button></div></article>`).join(''):`<p class="note">${tr('No materials yet.','لا توجد خامات بعد.')}</p>`;
  $('materialList').querySelectorAll('[data-edit-material]').forEach(b=>b.onclick=()=>formLoad(materialById(b.dataset.editMaterial)));
  $('materialList').querySelectorAll('[data-delete-material]').forEach(b=>b.onclick=()=>{ctx.setMaterials(ctx.getMaterials().filter(m=>m.id!==b.dataset.deleteMaterial));ctx.commit();refreshMaterials();refresh()});
 }
 formLoad(null);

 // ---------- kitchen ----------
 function kitchenButtons(){
  const groups={base:tr('Base','أرضي'),wall:tr('Wall','علوي'),tall:tr('Tall','طويل')};
  $('kitchenTemplates').innerHTML=Object.entries(groups).map(([g,label])=>`<div class="kitchen-group"><small>${label}</small>${KITCHEN_TEMPLATES.filter(t=>t.group===g).map(t=>`<button class="library-item kitchen-item" data-kitchen="${t.id}"><span class="item-icon">${g==='wall'?'▭':g==='tall'?'▯':'▤'}</span><span><b>${esc(ar()?t.ar:t.en)}</b><small>${t.config.width} × ${t.config.height} × ${t.config.depth}</small></span><span>＋</span></button>`).join('')}</div>`).join('');
  $('kitchenTemplates').querySelectorAll('[data-kitchen]').forEach(b=>b.onclick=()=>act(()=>addKitchen(b.dataset.kitchen)));
 }
 // True when another unit already occupies the space above (or below) the reference unit.
 function cabinetsAbove(reference,unit){const b=unitFootprint(reference);return ctx.getUnits().some(o=>o.id!==reference.id&&Boolean(o.elevation)===Boolean(unit.elevation)&&(()=>{const f=unitFootprint(o);return Math.min(f.right,b.right)-Math.max(f.left,b.left)>1&&Math.min(f.front,b.front)-Math.max(f.back,b.back)>1})())}
 function addKitchen(templateId){
  const reference=ctx.current(),id=ctx.nextId(),{name,config,elevation,template}=kitchenUnit(templateId,id);
  const unit={id,name:ar()?template.ar:name,type:'cabinet',x:0,z:0,finish:reference?.finish??'white',config,...(elevation?{elevation}:{})};
  if($('kitchenNext').checked&&reference){
   // Next to the selected unit, back faces aligned so base and wall units share the wall line.
   // A wall unit chosen while a floor unit is selected (or the reverse) goes above/below it; same kinds continue the run.
   const stack=Boolean(unit.elevation)!==Boolean(reference.elevation)&&!cabinetsAbove(reference,unit);
   const pos=stack?{x:reference.x,z:reference.z}:alignToUnit({...unit,rotation:reference.rotation??0},reference,'right',0);
   unit.rotation=reference.rotation??0;if(!unit.rotation)delete unit.rotation;
   const a=unitFootprint({...unit,...pos}),b=unitFootprint(reference);
   Object.assign(unit,{x:pos.x,z:pos.z+(b.back-a.back)});
  }
  ctx.addRecord(unit);
 }

 // ---------- doors & windows ----------
 function openingList(){
  const room=ctx.getRoom(),walls={back:tr('Back wall','الحائط الخلفي'),left:tr('Left wall','الحائط الشمال'),right:tr('Right wall','الحائط اليمين'),front:tr('Front wall','الحائط الأمامي')};
  $('openingList').innerHTML=(room.openings??[]).map((o,i)=>`<div class="accessory-row"><span>${o.type==='door'?tr('Door','باب'):tr('Window','شباك')} · ${walls[o.wall]} · ${o.width}×${o.height}${o.type==='window'?` @${o.sill}`:''}</span><button data-remove-opening="${i}" aria-label="${tr('Remove','حذف')}">✕</button></div>`).join('');
  $('openingList').querySelectorAll('[data-remove-opening]').forEach(b=>b.onclick=()=>{const room=structuredClone(ctx.getRoom());room.openings.splice(Number(b.dataset.removeOpening),1);if(!room.openings.length)delete room.openings;ctx.setRoom(room);ctx.commit()});
 }
 $('openingType').onchange=()=>{const door=$('openingType').value==='door';$('openingSill').value=door?0:900;$('openingHeight').value=door?2100:1200;$('openingWidth').value=door?900:1200;$('openingSill').disabled=door};
 $('openingSill').disabled=true;
 $('addOpening').onclick=()=>act(()=>{
  const room=structuredClone(ctx.getRoom()),o={wall:$('openingWall').value,type:$('openingType').value,offset:Number($('openingOffset').value),width:Number($('openingWidth').value),height:Number($('openingHeight').value),sill:$('openingType').value==='door'?0:Number($('openingSill').value)};
  room.openings=[...(room.openings??[]),o];validateRoom(room);ctx.setRoom(room);ctx.commit();
 });
 function roomStats(){
  try{const s=roomAreaStats(ctx.getRoom(),ctx.getUnits());$('roomStats').innerHTML=`<div><small>${tr('Floor area','مساحة الأرضية')}</small><b>${s.floorM2} ${tr('m²','م²')}</b></div><div><small>${tr('Furniture footprint','مساحة الوحدات')}</small><b>${s.occupiedM2} ${tr('m²','م²')} · ${s.occupiedPercent}%</b></div><div><small>${tr('Free floor','المساحة الفاضية')}</small><b>${s.freeM2} ${tr('m²','م²')}</b></div>`}catch(e){$('roomStats').textContent=e.message}
 }
 $('roomSheet').onclick=async()=>{
  const w=window.open('','_blank');if(!w){ctx.warn(tr('Allow pop-ups to open the room sheet','اسمح بالنوافذ المنبثقة لفتح لوحة الغرفة'));return}
  try{const images=await ctx.captureRoom();w.document.open();w.document.write(roomSheetHtml({company:ctx.company(),project:ctx.projectMeta(),room:ctx.getRoom(),units:ctx.getUnits(),images,lang:ar()?'ar':'en'}));w.document.close();setTimeout(()=>{try{w.focus();w.print()}catch{}},600)}
  catch(e){w.close();ctx.warn(e.message)}
 };

 // ---------- hardware list ----------
 function hardwareRows(){return projectHardware(ctx.getUnits(),ar()?'ar':'en')}
 function hardwareTable(){
  try{$('hardwareBom').innerHTML=hardwareRows().map(r=>`<tr><td>${esc(r.item)}</td><td>${esc(r.spec)}</td><td>${r.unit==='TBD'||r.unit==='يحدد'?'—':r.qty}</td><td>${esc(r.unit)}</td><td>${esc(r.units.join(' '))}</td><td><small>${esc(r.basis)}</small></td></tr>`).join('')}catch(e){$('hardwareBom').innerHTML=`<tr><td colspan="6">${esc(e.message)}</td></tr>`}
 }
 $('hardwareBomCsv').onclick=()=>act(()=>ctx.download(`${ctx.projectMeta().id}-accessories.csv`,hardwareCsv(hardwareRows()),'text/csv;charset=utf-8'));
 $('hardwareBomPrint').onclick=()=>{const w=window.open('','_blank');if(!w){ctx.warn(tr('Allow pop-ups to print','اسمح بالنوافذ المنبثقة للطباعة'));return}
  const rows=hardwareRows(),dir=ar()?'rtl':'ltr',meta=ctx.projectMeta();
  w.document.write(`<!doctype html><html dir="${dir}" lang="${ar()?'ar':'en'}"><head><meta charset="utf-8"><title>${tr('Accessories list','قائمة الإكسسوارات')}</title><style>body{font:12px "IBM Plex Sans Arabic",Arial,sans-serif;margin:24px;color:#263746}h1{font-size:18px;color:#172B3A}table{width:100%;border-collapse:collapse}th,td{border:1px solid #cfd8df;padding:6px;text-align:start}th{background:#eef2f5}small{color:#6B7785}</style></head><body><h1>${tr('Hardware & accessories','الإكسسوارات والخردوات')} · ${esc(meta.name||meta.id)}</h1><p><small>${tr('Counted from the design with the rules shown. Confirm with the supplier before ordering.','محسوبة من التصميم بالقواعد الموضحة. راجعها مع المورد قبل الطلب.')}</small></p><table><thead><tr><th>${tr('Item','الصنف')}</th><th>${tr('Specification','المواصفة')}</th><th>${tr('Qty','الكمية')}</th><th>${tr('Unit','الوحدة')}</th><th>${tr('Units','الوحدات')}</th><th>${tr('Rule','القاعدة')}</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r.item)}</td><td>${esc(r.spec)}</td><td>${r.unit==='TBD'||r.unit==='يحدد'?'—':r.qty}</td><td>${esc(r.unit)}</td><td>${esc(r.units.join(' '))}</td><td><small>${esc(r.basis)}</small></td></tr>`).join('')}</tbody></table></body></html>`);w.document.close();setTimeout(()=>{try{w.focus();w.print()}catch{}},400)};

 function refresh(){
  const u=ctx.current();if(!u)return;
  let model;try{model=cabinet(u.config,u.id)}catch{return}
  $('elevation').value=u.elevation??0;
  lightEditor(u,model);spaceTable(model);accessoryEditor(u,model);contextActions(u,model);materialSelect(u);
  kitchenButtons();openingList();roomStats();hardwareTable();refreshMaterials();
 }
 return {refresh};
}
