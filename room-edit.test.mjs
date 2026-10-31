import test from 'node:test';
import assert from 'node:assert/strict';
import {nearestWall,alongWall,openingAt,moveWall,moveOpening} from './room-edit.mjs';
import {ROOM_ITEMS,ROOM_ITEM_TYPES,validateItems,itemFootprint,nextItemId,itemModel} from './room-items.mjs';
import {parseProject} from './project.mjs';
import {DEFAULT_ROOM} from './room.mjs';
import {DEFAULTS} from './engine.mjs';

const room=()=>({width:4000,depth:3000,height:2700,openings:[{wall:'back',type:'window',offset:1000,width:1200,height:1200,sill:900},{wall:'left',type:'door',offset:500,width:900,height:2100,sill:0}]});

test('room edit: finds the wall and the door/window under a point',()=>{
 const r=room();
 assert.equal(nearestWall(r,{x:0,z:-1490}),'back');assert.equal(nearestWall(r,{x:1995,z:0}),'right');
 assert.equal(alongWall(r,'back',{x:-1000,z:-1500}),1000);assert.equal(alongWall(r,'left',{x:-2000,z:0}),1500);
 assert.equal(openingAt(r,'back',{x:-400,y:1500,z:-1500}),0);
 assert.equal(openingAt(r,'back',{x:-400,y:300,z:-1500}),-1,'below the window sill');
 assert.equal(openingAt(r,'left',{x:-2000,y:1000,z:-500}),1);
});

test('room edit: pushing the right or front wall grows the room and keeps units in place against the far wall',()=>{
 const out=moveWall(room(),'right',2503);
 assert.equal(out.room.width,4500);assert.equal(out.delta,500);assert.deepEqual(out.shift,{x:-250,z:0});
 // Back-wall openings measured from the left keep their real place (left wall did not move).
 assert.equal(out.room.openings[0].offset,1000);
 const f=moveWall(room(),'front',1000);assert.equal(f.room.depth,2500);assert.deepEqual(f.shift,{x:0,z:250});
});

test('room edit: moving the left or back wall shifts openings that are measured from it',()=>{
 const l=moveWall(room(),'left',-2300);
 assert.equal(l.room.width,4300);assert.equal(l.shift.x,150);assert.equal(l.room.openings[0].offset,1300);assert.equal(l.room.openings[1].offset,500);
 const b=moveWall(room(),'back',-1400);
 assert.equal(b.room.depth,2900);assert.equal(b.room.openings[1].offset,400);assert.equal(b.room.openings[0].offset,1000);
});

test('room edit: refuses a room under 500 mm or one that cuts through a door/window',()=>{
 assert.throws(()=>moveWall(room(),'right',-1700),/Invalid room width/);
 assert.throws(()=>moveWall(room(),'right',100),/runs past the end/);
 assert.throws(()=>moveWall(room(),'left',-900),/outside the wall/);
 assert.throws(()=>moveWall(room(),'up',0),/Unknown wall/);
 const before=room();moveWall(before,'right',2500);assert.equal(before.width,4000,'input is not mutated');
});

test('room edit: sliding a door/window stays on its wall, in 10 mm steps',()=>{
 assert.equal(moveOpening(room(),0,2034).room?.openings,undefined);
 assert.equal(moveOpening(room(),0,2034).openings[0].offset,2030);
 assert.equal(moveOpening(room(),0,-300).openings[0].offset,0);
 assert.equal(moveOpening(room(),0,9999).openings[0].offset,4000-1200);
 assert.equal(moveOpening(room(),1,9999).openings[1].offset,3000-900);
 assert.throws(()=>moveOpening(room(),5,0),/No such/);
});

test('room items: validated, saved only when present, never part of cutting',()=>{
 assert.ok(ROOM_ITEM_TYPES.length>=14);
 for(const t of ROOM_ITEM_TYPES){const g=itemModel(t);assert.ok(g.children.length>0,t);const s=ROOM_ITEMS[t];assert.ok(s.en&&s.ar&&s.w>0&&s.h>0&&s.d>0,t)}
 assert.deepEqual(validateItems([{id:'ITM-001',type:'fridge',x:12.34,z:-5,rotation:90}]),[{id:'ITM-001',type:'fridge',x:12.3,z:-5,rotation:90}]);
 assert.throws(()=>validateItems([{id:'A',type:'spaceship',x:0,z:0}]),/Unknown room item/);
 assert.throws(()=>validateItems([{id:'A',type:'bed',x:0,z:0},{id:'A',type:'bed',x:0,z:0}]),/unique ids/);
 assert.throws(()=>validateItems([{id:'A',type:'bed',x:0,z:0,rotation:45}]),/rotation/);
 assert.throws(()=>validateItems([{id:'A',type:'bed',x:Infinity,z:0}]),/position/);
 const fp=itemFootprint({type:'sofa',x:0,z:0,rotation:90});assert.equal(fp.width,900);assert.equal(fp.depth,2100);
 assert.equal(nextItemId([{id:'ITM-001'},{id:'ITM-002'}]),'ITM-003');
 const base={format:'rokadex-standalone',version:3,projectId:'PRJ-T',designRevision:1,lengthUnit:'mm',room:{...DEFAULT_ROOM},units:[{id:'A',name:'Unit',type:'cabinet',x:0,z:0,finish:'oak',config:{...DEFAULTS}}]};
 assert.equal(Object.hasOwn(parseProject(base),'items'),false);
 assert.equal(Object.hasOwn(parseProject({...base,items:[]}),'items'),false);
 const withItems=parseProject({...base,items:[{id:'ITM-001',type:'bed',x:100,z:200}]});
 assert.deepEqual(withItems.items,[{id:'ITM-001',type:'bed',x:100,z:200,rotation:0}]);
 assert.deepEqual(parseProject(base).units,withItems.units,'items do not touch the units');
});
