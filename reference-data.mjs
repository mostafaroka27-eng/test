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
