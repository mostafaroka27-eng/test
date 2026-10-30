import test from 'node:test';
import assert from 'node:assert/strict';
import {validateRoom,inspectLayout,snapUnitToWall,roomPlanSvg,unitFootprint,alignToUnit} from './room.mjs';
import {DEFAULTS} from './engine.mjs';
const room={width:4200,depth:3600,height:2800};
const a={id:'CAB-001',x:-1300,z:-1200,config:{width:900,depth:580,height:2200}};
test('room dimensions must be positive and plausible',()=>{assert.deepEqual(validateRoom(room),room);assert.throws(()=>validateRoom({...room,width:0}));assert.throws(()=>validateRoom({...room,depth:Infinity}))});
test('layout reports no issues for a cabinet within boundaries',()=>{assert.equal(inspectLayout(room,[a]).length,0)});
test('layout detects overlap between separate units',()=>{const b={...a,id:'CAB-002',x:-1100};assert.ok(inspectLayout(room,[a,b]).some(x=>x.type==='overlap'))});
test('layout detects outside walls and above ceiling',()=>{const issues=inspectLayout(room,[{...a,x:2100,config:{...a.config,height:3000}}]);assert.ok(issues.some(x=>x.type==='boundary'));assert.ok(issues.some(x=>x.type==='height'))});
test('wall snap aligns cabinet footprint and rejects invalid wall',()=>{const b=snapUnitToWall(room,a,'back',20);assert.equal(b.z,-room.depth/2+a.config.depth/2+20);const r=snapUnitToWall(room,a,'right',0);assert.equal(r.x,room.width/2-a.config.width/2);assert.throws(()=>snapUnitToWall(room,a,'bad'))});
test('room plan svg contains unit and preliminary notice',()=>{const svg=roomPlanSvg(room,[a]);assert.match(svg,/CAB-001/);assert.match(svg,/4200/);assert.match(svg,/PRELIMINARY/);assert.match(svg,/<svg/)});

test('quarter-turn footprints rotate actual panel envelopes with Three.js axes',()=>{
 const unit={...a,x:0,z:0,config:{...DEFAULTS,width:900,depth:580,doors:2}};
 const flat=unitFootprint(unit),right=unitFootprint({...unit,rotation:90}),reverse=unitFootprint({...unit,rotation:180});
 assert.equal(flat.width,900);assert.equal(flat.depth,598);
 assert.equal(right.width,598);assert.equal(right.depth,900);
 assert.equal(right.left,-290);assert.equal(right.right,308);
 assert.equal(reverse.back,-308);assert.equal(reverse.front,290);
 assert.throws(()=>unitFootprint({...unit,rotation:45}),/rotation/i);
});
test('snap and room conflicts include the actual door protrusion',()=>{
 const unit={...a,x:0,z:0,config:{...DEFAULTS,doors:2}};
 const nominal={...unit,z:room.depth/2-unit.config.depth/2};
 assert.ok(inspectLayout(room,[nominal]).some(issue=>issue.type==='boundary'));
 const snapped={...unit,...snapUnitToWall(room,unit,'front',12)};
 assert.equal(unitFootprint(snapped).front,room.depth/2-12);
 assert.deepEqual(inspectLayout(room,[snapped]),[]);
 const rotated={...unit,rotation:90,...snapUnitToWall(room,{...unit,rotation:90},'right')};
 assert.equal(unitFootprint(rotated).right,room.width/2);
});
test('alignment places actual envelopes adjacent with a controlled gap',()=>{
 const reference={...a,x:0,z:0,config:{...DEFAULTS,doors:2}};
 const selected={...reference,id:'CAB-002',rotation:90,x:1200,z:500};
 const right={...selected,...alignToUnit(selected,reference,'right',25)};
 assert.equal(unitFootprint(right).left-unitFootprint(reference).right,25);
 assert.equal((unitFootprint(right).back+unitFootprint(right).front)/2,(unitFootprint(reference).back+unitFootprint(reference).front)/2);
 assert.throws(()=>alignToUnit(selected,reference,'bad'),/side/i);
 assert.throws(()=>alignToUnit(selected,reference,'left',-1),/gap/i);
});
test('room SVG exposes safe keyboard-selectable actual footprints',()=>{
 const unit={...a,id:'CAB-<unsafe>"',name:'Cupboard <script>',rotation:90,config:{...DEFAULTS,doors:2}};
 const svg=roomPlanSvg(room,[unit]);
 assert.match(svg,/data-unit="CAB-&lt;unsafe&gt;&quot;"/);
 assert.match(svg,/role="button" tabindex="0"/);
 assert.doesNotMatch(svg,/<script>/);
 assert.match(svg,/data-rotation="90"/);
});

test('all quarter-turns snap full envelopes to every wall without mutating the input',()=>{
 for(const rotation of [0,90,180,270]){
  const unit={id:'TEST',x:123.5,z:-98.25,rotation,config:{...DEFAULTS,width:750.25,depth:583.5,doors:2}},before=structuredClone(unit);
  for(const wall of ['back','front','left','right']){
   const snapped={...unit,...snapUnitToWall(room,unit,wall,13)},b=unitFootprint(snapped);
   const actual={back:b.back,front:b.front,left:b.left,right:b.right}[wall],expected={back:-room.depth/2+13,front:room.depth/2-13,left:-room.width/2+13,right:room.width/2-13}[wall];
   assert.ok(Math.abs(actual-expected)<1e-8,`${rotation}° ${wall} ${actual} != ${expected}`);
   assert.deepEqual(inspectLayout(room,[snapped]),[]);
  }
  assert.deepEqual(unit,before);
 }
});

test('invalid alignment is atomic and valid alignment respects each full-envelope side',()=>{
 const reference={...a,x:11,z:22,rotation:270,config:{...DEFAULTS,width:700,doors:2}},unit={...a,id:'CAB-002',rotation:90,config:{...DEFAULTS,width:800,doors:2}},before=structuredClone(unit);
 const target=unitFootprint(reference);
 for(const side of ['left','right','back','front']){
  const b=unitFootprint({...unit,...alignToUnit(unit,reference,side,17)});
  const actual={left:target.left-b.right,right:b.left-target.right,back:target.back-b.front,front:b.back-target.front}[side];
  assert.ok(Math.abs(actual-17)<1e-8,side);
 }
 for(const gap of [-1,NaN,Infinity,100001])assert.throws(()=>alignToUnit(unit,reference,'left',gap));
 assert.deepEqual(unit,before);
 assert.deepEqual(reference,{...a,x:11,z:22,rotation:270,config:{...DEFAULTS,width:700,doors:2}});
});

test('door overlays below floor produce a distinct vertical boundary warning',()=>{
 const standard={...a,x:0,z:0,config:{...DEFAULTS,doors:2}},lower={...standard,config:{...standard.config,doorOverlay:20}};
 assert.deepEqual(inspectLayout(room,[standard]),[]);
 const issues=inspectLayout(room,[lower]);
 assert.equal(unitFootprint(lower).bottom,-17);
 assert.ok(issues.some(issue=>issue.type==='floor'&&issue.units[0]===lower.id));
});
