/** Nominal-area estimate, not a supplier quote or manufacturing approval.
 * Currency values use Intl currency minor units: round each cost line before summing;
 * calculate overhead from direct cost, then price = production / (1 - margin).
 * Waste is an editable area allowance, not the sheet optimizer's waste result.
 */
import {cabinet} from './engine.mjs';

export const DEFAULT_COSTING=Object.freeze({currency:'USD',materials:Object.freeze([]),edgeRate:null,wastePercent:0,laborHours:0,hourlyRate:null,hardwareCost:0,overheadPercent:0,profitMarginPercent:0});
const monetaryRounder=precision=>value=>{
 if(!Number.isFinite(value))throw Error('Estimate exceeds safe monetary range');
 // Shift a decimal representation instead of multiplying binary floats; e.g. 1.005 USD -> 1.01.
 const [coefficient,exponent='0']=String(value).split('e');
 const minorUnits=Number(`${coefficient}e${Number(exponent)+precision}`);
 if(!Number.isFinite(minorUnits)||Math.abs(minorUnits)>Number.MAX_SAFE_INTEGER)throw Error('Estimate exceeds safe monetary range');
 return Math.round(minorUnits)/10**precision;
};
const quantity=value=>Math.round(value*1e6)/1e6;
const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const number=(value,name,max=1e9)=>{if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>max)throw Error(`Invalid ${name}: expected a number from 0 to ${max}`);return value};
const nullable=(value,name)=>value===null?null:number(value,name);
const stockKey=(material,thickness)=>JSON.stringify([material,thickness]);

export function validateCosting(input=DEFAULT_COSTING){
 if(!record(input))throw Error('Invalid costing settings');
 const settings={...DEFAULT_COSTING,...input};
 if(typeof settings.currency!=='string'||!/^[A-Z]{3}$/.test(settings.currency))throw Error('Currency must be three uppercase letters');
 if(!Array.isArray(settings.materials)||settings.materials.length>1000)throw Error('Invalid material price list');
 const seen=new Set();
 const materials=settings.materials.map(row=>{
  if(!record(row)||typeof row.material!=='string'||!row.material.trim()||row.material.length>200)throw Error('Invalid priced material name');
  number(row.thickness,'material thickness',10000);if(row.thickness===0)throw Error('Material thickness must be positive');
  const key=stockKey(row.material,row.thickness);if(seen.has(key))throw Error('Duplicate material price');seen.add(key);
  return {material:row.material,thickness:row.thickness,pricePerM2:nullable(row.pricePerM2,'material price')};
 });
 const result={currency:settings.currency,materials,edgeRate:nullable(settings.edgeRate,'edgeRate'),wastePercent:number(settings.wastePercent,'wastePercent',1000),laborHours:number(settings.laborHours,'laborHours',100000),hourlyRate:nullable(settings.hourlyRate,'hourlyRate'),hardwareCost:number(settings.hardwareCost,'hardwareCost'),overheadPercent:number(settings.overheadPercent,'overheadPercent',1000),profitMarginPercent:number(settings.profitMarginPercent,'profitMarginPercent',99.99)};
 return result;
}

export function estimateProjectCost(units,input=DEFAULT_COSTING){
 const settings=validateCosting(input);
 const precision=new Intl.NumberFormat('en',{style:'currency',currency:settings.currency}).resolvedOptions().maximumFractionDigits;
 const money=monetaryRounder(precision);
 if(!Array.isArray(units)||units.length<1||units.length>100)throw Error('Estimate requires 1–100 units');
 const groups=new Map(),ids=new Set();let edgeM=0,totalParts=0;
 for(const unit of units){
  if(!unit||typeof unit.id!=='string'||!unit.id||ids.has(unit.id))throw Error('Invalid or duplicate estimate unit ID');ids.add(unit.id);
  const model=cabinet(unit.config,unit.id);totalParts+=model.parts.length;if(totalParts>5000)throw Error('Estimate exceeds 5000 parts');
  for(const panel of model.parts){
   const key=stockKey(panel.material,panel.thickness),group=groups.get(key)||{material:panel.material,thickness:panel.thickness,areaM2:0};
   group.areaM2+=panel.length*panel.width/1e6;groups.set(key,group);edgeM+=panel.bandLength/1000;
  }
 }
 const prices=new Map(settings.materials.map(row=>[stockKey(row.material,row.thickness),row.pricePerM2]));
 const missing=[];
 const rows=[...groups.values()].map(group=>{
  const rate=prices.get(stockKey(group.material,group.thickness))??null,billable=group.areaM2*(1+settings.wastePercent/100);
  if(rate===null)missing.push(`Material price: ${group.material} / ${group.thickness} mm`);
  return {...group,areaM2:quantity(group.areaM2),billableAreaM2:quantity(billable),rate,cost:rate===null?null:money(billable*rate)};
 });
 const material=rows.some(row=>row.cost===null)?null:money(rows.reduce((sum,row)=>sum+row.cost,0));
 const edge=edgeM===0?0:settings.edgeRate===null?null:money(edgeM*settings.edgeRate);
 const labor=settings.laborHours===0?0:settings.hourlyRate===null?null:money(settings.laborHours*settings.hourlyRate);
 if(edge===null)missing.push('edgeRate');if(labor===null)missing.push('hourlyRate');
 const hardware=money(settings.hardwareCost),complete=missing.length===0;
 const direct=complete?money(material+edge+labor+hardware):null;
 const overhead=complete?money(direct*settings.overheadPercent/100):null;
 const production=complete?money(direct+overhead):null;
 const selling=complete?money(production/(1-settings.profitMarginPercent/100)):null;
 return {currency:settings.currency,precision,rows,edgeM:quantity(edgeM),missing,complete,totals:{material,edge,labor,hardware,overhead,production,selling,profit:complete?money(selling-production):null},basis:`Nominal panel area plus editable waste allowance; ${precision} decimal currency minor units. Not a supplier quote or manufacturing approval.`};
}

const csvCell=value=>{let text=value===null?'MISSING':String(value??'');if(/^[\s]*[=+@-]/.test(text))text="'"+text;return '"'+text.replaceAll('"','""')+'"'};
export function costingCsv(estimate){
 const amount=value=>value===null?null:value.toFixed(estimate.precision);
 const rows=[['# COST ESTIMATE — NOT A SUPPLIER QUOTE OR MANUFACTURING APPROVAL'],['currency',estimate.currency],['minor_unit_decimals',estimate.precision],['status',estimate.complete?'COMPLETE ESTIMATE':'INCOMPLETE — MISSING PRICES'],['material','thickness_mm','nominal_area_m2','billable_area_m2','price_per_m2','cost']];
 estimate.rows.forEach(row=>rows.push([row.material,row.thickness,row.areaM2,row.billableAreaM2,row.rate,amount(row.cost)]));
 rows.push(['edge_length_m',estimate.edgeM],['cost_category','amount']);
 for(const [category,value] of Object.entries(estimate.totals))rows.push([category,amount(value)]);
 estimate.missing.forEach(message=>rows.push(['MISSING',message]));
 rows.push(['basis',estimate.basis]);
 return rows.map(row=>row.map(csvCell).join(',')).join('\r\n');
}
