import {unitFootprint} from './room.mjs';

/**
 * Where a unit lands when dragged on the floor to (x, z) mm.
 * Rounds to a 10 mm grid, then pulls the unit's footprint flush against a room wall or a
 * neighbouring unit's side when it comes within `snap` mm. `free` (Alt held) skips all snapping.
 * `others` are the footprints of the other units, taken once when the drag starts.
 * `footprint` turns a positioned object into its floor box (room items pass their own).
 * Returns {x, z, snapped:[...]} where snapped names what it locked to ('wall:left', 'unit:CAB-002', ...).
 */
export function dragPosition({room,unit,x,z,others=[],grid=10,snap=60,free=false,footprint=unitFootprint}){
 if(![x,z].every(Number.isFinite))throw Error('Invalid drag position');
 const clamp=v=>Math.max(-100000,Math.min(100000,v));
 if(free)return {x:clamp(Math.round(x)),z:clamp(Math.round(z)),snapped:[]};
 let nx=Math.round(x/grid)*grid,nz=Math.round(z/grid)*grid;const snapped=[];
 const b=footprint({...unit,x:nx,z:nz});
 // Best (smallest) correction per axis among walls and neighbours.
 let bestX=null,bestZ=null;
 const tryX=(delta,label)=>{if(Math.abs(delta)<=snap&&(!bestX||Math.abs(delta)<Math.abs(bestX.delta)))bestX={delta,label}};
 const tryZ=(delta,label)=>{if(Math.abs(delta)<=snap&&(!bestZ||Math.abs(delta)<Math.abs(bestZ.delta)))bestZ={delta,label}};
 if(room){
  tryX(-room.width/2-b.left,'wall:left');tryX(room.width/2-b.right,'wall:right');
  tryZ(-room.depth/2-b.back,'wall:back');tryZ(room.depth/2-b.front,'wall:front');
 }
 for(const o of others){
  const overlapZ=Math.min(b.front,o.front)-Math.max(b.back,o.back),overlapX=Math.min(b.right,o.right)-Math.max(b.left,o.left);
  const overlapY=Math.min(b.height,o.height)-Math.max(b.bottom,o.bottom),label=o.label??`unit:${o.id}`;
  if(overlapY>0){
   // Same height band, side by side: butt the sides together and line up the backs.
   if(overlapZ>0){tryX(o.left-b.right,label);tryX(o.right-b.left,label);tryZ(o.back-b.back,label)}
  }else if(overlapX>0){
   // Stacked (e.g. wall unit over a base unit): line up the sides and the backs.
   tryX(o.left-b.left,label);tryX(o.right-b.right,label);tryZ(o.back-b.back,label);
  }
 }
 if(bestX){nx+=bestX.delta;snapped.push(bestX.label)}
 if(bestZ){nz+=bestZ.delta;snapped.push(bestZ.label)}
 return {x:clamp(Math.round(nx*10)/10),z:clamp(Math.round(nz*10)/10),snapped:[...new Set(snapped)]};
}

/** Footprints of every unit except `id`, for neighbour snapping. */
export function otherFootprints(units,id){
 const out=[];for(const u of units)if(u.id!==id){try{out.push({id:u.id,...unitFootprint(u)})}catch{}}
 return out;
}

/** Arrow-key nudge: 10 mm, or 100 mm with Shift. Left/Right move along X, Up/Down along Z (Up = toward the back wall). */
export function nudge(key,shift){
 const step=shift?100:10;
 return {ArrowLeft:[-step,0],ArrowRight:[step,0],ArrowUp:[0,-step],ArrowDown:[0,step]}[key]??null;
}
