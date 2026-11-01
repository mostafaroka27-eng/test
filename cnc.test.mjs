import test from 'node:test';
import assert from 'node:assert/strict';
import {cncProfile,cncSheetPlan,sheetGcode,checkGcode,sheetLimits,sheetToolpaths,toolpathSvg} from './cnc.mjs';
import {DEFAULTS,MODERN_RULES} from './engine.mjs';

const unit=(id,extra={})=>({id,name:'Wardrobe',type:'cabinet',x:0,z:0,config:{...DEFAULTS,...MODERN_RULES,...extra}});
const units=[unit('CAB-001'),unit('CAB-002',{width:600,backConstruction:'groove',backInset:0,backGrooveDepth:8,backGrooveAllowance:2})];

test('cnc: router layout keeps tool diameter + gap between parts and every part is placed once',()=>{
 const plan=cncSheetPlan(units,{toolDiameter:6,partGap:2});
 assert.equal(plan.unplaced.length,0);
 for(const s of plan.sheets){
  assert.ok(s.trim>=10&&s.spacing===8);
  for(const a of s.placed)for(const b of s.placed){if(a===b)continue;
   const gapX=Math.max(b.x-(a.x+a.w),a.x-(b.x+b.w)),gapY=Math.max(b.y-(a.y+a.h),a.y-(b.y+b.h));
   assert.ok(Math.max(gapX,gapY)>=8-1e-6,`${a.id} and ${b.id} are ${Math.max(gapX,gapY)} mm apart`);}
 }
});

test('cnc: G-code stays on the sheet, never rapids into the board and cuts exactly board + overcut',()=>{
 for(const prof of [{},{zZero:'table',orientation:'rotate90',direction:'climb',tabs:2,dialect:'grbl'}]){
  const plan=cncSheetPlan(units,prof);
  plan.sheets.forEach((s,i)=>{
   const {text}=sheetGcode(s,prof,{index:i+1,projectId:'PRJ-T',revision:1});
   const lim=sheetLimits(s,prof),res=checkGcode(text,{...lim,rapid:10000});
   assert.deepEqual(res.errors,[],`sheet ${i+1}`);
   if(s.group.startsWith('MDF 18'))assert.equal(Math.round(res.box.minZ*1000)/1000,Math.round((lim.top-18.3)*1000)/1000);
   assert.ok(res.cutMm>0&&res.minutes>0);
   assert.match(text,/UNVERIFIED/);assert.match(text,/^\(RokaDex/);assert.ok(text.trimEnd().endsWith('M30'));
  });
 }
});

test('cnc: tool-radius compensation — profile runs D/2 outside the 2200 × 579 side, in 4 equal passes of 4.575 mm',()=>{
 const plan=cncSheetPlan([unit('CAB-001')],{toolDiameter:6,stepDown:5});
 const s=plan.sheets.find(x=>x.placed.some(p=>p.id==='CAB-001-SIDE-001'));
 const op=sheetToolpaths(s,{toolDiameter:6}).ops.find(o=>o.id==='CAB-001-SIDE-001');
 const [x,y,w,h]=op.rect;assert.deepEqual([w,h].sort((a,b)=>a-b),[579,2200]);
 assert.deepEqual(op.loop[0],[x-3,y-3]);assert.deepEqual(op.loop[2],[x+w+3,y+h+3]);
 const {text}=sheetGcode(s,{toolDiameter:6,stepDown:5});
 const block=text.split('(profile CAB-001-SIDE-001')[1].split('(profile')[0];
 assert.deepEqual([...block.matchAll(/^G1 Z(-[\d.]+)/gm)].map(m=>Number(m[1])),[-4.575,-9.15,-13.725,-18.3]);
});

test('cnc: tabs lift to leave the set bridge height; grooves follow the back groove of grooved panels',()=>{
 const prof={tabs:4,tabHeight:3,toolDiameter:6};
 const plan=cncSheetPlan([unit('CAB-002',{width:600,backConstruction:'groove',backInset:0,backGrooveDepth:8,backGrooveAllowance:2})],prof);
 const s=plan.sheets.find(x=>x.placed.some(p=>p.id.includes('SIDE')));
 const {text}=sheetGcode(s,prof);
 assert.ok(text.includes('Z-15 '),'tab top at 18 − 3 = 15 mm down');
 const tp=sheetToolpaths(s,prof),g=tp.ops.find(o=>o.type==='groove'&&o.id.includes('SIDE'));
 assert.ok(g,'side groove machined');assert.equal(g.depth,8);
 // 6 mm back in a 6 mm tool: one pass on the groove centre line, 3 mm (backInset 0 + half width) from the rear L2 edge.
 const pl=s.placed.find(p=>p.id===g.id);assert.equal(g.lines.length,1);
 const centre=pl.rotated?g.lines[0][0][0]:g.lines[0][0][1];assert.equal(centre,pl.rotated?pl.x+pl.w-3:pl.y+pl.h-3);
 assert.match(text,/inner grooved face UP/);
 assert.match(toolpathSvg(s,prof),/toolpath preview/);
});

test('cnc: profile validation and the checker catch unsafe code',()=>{
 assert.throws(()=>cncProfile({toolDiameter:0}),/toolDiameter/);
 assert.throws(()=>cncProfile({header:'G21 (مرحبا)'}),/ASCII/);
 assert.throws(()=>cncProfile({tabs:3}),/Tabs/);
 const bad='G21\nG0 Z5\nG0 X10 Y10\nG0 Z-2\nG0 X50 Y10\nG1 X60 Z-30 F1000\nG1 X5000';
 const r=checkGcode(bad,{xMax:2440,yMax:1220,top:0,bottom:-18.3});
 assert.ok(r.errors.some(e=>/rapid move below/.test(e)));assert.ok(r.errors.some(e=>/below the allowed depth/.test(e)));assert.ok(r.errors.some(e=>/outside the sheet/.test(e)));
});
