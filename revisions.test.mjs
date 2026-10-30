import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULTS} from './engine.mjs';
import {DEFAULT_ROOM} from './room.mjs';
import {DEFAULT_COSTING} from './costing.mjs';
import {REVISION_KEY,MAX_REVISIONS,MAX_REVISION_BYTES,saveRevision,listRevisions,loadRevision,deleteRevision} from './revisions.mjs';

const project=()=>({format:'rokadex-standalone',version:3,projectId:'PRJ-TEST',designRevision:1,lengthUnit:'mm',room:{...DEFAULT_ROOM},units:[{id:'CAB-001',name:'Kitchen',type:'cabinet',x:0,z:0,rotation:90,finish:'oak',config:{...DEFAULTS}}],costing:{...DEFAULT_COSTING,currency:'OMR',materials:[{material:DEFAULTS.material,thickness:18,pricePerM2:25}]}});
const memory=()=>{const values=new Map();return {values,getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)}};

test('named revisions save and restore detached projects including costing and quarter turns',()=>{
 const storage=memory(),input=project();assert.deepEqual(listRevisions(storage),[]);
 const before=Date.now(),list=saveRevision(storage,input,{label:'  مراجعة العميل  '});
 assert.equal(list.length,1);assert.equal(list[0].label,'مراجعة العميل');assert.ok(Date.parse(list[0].createdAt)>=before);
 assert.match(list[0].id,/^[a-f0-9-]{36}$/i);assert.deepEqual(loadRevision(storage,list[0].id),input);
 input.units[0].config.width=1200;list[0].label='changed';
 const snapshot=loadRevision(storage,list[0].id);assert.equal(snapshot.units[0].config.width,900);assert.equal(snapshot.units[0].rotation,90);assert.equal(snapshot.costing.currency,'OMR');
 snapshot.costing.materials[0].pricePerM2=99;assert.equal(loadRevision(storage,list[0].id).costing.materials[0].pricePerM2,25);
 assert.equal(listRevisions(storage)[0].label,'مراجعة العميل');
});
test('retains the newest ten unique revisions and removes only the oldest retained entry',()=>{
 const storage=memory();let list=[];const ids=[];
 for(let i=0;i<MAX_REVISIONS+1;i++){list=saveRevision(storage,project(),{label:`Revision ${i}`});ids.push(list.at(-1).id)}
 assert.equal(list.length,10);assert.equal(new Set(ids).size,11);assert.equal(list[0].label,'Revision 1');assert.equal(list.at(-1).label,'Revision 10');
 assert.throws(()=>loadRevision(storage,ids[0]),/not found/);
 assert.equal(listRevisions(storage).length,10);
});
test('deletes one requested revision and respects a custom storage key without changing backups',()=>{
 const storage=memory();storage.setItem('rokadex-standalone.autosave.v2','existing backup');
 const first=saveRevision(storage,project(),{label:'First',key:'my-revisions'});
 const second=saveRevision(storage,project(),{label:'Second',key:'my-revisions'});
 assert.deepEqual(listRevisions(storage),[]);assert.equal(listRevisions(storage,'my-revisions').length,2);
 assert.equal(deleteRevision(storage,first[0].id,'my-revisions')[0].id,second[1].id);
 assert.throws(()=>loadRevision(storage,first[0].id,'my-revisions'),/not found/);
 assert.deepEqual(deleteRevision(storage,second[1].id,'my-revisions'),[]);
 assert.equal(storage.getItem('rokadex-standalone.autosave.v2'),'existing backup');
});
test('invalid projects and labels reject before writing or trimming any existing revisions',()=>{
 const storage=memory();saveRevision(storage,project(),{label:'Retain me'});const original=storage.getItem(REVISION_KEY);
 for(const label of ['', '  ', 'x'.repeat(121), 'bad\nlabel',12])assert.throws(()=>saveRevision(storage,project(),{label}));
 assert.throws(()=>saveRevision(storage,{},{label:'Invalid project'}));
 assert.throws(()=>saveRevision(storage,project(),{label:'New',key:''}));
 assert.equal(storage.getItem(REVISION_KEY),original);
});
test('corrupt, invalid, duplicate and oversized stored entries are never overwritten',()=>{
 const storage=memory();saveRevision(storage,project(),{label:'Valid'});const valid=JSON.parse(storage.getItem(REVISION_KEY));
 const badProject=structuredClone(valid);badProject.entries[0].project.units[0].config.width=-1;
 const duplicate=structuredClone(valid);duplicate.entries.push(structuredClone(duplicate.entries[0]));
 const badDate=structuredClone(valid);badDate.entries[0].createdAt='not-a-date';
 for(const raw of ['{broken','{}',JSON.stringify(badProject),JSON.stringify(duplicate),JSON.stringify(badDate),' '.repeat(MAX_REVISION_BYTES+1)]){
  storage.setItem(REVISION_KEY,raw);
  assert.throws(()=>listRevisions(storage));assert.throws(()=>saveRevision(storage,project(),{label:'Do not replace'}));
  assert.throws(()=>deleteRevision(storage,valid.entries[0].id));assert.equal(storage.getItem(REVISION_KEY),raw);
 }
});
test('quota failures preserve the old store even when a new revision would evict the oldest',()=>{
 const storage=memory();let list=[];
 for(let i=0;i<10;i++)list=saveRevision(storage,project(),{label:`Revision ${i}`});
 const original=storage.getItem(REVISION_KEY),failing={getItem:storage.getItem,setItem(){throw Error('Quota exceeded')}};
 assert.throws(()=>saveRevision(failing,project(),{label:'Blocked'}),/Export JSON/i);
 assert.equal(storage.getItem(REVISION_KEY),original);
 assert.throws(()=>deleteRevision(failing,list[0].id),/Export JSON/i);assert.equal(storage.getItem(REVISION_KEY),original);
});
test('the four-megabyte serialized budget rejects a large candidate without silently pruning history',()=>{
 const storage=memory();saveRevision(storage,project(),{label:'Small'});const large=project();
 large.units[0].config.partOverrides=Object.fromEntries(Array.from({length:65000},(_,i)=>[`side:${i}`,{edges:[1,0,0,0]}]));
 saveRevision(storage,large,{label:'Large one'});const before=storage.getItem(REVISION_KEY);
 assert.throws(()=>saveRevision(storage,large,{label:'Large two'}),/4 MB.*Export JSON/i);
 assert.equal(storage.getItem(REVISION_KEY),before);assert.equal(listRevisions(storage).length,2);
});
