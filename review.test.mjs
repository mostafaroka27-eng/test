import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewProject,projectManufacturingCsv,partDrawingSvg} from './review.mjs';
import {DEFAULTS,cabinet} from './engine.mjs';
import {DEFAULT_ROOM} from './room.mjs';
const unit=(id='CAB-001',extra={})=>({id,name:'Cabinet',x:0,z:0,config:{...DEFAULTS,...extra}});
test('valid single unit produces coherent project summary and approval blockers',()=>{const r=reviewProject(DEFAULT_ROOM,[unit()]);assert.ok(r.parts.length>0);assert.equal(r.summary.units,1);assert.equal(r.summary.parts,r.parts.length);assert.ok(r.issues.some(i=>i.code==='MANUFACTURING_UNVERIFIED'));});
test('overlap and boundary warnings are represented in audit',()=>{const r=reviewProject(DEFAULT_ROOM,[unit('CAB-001'),unit('CAB-002')]);assert.ok(r.issues.some(i=>i.code==='ROOM_OVERLAP'));});
test('panels below floor appear as a dedicated project warning',()=>{
 const r=reviewProject(DEFAULT_ROOM,[unit('CAB-001',{doors:2,doorOverlay:20})]);
 assert.ok(r.issues.some(issue=>issue.code==='ROOM_FLOOR'&&issue.severity==='WARNING'));
});
test('oversized parts are explicit blockers',()=>{const r=reviewProject(DEFAULT_ROOM,[unit('CAB-001',{height:3500})]);assert.ok(r.issues.some(i=>i.code==='UNPLACED_PART'));});
test('doors and drawers in same bay trigger interference warning',()=>{const r=reviewProject(DEFAULT_ROOM,[unit('CAB-001',{doors:2,bayDrawers:[1,0]})]);assert.ok(r.issues.some(i=>i.code==='DOOR_DRAWER_CONFLICT'));});
test('project manufacturing CSV contains every part with no executable formulas',()=>{const r=reviewProject(DEFAULT_ROOM,[unit('CAB-001'),{...unit('CAB-002'),x:1300}]);const s=projectManufacturingCsv(r);assert.equal(s.split('\n').length,r.parts.length+2);assert.match(s,/CAB-002/);assert.match(s,/NOT APPROVED/);});
test('panel SVG contains dimensions, part id and review-only marking',()=>{const p=cabinet(DEFAULTS,'CAB-001').parts[0];const svg=partDrawingSvg(p);assert.match(svg,/CAB-001/);assert.match(svg,/NOT FOR FABRICATION/);assert.match(svg,/viewBox/);});
test('rejects empty projects and duplicate IDs',()=>{assert.throws(()=>reviewProject(DEFAULT_ROOM,[]));assert.throws(()=>reviewProject(DEFAULT_ROOM,[unit(),unit()]));});
import {projectSheetPlan,projectSheetCsv,projectSheetSvg} from './review.mjs';
test('project-level nesting combines identical materials across units into fewer sheets',()=>{
 const c={...DEFAULTS,width:400,height:600,depth:300,partitions:0,shelves:0,doors:0,sheetWidth:2440,sheetHeight:2440};
 const u1=unit('CAB-001',c),u2={...unit('CAB-002',c),x:1000};
 const plan=projectSheetPlan([u1,u2]);
 const separate=projectSheetPlan([u1]).sheets.length+projectSheetPlan([u2]).sheets.length;
 assert.ok(plan.sheets.length<separate);
 assert.equal(plan.unplaced.length,0);
 assert.equal(plan.sheets.reduce((n,s)=>n+s.placed.length,0),cabinet(c,u1.id).parts.length*2);
});
test('project nesting keeps sheet stock sizes separate and never overlaps placed parts',()=>{
 const a=unit('CAB-001',{sheetWidth:1220,sheetHeight:2440});
 const b={...unit('CAB-002',{sheetWidth:2440,sheetHeight:2440}),x:1500};
 const plan=projectSheetPlan([a,b]);
 for(const s of plan.sheets){for(let i=0;i<s.placed.length;i++){
  const p=s.placed[i];assert.ok(p.x>=0&&p.y>=0&&p.x+p.w<=s.width&&p.y+p.h<=s.height);
  for(let j=i+1;j<s.placed.length;j++){const q=s.placed[j];assert.ok(p.x+p.w<=q.x||q.x+q.w<=p.x||p.y+p.h<=q.y||q.y+q.h<=p.y,`overlap ${p.id} ${q.id}`)}
 }}
 assert.ok(new Set(plan.sheets.map(s=>s.width)).size>=2);
});
test('project sheet exports are explicitly review-only and CSV safe',()=>{
 const plan=projectSheetPlan([unit()]);
 assert.match(projectSheetCsv(plan),/NOT FOR FABRICATION/);
 assert.match(projectSheetSvg(plan),/NOT FOR FABRICATION/);
 assert.match(projectSheetSvg(plan),/<svg/);
});
test('project sheet batches keep incompatible stock grain axes separate',()=>{
 const config={width:400,height:600,depth:300,partitions:0,shelves:0,sheetWidth:2440,sheetHeight:2440};
 const units=[unit('AXIS-X',{...config,stockGrainAxis:'x'}),unit('AXIS-Y',{...config,stockGrainAxis:'y'}),unit('LEGACY',config)];
 const plan=projectSheetPlan(units);
 assert.equal(plan.unplaced.length,0);
 assert.deepEqual([...new Set(plan.sheets.map(s=>s.stockGrainAxis))].sort(),['legacy','x','y']);
 for(const sheet of plan.sheets){
  const prefixes=new Set(sheet.placed.map(p=>p.id.startsWith('AXIS-X')?'x':p.id.startsWith('AXIS-Y')?'y':'legacy'));
  assert.equal(prefixes.size,1);assert.ok(prefixes.has(sheet.stockGrainAxis));
 }
});
test('sheet exports retain dimensions and report stock grain axis and panel rotation',()=>{
 const plan=projectSheetPlan([unit('AXIS-Y',{stockGrainAxis:'y'})]);
 assert.equal(plan.unplaced.length,0);
 const csv=projectSheetCsv(plan),svg=projectSheetSvg(plan);
 assert.match(csv,/stock_grain_axis,rotated/);assert.match(csv,/"y","true"/);assert.match(svg,/stock grain Y/);
});
