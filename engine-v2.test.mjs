// Cabinet rules cab-2.0. Expected values are worked out by hand in the comments, not by calling the engine formulas.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DEFAULTS,MODERN_RULES,cabinet,layoutSheets,validate,bayFrames} from './engine.mjs';
import {partSize} from './geometry.mjs';

const modern=extra=>({...DEFAULTS,...MODERN_RULES,...extra});
const byKind=(model,kind)=>model.parts.filter(p=>p.kind===kind);
const wardrobe={width:2400,height:2400,depth:600,thickness:18,partitions:2,shelves:0,backThickness:6,backInset:0};

test('legacy geometry is byte-identical to the Alpha 1.3.2 engine for 73 recorded configurations',()=>{
 const recorded=JSON.parse(readFileSync(new URL('./fixtures/legacy-engine-1.3.2.json',import.meta.url),'utf8'));
 const legacyFields=({uid,cutLength,cutWidth,sheetGood,canRotate,operations,source,verification,...rest})=>rest;
 assert.equal(recorded.length,73);
 for(const [i,entry] of recorded.entries()){
  const model=cabinet(entry.config,'U'+i);
  assert.deepEqual(model.parts.map(legacyFields),entry.model.parts,`variant ${i}`);
  const {excluded,...sheets}=layoutSheets(model.parts,entry.config);
  assert.deepEqual(sheets,entry.sheets,`sheets ${i}`);
 }
});

test('2400 mm, 3 bays, 18 mm: separate boxes give 764 mm and shared partitions give 776 mm inside',()=>{
 // separate: 2400/3 = 800 per box, 800 − 2×18 = 764. shared: (2400 − 2×18 − 2×18)/3 = 2328/3 = 776.
 const separate=cabinet(modern({...wardrobe,bayMode:'separate'}));
 const shared=cabinet(modern({...wardrobe,bayMode:'shared'}));
 assert.deepEqual(separate.internal.bayWidths,[764,764,764]);
 assert.deepEqual(shared.internal.bayWidths,[776,776,776]);
 assert.equal(byKind(separate,'side').length,6);assert.equal(byKind(separate,'partition').length,0);
 assert.equal(byKind(shared,'side').length,2);assert.equal(byKind(shared,'partition').length,2);
 assert.deepEqual(byKind(separate,'top').map(p=>p.length),[764,764,764]);
 assert.equal(byKind(separate,'back').length,3);
 // Outer boxes touch exactly: box 0 right side ends where box 1 left side starts (x = −400).
 const sides=byKind(separate,'side').map(p=>p.position.x).sort((a,b)=>a-b);
 assert.deepEqual(sides,[-1191,-409,-391,391,409,1191]);
});

test('back thickness and mounting change depths and back size',()=>{
 // Inset 6 mm, no inset offset: shelf depth 600 − 6 = 594; with 3 mm: 597.
 const fixed={...wardrobe,shelves:1,shelfMode:'fixed',shelfFrontSetback:0};
 assert.equal(byKind(cabinet(modern({...fixed,backConstruction:'inset',backThickness:6})),'shelf')[0].width,594);
 assert.equal(byKind(cabinet(modern({...fixed,backConstruction:'inset',backThickness:3})),'shelf')[0].width,597);
 // Overlay 6 mm: sides 600 − 6 = 594 deep, back covers the full 2400 × 2400.
 const overlay=cabinet(modern({...fixed,backConstruction:'overlay',backThickness:6}));
 assert.equal(byKind(overlay,'side')[0].width,594);
 assert.deepEqual([byKind(overlay,'back')[0].length,byKind(overlay,'back')[0].width],[2400,2400]);
 // Groove: offset 10, groove 8 deep, 2 mm allowance. Interior 2364 × 2364 → back 2364 + 16 − 2 = 2378 each way.
 const grooved=cabinet(modern({...fixed,backConstruction:'groove',backThickness:6,backInset:10,backGrooveDepth:8,backGrooveAllowance:2}));
 const back=byKind(grooved,'back')[0];
 assert.deepEqual([back.length,back.width,back.thickness],[2378,2378,6]);
 assert.equal(byKind(grooved,'shelf')[0].width,584);// 600 − 10 − 6
 const ops=byKind(grooved,'side')[0].operations;
 assert.equal(ops.length,1);assert.deepEqual({type:ops[0].type,width:ops[0].width,depth:ops[0].depth,offset:ops[0].offsetFromRear},{type:'groove',width:6,depth:8,offset:10});
 assert.equal(byKind(cabinet(modern({...fixed,backConstruction:'inset'})),'side')[0].operations.length,0);
 assert.throws(()=>cabinet(modern({...fixed,backConstruction:'groove',backGrooveDepth:18})),/groove depth/);
});

test('plinth raises the carcass bottom and shortens partitions and doors',()=>{
 // H 2400, plinth 100, t 18: interior 2400 − 100 − 36 = 2264; bottom centre y = 100 + 9 = 109; door 2400 − 100 − 2×3 = 2294.
 const model=cabinet(modern({...wardrobe,plinthHeight:100,doors:2,doorGap:3}));
 assert.equal(model.internal.height,2264);
 assert.equal(byKind(model,'bottom')[0].position.y,109);
 assert.equal(byKind(model,'side')[0].length,2400);
 assert.equal(byKind(model,'partition')[0].length,2264);
 assert.equal(byKind(model,'door')[0].length,2294);
 const kick=byKind(model,'plinth');
 assert.equal(kick.length,1);assert.deepEqual([kick[0].length,kick[0].width],[2364,100]);
 assert.throws(()=>cabinet(modern({...wardrobe,plinthHeight:100,construction:'over'})),/Plinth/);
});

test('fixed and adjustable shelves use their own clearances',()=>{
 // Shared 776 mm bay; adjustable: 776 − 2×1 = 774 long, 594 − 20 = 574 deep. Fixed: 776 × 594.
 const adjustable=byKind(cabinet(modern({...wardrobe,shelves:1,shelfMode:'adjustable',shelfSideClearance:1,shelfFrontSetback:20})),'shelf')[0];
 const fixed=byKind(cabinet(modern({...wardrobe,shelves:1,shelfMode:'fixed',shelfFrontSetback:0})),'shelf')[0];
 assert.deepEqual([adjustable.length,adjustable.width],[774,574]);
 assert.deepEqual([fixed.length,fixed.width],[776,594]);
});

test('edge-band deduction gives cut sizes; disabled deduction keeps them equal',()=>{
 // Adjustable shelf 774 × 574 banded on L1 only (1 mm): cut width 574 − 1 = 573, cut length unchanged.
 const config={...wardrobe,shelves:1,shelfFrontSetback:20};
 const on=byKind(cabinet(modern({...config,edgeDeduction:'on'})),'shelf')[0];
 const off=byKind(cabinet(modern({...config,edgeDeduction:'off'})),'shelf')[0];
 assert.deepEqual([on.cutLength,on.cutWidth],[774,573]);
 assert.deepEqual([off.cutLength,off.cutWidth],[774,574]);
 // Door banded all round with 2 mm: cut = finish − 4 in both directions.
 const door=byKind(cabinet(modern({...wardrobe,doors:2,doorGap:3,doorEdgeThickness:2,edgeDeduction:'on'})),'door')[0];
 assert.equal(door.edgeThickness,2);assert.equal(door.cutLength,door.length-4);assert.equal(door.cutWidth,door.width-4);
 // Packing consumes the cut size.
 const c=modern({...config,edgeDeduction:'on',stockGrainAxis:'y'}),model=cabinet(c);
 const placed=layoutSheets(model.parts,c).sheets.flatMap(s=>s.placed).find(p=>p.id===on.id);
 assert.deepEqual([placed.w,placed.h].sort((a,b)=>a-b),[573,774]);
});

test('drawers at the bottom and shelves above share a bay without overlapping',()=>{
 // Bay 776, 2 fronts × 180 + 3 gaps of 3 = 369 mm zone. Divider 387–405 above the floor (18). Shelves above 405.
 const model=cabinet(modern({...wardrobe,bayShelves:[2,0,0],bayDrawers:[2,0,0],drawerFrontHeight:180,drawerGap:3,drawerBoxHeight:130}));
 const bay=model.bays[0];
 assert.deepEqual(bay.drawers.map(d=>[d.bottom,d.top]),[[21,201],[204,384]]);
 assert.deepEqual(bay.divider,{bottom:387,top:405});
 const divider=byKind(model,'fixedShelf');assert.equal(divider.length,1);
 const shelves=byKind(model,'shelf').filter(p=>p.bay===0);
 for(const s of shelves)assert.ok(s.position.y-9>=405,'shelf above divider');
 const fronts=byKind(model,'drawerFront');
 for(const f of fronts){const top=f.position.y+f.length/2;assert.ok(top<=387+1e-9,'front below divider')}
 // Box height 130 must leave 30 mm under a 180 mm front (limit 150): 160 is rejected.
 assert.throws(()=>cabinet(modern({...wardrobe,bayDrawers:[2,0,0],drawerFrontHeight:180,drawerBoxHeight:160})),/box height/);
 // Explicit shelf levels below the divider are rejected rather than moved.
 assert.throws(()=>cabinet(modern({...wardrobe,bayDrawers:[2,0,0],bayShelfLevels:[[300],null,null]})),/overlaps/);
});

test('shelf levels and hanging rail follow the requested heights',()=>{
 // Levels are top-face heights above the interior floor (18): level 1000 → centre 18 + 1000 − 9 = 1009.
 const model=cabinet(modern({...wardrobe,bayShelfLevels:[[1000,1700],null,null],bayRails:[1600,0,0]}));
 assert.deepEqual(byKind(model,'shelf').filter(p=>p.bay===0).map(p=>p.position.y),[1009,1709]);
 assert.deepEqual(model.bays[0].shelfLevels,[1000,1700]);
 const rail=model.accessories.find(a=>a.kind==='hangingRail');
 assert.deepEqual([rail.length,rail.level,rail.position.y],[776,1600,1618]);
 // Rail at 1660 → y 1678; shelf at level 1700 has its underside at 18 + 1700 − 18 = 1700: only 22 mm gap (40 required).
 assert.throws(()=>cabinet(modern({...wardrobe,bayShelfLevels:[[1000,1700],null,null],bayRails:[1660,0,0]})),/hanging rail/);
 assert.throws(()=>cabinet(modern({...wardrobe,bayShelfLevels:[[2500],null,null]})),/above the interior top/);
});

test('drawer slides: largest configured length that fits, explicit error instead of a 250 mm fallback',()=>{
 const slide=depth=>cabinet(modern({...wardrobe,depth,bayDrawers:[1,0,0]})).accessories.find(a=>a.kind==='drawerSlide').length;
 // Inset 6 mm back, 10 mm rear clearance: available = depth − 16.
 assert.equal(slide(600),550);// 584 available
 assert.equal(slide(350),300);// 334
 assert.equal(slide(280),250);// 264
 assert.throws(()=>slide(260),/No drawer slide fits: available depth 244/);
 assert.throws(()=>cabinet(modern({...wardrobe,bayDrawers:[1,0,0],drawerSlideMode:'fixed',drawerSlideLength:600})),/exceeds available depth 584/);
 const box=byKind(cabinet(modern({...wardrobe,bayDrawers:[1,0,0]})),'drawerSide')[0];
 assert.equal(box.length,550);
});

test('internal drawers sit behind doors and external drawers cannot hide behind full-height doors',()=>{
 assert.throws(()=>cabinet(modern({...wardrobe,doors:2,bayDrawers:[2,0,0]})),/overlap full-height doors/);
 assert.ok(cabinet(modern({...wardrobe,doors:0,drawerStyle:'internal',bayDrawers:[2,0,0]})).warnings.some(w=>w.code==='INTERNAL_DRAWERS_WITHOUT_DOORS'));
 const model=cabinet(modern({...wardrobe,doors:2,drawerStyle:'internal',bayDrawers:[2,0,0],internalDrawerSetback:20}));
 assert.equal(byKind(model,'drawerFront').length,0);
 const face=byKind(model,'drawerFace')[0];
 assert.ok(face.position.z+face.thickness/2<=300-20+1e-9,'box front behind the setback line');
});

test('door, drawer box and back materials are independent; glass doors are real glass parts',()=>{
 const model=cabinet(modern({...wardrobe,doors:2,drawerStyle:'internal',bayDrawers:[1,0,0],doorMaterial:'Oak veneer 19',doorThickness:19,drawerBoxMaterial:'Birch ply 15',drawerBoxThickness:15,drawerBottomMaterial:'HDF 8',backMaterial:'HDF 3',backThickness:3}));
 assert.deepEqual(byKind(model,'door').map(p=>[p.material,p.thickness]),[['Oak veneer 19',19],['Oak veneer 19',19]]);
 assert.deepEqual(byKind(model,'drawerSide').map(p=>[p.material,p.thickness]),[['Birch ply 15',15],['Birch ply 15',15]]);
 assert.equal(byKind(model,'drawerBottom')[0].material,'HDF 8');
 assert.deepEqual([byKind(model,'back')[0].material,byKind(model,'back')[0].thickness],['HDF 3',3]);
 assert.equal(byKind(model,'side')[0].material,DEFAULTS.material);
 const glass=cabinet(modern({...wardrobe,doors:2,doorType:'glass',glassThickness:5,glassMaterial:'Tempered glass 5 mm'}));
 const door=byKind(glass,'door')[0];
 assert.deepEqual([door.material,door.thickness,door.sheetGood,door.bandLength],['Tempered glass 5 mm',5,false,0]);
 const sheets=layoutSheets(glass.parts,modern(wardrobe));
 assert.deepEqual(sheets.excluded.map(e=>e.id).sort(),byKind(glass,'door').map(p=>p.id).sort());
 assert.ok(glass.warnings.some(w=>w.code==='GLASS_DOOR_SUPPLIER'));
});

test('stable part identities survive topology edits elsewhere while display IDs may renumber',()=>{
 const a=cabinet(modern({...wardrobe,bayShelves:[2,1,0],bayDrawers:[2,0,0]}),'W1');
 const b=cabinet(modern({...wardrobe,bayShelves:[2,1,4],bayDrawers:[2,0,0]}),'W1');
 const uid=m=>m.parts.find(p=>p.kind==='drawerFront'&&p.bay===0&&p.slot===1);
 assert.equal(uid(a).uid,'W1/drawerFront:0:1');assert.equal(uid(a).uid,uid(b).uid);
 assert.notEqual(uid(a).id,uid(b).id,'display ID renumbers because three shelves were inserted before it');
 assert.equal(new Set(b.parts.map(p=>p.uid)).size,b.parts.length,'uids are unique');
});

test('every new part kind has 3D geometry and legacy files ignore the new rules',()=>{
 const model=cabinet(modern({...wardrobe,plinthHeight:100,bayDrawers:[2,0,0],bayShelves:[1,1,1]}));
 for(const p of model.parts)assert.equal(partSize(p).length,3);
 const legacy=cabinet({...DEFAULTS,bayShelves:[1,1],bayDrawers:[2,0]});
 assert.equal(legacy.rules.version,'rokadex-alpha-1.3.2');
 assert.ok(legacy.warnings.some(w=>w.code==='LEGACY_DRAWER_SHELF_OVERLAP'),'old overlap is reported, not silently re-laid-out');
 assert.equal(bayFrames(validate({...DEFAULTS})).length,2);
});
