import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {assemblySteps,findPart,partLocation} from './assembly.mjs';
import {partRecords,labelPayload} from './manufacturing.mjs';
import {ncdTemplates} from './reference-catalog.mjs';
import {cabinet,DEFAULTS} from './engine.mjs';

const ncd=JSON.parse(await readFile(new URL('./analysis/ncd-data.json',import.meta.url),'utf8'));
const templates=ncdTemplates(ncd).templates;
const units=templates.slice(0,6).map((t,i)=>({id:`CAB-00${i+1}`,name:t.nameEn,finish:t.finish,config:t.config}));
const project={projectId:'PRJ-TEST',designRevision:2,name:'Test',units};

test('every generated part appears in exactly one assembly step',()=>{
 for(const unit of [...units,{id:'CAB-099',name:'Default',config:{...DEFAULTS}},{id:'CAB-098',name:'Loaded',config:{...DEFAULTS,height:850,partitions:1,doors:2,coverLeft:18,coverRight:18,topFiller:0,worktopThickness:38,plinthHeight:100,backConstruction:'groove',shelfMode:'adjustable',handleType:'bar'}}]){
  const ids=cabinet(unit.config,unit.id).parts.map(p=>p.id),steps=assemblySteps(unit);
  const listed=steps.flatMap(s=>s.parts);
  assert.equal(listed.length,new Set(listed).size,`${unit.id} lists a part twice`);
  assert.deepEqual([...listed].sort(),[...ids].sort(),`${unit.id} steps must cover every part`);
  assert.equal(steps[0].key,'check');
  steps.forEach((s,i)=>{assert.equal(s.n,i+1);assert.ok(s.title&&s.method)});
 }
});

test('steps and locations are written in Arabic too',()=>{
 const unit=units[0],steps=assemblySteps(unit,'ar');
 assert.match(steps[0].title,/[؀-ۿ]/);
 const part=cabinet(unit.config,unit.id).parts.find(p=>p.kind==='side');
 assert.match(partLocation(unit,part,'ar'),/[؀-ۿ]/);
});

test('a part is found by printed ID, uid or label payload, ignoring case and spaces',()=>{
 const part=cabinet(units[1].config,units[1].id).parts[2];
 for(const code of [part.id,part.id.toLowerCase(),` ${part.id} `,part.uid]){
  const r=findPart(units,code,'en','PRJ-TEST');
  assert.equal(r.unit.id,units[1].id);assert.equal(r.part.id,part.id);assert.ok(r.step.parts.includes(part.id));assert.ok(r.location);
 }
 const record=partRecords(project).find(r=>r.uid===part.uid);
 const r=findPart(units,labelPayload(record),'en','PRJ-TEST');
 assert.equal(r.part.id,part.id);assert.equal(r.stale,false);
});

test('labels from another project, changed sizes and unknown codes are reported',()=>{
 const record=partRecords(project)[0];
 assert.throws(()=>findPart(units,labelPayload({...record,projectId:'PRJ-OTHER'}),'en','PRJ-TEST'),/another project/);
 const r=findPart(units,labelPayload({...record,finishLength:record.finishLength+10}),'en','PRJ-TEST');
 assert.equal(r.stale,true);
 assert.throws(()=>findPart(units,'CAB-404-SIDE-001'),/No part/);
 assert.throws(()=>findPart(units,'  '),/Scan or type/);
});
