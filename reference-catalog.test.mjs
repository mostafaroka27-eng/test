import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {referenceCatalog,ncdTemplates,referenceFinishes,isFinish,finishColor} from './reference-catalog.mjs';
import {cabinet} from './engine.mjs';
import {parseProject} from './project.mjs';

const load=async name=>JSON.parse(await readFile(new URL(`./analysis/${name}`,import.meta.url),'utf8'));
const ncd=await load('ncd-data.json'),planner=await load('room-planner-data.json');
const byKey=list=>Object.fromEntries(list.map(t=>[t.key,t]));

test('every supported NCD column template becomes a valid cabinet; unsupported ones are reported, not faked',()=>{
 const {templates,skipped}=ncdTemplates(ncd);
 assert.deepEqual(templates.map(t=>t.key),['hang','shelves','drawHang','drawShelf','combo','open','glass']);
 assert.deepEqual(skipped.map(s=>s.key),['hang2']);
 for(const t of templates)assert.doesNotThrow(()=>cabinet(t.config,t.id));
});

test('template dimensions and construction come from the NCD defaults',()=>{
 const t=byKey(ncdTemplates(ncd).templates);
 for(const template of Object.values(t)){
  const c=template.config;
  assert.equal(c.height,2400);assert.equal(c.depth,600);assert.equal(c.thickness,18);assert.equal(c.plinthHeight,100);
  assert.equal(c.backConstruction,'overlay');assert.equal(c.backThickness,3);assert.equal(c.shelfMode,'adjustable');assert.equal(c.shelfFrontSetback,20);
  assert.equal(c.doorGap,3);assert.equal(c.edgeThickness,1);assert.equal(c.doorEdgeThickness,2);assert.equal(c.sheetHeight,2440);assert.equal(c.sheetWidth,1220);
  assert.equal(c.bayMode,'separate');assert.equal(c.edgeDeduction,'on');
 }
 assert.equal(t.combo.config.width,1200);assert.equal(t.combo.config.partitions,1);assert.equal(t.combo.config.doors,2);
 assert.equal(t.open.config.doors,0);assert.equal(t.glass.config.doorType,'glass');
 assert.equal(t.hang.finish,'#f1f0eb');
});

test('template interiors produce the expected parts and accessories',()=>{
 const t=byKey(ncdTemplates(ncd).templates);
 const hang=cabinet(t.hang.config,'H');assert.equal(hang.accessories.filter(a=>a.kind==='hangingRail'||/rail/i.test(a.kind)).length,1);
 const drawHang=cabinet(t.drawHang.config,'D');assert.equal(drawHang.parts.filter(p=>p.kind==='drawerFace').length,3);
 assert.equal(t.drawHang.config.drawerStyle,'internal');
 const combo=cabinet(t.combo.config,'C');assert.equal(combo.bays.length,2);
 const glass=cabinet(t.glass.config,'G');assert.ok(glass.parts.some(p=>p.sheetGood===false));
});

test('finishes come from both sources, de-duplicated, and are valid project finishes',()=>{
 const groups=referenceFinishes(ncd,planner);
 assert.deepEqual(groups.map(g=>g.label),['Finishes','Colours','Room colours']);
 const colours=groups.flatMap(g=>g.finishes.map(f=>f.color));
 assert.equal(new Set(colours).size,colours.length);
 for(const c of colours)assert.ok(isFinish(c));
 assert.ok(isFinish('oak'));assert.ok(!isFinish('gold'));assert.equal(finishColor('#abcdef'),'#abcdef');assert.equal(finishColor('bad'),finishColor('oak'));
});

test('a project with a template unit and reference finish round-trips',()=>{
 const {templates,rooms}=referenceCatalog({ncd,planner});
 assert.equal(rooms.length,7);
 const project=parseProject({format:'rokadex-standalone',version:3,projectId:'prj-test',designRevision:1,lengthUnit:'mm',room:{width:4000,depth:4200,height:2800},units:[{id:'CAB-001',name:'t',type:'cabinet',x:0,z:0,finish:templates[0].finish,config:templates[2].config}]});
 assert.equal(project.units[0].finish,'#f1f0eb');
 assert.deepEqual(project.units[0].config.bayDrawers,[3]);
 assert.throws(()=>parseProject({...project,units:[{...project.units[0],finish:'javascript:x'}]}),/finish/);
});
