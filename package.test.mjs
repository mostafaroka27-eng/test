import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPackage,readPackage,PACKAGE_FORMAT,packageChecksum} from './package.mjs';
import {issueRelease} from './releases.mjs';
import {parseProject} from './project.mjs';
import {partRecords} from './manufacturing.mjs';
import {DEFAULTS,MODERN_RULES} from './engine.mjs';
import {DEFAULT_ROOM} from './room.mjs';

const base=()=>parseProject({format:'rokadex-standalone',version:3,projectId:'PRJ-P',designRevision:1,lengthUnit:'mm',room:{...DEFAULT_ROOM},projectName:'Villa',clientName:'Ahmed',units:[{id:'CAB-001',name:'Wardrobe',type:'cabinet',x:0,z:0,finish:'oak',config:{...DEFAULTS,...MODERN_RULES,backConstruction:'groove',backGrooveDepth:8,backGrooveAllowance:2}}]});
const issued=()=>{const p=base();return parseProject({...p,releases:issueRelease(p,{note:'Client approved',now:new Date('2026-11-01T09:00:00Z')})})};

test('package: only issued revisions; carries R1 sizes even after the draft changes',()=>{
 assert.throws(()=>buildPackage(base(),1),/not issued/);
 const p=issued(),draft=structuredClone(p);draft.units[0].config.width=1200;draft.designRevision=2;
 const pkg=buildPackage(draft,1,{studio:'1.12.0',now:new Date('2026-11-01T10:00:00Z')});
 assert.equal(pkg.format,PACKAGE_FORMAT);assert.equal(pkg.project.revision,1);assert.equal(pkg.project.note,'Client approved');
 assert.equal(pkg.design.units[0].config.width,900);assert.equal(pkg.summary.parts,partRecords(p).length);
 assert.deepEqual(pkg.steps.map(s=>s.key),['cutting','edging','machining','assembly']);
 assert.ok(pkg.files.some(f=>f.purpose==='cut_list'&&f.text.includes('CAB-001')));assert.ok(pkg.files.some(f=>f.purpose==='saw_sequence'));
 assert.ok(!pkg.files.some(f=>/\.nc$|\.tap$/.test(f.name)),'no unverified G-code in the package');
});

test('package: read back, and refuse edited or damaged packages',()=>{
 const pkg=buildPackage(issued(),1),text=JSON.stringify(pkg);
 assert.equal(readPackage(text).project.projectId,'PRJ-P');
 const a=JSON.parse(text);a.summary.parts=1;assert.throws(()=>readPackage(JSON.stringify(a)),/changed or damaged/);
 const b=JSON.parse(text);b.design.units[0].config.width=1000;assert.throws(()=>readPackage(JSON.stringify(b)),/changed|damaged|fingerprint/);
 const c=JSON.parse(text);c.design.units[0].config.width=1000;c.checksum=packageChecksum(c);assert.throws(()=>readPackage(JSON.stringify(c)),/changed after it was issued|fingerprint/,'re-signed edit still caught by the issued fingerprint');
 assert.throws(()=>readPackage('{"format":"x"}'),/Not a Rokadex Studio package/);
 assert.throws(()=>readPackage('nope'),/not valid JSON/);
});
