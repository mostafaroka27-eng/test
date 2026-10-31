import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {unitSummary,featureText,proposalHtml} from './showroom.mjs';
import {ncdTemplates} from './reference-catalog.mjs';

const ncd=JSON.parse(await readFile(new URL('./analysis/ncd-data.json',import.meta.url),'utf8'));
const t=Object.fromEntries(ncdTemplates(ncd).templates.map(x=>[x.key,x]));
const unit=(key,id)=>({id,name:t[key].nameEn,finish:t[key].finish,config:t[key].config});

test('client summary counts come from the model',()=>{
 assert.deepEqual(unitSummary(unit('drawHang','A')),{width:600,height:2400,depth:618,bays:1,doors:1,glassDoors:0,drawers:3,shelves:2,rails:1});
 assert.equal(unitSummary(unit('glass','B')).glassDoors,1);
 assert.equal(featureText(unitSummary(unit('open','C'))),'1 sections · 5 shelves');
 assert.match(featureText(unitSummary(unit('drawHang','A')),'ar'),/3 أدراج/);
});

test('proposal has a cover and one page per unit, with company identity and no prices',()=>{
 const html=proposalHtml({company:{name:'Example Joinery',phone:'+968 1'},project:{name:'Villa',client:'Mr. A',revision:2},units:[unit('hang','A'),unit('combo','B')],images:{overview:'data:image/jpeg;base64,AA',A:'data:image/jpeg;base64,BB'},finishName:()=>'White',date:'2026-10-30'});
 assert.equal((html.match(/<section class="page/g)||[]).length,3);
 for(const text of ['Example Joinery','+968 1','Villa','Mr. A','2026-10-30','600 × 2400 × 618','White','data:image/jpeg;base64,BB'])assert.ok(html.includes(text),text);
 assert.ok(!/price|OMR|ر\.ع/i.test(html));
 const ar=proposalHtml({project:{},units:[unit('hang','A')],lang:'ar'});
 assert.match(ar,/dir="rtl"/);assert.match(ar,/عرض تصميم/);
});

test('proposal adds a room page with the plan and floor areas when a room is given',()=>{
 const room={width:4000,depth:3000,height:2700,openings:[{wall:'back',type:'window',offset:1000,width:1200,height:1200,sill:900}]};
 const html=proposalHtml({project:{name:'Villa'},units:[{...unit('hang','A'),x:0,z:-1200}],images:{top:'data:image/jpeg;base64,TT'},room,date:'2026-10-31'});
 assert.equal((html.match(/<section class="page/g)||[]).length,3);
 for(const text of ['Room layout','12 m²','data-opening="window"','data:image/jpeg;base64,TT'])assert.ok(html.includes(text),text);
});
