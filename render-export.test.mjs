import test from 'node:test';
import assert from 'node:assert/strict';
import {normalExport,exportSize,exportFileName,framePreset,validateViews,CAMERA_PRESETS,MAX_VIEWS} from './render-export.mjs';
import {parseProject,serializeProject} from './project.mjs';
import {partRecords,manufacturingCsv} from './manufacturing.mjs';
import {DEFAULTS} from './engine.mjs';
import {DEFAULT_ROOM} from './room.mjs';

test('export options: sizes, formats, no transparency for JPEG, no AO on transparent frames',()=>{
 assert.deepEqual(normalExport(),{resolution:'fhd',format:'png',transparent:false,ao:true});
 assert.equal(normalExport({format:'jpeg',transparent:true}).transparent,false);
 assert.deepEqual(normalExport({format:'webp',transparent:true,ao:true}),{resolution:'fhd',format:'webp',transparent:true,ao:false});
 assert.throws(()=>normalExport({resolution:'8k'}));assert.throws(()=>normalExport({format:'tiff'}));
 assert.deepEqual(exportSize('4k'),[3840,2160]);assert.deepEqual(exportSize('2k'),[2560,1440]);
 assert.deepEqual(exportSize('screen',[1203.6,700.2]),[1204,700]);
 assert.throws(()=>exportSize('4k',undefined,2048),/at most 2048/);
 assert.equal(exportFileName('PRJ-AB12','Kitchen overview',{resolution:'4k',format:'jpeg'}),'PRJ-AB12-Kitchen-overview-3840x2160.jpg');
 assert.equal(exportFileName('PRJ-AB12','مطبخ',{format:'webp'}),'PRJ-AB12-view-1920x1080.webp');
});

test('camera presets frame the whole box from the expected side',()=>{
 const box={min:[-1500,0,-300],max:[1500,2200,300]},center=[0,1100,0];
 for(const preset of CAMERA_PRESETS){
  const {position,target}=framePreset(preset,box,{fov:42,aspect:16/9});
  assert.ok(position.every(Number.isFinite)&&target.every(Number.isFinite),preset);
  if(preset!=='eye'){
   assert.deepEqual(target,center);
   // Fitted distance keeps the bounding sphere inside the narrower field of view.
   const r=Math.hypot(3000,2200,600)/2,d=Math.hypot(...position.map((v,i)=>v-center[i]));
   assert.ok(d>=r/Math.sin(21*Math.PI/180)*0.99,`${preset} too close`);
  }
 }
 assert.ok(framePreset('front',box).position[2]>300);assert.equal(framePreset('front',box).position[0],0);
 assert.ok(framePreset('side',box).position[0]>1500);
 assert.ok(framePreset('top',box).position[1]>2200);
 const eye=framePreset('eye',box);assert.equal(eye.position[1],1600);assert.ok(eye.position[2]>300);
 assert.throws(()=>framePreset('under',box));assert.throws(()=>framePreset('front',{min:[0,0,0],max:[NaN,1,1]}));
});

test('saved views are validated and survive a project save; empty lists are not written',()=>{
 const view={name:'Overview',position:[2200,1800,2800],target:[0,900,0],fov:42};
 assert.deepEqual(validateViews([view]),[view]);
 assert.throws(()=>validateViews([view,view]),/Two saved views/);
 assert.throws(()=>validateViews([{...view,name:''}]));
 assert.throws(()=>validateViews([{...view,position:[0,Infinity,0]}]));
 assert.throws(()=>validateViews([{...view,fov:5}]));
 assert.throws(()=>validateViews(Array.from({length:MAX_VIEWS+1},(_,i)=>({...view,name:'V'+i}))));
 const project={format:'rokadex-standalone',version:3,projectId:'PRJ-TEST',designRevision:1,lengthUnit:'mm',room:{...DEFAULT_ROOM},units:[{id:'CAB-001',name:'Base',type:'cabinet',x:0,z:0,finish:'oak',config:{...DEFAULTS}}]};
 const csv=manufacturingCsv(project),parts=JSON.stringify(partRecords(project));
 const withViews=parseProject(serializeProject({...project,views:[view,{...view,name:'Eye',fov:55}]}));
 assert.equal(withViews.views.length,2);assert.deepEqual(withViews.views[0],view);
 assert.doesNotMatch(serializeProject({...project,views:[]}),/"views"/);
 // Presentation data never reaches manufacturing outputs.
 assert.equal(manufacturingCsv(withViews),csv);assert.equal(JSON.stringify(partRecords(withViews)),parts);
});

import {wallPieces,buildInteriorRoom,updateCutaway} from './room-look.mjs';
import {validateLighting,DEFAULT_LIGHTING} from './lighting.mjs';
test('realistic room: walls are cut around doors and windows, camera-side walls hide, settings validated',()=>{
 assert.deepEqual(wallPieces(4000,2700,[]),[[0,4000,0,2700]]);
 // window 1200 wide at 1000 from the start, sill 900, 1200 high
 assert.deepEqual(wallPieces(4000,2700,[{offset:1000,width:1200,sill:900,height:1200,type:'window'}]),[[0,1000,0,2700],[1000,2200,0,900],[1000,2200,2100,2700],[2200,4000,0,2700]]);
 // a door ignores its sill and opens down to the floor
 assert.deepEqual(wallPieces(3000,2700,[{offset:0,width:900,sill:500,height:2100,type:'door'}]),[[0,900,2100,2700],[900,3000,0,2700]]);
 const group=buildInteriorRoom({width:4000,depth:3000,height:2700,openings:[{wall:'back',offset:1000,width:1200,sill:900,height:1200,type:'window'}]});
 assert.deepEqual(group.userData.room,{w:4000,d:3000,h:2700});
 const visible=side=>group.children.filter(m=>m.userData.side===side).every(m=>m.visible);
 updateCutaway(group,{position:{x:0,y:2000,z:6000}});
 assert.equal(visible('front'),false);assert.equal(visible('back'),true);assert.equal(visible('ceiling'),false);
 updateCutaway(group,{position:{x:0,y:1600,z:0}});
 assert.equal(visible('front'),true);assert.equal(visible('ceiling'),true);
 assert.equal(DEFAULT_LIGHTING.roomLook,'grid');
 const v=validateLighting({roomLook:'room',floorLook:'tile',wallColor:'#AABBCC'});
 assert.equal(v.roomLook,'room');assert.equal(v.floorLook,'tile');assert.equal(v.wallColor,'#aabbcc');
 const bad=validateLighting({roomLook:'castle',floorLook:'gold',wallColor:'red;'});
 assert.equal(bad.roomLook,'grid');assert.equal(bad.floorLook,'oak');assert.equal(bad.wallColor,DEFAULT_LIGHTING.wallColor);
});

import {ptTiles,PT_SAMPLES} from './pathtrace.mjs';
test('path tracing: sample presets and tiling grows with the image size',()=>{
 assert.deepEqual([...PT_SAMPLES],[64,256,1024]);
 assert.equal(ptTiles(1280,720),2);assert.equal(ptTiles(1920,1080),3);assert.equal(ptTiles(2560,1440),3);assert.equal(ptTiles(3840,2160),4);
});
