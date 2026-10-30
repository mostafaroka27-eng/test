import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {shopDrawingSvg,drawingSetHtml,layoutViews,chooseScale,partsSchedule,SCALES} from './shop-drawing.mjs';
import {ncdTemplates} from './reference-catalog.mjs';
import {cabinet,DEFAULTS} from './engine.mjs';

const ncd=JSON.parse(await readFile(new URL('./analysis/ncd-data.json',import.meta.url),'utf8'));
const templates=Object.fromEntries(ncdTemplates(ncd).templates.map(t=>[t.key,t]));
const unit=(key,id='CAB-001')=>({id,name:templates[key].nameEn,finish:templates[key].finish,config:templates[key].config});

test('views are laid out at a standard scale that fits the A3 drawing area',()=>{
 for(const [W,H,D] of [[600,2400,600],[1200,2400,600],[2400,2400,600],[900,850,580],[4800,2700,650]]){
  const L=layoutViews(W,H,D),k=1/L.n;
  assert.ok(SCALES.includes(L.n));
  const right=Math.max(L.interiorX+W*k,L.sectionX+D*k,L.planX+W*k),bottom=Math.max(L.top+H*k,L.sectionTop+H*k,L.planY+D*k);
  assert.ok(right<=262,`${W}x${H}x${D} right edge ${right}`);assert.ok(bottom<=280,`${W}x${H}x${D} bottom ${bottom}`);
 }
 assert.equal(chooseScale(600,2400,600),15);
 assert.ok(chooseScale(2400,2400,600)<=30,'wide units use the two-row arrangement');
});

test('sheet is A3 in millimetres and carries the model, title block and company identity',()=>{
 const svg=shopDrawingSvg(unit('drawHang'),{company:{name:'Example Joinery',phone:'+968 1',logo:'data:image/png;base64,AAAA'},project:{name:'Villa',client:'Mr. A',revision:3},date:'2026-10-30',sheetNumber:2,sheetCount:5});
 assert.match(svg,/width="420mm" height="297mm" viewBox="0 0 420 297"/);
 assert.match(svg,/data-scale="15"/);
 for(const text of ['Example Joinery','+968 1','Villa','Mr. A','1:15 @ A3','2/5','2026-10-30','PRELIMINARY · NOT FOR FABRICATION OR CNC','<image href="data:image/png;base64,AAAA"'])assert.ok(svg.includes(text),text);
 for(const view of ['front','interior','section','plan'])assert.match(svg,new RegExp(`data-view="${view}"`));
});

test('closed front shows fronts only; interior shows contents; every interior part comes from the model',()=>{
 const u=unit('drawHang'),model=cabinet(u.config,u.id),svg=shopDrawingSvg(u);
 const front=svg.match(/<g data-view="front">([\s\S]*?)<\/g><g data-view="interior">/)[1];
 assert.ok(!front.includes('data-kind="shelf"'),'shelves hidden behind the door');
 assert.ok(!front.includes('data-kind="drawerFace"'),'internal drawers hidden behind the door');
 assert.equal((front.match(/data-kind="door"/g)||[]).length,1);
 const interior=svg.match(/<g data-view="interior">([\s\S]*?)<\/g><g data-view="section">/)[1];
 for(const part of model.parts.filter(p=>!['door','drawerFront'].includes(p.kind)))assert.ok(interior.includes(`data-part="${part.id}"`),part.id);
 assert.match(interior,/▾1900/);
});

test('open units show shelves in the front elevation; external drawer fronts are drawn',()=>{
 const open=shopDrawingSvg(unit('open'));
 const front=open.match(/<g data-view="front">([\s\S]*?)<\/g><g data-view="interior">/)[1];
 assert.ok(front.includes('data-kind="shelf"'));
 const legacy=shopDrawingSvg({id:'L-1',name:'Legacy',finish:'oak',config:{...DEFAULTS,bayDrawers:[2,0]}});
 assert.match(legacy,/data-kind="drawerFront"/);
});

test('parts schedule groups identical parts and matches the model count',()=>{
 const u=unit('combo'),model=cabinet(u.config,u.id),rows=partsSchedule(model);
 assert.equal(rows.reduce((n,r)=>n+r.qty,0),model.parts.length);
 assert.equal(rows.find(r=>r.kind==='side').qty,4);
 assert.equal(partsSchedule(model,'ar').find(r=>r.kind==='door').name,'باب');
});

test('without company settings the sheet asks for them instead of inventing a name',()=>{
 const svg=shopDrawingSvg(unit('hang'));
 assert.match(svg,/Set company name and logo in Settings/);
 assert.ok(!/النقش|Naqsh/.test(svg));
});

test('drawing set prints one A3 page per unit and escapes text',()=>{
 const html=drawingSetHtml([unit('hang','A-1'),unit('combo','A-2')],{project:{name:'<b>x</b>'}});
 assert.equal((html.match(/<section class="sheet">/g)||[]).length,2);
 assert.match(html,/@page\{size:A3 landscape/);
 assert.ok(!html.includes('<b>x</b>'));
 assert.throws(()=>drawingSetHtml([]),/No units/);
});
