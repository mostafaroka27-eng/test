import {cabinet} from './engine.mjs';
import {partSize} from './geometry.mjs';
import {companyName,companyContact} from './company.mjs';
import {finishColor} from './reference-catalog.mjs';

/**
 * A3 landscape shop drawing for one unit, drawn at a true standard scale (millimetres on paper).
 * Every line comes from cabinet(): elevations, a section through the first bay, a plan, a parts
 * schedule and a title block. Preliminary: it does not define drilling, tolerances or approval.
 */
export const SHEET={width:420,height:297,margin:10};
export const SCALES=[5,10,15,20,25,30,40,50,75,100];
const xml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[char]));
const r=n=>Math.round(n*100)/100;
const mm=n=>Number.isInteger(n)?String(n):String(Math.round(n*10)/10);

const T={
 en:{front:'A · FRONT ELEVATION',interior:'B · INTERIOR (DOORS REMOVED)',section:'C · SECTION THROUGH BAY 1',plan:'D · PLAN',schedule:'PARTS SCHEDULE',notes:'NOTES',
  part:'Part',qty:'Qty',L:'L',W:'W',T:'T',material:'Material',edges:'Edges L1W1L2W2',project:'Project',client:'Client',drawing:'Drawing',unit:'Unit',scale:'Scale',sheet:'Sheet',rev:'Rev',date:'Date',
  units:'All dimensions in mm',status:'PRELIMINARY · NOT FOR FABRICATION OR CNC',verify:'Verify all dimensions on site before cutting.',more:n=>`+${n} more rows — see cutting list CSV`,
  finish:'Finish',carcass:'Carcass',back:'Back',edgeBand:'Edge band',rules:'Rules',front_:'FRONT',rail:'rail',interiorH:'interior',plinth:'plinth',noCompany:'Set company name and logo in Settings',
  kinds:{side:'Side',top:'Top',bottom:'Bottom',back:'Back',shelf:'Shelf',fixedShelf:'Fixed shelf',partition:'Partition',door:'Door',drawerFront:'Drawer front',drawerFace:'Drawer front',drawerSide:'Drawer side',drawerBack:'Drawer back',drawerBottom:'Drawer bottom',plinth:'Plinth'}},
 ar:{front:'أ · الواجهة الأمامية',interior:'ب · الداخل (بدون أبواب)',section:'ج · قطاع في الحجرة 1',plan:'د · المسقط الأفقي',schedule:'جدول القطع',notes:'ملاحظات',
  part:'القطعة',qty:'العدد',L:'الطول',W:'العرض',T:'السمك',material:'الخامة',edges:'الحواف L1W1L2W2',project:'المشروع',client:'العميل',drawing:'اللوحة',unit:'الوحدة',scale:'المقياس',sheet:'الورقة',rev:'الإصدار',date:'التاريخ',
  units:'جميع الأبعاد بالمليمتر',status:'مبدئي · غير معتمد للتصنيع أو CNC',verify:'تحقق من المقاسات في الموقع قبل القص.',more:n=>`+${n} صفوف أخرى — راجع ملف قائمة القص`,
  finish:'اللون',carcass:'الهيكل',back:'الظهر',edgeBand:'الشريط',rules:'القواعد',front_:'الأمام',rail:'تعليق',interiorH:'داخلي',plinth:'قاعدة',noCompany:'أضف اسم الشركة واللوجو من الإعدادات',
  kinds:{side:'جانب',top:'سقف',bottom:'أرضية',back:'ظهر',shelf:'رف',fixedShelf:'رف ثابت',partition:'قاطع',door:'باب',drawerFront:'وجه درج',drawerFace:'وجه درج',drawerSide:'جانب درج',drawerBack:'خلفية درج',drawerBottom:'قاع درج',plinth:'وزرة'}},
};

/**
 * View arrangement at the largest standard scale that fits the drawing area (230 × 250 mm):
 * row = A B C side by side with D under A; grid = A B on top, C D underneath (wide units).
 */
export function layoutViews(W,H,D){
 const options=[];
 for(const n of SCALES){
  const k=1/n;
  if((2*W+D)*k+70<=230&&(H+D)*k+48<=250){options.push({n,arrangement:'row',frontX:30,interiorX:30+W*k+26,sectionX:30+2*W*k+52,top:26,sectionTop:26,planX:30,planY:26+H*k+20});break}
 }
 for(const n of SCALES){
  const k=1/n;
  if(Math.max(2*W*k+26,D*k+30+W*k)+44<=230&&H*k+Math.max(H*k,D*k)+70<=250){options.push({n,arrangement:'grid',frontX:30,interiorX:30+W*k+26,sectionX:30,top:26,sectionTop:26+H*k+26,planX:30+D*k+30,planY:26+H*k+26});break}
 }
 if(!options.length)return {n:SCALES.at(-1),arrangement:'row',frontX:30,interiorX:30+W/SCALES.at(-1)+26,sectionX:30+2*W/SCALES.at(-1)+52,top:26,sectionTop:26,planX:30,planY:26+H/SCALES.at(-1)+20};
 return options.sort((a,b)=>a.n-b.n)[0];
}
export const chooseScale=(W,H,D)=>layoutViews(W,H,D).n;

function panels(model){
 return model.parts.map(part=>{const [x,y,z]=partSize(part);return {part,x:part.position.x,y:part.position.y,z:part.position.z,sx:x,sy:y,sz:z}});
}
const FACE=new Set(['door','drawerFront']);
const EXTERIOR=new Set(['side','top','bottom','plinth']);
const ARROW='M0,0 L-1.6,-0.7 L-1.6,0.7 Z';

function hDim(x1,x2,y,label,{ext1,ext2,size=2.2}={}){
 const e1=ext1===undefined?'':`<path d="M${r(x1)} ${r(ext1)}V${r(y+1.2)}"/>`,e2=ext2===undefined?'':`<path d="M${r(x2)} ${r(ext2)}V${r(y+1.2)}"/>`;
 return `<g class="dim">${e1}${e2}<path d="M${r(x1)} ${r(y)}H${r(x2)}"/><path d="M${r(x1-0.9)} ${r(y+0.9)}L${r(x1+0.9)} ${r(y-0.9)}M${r(x2-0.9)} ${r(y+0.9)}L${r(x2+0.9)} ${r(y-0.9)}"/><text x="${r((x1+x2)/2)}" y="${r(y-0.8)}" text-anchor="middle" font-size="${size}">${xml(label)}</text></g>`;
}
function vDim(x,y1,y2,label,{ext1,ext2,size=2.2}={}){
 const e1=ext1===undefined?'':`<path d="M${r(ext1)} ${r(y1)}H${r(x-1.2)}"/>`,e2=ext2===undefined?'':`<path d="M${r(ext2)} ${r(y2)}H${r(x-1.2)}"/>`;
 const cx=r(x-0.8),cy=r((y1+y2)/2);
 return `<g class="dim">${e1}${e2}<path d="M${r(x)} ${r(y1)}V${r(y2)}"/><path d="M${r(x-0.9)} ${r(y1+0.9)}L${r(x+0.9)} ${r(y1-0.9)}M${r(x-0.9)} ${r(y2+0.9)}L${r(x+0.9)} ${r(y2-0.9)}"/><text x="${cx}" y="${cy}" text-anchor="middle" font-size="${size}" transform="rotate(-90 ${cx} ${cy})">${xml(label)}</text></g>`;
}

/** Grouped parts schedule rows (identical kind, size, material and edges are counted together). */
export function partsSchedule(model,lang='en'){
 const t=T[lang]||T.en,groups=new Map();
 for(const p of model.parts){
  const edges=(p.edges||[]).map(e=>e?1:0).join('');
  const key=[p.kind,p.length,p.width,p.thickness,p.material,edges].join('|');
  const row=groups.get(key)||{kind:p.kind,name:t.kinds[p.kind]||p.kind,qty:0,length:p.length,width:p.width,thickness:p.thickness,material:p.material,edges,ids:[]};
  row.qty++;row.ids.push(p.id);groups.set(key,row);
 }
 return [...groups.values()];
}

export function shopDrawingSvg(unit,{company={},project={},lang='en',sheetNumber=1,sheetCount=1,date=new Date().toISOString().slice(0,10)}={}){
 if(!unit||typeof unit.id!=='string'||typeof unit.name!=='string'||!unit.config)throw Error('A cabinet with ID, name and configuration is required');
 const t=T[lang]||T.en,rtl=lang==='ar';
 const model=cabinet(unit.config,unit.id),{width:W,height:H,depth:D}=model.dimensions,c=model.config??unit.config;
 const L=layoutViews(W,H,D),n=L.n,k=1/n,all=panels(model);
 const {top,frontX,interiorX,sectionX,sectionTop,planX,planY}=L;
 const plinth=unit.config.plinthHeight||0;
 // Sheet coordinates: X right, Y down. Model: X centred, Y up from floor, Z towards the front (+D/2).
 const fx=(ox,x)=>ox+(x+W/2)*k, fy=y=>top+(H-y)*k;
 const rect=(x,y,w,h,cls,extra='')=>`<rect x="${r(x)}" y="${r(y)}" width="${r(Math.max(w,0.05))}" height="${r(Math.max(h,0.05))}" class="${cls}"${extra}/>`;
 const finish=finishColor(unit.finish);
 const doors=all.filter(p=>p.part.kind==='door'),doorCount=doors.length;

 // A — front elevation with fronts closed, hinge-side swing marks and handles.
 // With doors only the carcass outline and fronts are visible; open units also show shelves, partitions and box fronts.
 const carcass=all.filter(p=>doorCount?EXTERIOR.has(p.part.kind):!FACE.has(p.part.kind)&&!['drawerSide','drawerBack','drawerBottom','back'].includes(p.part.kind)&&!(p.part.kind==='drawerFace'&&all.some(q=>q.part.kind==='drawerFront'&&q.part.bay===p.part.bay&&q.part.slot===p.part.slot)));
 const frontEl=[...carcass,...all.filter(p=>FACE.has(p.part.kind))].map(p=>{
  const x=fx(frontX,p.x-p.sx/2),y=fy(p.y+p.sy/2),w=p.sx*k,h=p.sy*k,face=FACE.has(p.part.kind);
  let extra='';
  if(p.part.kind==='door'){
   const index=doors.indexOf(p),hingeLeft=doorCount===1||index<doorCount/2;
   const hx=hingeLeft?x:x+w,ox=hingeLeft?x+w:x;
   extra=`<path class="swing" d="M${r(ox)} ${r(y)}L${r(hx)} ${r(y+h/2)}L${r(ox)} ${r(y+h)}"/><path class="handle" d="M${r(ox+(hingeLeft?-2.2:2.2))} ${r(y+h/2-4)}v8"/>`;
  }else if(face)extra=`<path class="handle" d="M${r(x+w/2-3)} ${r(y+Math.min(2.2,h/3))}h6"/>`;
  const glass=p.part.sheetGood===false;
  return `<g data-part="${xml(p.part.id)}" data-kind="${xml(p.part.kind)}">${rect(x,y,w,h,face?(glass?'glass':'front'):'panel',face&&!glass?` style="fill:${finish};fill-opacity:.28"`:'')}${extra}</g>`;
 }).join('');

 // B — interior elevation: carcass + contents, levels and bay widths from the same model.
 const behind=all.filter(p=>p.part.kind==='back');
 const contents=all.filter(p=>!FACE.has(p.part.kind));
 const interiorEl=[...behind,...contents.filter(p=>p.part.kind!=='back')].map(p=>{
  const x=fx(interiorX,p.x-p.sx/2),y=fy(p.y+p.sy/2);
  return `<g data-part="${xml(p.part.id)}" data-kind="${xml(p.part.kind)}">${rect(x,y,p.sx*k,p.sy*k,p.part.kind==='back'?'back':p.part.kind==='drawerFace'?'front':'panel')}</g>`;
 }).join('');
 const floorY=model.internal.floorY,ceilY=model.internal.ceilY;
 const rails=model.accessories.filter(a=>a.kind==='hangingRail').map(a=>{const x1=fx(interiorX,a.position.x-a.length/2),x2=fx(interiorX,a.position.x+a.length/2),y=fy(a.position.y);return `<path class="rail" d="M${r(x1)} ${r(y)}H${r(x2)}"/><text x="${r(x1+1)}" y="${r(y+2.2)}" font-size="1.7" class="note-text">${t.rail} ${mm(r(a.position.y-floorY))}</text>`}).join('');
 const levels=(model.bays??[]).map(bay=>bay.shelfLevels.map(level=>{const x=fx(interiorX,bay.x-bay.innerWidth/2)+0.8,y=fy(floorY+level)-0.6;return `<text x="${r(x)}" y="${r(y)}" font-size="1.7" class="level">▾${mm(level)}</text>`}).join('')).join('');
 const bayChain=(model.bays??[]).map(bay=>hDim(fx(interiorX,bay.x-bay.innerWidth/2),fx(interiorX,bay.x+bay.innerWidth/2),top+H*k+6,mm(bay.innerWidth),{ext1:fy(floorY),ext2:fy(floorY),size:1.9})).join('');
 const vChain=[];
 const rightX=interiorX+W*k+5;
 if(plinth>0)vChain.push(vDim(rightX,fy(plinth),fy(0),mm(plinth),{size:1.8}));
 vChain.push(vDim(rightX,fy(ceilY),fy(floorY),`${mm(r(ceilY-floorY))} ${t.interiorH}`,{size:1.8}));

 // C — section through the first bay centre (cut panels solid, panels beyond in outline).
 const cutX=(model.bays?.[0]?.x)??0,sx=z=>sectionX+(D/2-z)*k,sy=y=>sectionTop+(H-y)*k;
 const section=all.filter(p=>!['door'].includes(p.part.kind)||true).map(p=>{
  const cut=Math.abs(p.x-cutX)<=p.sx/2+1e-6;
  if(!cut&&!['side'].includes(p.part.kind))return '';
  const x=sx(p.z+p.sz/2),y=sy(p.y+p.sy/2);
  return `<g data-part="${xml(p.part.id)}" data-kind="${xml(p.part.kind)}">${rect(x,y,p.sz*k,p.sy*k,cut?(p.part.sheetGood===false?'glass':'cut'):'beyond')}</g>`;
 }).join('');

 // D — plan (top view): front at the bottom.
 const py=z=>planY+(D/2-z)*k;
 const plan=all.filter(p=>!['drawerSide','drawerBack','drawerBottom','shelf','fixedShelf'].includes(p.part.kind)).map(p=>`<g data-kind="${xml(p.part.kind)}">${rect(fx(planX,p.x-p.sx/2),py(p.z+p.sz/2),p.sx*k,p.sz*k,FACE.has(p.part.kind)?'front':p.part.kind==='back'?'back':'panel')}</g>`).join('');

 // Dimensions.
 const doorChain=doors.length>1?doors.map(p=>hDim(fx(frontX,p.x-p.sx/2),fx(frontX,p.x+p.sx/2),top+H*k+6,mm(p.sx),{size:1.8})).join(''):'';
 const dims=[
  doorChain,
  hDim(fx(frontX,-W/2),fx(frontX,W/2),top+H*k+(doorChain?11:6),mm(W),{ext1:top+H*k+0.8,ext2:top+H*k+0.8}),
  vDim(frontX-6,fy(H),fy(0),mm(H),{ext1:frontX-0.8,ext2:frontX-0.8}),
  plinth>0?vDim(frontX-2.5,fy(plinth),fy(0),mm(plinth),{size:1.8}):'',
  hDim(sx(D/2),sx(-D/2),sectionTop+H*k+6,mm(D),{ext1:sectionTop+H*k+0.8,ext2:sectionTop+H*k+0.8}),
  vDim(planX-6,py(D/2),py(-D/2),mm(D),{ext1:planX-0.8,ext2:planX-0.8}),
  hDim(fx(planX,-W/2),fx(planX,W/2),py(-D/2)+5,mm(W)),
  bayChain,...vChain,
 ].join('');

 const label=(x,y,text)=>`<text x="${r(x)}" y="${r(y)}" class="view-title">${xml(text)}</text><text x="${r(x)}" y="${r(y+3)}" class="view-scale">1:${n}</text>`;
 const views=`${label(frontX,top-6,t.front)}${label(interiorX,top-6,t.interior)}${label(sectionX,sectionTop-6,t.section)}${label(planX,planY-6,t.plan)}
  <g data-view="front">${frontEl}</g><g data-view="interior">${interiorEl}${rails}${levels}</g><g data-view="section">${section}<text x="${r(sx(D/2))}" y="${r(sy(0)+3)}" font-size="1.7" class="note-text">← ${t.front_}</text></g><g data-view="plan">${plan}<text x="${r(fx(planX,0))}" y="${r(py(-D/2)+2.4)}" font-size="1.6" text-anchor="middle" class="note-text">${t.front_}</text></g>${dims}`;

 // Right column: schedule, notes, title block.
 const colX=272,colW=SHEET.width-SHEET.margin-colX;
 const rows=partsSchedule(model,lang),rowH=4,maxRows=24,shown=rows.slice(0,maxRows);
 const cols=rtl?[[colW-1,'part','end'],[colW-38,'qty','middle'],[colW-50,'L','start'],[colW-65,'W','start'],[colW-78,'T','start'],[colW-101,'material','start'],[1,'edges','start']]:[[1,'part','start'],[38,'qty','middle'],[55,'L','end'],[70,'W','end'],[80,'T','end'],[84,'material','start'],[colW-1,'edges','end']];
 const head=cols.map(([x,key,anchor])=>`<text x="${r(colX+x)}" y="${r(SHEET.margin+9.6)}" text-anchor="${anchor}" class="th">${xml(t[key])}</text>`).join('');
 const body=shown.map((row,i)=>{const y=SHEET.margin+14+i*rowH,values={part:row.name,qty:row.qty,L:mm(row.length),W:mm(row.width),T:mm(row.thickness),material:String(row.material).slice(0,18),edges:row.edges};
  return `${i%2?`<rect x="${colX}" y="${r(y-2.9)}" width="${colW}" height="${rowH}" class="zebra"/>`:''}${cols.map(([x,key,anchor])=>`<text x="${r(colX+x)}" y="${r(y)}" text-anchor="${anchor}" class="td">${xml(values[key])}</text>`).join('')}`}).join('');
 const tableBottom=SHEET.margin+14+shown.length*rowH;
 const overflow=rows.length>maxRows?`<text x="${colX+1}" y="${r(tableBottom)}" class="td note-text">${xml(t.more(rows.length-maxRows))}</text>`:'';
 const notesY=Math.max(tableBottom+6,150);
 const doorMaterial=c.doorMaterial&&c.doorMaterial!=='inherit'?c.doorMaterial:unit.config.material;
 const notes=[
  `${t.carcass}: ${unit.config.material} · ${t.back}: ${unit.config.backMaterial||''} ${unit.config.backThickness??''} mm`,
  `${t.edgeBand}: ${unit.config.edgeType||'PVC'} ${unit.config.edgeThickness} mm${unit.config.doorEdgeThickness?` · ${t.kinds.door} ${unit.config.doorEdgeThickness} mm`:''} · ${t.kinds.door}: ${doorMaterial}`,
  `${t.rules}: ${model.rules?.version??unit.config.rulesVersion??'legacy'} · ${model.parts.length} ${lang==='ar'?'قطعة':'parts'}`,
  ...model.warnings.slice(0,3).map(w=>`⚠ ${w.message}`),
  t.units,t.verify,
 ];
 const noteText=notes.map((line,i)=>`<text x="${rtl?colX+colW-1:colX+1}" y="${r(notesY+5+i*3.6)}" class="td"${rtl?' direction="rtl"':''}>${xml(String(line).slice(0,95))}</text>`).join('');
 const swatchX=rtl?colX+1:colX+colW-12;
 const swatch=`<rect x="${swatchX}" y="${notesY-3.2}" width="11" height="5" rx="0.8" style="fill:${finish}" class="swatch"/><text x="${rtl?swatchX+12:swatchX-1}" y="${notesY+0.6}" text-anchor="${rtl?'start':'end'}" class="td">${t.finish}</text>`;

 const tbY=225,tbH=SHEET.height-SHEET.margin-tbY,name=companyName(company,lang),contact=companyContact(company);
 const logo=company.logo?`<image href="${xml(company.logo)}" x="${colX+2}" y="${tbY+2}" width="30" height="20" preserveAspectRatio="xMidYMid meet"/>`:'';
 const nameX=company.logo?colX+35:colX+2;
 const identity=name?`<text x="${rtl?colX+colW-2:nameX}" y="${tbY+9}" class="company"${rtl?' direction="rtl"':''}>${xml(name)}</text>${company.tagline?`<text x="${nameX}" y="${tbY+13.5}" class="td">${xml(company.tagline)}</text>`:''}${contact?`<text x="${nameX}" y="${tbY+18}" class="td">${xml(contact)}</text>`:''}${company.address?`<text x="${nameX}" y="${tbY+21.5}" class="td">${xml(company.address)}</text>`:''}`
  :`<text x="${nameX}" y="${tbY+12}" class="td note-text">${xml(t.noCompany)}</text>`;
 const field=(x,y,w,key,value)=>`<rect x="${r(x)}" y="${r(y)}" width="${r(w)}" height="9" class="cell"/><text x="${r(x+1)}" y="${r(y+3)}" class="cell-key">${xml(t[key])}</text><text x="${r(x+1)}" y="${r(y+7.4)}" class="cell-val">${xml(value)}</text>`;
 const fw=colW/4;
 const titleBlock=`<g class="title-block"><rect x="${colX}" y="${tbY}" width="${colW}" height="${tbH}" class="frame"/>${logo}${identity}
  ${field(colX,tbY+24,colW/2,'project',(project.name||project.id||'—').slice(0,40))}${field(colX+colW/2,tbY+24,colW/2,'client',(project.client||'—').slice(0,40))}
  ${field(colX,tbY+33,colW/2,'unit',`${unit.id} · ${unit.name}`.slice(0,40))}${field(colX+colW/2,tbY+33,colW/2,'drawing',`SD-${unit.id}`)}
  ${field(colX,tbY+42,fw,'scale',`1:${n} @ A3`)}${field(colX+fw,tbY+42,fw,'sheet',`${sheetNumber}/${sheetCount}`)}${field(colX+2*fw,tbY+42,fw,'rev',String(project.revision??1))}${field(colX+3*fw,tbY+42,fw,'date',date)}
  <text x="${colX+colW/2}" y="${tbY+tbH-2}" text-anchor="middle" class="status">${xml(t.status)}</text></g>`;

 return `<svg xmlns="http://www.w3.org/2000/svg" width="420mm" height="297mm" viewBox="0 0 ${SHEET.width} ${SHEET.height}" role="img" aria-label="${xml(`${unit.id} ${unit.name} shop drawing`)}" data-scale="${n}" data-arrangement="${L.arrangement}" lang="${lang}">
<title>${xml(unit.name)} — shop drawing 1:${n}</title>
<style>
text{font-family:"IBM Plex Sans Arabic","IBM Plex Sans",Arial,sans-serif;fill:#263746}
.frame{fill:none;stroke:#172B3A;stroke-width:.5}.panel{fill:#f3ede4;stroke:#263746;stroke-width:.22}.front{fill:#f7f9fa;stroke:#0B7375;stroke-width:.3}
.back{fill:#eef2f3;stroke:#8F99A4;stroke-width:.15}.glass{fill:#d6eef3;fill-opacity:.55;stroke:#3979C3;stroke-width:.22}.cut{fill:#9aa7b2;stroke:#172B3A;stroke-width:.25}
.beyond{fill:none;stroke:#8F99A4;stroke-width:.15;stroke-dasharray:1 .6}.swing{fill:none;stroke:#0B7375;stroke-width:.15;stroke-dasharray:1.2 .8}.handle{stroke:#172B3A;stroke-width:.6;stroke-linecap:round}
.rail{stroke:#6B7785;stroke-width:.7}.dim path{stroke:#3979C3;stroke-width:.15;fill:none}.dim text{fill:#1f4f8a}
.view-title{font-size:3px;font-weight:700;fill:#172B3A}.view-scale{font-size:1.9px;fill:#6B7785}.level{fill:#a24c2c}.note-text{fill:#6B7785}
.th{font-size:2px;font-weight:700;fill:#172B3A}.td{font-size:1.9px}.zebra{fill:#F6F8FA}.cell{fill:none;stroke:#D2DAE2;stroke-width:.2}.cell-key{font-size:1.6px;fill:#6B7785}.cell-val{font-size:2.3px;font-weight:600}
.company{font-size:4.2px;font-weight:700;fill:#172B3A}.status{font-size:1.9px;font-weight:700;fill:#a24c2c}.swatch{stroke:#263746;stroke-width:.15}
</style>
<rect width="${SHEET.width}" height="${SHEET.height}" fill="#fff"/>
<rect x="${SHEET.margin}" y="${SHEET.margin}" width="${SHEET.width-2*SHEET.margin}" height="${SHEET.height-2*SHEET.margin}" class="frame"/>
<path d="M${colX-3} ${SHEET.margin}V${SHEET.height-SHEET.margin}" class="frame" style="stroke-width:.25"/>
<text x="${rtl?colX+colW:colX}" y="${SHEET.margin+5}" class="view-title"${rtl?' direction="rtl"':''}>${xml(t.schedule)}</text>${head}<path d="M${colX} ${SHEET.margin+11}h${colW}" class="frame" style="stroke-width:.2"/>${body}${overflow}
<text x="${rtl?colX+colW:colX}" y="${r(notesY)}" class="view-title"${rtl?' direction="rtl"':''}>${xml(t.notes)}</text>${swatch}${noteText}
${titleBlock}
<g data-views="all">${views}</g>
</svg>`;
}

/** Printable HTML: one A3 landscape sheet per unit, for the browser's Save as PDF. */
export function drawingSetHtml(units,options={}){
 if(!Array.isArray(units)||!units.length)throw Error('No units to draw');
 const lang=options.lang||'en';
 const sheets=units.map((unit,i)=>`<section class="sheet">${shopDrawingSvg(unit,{...options,sheetNumber:i+1,sheetCount:units.length})}</section>`).join('');
 return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><title>${xml(options.project?.name||options.project?.id||'Shop drawings')} — shop drawings</title>
<style>@page{size:A3 landscape;margin:0}html,body{margin:0;background:#e9edf0}.sheet{width:420mm;height:297mm;margin:0 auto 8mm;background:#fff;page-break-after:always;break-after:page}.sheet svg{display:block;width:420mm;height:297mm}
@media print{html,body{background:#fff}.sheet{margin:0}}</style></head><body>${sheets}</body></html>`;
}
