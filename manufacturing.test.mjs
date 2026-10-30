// Outputs derived from one model: CSV, labels/QR and sheet packing. QR is decoded by an independent library (jsQR).
import test from 'node:test';
import assert from 'node:assert/strict';
import jsQR from 'jsqr';
import {DEFAULTS,MODERN_RULES,cabinet,layoutSheets} from './engine.mjs';
import {partRecords,manufacturingCsv,labelPayload,parseLabelPayload,qrMatrix,labelSvg,labelsHtml,verifySheetLayout,accessoryRecords} from './manufacturing.mjs';
import {cabinetDrawingSvg} from './drawing.mjs';
import {parseProject,serializeProject} from './project.mjs';
import {DEFAULT_ROOM} from './room.mjs';

const config=extra=>({...DEFAULTS,...MODERN_RULES,width:1200,height:2100,depth:600,partitions:1,bayShelves:[2,1],bayDrawers:[2,0],shelves:2,doors:0,...extra});
const project=()=>({format:'rokadex-standalone',version:3,projectId:'PRJ-DEMO-01',designRevision:4,lengthUnit:'mm',room:{...DEFAULT_ROOM},units:[{id:'WR-1',name:'Wardrobe "A", left',type:'cabinet',x:0,z:0,finish:'oak',config:config({material:'=HYPERLINK("x")'})}]});
function decode(payload){
 const m=qrMatrix(payload),scale=4,quiet=4,n=(m.length+2*quiet)*scale,data=new Uint8ClampedArray(n*n*4).fill(255);
 for(let r=0;r<m.length;r++)for(let c=0;c<m.length;c++)if(m[r][c])for(let y=0;y<scale;y++)for(let x=0;x<scale;x++){const i=(((r+quiet)*scale+y)*n+(c+quiet)*scale+x)*4;data[i]=data[i+1]=data[i+2]=0}
 return jsQR(data,n,n)?.data;
}

test('model, CSV, label and drawing agree on IDs, cut sizes and materials',()=>{
 const p=project(),records=partRecords(p),model=cabinet(p.units[0].config,'WR-1');
 assert.equal(records.length,model.parts.length);
 const csv=manufacturingCsv(p).split('\r\n');
 assert.match(csv[0],/PRJ-DEMO-01 · revision 4 · PRELIMINARY — NOT APPROVED/);
 const header=csv[2].split(','),rows=csv.slice(3);
 assert.equal(rows.length,records.length);
 const svg=cabinetDrawingSvg(p.units[0]);
 for(const [i,part] of model.parts.entries()){
  const cells=rows[i].split('","').map(v=>v.replaceAll('"',''));
  const at=name=>cells[header.indexOf(name)];
  assert.equal(at('part_uid'),part.uid);assert.equal(Number(at('cut_length_mm')),part.cutLength);assert.equal(Number(at('cut_width_mm')),part.cutWidth);
  assert.equal(Number(at('finish_length_mm')),part.length);
  const label=parseLabelPayload(labelPayload(records[i]));
  assert.deepEqual([label.uid,label.cutLength,label.cutWidth,label.finishLength,label.thickness,label.revision],[part.uid,part.cutLength,part.cutWidth,part.length,part.thickness,4]);
  assert.ok(svg.includes(`data-part="${part.id}"`),`drawing contains ${part.id}`);
 }
 assert.ok(rows.every(r=>!r.includes('"=HYPERLINK')),'formula material neutralised');
});

test('QR labels decode to the exact payload with sub-millimetre precision',()=>{
 const p=project();p.units[0].config.width=1200.5;p.units[0].config.material='MDF مقاوم للرطوبة 18';
 const records=partRecords(p);
 for(const r of records.slice(0,6)){
  const payload=labelPayload(r);
  assert.equal(decode(payload),payload);
  assert.equal(parseLabelPayload(payload).material,'MDF مقاوم للرطوبة 18');
 }
 const top=records.find(r=>r.kind==='top');assert.equal(parseLabelPayload(labelPayload(top)).finishLength,1164.5);
 const svg=labelSvg(top);assert.ok(svg.includes(`data-uid="${top.uid}"`));assert.ok(svg.includes('NOT FOR CNC'));
 assert.equal((labelsHtml(p).match(/<svg /g)||[]).length,records.length,'one label per part');
});

test('label payload rejects truncation, alteration and foreign versions',()=>{
 const payload=labelPayload(partRecords(project())[0]);
 for(const bad of [payload.slice(0,-3),payload.slice(0,payload.length-20),payload.replace('fl=','fl=9'),payload.replace('RDX-PART-1','RDX-PART-9'),'',null,'x'.repeat(800)])assert.throws(()=>parseLabelPayload(bad));
});

test('sheet packing loses no parts, never overlaps and respects grain for every stock axis',()=>{
 for(const stockGrainAxis of ['x','y','legacy'])for(const extra of [{},{bayMode:'separate'},{edgeDeduction:'off'},{grain:'none'},{grain:'horizontal'}]){
  const c=config({stockGrainAxis,...extra,doors:0}),model=cabinet(c,'P');
  const layout=layoutSheets(model.parts,c),check=verifySheetLayout(model.parts,layout,c);
  assert.deepEqual(check.issues,[],`${stockGrainAxis} ${JSON.stringify(extra)}`);
 }
});

test('grain-locked parts are never rotated to fit; unrestricted parts may rotate',()=>{
 // 1300 × 300 panel, grain along its length. Sheet 1220 wide × 2440 long.
 const part=(grain)=>({id:'X',kind:'shelf',length:1300,width:300,thickness:18,material:'M',grain,cutLength:1300,cutWidth:300,sheetGood:true});
 const c={...DEFAULTS,stockGrainAxis:'x'};
 // Stock grain along X (1220 side): a vertical-grain 1300 part must lie along X and cannot fit → unplaced, not rotated.
 assert.equal(layoutSheets([part('vertical')],c).unplaced.length,1);
 // Same panel without grain restriction is rotated and placed.
 const free=layoutSheets([part('none')],c);assert.equal(free.unplaced.length,0);assert.equal(free.sheets[0].placed[0].rotated,true);
 const y=layoutSheets([part('vertical')],{...c,stockGrainAxis:'y'});assert.equal(y.sheets[0].placed[0].h,1300);
 // The verifier itself detects a forged rotation.
 const forged={sheets:[{placed:[{id:'X',x:10,y:10,w:1300,h:300,rotated:true}]}],unplaced:[],excluded:[]};
 assert.ok(verifySheetLayout([part('vertical')],forged,{...DEFAULTS,sheetWidth:2440,sheetHeight:2440,stockGrainAxis:'y'}).issues.some(i=>/against the stock grain/.test(i)));
});

test('accessories list slides and rails without entering the cut list; save and reopen keeps everything',()=>{
 const p=project();p.units[0].config.bayRails=[0,1500];p.units[0].config.bayShelfLevels=[null,[1700]];p.units[0].config.bayShelves=[2,1];
 const reopened=parseProject(serializeProject(p));
 assert.deepEqual(reopened.units[0].config,p.units[0].config);
 assert.deepEqual(partRecords(reopened),partRecords(p));
 const acc=accessoryRecords(reopened);
 assert.deepEqual(acc.map(a=>a.kind).sort(),['drawerSlide','drawerSlide','hangingRail']);
 assert.ok(!partRecords(reopened).some(r=>['drawerSlide','hangingRail'].includes(r.kind)));
});

test('bundled cab-2.0 example project opens, packs without lost parts and exports one label per part',async()=>{
 const {readFileSync}=await import('node:fs');
 const p=parseProject(readFileSync(new URL('./samples/cab2-wardrobe-example.json',import.meta.url),'utf8'));
 assert.equal(p.version,3);assert.equal(p.units.length,3);
 for(const u of p.units){const model=cabinet(u.config,u.id);assert.deepEqual(verifySheetLayout(model.parts,layoutSheets(model.parts,u.config),u.config).issues,[])}
 assert.equal((labelsHtml(p).match(/<svg /g)||[]).length,partRecords(p).length);
 assert.equal(parseProject(serializeProject(p)).units[0].config.backConstruction,'groove');
});
test('bundled example has no room-plan conflicts',async()=>{
 const {readFileSync}=await import('node:fs');const {inspectLayout}=await import('./room.mjs');
 const p=parseProject(readFileSync(new URL('./samples/cab2-wardrobe-example.json',import.meta.url),'utf8'));
 assert.deepEqual(inspectLayout(p.room,p.units),[]);
});
