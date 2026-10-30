import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULTS} from './engine.mjs';
import {DEFAULT_COSTING,validateCosting,estimateProjectCost,costingCsv} from './costing.mjs';

const units=()=>[{id:'CAB-001',config:{...DEFAULTS,width:1000,height:1000,depth:500,thickness:20,backThickness:10,partitions:0,shelves:0,material:'MDF',backMaterial:'HDF'}}];
const rates=()=>({...DEFAULT_COSTING,currency:'USD',materials:[{material:'MDF',thickness:20,pricePerM2:20},{material:'HDF',thickness:10,pricePerM2:10}],edgeRate:2,wastePercent:10,laborHours:2,hourlyRate:15,hardwareCost:8,overheadPercent:10,profitMarginPercent:20});

test('costs actual area, edging, waste, labor, hardware, overhead and profit margin',()=>{
 const result=estimateProjectCost(units(),rates());
 assert.equal(result.complete,true);assert.deepEqual(result.missing,[]);assert.equal(result.edgeM,3.92);
 assert.equal(result.rows[0].areaM2,1.96);assert.equal(result.rows[0].billableAreaM2,2.156);
 assert.deepEqual(result.totals,{material:54.12,edge:7.84,labor:30,hardware:8,overhead:10,production:109.96,selling:137.45,profit:27.49});
 assert.equal(result.currency,'USD');
});
test('missing prices remain incomplete and cannot turn into a zero-cost quote',()=>{
 const result=estimateProjectCost(units(),DEFAULT_COSTING);
 assert.equal(result.complete,false);assert.equal(result.totals.material,null);assert.equal(result.totals.edge,null);
 assert.equal(result.totals.production,null);assert.equal(result.totals.selling,null);assert.equal(result.totals.profit,null);
 assert.equal(result.rows[0].rate,null);assert.equal(result.rows[0].cost,null);
 assert.equal(result.missing.length,3);
});
test('zero prices are explicit and hourly rates are needed only for nonzero hours',()=>{
 const settings=rates();settings.materials.forEach(row=>row.pricePerM2=0);settings.edgeRate=0;settings.laborHours=0;settings.hourlyRate=null;settings.hardwareCost=0;
 assert.equal(estimateProjectCost(units(),settings).complete,true);
 assert.equal(estimateProjectCost(units(),settings).totals.selling,0);
 settings.laborHours=1;assert.equal(estimateProjectCost(units(),settings).totals.labor,null);
 assert.ok(estimateProjectCost(units(),settings).missing.some(message=>message.includes('hourlyRate')));
});
test('validation rejects invalid rates, duplicates, currency and margins without mutating input',()=>{
 for(const key of ['edgeRate','wastePercent','laborHours','hourlyRate','hardwareCost','overheadPercent','profitMarginPercent']){
  for(const value of [-1,Infinity,NaN,'2'])assert.throws(()=>validateCosting({...rates(),[key]:value}));
 }
 assert.throws(()=>validateCosting({...rates(),profitMarginPercent:100}));
 for(const currency of ['','US','OMR,=1',12])assert.throws(()=>validateCosting({...rates(),currency}));
 assert.throws(()=>validateCosting({...rates(),materials:[{material:'MDF',thickness:20,pricePerM2:-1}]}));
 assert.throws(()=>validateCosting({...rates(),materials:[...rates().materials,rates().materials[0]]}));
 const input=rates(),copy=structuredClone(input),validated=validateCosting(input);validated.materials[0].pricePerM2=99;assert.deepEqual(input,copy);
});
test('rounds monetary rows before totals and preserves quantity precision',()=>{
 const settings=rates();settings.materials[0].pricePerM2=1.111;settings.materials[1].pricePerM2=2.222;settings.wastePercent=0;settings.edgeRate=0;settings.laborHours=0;settings.hardwareCost=0;settings.overheadPercent=0;settings.profitMarginPercent=0;
 const result=estimateProjectCost(units(),settings);
 assert.equal(result.rows[0].cost,2.18);assert.equal(result.rows[1].cost,2.22);assert.equal(result.totals.material,4.4);assert.equal(result.totals.production,4.4);
});
test('groups stock by exact material and thickness, rejects invalid unit lists and model inputs',()=>{
 const list=units();list.push({...list[0],id:'CAB-002'});
 assert.equal(estimateProjectCost(list,rates()).rows[0].areaM2,3.92);
 for(const bad of [null,[],[...list,list[0]],[{id:'BAD',config:{}}]])assert.throws(()=>estimateProjectCost(bad,rates()));
});
test('cost CSV escapes names and formulas and labels estimates and missing values honestly',()=>{
 const list=units();list[0].config.material='=SUM(1,2) "oak"';
 const result=estimateProjectCost(list,DEFAULT_COSTING),csv=costingCsv(result);
 assert.match(csv,/ESTIMATE/);assert.match(csv,/'=SUM\(1,2\) ""oak""/);assert.match(csv,/MISSING/);
 assert.doesNotMatch(csv,/"=SUM/);
});
test('rejects amounts beyond safe cent arithmetic instead of issuing a misleading quote',()=>{
 const list=Array.from({length:100},(_,index)=>({id:`CAB-${index}`,config:{...DEFAULTS,width:10000,height:10000,depth:10000,partitions:0,shelves:0,material:'MDF',backMaterial:'HDF'}}));
 const settings={...rates(),materials:[{material:'MDF',thickness:18,pricePerM2:1e9},{material:'HDF',thickness:6,pricePerM2:1e9}],wastePercent:1000,overheadPercent:1000,profitMarginPercent:99.99};
 assert.throws(()=>estimateProjectCost(list,settings),/safe monetary/);
});
test('currency minor units keep OMR baisa and quantize JPY amounts to whole yen',()=>{
 const omr=estimateProjectCost(units(),{...rates(),currency:'OMR'});
 assert.equal(omr.precision,3);
 assert.deepEqual(omr.totals,{material:54.12,edge:7.84,labor:30,hardware:8,overhead:9.996,production:109.956,selling:137.445,profit:27.489});
 const jpy=estimateProjectCost(units(),{...rates(),currency:'JPY'});
 assert.equal(jpy.precision,0);
 assert.deepEqual(jpy.totals,{material:54,edge:8,labor:30,hardware:8,overhead:10,production:110,selling:138,profit:28});
 assert.match(omr.basis,/3 decimal/);assert.match(jpy.basis,/0 decimal/);
 assert.match(costingCsv(omr),/"minor_unit_decimals","3"/);
 assert.match(costingCsv(omr),/"selling","137\.445"/);
 assert.match(costingCsv(jpy),/"selling","138"/);
});
test('monetary rows round to the selected minor unit before overhead and margin pricing',()=>{
 const settings={...rates(),currency:'OMR',materials:rates().materials.map(row=>({...row,pricePerM2:0})),edgeRate:0,laborHours:0,hardwareCost:1.2345,overheadPercent:10,profitMarginPercent:20};
 const result=estimateProjectCost(units(),settings);
 assert.equal(result.totals.hardware,1.235);assert.equal(result.totals.overhead,0.124);assert.equal(result.totals.production,1.359);assert.equal(result.totals.selling,1.699);assert.equal(result.totals.profit,0.34);
 const cents=estimateProjectCost(units(),{...settings,currency:'USD',hardwareCost:1.005,overheadPercent:0,profitMarginPercent:0});
 assert.equal(cents.precision,2);assert.equal(cents.totals.hardware,1.01);
});
test('safe range scales with the selected currency minor units',()=>{
 const settings={...rates(),materials:rates().materials.map(row=>({...row,pricePerM2:0})),edgeRate:0,laborHours:0,hardwareCost:1e9,overheadPercent:1000,profitMarginPercent:99.99};
 assert.ok(estimateProjectCost(units(),{...settings,currency:'JPY'}).totals.selling>1e13);
 assert.throws(()=>estimateProjectCost(units(),{...settings,currency:'OMR'}),/safe monetary/);
});
