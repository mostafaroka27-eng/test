import test from 'node:test';
import assert from 'node:assert/strict';
import {drillingPreview, drillingCsv, drillingSvg} from './machining.mjs';
const side={id:'CAB-001-SIDE-001',kind:'side',length:2200,width:580,thickness:18};
test('32 mm pilot pattern stays within panel safe margins',()=>{const result=drillingPreview(side,{pitch:32,offset:37,margin:64,diameter:5,depth:10});assert.ok(result.holes.length>40);assert.ok(result.holes.every(h=>h.x>=64&&h.x<=2136&&h.y>=37&&h.y<=543));assert.equal(result.status,'REFERENCE ONLY — NOT CNC READY')});
test('small panels yield no holes rather than unsafe geometry',()=>{const r=drillingPreview({...side,length:100,width:50},{pitch:32,offset:37,margin:64,diameter:5,depth:10});assert.equal(r.holes.length,0)});
test('invalid drill depth and diameter rejected',()=>{assert.throws(()=>drillingPreview(side,{pitch:32,offset:37,margin:64,diameter:5,depth:19}),/depth/);assert.throws(()=>drillingPreview(side,{pitch:32,offset:37,margin:64,diameter:0,depth:10}),/diameter/)});
test('CSV exports machine-independent reference coordinates',()=>{const r=drillingPreview(side);const s=drillingCsv(r);assert.match(s,/part_id,x_mm,y_mm/);assert.match(s,/CAB-001-SIDE-001/);assert.match(s,/REFERENCE ONLY/)});
test('SVG is an escaped schematic with circles',()=>{const r=drillingPreview({...side,id:'<unsafe>'});const s=drillingSvg(r);assert.match(s,/<svg/);assert.match(s,/<circle/);assert.doesNotMatch(s,/<unsafe>/)});

test('drilling CSV neutralizes string formulas while retaining numeric coordinates',()=>{
 const result=drillingPreview({...side,id:'\t=HYPERLINK("https://example.com")'});
 const output=drillingCsv(result);
 assert.ok(output.includes('"\'\t=HYPERLINK(""https://example.com"")"'));
 assert.ok(output.includes(',"66.5","37","5","10"'));
 const negative=drillingCsv({...result,holes:[{x:-10.5,y:37,diameter:5,depth:10}]});
 assert.ok(negative.includes(',"-10.5","37"'));
 assert.ok(!negative.includes('"\'-10.5"'));
});
