/**
 * Company cloud for Rokadex Studio (same login as the Rokadex management app).
 * Works only when Studio is served by the management site (app.rokadex.com/studio/), which writes
 * rokadex-config.json next to Studio. Then Studio and the management app share the browser sign-in
 * (same Supabase project, same origin, same session key). Without that file Studio stays fully local.
 *
 * Saving: the project file goes to company storage (bucket 'files', <workshop>/studio-projects/<id>/<stamp>.rokadex.json)
 * through the storage quota reservation (database update 009), then the list row in public.studio_projects
 * (database update 016) is written with the version the user opened. If someone else saved in between,
 * the row update matches nothing: nothing is overwritten, the new file is removed and a conflict is reported.
 * Database rules decide who may read (members, Design add-on on) and save (owner/admin/manager, add-on on, subscription active).
 */
import {serializeProject,parseProject} from './project.mjs';

export const HANDOFF_KEY='rokadex-studio-handoff';
export class CloudConflict extends Error{constructor(message,current){super(message);this.name='CloudConflict';this.current=current}}

const ID=/^[A-Za-z0-9_-]{1,60}$/;
const stamp=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,6);
const lsGet=(s,k)=>{try{return s?.getItem(k)??null}catch{return null}};
const lsSet=(s,k,v)=>{try{s?.setItem(k,v)}catch{}};
const lsDel=(s,k)=>{try{s?.removeItem(k)}catch{}};
const fail=r=>{if(r?.error)throw Object.assign(new Error(r.error.message||String(r.error)),{code:r.error.code});return r?.data};

/** Reads ./rokadex-config.json. Returns null (local only) when it is missing or incomplete. */
export async function loadCloudConfig(fetchFn=globalThis.fetch,url='./rokadex-config.json'){
 try{const r=await fetchFn(url,{cache:'no-store'});if(!r.ok)return null;const c=await r.json();
  if(typeof c?.supabaseUrl!=='string'||!/^https:\/\/[a-z0-9.-]+$/i.test(c.supabaseUrl)||typeof c.supabaseKey!=='string'||!c.supabaseKey)return null;
  return {supabaseUrl:c.supabaseUrl,supabaseKey:c.supabaseKey,appUrl:typeof c.appUrl==='string'?c.appUrl:'../'}}
 catch{return null}
}

/**
 * createCloud({client, storage}) → cloud object. `client` is a supabase-js client (or a test double with the same calls).
 * state.mode: 'signed-out' | 'no-company' | 'ready'
 */
export function createCloud({client,storage=globalThis.localStorage}){
 const state={mode:'signed-out',user:null,companies:[],ws:null,role:null,design:false,active:false};
 const canRead=()=>state.mode==='ready'&&state.design;
 const canSave=()=>canRead()&&state.active&&['owner','admin','manager'].includes(state.role);
 async function init(){
  const s=await client.auth.getSession();const user=s?.data?.session?.user??null;
  Object.assign(state,{user,companies:[],ws:null,role:null,design:false,active:false,mode:user?'no-company':'signed-out'});
  if(!user)return state;
  const rows=fail(await client.from('memberships').select('role, workshop_id, workshops(id, name, plan, trial_ends_at, paid_until)').eq('user_id',user.id))??[];
  state.companies=rows.filter(m=>m.workshops).map(m=>({id:m.workshops.id,name:m.workshops.name,role:m.role}));
  const want=lsGet(storage,'rokadex.studio.ws')||lsGet(storage,'warsha-ws');
  const pick=state.companies.find(c=>c.id===want)??(state.companies.length===1?state.companies[0]:state.companies[0]);
  if(pick)await useCompany(pick.id);
  return state;
 }
 async function useCompany(id){
  const c=state.companies.find(x=>x.id===id);if(!c)throw Error('Not a member of this company');
  const [mods,act]=await Promise.all([client.from('workshop_modules').select('module, enabled').eq('workshop_id',id),client.rpc('workshop_active',{ws:id})]);
  const list=fail(mods)??[];
  Object.assign(state,{ws:{id:c.id,name:c.name},role:c.role,design:list.some(m=>m.module==='design'&&m.enabled),active:act?.data!==false,mode:'ready'});
  lsSet(storage,'rokadex.studio.ws',id);
  return state;
 }
 function need(save){if(state.mode!=='ready')throw Error('Sign in to Rokadex first');if(!state.design)throw Error('Studio cloud is part of the Design add-on, which is not enabled for this company');if(save&&!state.active)throw Error('The subscription of this company has ended: cloud projects can be opened but not saved');if(save&&!canSave())throw Error('Only managers, admins and the owner can save to the company cloud')}
 async function list(){need(false);return fail(await client.from('studio_projects').select('id, studio_id, name, client, project_id, object_name, bytes, design_revision, issued_revisions, units, version, updated_at, updated_by').eq('workshop_id',state.ws.id).order('updated_at',{ascending:false}))??[]}
 async function projects(){need(false);return fail(await client.from('projects').select('id, name, client, legacy_code').eq('workshop_id',state.ws.id).order('created_at',{ascending:false}))??[]}
 async function find(studioId){need(false);const rows=fail(await client.from('studio_projects').select('id, studio_id, name, client, project_id, object_name, bytes, design_revision, issued_revisions, units, version, updated_at, updated_by').eq('workshop_id',state.ws.id).eq('studio_id',studioId))??[];return rows[0]??null}
 async function open(row){
  need(false);
  const r=await client.storage.from('files').download(row.object_name);fail(r);
  const text=typeof r.data==='string'?r.data:await r.data.text();
  return {project:parseProject(JSON.parse(text)),row};
 }
 async function upload(path,text,meta){
  const bytes=new TextEncoder().encode(text).length;
  const res=fail(await client.rpc('storage_reserve',{p_ws:state.ws.id,p_bucket:'files',p_name:path,p_bytes:bytes,p_meta:meta}));
  const up=await client.storage.from('files').upload(path,new Blob([text],{type:'application/json'}),{upsert:true,contentType:'application/json'});
  if(up?.error){await client.rpc('storage_release',{p_id:res.id});fail(up)}
  const done=fail(await client.rpc('storage_commit',{p_id:res.id}));
  if(done&&done.ok===false)throw Error('Upload did not arrive; try again');
  return bytes;
 }
 async function removeFile(path){try{await client.storage.from('files').remove([path]);await client.rpc('storage_refresh',{p_ws:state.ws.id})}catch{}}
 /**
  * save(project, {version, projectLink}) → saved row. `version` = the version this browser opened (null for a project not yet in the cloud).
  * Throws CloudConflict when the cloud copy changed since; nothing is overwritten then.
  */
 async function save(project,{version=null,projectLink=undefined}={}){
  need(true);
  const p=parseProject(project);if(!ID.test(p.projectId))throw Error('Project id is not valid for the cloud');
  const text=serializeProject(p);
  const current=await find(p.projectId);
  if(current&&current.version!==version)throw new CloudConflict(`Someone else saved this project in the cloud (version ${current.version}) after you opened it`,current);
  if(!current&&version!=null)throw new CloudConflict('This project was deleted from the cloud after you opened it',null);
  const path=`${state.ws.id}/studio-projects/${p.projectId}/${stamp()}.rokadex.json`;
  const link=projectLink===undefined?(current?.project_id??null):projectLink;
  const bytes=await upload(path,text,{file_name:`${p.projectId}.rokadex.json`,...(link?{project_id:link}:{})});
  const fields={name:(p.projectName??'').slice(0,120),client:(p.clientName??'').slice(0,120),project_id:link,object_name:path,bytes,design_revision:p.designRevision,issued_revisions:(p.releases??[]).length,units:p.units.length};
  let row;
  try{
   if(current){
    const r=fail(await client.from('studio_projects').update(fields).eq('id',current.id).eq('version',current.version).select());
    if(!r?.length){const now=await find(p.projectId);throw new CloudConflict('Someone else saved this project in the cloud at the same moment',now)}
    row=r[0];
   }else{
    const r=await client.from('studio_projects').insert({workshop_id:state.ws.id,studio_id:p.projectId,...fields}).select();
    if(r.error&&/duplicate|unique/i.test(r.error.message||'')){const now=await find(p.projectId);throw new CloudConflict('Someone else saved a project with this id in the cloud at the same moment',now)}
    row=fail(r)[0];
   }
  }catch(e){await removeFile(path);throw e}
  if(current&&current.object_name!==path)await removeFile(current.object_name);
  return row;
 }
 async function remove(row){need(true);fail(await client.from('studio_projects').delete().eq('id',row.id).eq('version',row.version));await removeFile(row.object_name)}
 /** Hands an issued package to the management app on the same site (it opens the import page with it). */
 function handOff(pkg){const text=JSON.stringify({at:Date.now(),ws:state.ws?.id??null,pkg});try{storage.setItem(HANDOFF_KEY,text)}catch(e){throw Error('This browser could not pass the package to Rokadex ('+e.message+'); use “Package for Rokadex management” and choose the file there')}return text.length}
 function signOutLocal(){lsDel(storage,'rokadex.studio.ws')}
 return {state,init,useCompany,list,projects,find,open,save,remove,handOff,canRead,canSave,signOutLocal};
}
