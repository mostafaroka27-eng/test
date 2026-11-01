import test from 'node:test';
import assert from 'node:assert/strict';
import {optimizerRows,optimizerCsv,cutSequence,verifyCutSequence,cutSequenceCsv,cutSequenceHtml} from './beamsaw.mjs';
import {projectSheetPlan} from './review.mjs';
import {partRecords} from './manufacturing.mjs';
import {DEFAULTS,MODERN_RULES} from './engine.mjs';

const unit=(id,extra={})=>({id,name:'Wardrobe',type:'cabinet',x:0,z:0,config:{...DEFAULTS,...MODERN_RULES,...extra}});
const project={projectId:'PRJ-S',designRevision:3,units:[unit('CAB-001'),unit('CAB-002',{width:600,grain:'horizontal'})]};

test('beam saw: optimizer list has every sheet part once, length along the grain, cut sizes',()=>{
 const rows=optimizerRows(project),records=partRecords(project).filter(r=>r.sheetGood!==false);
 assert.equal(rows.reduce((s,r)=>s+r.qty,0),records.length);
 const side=rows.find(r=>r.unit==='CAB-001'&&r.component==='side');
 assert.deepEqual([side.length,side.width,side.qty,side.grain,side.edgeL1,side.edgeL2],[2200,579,2,'Y',1,0]);
 const hside=rows.find(r=>r.unit==='CAB-002'&&r.component==='side');
 assert.deepEqual([hside.length,hside.width,hside.edgeW1,hside.edgeL1],[579,2200,1,0],'horizontal grain swaps sides and edges');
 const csv=optimizerCsv(project);assert.ok(csv.startsWith('﻿Row,Material'));assert.match(csv,/MDF 18 mm,18,2200,579,2,Y/);
 const semi=optimizerCsv({...project,units:[unit('CAB-009',{edgeThickness:0.4})]},{style:'semicolon'});assert.match(semi,/;0,4;/);assert.match(semi,/^﻿Row;Material;/);
});

test('beam saw: guillotine sequence rebuilds exactly the planned pieces with straight through-cuts',()=>{
 const plan=projectSheetPlan(project.units),seq=cutSequence(plan,{trim:10,kerf:3.2});
 assert.deepEqual(verifyCutSequence(plan,seq),[]);
 assert.equal(seq.reduce((s,q)=>s+q.steps.filter(t=>t.stage==='cross').length,0),plan.placedCount);
 for(const q of seq)assert.equal(q.steps[0].stage,'trim');
 assert.match(cutSequenceCsv(seq),/rip/);
 const html=cutSequenceHtml(plan,seq,{projectName:'<b>x',lang:'ar'});assert.match(html,/dir="rtl"/);assert.ok(!html.includes('<b>x'));
});
