import test from 'node:test';
import assert from 'node:assert/strict';
import {createCloud,loadCloudConfig,CloudConflict,HANDOFF_KEY} from './cloud.mjs';
import {parseProject} from './project.mjs';
import {DEFAULTS,MODERN_RULES} from './engine.mjs';
import {DEFAULT_ROOM} from './room.mjs';

const project=(id='PRJ-C',name='Villa')=>parseProject({format:'rokadex-standalone',version:3,projectId:id,designRevision:1,lengthUnit:'mm',room:{...DEFAULT_ROOM},projectName:name,units:[{id:'CAB-001',name:'Base',type:'cabinet',x:0,z:0,finish:'oak',config:{...DEFAULTS,...MODERN_RULES}}]});
function memStorage(){const m=new Map();return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k),m}}

/** Minimal stand-in for the supabase-js calls cloud.mjs makes, with the 016 rules: version +1 on update, unique (workshop, studio_id), role/add-on checks. */
function fakeClient({user={id:'u1'},role='manager',design=true,active=true}={}){
 const db={memberships:[{user_id:'u1',role,workshop_id:'W1',workshops:{id:'W1',name:'Noor'}}],workshop_modules:[{workshop_id:'W1',module:'design',enabled:design}],studio_projects:[],projects:[{id:'P1',workshop_id:'W1',name:'Kitchen'}]};
 const files=new Map(),log=[];let seq=0;
 const write=()=>design&&active&&['owner','admin','manager'].includes(role);
 function q(table){
  const f=[];let op='select',vals=null;
  const api={select(){return api},eq(k,v){f.push(r=>r[k]===v);return api},order(){return api},
   insert(v){op='insert';vals=v;return api},update(v){op='update';vals=v;return api},delete(){op='delete';return api},
   then(res,rej){return Promise.resolve(run()).then(res,rej)}};
  function run(){
   const rows=db[table];
   if(table==='studio_projects'&&!design)return {data:[],error:null};
   if(op==='select')return {data:rows.filter(r=>f.every(fn=>fn(r))).map(r=>({...r})),error:null};
   if(!write())return {data:null,error:{message:'new row violates row-level security policy'}};
   if(op==='insert'){if(rows.some(r=>r.workshop_id===vals.workshop_id&&r.studio_id===vals.studio_id))return {data:null,error:{message:'duplicate key value violates unique constraint'}};const r={id:'sp'+(++seq),version:1,updated_at:new Date().toISOString(),...vals};rows.push(r);return {data:[{...r}],error:null}}
   const hit=rows.filter(r=>f.every(fn=>fn(r)));
   if(op==='update'){hit.forEach(r=>{Object.assign(r,vals);r.version++});return {data:hit.map(r=>({...r})),error:null}}
   if(op==='delete'){db[table]=rows.filter(r=>!hit.includes(r));return {data:null,error:null}}
  }
  return api;
 }
 const client={
  db,files,log,
  auth:{getSession:async()=>({data:{session:user?{user}:null}})},
  from:q,
  rpc:async(name,args)=>{log.push(name);
   if(name==='workshop_active')return {data:active};
   if(name==='storage_reserve'){if(!args.p_name.startsWith(args.p_ws+'/'))return {error:{message:'The file path must start with the company folder'}};return {data:{id:'r'+(++seq)}}}
   if(name==='storage_commit')return {data:{ok:true}};
   return {data:null}},
  storage:{from:()=>({
   upload:async(path,blob)=>{if(client.failUpload)return {error:{message:'Network error'}};files.set(path,await blob.text());return {data:{path}}},
   download:async path=>files.has(path)?{data:new Blob([files.get(path)])}:{error:{message:'Object not found'}},
   remove:async paths=>{paths.forEach(p=>files.delete(p));return {data:paths}}})}
 };
 return client;
}

test('config file: missing or bad means local only; good one is read',async()=>{
 assert.equal(await loadCloudConfig(async()=>({ok:false})),null);
 assert.equal(await loadCloudConfig(async()=>({ok:true,json:async()=>({supabaseUrl:'javascript:alert(1)',supabaseKey:'k'})})),null);
 assert.equal(await loadCloudConfig(async()=>{throw Error('offline')}),null);
 assert.deepEqual(await loadCloudConfig(async()=>({ok:true,json:async()=>({supabaseUrl:'https://abc.supabase.co',supabaseKey:'sb_publishable_x'})})),{supabaseUrl:'https://abc.supabase.co',supabaseKey:'sb_publishable_x',appUrl:'../'});
});

test('signed out / signed in with the management company',async()=>{
 const out=createCloud({client:fakeClient({user:null}),storage:memStorage()});
 assert.equal((await out.init()).mode,'signed-out');
 await assert.rejects(()=>out.list(),/Sign in/);
 const st=memStorage();st.setItem('warsha-ws','W1');
 const c=createCloud({client:fakeClient(),storage:st});
 const s=await c.init();
 assert.equal(s.mode,'ready');assert.equal(s.ws.name,'Noor');assert.equal(s.role,'manager');assert.ok(c.canSave());
 assert.equal(st.getItem('rokadex.studio.ws'),'W1');
});

test('save, reopen, save again; old file removed; versions count up',async()=>{
 const cl=fakeClient(),c=createCloud({client:cl,storage:memStorage()});await c.init();
 const row=await c.save(project(),{version:null,projectLink:'P1'});
 assert.equal(row.version,1);assert.equal(row.project_id,'P1');assert.equal(row.units,1);
 assert.ok(row.object_name.startsWith('W1/studio-projects/PRJ-C/'));
 assert.deepEqual(cl.log.filter(n=>n.startsWith('storage_')).slice(0,2),['storage_reserve','storage_commit']);
 const {project:back}=await c.open(row);
 assert.equal(back.projectName,'Villa');assert.equal(back.units.length,1);
 const p2=project();p2.projectName='Villa v2';
 const row2=await c.save(p2,{version:1});
 assert.equal(row2.version,2);assert.equal(row2.name,'Villa v2');assert.equal(row2.project_id,'P1','link kept');
 assert.equal(cl.files.size,1,'previous file deleted after a successful save');
 assert.ok(cl.files.has(row2.object_name));
});

test('two people: the second save with an old version is refused and nothing is overwritten',async()=>{
 const cl=fakeClient(),a=createCloud({client:cl,storage:memStorage()}),b=createCloud({client:cl,storage:memStorage()});
 await a.init();await b.init();
 await a.save(project(),{version:null});
 await a.save(Object.assign(project(),{projectName:'A edit'}),{version:1});
 await assert.rejects(()=>b.save(Object.assign(project(),{projectName:'B edit'}),{version:1}),e=>e instanceof CloudConflict&&e.current.version===2);
 const row=(await a.list())[0];
 assert.equal(row.name,'A edit');assert.equal(cl.files.size,1);
 // a project not in the cloud yet but someone created the same id meanwhile
 await assert.rejects(()=>b.save(project(),{version:null}),CloudConflict);
 // deleted meanwhile
 await a.remove(row);
 await assert.rejects(()=>b.save(project(),{version:2}),/deleted/);
 assert.equal(cl.files.size,0);
});

test('failed upload releases the reservation and saves nothing',async()=>{
 const cl=fakeClient(),c=createCloud({client:cl,storage:memStorage()});await c.init();
 cl.failUpload=true;
 await assert.rejects(()=>c.save(project(),{version:null}),/Network error/);
 assert.ok(cl.log.includes('storage_release'));assert.equal(cl.db.studio_projects.length,0);
});

test('add-on off, subscription ended, worker: honest refusals',async()=>{
 const off=createCloud({client:fakeClient({design:false}),storage:memStorage()});await off.init();
 assert.equal(off.canRead(),false);await assert.rejects(()=>off.list(),/Design add-on/);
 const ended=createCloud({client:fakeClient({active:false}),storage:memStorage()});await ended.init();
 assert.equal(ended.canRead(),true);assert.equal(ended.canSave(),false);
 await assert.rejects(()=>ended.save(project(),{version:null}),/subscription/);
 const worker=createCloud({client:fakeClient({role:'worker'}),storage:memStorage()});await worker.init();
 assert.equal(worker.canSave(),false);await assert.rejects(()=>worker.save(project(),{version:null}),/managers/);
});

test('hand-off to the management app stores the package for the import page',async()=>{
 const st=memStorage(),c=createCloud({client:fakeClient(),storage:st});await c.init();
 c.handOff({format:'rokadex-studio-package',checksum:'x'});
 const got=JSON.parse(st.getItem(HANDOFF_KEY));
 assert.equal(got.pkg.checksum,'x');assert.equal(got.ws,'W1');assert.ok(got.at>0);
 const full={getItem:()=>null,setItem:()=>{throw Error('QuotaExceededError')}};
 const c2=createCloud({client:fakeClient(),storage:full});await c2.init();
 assert.throws(()=>c2.handOff({}),/Package for Rokadex management/);
});
