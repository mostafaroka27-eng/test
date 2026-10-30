import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {referenceFacts,referenceRoomPresets,applyReferenceRoom} from './reference-data.mjs';

const roomData=JSON.parse(await readFile(new URL('./analysis/room-planner-data.json',import.meta.url),'utf8'));
test('reference room presets convert centimetres to millimetres without inventing a ceiling',()=>{
 const presets=referenceRoomPresets(roomData);assert.equal(presets.length,7);
 const kitchen=presets.find(preset=>preset.id==='kitchen');assert.equal(kitchen.width,3000);assert.equal(kitchen.depth,4000);
 const current={width:4200,depth:3600,height:2750},next=applyReferenceRoom(current,kitchen);
 assert.deepEqual(next,{width:3000,depth:4000,height:2750});assert.equal(current.width,4200);
});
test('fact extraction retains values and source paths, rejects executable/nonfinite data and bounds work',()=>{
 const facts=referenceFacts({tables:{A:{value:{name:'<script>x</script>',price:0,enabled:false}}}});
 assert.ok(facts.some(fact=>fact.path==='tables.A.value.price'&&fact.value==='0'));
 assert.ok(facts.some(fact=>fact.value==='<script>x</script>'));
 assert.throws(()=>referenceFacts({bad:()=>1}));assert.throws(()=>referenceFacts({bad:Infinity}));
 assert.throws(()=>referenceFacts({a:[1,2,3]},{limit:2}),/limit/);
 assert.throws(()=>applyReferenceRoom({width:500,depth:500,height:2800},{width:-1,depth:4000}));
});

test('PolyBoard sample retains the printed envelope, physical quantities and independently reported cost categories',async()=>{
 const sample=JSON.parse(await readFile(new URL('./analysis/polyboard-sample.json',import.meta.url),'utf8'));
 assert.deepEqual(sample.cabinet.dimensionsMm,{height:2000,width:2000,depth:500});
 assert.equal(sample.cutListGroups.length,12);assert.equal(sample.cutListGroups.reduce((sum,part)=>sum+part.quantity,0),30);
 for(const part of sample.cutListGroups){
  assert.equal(part.dimensionsMm.length,part.sourceDimensionsCm.height*10);
  assert.equal(part.dimensionsMm.width,part.sourceDimensionsCm.width*10);
  assert.equal(part.dimensionsMm.thickness,part.sourceDimensionsCm.thickness*10);
 }
 const cost=sample.costingReport;
 const total=cost.materialsTotal+cost.edgeTotal+cost.supplyFittingsTotal+cost.singlePanelSupplyTotal+cost.fittingToolingTotal+cost.singlePanelToolingTotal+cost.grooveToolingTotal;
 assert.ok(Math.abs(total-cost.grandTotal)<0.00001);assert.equal(cost.grandTotal,1455.21);
 assert.equal(sample.panelDetailPages.length,18);
 assert.notEqual(sample.recomputedChecks.materialAreasAndCosts[1].costFromPrintedDimensions,sample.recomputedChecks.materialAreasAndCosts[1].reportedCost);
});

test('every extracted JSON source can be browsed completely within the reference reader bounds',async()=>{
 const directory=new URL('./analysis/',import.meta.url);
 const files=(await readdir(directory)).filter(name=>name.endsWith('.json'));
 assert.equal(files.length,5);
 for(const name of files){const facts=referenceFacts(JSON.parse(await readFile(new URL(name,directory),'utf8')));assert.ok(facts.length>20&&facts.length<=12000,name)}
});
