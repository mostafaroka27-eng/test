import * as THREE from 'three';
import {roomSection,ROOM_CSS,ROOM_LABELS} from './room-sheet.mjs';
import {cabinet} from './engine.mjs';
import {companyName,companyContact,hasCompany} from './company.mjs';
import {finishColor} from './reference-catalog.mjs';

/**
 * Client presentation ("showroom"): dollhouse view of the room on a light or night stage, a card per
 * unit with open-fronts and interior-LED switches, camera flights and a printable client proposal.
 * Display only: nothing here changes the project.
 */
const L={
 en:{overview:'Overview',front:'Front',top:'Top',day:'Day',night:'Night',openAll:'Open all',closeAll:'Close all',lights:'Lights',rotate:'Auto-rotate',pdf:'Client PDF',exit:'✕ Exit presentation',
  open:'Open',led:'LED',units:'Units',client:'Client',project:'Project',date:'Date',revision:'Revision',size:'Size (W × H × D)',finish:'Finish',features:'Features',doors:'doors',glassDoors:'glass doors',drawers:'drawers',shelves:'shelves',rails:'hanging rails',bays:'sections',
  proposal:'Design proposal',illustrative:'Images are illustrative renders; on-screen colours vary. Final dimensions are confirmed after site measurement.',preliminary:'Preliminary design for client review',noCompany:'Add your company name and logo in Settings',mm:'mm',overviewTitle:'Room overview'},
 ar:{overview:'نظرة عامة',front:'أمامي',top:'من أعلى',day:'نهار',night:'ليل',openAll:'فتح الكل',closeAll:'غلق الكل',lights:'الإضاءة',rotate:'دوران تلقائي',pdf:'ملف العميل PDF',exit:'✕ إنهاء العرض',
  open:'فتح',led:'LED',units:'الوحدات',client:'العميل',project:'المشروع',date:'التاريخ',revision:'الإصدار',size:'المقاس (ع × ار × عمق)',finish:'اللون',features:'المكونات',doors:'أبواب',glassDoors:'أبواب زجاج',drawers:'أدراج',shelves:'رفوف',rails:'قضبان تعليق',bays:'أقسام',
  proposal:'عرض تصميم',illustrative:'الصور توضيحية وقد تختلف الألوان على الشاشة. المقاسات النهائية تُعتمد بعد رفع المقاسات في الموقع.',preliminary:'تصميم مبدئي لمراجعة العميل',noCompany:'أضف اسم الشركة واللوجو من الإعدادات',mm:'مم',overviewTitle:'نظرة عامة على الغرفة'},
};
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/** What the client sees for one unit: size, finish and counted features from the model. */
export function unitSummary(unit){
 const model=cabinet(unit.config,unit.id),count=kind=>model.parts.filter(p=>p.kind===kind).length;
 const doors=model.parts.filter(p=>p.kind==='door'),glass=doors.filter(p=>p.sheetGood===false).length;
 const drawers=new Set(model.parts.filter(p=>p.kind==='drawerFace'||p.kind==='drawerFront').map(p=>`${p.bay}:${p.slot}`)).size;
 const size=model.overall??model.dimensions;
 return {width:size.width,height:size.height,depth:size.depth,bays:(model.bays??[]).length||unit.config.partitions+1,
  doors:doors.length-glass,glassDoors:glass,drawers,shelves:count('shelf')+count('fixedShelf'),rails:model.accessories.filter(a=>a.kind==='hangingRail').length};
}
export function featureText(summary,lang='en'){
 const t=L[lang]||L.en;
 return [['bays',summary.bays],['doors',summary.doors],['glassDoors',summary.glassDoors],['drawers',summary.drawers],['shelves',summary.shelves],['rails',summary.rails]].filter(([,n])=>n>0).map(([k,n])=>`${n} ${t[k]}`).join(' · ');
}

/** Printable A4 landscape proposal; images are data URLs captured from the 3D view. */
export function proposalHtml({company={},project={},units=[],images={},finishName=()=>'',lang='en',date=new Date().toISOString().slice(0,10),room=null}){
 const t=L[lang]||L.en,dir=lang==='ar'?'rtl':'ltr',name=companyName(company,lang),contact=companyContact(company);
 const brand=`<div class="brand">${company.logo?`<img src="${esc(company.logo)}" alt="">`:''}<div><b>${esc(name)}</b>${company.tagline?`<small>${esc(company.tagline)}</small>`:''}${contact?`<small>${esc(contact)}</small>`:''}</div></div>`;
 const meta=`<dl><div><dt>${t.project}</dt><dd>${esc(project.name||project.id||'—')}</dd></div><div><dt>${t.client}</dt><dd>${esc(project.client||'—')}</dd></div><div><dt>${t.date}</dt><dd>${esc(date)}</dd></div><div><dt>${t.revision}</dt><dd>${esc(project.revision??1)}</dd></div></dl>`;
 const cover=`<section class="page cover">${brand}<h1>${t.proposal}</h1><p class="sub">${esc(project.name||'')}${project.client?` — ${esc(project.client)}`:''}</p>${images.overview?`<img class="hero" src="${images.overview}" alt="${esc(t.overviewTitle)}">`:''}${meta}<footer>${t.preliminary} · ${t.illustrative}${company.address?` · ${esc(company.address)}`:''}</footer></section>`;
 const roomPage=room?`<section class="page room"><header>${brand}<span>${esc(ROOM_LABELS[lang]?.title??ROOM_LABELS.en.title)}</span></header>${roomSection({room,units,images,lang})}<footer>${t.illustrative}</footer></section>`:'';
 const pages=units.map(unit=>{const s=unitSummary(unit),color=finishColor(unit.finish);
  return `<section class="page unit"><header>${brand}<span>${esc(project.name||'')}</span></header><div class="grid">${images[unit.id]?`<img src="${images[unit.id]}" alt="${esc(unit.name)}">`:'<div></div>'}<div class="facts"><small>${esc(unit.id)}</small><h2>${esc(unit.name)}</h2>
  <table><tr><th>${t.size}</th><td>${s.width} × ${s.height} × ${s.depth} ${t.mm}</td></tr><tr><th>${t.finish}</th><td><span class="sw" style="background:${color}"></span>${esc(finishName(unit.finish))}</td></tr><tr><th>${t.features}</th><td>${esc(featureText(s,lang))}</td></tr></table>${images[unit.id+':open']?`<img class="open" src="${images[unit.id+':open']}" alt="">`:''}</div></div><footer>${t.illustrative}</footer></section>`}).join('');
 return `<!doctype html><html lang="${lang}" dir="${dir}"><head><meta charset="utf-8"><title>${esc(t.proposal)} — ${esc(project.name||project.id||'')}</title><style>
@page{size:A4 landscape;margin:0}*{box-sizing:border-box}body{margin:0;background:#e9edf0;font-family:"IBM Plex Sans Arabic","IBM Plex Sans","Segoe UI",Tahoma,sans-serif;color:#263746}
.page{width:297mm;height:210mm;margin:0 auto 6mm;background:#fff;padding:14mm 16mm;position:relative;overflow:hidden;break-after:page;page-break-after:always}
.brand{display:flex;gap:10px;align-items:center}.brand img{max-height:16mm;max-width:40mm;object-fit:contain}.brand b{display:block;font-size:15pt;color:#172B3A}.brand small{display:block;color:#6B7785;font-size:8.5pt}
.cover h1{font-size:30pt;margin:10mm 0 2mm;color:#172B3A}.cover .sub{margin:0 0 5mm;color:#0B7375;font-size:13pt}.hero{width:100%;height:104mm;object-fit:cover;border-radius:3mm;background:#eef1f4}
dl{display:grid;grid-template-columns:repeat(4,1fr);gap:4mm;margin:5mm 0 0}dt{font-size:8pt;color:#6B7785}dd{margin:0;font-weight:600}
footer{position:absolute;bottom:8mm;inset-inline:16mm;font-size:7.5pt;color:#8F99A4;border-top:1px solid #E2E8EE;padding-top:2mm}
.unit header{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #E2E8EE;padding-bottom:4mm;color:#6B7785}
.grid{display:grid;grid-template-columns:1.5fr 1fr;gap:8mm;margin-top:6mm}.grid>img{width:100%;height:140mm;object-fit:cover;border-radius:3mm;background:#eef1f4}
.facts h2{margin:1mm 0 5mm;font-size:20pt;color:#172B3A}.facts small{color:#0B7375;font-weight:600}table{border-collapse:collapse;width:100%;font-size:10pt}th{text-align:start;color:#6B7785;font-weight:500;padding:2.4mm 0;width:38%;vertical-align:top}td{padding:2.4mm 0;border-bottom:1px solid #E2E8EE}
.sw{display:inline-block;width:5mm;height:5mm;border-radius:1mm;border:1px solid #D2DAE2;vertical-align:-1mm;margin-inline-end:2mm}.open{width:100%;height:58mm;object-fit:cover;border-radius:3mm;margin-top:6mm}
${ROOM_CSS}@media print{body{background:#fff}.page{margin:0}}</style></head><body>${cover}${roomPage}${pages}</body></html>`;
}

export function initShowroom(ctx){
 const {camera,controls,display,applyStage,renderScene,getUnits,getSelected,select,getCompany,getProject,getRenderer,scene,finishName,onError}=ctx;
 const $=id=>document.getElementById(id),root=$('presentation');
 const lang=()=>document.documentElement.lang==='ar'?'ar':'en',t=()=>L[lang()];
 let flight=null;
 const roomBox=()=>{const r=ctx.getRoom();return {w:r.width,d:r.depth,h:r.height}};
 function fly(position,target,ms=800){
  const fromP=camera.position.clone(),fromT=controls.target.clone(),start=performance.now();
  flight={update(now){const k=Math.min(1,(now-start)/ms),e=k<.5?2*k*k:1-(-2*k+2)**2/2;camera.position.lerpVectors(fromP,position,e);controls.target.lerpVectors(fromT,target,e);if(k>=1)flight=null}};
 }
 const overviewPose=()=>{const {w,d}=roomBox(),span=Math.max(w,d);return [new THREE.Vector3(span*0.1,span*1.6,span*1.3),new THREE.Vector3(0,500,-span*0.1)]};
 function overview(){fly(...overviewPose())}
 function topView(){const {w,d}=roomBox();fly(new THREE.Vector3(0,Math.max(w,d)*1.35,1),new THREE.Vector3(0,0,0))}
 // Camera in front of a unit, offset towards the room centre so side walls do not block it.
 function unitPose(unit,front=false){
  const angle=THREE.MathUtils.degToRad(unit.rotation??0),h=unit.config.height,dist=Math.max(unit.config.width*1.2,h)*1.75;
  const local=new THREE.Vector3(-unit.x,0,-unit.z).applyAxisAngle(new THREE.Vector3(0,1,0),-angle),side=front?0:(local.x>=0?0.5:-0.5);
  const dir=new THREE.Vector3(side,0,1).normalize().applyAxisAngle(new THREE.Vector3(0,1,0),angle);
  const target=new THREE.Vector3(unit.x,h*0.47,unit.z);return [target.clone().add(dir.multiplyScalar(dist)).add(new THREE.Vector3(0,h*0.18,0)),target];
 }
 function unitView(unit,front=false){fly(...unitPose(unit,front))}
 function frontView(){const unit=getUnits().find(u=>u.id===getSelected())||getUnits()[0];unitView(unit,true)}

 function brand(){
  const company=getCompany(),name=companyName(company,lang());
  $('showLogo').innerHTML=company.logo?`<img src="${esc(company.logo)}" alt="">`:'';
  $('showCompany').textContent=name||'';$('showContact').textContent=hasCompany(company)?companyContact(company):t().noCompany;
  const project=getProject();$('presentationTitle').textContent=project.name||t().proposal;
  $('showClient').textContent=project.client?`${t().client}: ${project.client}`:'';
 }
 function cards(){
  const units=getUnits();
  $('showUnits').innerHTML=units.map(u=>{let s;try{s=unitSummary(u)}catch{return ''}
   return `<article class="show-card${u.id===getSelected()?' active':''}" data-unit="${esc(u.id)}" tabindex="0"><span class="sw" style="background:${finishColor(u.finish)}"></span><div class="show-card-text"><b>${esc(u.name)}</b><small>${s.width} × ${s.height} × ${s.depth} ${t().mm} · ${esc(finishName(u.finish))}</small><small>${esc(featureText(s,lang()))}</small></div>
   <div class="show-switches"><label class="switch"><input type="checkbox" data-toggle="open" ${display.open.has(u.id)?'checked':''}><span>${t().open}</span></label><label class="switch"><input type="checkbox" data-toggle="led" ${display.led.has(u.id)?'checked':''}><span>${t().led}</span></label></div></article>`}).join('');
  $('showUnits').querySelectorAll('.show-card').forEach(card=>{
   const unit=()=>getUnits().find(u=>u.id===card.dataset.unit);
   card.addEventListener('click',event=>{if(event.target.closest('.switch'))return;select(card.dataset.unit);cards();unitView(unit())});
   card.addEventListener('keydown',event=>{if(event.key==='Enter'){select(card.dataset.unit);cards();unitView(unit())}});
   card.querySelectorAll('[data-toggle]').forEach(input=>input.addEventListener('change',()=>{
    const set=display[input.dataset.toggle];input.checked?set.add(card.dataset.unit):set.delete(card.dataset.unit);
    if(input.dataset.toggle==='led')renderScene();
   }));
  });
  for(const button of root.querySelectorAll('[data-show-label]'))button.textContent=t()[button.dataset.showLabel];
  $('showNight').textContent=display.night?t().day:t().night;$('showOpenAll').textContent=display.open.size===units.length?t().closeAll:t().openAll;
 }
 function enter(){
  display.stage='studio';applyStage();renderScene();brand();cards();overview();
 }
 function leave(){
  display.stage='workshop';display.night=false;display.open.clear();display.led.clear();controls.autoRotate=false;applyStage();renderScene();
 }
 $('showOverview').onclick=overview;$('showFront').onclick=frontView;$('showTop').onclick=topView;
 $('showNight').onclick=()=>{display.night=!display.night;applyStage();renderScene();cards()};
 $('showOpenAll').onclick=()=>{const units=getUnits();if(display.open.size===units.length)display.open.clear();else units.forEach(u=>display.open.add(u.id));cards()};
 $('showLights').onclick=()=>{const units=getUnits();if(display.led.size===units.length)display.led.clear();else units.forEach(u=>display.led.add(u.id));renderScene();cards()};
 $('showRotate').onclick=()=>{controls.autoRotate=!controls.autoRotate;controls.autoRotateSpeed=0.8;$('showRotate').setAttribute('aria-pressed',String(controls.autoRotate))};

 async function capture(){
  const renderer=getRenderer();if(!renderer)throw Error('3D view unavailable');
  const savedP=camera.position.clone(),savedT=controls.target.clone(),savedOpen=new Set(display.open),savedAspect=camera.aspect,canvas=renderer.domElement;
  const size=new THREE.Vector2();renderer.getSize(size);renderer.setSize(1600,1000,false);camera.aspect=1.6;camera.updateProjectionMatrix();
  const shot=()=>{renderer.render(scene,camera);return canvas.toDataURL('image/jpeg',0.86)};
  const place=(p,tgt)=>{camera.position.copy(p);controls.target.copy(tgt);camera.lookAt(tgt);controls.update()};
  const images={};
  try{
   place(...overviewPose());images.overview=shot();
   {const {w,d}=roomBox();place(new THREE.Vector3(0,Math.max(w,d)*1.35,1),new THREE.Vector3(0,0,0));images.top=shot()}
   for(const unit of getUnits()){
    ctx.setWalls(false);place(...unitPose(unit));
    display.open.delete(unit.id);ctx.setOpenAmount(unit.id,0);images[unit.id]=shot();
    if(ctx.hasFronts(unit.id)){display.open.add(unit.id);ctx.setOpenAmount(unit.id,1);images[unit.id+':open']=shot();display.open.delete(unit.id);ctx.setOpenAmount(unit.id,0)}
   }
  }finally{
   ctx.setWalls(true);display.open=savedOpen;for(const u of getUnits())ctx.setOpenAmount(u.id,savedOpen.has(u.id)?1:0);
   renderer.setSize(size.x,size.y,false);camera.aspect=savedAspect;camera.updateProjectionMatrix();place(savedP,savedT);
  }
  return images;
 }
 $('clientPdf').onclick=async()=>{
  const w=window.open('','_blank');if(!w){onError('Allow pop-ups to open the client proposal / اسمح بالنوافذ المنبثقة لفتح ملف العميل');return}
  try{
   const images=await capture();
   w.document.open();w.document.write(proposalHtml({company:getCompany(),project:getProject(),units:getUnits(),images,finishName,lang:lang(),room:ctx.getRoom()}));w.document.close();
   setTimeout(()=>{try{w.focus();w.print()}catch{}},600);
  }catch(error){w.close();onError(error.message)}
 };
 /** Room renders for the room sheet: switches to the client stage for the shots, then restores the view. */
 async function captureRoom(){
  const wasStage=display.stage;
  if(wasStage!=='studio'){display.stage='studio';applyStage();renderScene()}
  try{const renderer=getRenderer();if(!renderer)return {};const images=await captureViews();return images}
  finally{if(wasStage!=='studio'){display.stage=wasStage;applyStage();renderScene()}}
 }
 async function captureViews(){
  const renderer=getRenderer(),savedP=camera.position.clone(),savedT=controls.target.clone(),savedAspect=camera.aspect,canvas=renderer.domElement;
  const size=new THREE.Vector2();renderer.getSize(size);renderer.setSize(1600,1000,false);camera.aspect=1.6;camera.updateProjectionMatrix();
  const shot=()=>{renderer.render(scene,camera);return canvas.toDataURL('image/jpeg',0.86)};
  const place=(p,tgt)=>{camera.position.copy(p);controls.target.copy(tgt);camera.lookAt(tgt);controls.update()};
  try{const images={};place(...overviewPose());images.overview=shot();const {w,d}=roomBox();place(new THREE.Vector3(0,Math.max(w,d)*1.35,1),new THREE.Vector3(0,0,0));images.top=shot();return images}
  finally{renderer.setSize(size.x,size.y,false);camera.aspect=savedAspect;camera.updateProjectionMatrix();place(savedP,savedT)}
 }
 return {captureRoom,enter,leave,refresh(){if(!root.classList.contains('hidden')){brand();cards()}},update(now){flight?.update(now)},get flying(){return Boolean(flight)}};
}
