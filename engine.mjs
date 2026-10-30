// Rokadex Studio prototype engineering core — dimensions in millimetres.
export const DEFAULTS = Object.freeze({width:900,height:2200,depth:580,thickness:18,backThickness:6,backInset:0,backConstruction:'legacy',partitions:1,shelves:3,material:'MDF 18 mm',backMaterial:'HDF 6 mm',edgeThickness:1,edgeType:'PVC',sheetWidth:1220,sheetHeight:2440,kerf:3.2,trim:10,construction:'between',grain:'vertical',stockGrainAxis:'legacy',doors:0,doorGap:3,doorOverlay:0,drawerSideClearance:13,drawerBoxHeight:130,drawerGap:3,drawerBottomThickness:6});
const finite=(x,k,min=0)=>{if(typeof x!=='number'||!Number.isFinite(x)||x<min)throw Error(`${k} must be a number >= ${min}`);return x};
const round=n=>Math.round(n*100)/100;
const drawerKeys=['drawerSideClearance','drawerBoxHeight','drawerGap','drawerBottomThickness'];
function withDrawerDefaults(c){return {...c,...Object.fromEntries(drawerKeys.map(k=>[k,c[k]??DEFAULTS[k]]))}}
export function validate(c){c=withDrawerDefaults(c);for(const k of ['material','backMaterial'])if(typeof c[k]!=='string'||!c[k].trim()||c[k].length>200)throw Error(`${k} must be a nonempty material name (at most 200 characters)`);for(const k of ['width','height','depth','thickness','backThickness','sheetWidth','sheetHeight'])finite(c[k],k,0.01);for(const k of ['backInset','edgeThickness','kerf','trim','doorGap','doorOverlay'])finite(c[k],k);for(const k of ['shelves','partitions','doors']){finite(c[k],k);if(!Number.isInteger(c[k])||c[k]>30)throw Error(`${k} must be an integer between 0 and 30`)}if(c.backConstruction!==undefined&&!['legacy','inset','overlay'].includes(c.backConstruction))throw Error('Invalid back construction');if(c.backConstruction==='overlay'&&c.backInset!==0)throw Error('Overlay back construction requires zero back inset');if(!['between','over'].includes(c.construction))throw Error('Unsupported construction');if(!['vertical','horizontal','none'].includes(c.grain))throw Error('Invalid grain');if(c.stockGrainAxis!==undefined&&!['legacy','x','y'].includes(c.stockGrainAxis))throw Error('Invalid stock grain axis');if(c.bayShelves!==undefined){if(!Array.isArray(c.bayShelves)||c.bayShelves.length!==c.partitions+1||c.bayShelves.some(v=>!Number.isInteger(v)||v<0||v>30))throw Error('bayShelves must match bay count with 0–30 shelves per bay')}if(c.bayDrawers!==undefined){if(!Array.isArray(c.bayDrawers)||c.bayDrawers.length!==c.partitions+1||c.bayDrawers.some(v=>!Number.isInteger(v)||v<0||v>12))throw Error('bayDrawers must match bays (0–12 drawers)')}for(const k of ['drawerSideClearance','drawerBoxHeight','drawerGap','drawerBottomThickness'])finite(c[k]??DEFAULTS[k],k,k==='drawerSideClearance'||k==='drawerGap'?0:1);if(c.bayDrawers?.some(n=>n>0)){const bay=(c.width-2*c.thickness-c.partitions*c.thickness)/(c.partitions+1);if(bay-2*c.drawerSideClearance-2*c.thickness<=0)throw Error('Insufficient drawer width / slide clearance');if(c.depth-c.backThickness-c.backInset-35-2*c.thickness<=0)throw Error('Insufficient drawer bottom depth');if(bay-2*c.drawerGap<=0||c.bayDrawers.some(n=>n>0&&(c.height-2*c.thickness-(n+1)*c.drawerGap)/n<=0))throw Error('Insufficient drawer front dimensions');if(c.bayDrawers.some(n=>n*(c.drawerBoxHeight+c.drawerGap)>c.height-2*c.thickness))throw Error('Drawer bank exceeds available height')}if(c.partOverrides!==undefined){if(typeof c.partOverrides!=='object'||!c.partOverrides||Array.isArray(c.partOverrides))throw Error('Invalid part overrides');for(const [key,v] of Object.entries(c.partOverrides)){if(!/^([a-zA-Z]+):(\d+)$/.test(key)||!v||!Array.isArray(v.edges)||v.edges.length!==4||v.edges.some(x=>x!==0&&x!==1))throw Error('Invalid edge override')}}if(c.doors>4)throw Error('Maximum 4 doors in this prototype');if(c.doors>0 && (c.width-2*c.doorGap)/c.doors<=0)throw Error('Door width too small');if(c.width<=2*c.thickness+c.partitions*c.thickness)throw Error('Width too small for sides and partitions');if(c.height<=2*c.thickness)throw Error('Height too small for top and bottom');if(c.depth<=c.backInset+c.backThickness)throw Error('Depth too small for back construction');if(c.sheetWidth<=2*c.trim||c.sheetHeight<=2*c.trim)throw Error('Trim exceeds sheet dimensions');return c}
export function cabinet(c,id='CAB-001'){
 c=withDrawerDefaults(c);validate(c);const t=c.thickness,iw=c.width-2*t,ih=c.height-2*t,bay=(iw-c.partitions*t)/(c.partitions+1),usableDepth=c.depth-c.backInset-c.backThickness;
 const backConstruction=c.backConstruction??'legacy';
 // Total depth includes the back. Explicit modes share one interior rear plane.
 const carcassDepth=backConstruction==='overlay'?c.depth-c.backThickness:c.depth;
 const carcassZ=backConstruction==='overlay'?c.backThickness/2:0;
 const interiorZ=backConstruction==='inset'?(c.backInset+c.backThickness)/2:c.backThickness/2;
 const parts=[];let n=0;const kindCounts={},keyCounts={};const add=(kind,l,w,q,opts={})=>{if(![round(l),round(w),opts.thickness??t].every(n=>Number.isFinite(n)&&n>0))throw Error(`Invalid ${kind} panel dimensions at 0.01 mm precision`);for(let i=0;i<q;i++){const code=`${id}-${kind.toUpperCase()}-${String(++n).padStart(3,'0')}`;const ordinal=kindCounts[kind]||0;kindCounts[kind]=ordinal+1;const base=opts.bay!==undefined&&opts.slot!==undefined?`${kind}:${opts.bay}:${opts.slot}`:`${kind}:${ordinal}`;const occurrence=keyCounts[base]||0;keyCounts[base]=occurrence+1;const key=kind==='drawerSide'?`${base}:${occurrence}`:base;const override=c.partOverrides?.[`${kind}:${ordinal}`];const edges=override?.edges||opts.edges||[0,0,0,0];parts.push({id:code,key,kind,length:round(l),width:round(w),thickness:opts.thickness||t,material:opts.material||c.material,grain:opts.grain||c.grain,edges,edgeType:c.edgeType,edgeThickness:c.edgeThickness,bandLength:round(edges.reduce((s,e,j)=>s+(e?(j%2===0?l:w):0),0)),position:opts.position||null,bay:opts.bay??null,slot:opts.slot??null,overrideKey:`${kind}:${ordinal}`})}};
 const sideHeight=c.construction==='between'?c.height:ih,topLength=c.construction==='between'?iw:c.width;
 add('side',sideHeight,carcassDepth,1,{edges:[1,0,0,0],position:{x:-c.width/2+t/2,y:sideHeight/2+(c.construction==='over'?t:0),z:carcassZ}});
 add('side',sideHeight,carcassDepth,1,{edges:[1,0,0,0],position:{x:c.width/2-t/2,y:sideHeight/2+(c.construction==='over'?t:0),z:carcassZ}});
 add('top',topLength,carcassDepth,1,{edges:[1,0,0,0],position:{x:0,y:c.height-t/2,z:carcassZ}});
 add('bottom',topLength,carcassDepth,1,{edges:[1,0,0,0],position:{x:0,y:t/2,z:carcassZ}});
 for(let p=0;p<c.partitions;p++)add('partition',ih,usableDepth,1,{edges:[1,0,0,0],position:{x:-iw/2+bay*(p+1)+t*p+t/2,y:c.height/2,z:interiorZ}});
 for(let b=0;b<=c.partitions;b++){const count=c.bayShelves?.[b]??c.shelves;for(let s=0;s<count;s++)add('shelf',bay,usableDepth,1,{edges:[1,0,0,0],position:{x:-iw/2+bay*(b+.5)+t*b,y:t+ih*(s+1)/(count+1),z:interiorZ},bay:b,slot:s})}
 for(let b=0;b<=c.partitions;b++){const count=c.bayDrawers?.[b]||0;if(!count)continue;const x=-iw/2+bay*(b+.5)+t*b;const boxW=bay-2*c.drawerSideClearance;const boxD=usableDepth-35;const boxH=c.drawerBoxHeight;const frontH=(ih-(count+1)*c.drawerGap)/count;for(let d=0;d<count;d++){const y=t+c.drawerGap+(d+.5)*frontH+d*c.drawerGap;const z=c.depth/2+t/2;const frontPos={x,y,z};add('drawerFront',frontH,bay-2*c.drawerGap,1,{edges:[1,1,1,1],position:frontPos,bay:b,slot:d});const boxY=t+(d+.5)*(ih/count);const boxZ=backConstruction==='legacy'?0:(c.backInset+c.backThickness-35)/2;for(const sign of [-1,1])add('drawerSide',boxD,boxH,1,{edges:[1,0,0,0],position:{x:x+sign*(boxW/2-t/2),y:boxY,z:boxZ},bay:b,slot:d});add('drawerBack',boxW-2*t,boxH,1,{edges:[1,0,0,0],position:{x,y:boxY,z:boxZ-boxD/2+t/2},bay:b,slot:d});add('drawerFace',boxW-2*t,boxH,1,{edges:[1,0,0,0],position:{x,y:boxY,z:boxZ+boxD/2-t/2},bay:b,slot:d});add('drawerBottom',boxW-2*t,boxD-2*t,1,{thickness:c.drawerBottomThickness,material:c.backMaterial,grain:'none',position:{x,y:boxY-boxH/2+c.drawerBottomThickness/2,z:boxZ},bay:b,slot:d})}}
 if(c.doors>0){const dw=(c.width-(c.doors+1)*c.doorGap)/c.doors+2*c.doorOverlay;const dh=c.height-2*c.doorGap+2*c.doorOverlay;if(dw<=0||dh<=0)throw Error('Invalid door clearances');for(let d=0;d<c.doors;d++)add('door',dh,dw,1,{edges:[1,1,1,1],position:{x:-c.width/2+c.doorGap+(dw-2*c.doorOverlay)/2+d*((dw-2*c.doorOverlay)+c.doorGap),y:c.height/2,z:c.depth/2+t/2}})}
 add('back',backConstruction==='inset'?ih:c.height,backConstruction==='inset'?iw:c.width,1,{thickness:c.backThickness,material:c.backMaterial,grain:'none',position:{x:0,y:c.height/2,z:-c.depth/2+(backConstruction==='inset'?c.backInset:0)+c.backThickness/2}});
 return {id,parts,dimensions:{width:c.width,height:c.height,depth:c.depth},internal:{width:iw,height:ih,bayWidth:round(bay)},totalAreaM2:round(parts.reduce((s,p)=>s+p.length*p.width/1e6,0)),edgeLengthM:round(parts.reduce((s,p)=>s+p.bandLength/1000,0)),status:'PRELIMINARY — ENGINEERING REVIEW REQUIRED'};
}
// Deterministic first-fit shelf layout. Preview only: not guillotine/CNC instructions.
export function layoutSheets(parts,c){
 validate(c);
 const stockGrainAxis=c.stockGrainAxis??'legacy';
 const groups=new Map();
 for(const p of parts){if(!['vertical','horizontal','none'].includes(p.grain))throw Error('Invalid part grain');const key=`${p.material}|${p.thickness}|${p.grain}`;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(p)}
 const sheets=[],unplaced=[];
 for(const [key,items] of groups){
  const groupSheets=[];
  const create=()=>{const sheet={group:key,width:c.sheetWidth,height:c.sheetHeight,stockGrainAxis,placed:[],usedArea:0,shelves:[]};sheets.push(sheet);groupSheets.push(sheet);return sheet};
  for(const p of [...items].sort((a,b)=>b.length*b.width-a.length*a.width)){
   // Panel grain: vertical follows length; horizontal follows width. Stock axes are sheet X/Y.
   const swapped=stockGrainAxis!=='legacy'&&p.grain!=='none'&&((stockGrainAxis==='y')===(p.grain==='vertical'));
   const orientations=swapped?[[p.width,p.length,true]]:[[p.length,p.width,false]];
   if(p.grain==='none'&&p.length!==p.width)orientations.push([p.width,p.length,true]);
   let placed=false;
   for(const sheet of [...groupSheets, null]){
    if(placed)break;
    for(const [w,h,rotated] of orientations){
     if(w>c.sheetWidth-2*c.trim||h>c.sheetHeight-2*c.trim)continue;
     if(sheet){
      for(const row of sheet.shelves){
       if(h<=row.height&&row.x+w<=c.sheetWidth-c.trim){sheet.placed.push({id:p.id,x:row.x,y:row.y,w,h,rotated});row.x+=w+c.kerf;sheet.usedArea+=w*h;placed=true;break}
      }
      if(placed)break;
     }
     const target=sheet||create();
     const y=target.shelves.length?Math.max(...target.shelves.map(r=>r.y+r.height+c.kerf)):c.trim;
     if(y+h<=c.sheetHeight-c.trim){target.shelves.push({x:c.trim+w+c.kerf,y,height:h});target.placed.push({id:p.id,x:c.trim,y,w,h,rotated});target.usedArea+=w*h;placed=true;break}
    }
   }
   if(!placed)unplaced.push({id:p.id,reason:'Part exceeds usable sheet or packing constraints'});
  }
 }
 return {sheets:sheets.filter(s=>s.placed.length).map(s=>({...s,utilization:round(100*s.usedArea/(s.width*s.height))})),unplaced,algorithm:'First-fit shelf packing — PREVIEW ONLY; no guillotine sequencing'};
}
export const METHODS=Object.freeze({
 frameless:{name:'Frameless / European',construction:'between',doorGap:3,doorOverlay:0,edgeThickness:1},
 overlay:{name:'Overlay top and bottom',construction:'over',doorGap:3,doorOverlay:0,edgeThickness:1},
 insetDoors:{name:'Inset door concept',construction:'between',doorGap:4,doorOverlay:0,edgeThickness:2}
});
export function applyMethod(config,key){const method=METHODS[key];if(!method)throw Error('Unknown manufacturing method');const next={...config,...Object.fromEntries(Object.entries(method).filter(([k])=>k!=='name'))};validate(next);return next}
export function hardwareSchedule(config,id='CAB-001'){
 validate(config);
 const notes=['ESTIMATE ONLY — no hardware brand, drilling coordinates, mounting plate or load ratings specified'];
 const rows=[];
 if(config.doors){
  // Concept quantity estimate only; NOT a verified manufacturer hinge formula.
  const hingesPerDoor=config.height<=900?2:config.height<=1600?3:config.height<=2200?4:5;
  rows.push({item:'Concealed hinge (unverified)',qty:hingesPerDoor*config.doors,unit:'pcs',reference:id,notes:'Confirm door weight, height, material and manufacturer chart'});
  rows.push({item:'Hinge mounting plate (unverified)',qty:hingesPerDoor*config.doors,unit:'pcs',reference:id,notes:'Select compatible plate and fixing screws'});
 }
 const drawerCount=(config.bayDrawers||[]).reduce((a,b)=>a+b,0);if(drawerCount)rows.push({item:'Drawer slide pair (unverified)',qty:drawerCount,unit:'pairs',reference:id,notes:'Verify slide length, load, side clearance and fixing coordinates'});
 rows.push({item:'Assembly fasteners',qty:null,unit:'TBD',reference:id,notes:'Specify joinery method and load before calculating'});
 return {rows,notes,status:'PRELIMINARY — NOT FOR PROCUREMENT OR DRILLING'};
}
export function csv(parts){const cols=['id','kind','length','width','thickness','material','grain','edges','bandLength'];const cell=value=>{let text=String(value??'');if(/^[\s]*[=+@-]/.test(text))text="'"+text;return '"'+text.replaceAll('"','""')+'"'};return [cols.join(','),...parts.map(p=>cols.map(k=>cell(k==='edges'?p.edges.join('|'):p[k])).join(','))].join('\r\n')}

// CAD exchange: flat panel outlines only, not a machining or drilling program.
export function dxfPanels(parts){
 const lines=['0','SECTION','2','HEADER','9','$ACADVER','1','AC1015','9','$INSUNITS','70','4','9','$MEASUREMENT','70','1','0','ENDSEC','0','SECTION','2','ENTITIES'];
 const gap=50,rowWidth=9000;let x=0,y=0,rowHeight=0;
 for(const p of parts){
  if(!Number.isFinite(p.length)||!Number.isFinite(p.width)||p.length<=0||p.width<=0)throw Error('Invalid DXF panel dimensions');
  if(x>0&&x+p.length>rowWidth){x=0;y+=rowHeight+gap;rowHeight=0}
  lines.push('0','LWPOLYLINE','8','PANEL_OUTLINE','90','4','70','1');
  for(const [px,py] of [[x,y],[x+p.length,y],[x+p.length,y+p.width],[x,y+p.width]])lines.push('10',String(px),'20',String(py));
  lines.push('0','TEXT','8','PART_ID','10',String(x+10),'20',String(y+10),'40','20','1',String(p.id).replace(/[^a-zA-Z0-9_-]/g,'_'));
  x+=p.length+gap;rowHeight=Math.max(rowHeight,p.width);
 }
 lines.push('0','TEXT','8','NOTES','10','0','20',String(y+rowHeight+100),'40','35','1','PRELIMINARY - ENGINEERING REVIEW REQUIRED - NOT FOR CNC','0','ENDSEC','0','EOF');
 return lines.join('\n');
}
