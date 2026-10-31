import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULTS,MODERN_RULES,cabinet} from './engine.mjs';
import {partSize} from './geometry.mjs';
import {ACCESSORIES,spaceUse} from './accessories.mjs';
import {projectHardware,hardwareCsv,hingesForDoor} from './hardware.mjs';
import {KITCHEN_TEMPLATES,kitchenUnit} from './kitchen.mjs';
import {validateMaterial,validateMaterials,applyMaterial,stockName} from './materials.mjs';
import {parseProject} from './project.mjs';
import {DEFAULT_ROOM,validateRoom,inspectLayout,roomAreaStats,roomPlanSvg} from './room.mjs';

const modern=extra=>({...DEFAULTS,...MODERN_RULES,width:1200,height:2400,depth:600,partitions:1,...extra});

test('details off by default: no extra parts, overall size equals the carcass',()=>{
 const m=cabinet(modern({}),'A');
 assert.equal(m.parts.some(p=>['endPanel','topFiller','worktop'].includes(p.kind)),false);
 assert.deepEqual(m.overall,{width:1200,height:2400,depth:600});
});
test('cover panels, top filler and worktop are appended with their sizes; carcass IDs do not move',()=>{
 const base=cabinet(modern({doors:2}),'A'),m=cabinet(modern({doors:2,coverLeft:18,coverRight:25,coverFront:20,topFiller:300,topFillerSetback:5,worktopThickness:38,worktopOverhang:20}),'A');
 assert.deepEqual(m.parts.slice(0,base.parts.length).map(p=>[p.id,p.key,p.length,p.width]),base.parts.map(p=>[p.id,p.key,p.length,p.width]));
 const [left,right,filler,top]=m.parts.slice(base.parts.length);
 assert.deepEqual([left.kind,left.length,left.width,left.thickness,left.position.x],['endPanel',2700,620,18,-609]);
 assert.deepEqual([right.thickness,right.position.x],[25,612.5]);
 assert.deepEqual([filler.kind,filler.length,filler.width,filler.position.y],['topFiller',1243,300,2550]);
 assert.equal(filler.position.z,600/2+18-18/2-5,'filler sits in the door plane less its setback');
 assert.deepEqual([top.kind,top.length,top.width,top.thickness,top.sheetGood,top.material],['worktop',1243,638,38,false,'Worktop']);
 for(const p of [left,filler,top])assert.equal(partSize(p).length,3);
 assert.deepEqual(m.overall,{width:1243,height:2738,depth:638});
});
test('LED strips under the top and under chosen shelves; missing shelves warn instead of failing',()=>{
 const m=cabinet(modern({shelves:2,lightPositions:['1:top','0:1','0:5'],lightKelvin:4000}),'A');
 const strips=m.accessories.filter(a=>a.kind==='ledStrip');
 assert.deepEqual(strips.map(s=>[s.bay,s.at,s.kelvin]),[[0,'1',4000],[1,'top',4000]]);
 const shelf=m.parts.find(p=>p.kind==='shelf'&&p.bay===0&&p.slot===1);
 assert.equal(strips[0].position.y,shelf.position.y-18/2-5);
 assert.ok(m.warnings.some(w=>w.code==='LIGHT_POSITION_MISSING'));
 assert.throws(()=>cabinet(modern({lightPositions:['x']}),'A'),/lightPositions/);
 assert.throws(()=>cabinet(modern({lightKelvin:9000}),'A'),/lightKelvin/);
});
test('interior spaces: clear heights between shelves, rail flag and drawer interiors',()=>{
 const m=cabinet(modern({shelves:0,bayShelfLevels:[[1900],[800]],bayShelves:[1,1],bayRails:[1840,0],bayDrawers:[0,2],drawerStyle:'external',doors:0}),'A');
 const bay0=m.spaces.filter(s=>s.bay===0);
 assert.deepEqual(bay0.map(s=>[s.bottom,s.clearHeight,s.rail]),[[0,1882,true],[1900,464,false]]);
 const drawers=m.spaces.filter(s=>s.kind==='drawer');
 assert.equal(drawers.length,2);assert.ok(drawers.every(d=>d.clearHeight===DEFAULTS.drawerBoxHeight-DEFAULTS.drawerBottomThickness));
 assert.deepEqual(spaceUse(bay0[0]),['longHanging']);
 assert.ok(spaceUse({clearHeight:200,depth:400}).includes('shoes'));
});
test('accessories: fit checks, overlap and worktop requirement',()=>{
 const ok=cabinet(modern({bayAccessories:[[{type:'shoeRack'}],[{type:'trouserRack',level:600}]]}),'A');
 assert.ok(ok.accessories.filter(a=>a.kind==='fitting').every(a=>a.fits));
 const bad=cabinet(modern({width:700,bayAccessories:[[{type:'sink'},{type:'trouserRack'}],[{type:'basket',level:0},{type:'shoeRack',level:50}]]}),'A');
 const msg=bad.warnings.map(w=>w.message).join('|');
 assert.match(msg,/Sink.*needs a worktop/);assert.match(msg,/trouser rack needs at least 450/);assert.match(msg,/overlaps wire basket/);
 assert.throws(()=>cabinet(modern({bayAccessories:[[{type:'rocket'}],[]]}),'A'),/Unknown accessory/);
 assert.throws(()=>cabinet(modern({bayAccessories:[[]]}),'A'),/one list per bay/);
});
test('hardware schedule counts hinges, slides, handles, pins, rails, LEDs and fittings',()=>{
 assert.deepEqual([900,901,1600,2200,2201].map(hingesForDoor),[2,3,3,4,5]);
 const config=modern({doors:2,height:2000,bayDrawers:[2,0],drawerStyle:'internal',bayRails:[0,1500],lightPositions:['0:top','1:top'],handleType:'knob',bayAccessories:[[],[{type:'shoeRack'}]]});
 const rows=projectHardware([{id:'A',config},{id:'B',config:modern({doors:1,height:800,partitions:0,shelves:1,handleType:'profile'}),elevation:1450}]);
 const q=key=>rows.filter(r=>r.key===key).reduce((s,r)=>s+r.qty,0);
 assert.equal(q('hinge'),2*4+2);assert.equal(q('slide'),2);assert.equal(q('knob'),2);assert.equal(q('rail'),1);assert.equal(q('railSupport'),2);
 assert.equal(q('shelfPin'),(6+1)*4);assert.equal(q('driver'),1);assert.equal(q('wallBracket'),2);assert.equal(q('fitting:shoeRack'),1);
 assert.ok(Math.abs(q('led')-2*(573-20)/1000)<1e-9);
 assert.ok(q('profile')>0);
 const csv=hardwareCsv(rows);assert.match(csv,/^"# HARDWARE/);assert.match(csv,/"Concealed hinge \+ plate"/);
 assert.ok(projectHardware([{id:'A',config}],'ar').some(r=>r.item==='مفصلة مخفية + قاعدة'));
});
test('every kitchen template builds with fitting accessories and no warnings',()=>{
 for(const t of KITCHEN_TEMPLATES){
  const u=kitchenUnit(t.id,'K'),m=cabinet(u.config,'K');
  assert.deepEqual(m.warnings,[],t.id);
  assert.ok(m.accessories.filter(a=>a.kind==='fitting').every(a=>a.fits),t.id);
  if(t.group==='base')assert.ok(m.parts.some(p=>p.kind==='worktop'),t.id);
  if(t.group==='wall')assert.equal(u.elevation,1450);
 }
 assert.throws(()=>kitchenUnit('nope','K'),/Unknown kitchen template/);
});
const material=extra=>({id:'MAT-1',name:'Egger oak',category:'board',spec:'H1145 ST10',thickness:18,sheetLength:2800,sheetWidth:2070,color:'#b48a5c',grain:'vertical',textureSize:1200,texture:'data:image/png;base64,iVBORw0KGgo=',...extra});
test('materials: validation and applying to carcass, fronts, worktop and glass',()=>{
 assert.equal(validateMaterial(material()).color,'#b48a5c');
 assert.throws(()=>validateMaterial(material({thickness:0})),/thickness/);
 assert.throws(()=>validateMaterial(material({sheetWidth:null})),/both sheet/);
 assert.throws(()=>validateMaterial(material({texture:'data:image/gif;base64,AAAA'})),/photo/);
 assert.throws(()=>validateMaterials([material(),material()]),/Duplicate/);
 const unit={id:'A',config:modern({doors:2})};
 const carcass=applyMaterial(unit,material(),'carcass');
 assert.deepEqual([carcass.config.material,carcass.config.thickness,carcass.config.sheetHeight,carcass.config.sheetWidth,carcass.materialId],['Egger oak 18 mm',18,2800,2070,'MAT-1']);
 const fronts=applyMaterial(unit,material({thickness:22}),'fronts');
 assert.deepEqual([fronts.config.doorMaterial,fronts.config.doorThickness,fronts.frontMaterialId],['Egger oak 22 mm',22,'MAT-1']);
 assert.equal(applyMaterial(unit,material({thickness:6,color:'#334455',category:'glass'}),'glass').config.glassColor,'#334455');
 assert.equal(unit.config.material,DEFAULTS.material,'original unit untouched');
 assert.equal(stockName(material()),'Egger oak 18 mm');
 cabinet(carcass.config,'A');
});
const file=extra=>({format:'rokadex-standalone',version:3,projectId:'PRJ-T',designRevision:1,lengthUnit:'mm',room:{...DEFAULT_ROOM},units:[{id:'A',name:'Unit',type:'cabinet',x:0,z:0,finish:'oak',config:modern({lightPositions:['0:top'],bayAccessories:[[{type:'shoeRack',level:0}],[]]})}],...extra});
test('project files keep materials, links, mounting height, lights, accessories and room openings',()=>{
 const input=file({materials:[material()]});input.units[0].materialId='MAT-1';input.units[0].elevation=1450;
 input.room.openings=[{wall:'back',type:'window',offset:500,width:1200,height:1200,sill:900}];
 const out=parseProject(JSON.stringify(input));
 assert.equal(out.units[0].materialId,'MAT-1');assert.equal(out.units[0].elevation,1450);
 assert.deepEqual(out.units[0].config.lightPositions,['0:top']);assert.deepEqual(out.units[0].config.bayAccessories,[[{type:'shoeRack',level:0}],[]]);
 assert.deepEqual(out.materials[0],validateMaterial(material()));assert.deepEqual(out.room.openings,input.room.openings);
 const missing=file();missing.units[0].materialId='MAT-9';assert.throws(()=>parseProject(missing),/Unknown material/);
 const old=file();delete old.units[0].config.lightPositions;delete old.units[0].config.bayAccessories;
 assert.equal(Object.hasOwn(parseProject(old),'materials'),false);
});
test('room openings: validation, blocked door and covered window; wall units over base units are fine',()=>{
 assert.throws(()=>validateRoom({...DEFAULT_ROOM,openings:[{wall:'back',type:'door',offset:4000,width:900,height:2100,sill:0}]}),/runs past/);
 assert.throws(()=>validateRoom({...DEFAULT_ROOM,openings:[{wall:'left',type:'door',offset:0,width:900,height:2100,sill:300}]}),/sill 0/);
 const room={...DEFAULT_ROOM,openings:[{wall:'back',type:'door',offset:0,width:900,height:2100,sill:0},{wall:'back',type:'window',offset:2500,width:1000,height:1000,sill:1000}]};
 const unit=(id,x,extra={},elevation=0)=>({id,name:id,x,z:-DEFAULT_ROOM.depth/2+300,config:modern({width:600,height:870,depth:560,partitions:0,...extra}),elevation});
 const types=units=>inspectLayout(room,units).map(i=>i.type);
 assert.deepEqual(types([unit('A',-1800)]),['door']);
 assert.deepEqual(types([unit('B',900)]),[],'base unit below the window sill');
 assert.deepEqual(types([unit('C',900,{height:2200})]),['window']);
 assert.deepEqual(types([unit('D',0),unit('E',0,{height:720,depth:320},1450)]),[],'wall unit above base unit');
 assert.deepEqual(types([unit('F',0),unit('G',0,{height:720},500)]),['overlap']);
 const stats=roomAreaStats(room,[unit('D',0),unit('E',0,{height:720,depth:320},1450)]);
 assert.equal(stats.floorM2,DEFAULT_ROOM.width*DEFAULT_ROOM.depth/1e6);assert.equal(stats.rows.length,2);assert.equal(stats.rows[1].onFloor,false);
 assert.ok(stats.occupiedM2>0.3&&stats.occupiedM2<0.4);assert.equal(stats.walls.back.length,DEFAULT_ROOM.width);
 const svg=roomPlanSvg(room,[unit('D',0)]);assert.match(svg,/data-opening="door"/);assert.match(svg,/data-opening="window"/);
});
test('accessory catalogue entries are complete',()=>{
 for(const [key,a] of Object.entries(ACCESSORIES)){assert.ok(a.en&&a.ar&&a.minWidth>0&&a.height>0,key);assert.ok(['space','drawer','worktop','bay'].includes(a.place),key)}
});
import {roomSheetHtml} from './room-sheet.mjs';
import {validateLighting,sunPosition,DEFAULT_LIGHTING} from './lighting.mjs';
test('room sheet prints renders, plan, areas and openings in English and Arabic',()=>{
 const room={...DEFAULT_ROOM,openings:[{wall:'left',type:'door',offset:200,width:900,height:2100,sill:0}]};
 const units=[{id:'A',name:'Wardrobe',x:0,z:-1500,config:modern({})}];
 const html=roomSheetHtml({company:{name:'Shop'},project:{name:'P1',client:'C'},room,units,images:{overview:'data:image/jpeg;base64,OO'}});
 for(const text of ['Room layout','Shop','P1','15.12 m²','Left wall','data:image/jpeg;base64,OO','data-opening="door"'])assert.ok(html.includes(text),text);
 assert.match(roomSheetHtml({room,units,lang:'ar'}),/تخطيط الغرفة/);
});
test('lighting settings are clamped view settings with a sun position',()=>{
 assert.deepEqual(validateLighting(null),DEFAULT_LIGHTING);
 const v=validateLighting({quality:'ultra',sunElevation:200,exposure:-1,ledsOn:true,sunAzimuth:'x'});
 assert.deepEqual([v.quality,v.sunElevation,v.exposure,v.ledsOn,v.sunAzimuth],['ultra',85,0.4,true,DEFAULT_LIGHTING.sunAzimuth]);
 assert.equal(validateLighting({quality:'mega'}).quality,'high');
 const [x,y,z]=sunPosition({sunAzimuth:0,sunElevation:90},1000);assert.ok(Math.abs(x)<1e-9&&Math.abs(y-1000)<1e-9&&Math.abs(z)<1e-9);
});
