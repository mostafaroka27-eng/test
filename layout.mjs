/** Initial rectangular kitchen arrangements, not a cabinet/countertop installation design. */
import {DEFAULTS,cabinet} from './engine.mjs';
import {validateRoom,unitFootprint,snapUnitToWall,inspectLayout} from './room.mjs';

export function createKitchenLayout(room,options={}){
 validateRoom(room);
 const {shape='straight',count=3,width=600,depth=580,height=850,gap=5,config={}}=options;
 if(!['straight','l','u'].includes(shape))throw Error('Unknown kitchen shape');
 const legs=shape==='straight'?1:shape==='l'?2:3;
 if(!Number.isInteger(count)||count<legs||count>100)throw Error(`Kitchen requires ${legs}–100 cabinets`);
 if(!Number.isFinite(gap)||gap<0||gap>1000)throw Error('Kitchen gap must be 0–1000 mm');
 if(!config||typeof config!=='object'||Array.isArray(config))throw Error('Invalid kitchen configuration');
 const settings={...DEFAULTS,partitions:0,shelves:1,stockGrainAxis:'y',backConstruction:'inset',...config,width,depth,height};
 cabinet(settings,'KIT-CHECK');
 const counts=Array(legs).fill(Math.floor(count/legs));for(let i=0;i<count%legs;i++)counts[i]++;
 const units=[];
 const make=rotation=>({id:`KIT-${String(units.length+1).padStart(3,'0')}`,name:'Kitchen Base Unit',type:'cabinet',finish:'oak',x:0,z:0,rotation,config:structuredClone(settings)});
 const example=unitFootprint(make(0)),rowWidth=counts[0]*example.width+(counts[0]-1)*gap;
 if(rowWidth>room.width+0.01)throw Error('Kitchen back row does not fit room width');
 let cursor=-rowWidth/2;
 for(let i=0;i<counts[0];i++){
  const unit=make(0),b=unitFootprint(unit);unit.x=cursor-b.left;Object.assign(unit,snapUnitToWall(room,unit,'back'));units.push(unit);cursor+=b.width+gap;
 }
 // Side runs begin beyond the back run: no invented corner cabinet or hidden overlap.
 const start=Math.max(...units.map(unit=>unitFootprint(unit).front))+gap;
 for(let leg=1;leg<legs;leg++){
  let z=start;
  for(let i=0;i<counts[leg];i++){
   const unit=make(leg===1?90:270),b=unitFootprint(unit);unit.z=z-b.back;
   Object.assign(unit,snapUnitToWall(room,unit,leg===1?'left':'right'));units.push(unit);z+=b.depth+gap;
  }
 }
 const issues=inspectLayout(room,units);
 if(issues.length)throw Error('Kitchen does not fit room without boundary, height or overlap conflicts');
 return units;
}
