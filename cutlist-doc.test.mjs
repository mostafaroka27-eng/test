import test from 'node:test';
import assert from 'node:assert/strict';
import {cutListGroups,cutListTotals,cutListHtml} from './cutlist-doc.mjs';
import {partRecords,manufacturingCsv} from './manufacturing.mjs';
import {DEFAULTS,MODERN_RULES} from './engine.mjs';

const unit=(id,extra={})=>({id,name:'Wardrobe',type:'cabinet',x:0,z:0,config:{...DEFAULTS,...MODERN_RULES,...extra}});
const project=units=>({projectId:'PRJ-T',designRevision:2,units});

test('cut list: hand-checked 900 × 2200 × 580 wardrobe (18 mm MDF, 1 mm PVC, edge deduction on)',()=>{
 const groups=cutListGroups(project([unit('CAB-001')]));
 const row=kind=>groups.find(g=>g.kind===kind);
 // Side: front long edge banded → width 580 − 1 = 579; length unchanged (short edges bare).
 assert.deepEqual([row('side').qty,row('side').cutLength,row('side').cutWidth,row('side').edges.join('')],[2,2200,579,'1000']);
 // Shelves: (900 − 3 × 18) / 2 = 423 inner bay − 2 × 1 side clearance = 421; depth 580 − 6 back − 20 front setback = 554.
 assert.deepEqual([row('shelf').qty,row('shelf').finishLength,row('shelf').finishWidth,row('shelf').cutWidth],[6,421,554,553]);
 // Back: no banding → cut = finished; grain free.
 assert.deepEqual([row('back').cutLength,row('back').cutWidth,row('back').grain],[2164,864,'none']);
 const totals=cutListTotals(groups),mdf=totals.find(t=>t.material==='MDF 18 mm');
 // 2·2200·579 + 2·864·579 + 2164·573 + 6·421·553 = 6 184 962 mm²; band 2·2200 + 2·864 + 2164 + 6·421 = 10 818 mm.
 assert.equal(mdf.areaM2,6.18);assert.equal(mdf.bandM,10.82);assert.equal(mdf.parts,11);
});

test('cut list: every part appears exactly once and matches the manufacturing CSV records',()=>{
 const p=project([unit('CAB-001'),unit('CAB-002',{width:600,doors:1,drawers:2,thickness:16,edgeThickness:2}),unit('CAB-003',{edgeDeduction:'off'})]);
 const groups=cutListGroups(p),records=partRecords(p);
 assert.equal(groups.reduce((s,g)=>s+g.qty,0),records.length);
 assert.deepEqual(groups.flatMap(g=>g.uids).sort(),records.map(r=>r.uid).sort());
 for(const g of groups){
  const ded=g.unitId==='CAB-003'?0:g.edgeThickness;
  assert.equal(g.cutLength,Math.round((g.finishLength-ded*(g.edges[1]+g.edges[3]))*100)/100,`${g.unitId} ${g.kind} length`);
  assert.equal(g.cutWidth,Math.round((g.finishWidth-ded*(g.edges[0]+g.edges[2]))*100)/100,`${g.unitId} ${g.kind} width`);
  for(const uid of g.uids){const r=records.find(x=>x.uid===uid);assert.equal(r.cutLength,g.cutLength);assert.equal(r.cutWidth,g.cutWidth);assert.equal(r.material,g.material)}
 }
 const csv=manufacturingCsv(p);for(const uid of records.map(r=>r.uid))assert.ok(csv.includes(uid));
});

test('cut list document: English and Arabic, grouped by material, escaped, marked preliminary',()=>{
 const p={...project([unit('CAB-001')]),projectName:'<script>x</script>',clientName:'عميل'};
 const en=cutListHtml(p,{date:new Date('2026-10-31T00:00:00Z')});
 assert.match(en,/Cut list/);assert.match(en,/PRELIMINARY/);assert.match(en,/MDF 18 mm/);assert.match(en,/2026-10-31/);assert.match(en,/cab-2\.0/);
 assert.ok(!en.includes('<script>x'),'project name is escaped');assert.ok(en.includes('&lt;script&gt;'));
 assert.match(en,/2200 × 579/);assert.match(en,/<b>6<\/b>/);
 const ar=cutListHtml(p,{lang:'ar',company:{name:'',nameAr:'ورشة'}});
 assert.match(ar,/dir="rtl"/);assert.match(ar,/قائمة التقطيع/);assert.match(ar,/ورشة/);assert.match(ar,/جنب/);
 assert.ok(!cutListHtml(p,{company:{logo:'javascript:alert(1)'}}).includes('javascript:'),'only data-image logos');
});
