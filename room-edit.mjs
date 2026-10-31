import {validateRoom,wallLength} from './room.mjs';

/**
 * Direct room editing (SketchUp-style "push" on walls, sliding doors and windows). The room stays centred on
 * the origin, so moving one wall shifts every unit and item by half the change to keep them where they are
 * relative to the opposite wall; door/window offsets are kept in the same real place. Pure functions.
 */
const ROUND=10;
const snap=v=>Math.round(v/ROUND)*ROUND;

/** Which wall a point (mm, world) on or near the walls belongs to. */
export function nearestWall(room,{x,z}){
 const d={back:Math.abs(z+room.depth/2),front:Math.abs(z-room.depth/2),left:Math.abs(x+room.width/2),right:Math.abs(x-room.width/2)};
 return Object.entries(d).sort((a,b)=>a[1]-b[1])[0][0];
}

/** Distance along a wall from its start, matching the opening offsets (back/front from the left, left/right from the back). */
export function alongWall(room,wall,{x,z}){
 return wall==='back'||wall==='front'?x+room.width/2:z+room.depth/2;
}

/** Index of the door or window under a point on a wall, or -1. */
export function openingAt(room,wall,point){
 const s=alongWall(room,wall,point);
 return (room.openings??[]).findIndex(o=>o.wall===wall&&s>=o.offset-20&&s<=o.offset+o.width+20&&point.y>=o.sill-20&&point.y<=o.sill+o.height+20);
}

/**
 * Moves `wall` so its inner face sits at `coord` (x for left/right, z for back/front).
 * Returns {room, shift:{x,z}} where shift must be added to every unit/item position; throws when the
 * room would become invalid (under 500 mm, or a door/window no longer fits).
 */
export function moveWall(room,wall,coord){
 const r=structuredClone(room),shift={x:0,z:0};let delta;
 if(wall==='right'){delta=snap(coord-room.width/2);r.width=room.width+delta;shift.x=-delta/2}
 else if(wall==='left'){delta=snap(-room.width/2-coord);r.width=room.width+delta;shift.x=delta/2;for(const o of r.openings??[])if(o.wall==='back'||o.wall==='front')o.offset+=delta}
 else if(wall==='front'){delta=snap(coord-room.depth/2);r.depth=room.depth+delta;shift.z=-delta/2}
 else if(wall==='back'){delta=snap(-room.depth/2-coord);r.depth=room.depth+delta;shift.z=delta/2;for(const o of r.openings??[])if(o.wall==='left'||o.wall==='right')o.offset+=delta}
 else throw Error('Unknown wall');
 for(const o of r.openings??[])if(o.offset<0)throw Error('A door or window would fall outside the wall');
 validateRoom(r);
 return {room:r,shift,delta};
}

/** Slides opening `index` along its wall to start at `offset` (10 mm steps, kept inside the wall). */
export function moveOpening(room,index,offset){
 const r=structuredClone(room),o=r.openings?.[index];if(!o)throw Error('No such door or window');
 o.offset=Math.max(0,Math.min(wallLength(r,o.wall)-o.width,snap(offset)));
 validateRoom(r);
 return r;
}
