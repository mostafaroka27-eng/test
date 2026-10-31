import test from 'node:test';
import assert from 'node:assert/strict';
import {issueRelease,releaseState,revisionAfterEdit,releasedProject,contentHash} from './releases.mjs';
import {parseProject,serializeProject} from './project.mjs';
import {DEFAULTS,MODERN_RULES} from './engine.mjs';
import {DEFAULT_ROOM} from './room.mjs';
import {partRecords} from './manufacturing.mjs';

const base=()=>parseProject({format:'rokadex-standalone',version:3,projectId:'PRJ-R',designRevision:1,lengthUnit:'mm',room:{...DEFAULT_ROOM},projectName:'Villa',units:[{id:'CAB-001',name:'Wardrobe',type:'cabinet',x:0,z:0,finish:'oak',config:{...DEFAULTS,...MODERN_RULES}}]});
const issue=(p,note)=>parseProject({...p,releases:issueRelease(p,{note,now:new Date('2026-10-31T10:00:00Z')})});

test('issue: freezes R1, survives save and reopen, state is issued',()=>{
 const p=issue(base(),'For client approval');
 assert.equal(p.releases.length,1);assert.equal(p.releases[0].revision,1);assert.equal(p.releases[0].note,'For client approval');
 assert.equal(releaseState(p).status,'issued');
 const reopened=parseProject(serializeProject(p));assert.deepEqual(reopened.releases,p.releases);
 assert.equal(Object.hasOwn(base(),'releases'),false,'files without issues stay unchanged');
});

test('issue: the first edit opens R2 as a draft; R1 keeps the old sizes and cut list',()=>{
 const p=issue(base());
 const edited=structuredClone(p);edited.units[0].config.width=1000;
 assert.equal(revisionAfterEdit(edited),2);
 edited.designRevision=2;assert.equal(releaseState(edited).status,'draft');
 const r1=releasedProject(edited,1);assert.equal(r1.units[0].config.width,900);assert.equal(r1.designRevision,1);
 assert.notDeepEqual(partRecords(r1).map(r=>r.cutLength),partRecords(edited).map(r=>r.cutLength));
 // Undo back to the issued design: no further bump, state "unchanged".
 const back={...structuredClone(edited),units:structuredClone(p.units)};assert.equal(releaseState(back).status,'unchanged');assert.equal(revisionAfterEdit(back),2);
 const two=issue(edited,'Wider');assert.deepEqual(two.releases.map(r=>r.revision),[1,2]);
});

test('issue: refuses re-issuing the same design or number, and tampered or out-of-order files',()=>{
 const p=issue(base());
 assert.throws(()=>issueRelease(p),/Nothing changed since R1/);
 const changed=structuredClone(p);changed.units[0].config.width=1000;assert.throws(()=>issueRelease(changed),/R1 is already issued/);
 const tampered=JSON.parse(serializeProject(p));tampered.releases[0].content.units[0].config.width=1200;
 assert.throws(()=>parseProject(tampered),/R1 was changed after it was issued/);
 const lower=JSON.parse(serializeProject(p));lower.designRevision=1;lower.releases[0].revision=3;
 assert.throws(()=>parseProject(lower),/lower than the last issued/);
 const twice=JSON.parse(serializeProject(p));twice.releases.push(structuredClone(twice.releases[0]));
 assert.throws(()=>parseProject(twice),/numbered upwards/);
 const extra=JSON.parse(serializeProject(p));extra.releases[0].content.secret=1;assert.throws(()=>parseProject(extra),/unknown data/);
});

test('issue: hash ignores key order and identity, follows design content',()=>{
 const a=base(),b=structuredClone(a);b.designRevision=7;b.projectId='PRJ-OTHER';
 assert.equal(contentHash(a),contentHash(b));
 const reordered=Object.fromEntries(Object.entries(a).reverse());assert.equal(contentHash(a),contentHash(reordered));
 b.projectName='Villa B';assert.notEqual(contentHash(a),contentHash(b));
});
