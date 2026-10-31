import {cabinet} from './engine.mjs';
import {partSize} from './geometry.mjs';
import {companyName,companyContact} from './company.mjs';
import {finishColor} from './reference-catalog.mjs';
import {accessoryName} from './accessories.mjs';

/**
 * A3 landscape shop drawing for one unit, drawn at a true standard scale (millimetres on paper).
 * Every line comes from cabinet(): elevations, a section through the first bay, a plan, a parts
 * schedule and a title block. Preliminary: it does not define drilling, tolerances or approval.
 */
export const SHEET={width:420,height:297,margin:10};
export const PAPERS=Object.freeze({A3:{width:420,height:297,column:138,rows:24},A4:{width:297,height:210,column:112,rows:16}});
export const SCALES=[5,10,15,20,25,30,40,50,75,100];
export const VIEWS=Object.freeze(['front','interior','section','plan']);
export const ARRANGEMENTS=Object.freeze(['auto','row','grid','column']);
/** Sheet layout chosen by the user; stored in the project file. Defaults reproduce the 1.5 A3 sheet. */
export const DEFAULT_LAYOUT=Object.freeze({paper:'A3',views:VIEWS,arrangement:'auto',scale:'auto',schedule:true,notes:true,side:'right',dims:'full'});
export function normalLayout(input={}){
 if(input===null||typeof input!=='object'||Array.isArray(input))throw Error('Invalid drawing layout');
 const l={...DEFAULT_LAYOUT,...input};
 if(!PAPERS[l.paper])throw Error('Paper must be A3 or A4');
 if(!Array.isArray(l.views)||!l.views.length||l.views.some(v=>!VIEWS.includes(v)))throw Error('Choose at least one drawing view');
 if(!ARRANGEMENTS.includes(l.arrangement))throw Error('Unknown view arrangement');
 if(l.scale!=='auto'&&!SCALES.includes(l.scale))throw Error('Unsupported drawing scale');
 if(typeof l.schedule!=='boolean'||typeof l.notes!=='boolean')throw Error('Invalid drawing layout');
 if(!['right','left'].includes(l.side)||!['full','overall'].includes(l.dims))throw Error('Invalid drawing layout');
 return {paper:l.paper,views:VIEWS.filter(v=>l.views.includes(v)),arrangement:l.arrangement,scale:l.scale,schedule:l.schedule,notes:l.notes,side:l.side,dims:l.dims};
}
/** True when a layout differs from the default and must be saved. */
export const isDefaultLayout=l=>JSON.stringify(normalLayout(l))===JSON.stringify(normalLayout());
export const MAX_DRAWING_IMAGES=4;
export const MAX_DRAWING_IMAGE_BYTES=300*1024;
/** Clarification photos/sketches attached to a unit's drawing: {src: data URL, caption}. */
export function validateDrawingImages(list){
 if(!Array.isArray(list)||list.length>MAX_DRAWING_IMAGES)throw Error(`Up to ${MAX_DRAWING_IMAGES} drawing images per unit`);
 return list.map(item=>{
  if(item===null||typeof item!=='object'||typeof item.src!=='string'||!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(item.src))throw Error('Drawing images must be PNG, JPEG or WebP');
  if(item.src.length>MAX_DRAWING_IMAGE_BYTES*4/3+40)throw Error('Drawing image is larger than 300 KB');
  const caption=item.caption===undefined?'':item.caption;
  if(typeof caption!=='string'||caption.length>160)throw Error('Image caption must be up to 160 characters');
  return {src:item.src,caption};
 });
}
const xml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[char]));
const r=n=>Math.round(n*100)/100;
const mm=n=>Number.isInteger(n)?String(n):String(Math.round(n*10)/10);

const T={
 en:{front:'A · FRONT ELEVATION',interior:'B · INTERIOR (DOORS REMOVED)',section:'C · SECTION THROUGH BAY 1',plan:'D · PLAN',schedule:'PARTS SCHEDULE',notes:'NOTES',
  part:'Part',qty:'Qty',L:'L',W:'W',T:'T',material:'Material',edges:'Edges L1W1L2W2',project:'Project',client:'Client',drawing:'Drawing',unit:'Unit',scale:'Scale',sheet:'Sheet',rev:'Rev',date:'Date',
  units:'All dimensions in mm',status:'PRELIMINARY · NOT FOR FABRICATION OR CNC',verify:'Verify all dimensions on site before cutting.',more:n=>`+${n} more rows — see cutting list CSV`,
  finish:'Finish',carcass:'Carcass',back:'Back',edgeBand:'Edge band',rules:'Rules',front_:'FRONT',rail:'rail',interiorH:'interior',plinth:'plinth',noCompany:'Set company name and logo in Settings',
  kinds:{side:'Side',top:'Top',bottom:'Bottom',back:'Back',shelf:'Shelf',fixedShelf:'Fixed shelf',partition:'Partition',door:'Door',drawerFront:'Drawer front',drawerFace:'Drawer front',drawerSide:'Drawer side',drawerBack:'Drawer back',drawerBottom:'Drawer bottom',plinth:'Plinth',endPanel:'Cover panel',topFiller:'Top filler',worktop:'Worktop'},
  glass:'Glass',handle:'Handle',handles:{bar:'bar',knob:'knob',profile:'edge profile',none:'none · push to open'},led:'LED',details:'DETAILS & CLARIFICATIONS',detailSheet:'Details',scaleAdjusted:n=>`Chosen scale does not fit; drawn at 1:${n}`}, 
 ar:{front:'أ · الواجهة الأمامية',interior:'ب · الداخل (بدون أبواب)',section:'ج · قطاع في الحجرة 1',plan:'د · المسقط الأفقي',schedule:'جدول القطع',notes:'ملاحظات',
  part:'القطعة',qty:'العدد',L:'الطول',W:'العرض',T:'السمك',material:'الخامة',edges:'الحواف L1W1L2W2',project:'المشروع',client:'العميل',drawing:'اللوحة',unit:'الوحدة',scale:'المقياس',sheet:'الورقة',rev:'الإصدار',date:'التاريخ',
  units:'جميع الأبعاد بالمليمتر',status:'مبدئي · غير معتمد للتصنيع أو CNC',verify:'تحقق من المقاسات في الموقع قبل القص.',more:n=>`+${n} صفوف أخرى — راجع ملف قائمة القص`,
  finish:'اللون',carcass:'الهيكل',back:'الظهر',edgeBand:'الشريط',rules:'القواعد',front_:'الأمام',rail:'تعليق',interiorH:'داخلي',plinth:'قاعدة',noCompany:'أضف اسم الشركة واللوجو من الإعدادات',
  kinds:{side:'جانب',top:'سقف',bottom:'أرضية',back:'ظهر',shelf:'رف',fixedShelf:'رف ثابت',partition:'قاطع',door:'باب',drawerFront:'وجه درج',drawerFace:'وجه درج',drawerSide:'جانب درج',drawerBack:'خلفية درج',drawerBottom:'قاع درج',plinth:'وزرة',endPanel:'جنب تغطية',topFiller:'سكرتنج علوي',worktop:'رخامة'},
  glass:'الزجاج',handle:'المقبض',handles:{bar:'طولي',knob:'زرار',profile:'بروفيل حافة',none:'بدون · ضغط للفتح'},led:'LED',details:'تفاصيل وتوضيحات',detailSheet:'تفاصيل',scaleAdjusted:n=>`المقياس المختار لا يكفي؛ الرسم بمقياس 1:${n}`},
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

/**
 * Places the chosen views inside a drawing area at the largest standard scale that fits.
 * Full view sets in row/grid use the same formulas as layoutViews, so default sheets are unchanged;
 * other selections use a gap-based placement (26 mm between views, room for dimensions).
 */
export function planLayout(W,H,D,layout=DEFAULT_LAYOUT,area={x0:30,y0:26,width:230,height:250}){
 const l=normalLayout(layout),{x0,y0,width:BW,height:BH}=area,full=l.views.length===4,hasPlan=l.views.includes('plan');
 const size={front:[W,H],interior:[W,H],section:[D,H],plan:[W,D]};
 const place=(arrangement,n)=>{
  const k=1/n,pos={};
  if(full&&arrangement==='row')return {fits:(2*W+D)*k+70<=BW&&(H+D)*k+48<=BH,pos:{front:[x0,y0],interior:[x0+W*k+26,y0],section:[x0+2*W*k+52,y0],plan:[x0,y0+H*k+20]}};
  if(full&&arrangement==='grid')return {fits:Math.max(2*W*k+26,D*k+30+W*k)+44<=BW&&H*k+Math.max(H*k,D*k)+70<=BH,pos:{front:[x0,y0],interior:[x0+W*k+26,y0],section:[x0,y0+H*k+26],plan:[x0+D*k+30,y0+H*k+26]}};
  if(arrangement==='row'){
   const elev=l.views.filter(v=>v!=='plan');let x=x0;
   for(const v of elev){pos[v]=[x,y0];x+=size[v][0]*k+26}
   const rowW=elev.length?x-26-x0:0,rowH=elev.length?H*k:0;
   if(hasPlan)pos.plan=[x0,elev.length?y0+rowH+20:y0];
   const w=Math.max(rowW,hasPlan?W*k:0)+18,h=rowH+(hasPlan?(elev.length?20:0)+D*k:0)+28;
   return {fits:w<=BW&&h<=BH,pos};
  }
  let y=y0,w=0;
  if(arrangement==='grid'){
   for(let i=0;i<l.views.length;i+=2){
    const a=l.views[i],b=l.views[i+1];pos[a]=[x0,y];let rowW=size[a][0]*k,rowH=size[a][1]*k;
    if(b){pos[b]=[x0+rowW+26,y];rowW+=26+size[b][0]*k;rowH=Math.max(rowH,size[b][1]*k)}
    w=Math.max(w,rowW);y+=rowH+26;
   }
   return {fits:w+44<=BW&&y-26-y0+44<=BH,pos};
  }
  for(const v of l.views){pos[v]=[x0,y];w=Math.max(w,size[v][0]*k);y+=size[v][1]*k+26}
  return {fits:w+44<=BW&&y-26-y0+30<=BH,pos};
 };
 const arrangements=l.arrangement==='auto'?['row','grid']:[l.arrangement];
 if(l.scale!=='auto')for(const a of arrangements){const p=place(a,l.scale);if(p.fits)return {n:l.scale,arrangement:a,pos:p.pos,fits:true,scaleAdjusted:false}}
 for(const n of SCALES)for(const a of arrangements){const p=place(a,n);if(p.fits)return {n,arrangement:a,pos:p.pos,fits:true,scaleAdjusted:l.scale!=='auto'}}
 const n=SCALES.at(-1);return {n,arrangement:arrangements[0],pos:place(arrangements[0],n).pos,fits:false,scaleAdjusted:l.scale!=='auto'&&l.scale!==n};
}

/** Paper, column and drawing-area geometry for a layout (A3 right-hand column = the 1.5 sheet). */
export function sheetFrame(layout=DEFAULT_LAYOUT){
 const l=normalLayout(layout),paper=PAPERS[l.paper],m=SHEET.margin,colW=paper.column;
 const colX=l.side==='right'?paper.width-m-colW:m+3;
 const areaLeft=l.side==='right'?m:colX+colW+3,areaRight=l.side==='right'?colX-3:paper.width-m;
 return {paper:l.paper,width:paper.width,height:paper.height,rows:paper.rows,colX,colW,separator:l.side==='right'?colX-3:colX+colW+3,
  area:{x0:areaLeft+20,y0:m+16,width:areaRight-areaLeft-29,height:paper.height-2*m-27},left:areaLeft,right:areaRight,tbY:paper.height-m-62};
}

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

const EXTRA=new Set(['endPanel','topFiller','worktop']);
const STYLE=`<style>
text{font-family:"IBM Plex Sans Arabic","IBM Plex Sans",Arial,sans-serif;fill:#263746}
.frame{fill:none;stroke:#172B3A;stroke-width:.5}.panel{fill:#f3ede4;stroke:#263746;stroke-width:.22}.front{fill:#f7f9fa;stroke:#0B7375;stroke-width:.3}
.back{fill:#eef2f3;stroke:#8F99A4;stroke-width:.15}.glass{fill:#d6eef3;fill-opacity:.55;stroke:#3979C3;stroke-width:.22}.cut{fill:#9aa7b2;stroke:#172B3A;stroke-width:.25}
.beyond{fill:none;stroke:#8F99A4;stroke-width:.15;stroke-dasharray:1 .6}.swing{fill:none;stroke:#0B7375;stroke-width:.15;stroke-dasharray:1.2 .8}.handle{stroke:#172B3A;stroke-width:.6;stroke-linecap:round}
.rail{stroke:#6B7785;stroke-width:.7}.dim path{stroke:#3979C3;stroke-width:.15;fill:none}.dim text{fill:#1f4f8a}
.view-title{font-size:3px;font-weight:700;fill:#172B3A}.view-scale{font-size:1.9px;fill:#6B7785}.level{fill:#a24c2c}.note-text{fill:#6B7785}
.th{font-size:2px;font-weight:700;fill:#172B3A}.td{font-size:1.9px}.zebra{fill:#F6F8FA}.cell{fill:none;stroke:#D2DAE2;stroke-width:.2}.cell-key{font-size:1.6px;fill:#6B7785}.cell-val{font-size:2.3px;font-weight:600}
.company{font-size:4.2px;font-weight:700;fill:#172B3A}.status{font-size:1.9px;font-weight:700;fill:#a24c2c}.swatch{stroke:#263746;stroke-width:.15}
</style>`;
const EXTRA_STYLE='<style>.worktop{fill:none;stroke:#6B7785;stroke-width:.25;stroke-dasharray:2 .8}.fitting{fill:#fff7e6;fill-opacity:.6;stroke:#b7791f;stroke-width:.18;stroke-dasharray:1 .5}.fitting.bad{stroke:#c0392b}.led{stroke:#e0a100;stroke-width:.6}.knob{fill:#172B3A}.photo-frame{fill:none;stroke:#D2DAE2;stroke-width:.3}</style>';

/** Title block, company identity and status line in the side column. */
function titleBlock({t,lang,company,project,unit,n,paper,sheetNumber,sheetCount,date,colX,colW,tbY,tbH,drawingNo}){
 const rtl=lang==='ar',name=companyName(company,lang),contact=companyContact(company);
 const logo=company.logo?`<image href="${xml(company.logo)}" x="${colX+2}" y="${tbY+2}" width="30" height="20" preserveAspectRatio="xMidYMid meet"/>`:'';
 const nameX=company.logo?colX+35:colX+2;
 const identity=name?`<text x="${rtl?colX+colW-2:nameX}" y="${tbY+9}" class="company"${rtl?' direction="rtl"':''}>${xml(name)}</text>${company.tagline?`<text x="${nameX}" y="${tbY+13.5}" class="td">${xml(company.tagline)}</text>`:''}${contact?`<text x="${nameX}" y="${tbY+18}" class="td">${xml(contact)}</text>`:''}${company.address?`<text x="${nameX}" y="${tbY+21.5}" class="td">${xml(company.address)}</text>`:''}`
  :`<text x="${nameX}" y="${tbY+12}" class="td note-text">${xml(t.noCompany)}</text>`;
 const field=(x,y,w,key,value)=>`<rect x="${r(x)}" y="${r(y)}" width="${r(w)}" height="9" class="cell"/><text x="${r(x+1)}" y="${r(y+3)}" class="cell-key">${xml(t[key])}</text><text x="${r(x+1)}" y="${r(y+7.4)}" class="cell-val">${xml(value)}</text>`;
 const fw=colW/4;
 return `<g class="title-block"><rect x="${colX}" y="${tbY}" width="${colW}" height="${tbH}" class="frame"/>${logo}${identity}
  ${field(colX,tbY+24,colW/2,'project',(project.name||project.id||'—').slice(0,40))}${field(colX+colW/2,tbY+24,colW/2,'client',(project.client||'—').slice(0,40))}
  ${field(colX,tbY+33,colW/2,'unit',`${unit.id} · ${unit.name}`.slice(0,40))}${field(colX+colW/2,tbY+33,colW/2,'drawing',drawingNo)}
  ${field(colX,tbY+42,fw,'scale',n?`1:${n} @ ${paper}`:paper)}${field(colX+fw,tbY+42,fw,'sheet',`${sheetNumber}/${sheetCount}`)}${field(colX+2*fw,tbY+42,fw,'rev',String(project.revision??1))}${field(colX+3*fw,tbY+42,fw,'date',date)}
  <text x="${colX+colW/2}" y="${tbY+tbH-2}" text-anchor="middle" class="status">${xml(t.status)}</text></g>`;
}

export function shopDrawingSvg(unit,{company={},project={},lang='en',sheetNumber=1,sheetCount=1,date=new Date().toISOString().slice(0,10),layout}={}){
 if(!unit||typeof unit.id!=='string'||typeof unit.name!=='string'||!unit.config)throw Error('A cabinet with ID, name and configuration is required');
 const t=T[lang]||T.en,rtl=lang==='ar',lay=normalLayout(layout??{}),F=sheetFrame(lay),show=new Set(lay.views);
 const model=cabinet(unit.config,unit.id),{width:W,height:H,depth:D}=model.dimensions,c=model.config??unit.config;
 const all=panels(model),extras=all.filter(p=>EXTRA.has(p.part.kind));
 // Cover panels, top filler and worktop widen/heighten the drawn envelope; without them it is the carcass.
 const minX=Math.min(-W/2,...extras.map(p=>p.x-p.sx/2)),maxX=Math.max(W/2,...extras.map(p=>p.x+p.sx/2));
 const Wv=maxX-minX,Hv=Math.max(H,...extras.map(p=>p.y+p.sy/2));
 const L=planLayout(Wv,Hv,D,lay,F.area),n=L.n,k=1/n,P=L.pos;
 const [frontX,frontTop]=P.front??[0,0],[interiorX,interiorTop]=P.interior??[0,0],[sectionX,sectionTop]=P.section??[0,0],[planX,planY]=P.plan??[0,0];
 const plinth=unit.config.plinthHeight||0,full=lay.dims==='full';
 // Sheet coordinates: X right, Y down. Model: X centred, Y up from floor, Z towards the front (+D/2).
 const fx=(ox,x)=>ox+(x-minX)*k,fyAt=top=>y=>top+(Hv-y)*k,fy=fyAt(frontTop),fyI=fyAt(interiorTop);
 const rect=(x,y,w,h,cls,extra='')=>`<rect x="${r(x)}" y="${r(y)}" width="${r(Math.max(w,0.05))}" height="${r(Math.max(h,0.05))}" class="${cls}"${extra}/>`;
 const finish=finishColor(unit.finish);
 const doors=all.filter(p=>p.part.kind==='door'),doorCount=doors.length,handleType=c.handleType??'bar';

 // A — front elevation with fronts closed, hinge-side swing marks and handles.
 const carcass=all.filter(p=>doorCount?EXTERIOR.has(p.part.kind)||EXTRA.has(p.part.kind):!FACE.has(p.part.kind)&&!['drawerSide','drawerBack','drawerBottom','back'].includes(p.part.kind)&&!(p.part.kind==='drawerFace'&&all.some(q=>q.part.kind==='drawerFront'&&q.part.bay===p.part.bay&&q.part.slot===p.part.slot)));
 const frontEl=[...carcass,...all.filter(p=>FACE.has(p.part.kind))].map(p=>{
  const x=fx(frontX,p.x-p.sx/2),y=fy(p.y+p.sy/2),w=p.sx*k,h=p.sy*k,face=FACE.has(p.part.kind);
  let extra='';
  if(p.part.kind==='door'){
   const index=doors.indexOf(p),hingeLeft=doorCount===1||index<doorCount/2;
   const hx=hingeLeft?x:x+w,ox=hingeLeft?x+w:x,hs=hingeLeft?-2.2:2.2;
   const handle=handleType==='knob'?`<circle class="knob" cx="${r(ox+hs)}" cy="${r(y+h/2)}" r="0.7"/>`:handleType==='profile'?`<path class="handle" d="M${r(ox+hs/2)} ${r(y+2)}V${r(y+h-2)}"/>`:handleType==='none'?'':`<path class="handle" d="M${r(ox+hs)} ${r(y+h/2-4)}v8"/>`;
   extra=`<path class="swing" d="M${r(ox)} ${r(y)}L${r(hx)} ${r(y+h/2)}L${r(ox)} ${r(y+h)}"/>${handle}`;
  }else if(face)extra=handleType==='knob'?`<circle class="knob" cx="${r(x+w/2)}" cy="${r(y+Math.min(2.2,h/3))}" r="0.7"/>`:handleType==='profile'?`<path class="handle" d="M${r(x+2)} ${r(y+0.6)}H${r(x+w-2)}"/>`:handleType==='none'?'':`<path class="handle" d="M${r(x+w/2-3)} ${r(y+Math.min(2.2,h/3))}h6"/>`;
  const glass=p.part.sheetGood===false&&face;
  const cls=p.part.kind==='worktop'?'worktop':face?(glass?'glass':'front'):'panel';
  return `<g data-part="${xml(p.part.id)}" data-kind="${xml(p.part.kind)}">${rect(x,y,w,h,cls,face&&!glass?` style="fill:${finish};fill-opacity:.28"`:'')}${extra}</g>`;
 }).join('');

 // B — interior elevation: carcass + contents, levels and bay widths from the same model.
 const behind=all.filter(p=>p.part.kind==='back');
 const contents=all.filter(p=>!FACE.has(p.part.kind));
 const interiorEl=[...behind,...contents.filter(p=>p.part.kind!=='back')].map(p=>{
  const x=fx(interiorX,p.x-p.sx/2),y=fyI(p.y+p.sy/2);
  return `<g data-part="${xml(p.part.id)}" data-kind="${xml(p.part.kind)}">${rect(x,y,p.sx*k,p.sy*k,p.part.kind==='back'?'back':p.part.kind==='drawerFace'?'front':p.part.kind==='worktop'?'worktop':'panel')}</g>`;
 }).join('');
 const floorY=model.internal.floorY,ceilY=model.internal.ceilY;
 const rails=model.accessories.filter(a=>a.kind==='hangingRail').map(a=>{const x1=fx(interiorX,a.position.x-a.length/2),x2=fx(interiorX,a.position.x+a.length/2),y=fyI(a.position.y);return `<path class="rail" d="M${r(x1)} ${r(y)}H${r(x2)}"/><text x="${r(x1+1)}" y="${r(y+2.2)}" font-size="1.7" class="note-text">${t.rail} ${mm(r(a.position.y-floorY))}</text>`}).join('');
 const leds=model.accessories.filter(a=>a.kind==='ledStrip').map(a=>{const x1=fx(interiorX,a.position.x-a.length/2),x2=fx(interiorX,a.position.x+a.length/2),y=fyI(a.position.y);return `<path class="led" data-led="${xml(a.uid)}" d="M${r(x1)} ${r(y)}H${r(x2)}"/><text x="${r(x2)}" y="${r(y+1.9)}" font-size="1.5" text-anchor="end" class="note-text">${t.led}</text>`}).join('');
 const fittings=model.accessories.filter(a=>a.kind==='fitting').map(a=>{const [w,h]=a.size,x=fx(interiorX,a.position.x-w/2),y=fyI(a.position.y+h/2);return `<g data-fitting="${xml(a.type)}">${rect(x,y,w*k,h*k,a.fits?'fitting':'fitting bad')}<text x="${r(x+0.6)}" y="${r(y+1.9)}" font-size="1.5" class="note-text">${xml(accessoryName(a.type,lang))}</text></g>`}).join('');
 const levels=full?(model.bays??[]).map(bay=>bay.shelfLevels.map(level=>{const x=fx(interiorX,bay.x-bay.innerWidth/2)+0.8,y=fyI(floorY+level)-0.6;return `<text x="${r(x)}" y="${r(y)}" font-size="1.7" class="level">▾${mm(level)}</text>`}).join('')).join(''):'';
 const bayChain=full?(model.bays??[]).map(bay=>hDim(fx(interiorX,bay.x-bay.innerWidth/2),fx(interiorX,bay.x+bay.innerWidth/2),interiorTop+Hv*k+6,mm(bay.innerWidth),{ext1:fyI(floorY),ext2:fyI(floorY),size:1.9})).join(''):'';
 const vChain=[];
 const rightX=interiorX+Wv*k+5;
 if(full&&plinth>0)vChain.push(vDim(rightX,fyI(plinth),fyI(0),mm(plinth),{size:1.8}));
 if(full)vChain.push(vDim(rightX,fyI(ceilY),fyI(floorY),`${mm(r(ceilY-floorY))} ${t.interiorH}`,{size:1.8}));

 // C — section through the first bay centre (cut panels solid, panels beyond in outline).
 const cutX=(model.bays?.[0]?.x)??0,sx=z=>sectionX+(D/2-z)*k,sy=y=>sectionTop+(Hv-y)*k;
 const section=all.map(p=>{
  const cut=Math.abs(p.x-cutX)<=p.sx/2+1e-6;
  if(!cut&&!['side'].includes(p.part.kind))return '';
  const x=sx(p.z+p.sz/2),y=sy(p.y+p.sy/2);
  return `<g data-part="${xml(p.part.id)}" data-kind="${xml(p.part.kind)}">${rect(x,y,p.sz*k,p.sy*k,cut?(p.part.sheetGood===false?'glass':'cut'):'beyond')}</g>`;
 }).join('');

 // D — plan (top view): front at the bottom. The worktop is an outline so the carcass stays readable.
 const py=z=>planY+(D/2-z)*k;
 const plan=all.filter(p=>!['drawerSide','drawerBack','drawerBottom','shelf','fixedShelf'].includes(p.part.kind)).map(p=>`<g data-kind="${xml(p.part.kind)}">${rect(fx(planX,p.x-p.sx/2),py(p.z+p.sz/2),p.sx*k,p.sz*k,FACE.has(p.part.kind)?'front':p.part.kind==='back'?'back':p.part.kind==='worktop'?'worktop':'panel')}</g>`).join('');

 // Dimensions, in the 1.5 order; each belongs to its view.
 const doorChain=full&&show.has('front')&&doors.length>1?doors.map(p=>hDim(fx(frontX,p.x-p.sx/2),fx(frontX,p.x+p.sx/2),frontTop+Hv*k+6,mm(p.sx),{size:1.8})).join(''):'';
 const widthY=frontTop+Hv*k+(doorChain?11:6);
 const dims=[
  doorChain,
  show.has('front')?hDim(fx(frontX,-W/2),fx(frontX,W/2),widthY,mm(W),{ext1:frontTop+Hv*k+0.8,ext2:frontTop+Hv*k+0.8}):'',
  show.has('front')?vDim(frontX-6,fy(H),fy(0),mm(H),{ext1:frontX-0.8,ext2:frontX-0.8}):'',
  show.has('front')&&full&&plinth>0?vDim(frontX-2.5,fy(plinth),fy(0),mm(plinth),{size:1.8}):'',
  show.has('section')?hDim(sx(D/2),sx(-D/2),sectionTop+Hv*k+6,mm(D),{ext1:sectionTop+Hv*k+0.8,ext2:sectionTop+Hv*k+0.8}):'',
  show.has('plan')?vDim(planX-6,py(D/2),py(-D/2),mm(D),{ext1:planX-0.8,ext2:planX-0.8}):'',
  show.has('plan')?hDim(fx(planX,-W/2),fx(planX,W/2),py(-D/2)+5,mm(W)):'',
  show.has('interior')?bayChain:'',...(show.has('interior')?vChain:[]),
  show.has('front')&&Wv>W+0.5?hDim(fx(frontX,minX),fx(frontX,maxX),widthY+5,`${mm(r(Wv))} ${lang==='ar'?'كلي':'overall'}`,{size:1.8}):'',
  show.has('front')&&Hv>H+0.5?vDim(frontX-10,fy(Hv),fy(0),`${mm(r(Hv))} ${lang==='ar'?'كلي':'overall'}`,{size:1.8}):'',
 ].join('');

 const label=(x,y,text)=>`<text x="${r(x)}" y="${r(y)}" class="view-title">${xml(text)}</text><text x="${r(x)}" y="${r(y+3)}" class="view-scale">1:${n}</text>`;
 const labels={front:label(frontX,frontTop-6,t.front),interior:label(interiorX,interiorTop-6,t.interior),section:label(sectionX,sectionTop-6,t.section),plan:label(planX,planY-6,t.plan)};
 const groups={front:`<g data-view="front">${frontEl}</g>`,interior:`<g data-view="interior">${interiorEl}${rails}${levels}${leds}${fittings}</g>`,
  section:`<g data-view="section">${section}<text x="${r(sx(D/2))}" y="${r(sy(0)+3)}" font-size="1.7" class="note-text">← ${t.front_}</text></g>`,
  plan:`<g data-view="plan">${plan}<text x="${r(fx(planX,0))}" y="${r(py(-D/2)+2.4)}" font-size="1.6" text-anchor="middle" class="note-text">${t.front_}</text></g>`};
 const views=`${lay.views.map(v=>labels[v]).join('')}
  ${lay.views.map(v=>groups[v]).join('')}${dims}`;

 // Side column: schedule, notes, title block.
 const {colX,colW,tbY}=F,tbH=F.height-SHEET.margin-tbY,s=colW/PAPERS.A3.column;
 const rows=partsSchedule(model,lang),rowH=4,maxRows=F.rows,shown=lay.schedule?rows.slice(0,maxRows):[];
 const cols=rtl?[[colW-1,'part','end'],[colW-38*s,'qty','middle'],[colW-50*s,'L','start'],[colW-65*s,'W','start'],[colW-78*s,'T','start'],[colW-101*s,'material','start'],[1,'edges','start']]:[[1,'part','start'],[38*s,'qty','middle'],[55*s,'L','end'],[70*s,'W','end'],[80*s,'T','end'],[84*s,'material','start'],[colW-1,'edges','end']];
 const head=cols.map(([x,key,anchor])=>`<text x="${r(colX+x)}" y="${r(SHEET.margin+9.6)}" text-anchor="${anchor}" class="th">${xml(t[key])}</text>`).join('');
 const body=shown.map((row,i)=>{const y=SHEET.margin+14+i*rowH,values={part:row.name,qty:row.qty,L:mm(row.length),W:mm(row.width),T:mm(row.thickness),material:String(row.material).slice(0,18),edges:row.edges};
  return `${i%2?`<rect x="${colX}" y="${r(y-2.9)}" width="${colW}" height="${rowH}" class="zebra"/>`:''}${cols.map(([x,key,anchor])=>`<text x="${r(colX+x)}" y="${r(y)}" text-anchor="${anchor}" class="td">${xml(values[key])}</text>`).join('')}`}).join('');
 const tableBottom=SHEET.margin+14+shown.length*rowH;
 const overflow=lay.schedule&&rows.length>maxRows?`<text x="${colX+1}" y="${r(tableBottom)}" class="td note-text">${xml(t.more(rows.length-maxRows))}</text>`:'';
 const schedule=lay.schedule?`<text x="${rtl?colX+colW:colX}" y="${SHEET.margin+5}" class="view-title"${rtl?' direction="rtl"':''}>${xml(t.schedule)}</text>${head}<path d="M${colX} ${SHEET.margin+11}h${colW}" class="frame" style="stroke-width:.2"/>${body}${overflow}`:'';
 const notesY=lay.schedule?Math.max(tableBottom+6,tbY-75):SHEET.margin+5;
 const doorMaterial=c.doorMaterial&&c.doorMaterial!=='inherit'?c.doorMaterial:unit.config.material;
 const glassLine=c.doorType==='glass'&&doorCount?[`${t.glass}: ${c.glassMaterial??''} · ${c.glassType??'clear'} · ${c.glassColor??''}`]:[];
 const handleLine=(doorCount||all.some(p=>p.part.kind==='drawerFront'))&&(handleType!=='bar'||c.handleLength||(c.handleFinish&&c.handleFinish!=='black'))?[`${t.handle}: ${t.handles[handleType]??handleType}${c.handleLength?` · ${c.handleLength} mm`:''} · ${c.handleFinish??''}`]:[];
 const notes=[
  `${t.carcass}: ${unit.config.material} · ${t.back}: ${unit.config.backMaterial||''} ${unit.config.backThickness??''} mm`,
  `${t.edgeBand}: ${unit.config.edgeType||'PVC'} ${unit.config.edgeThickness} mm${unit.config.doorEdgeThickness?` · ${t.kinds.door} ${unit.config.doorEdgeThickness} mm`:''} · ${t.kinds.door}: ${doorMaterial}`,
  ...glassLine,...handleLine,
  `${t.rules}: ${model.rules?.version??unit.config.rulesVersion??'legacy'} · ${model.parts.length} ${lang==='ar'?'قطعة':'parts'}`,
  ...(L.scaleAdjusted?[`⚠ ${t.scaleAdjusted(n)}`]:[]),
  ...model.warnings.slice(0,3).map(w=>`⚠ ${w.message}`),
  t.units,t.verify,
 ];
 const noteText=notes.map((line,i)=>`<text x="${rtl?colX+colW-1:colX+1}" y="${r(notesY+5+i*3.6)}" class="td"${rtl?' direction="rtl"':''}>${xml(String(line).slice(0,Math.round(95*s)))}</text>`).join('');
 const swatchX=rtl?colX+1:colX+colW-12;
 const swatch=`<rect x="${swatchX}" y="${notesY-3.2}" width="11" height="5" rx="0.8" style="fill:${finish}" class="swatch"/><text x="${rtl?swatchX+12:swatchX-1}" y="${notesY+0.6}" text-anchor="${rtl?'start':'end'}" class="td">${t.finish}</text>`;
 const notesBlock=lay.notes?`<text x="${rtl?colX+colW:colX}" y="${r(notesY)}" class="view-title"${rtl?' direction="rtl"':''}>${xml(t.notes)}</text>${swatch}${noteText}`:'';
 const tb=titleBlock({t,lang,company,project,unit,n,paper:F.paper,sheetNumber,sheetCount,date,colX,colW,tbY,tbH,drawingNo:`SD-${unit.id}`});
 const extraStyle=extras.length||model.accessories.some(a=>a.kind==='ledStrip'||a.kind==='fitting')||handleType==='knob'?EXTRA_STYLE:'';

 return `<svg xmlns="http://www.w3.org/2000/svg" width="${F.width}mm" height="${F.height}mm" viewBox="0 0 ${F.width} ${F.height}" role="img" aria-label="${xml(`${unit.id} ${unit.name} shop drawing`)}" data-scale="${n}" data-arrangement="${L.arrangement}" data-paper="${F.paper}" lang="${lang}">
<title>${xml(unit.name)} — shop drawing 1:${n}</title>
${STYLE}${extraStyle}
<rect width="${F.width}" height="${F.height}" fill="#fff"/>
<rect x="${SHEET.margin}" y="${SHEET.margin}" width="${F.width-2*SHEET.margin}" height="${F.height-2*SHEET.margin}" class="frame"/>
<path d="M${F.separator} ${SHEET.margin}V${F.height-SHEET.margin}" class="frame" style="stroke-width:.25"/>
${schedule}
${notesBlock}
${tb}
<g data-views="all">${views}</g>
</svg>`;
}

/** Second sheet for a unit: the clarification images attached to it, 2 × 2, with captions. */
export function detailSheetSvg(unit,{company={},project={},lang='en',sheetNumber=1,sheetCount=1,date=new Date().toISOString().slice(0,10),layout}={}){
 const t=T[lang]||T.en,rtl=lang==='ar',F=sheetFrame(layout??{}),images=validateDrawingImages(unit.drawingImages??[]);
 if(!images.length)throw Error('No drawing images for this unit');
 const {left,right}=F,top=SHEET.margin+12,gap=8,cellW=(right-left-3*gap)/2,cellH=(F.height-SHEET.margin-top-gap*2)/2-8;
 const cells=images.map((img,i)=>{
  const x=left+gap+(i%2)*(cellW+gap),y=top+Math.floor(i/2)*(cellH+14);
  return `<g data-image="${i+1}"><rect x="${r(x)}" y="${r(y)}" width="${r(cellW)}" height="${r(cellH)}" class="photo-frame"/><image href="${xml(img.src)}" x="${r(x+1)}" y="${r(y+1)}" width="${r(cellW-2)}" height="${r(cellH-2)}" preserveAspectRatio="xMidYMid meet"/><text x="${r(rtl?x+cellW:x)}" y="${r(y+cellH+4.5)}" class="td"${rtl?' direction="rtl"':''}>${i+1}. ${xml(img.caption)}</text></g>`;
 }).join('');
 const tbH=F.height-SHEET.margin-F.tbY;
 return `<svg xmlns="http://www.w3.org/2000/svg" width="${F.width}mm" height="${F.height}mm" viewBox="0 0 ${F.width} ${F.height}" role="img" aria-label="${xml(`${unit.id} ${unit.name} details`)}" data-paper="${F.paper}" data-sheet="details" lang="${lang}">
<title>${xml(unit.name)} — ${xml(t.detailSheet)}</title>
${STYLE}${EXTRA_STYLE}
<rect width="${F.width}" height="${F.height}" fill="#fff"/>
<rect x="${SHEET.margin}" y="${SHEET.margin}" width="${F.width-2*SHEET.margin}" height="${F.height-2*SHEET.margin}" class="frame"/>
<path d="M${F.separator} ${SHEET.margin}V${F.height-SHEET.margin}" class="frame" style="stroke-width:.25"/>
<text x="${r(rtl?right-gap:left+gap)}" y="${SHEET.margin+7}" class="view-title"${rtl?' direction="rtl"':''}>${xml(t.details)} · ${xml(unit.id)}</text>
${cells}
${titleBlock({t,lang,company,project,unit,n:0,paper:F.paper,sheetNumber,sheetCount,date,colX:F.colX,colW:F.colW,tbY:F.tbY,tbH,drawingNo:`SD-${unit.id}-D`})}
</svg>`;
}

/** Ordered sheets for a set: each unit's drawing, then its details sheet when it has images. */
export function drawingSheets(units,options={}){
 const list=units.flatMap(unit=>[{unit,kind:'drawing'},...((unit.drawingImages??[]).length?[{unit,kind:'details'}]:[])]);
 return list.map((sheet,i)=>{const o={...options,sheetNumber:i+1,sheetCount:list.length};return sheet.kind==='drawing'?shopDrawingSvg(sheet.unit,o):detailSheetSvg(sheet.unit,o)});
}

/** Printable HTML: one landscape sheet per page (A3 or A4), for the browser's Save as PDF. */
export function drawingSetHtml(units,options={}){
 if(!Array.isArray(units)||!units.length)throw Error('No units to draw');
 const lang=options.lang||'en',F=sheetFrame(options.layout??{});
 const sheets=drawingSheets(units,options).map(svg=>`<section class="sheet">${svg}</section>`).join('');
 return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><title>${xml(options.project?.name||options.project?.id||'Shop drawings')} — shop drawings</title>
<style>@page{size:${F.paper} landscape;margin:0}html,body{margin:0;background:#e9edf0}.sheet{width:${F.width}mm;height:${F.height}mm;margin:0 auto 8mm;background:#fff;page-break-after:always;break-after:page}.sheet svg{display:block;width:${F.width}mm;height:${F.height}mm}
@media print{html,body{background:#fff}.sheet{margin:0}}</style></head><body>${sheets}</body></html>`;
}
