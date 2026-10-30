import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_ROOM,inspectLayout,unitFootprint} from './room.mjs';
import {createKitchenLayout} from './layout.mjs';
import {partSize} from './geometry.mjs';
import {cabinet,DEFAULTS} from './engine.mjs';

test('common part dimensions match all current model kinds',()=>{
 const parts=cabinet({...DEFAULTS,doors:2,bayDrawers:[1,0]}).parts;
 assert.deepEqual(new Set(parts.map(part=>part.kind)),new Set(['side','top','bottom','partition','shelf','drawerFront','drawerSide','drawerBack','drawerFace','drawerBottom','door','back']));
 for(const part of parts){const size=partSize(part);assert.equal(size.length,3);assert.ok(size.every(n=>Number.isFinite(n)&&n>0))}
 assert.deepEqual(partSize({kind:'drawerSide',length:500,width:130,thickness:18}),[18,130,500]);
 assert.throws(()=>partSize({kind:'unknown',length:1,width:1,thickness:1}),/Unsupported/);
});
test('straight, L and U kitchens produce deterministic independent valid cabinets',()=>{
 for(const shape of ['straight','l','u']){
  const units=createKitchenLayout(DEFAULT_ROOM,{shape,count:6});
  assert.equal(units.length,6);assert.equal(new Set(units.map(unit=>unit.id)).size,6);
  assert.deepEqual(inspectLayout(DEFAULT_ROOM,units),[]);
  assert.deepEqual(units,createKitchenLayout(DEFAULT_ROOM,{shape,count:6}));
  assert.equal(units[0].config.stockGrainAxis,'y');
  assert.notEqual(units[0].config,units[1].config);
  if(shape!=='straight')assert.ok(units.some(unit=>unit.rotation===90));
  if(shape==='u')assert.ok(units.some(unit=>unit.rotation===270));
 }
});
test('kitchen rows include front projections and leave clear corners',()=>{
 const units=createKitchenLayout(DEFAULT_ROOM,{shape:'u',count:9,gap:20,config:{doors:2}});
 assert.deepEqual(inspectLayout(DEFAULT_ROOM,units),[]);
 const back=units.filter(unit=>unit.rotation===0).map(unit=>unitFootprint(unit));
 const sides=units.filter(unit=>unit.rotation!==0).map(unit=>unitFootprint(unit));
 for(const side of sides)assert.ok(side.back>=Math.max(...back.map(b=>b.front))+20-0.01);
});
test('kitchen layout rejects impossible room/height/count/gap settings',()=>{
 for(const options of [{shape:'bad'},{shape:'u',count:2},{count:101},{count:1.2},{gap:-2},{width:0},{height:4000}])assert.throws(()=>createKitchenLayout(DEFAULT_ROOM,options));
 assert.throws(()=>createKitchenLayout({width:1000,depth:1000,height:2800},{shape:'u',count:6}),/fit|overlap|room/i);
});

// Evaluate model corners independently of unitFootprint/inspectLayout so a shared
// bounds mistake cannot make an invalid generated arrangement pass this check.
function projectedBounds(unit){
 const angle=unit.rotation*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle),xs=[],ys=[],zs=[];
 for(const part of cabinet(unit.config,unit.id).parts){
  const [w,h,d]=partSize(part);
  for(const x of [part.position.x-w/2,part.position.x+w/2])for(const y of [part.position.y-h/2,part.position.y+h/2])for(const z of [part.position.z-d/2,part.position.z+d/2]){
   xs.push(unit.x+c*x+s*z);ys.push(y);zs.push(unit.z-s*x+c*z);
  }
 }
 return {left:Math.min(...xs),right:Math.max(...xs),back:Math.min(...zs),front:Math.max(...zs),bottom:Math.min(...ys),top:Math.max(...ys)};
}

test('seeded varied kitchen dimensions keep every actual panel inside the room and clear of other units',()=>{
 let seed=84123;
 const next=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32};
 const integer=(min,max)=>min+Math.floor(next()*(max-min+1));
 let checkedUnits=0,checkedPairs=0;
 for(let i=0;i<24;i++){
  const shape=['straight','l','u'][i%3],legs=i%3+1,count=integer(legs,12),width=integer(300,1250)+.25,depth=integer(350,800)+.5,height=integer(600,2200),gap=integer(0,45),doors=i%2?2:0;
  const thickness=[12,18,25][i%3],backCount=Math.ceil(count/legs),sideCount=legs>1?Math.ceil((count-backCount)/(legs-1)):0;
  const effectiveDepth=depth+(doors?thickness:0),rowWidth=backCount*width+(backCount-1)*gap,sideLength=sideCount*width+Math.max(0,sideCount-1)*gap;
  const room={width:Math.max(600,rowWidth+150,legs===3?2*effectiveDepth+300:0),depth:Math.max(600,effectiveDepth+(legs>1?gap+sideLength:0)+150),height:Math.max(2500,height+100)};
  const options={shape,count,width,depth,height,gap,config:{doors,thickness}};
  const units=createKitchenLayout(room,options),bounds=units.map(projectedBounds),epsilon=.02;
  assert.equal(units.length,count,`${shape} ${i} unit count`);checkedUnits+=count;
  for(const [index,b] of bounds.entries()){
   assert.ok(b.left>=-room.width/2-epsilon&&b.right<=room.width/2+epsilon&&b.back>=-room.depth/2-epsilon&&b.front<=room.depth/2+epsilon,`${shape} ${i}/${index} room boundary`);
   assert.ok(b.bottom>=-epsilon&&b.top<=room.height+epsilon,`${shape} ${i}/${index} vertical bounds`);
   for(let j=0;j<index;j++){
    const a=bounds[j];checkedPairs++;
    const overlapX=Math.min(a.right,b.right)-Math.max(a.left,b.left),overlapZ=Math.min(a.front,b.front)-Math.max(a.back,b.back);
    assert.ok(overlapX<=epsilon||overlapZ<=epsilon,`${shape} ${i}/${index} intersects ${j}`);
   }
  }
  const backFront=Math.max(...bounds.filter((_,index)=>units[index].rotation===0).map(b=>b.front));
  for(const [index,b] of bounds.entries())if(units[index].rotation!==0)assert.ok(b.back-backFront>=gap-epsilon,`${shape} ${i}/${index} corner clearance`);
 }
 assert.ok(checkedUnits>=100,`Only ${checkedUnits} units were exercised`);
 assert.ok(checkedPairs>=300,`Only ${checkedPairs} pairs were exercised`);
});

test('fit boundary and opposing U-runs reject geometric overflow without mutating options',()=>{
 const options={shape:'straight',count:6,width:600,depth:580,height:850,gap:5,config:{doors:2}};
 const before=structuredClone(options);
 assert.equal(createKitchenLayout(DEFAULT_ROOM,options).length,6);
 assert.throws(()=>createKitchenLayout(DEFAULT_ROOM,{...options,count:7}),/fit/i);
 assert.deepEqual(options,before);
 assert.throws(()=>createKitchenLayout({width:1300,depth:3000,height:2800},{shape:'u',count:3,width:300,depth:650,config:{doors:2}}),/overlap/i);
 assert.throws(()=>createKitchenLayout({width:3000,depth:2400,height:2800},{shape:'u',count:9,width:600,depth:580,gap:20,config:{doors:2}}),/fit/i);
 const largest=createKitchenLayout({width:100000,depth:100000,height:2800},{shape:'straight',count:100});
 assert.equal(largest.length,100);assert.deepEqual(inspectLayout({width:100000,depth:100000,height:2800},largest),[]);
});

test('kitchen generator rejects panels extending below the room floor',()=>{
 assert.throws(()=>createKitchenLayout(DEFAULT_ROOM,{shape:'straight',count:3,config:{doors:2,doorOverlay:20}}),/fit/i);
});
