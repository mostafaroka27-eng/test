import test from 'node:test';
import assert from 'node:assert/strict';
import {cabinet,DEFAULTS} from './engine.mjs';
import {cabinetDrawingSvg} from './drawing.mjs';

const unit=config=>({id:'CAB-001',name:'Test cabinet',config:{...DEFAULTS,...config}});
const rects=(svg,view,kind)=>{
 const group=svg.match(new RegExp(`<g data-view="${view}"[^>]*>([\\s\\S]*?)</g>`));
 assert.ok(group,`Missing ${view} elevation`);
 return [...group[1].matchAll(/<rect\b([^>]*)>/g)].map(match=>Object.fromEntries([...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(a=>[a[1],a[2]]))).filter(r=>r['data-kind']===kind);
};
test('front elevation uses actual per-bay shelves and model positions instead of global shelf count',()=>{
 const u=unit({shelves:8,bayShelves:[0,3]}),model=cabinet(u.config,u.id),svg=cabinetDrawingSvg(u);
 const actual=rects(svg,'front','shelf'),expected=model.parts.filter(p=>p.kind==='shelf');
 assert.equal(actual.length,3);assert.ok(actual.every(r=>r['data-bay']==='1'));
 for(const [i,p] of expected.entries()){
  assert.equal(actual[i]['data-part'],p.id);assert.equal(Number(actual[i].x),p.position.x-p.length/2);
  assert.equal(Number(actual[i].y),u.config.height-p.position.y-p.thickness/2);
  assert.equal(Number(actual[i].width),p.length);assert.equal(Number(actual[i].height),p.thickness);
 }
});
test('drawer front positions and dimensions follow regenerated cabinet model',()=>{
 for(const width of [800,1000]){
  const u=unit({width,height:850,partitions:0,shelves:0,bayDrawers:[3]}),svg=cabinetDrawingSvg(u);
  const actual=rects(svg,'front','drawerFront'),expected=cabinet(u.config,u.id).parts.filter(p=>p.kind==='drawerFront');
  assert.equal(actual.length,3);
  for(const [i,p] of expected.entries()){
   assert.equal(Number(actual[i].x),p.position.x-p.width/2);assert.equal(Number(actual[i].y),850-p.position.y-p.length/2);
   assert.equal(Number(actual[i].width),p.width);assert.equal(Number(actual[i].height),p.length);
  }
  assert.equal(rects(svg,'side','drawerSide').length,6);
 }
});
test('construction method side heights and top/bottom widths remain consistent with model',()=>{
 for(const construction of ['between','over']){
  const u=unit({construction}),svg=cabinetDrawingSvg(u),model=cabinet(u.config,u.id);
  const side=model.parts.find(p=>p.kind==='side');assert.equal(Number(rects(svg,'front','side')[0].height),side.length);
  assert.equal(Number(rects(svg,'side','side')[0].height),side.length);
  assert.equal(Number(rects(svg,'front','top')[0].width),model.parts.find(p=>p.kind==='top').length);
 }
});
test('door and back silhouettes follow panel dimensions and share exact part identifiers',()=>{
 const u=unit({doors:2,doorOverlay:2}),svg=cabinetDrawingSvg(u),model=cabinet(u.config,u.id);
 const actual=rects(svg,'front','door');assert.equal(actual.length,2);
 assert.equal(Number(actual[0].width),model.parts.find(p=>p.kind==='door').width);
 assert.equal(rects(svg,'front','back')[0]['data-part'],model.parts.find(p=>p.kind==='back').id);
});
test('SVG escapes project metadata and carries readable units, title, material and disclaimer',()=>{
 const u=unit({material:'Oak <veneer> & "solid"'});u.id='CAB-"<x>';u.name='Wardrobe <script>alert(1)</script> & "test"';
 const svg=cabinetDrawingSvg(u);
 assert.doesNotMatch(svg,/<script>|<veneer>|data-part="CAB-"/);
 assert.match(svg,/&lt;script&gt;/);assert.match(svg,/&lt;veneer&gt;/);assert.match(svg,/&quot;/);
 assert.match(svg,/FRONT ELEVATION/);assert.match(svg,/SIDE ELEVATION/);assert.match(svg,/900 mm/);assert.match(svg,/2200 mm/);assert.match(svg,/580 mm/);
 assert.match(svg,/NOT FOR FABRICATION/);assert.match(svg,/role="img"/);assert.match(svg,/<title/);
});
test('drawing rejects invalid model inputs and never emits non-finite coordinates',()=>{
 for(const u of [null,{},unit({width:1}),unit({height:NaN}),unit({depth:Infinity})])assert.throws(()=>cabinetDrawingSvg(u));
 const svg=cabinetDrawingSvg(unit({}));assert.doesNotMatch(svg,/NaN|Infinity|undefined/);
});
