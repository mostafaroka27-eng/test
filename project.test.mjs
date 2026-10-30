import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULTS} from './engine.mjs';
import {DEFAULT_ROOM} from './room.mjs';
import {parseProject,serializeProject,createHistory,saveBackup,loadBackup,MAX_PROJECT_BYTES} from './project.mjs';
import {DEFAULT_COSTING} from './costing.mjs';

const project=()=>({format:'rokadex-standalone',version:3,projectId:'PRJ-TEST',designRevision:1,lengthUnit:'mm',room:{...DEFAULT_ROOM},units:[{id:'CAB-001',name:'خزانة تجريبية',type:'cabinet',x:0,z:0,finish:'oak',config:{...DEFAULTS,partitions:1,bayShelves:[1,2],bayDrawers:[2,0],partOverrides:{'side:0':{edges:[1,1,0,0]}}}}]});

test('version 3 roundtrip preserves room, drawers, materials and individual edge overrides',()=>{
 const input=project(); input.room.width=5000; input.units[0].config.material='Oak "premium", veneer';
 assert.deepEqual(parseProject(serializeProject(input)),input);
});
// Format changed in 1.4: v2 files migrate explicitly to v3 without altering geometry or settings.
test('version 2 file migrates to v3 with an explicit record and unchanged units',()=>{
 const legacy=project();legacy.version=2;delete legacy.projectId;delete legacy.designRevision;delete legacy.lengthUnit;
 const once=parseProject(legacy);
 assert.equal(once.version,3);assert.equal(once.migratedFrom,2);assert.match(once.projectId,/^PRJ-[0-9A-F]{8}$/);assert.equal(once.designRevision,1);
 assert.deepEqual(once.units,legacy.units);assert.deepEqual(once.room,legacy.room);
 assert.equal(parseProject(legacy).projectId,once.projectId,'reopening the same legacy file yields the same project ID');
 assert.deepEqual(parseProject(serializeProject(once)),once);
});
test('legacy version 1 gains default room and missing engineering defaults',()=>{
 const input=project(); input.version=1; delete input.room; delete input.units[0].config.drawerGap;
 const result=parseProject(input);
 assert.equal(result.version,3); assert.equal(result.migratedFrom,1); assert.deepEqual(result.room,DEFAULT_ROOM); assert.equal(result.units[0].config.drawerGap,DEFAULTS.drawerGap);
});
test('normalized project is detached and parsing does not mutate source on failure',()=>{
 const input=project(),copy=structuredClone(input),result=parseProject(input);
 result.units[0].config.bayShelves[0]=9; assert.deepEqual(input,copy);
 input.units.push({...structuredClone(input.units[0]),id:'BAD" onclick="alert(1)'});
 const failedCopy=structuredClone(input); assert.throws(()=>parseProject(input),/ID/); assert.deepEqual(input,failedCopy);
});
test('rejects duplicate, non-string and HTML attribute unit IDs',()=>{
 for(const id of [1,{},'CAB-001" autofocus onfocus="alert(1)','<img>', '__proto__']){
  const input=project(); input.units[0].id=id; assert.throws(()=>parseProject(input),/ID/);
 }
 const input=project(); input.units.push(structuredClone(input.units[0])); assert.throws(()=>parseProject(input),/ID/);
});
test('rejects unsupported files, empty projects and malformed configurations',()=>{
 for(const input of [null,[],{},'{invalid', {...project(),version:4},{...project(),projectId:undefined},{...project(),designRevision:0},{...project(),units:[]}])assert.throws(()=>parseProject(input));
 for(const value of [null,[],42]){const input=project();input.units[0].config=value;assert.throws(()=>parseProject(input));}
 const input=project(); input.units[0].config.partOverrides={'side:0':null}; assert.throws(()=>parseProject(input));
});
test('rejects unsafe fields and over-sized model dimensions or coordinates',()=>{
 for(const [key,value] of [['id',''],['name','a'.repeat(201)],['finish','toString'],['x',100001],['z',null]]){
  const input=project();input.units[0][key]=value;assert.throws(()=>parseProject(input));
 }
 for(const value of [Infinity,NaN,10001]){const input=project();input.units[0].config.width=value;assert.throws(()=>parseProject(input));}
 const input=project();input.units[0].config.material={toString:'not text'};assert.throws(()=>parseProject(input));
});
test('rejects excessive import bytes, unit count and component count before rendering',()=>{
 assert.throws(()=>parseProject(' '.repeat(MAX_PROJECT_BYTES+1)),/5 MB/);
 const input=project();input.units=Array.from({length:101},(_,i)=>({...input.units[0],id:`CAB-${i}`})); assert.throws(()=>parseProject(input),/100/);
 const crowded=project(); crowded.units[0].config={...DEFAULTS,width:10000,partitions:30,shelves:30,bayDrawers:Array(31).fill(12)};
 assert.throws(()=>parseProject(crowded),/parts/);
});
test('rejects invalid generated panel dimensions, rather than accepting impossible drawer fronts',()=>{
 const input=project();input.units[0].config={...DEFAULTS,partitions:0,shelves:0,bayDrawers:[1],drawerGap:800};assert.throws(()=>parseProject(input));
});
test('history supports independent undo/redo, no-op pushes and truncating redo after edit',()=>{
 const initial=project(),history=createHistory(initial); initial.units[0].config.width=950;
 assert.equal(history.canUndo,false); assert.equal(history.push(project()),false);
 const edited=project();edited.units[0].config.width=1000;assert.equal(history.push(edited),true);
 const restored=history.undo();assert.equal(restored.units[0].config.width,900); restored.units[0].config.width=800;
 assert.equal(history.current().units[0].config.width,900);assert.equal(history.redo().units[0].config.width,1000);
 history.undo();edited.units[0].config.width=1100;history.push(edited);assert.equal(history.canRedo,false);assert.equal(history.redo(),null);
});
test('history bounds retained snapshots and rejects invalid edits atomically',()=>{
 const history=createHistory(project(),{limit:2});
 for(const width of [1000,1100,1200]){const p=project();p.units[0].config.width=width;history.push(p);}
 assert.equal(history.undo().units[0].config.width,1100);assert.equal(history.undo(),null);
 const before=history.current();assert.throws(()=>history.push({}));assert.deepEqual(history.current(),before);
 assert.throws(()=>createHistory(project(),{limit:0}));
});
test('local backup restores full project and surfaces storage/corruption failures',()=>{
 const map=new Map(),storage={setItem:(key,value)=>map.set(key,value),getItem:key=>map.get(key)??null};
 assert.equal(loadBackup(storage),null);saveBackup(storage,project());assert.deepEqual(loadBackup(storage),project());
 map.set([...map.keys()][0],'{broken');assert.throws(()=>loadBackup(storage));
 assert.throws(()=>saveBackup({setItem(){throw Error('Quota exceeded');}},project()),/Quota/);
});
test('optional costing survives project files, backups and undo while old files remain unchanged',()=>{
 const initial=project();initial.costing={...DEFAULT_COSTING,currency:'OMR',materials:[{material:'MDF 18 mm',thickness:18,pricePerM2:25}],edgeRate:1.5};
 const result=parseProject(serializeProject(initial));assert.deepEqual(result,initial);
 result.costing.materials[0].pricePerM2=99;assert.equal(initial.costing.materials[0].pricePerM2,25);
 const history=createHistory(initial),edited=structuredClone(initial);edited.costing.materials[0].pricePerM2=30;
 assert.equal(history.push(edited),true);assert.equal(history.undo().costing.materials[0].pricePerM2,25);assert.equal(history.redo().costing.materials[0].pricePerM2,30);
 const map=new Map(),storage={setItem:(key,value)=>map.set(key,value),getItem:key=>map.get(key)??null};
 saveBackup(storage,initial);assert.deepEqual(loadBackup(storage).costing,initial.costing);
 assert.equal(Object.hasOwn(parseProject(project()),'costing'),false);
});
test('invalid costing rejects the whole imported candidate and cannot corrupt history',()=>{
 const initial=project(),history=createHistory(initial);
 for(const costing of [null,[],{...DEFAULT_COSTING,profitMarginPercent:100},{...DEFAULT_COSTING,edgeRate:-1}]){
  const bad={...initial,costing};assert.throws(()=>parseProject(bad));assert.throws(()=>history.push(bad));assert.deepEqual(history.current(),initial);
 }
});

test('quarter-turn placement survives projects and rejects unsupported angles',()=>{
 const input=project();input.units[0].rotation=90;
 assert.equal(parseProject(serializeProject(input)).units[0].rotation,90);
 for(const rotation of [45,360,-90,'90',null]){input.units[0].rotation=rotation;assert.throws(()=>parseProject(input),/rotation/)}
});

test('optional project and client names round-trip and are validated',async()=>{
 const {parseProject}=await import('./project.mjs');
 const base=JSON.parse(await (await import('node:fs/promises')).readFile(new URL('./samples/cab2-wardrobe-example.json',import.meta.url),'utf8'));
 const p=parseProject({...base,projectName:'Villa A',clientName:'Mr. B'});
 assert.equal(p.projectName,'Villa A');assert.equal(p.clientName,'Mr. B');
 assert.equal(Object.hasOwn(parseProject(base),'projectName'),false);
 assert.throws(()=>parseProject({...base,clientName:'x'.repeat(121)}),/client name/);
});
