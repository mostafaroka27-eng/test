// Rokadex Studio prototype engineering core — dimensions in millimetres.
// Legacy-preserving defaults: a missing field keeps the Alpha 1.3.2 geometry. New units opt into MODERN_RULES.
export const DEFAULTS = Object.freeze({width:900,height:2200,depth:580,thickness:18,backThickness:6,backInset:0,backConstruction:'legacy',partitions:1,shelves:3,material:'MDF 18 mm',backMaterial:'HDF 6 mm',edgeThickness:1,edgeType:'PVC',sheetWidth:1220,sheetHeight:2440,kerf:3.2,trim:10,construction:'between',grain:'vertical',stockGrainAxis:'legacy',doors:0,doorGap:3,doorOverlay:0,drawerSideClearance:13,drawerBoxHeight:130,drawerGap:3,drawerBottomThickness:6,
 rulesVersion:'legacy',bayMode:'shared',plinthHeight:0,plinthSetback:50,backGrooveDepth:8,backGrooveAllowance:2,
 shelfMode:'fixed',shelfSideClearance:1,shelfFrontSetback:0,railShelfClearance:40,
 drawerLayout:'legacy',drawerStyle:'external',drawerFrontHeight:180,internalDrawerSetback:20,drawerSlideMode:'legacy',drawerSlideLength:450,drawerSlideRearClearance:10,drawerBoxHeightClearance:30,drawerBoxThickness:0,
 doorType:'panel',doorThickness:0,doorEdgeThickness:0,glassThickness:5,glassMaterial:'Glass 5 mm',
 doorMaterial:'inherit',drawerBoxMaterial:'inherit',drawerBottomMaterial:'inherit',edgeDeduction:'off'});
/** Rules applied to newly created units. Every value is an editable software convention, not a workshop standard. */
export const CABINET_RULES_VERSION='cab-2.0';
export const MODERN_RULES=Object.freeze({rulesVersion:CABINET_RULES_VERSION,stockGrainAxis:'y',backConstruction:'inset',drawerLayout:'bottom',drawerSlideMode:'auto',edgeDeduction:'on',shelfMode:'adjustable',shelfFrontSetback:20});
/** Slide lengths observed in the supplied NCD reference (analysis/ncd-data.json). Unverified catalogue values. */
export const DRAWER_SLIDE_LENGTHS=Object.freeze([600,550,500,450,400,350,300,250]);
const ENUMS={rulesVersion:['legacy',CABINET_RULES_VERSION],bayMode:['shared','separate'],shelfMode:['fixed','adjustable'],drawerLayout:['legacy','bottom'],drawerStyle:['external','internal'],drawerSlideMode:['legacy','auto','fixed'],doorType:['panel','glass'],edgeDeduction:['off','on']};
const finite=(x,k,min=0)=>{if(typeof x!=='number'||!Number.isFinite(x)||x<min)throw Error(`${k} must be a number >= ${min}`);return x};
const round=n=>Math.round(n*100)/100;
const drawerKeys=['drawerSideClearance','drawerBoxHeight','drawerGap','drawerBottomThickness'];
function withDrawerDefaults(c){return {...c,...Object.fromEntries(drawerKeys.map(k=>[k,c[k]??DEFAULTS[k]]))}}
// Fields introduced after 1.3.2 fall back to their legacy-preserving default when absent.
const RULE_KEYS=['rulesVersion','bayMode','plinthHeight','plinthSetback','backGrooveDepth','backGrooveAllowance','shelfMode','shelfSideClearance','shelfFrontSetback','railShelfClearance','drawerLayout','drawerStyle','drawerFrontHeight','internalDrawerSetback','drawerSlideMode','drawerSlideLength','drawerSlideRearClearance','drawerBoxHeightClearance','drawerBoxThickness','doorType','doorThickness','doorEdgeThickness','glassThickness','glassMaterial','doorMaterial','drawerBoxMaterial','drawerBottomMaterial','edgeDeduction'];
function withRuleDefaults(c){const next=withDrawerDefaults(c);for(const k of RULE_KEYS)if(next[k]===undefined)next[k]=DEFAULTS[k];return next}
const resolveMaterial=(value,fallback)=>value&&value!=='inherit'?value:fallback;

/** Bay interior frames shared by validation, geometry and drawings. X is centred on the cabinet. */
export function bayFrames(c){
 const t=c.thickness,bays=c.partitions+1;
 if(c.bayMode==='separate'){const box=c.width/bays;return Array.from({length:bays},(_,b)=>({index:b,x:round(-c.width/2+box*(b+.5)),innerWidth:round(box-2*t),boxWidth:round(box)}))}
 const iw=c.width-2*t,bay=(iw-c.partitions*t)/bays;
 return Array.from({length:bays},(_,b)=>({index:b,x:-iw/2+bay*(b+.5)+t*b,innerWidth:bay,boxWidth:null}));
}
function slideFor(c,available){
 if(c.drawerSlideMode==='fixed'){
  if(c.drawerSlideLength>available)throw Error(`Drawer slide ${c.drawerSlideLength} mm exceeds available depth ${round(available)} mm`);
  return c.drawerSlideLength;
 }
 const fit=DRAWER_SLIDE_LENGTHS.find(length=>length<=available);
 if(!fit)throw Error(`No drawer slide fits: available depth ${round(available)} mm, shortest configured slide ${Math.min(...DRAWER_SLIDE_LENGTHS)} mm`);
 return fit;
}
/** Vertical arrangement of one bay: drawer zone at the bottom, optional divider, shelves and rail above. */
function bayLayout(c,b,frame,floorY,ceilY,usableDepth){
 const t=c.thickness,drawers=c.bayDrawers?.[b]||0,levels=c.bayShelfLevels?.[b],rail=c.bayRails?.[b]||0;
 const shelfCount=Array.isArray(levels)?levels.length:(c.bayShelves?.[b]??c.shelves);
 const layout={drawers:[],divider:null,shelves:[],rail:null,zoneStart:floorY};
 if(drawers&&c.drawerLayout==='bottom'){
  const pitch=c.drawerFrontHeight+c.drawerGap,zone=drawers*pitch+c.drawerGap;
  const boxLimit=c.drawerStyle==='internal'?pitch-c.drawerGap:c.drawerFrontHeight-c.drawerBoxHeightClearance;
  if(c.drawerBoxHeight>boxLimit)throw Error(`Bay ${b+1}: drawer box height ${c.drawerBoxHeight} mm exceeds ${round(boxLimit)} mm available per drawer`);
  const above=shelfCount>0||rail>0;
  if(floorY+zone+(above?t:0)>ceilY)throw Error(`Bay ${b+1}: drawer zone ${round(zone)} mm exceeds interior height`);
  for(let d=0;d<drawers;d++){const bottom=floorY+c.drawerGap+d*pitch;layout.drawers.push({slot:d,bottom,top:bottom+c.drawerFrontHeight})}
  if(above){layout.divider={bottom:floorY+zone,top:floorY+zone+t};layout.zoneStart=floorY+zone+t}
 }
 const zoneH=ceilY-layout.zoneStart;
 if(Array.isArray(levels)){
  // Level = height of the shelf top face above the carcass interior floor.
  let previous=layout.zoneStart;
  for(const [s,level] of levels.entries()){
   const top=floorY+level,bottom=top-t;
   if(bottom<previous-1e-6)throw Error(`Bay ${b+1}: shelf at ${level} mm overlaps the drawer zone or the shelf below`);
   if(top>ceilY+1e-6)throw Error(`Bay ${b+1}: shelf at ${level} mm is above the interior top`);
   layout.shelves.push({slot:s,y:top-t/2,level});previous=top;
  }
 }else for(let s=0;s<shelfCount;s++){const y=layout.zoneStart+zoneH*(s+1)/(shelfCount+1);layout.shelves.push({slot:s,y,level:round(y+t/2-floorY)})}
 if(rail>0){
  const y=floorY+rail;
  if(y<=layout.zoneStart||y>=ceilY)throw Error(`Bay ${b+1}: hanging rail at ${rail} mm is outside the free zone`);
  const over=layout.shelves.find(s=>s.y-t/2>=y);
  if(over&&over.y-t/2-y<c.railShelfClearance)throw Error(`Bay ${b+1}: hanging rail needs ${c.railShelfClearance} mm below the shelf above`);
  if(layout.shelves.some(s=>Math.abs(s.y-y)<t/2+1))throw Error(`Bay ${b+1}: hanging rail collides with a shelf`);
  layout.rail={y,level:rail,length:round(frame.innerWidth)};
 }
 return layout;
}
export function validate(c){c=withRuleDefaults(c);for(const k of ['material','backMaterial','glassMaterial','doorMaterial','drawerBoxMaterial','drawerBottomMaterial'])if(typeof c[k]!=='string'||!c[k].trim()||c[k].length>200)throw Error(`${k} must be a nonempty material name (at most 200 characters)`);for(const [k,values] of Object.entries(ENUMS))if(!values.includes(c[k]))throw Error(`Invalid ${k}`);for(const k of ['width','height','depth','thickness','backThickness','sheetWidth','sheetHeight','glassThickness','drawerFrontHeight','drawerSlideLength'])finite(c[k],k,0.01);for(const k of ['backInset','edgeThickness','kerf','trim','doorGap','doorOverlay','plinthHeight','plinthSetback','backGrooveDepth','backGrooveAllowance','shelfSideClearance','shelfFrontSetback','railShelfClearance','internalDrawerSetback','drawerSlideRearClearance','drawerBoxHeightClearance','drawerBoxThickness','doorThickness','doorEdgeThickness'])finite(c[k],k);for(const k of ['shelves','partitions','doors']){finite(c[k],k);if(!Number.isInteger(c[k])||c[k]>30)throw Error(`${k} must be an integer between 0 and 30`)}if(c.backConstruction!==undefined&&!['legacy','inset','overlay','groove'].includes(c.backConstruction))throw Error('Invalid back construction');if(c.backConstruction==='overlay'&&c.backInset!==0)throw Error('Overlay back construction requires zero back inset');if(c.backConstruction==='groove'&&c.backGrooveDepth>=c.thickness)throw Error('Back groove depth must be less than panel thickness');if(c.backConstruction==='groove'&&2*c.backGrooveDepth<=c.backGrooveAllowance)throw Error('Back groove allowance exceeds groove engagement');if(!['between','over'].includes(c.construction))throw Error('Unsupported construction');if(c.plinthHeight>0&&c.construction==='over')throw Error('Plinth with top/bottom over sides is not modeled; use top & bottom between sides');if(c.plinthHeight>0&&c.plinthSetback+c.thickness>c.depth)throw Error('Plinth setback exceeds cabinet depth');if(!['vertical','horizontal','none'].includes(c.grain))throw Error('Invalid grain');if(c.stockGrainAxis!==undefined&&!['legacy','x','y'].includes(c.stockGrainAxis))throw Error('Invalid stock grain axis');if(c.bayShelves!==undefined){if(!Array.isArray(c.bayShelves)||c.bayShelves.length!==c.partitions+1||c.bayShelves.some(v=>!Number.isInteger(v)||v<0||v>30))throw Error('bayShelves must match bay count with 0–30 shelves per bay')}if(c.bayDrawers!==undefined){if(!Array.isArray(c.bayDrawers)||c.bayDrawers.length!==c.partitions+1||c.bayDrawers.some(v=>!Number.isInteger(v)||v<0||v>12))throw Error('bayDrawers must match bays (0–12 drawers)')}if(c.bayShelfLevels!==undefined){if(!Array.isArray(c.bayShelfLevels)||c.bayShelfLevels.length!==c.partitions+1||c.bayShelfLevels.some(v=>v!==null&&(!Array.isArray(v)||v.length>30||v.some(n=>typeof n!=='number'||!Number.isFinite(n)||n<=0||n>10000))))throw Error('bayShelfLevels must match bays: null or up to 30 positive heights in mm')}if(c.bayRails!==undefined){if(!Array.isArray(c.bayRails)||c.bayRails.length!==c.partitions+1||c.bayRails.some(v=>typeof v!=='number'||!Number.isFinite(v)||v<0||v>10000))throw Error('bayRails must match bays: 0 (none) or a height in mm')}for(const k of ['drawerSideClearance','drawerBoxHeight','drawerGap','drawerBottomThickness'])finite(c[k]??DEFAULTS[k],k,k==='drawerSideClearance'||k==='drawerGap'?0:1);if(c.width<=2*c.thickness+c.partitions*c.thickness)throw Error('Width too small for sides and partitions');if(c.bayMode==='separate'&&c.width/(c.partitions+1)<=2*c.thickness)throw Error('Width too small for separate boxes');if(c.height-c.plinthHeight<=2*c.thickness)throw Error('Height too small for top, bottom and plinth');if(c.bayDrawers?.some(n=>n>0)){const narrow=Math.min(...bayFrames(c).map(f=>f.innerWidth)),box=c.drawerBoxThickness||c.thickness;if(narrow-2*c.drawerSideClearance-2*box<=0)throw Error('Insufficient drawer width / slide clearance');if(c.drawerLayout==='legacy'){const bay=narrow;if(c.depth-c.backThickness-c.backInset-35-2*c.thickness<=0)throw Error('Insufficient drawer bottom depth');if(bay-2*c.drawerGap<=0||c.bayDrawers.some(n=>n>0&&(c.height-2*c.thickness-(n+1)*c.drawerGap)/n<=0))throw Error('Insufficient drawer front dimensions');if(c.bayDrawers.some(n=>n*(c.drawerBoxHeight+c.drawerGap)>c.height-2*c.thickness))throw Error('Drawer bank exceeds available height')}else{if(c.drawerStyle==='external'&&c.doors>0)throw Error('External drawer fronts overlap full-height doors; use internal drawers or remove doors');if(narrow-2*c.drawerGap<=0)throw Error('Insufficient drawer front dimensions')}}if(c.partOverrides!==undefined){if(typeof c.partOverrides!=='object'||!c.partOverrides||Array.isArray(c.partOverrides))throw Error('Invalid part overrides');for(const [key,v] of Object.entries(c.partOverrides)){if(!/^([a-zA-Z]+):(\d+)$/.test(key)||!v||!Array.isArray(v.edges)||v.edges.length!==4||v.edges.some(x=>x!==0&&x!==1))throw Error('Invalid edge override')}}if(c.doors>4)throw Error('Maximum 4 doors in this prototype');if(c.doors>0 && (c.width-2*c.doorGap)/c.doors<=0)throw Error('Door width too small');if(c.depth<=c.backInset+c.backThickness)throw Error('Depth too small for back construction');if(c.sheetWidth<=2*c.trim||c.sheetHeight<=2*c.trim)throw Error('Trim exceeds sheet dimensions');return c}
export function cabinet(c,id='CAB-001'){
 c=withRuleDefaults(c);validate(c);
 const t=c.thickness,P=c.plinthHeight,iw=c.width-2*t,ih=c.height-P-2*t,usableDepth=c.depth-c.backInset-c.backThickness;
 const floorY=P+t,ceilY=c.height-t,frames=bayFrames(c),separate=c.bayMode==='separate';
 const backConstruction=c.backConstruction??'legacy';
 // Total depth includes the back. Explicit modes share one interior rear plane.
 const carcassDepth=backConstruction==='overlay'?c.depth-c.backThickness:c.depth;
 const carcassZ=backConstruction==='overlay'?c.backThickness/2:0;
 const interiorZ=['inset','groove'].includes(backConstruction)?(c.backInset+c.backThickness)/2:c.backThickness/2;
 const doorMaterial=c.doorType==='glass'?c.glassMaterial:resolveMaterial(c.doorMaterial,c.material);
 const boxMaterial=resolveMaterial(c.drawerBoxMaterial,c.material),bottomMaterial=resolveMaterial(c.drawerBottomMaterial,c.backMaterial);
 const boxT=c.drawerBoxThickness||t,doorT=c.doorType==='glass'?c.glassThickness:(c.doorThickness||t),frontEdge=c.doorEdgeThickness||c.edgeThickness;
 const ruleSource=c.rulesVersion==='legacy'?'rokadex-alpha-1.3.2':CABINET_RULES_VERSION;
 const parts=[],accessories=[],warnings=[];let n=0;const kindCounts={},keyCounts={};
 const add=(kind,l,w,q,opts={})=>{const thick=opts.thickness??t;if(![round(l),round(w),thick].every(n=>Number.isFinite(n)&&n>0))throw Error(`Invalid ${kind} panel dimensions at 0.01 mm precision`);for(let i=0;i<q;i++){const code=`${id}-${kind.toUpperCase()}-${String(++n).padStart(3,'0')}`;const ordinal=kindCounts[kind]||0;kindCounts[kind]=ordinal+1;const base=opts.bay!==undefined&&opts.slot!==undefined?`${kind}:${opts.bay}:${opts.slot}`:`${kind}:${ordinal}`;const occurrence=keyCounts[base]||0;keyCounts[base]=occurrence+1;const key=kind==='drawerSide'?`${base}:${occurrence}`:base;const override=c.partOverrides?.[`${kind}:${ordinal}`];const edges=override?.edges||opts.edges||[0,0,0,0];const sheetGood=opts.sheetGood??true;const et=opts.edgeThickness??c.edgeThickness;const deduct=c.edgeDeduction==='on'&&sheetGood;
  // Edge order [L1,W1,L2,W2]: L edges run along the length, W edges along the width (matches NCD bands).
  parts.push({id:code,key,kind,length:round(l),width:round(w),thickness:thick,material:opts.material||c.material,grain:opts.grain||c.grain,edges,edgeType:c.edgeType,edgeThickness:et,bandLength:round(edges.reduce((s,e,j)=>s+(e?(j%2===0?l:w):0),0)),position:opts.position||null,bay:opts.bay??null,slot:opts.slot??null,overrideKey:`${kind}:${ordinal}`,
   uid:`${id}/${key}`,cutLength:round(l-(deduct?et*(edges[1]+edges[3]):0)),cutWidth:round(w-(deduct?et*(edges[0]+edges[2]):0)),sheetGood,canRotate:(opts.grain||c.grain)==='none',operations:opts.operations||[],source:ruleSource,verification:'software-convention-unverified'})}};
 const groove=(edgeName)=>backConstruction==='groove'?[{type:'groove',face:'inner',edge:edgeName,offsetFromRear:c.backInset,width:c.backThickness,depth:c.backGrooveDepth,length:'full',verification:'unverified-tooling'}]:[];
 const sideHeight=c.construction==='between'?c.height:ih,topLength=separate?null:(c.construction==='between'?iw:c.width);
 const sideY=c.construction==='between'?c.height/2:P+t+ih/2;
 const boxes=separate?frames.map(f=>({bay:f.index,x:f.x,outer:f.boxWidth,inner:f.innerWidth})):[{bay:undefined,x:0,outer:c.width,inner:iw}];
 const at=(box,slot)=>box.bay===undefined?{}:{bay:box.bay,slot};
 for(const box of boxes)for(const [slot,sign] of [[0,-1],[1,1]])add('side',sideHeight,carcassDepth,1,{edges:[1,0,0,0],operations:groove('L2'),position:{x:box.x+sign*(box.outer/2-t/2),y:sideY,z:carcassZ},...at(box,slot)});
 for(const box of boxes)add('top',separate?(c.construction==='between'?box.inner:box.outer):topLength,carcassDepth,1,{edges:[1,0,0,0],operations:groove('L2'),position:{x:box.x,y:c.height-t/2,z:carcassZ},...at(box,0)});
 for(const box of boxes)add('bottom',separate?(c.construction==='between'?box.inner:box.outer):topLength,carcassDepth,1,{edges:[1,0,0,0],operations:groove('L2'),position:{x:box.x,y:P+t/2,z:carcassZ},...at(box,0)});
 if(P>0)for(const box of boxes)add('plinth',box.inner,P,1,{edges:[1,0,0,0],position:{x:box.x,y:P/2,z:c.depth/2-c.plinthSetback-t/2},...at(box,0)});
 if(!separate)for(let p=0;p<c.partitions;p++)add('partition',ih,usableDepth,1,{edges:[1,0,0,0],position:{x:frames[p].x+frames[p].innerWidth/2+t/2,y:P+t+ih/2,z:interiorZ}});
 const layouts=frames.map(f=>bayLayout(c,f.index,f,floorY,ceilY,usableDepth));
 const adjustable=c.shelfMode==='adjustable';
 for(const [b,layout] of layouts.entries())if(layout.divider)add('fixedShelf',frames[b].innerWidth,usableDepth,1,{edges:[1,0,0,0],position:{x:frames[b].x,y:(layout.divider.bottom+layout.divider.top)/2,z:interiorZ},bay:b,slot:0});
 for(const [b,layout] of layouts.entries()){const f=frames[b];for(const s of layout.shelves)add('shelf',adjustable?f.innerWidth-2*c.shelfSideClearance:f.innerWidth,usableDepth-c.shelfFrontSetback,1,{edges:[1,0,0,0],position:{x:f.x,y:s.y,z:interiorZ-c.shelfFrontSetback/2},bay:b,slot:s.slot})}
 for(const [b,layout] of layouts.entries()){
  const f=frames[b],count=c.bayDrawers?.[b]||0;if(!count)continue;const x=f.x,bay=f.innerWidth;const boxW=bay-2*c.drawerSideClearance;
  if(c.drawerLayout==='legacy'){
   if(layout.shelves.length)warnings.push({code:'LEGACY_DRAWER_SHELF_OVERLAP',bay:b,message:`Bay ${b+1}: legacy drawer bank spans the full bay and overlaps its shelves. Switch drawer layout to "bottom" to separate them.`});
   if(c.doors>0)warnings.push({code:'LEGACY_DRAWER_DOOR_OVERLAP',bay:b,message:`Bay ${b+1}: legacy drawer fronts and doors occupy the same front plane.`});
   const boxD=usableDepth-35,boxH=c.drawerBoxHeight,frontH=(ih-(count+1)*c.drawerGap)/count;
   for(let d=0;d<count;d++){const y=floorY+c.drawerGap+(d+.5)*frontH+d*c.drawerGap;add('drawerFront',frontH,bay-2*c.drawerGap,1,{edges:[1,1,1,1],edgeThickness:frontEdge,material:doorMaterial,position:{x,y,z:c.depth/2+t/2},bay:b,slot:d});const boxY=floorY+(d+.5)*(ih/count);const boxZ=backConstruction==='legacy'?0:(c.backInset+c.backThickness-35)/2;for(const sign of [-1,1])add('drawerSide',boxD,boxH,1,{edges:[1,0,0,0],material:boxMaterial,position:{x:x+sign*(boxW/2-t/2),y:boxY,z:boxZ},bay:b,slot:d});add('drawerBack',boxW-2*t,boxH,1,{edges:[1,0,0,0],material:boxMaterial,position:{x,y:boxY,z:boxZ-boxD/2+t/2},bay:b,slot:d});add('drawerFace',boxW-2*t,boxH,1,{edges:[1,0,0,0],material:boxMaterial,position:{x,y:boxY,z:boxZ+boxD/2-t/2},bay:b,slot:d});add('drawerBottom',boxW-2*t,boxD-2*t,1,{thickness:c.drawerBottomThickness,material:bottomMaterial,grain:'none',position:{x,y:boxY-boxH/2+c.drawerBottomThickness/2,z:boxZ},bay:b,slot:d})}
   continue;
  }
  const internal=c.drawerStyle==='internal',setback=internal?c.internalDrawerSetback:0;
  if(internal&&c.doors===0&&!warnings.some(w=>w.code==='INTERNAL_DRAWERS_WITHOUT_DOORS'))warnings.push({code:'INTERNAL_DRAWERS_WITHOUT_DOORS',message:'Internal drawers are modeled without doors in front of them; add doors or switch to external fronts.'});
  const boxD=slideFor(c,usableDepth-c.drawerSlideRearClearance-setback),boxH=c.drawerBoxHeight;
  const frontZ=c.depth/2-setback,boxZ=frontZ-boxD/2;
  for(const drawer of layout.drawers){const d=drawer.slot,frontY=(drawer.bottom+drawer.top)/2;
   if(!internal)add('drawerFront',c.drawerFrontHeight,bay-2*c.drawerGap,1,{edges:[1,1,1,1],edgeThickness:frontEdge,thickness:c.doorThickness||t,material:doorMaterial,position:{x,y:frontY,z:c.depth/2+(c.doorThickness||t)/2},bay:b,slot:d});
   const boxY=internal?drawer.bottom+boxH/2:frontY;
   for(const sign of [-1,1])add('drawerSide',boxD,boxH,1,{thickness:boxT,edges:[1,0,0,0],material:boxMaterial,position:{x:x+sign*(boxW/2-boxT/2),y:boxY,z:boxZ},bay:b,slot:d});
   add('drawerBack',boxW-2*boxT,boxH,1,{thickness:boxT,edges:[1,0,0,0],material:boxMaterial,position:{x,y:boxY,z:boxZ-boxD/2+boxT/2},bay:b,slot:d});
   add('drawerFace',boxW-2*boxT,boxH,1,{thickness:boxT,edges:internal?[1,1,1,1]:[1,0,0,0],material:boxMaterial,position:{x,y:boxY,z:boxZ+boxD/2-boxT/2},bay:b,slot:d});
   add('drawerBottom',boxW-2*boxT,boxD-2*boxT,1,{thickness:c.drawerBottomThickness,material:bottomMaterial,grain:'none',position:{x,y:boxY-boxH/2+c.drawerBottomThickness/2,z:boxZ},bay:b,slot:d});
   accessories.push({uid:`${id}/drawerSlide:${b}:${d}`,kind:'drawerSlide',bay:b,slot:d,length:boxD,quantity:1,unit:'pair',verification:'unverified-supplier'});
  }
 }
 for(const [b,layout] of layouts.entries())if(layout.rail)accessories.push({uid:`${id}/hangingRail:${b}`,kind:'hangingRail',bay:b,length:layout.rail.length,level:layout.rail.level,position:{x:frames[b].x,y:layout.rail.y,z:interiorZ},quantity:1,unit:'pcs',verification:'unverified-supplier'});
 if(c.doors>0){const dw=(c.width-(c.doors+1)*c.doorGap)/c.doors+2*c.doorOverlay;const dh=c.height-P-2*c.doorGap+2*c.doorOverlay;if(dw<=0||dh<=0)throw Error('Invalid door clearances');const glass=c.doorType==='glass';for(let d=0;d<c.doors;d++)add('door',dh,dw,1,{edges:glass?[0,0,0,0]:[1,1,1,1],edgeThickness:frontEdge,thickness:doorT,material:doorMaterial,grain:glass?'none':undefined,sheetGood:!glass,position:{x:-c.width/2+c.doorGap+(dw-2*c.doorOverlay)/2+d*((dw-2*c.doorOverlay)+c.doorGap),y:P+(c.height-P)/2,z:c.depth/2+doorT/2}});if(glass)warnings.push({code:'GLASS_DOOR_SUPPLIER',message:'Glass doors are supplier items: confirm glass type, edge work, hinge boring and safety requirements with the glass supplier.'})}
 for(const box of boxes){
  const inner=box.inner,backZ=-c.depth/2+(['inset','groove'].includes(backConstruction)?c.backInset:0)+c.backThickness/2;
  const [bl,bw]=backConstruction==='groove'?[ih+2*c.backGrooveDepth-c.backGrooveAllowance,inner+2*c.backGrooveDepth-c.backGrooveAllowance]:backConstruction==='inset'?[ih,inner]:[c.height-P,box.outer];
  add('back',bl,bw,1,{thickness:c.backThickness,material:c.backMaterial,grain:'none',position:{x:box.x,y:backConstruction==='inset'||backConstruction==='groove'?P+t+ih/2:P+(c.height-P)/2,z:backZ},...at(box,0)});
 }
 return {id,parts,accessories,warnings,dimensions:{width:c.width,height:c.height,depth:c.depth},internal:{width:iw,height:ih,bayWidth:round(frames[0].innerWidth),bayWidths:frames.map(f=>round(f.innerWidth)),floorY,ceilY},bays:frames.map((f,b)=>({...f,innerWidth:round(f.innerWidth),drawers:layouts[b].drawers,divider:layouts[b].divider,shelfLevels:layouts[b].shelves.map(s=>s.level),rail:layouts[b].rail?.level??null})),rules:{version:ruleSource,bayMode:c.bayMode,backConstruction,edgeDeduction:c.edgeDeduction,status:'software convention — not workshop or supplier approved'},totalAreaM2:round(parts.reduce((s,p)=>s+p.length*p.width/1e6,0)),edgeLengthM:round(parts.reduce((s,p)=>s+p.bandLength/1000,0)),status:'PRELIMINARY — ENGINEERING REVIEW REQUIRED'};
}
// Deterministic first-fit shelf layout. Preview only: not guillotine/CNC instructions.
export function layoutSheets(parts,c){
 validate(c);
 const stockGrainAxis=c.stockGrainAxis??'legacy';
 const groups=new Map();
 const sheets=[],unplaced=[],excluded=[];
 // Non-sheet items (e.g. glass doors) are procured separately; cut sizes include any edge-band deduction.
 for(const source of parts){if(!['vertical','horizontal','none'].includes(source.grain))throw Error('Invalid part grain');if(source.sheetGood===false){excluded.push({id:source.id,reason:'Not cut from sheet stock'});continue}const p={...source,length:source.cutLength??source.length,width:source.cutWidth??source.width};const key=`${p.material}|${p.thickness}|${p.grain}`;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(p)}
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
 return {sheets:sheets.filter(s=>s.placed.length).map(s=>({...s,utilization:round(100*s.usedArea/(s.width*s.height))})),unplaced,excluded,algorithm:'First-fit shelf packing — PREVIEW ONLY; no guillotine sequencing'};
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
