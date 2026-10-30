import test from 'node:test';import assert from 'node:assert/strict';
import {validateHardwareLibrary,joineryPlan,hardwareLibraryTemplate,joineryCsv} from './joinery.mjs';
const panel={id:'P-1',kind:'door',length:2000,width:450,thickness:18};
test('template has no falsely approved manufacturer hardware',()=>{const lib=hardwareLibraryTemplate();assert.equal(lib.status,'USER_VERIFICATION_REQUIRED');assert.equal(lib.items.length,0)});
test('rejects missing manufacturer and unapproved patterns',()=>{assert.throws(()=>validateHardwareLibrary({items:[{id:'H1',type:'hinge',manufacturer:'',verified:true}]}));assert.throws(()=>validateHardwareLibrary({items:[{id:'H1',type:'hinge',manufacturer:'Acme',verified:false}]}))});
test('rejects out of bounds and through holes',()=>{const lib={items:[{id:'H1',type:'hinge',manufacturer:'Demo',verified:true,pattern:[{x:1990,y:50,diameter:35,depth:12}]}]};assert.throws(()=>joineryPlan(panel,lib,'H1'));const lib2={items:[{id:'H1',type:'hinge',manufacturer:'Demo',verified:true,pattern:[{x:20,y:50,diameter:5,depth:18}]}]};assert.throws(()=>joineryPlan(panel,lib2,'H1'))});
test('valid user-confirmed drilling coordinates yield machine-independent reference only',()=>{const lib={items:[{id:'H1',type:'hinge',manufacturer:'Demo',verified:true,pattern:[{x:22,y:75,diameter:5,depth:10}]}]};const result=joineryPlan(panel,lib,'H1');assert.equal(result.holes.length,1);assert.match(result.status,/NOT CNC/);assert.match(joineryCsv(result),/P-1/)});

test('hardware CSV neutralizes formulas in imported IDs and preserves numeric coordinates',()=>{
 const hardwareId=' =HYPERLINK("https://example.com")';
 const lib={items:[{id:hardwareId,type:'hinge',manufacturer:'Demo',verified:true,pattern:[{x:22,y:75,diameter:5,depth:10}]}]};
 const result=joineryPlan({...panel,id:'@SUM(1,2)'},lib,hardwareId);
 const output=joineryCsv(result);
 assert.ok(output.includes('"\'@SUM(1,2)"'));
 assert.ok(output.includes('"\' =HYPERLINK(""https://example.com"")"'));
 assert.ok(output.includes(',"22","75","5","10"'));
 const negative=joineryCsv({...result,holes:[{x:-22,y:75,diameter:5,depth:10}]});
 assert.ok(negative.includes(',"-22","75"'));
 assert.ok(!negative.includes('"\'-22"'));
});
test('hardware IDs must be nonempty bounded strings',()=>{
 const item={type:'hinge',manufacturer:'Demo',verified:true,pattern:[{x:22,y:75,diameter:5,depth:10}]};
 for(const id of [42,{},'   ','H'.repeat(201)]) assert.throws(()=>validateHardwareLibrary({items:[{...item,id}]}),/ID/);
});
