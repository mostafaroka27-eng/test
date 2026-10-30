import test from 'node:test';import assert from 'node:assert/strict';import {DEFAULTS,cabinet,layoutSheets,csv,applyMethod,hardwareSchedule} from './engine.mjs';
test('deterministic geometry and component ids',()=>{const a=cabinet(DEFAULTS),b=cabinet(DEFAULTS);assert.deepEqual(a,b);assert.equal(a.parts.length,4+DEFAULTS.partitions+(DEFAULTS.partitions+1)*DEFAULTS.shelves+1);assert.equal(a.internal.width,864)});
test('changing width propagates to top and shelf',()=>{const a=cabinet(DEFAULTS),b=cabinet({...DEFAULTS,width:1000});assert.equal(b.parts.find(x=>x.kind==='top').length-a.parts.find(x=>x.kind==='top').length,100);assert.equal(b.parts.find(x=>x.kind==='shelf').length-a.parts.find(x=>x.kind==='shelf').length,50)});
test('reject impossible geometry',()=>{assert.throws(()=>cabinet({...DEFAULTS,width:25}));assert.throws(()=>cabinet({...DEFAULTS,depth:5}));assert.throws(()=>cabinet({...DEFAULTS,partitions:1.2}))});
test('edge length and export',()=>{const c=cabinet(DEFAULTS);assert.ok(c.edgeLengthM>0);assert.match(csv(c.parts),/bandLength/)});
test('nesting checks bounds and grain',()=>{const c=cabinet(DEFAULTS),r=layoutSheets(c.parts,DEFAULTS);assert.ok(r.sheets.length>0);for(const s of r.sheets)for(const p of s.placed){assert.ok(p.x+p.w<=s.width-DEFAULTS.trim);assert.ok(p.y+p.h<=s.height-DEFAULTS.trim)}});
test('oversize part is rejected, not silently placed',()=>{const r=layoutSheets([{id:'x',length:9999,width:9999,thickness:18,material:'MDF',grain:'vertical'}],DEFAULTS);assert.equal(r.unplaced.length,1)});

test('door panel count, width and edge banding are parametric',()=>{const c=cabinet({...DEFAULTS,doors:2,doorGap:3});const d=c.parts.filter(p=>p.kind==='door');assert.equal(d.length,2);assert.equal(d[0].width,445.5);assert.equal(d[0].length,2194);assert.equal(d[0].bandLength,2*(445.5+2194));assert.ok(d[0].position.z>0)});
test('door widths recalculate with cabinet width',()=>{const a=cabinet({...DEFAULTS,doors:2}),b=cabinet({...DEFAULTS,doors:2,width:1000});assert.equal(b.parts.find(p=>p.kind==='door').width-a.parts.find(p=>p.kind==='door').width,50)});
test('reject invalid door count and gap',()=>{assert.throws(()=>cabinet({...DEFAULTS,doors:5}));assert.throws(()=>cabinet({...DEFAULTS,doors:2,doorGap:-1}));assert.throws(()=>cabinet({...DEFAULTS,doors:2,doorGap:500}))});

test('nesting puts parts on multiple sheets rather than losing them',()=>{const parts=Array.from({length:6},(_,i)=>({id:'P'+i,length:1100,width:2200,thickness:18,material:'MDF',grain:'vertical'}));const r=layoutSheets(parts,DEFAULTS);assert.equal(r.unplaced.length,0);assert.equal(r.sheets.length,6);assert.equal(r.sheets.flatMap(s=>s.placed).length,6)});
test('construction method applies and validates',()=>{const a=applyMethod(DEFAULTS,'overlay');assert.equal(a.construction,'over');assert.equal(DEFAULTS.construction,'between');assert.throws(()=>applyMethod(DEFAULTS,'invalid'))});
test('hardware estimates do not claim drilling readiness',()=>{const h=hardwareSchedule({...DEFAULTS,doors:2});assert.equal(h.rows[0].qty,8);assert.match(h.status,/NOT FOR/)});

test('bay-specific shelves update quantities and positions',()=>{
 const cfg={...DEFAULTS,partitions:1,shelves:2,bayShelves:[1,3]};
 const model=cabinet(cfg,'TEST');const shelves=model.parts.filter(p=>p.kind==='shelf');
 assert.equal(shelves.length,4);
 assert.deepEqual(shelves.map(p=>p.bay),[0,1,1,1]);
 assert.deepEqual(shelves.map(p=>p.slot),[0,0,1,2]);
});
test('individual part edge override changes only targeted panel',()=>{
 const cfg={...DEFAULTS,partitions:0,shelves:2,partOverrides:{'shelf:1':{edges:[1,1,1,1]}}};
 const model=cabinet(cfg,'TEST');const shelves=model.parts.filter(p=>p.kind==='shelf');
 assert.deepEqual(shelves[0].edges,[1,0,0,0]);
 assert.deepEqual(shelves[1].edges,[1,1,1,1]);
 assert.equal(shelves[1].bandLength,2*(shelves[1].length+shelves[1].width));
});
test('invalid bay configurations and edge overrides are rejected',()=>{
 assert.throws(()=>cabinet({...DEFAULTS,bayShelves:[1]},'TEST'));
 assert.throws(()=>cabinet({...DEFAULTS,partOverrides:{'shelf:0':{edges:[1,2,0,0]}}},'TEST'));
});

test('drawer bank creates deterministic front and box panels per bay',()=>{const c={...DEFAULTS,partitions:1,shelves:0,bayDrawers:[2,0]};const m=cabinet(c);assert.equal(m.parts.filter(p=>p.kind==='drawerFront').length,2);assert.equal(m.parts.filter(p=>p.kind==='drawerSide').length,4);assert.equal(m.parts.filter(p=>p.kind==='drawerBottom').length,2);assert.equal(m.parts.filter(p=>p.kind==='drawerBack').length,2);assert.equal(m.parts.filter(p=>p.kind==='drawerFace').length,2);assert.ok(m.parts.every(p=>p.length>0&&p.width>0))});
test('drawer configuration validates clearance and per-bay quantities',()=>{assert.throws(()=>cabinet({...DEFAULTS,bayDrawers:[2]}));assert.throws(()=>cabinet({...DEFAULTS,partitions:0,bayDrawers:[31]}));assert.throws(()=>cabinet({...DEFAULTS,partitions:0,bayDrawers:[2],drawerSideClearance:600}));});
test('drawer fronts change when cabinet width changes',()=>{const a=cabinet({...DEFAULTS,partitions:0,bayDrawers:[2]}),b=cabinet({...DEFAULTS,partitions:0,bayDrawers:[2],width:1000});assert.equal(b.parts.find(p=>p.kind==='drawerFront').width-a.parts.find(p=>p.kind==='drawerFront').width,100)});
test('DXF concept export contains panel outline and labels, not machine operations',async()=>{const {dxfPanels}=await import('./engine.mjs');const s=dxfPanels(cabinet(DEFAULTS).parts);assert.match(s,/SECTION\n2\nENTITIES/);assert.match(s,/LWPOLYLINE/);assert.match(s,/PRELIMINARY/);assert.doesNotMatch(s,/G0 X|M03/)});
test('drawer slide estimate is explicitly unverified',()=>{const h=hardwareSchedule({...DEFAULTS,partitions:0,bayDrawers:[3]});assert.equal(h.rows.find(x=>x.item.includes('slide')).qty,3);assert.match(h.status,/NOT FOR/)});

test('cut list CSV escapes quotes and line breaks using spreadsheet CSV rules',()=>{
 const parts=cabinet({...DEFAULTS,material:'Oak, "premium"\nveneer'}).parts;
 const exported=csv(parts);
 assert.ok(exported.includes('"Oak, ""premium""\nveneer"'));
 assert.ok(!exported.includes('\\"premium'));
});
test('cut list CSV neutralizes spreadsheet formulas in user supplied fields',()=>{
 for(const material of ['=HYPERLINK("https://example.com")',' +SUM(1,2)','\t@SUM(1,2)','-1+2']){
  const exported=csv(cabinet({...DEFAULTS,material}).parts);
  assert.ok(exported.includes('"\''+material.replaceAll('"','""')+'"'));
 }
});
test('reject drawer gaps that leave nonpositive front dimensions',()=>{
 assert.throws(()=>cabinet({...DEFAULTS,width:100,partitions:0,bayDrawers:[1],drawerSideClearance:0,drawerGap:50}),/drawer/i);
 assert.throws(()=>cabinet({...DEFAULTS,partitions:0,bayDrawers:[2],drawerGap:800}),/drawer/i);
});
test('reject drawer boxes whose bottom cannot fit between front and back',()=>{
 assert.throws(()=>cabinet({...DEFAULTS,depth:76,partitions:0,bayDrawers:[1]}),/drawer/i);
});
test('reject missing or blank material assignments rather than substituting a different stock',()=>{
 for(const field of ['material','backMaterial']){
  for(const value of ['', '   ', null, 42]) assert.throws(()=>cabinet({...DEFAULTS,[field]:value}),/material/i);
 }
});
test('legacy configs receive the same optional drawer defaults during validation and generation',()=>{
 const config={...DEFAULTS,partitions:0,bayDrawers:[1]};
 for(const key of ['drawerSideClearance','drawerBoxHeight','drawerGap','drawerBottomThickness']) delete config[key];
 const model=cabinet(config);
 assert.ok(model.parts.every(p=>[p.length,p.width,p.thickness].every(n=>Number.isFinite(n)&&n>0)));
 assert.deepEqual(model,cabinet({...DEFAULTS,partitions:0,bayDrawers:[1]}));
});

test('all generated drawer component override keys can be reapplied without rejection',()=>{
 const config={...DEFAULTS,partitions:0,bayDrawers:[1]};
 const before=cabinet(config);
 const drawerParts=before.parts.filter(p=>p.kind.startsWith('drawer'));
 const partOverrides=Object.fromEntries(drawerParts.map(p=>[p.overrideKey,{edges:[0,1,0,1]}]));
 const after=cabinet({...config,partOverrides});
 for(const part of drawerParts) assert.deepEqual(after.parts.find(p=>p.id===part.id).edges,[0,1,0,1]);
});
test('reject panel dimensions that round down to zero at the exported precision',()=>{
 assert.throws(()=>cabinet({...DEFAULTS,width:36.001,partitions:0}),/dimension/i);
});

const stockPart=(extra={})=>({id:'P-1',length:2200,width:580,thickness:18,material:'MDF',grain:'vertical',...extra});
test('semantic panel keys preserve bays and drawer-side identity across topology changes',()=>{
 const before={...DEFAULTS,bayShelves:[1,2],bayDrawers:[1,2]};
 const after={...before,bayShelves:[3,2],bayDrawers:[3,2]};
 const first=cabinet(before),second=cabinet(after);
 const shelf=model=>model.parts.find(p=>p.kind==='shelf'&&p.bay===1&&p.slot===0);
 assert.equal(shelf(first).key,'shelf:1:0');assert.equal(shelf(second).key,shelf(first).key);
 const sides=model=>model.parts.filter(p=>p.kind==='drawerSide'&&p.bay===1&&p.slot===0).map(p=>p.key);
 assert.deepEqual(sides(first),['drawerSide:1:0:0','drawerSide:1:0:1']);
 assert.deepEqual(sides(second),sides(first));
 for(const model of [first,second])assert.equal(new Set(model.parts.map(p=>p.key)).size,model.parts.length);
 assert.equal(first.parts.find(p=>p.kind==='back').key,'back:0');
 // Existing human-readable IDs remain in their legacy format for exported references.
 assert.equal(cabinet(DEFAULTS).parts[0].id,'CAB-001-SIDE-001');
});

const dxfOutlineBoxes=dxf=>{
 const lines=dxf.split('\n'),boxes=[];
 for(let i=0;i<lines.length;i+=2)if(lines[i]==='0'&&lines[i+1]==='LWPOLYLINE'){
  const vertices=[];
  for(let j=i+2;j<lines.length&&lines[j]!=='0';j+=2)if(lines[j]==='10')vertices.push([Number(lines[j+1]),Number(lines[j+3])]);
  boxes.push({left:Math.min(...vertices.map(p=>p[0])),right:Math.max(...vertices.map(p=>p[0])),bottom:Math.min(...vertices.map(p=>p[1])),top:Math.max(...vertices.map(p=>p[1]))});
 }
 return boxes;
};
test('DXF panel rows never overlap when stock parts exceed the former fixed row height',async()=>{
 const {dxfPanels}=await import('./engine.mjs');
 const dxf=dxfPanels(['A','B','C','D'].map((id,i)=>({id,length:4600,width:i===3?6500:4000})));
 const boxes=dxfOutlineBoxes(dxf);assert.equal(boxes.length,4);
 for(const [i,a] of boxes.entries())for(const b of boxes.slice(i+1))assert.ok(a.right<=b.left||b.right<=a.left||a.top<=b.bottom||b.top<=a.bottom,'DXF panel outlines overlap');
 assert.match(dxf,/9\n\$INSUNITS\n70\n4/);
 const lines=dxf.split('\n'),noteIndex=lines.indexOf('NOTES');
 assert.ok(Number(lines[noteIndex+4])>Math.max(...boxes.map(b=>b.top)),'Warning belongs above all panels');
});
test('DXF leaves separation for an oversize single-row panel and declares valid empty drawing units',async()=>{
 const {dxfPanels}=await import('./engine.mjs');
 const boxes=dxfOutlineBoxes(dxfPanels([{id:'WIDE',length:12000,width:7000},{id:'NEXT',length:100,width:200}]));
 assert.ok(boxes[1].bottom>=boxes[0].top+50);
 assert.match(dxfPanels([]),/\$INSUNITS\n70\n4/);
});
test('stock grain along Y places a tall panel without violating its declared grain',()=>{
 const result=layoutSheets([stockPart()],{...DEFAULTS,stockGrainAxis:'y'});
 assert.equal(result.unplaced.length,0);
 const sheet=result.sheets[0],panel=sheet.placed[0];
 assert.equal(sheet.stockGrainAxis,'y');assert.equal(panel.w,580);assert.equal(panel.h,2200);assert.equal(panel.rotated,true);
});
test('explicit stock axes distinguish vertical and horizontal part grain and forbid wrong rotation',()=>{
 assert.equal(layoutSheets([stockPart()],{...DEFAULTS,stockGrainAxis:'x'}).unplaced.length,1);
 assert.equal(layoutSheets([stockPart({grain:'horizontal'})],{...DEFAULTS,stockGrainAxis:'y'}).unplaced.length,1);
 const result=layoutSheets([stockPart({grain:'horizontal'})],{...DEFAULTS,stockGrainAxis:'x'});
 assert.equal(result.unplaced.length,0);assert.equal(result.sheets[0].placed[0].rotated,true);
});
test('unrestricted parts can rotate under either explicit stock axis',()=>{
 for(const stockGrainAxis of ['x','y']){
  const result=layoutSheets([stockPart({grain:'none'})],{...DEFAULTS,stockGrainAxis});
  assert.equal(result.unplaced.length,0);assert.equal(result.sheets[0].placed[0].rotated,true);
 }
});
test('missing stock axis preserves legacy packing positions and constraints',()=>{
 const config={...DEFAULTS};delete config.stockGrainAxis;
 const parts=[stockPart({id:'A',length:1100,width:1000}),stockPart({id:'B',length:1100,width:1000}),stockPart({id:'C'})];
 const result=layoutSheets(parts,config);
 assert.equal(DEFAULTS.stockGrainAxis,'legacy');
 assert.deepEqual(result,layoutSheets(parts,{...config,stockGrainAxis:'legacy'}));
 assert.deepEqual(result.sheets[0].placed.map(p=>({id:p.id,x:p.x,y:p.y,w:p.w,h:p.h})),[
  {id:'A',x:10,y:10,w:1100,h:1000},{id:'B',x:10,y:1013.2,w:1100,h:1000}
 ]);
 assert.deepEqual(result.unplaced.map(p=>p.id),['C']);
});
test('invalid stock axes and unknown part grain fail instead of selecting an arbitrary orientation',()=>{
 assert.throws(()=>layoutSheets([stockPart()],{...DEFAULTS,stockGrainAxis:'diagonal'}),/axis/i);
 assert.throws(()=>layoutSheets([stockPart({grain:'diagonal'})],{...DEFAULTS,stockGrainAxis:'y'}),/grain/i);
});
test('explicit-axis packing retains trim, kerf, bounds and non-overlap across multiple sheets',()=>{
 const config={...DEFAULTS,sheetWidth:700,sheetHeight:1200,kerf:7,trim:20,stockGrainAxis:'y'};
 const parts=Array.from({length:7},(_,i)=>stockPart({id:`P-${i}`,length:500,width:300}));
 const result=layoutSheets(parts,config);
 assert.equal(result.unplaced.length,0);assert.ok(result.sheets.length>1);
 for(const sheet of result.sheets)for(const [i,p] of sheet.placed.entries()){
  assert.ok(p.x>=20&&p.y>=20&&p.x+p.w<=680&&p.y+p.h<=1180);
  for(const q of sheet.placed.slice(i+1))assert.ok(p.x+p.w+7<=q.x||q.x+q.w+7<=p.x||p.y+p.h+7<=q.y||q.y+q.h+7<=p.y);
 }
});

const backPart=(model,kind)=>model.parts.find(part=>part.kind===kind);
const zRange=(part,depth)=>[part.position.z-depth/2,part.position.z+depth/2];
const assertNear=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-8,`${actual} != ${expected}`);
test('missing back construction preserves exact legacy panel geometry',()=>{
 const missing={...DEFAULTS,backInset:100,bayDrawers:[1,0]};delete missing.backConstruction;
 assert.equal(DEFAULTS.backConstruction,'legacy');
 assert.deepEqual(cabinet(missing),cabinet({...missing,backConstruction:'legacy'}));
 const model=cabinet(missing),back=backPart(model,'back');
 assert.equal(back.length,2200);assert.equal(back.width,900);assert.equal(back.position.z,-287);
 assert.equal(backPart(model,'shelf').position.z,3);assert.equal(backPart(model,'drawerBottom').position.z,0);
});
test('inset back, shelves and partitions share exact rear and front construction planes',()=>{
 const c={...DEFAULTS,backConstruction:'inset',backInset:100},model=cabinet(c);
 const back=backPart(model,'back'),rear=-c.depth/2+c.backInset,inner=rear+c.backThickness;
 assert.equal(back.width,c.width-2*c.thickness);assert.equal(back.length,c.height-2*c.thickness);
 assert.deepEqual(zRange(back,back.thickness),[rear,inner]);
 for(const kind of ['shelf','partition'])for(const part of model.parts.filter(part=>part.kind===kind)){
  const [min,max]=zRange(part,part.width);assertNear(min,inner);assertNear(max,c.depth/2);
 }
 // Back fits between carcass sides/top/bottom rather than intersecting them.
 assert.equal(back.position.x-back.width/2,-c.width/2+c.thickness);
 assert.equal(back.position.y-back.length/2,c.thickness);
 assert.equal(back.position.y+back.length/2,c.height-c.thickness);
});
test('overlay back consumes total depth and carcass faces meet its interior surface',()=>{
 for(const construction of ['between','over']){
  const c={...DEFAULTS,construction,backConstruction:'overlay'},model=cabinet(c),back=backPart(model,'back');
  const inner=-c.depth/2+c.backThickness;
  assert.equal(back.length,c.height);assert.equal(back.width,c.width);
  assert.deepEqual(zRange(back,back.thickness),[-c.depth/2,inner]);
  for(const part of model.parts.filter(part=>['side','top','bottom','partition','shelf'].includes(part.kind))){
   const depth=part.width;
   const [min,max]=zRange(part,depth);assertNear(min,inner);assertNear(max,c.depth/2);
  }
 }
});
test('new back modes keep every drawer box within interior rear and front clearance planes',()=>{
 for(const [backConstruction,backInset] of [['inset',100],['overlay',0]]){
  const c={...DEFAULTS,partitions:0,shelves:0,bayDrawers:[2],backConstruction,backInset},model=cabinet(c);
  const inner=-c.depth/2+backInset+c.backThickness,front=c.depth/2-35;
  for(const part of model.parts.filter(part=>part.kind.startsWith('drawer')&&part.kind!=='drawerFront')){
   const depth=part.kind==='drawerSide'?part.length:part.kind==='drawerBottom'?part.width:part.thickness;
   const [min,max]=zRange(part,depth);assert.ok(min>=inner-1e-8);assert.ok(max<=front+1e-8);
  }
  const side=backPart(model,'drawerSide');assertNear(zRange(side,side.length)[0],inner);assertNear(zRange(side,side.length)[1],front);
 }
});
test('invalid explicit back construction is rejected while valid modes retain positive panels',()=>{
 for(const backConstruction of [null,'','flush','LEGACY'])assert.throws(()=>cabinet({...DEFAULTS,backConstruction}),/back construction/i);
 assert.throws(()=>cabinet({...DEFAULTS,backConstruction:'overlay',backInset:10}),/overlay|inset/i);
 assert.throws(()=>cabinet({...DEFAULTS,backConstruction:'inset',backInset:575}),/depth/i);
 for(const backConstruction of ['legacy','inset','overlay'])assert.ok(cabinet({...DEFAULTS,backConstruction}).parts.every(part=>part.length>0&&part.width>0&&part.thickness>0));
});
