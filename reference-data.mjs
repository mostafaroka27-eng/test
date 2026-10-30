import {validateRoom} from './room.mjs';

/** Literal reference facts only: no evaluation, rules execution or price approval. */
export function referenceFacts(data,{limit=12000}={}){
 const facts=[];
 function visit(value,path,depth){
  if(depth>24)throw Error('Reference nesting limit exceeded');
  if(value===null||['string','number','boolean'].includes(typeof value)){
   if(typeof value==='number'&&!Number.isFinite(value))throw Error('Invalid reference number');
   facts.push({path,value:value===null?'null':String(value)});
   if(facts.length>limit)throw Error('Reference fact limit exceeded');
  }else if(Array.isArray(value))value.forEach((entry,index)=>visit(entry,`${path}[${index}]`,depth+1));
  else if(value&&typeof value==='object'){
   for(const [key,entry] of Object.entries(value))visit(entry,path?`${path}.${key}`:key,depth+1);
  }else throw Error('Reference data must contain JSON values only');
 }
 visit(data,'',0);return facts;
}

export function referenceRoomPresets(data){
 const rooms=data?.tables?.ROOM_TYPES?.value;
 if(!rooms||typeof rooms!=='object')throw Error('Reference room table missing');
 return Object.entries(rooms).map(([id,room])=>{
  if(!room||typeof room.n!=='string'||![room.w,room.l].every(value=>Number.isFinite(value)&&value>0))throw Error('Invalid reference room');
  return {id,name:room.n,width:room.w*10,depth:room.l*10,sourceUnit:'cm'};
 });
}

export function applyReferenceRoom(current,preset){
 validateRoom(current);return validateRoom({width:preset.width,depth:preset.depth,height:current.height});
}

const MM_PER={mm:1,cm:10,m:1000};
/** Convert a source length to millimetres exactly once. A value already tagged as converted is returned unchanged. */
export function importLength(value,unit){
 if(value&&typeof value==='object'&&value.unit==='mm'&&typeof value.sourceUnit==='string')return value;
 if(!Object.hasOwn(MM_PER,unit))throw Error(`Unsupported source unit: ${unit}`);
 if(typeof value!=='number'||!Number.isFinite(value)||value<0)throw Error('Invalid source length');
 return {value:Math.round(value*MM_PER[unit]*100)/100,unit:'mm',sourceUnit:unit};
}

/** Room-planner furniture catalogue as planning blocks in mm. Heights absent from the source stay null — never invented. */
export function referenceFurniture(data){
 const items=data?.tables?.CATALOG?.value,unit=data?.units?.roomAndFurniture;
 if(!Array.isArray(items))throw Error('Reference furniture catalogue missing');
 if(unit!=='cm')throw Error('Reference furniture unit must be declared as cm');
 return items.map(item=>{
  if(!item||typeof item.t!=='string'||typeof item.n!=='string')throw Error('Invalid reference furniture item');
  const length=key=>Number.isFinite(item[key])?importLength(item[key],'cm').value:null;
  return {type:item.t,name:item.n,width:length('w'),depth:length('d'),height:length('h'),sourceUnit:'cm',heightSource:Number.isFinite(item.h)?'source':'missing',manufacturing:false};
 });
}
