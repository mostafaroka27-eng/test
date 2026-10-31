import test from 'node:test';
import assert from 'node:assert/strict';
import {dragPosition,otherFootprints,nudge} from './unit-drag.mjs';
import {unitFootprint,DEFAULT_ROOM} from './room.mjs';
import {DEFAULTS} from './engine.mjs';

const unit=(id,x,z,extra={})=>({id,name:id,type:'cabinet',x,z,finish:'oak',config:{...DEFAULTS,width:600,depth:560,height:850,...extra}});
const room={...DEFAULT_ROOM,width:4000,depth:3000,height:2700};

test('drag: 10 mm grid, free move with Alt, clamped to the project limit',()=>{
 assert.deepEqual(dragPosition({room:null,unit:unit('A',0,0),x:123.4,z:-7}),{x:120,z:-10,snapped:[]});
 assert.deepEqual(dragPosition({room:null,unit:unit('A',0,0),x:123.4,z:-7,free:true}),{x:123,z:-7,snapped:[]});
 assert.equal(dragPosition({room:null,unit:unit('A',0,0),x:5e6,z:0,free:true}).x,100000);
 assert.throws(()=>dragPosition({room,unit:unit('A',0,0),x:NaN,z:0}),/Invalid drag/);
});

test('drag: snaps flush to a wall within 60 mm, not beyond',()=>{
 const u=unit('A',0,0),b=unitFootprint(u),halfW=(b.right-b.left)/2;
 const near=dragPosition({room,unit:u,x:-room.width/2+halfW+40,z:0});
 const nb=unitFootprint({...u,x:near.x,z:near.z});
 assert.ok(Math.abs(nb.left+room.width/2)<0.11,`left edge ${nb.left}`);assert.ok(near.snapped.includes('wall:left'));
 const far=dragPosition({room,unit:u,x:-room.width/2+halfW+200,z:0});
 assert.ok(!far.snapped.includes('wall:left'));
});

test('drag: butts against a neighbour and lines up the backs; stacked units line up sides',()=>{
 const a=unit('A',0,0),others=otherFootprints([a,unit('B',0,0)],'B');
 assert.deepEqual(others.map(o=>o.id),['A']);
 const ob=others[0],b=unit('B',0,0);
 const p=dragPosition({room:null,unit:b,x:640,z:25,others});
 const fb=unitFootprint({...b,x:p.x,z:p.z});
 assert.ok(Math.abs(fb.left-ob.right)<0.11,'sides touch');assert.ok(Math.abs(fb.back-ob.back)<0.11,'backs line up');
 assert.deepEqual(p.snapped,['unit:A']);
 // A wall unit above (no shared height) lines up with the base unit's sides instead of butting against it.
 const wall=unit('W',0,0,{height:720,depth:320});wall.elevation=1450;
 const q=dragPosition({room:null,unit:wall,x:30,z:-100,others});
 const fw=unitFootprint({...wall,x:q.x,z:q.z});
 assert.ok(Math.abs(fw.left-ob.left)<0.11&&Math.abs(fw.back-ob.back)<0.11);
});

test('arrow nudge: 10 mm, 100 mm with Shift, other keys ignored',()=>{
 assert.deepEqual(nudge('ArrowLeft',false),[-10,0]);assert.deepEqual(nudge('ArrowDown',true),[0,100]);assert.equal(nudge('a',false),null);
});

import {accessoryModel,MODEL_TYPES} from './accessory-models.mjs';
import {ACCESSORY_KEYS} from './accessories.mjs';
test('every accessory type has a 3D model marked display-only',()=>{
 assert.deepEqual([...MODEL_TYPES].sort(),[...ACCESSORY_KEYS].sort());
 for(const type of MODEL_TYPES){
  const g=accessoryModel(type,[600,400,500]);g.updateMatrixWorld(true);
  let meshes=0;g.traverse(o=>{if(o.isMesh)meshes++});assert.ok(meshes>0,type);
  assert.equal(g.userData.visualOnly,true);
 }
});
